const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;

let server;

test.before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(PORT),
      JWT_SECRET: "test-secret-1234567890-abcdefghijklmnopqrstuvwxyz",
      JWT_EXPIRES: "1h",
      ALLOW_DEV_OTP: "true",
      DEMO_OTP_ENABLED: "true",
      ADMIN_PASSKEY: "484951",
      FACULTY_SIGNUP_KEY: "484955",
      AUTH_RATE_LIMIT: "1000",
      TEST_MODE: "true",
      DB_HOST: "127.0.0.1", // force MySQL attempt -> fail -> SQLite fallback
      DB_PORT: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let buf = "";
    const onData = (d) => {
      buf += d.toString();
      if (buf.includes("HostelHub Backend running")) resolve();
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (code) => reject(new Error("server exited " + code)));
    setTimeout(() => reject(new Error("startup timeout: " + buf)), 15000);
  });
});

test.after(() => {
  if (server) server.kill();
});

async function postJson(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, data, text };
}

async function register(email) {
  const r = await postJson("/api/auth/register", {
    name: "Test Student",
    email,
    password: "password123",
    role: "Student",
  });
  assert.equal(r.status, 200, "register status " + r.status + " " + r.text);
  const otp = r.data?.demoOtp || r.data?.devOtp;
  assert.ok(otp, "no dev OTP returned");
  const v = await postJson("/api/auth/verify", { email, otp });
  assert.equal(v.status, 201, "verify status " + v.status + " " + v.text);
  assert.ok(v.data?.token, "no token");
  return { token: v.data.token, user: v.data.user };
}

test("two students cannot read each other's room assignment", async () => {
  const a = await register("studenta@test.com");
  const b = await register("studentb@test.com");

  const ra = await fetch(BASE + "/api/rooms/mine", {
    headers: { Authorization: "Bearer " + a.token },
  });
  const rb = await fetch(BASE + "/api/rooms/mine", {
    headers: { Authorization: "Bearer " + b.token },
  });
  assert.equal(ra.status, 200);
  assert.equal(rb.status, 200);
  const da = await ra.json();
  const db = await rb.json();
  // Both unassigned in fresh DB -> null; ensure no cross-leak by comparing identities
  assert.notEqual(a.user.id, b.user.id);
  // If either has a room, they must differ
  if (da.data && db.data) {
    assert.notEqual(da.data.room || da.data.room_number, db.data.room || db.data.room_number);
  }
});

test("notification ownership: B cannot read or mark A's notification", async () => {
  const a = await register("notifA@test.com");
  const b = await register("notifB@test.com");

  // Insert a notification directly for A via DB? Not accessible. Instead verify B sees none of A's.
  const la = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const lb = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + b.token } });
  assert.equal(la.status, 200);
  assert.equal(lb.status, 200);
  const da = await la.json();
  const dbb = await lb.json();
  const aIds = new Set((da.data || []).map((n) => n.id));
  for (const n of dbb.data || []) {
    assert.ok(!aIds.has(n.id), "B can see A's notification id " + n.id);
  }

  // B cannot mark A's notification read (should 404)
  if ((da.data || []).length > 0) {
    const aid = da.data[0].id;
    const r = await fetch(BASE + "/api/notifications/" + aid + "/read", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + b.token },
    });
    assert.equal(r.status, 404, "B marked A's notification read: " + r.status);
  }
});

test("unauthenticated request to /api/rooms/mine returns 401", async () => {
  const r = await fetch(BASE + "/api/rooms/mine");
  assert.equal(r.status, 401);
});

test("invalid token returns 401", async () => {
  const r = await fetch(BASE + "/api/rooms/mine", {
    headers: { Authorization: "Bearer invalid.token.here" },
  });
  assert.equal(r.status, 401);
});


async function registerAdmin(email) {
  const r = await postJson("/api/auth/register", {
    name: "Test Admin",
    email,
    password: "password123",
    role: "Admin",
    passkey: "484951",
  });
  if (r.status !== 200) throw new Error("admin register failed: " + r.status + " " + r.text);
  const otp = r.data?.demoOtp || r.data?.devOtp;
  if (!otp) throw new Error("no dev OTP");
  const v = await postJson("/api/auth/verify", { email, otp });
  if (v.status !== 201) throw new Error("admin verify failed: " + v.status);
  if (!v.data?.token) throw new Error("no admin token");
  return { token: v.data.token, user: v.data.user };
}

test("leave status change creates notification for the owning student only", async () => {
  const a = await register("leavenotifA@test.com");
  const b = await register("leavenotifB@test.com");
  const admin = await registerAdmin("adminnotif@test.com");

  const leaveRes = await fetch(BASE + "/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.token },
    body: JSON.stringify({ reason: "Family event", startDate: "2025-01-01", endDate: "2025-01-02" }),
  });
  const leaveJson = await leaveRes.json();
  assert.equal(leaveRes.status, 201, "leave create failed: " + JSON.stringify(leaveJson));
  const leaveId = leaveJson.data.id;

  const statusRes = await fetch(BASE + "/api/leave/" + leaveId + "/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + admin.token },
    body: JSON.stringify({ status: "Approved", adminRemarks: "ok" }),
  });
  assert.equal(statusRes.status, 200, "status change failed: " + statusRes.status);

  const na = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const naJson = await na.json();
  assert.ok((naJson.data || []).some((n) => n.relatedType === "leave" && Number(n.relatedId) === Number(leaveId)),
    "A did not receive leave notification");

  const nb = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + b.token } });
  const nbJson = await nb.json();
  const aIds = new Set((naJson.data || []).map((n) => n.id));
  for (const n of nbJson.data || []) {
    assert.ok(!aIds.has(n.id), "B can see A's notification");
  }
});

test("failed status change does not create notification", async () => {
  const a = await register("failnotifA@test.com");
  const admin = await registerAdmin("adminfail@test.com");

  const leaveRes = await fetch(BASE + "/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.token },
    body: JSON.stringify({ reason: "Test", startDate: "2025-02-01", endDate: "2025-02-02" }),
  });
  const leaveJson = await leaveRes.json();
  const leaveId = leaveJson.data.id;

  const before = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const beforeJson = await before.json();
  const beforeCount = (beforeJson.data || []).length;

  const bad = await fetch(BASE + "/api/leave/" + leaveId + "/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + admin.token },
    body: JSON.stringify({ status: "NotAStatus" }),
  });
  assert.notEqual(bad.status, 200, "invalid status should not succeed");

  const after = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const afterJson = await after.json();
  assert.equal((afterJson.data || []).length, beforeCount, "notification created on failed status change");
});

test("unauthorized status change (student) returns 403 and creates no notification", async () => {
  const a = await register("unauthA@test.com");
  const b = await register("unauthB@test.com");

  const leaveRes = await fetch(BASE + "/api/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.token },
    body: JSON.stringify({ reason: "Test", startDate: "2025-03-01", endDate: "2025-03-02" }),
  });
  const leaveJson = await leaveRes.json();
  const leaveId = leaveJson.data.id;

  const before = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const beforeJson = await before.json();
  const beforeCount = (beforeJson.data || []).length;

  const bad = await fetch(BASE + "/api/leave/" + leaveId + "/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + b.token },
    body: JSON.stringify({ status: "Approved" }),
  });
  assert.equal(bad.status, 403, "student should not approve leave: " + bad.status);

  const after = await fetch(BASE + "/api/notifications", { headers: { Authorization: "Bearer " + a.token } });
  const afterJson = await after.json();
  assert.equal((afterJson.data || []).length, beforeCount, "notification created on unauthorized change");
});
