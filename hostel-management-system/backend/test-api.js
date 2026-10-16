/* Temporary smoke test for dashboard / fees / facilities routes. */
const express = require("express");
const dashboard = require("./dashboard");
const fees = require("./fees");
const facilities = require("./facilities");

const app = express();
app.use(express.json());
app.use("/api/dashboard", dashboard);
app.use("/api/fees", fees);
app.use("/api/facilities", facilities);

const BASE = "http://localhost:5098";
const checks = [
  ["/api/dashboard", 200],
  ["/api/fees", 200],
  ["/api/facilities", 200],
];

const srv = app.listen(5098, async () => {
  let exitCode = 0;
  try {
    for (const [path, want] of checks) {
      const r = await fetch(`${BASE}${path}`);
      const j = await r.json().catch(() => null);
      const ok = r.status === want && j;
      if (!ok) exitCode = 1;
      console.log(path.padEnd(20), r.status, ok ? "OK" : "FAIL",
        JSON.stringify(j && (j.data ? j.data[0] || j.data : j)).slice(0, 220));
    }
    const d = await (await fetch(`${BASE}/api/dashboard`)).json();
    console.log("rooms payload:", JSON.stringify(d.data && d.data.rooms));
    if (!d.data || d.data.rooms.girls === undefined || d.data.rooms.boys === undefined) {
      console.log("FAIL: dashboard rooms missing boys/girls");
      exitCode = 1;
    }
  } catch (e) {
    console.error("TEST ERROR:", e);
    exitCode = 1;
  } finally {
    srv.close();
    setTimeout(() => process.exit(exitCode), 200);
  }
});
