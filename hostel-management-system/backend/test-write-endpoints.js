/* Comprehensive smoke test — boots the REAL routers and exercises every
   write endpoint (create / update / delete) against the live DB layer.
   Run: node backend/test-write-endpoints.js                       */
const express = require("express");

require("dotenv").config();

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use("/api/auth", require("./auth"));
app.use("/api/students", require("./students"));
app.use("/api/rooms", require("./rooms"));
app.use("/api/fees", require("./fees"));
app.use("/api/complaints", require("./complaints"));
app.use("/api/mess", require("./mess"));
app.use("/api/facilities", require("./facilities"));
app.use("/api/notices", require("./notices"));
app.use("/api/services", require("./services"));
app.use("/api/maintenance", require("./maintenance"));
app.use("/api/leave", require("./leave"));
app.use("/api/gym", require("./gym"));
app.use("/api/room-issues", require("./room_issue"));

const PORT = 5097;
const BASE = `http://localhost:${PORT}`;
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const state = { failures: 0 };

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function check(label, method, path, body, expectStatus, validate) {
  let r;
  try {
    r = await call(method, path, body);
  } catch (e) {
    state.failures++;
    console.log("FAIL", label.padEnd(34), "THREW", e.message);
    return null;
  }
  let ok = r.status === expectStatus;
  let detail = `status=${r.status}`;
  if (ok && validate) {
    const v = validate(r.json);
    if (v !== true) {
      ok = false;
      detail = typeof v === "string" ? v : `validation failed: ${JSON.stringify(r.json).slice(0, 160)}`;
    }
  }
  if (!ok) state.failures++;
  console.log(ok ? "PASS" : "FAIL", label.padEnd(34), detail, ok ? "" : JSON.stringify(r.json).slice(0, 200));
  return r.json;
}

const has = (key) => (j) => (j && j.data && j.data[key] !== undefined ? true : `missing data.${key}`);
const okMsg = (j) => (j && j.success === true ? true : `success !== true (${JSON.stringify(j).slice(0, 140)})`);
const gotId = (j) => (j && j.data && j.data.id ? true : "no id returned");

