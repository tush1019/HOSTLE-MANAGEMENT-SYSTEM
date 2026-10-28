const express = require("express");
const db = require("./db");
const { getFacultyScope } = require("./facultyScope");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const VALID_STATUS = ["Available", "Occupied", "Maintenance"];
const VALID_WING = ["Boys", "Girls"];
const VALID_CATEGORY = ["Standard", "Premium", "Deluxe"];
const VALID_WASHROOM = ["Attached", "Common"];
const VALID_CLEANING = ["Cleaning Scheduled", "Cleaning Done", "Overdue"];
const VALID_GROUND = ["Open", "Closed", "Maintenance"];
const VALID_SHAFTS = ["Full", "Empty", "Maintenance"];
const VALID_TOILET = ["Good", "Fair", "Poor"];

/* Default photo per wing & capacity (files live in frontend public/rooms) */
function defaultPhoto(wing, capacity) {
  if (capacity === 1) return "/rooms/premium-room.svg";
  return wing === "Girls" ? "/rooms/girls-room.svg" : "/rooms/boys-room.svg";
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function pick(value, valid, fallback) {
  return valid.includes(value) ? value : fallback;
}

/* Shared column list (camelCase aliases) used by GET / POST / PUT */
const ROOM_SELECT = `id, room_number AS room, floor, type, capacity,
             occupied, status, wing, category, washroom, amenities,
             monthly_rent AS monthlyRent, photo,
             photo_gallery AS photoGallery,
             toilet_condition AS toiletCondition,
             cleaning_status AS cleaningStatus,
             ground_sports_status AS groundSportsStatus,
             shafts_status AS shaftsStatus,
             safety_notes AS safetyNotes,
             created_at AS createdAt`;

async function resolveStudentRoom(req) {
  try {
    const [rows] = await db.query(
      `SELECT room_number FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [req.user.email]
    );
    if (rows && rows.length && rows[0].room_number) return rows[0].room_number;
  } catch (e) {}
  return null;
}
/* GET /api/rooms?search=&wing=&category= */
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const wing = (req.query.wing || "").trim();
    const category = (req.query.category || "").trim();

    const where = [];
    const params = [];

    if (search) {
      where.push(`(room_number LIKE ? OR floor LIKE ? OR type LIKE ? OR amenities LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (wing && VALID_WING.includes(wing)) {
      where.push("wing = ?");
      params.push(wing);
    }
    if (category && VALID_CATEGORY.includes(category)) {
      where.push("category = ?");
      params.push(category);
    }

    const isAdmin = req.user.role === "Admin";
    const isFaculty = req.user.role === "Faculty";
    if (isFaculty) {
      const scope = await getFacultyScope(req.user.email);
      if (scope.rooms.length === 0 && scope.wings.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const roomClauses = [];
      const roomParams = [];
      if (scope.rooms.length) { roomClauses.push("TRIM(room_number) IN (" + scope.rooms.map(() => "?").join(",") + ")"); roomParams.push(...scope.rooms); }
      if (scope.wings.length) { roomClauses.push("TRIM(wing) IN (" + scope.wings.map(() => "?").join(",") + ")"); roomParams.push(...scope.wings); }
      if (roomClauses.length) {
        where.push("(" + roomClauses.join(" OR ") + ")");
        params.push(...roomParams);
      } else {
        return res.json({ success: true, data: [] });
      }
    } else if (!isAdmin) {
      const roomNumber = await resolveStudentRoom(req);
      if (!roomNumber) return res.json({ success: true, data: [] });
      where.push("room_number = ?");
      params.push(roomNumber);
    }

    let sql = `SELECT ${ROOM_SELECT} FROM rooms`;
    if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
    sql += ` ORDER BY room_number ASC LIMIT 500`;

    const [rows] = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Rooms list error:", error);
    res.status(500).json({ success: false, message: "Failed to load rooms" });
  }
});

/* POST /api/rooms */
router.post('/', requireRole('Admin'), async (req, res) => {
  try {
    const { room, floor, type, capacity, occupied, status, wing, category, washroom, amenities, monthlyRent, photo,
      photoGallery, toiletCondition, cleaningStatus, groundSportsStatus, shaftsStatus, safetyNotes } = req.body;

    if (!room || !room.trim()) {
      return res.status(400).json({ success: false, message: 'Room number is required' });
    }

    const cap = Math.max(1, parseInt(capacity, 10) || 2);
    const occ = Math.min(cap, Math.max(0, parseInt(occupied, 10) || 0));
    const roomStatus = VALID_STATUS.includes(status)
      ? status
      : occ >= cap
        ? 'Occupied'
        : 'Available';
    const roomWing = pick(wing, VALID_WING, 'Boys');
    const roomCategory = pick(category, VALID_CATEGORY, 'Standard');
    const roomWashroom = pick(washroom, VALID_WASHROOM, 'Common');
    const roomAmenities = amenities && String(amenities).trim() ? String(amenities).trim() : null;
    const roomRent = num(monthlyRent, 0);
    const roomPhoto = photo && photo.trim() ? photo.trim() : defaultPhoto(roomWing, cap);
    const roomPhotoGallery = photoGallery && String(photoGallery).trim() ? String(photoGallery).trim() : null;
    const roomToiletCondition = VALID_TOILET.includes(toiletCondition) ? toiletCondition : null;
    const roomCleaningStatus = VALID_CLEANING.includes(cleaningStatus) ? cleaningStatus : null;
    const roomGroundSportsStatus = VALID_GROUND.includes(groundSportsStatus) ? groundSportsStatus : null;
    const roomShaftsStatus = VALID_SHAFTS.includes(shaftsStatus) ? shaftsStatus : null;
    const roomSafetyNotes = safetyNotes && String(safetyNotes).trim() ? String(safetyNotes).trim() : null;

    const [result] = await db.query(
      `INSERT INTO rooms (room_number, floor, type, capacity, occupied, status, wing, category, washroom, amenities,
        monthly_rent, photo, photo_gallery, toilet_condition, cleaning_status,
        ground_sports_status, shafts_status, safety_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.trim(),
        floor ? floor.trim() : 'Ground Floor',
        type ? type.trim() : '2 Seater',
        cap,
        occ,
        roomStatus,
        roomWing,
        roomCategory,
        roomWashroom,
        roomAmenities,
        roomRent,
        roomPhoto,
        roomPhotoGallery,
        roomToiletCondition,
        roomCleaningStatus,
        roomGroundSportsStatus,
        roomShaftsStatus,
        roomSafetyNotes,
      ]
    );

    const [rows] = await db.query(
      `SELECT ${ROOM_SELECT} FROM rooms WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Room added", data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Room number already exists" });
    }
    console.error("Room create error:", error);
    res.status(500).json({ success: false, message: "Failed to add room" });
  }
});

/* PUT /api/rooms/:id */
router.put("/:id", requireRole("Admin"), async (req, res) => {
  try {
    const { room, floor, type, capacity, occupied, status, wing, category, washroom, amenities, monthlyRent, photo, photoGallery, toiletCondition, cleaningStatus, groundSportsStatus, shaftsStatus, safetyNotes } = req.body;

    if (!room || !room.trim()) {
      return res.status(400).json({ success: false, message: "Room number is required" });
    }

    const cap = Math.max(1, parseInt(capacity, 10) || 2);
    const occ = Math.min(cap, Math.max(0, parseInt(occupied, 10) || 0));
    const roomStatus = VALID_STATUS.includes(status) ? status : "Available";
    const roomWing = pick(wing, VALID_WING, "Boys");
    const roomCategory = pick(category, VALID_CATEGORY, "Standard");
    const roomWashroom = pick(washroom, VALID_WASHROOM, "Common");
    const roomAmenities = amenities && String(amenities).trim() ? String(amenities).trim() : null;
    const roomRent = num(monthlyRent, 0);
    const roomPhoto = photo && photo.trim() ? photo.trim() : defaultPhoto(roomWing, cap);
    const roomPhotoGallery = photoGallery && String(photoGallery).trim() ? String(photoGallery).trim() : null;
    const roomToiletCondition = VALID_TOILET.includes(toiletCondition) ? toiletCondition : null;
    const roomCleaningStatus = VALID_CLEANING.includes(cleaningStatus) ? cleaningStatus : null;
    const roomGroundSportsStatus = VALID_GROUND.includes(groundSportsStatus) ? groundSportsStatus : null;
    const roomShaftsStatus = VALID_SHAFTS.includes(shaftsStatus) ? shaftsStatus : null;
    const roomSafetyNotes = safetyNotes && String(safetyNotes).trim() ? String(safetyNotes).trim() : null;

    const [result] = await db.query(
      `UPDATE rooms SET room_number = ?, floor = ?, type = ?,
        capacity = ?, occupied = ?, status = ?, wing = ?, category = ?,
        washroom = ?, amenities = ?, monthly_rent = ?, photo = ?,
        photo_gallery = ?, toilet_condition = ?, cleaning_status = ?,
        ground_sports_status = ?, shafts_status = ?, safety_notes = ? WHERE id = ?`,
      [
        room.trim(),
        floor ? floor.trim() : "Ground Floor",
        type ? type.trim() : "2 Seater",
        cap,
        occ,
        roomStatus,
        roomWing,
        roomCategory,
        roomWashroom,
        roomAmenities,
        roomRent,
        roomPhoto,
        roomPhotoGallery,
        roomToiletCondition,
        roomCleaningStatus,
        roomGroundSportsStatus,
        roomShaftsStatus,
        roomSafetyNotes,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const [rows] = await db.query(
      `SELECT ${ROOM_SELECT} FROM rooms WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true, message: "Room updated", data: rows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Room number already exists" });
    }
    console.error("Room update error:", error);
    res.status(500).json({ success: false, message: "Failed to update room" });
  }
});

/* DELETE /api/rooms/:id */
router.delete("/:id", requireRole("Admin"), async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM rooms WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    res.json({ success: true, message: "Room removed" });
  } catch (error) {
    console.error("Room delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove room" });
  }
});

module.exports = router;
