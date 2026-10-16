/* Temporary integration test for the rooms router (GET/POST/PUT/DELETE). */
const express = require("express");
const rooms = require("./rooms");

const app = express();
app.use(express.json());
app.use("/api/rooms", rooms);

const BASE = "http://localhost:5099";

const srv = app.listen(5099, async () => {
  let exitCode = 0;
  try {
    let r = await fetch(`${BASE}/api/rooms`);
    let j = await r.json();
    console.log("LIST   :", r.status, "count =", Array.isArray(j.data) ? j.data.length : "??",
      "| first =", JSON.stringify(j.data && j.data[0]));

    r = await fetch(`${BASE}/api/rooms?wing=Girls&category=Premium`);
    j = await r.json();
    console.log("FILTER :", r.status, "count =", j.data.length,
      "|", j.data.map((x) => `${x.room}/${x.wing}/${x.category}`).join(", "));

    r = await fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: "909", floor: "Ground Floor", type: "2 Seater", capacity: 2, occupied: 0,
        wing: "Girls", category: "Premium", washroom: "Attached",
        amenities: "Bed, AC", monthlyRent: 8500,
        toiletCondition: "Good", cleaningStatus: "Cleaning Done",
        groundSportsStatus: "Open", shaftsStatus: "Full",
        safetyNotes: "CCTV on floor", photoGallery: "/rooms/a.jpg, /rooms/b.jpg",
      }),
    });
    j = await r.json();
    console.log("CREATE :", r.status, JSON.stringify(j.data));
    if (!j.data || j.data.toiletCondition !== "Good" || !j.data.safetyNotes) exitCode = 1;

    const id = j.data && j.data.id;
    r = await fetch(`${BASE}/api/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: "909", floor: "Ground Floor", type: "2 Seater", capacity: 2, occupied: 1,
        status: "Occupied", wing: "Girls", category: "Deluxe", washroom: "Attached",
        amenities: "Bed, AC", monthlyRent: 9000,
        toiletCondition: "Fair", cleaningStatus: "Overdue",
        groundSportsStatus: "Closed", shaftsStatus: "Empty",
        safetyNotes: "Updated note", photoGallery: "/rooms/c.jpg",
      }),
    });
    j = await r.json();
    console.log("UPDATE :", r.status, JSON.stringify(j.data));
    if (!j.data || j.data.toiletCondition !== "Fair" || j.data.category !== "Deluxe") exitCode = 1;

    r = await fetch(`${BASE}/api/rooms/${id}`, { method: "DELETE" });
    j = await r.json();
    console.log("DELETE :", r.status, JSON.stringify(j));
    if (r.status !== 200) exitCode = 1;
  } catch (e) {
    console.error("TEST ERROR:", e);
    exitCode = 1;
  } finally {
    srv.close();
    setTimeout(() => process.exit(exitCode), 200);
  }
});