/* ---- Runner: boots the app and exercises every write endpoint ---- */
const srv = app.listen(PORT, async () => {
  console.log("=== HostelHub write-endpoint smoke test ===\n");
  try {
    /* ---------------- students ---------------- */
    const stu = await check(
      "students CREATE", "POST", "/api/students",
      { name: "Smoke Student", email: `smoke${Date.now()}@test.dev`, phone: "9000000000", course: "B.Tech", room: "101", status: "Active" },
      201, gotId
    );
    if (stu && stu.data) {
      await check("students UPDATE", "PUT", `/api/students/${stu.data.id}`,
        { name: "Smoke Student 2", email: stu.data.email, phone: "9000000001", course: "B.Tech", room: "102", status: "Active" },
        200, has("name"));
      await check("students DELETE", "DELETE", `/api/students/${stu.data.id}`, undefined, 200, okMsg);
    }

    /* ---------------- rooms ---------------- */
    const room = await check(
      "rooms CREATE", "POST", "/api/rooms",
      { room: "S901", floor: "Ground Floor", type: "2 Seater", capacity: 2, occupied: 0, status: "Available", wing: "Boys", category: "Standard", washroom: "Common", amenities: "Bed, Fan", monthlyRent: 4000 },
      201, gotId
    );
    if (room && room.data) {
      await check("rooms UPDATE", "PUT", `/api/rooms/${room.data.id}`,
        { room: "S901", floor: "First Floor", type: "2 Seater", capacity: 2, occupied: 1, status: "Occupied", wing: "Boys", category: "Deluxe", washroom: "Attached", amenities: "Bed, AC", monthlyRent: 5500 },
        200, has("floor"));
      await check("rooms DELETE", "DELETE", `/api/rooms/${room.data.id}`, undefined, 200, okMsg);
    }

    /* ---------------- fees ---------------- */
    const fee = await check(
      "fees CREATE", "POST", "/api/fees",
      { student: "Smoke Student", room: "101", amount: 4500, date: "2026-01-15", method: "UPI", status: "Paid", roomCharge: 4000, electricityCharge: 200, foodCharge: 0, cleaningCharge: 300, otherCharge: 0 },
      201, gotId
    );
    if (fee && fee.data) {
      await check("fees DELETE", "DELETE", `/api/fees/${fee.data.id}`, undefined, 200, okMsg);
    }


    /* ---------------- complaints ---------------- */
    const comp = await check(
      "complaints CREATE", "POST", "/api/complaints",
      { student: "Smoke Student", room: "101", subject: "Smoke complaint", description: "test", priority: "Medium", status: "Pending" },
      201, gotId
    );
    if (comp && comp.data) {
      await check("complaints UPDATE", "PUT", `/api/complaints/${comp.data.id}`,
        { student: "Smoke Student", room: "101", subject: "Smoke complaint", description: "test", priority: "High", status: "Resolved" },
        200, okMsg);
      await check("complaints DELETE", "DELETE", `/api/complaints/${comp.data.id}`, undefined, 200, okMsg);
    }

    /* ---------------- notices ---------------- */
    const notice = await check(
      "notices CREATE", "POST", "/api/notices",
      { title: "Smoke notice", message: "hello", audience: "All" },
      201, gotId
    );
    if (notice && notice.data) {
      await check("notices DELETE", "DELETE", `/api/notices/${notice.data.id}`, undefined, 200, okMsg);
    }

    /* ---------------- facilities ---------------- */
    const fac = await check(
      "facilities CREATE", "POST", "/api/facilities",
      { category: "General", title: "Smoke facility", details: "test", contactName: "X", contactPhone: "123", status: "Active" },
      201, gotId
    );
    if (fac && fac.data) {
      await check("facilities UPDATE", "PUT", `/api/facilities/${fac.data.id}`,
        { category: "General", title: "Smoke facility 2", details: "test", contactName: "Y", contactPhone: "456", status: "Active" },
        200, okMsg);
      await check("facilities DELETE", "DELETE", `/api/facilities/${fac.data.id}`, undefined, 200, okMsg);
    }

    /* ---------------- mess menu (update) ---------------- */
    await check("mess PUT menu", "PUT", "/api/mess/Monday",
      { breakfast: "Smoke Poha", lunch: "Smoke Dal", dinner: "Smoke Paneer", status: "Published" },
      200, okMsg);
    await check("mess PATCH status", "PATCH", "/api/mess/Monday/status", { status: "Pending" }, 200, okMsg);

    /* ---------------- photo-based creates ---------------- */
    const mp = await check(
      "mess photos CREATE", "POST", "/api/mess/photos",
      { title: "Smoke mess photo", photo: TINY_PNG, foodQuality: 4, comment: "tasty" },
      201, gotId
    );
    const gp = await check(
      "gym photos CREATE", "POST", "/api/gym/photos",
      { title: "Smoke gym photo", photo: TINY_PNG, description: "treadmill", equipmentType: "Cardio", status: "Active" },
      201, gotId
    );
    const ri = await check(
      "room-issues CREATE", "POST", "/api/room-issues",
      { roomNumber: "101", title: "Smoke broken fan", photo: TINY_PNG, description: "fan not working", status: "Pending" },
      201, gotId
    );
    const mr = await check(
      "maintenance CREATE", "POST", "/api/maintenance",
      { studentName: "Smoke Student", roomNumber: "101", title: "Smoke leak", description: "water", photo: TINY_PNG, priority: "High" },
      201, gotId
    );
    const lr = await check(
      "leave CREATE", "POST", "/api/leave",
      { studentName: "Smoke Student", roomNumber: "101", reason: "Smoke reason", startDate: "2026-02-01", endDate: "2026-02-03" },
      201, gotId
    );

    /* ---------------- services (the 8-category table) ---------------- */
    for (const category of [
      "Emergency Contact", "Medical Facilities", "WiFi Information", "Laundry Services",
      "Study Room", "Water & Electricity", "Housekeeping", "Entry & Exit Rules",
    ]) {
      await check(
        `services CREATE [${category}]`, "POST", "/api/services",
        { category, title: `Smoke ${category}`, details: "test", contactName: "X", contactPhone: "999", status: "Active" },
        201, gotId
      );
    }
    /* invalid category must NOT be silently coerced to "General" (CHECK constraint) */
    await check(
      "services CREATE [invalid category]",
      "POST", "/api/services",
      { category: "General", title: "Smoke bad cat", details: "t", status: "Active" },
      201, (j) => (j && j.data && j.data.category === "Emergency Contact" ? true : `category became "${j && j.data && j.data.category}"`)
    );

    const svcList = await call("GET", "/api/services?search=Smoke");
    const svcRow = svcList.json && svcList.json.data && svcList.json.data.find((s) => s.title === "Smoke Study Room");
    if (svcRow) {
      await check("services UPDATE", "PUT", `/api/services/${svcRow.id}`,
        { category: "Study Room", title: "Smoke Study Room 2", details: "u", contactName: "Y", contactPhone: "111", status: "Active" },
        200, has("title"));
      await check("services DELETE", "DELETE", `/api/services/${svcRow.id}`, undefined, 200, okMsg);
    } else {
      state.failures++;
      console.log("FAIL", "services UPDATE/DELETE".padEnd(34), "could not find seeded smoke row");
    }

    /* ---------------- cleanup ---------------- */
    const cleanup = [
      ["mess photos", "/api/mess/photos", mp],
      ["gym photos", "/api/gym/photos", gp],
      ["room issues", "/api/room-issues", ri],
      ["maintenance", "/api/maintenance", mr],
      ["leave", "/api/leave", lr],
    ];
    for (const [label, path, res] of cleanup) {
      if (res && res.data && res.data.id) {
        await check(`${label} DELETE`, "DELETE", `${path}/${res.data.id}`, undefined, 200, okMsg);
      }
    }
  } catch (e) {
    console.error("TEST HARNESS ERROR:", e);
    state.failures++;
  } finally {
    console.log(`\n=== ${state.failures === 0 ? "ALL PASSED" : state.failures + " FAILURE(S)"} ===`);
    srv.close();
    setTimeout(() => process.exit(state.failures === 0 ? 0 : 1), 200);
  }
});

