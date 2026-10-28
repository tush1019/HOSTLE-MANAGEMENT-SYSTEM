const express = require("express");
const db = require("./db");
const { getFacultyScope } = require("./facultyScope");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
const adminOnly = [authMiddleware, requireRole("Admin")];

async function resolveStudentName(req) {
  try {
    const [rows] = await db.query(`SELECT name FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1`, [req.user.email]);
    if (rows && rows.length) return rows[0].name;
  } catch (e) {}
  return req.user.email || req.user.name || "Unknown";
}

const VALID_PRIORITY = ["Low", "Medium", "High"];
const VALID_STATUS = ["Pending", "In Progress", "Resolved"];

const MAINT_SELECT = `id, request_code AS requestCode, student_name AS studentName,
  room_number AS roomNumber, title, description, photo,
  priority, status, created_at AS createdAt`;

/* GET /api/maintenance?search=&status=&room= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const room = (req.query.room || "").trim();
    const student = (req.query.student || "").trim();
    const isAdmin = req.user.role === "Admin";
    const isFaculty = req.user.role === "Faculty";

    let sql = `SELECT ${MAINT_SELECT} FROM maintenance_requests`;
    const params = [];
    const where = [];

    if (search) {
      where.push(`(student_name LIKE ? OR title LIKE ? OR description LIKE ? OR request_code LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status && VALID_STATUS.includes(status)) {
      where.push("status = ?");
      params.push(status);
    }
    if (room) {
      where.push("room_number = ?");
      params.push(room);
    }
    if (isFaculty) {
      const scope = await getFacultyScope(req.user.email);
      if (scope.rooms.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const placeholders = scope.rooms.map(() => "?").join(",");
      where.push("TRIM(room_number) IN (" + placeholders + ")");
      params.push(...scope.rooms);
    } else if (!isAdmin) {
      const name = await resolveStudentName(req);
      where.push("student_name = ?");
      params.push(name);
    } else if (student && isAdmin) {
      where.push("student_name = ?");
      params.push(student);
    }

    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Maintenance list error:", error);
    res.status(500).json({ success: false, message: "Failed to load maintenance requests" });
  }
});

/* GET /api/maintenance/:id */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${MAINT_SELECT} FROM maintenance_requests WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Maintenance request not found" });
    }
    if (req.user.role === "Student") {
      const name = await resolveStudentName(req);
      if (rows[0].studentName !== name) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Maintenance get error:", error);
    res.status(500).json({ success: false, message: "Failed to load maintenance request" });
  }
});

/* POST /api/maintenance  (Student submits a maintenance request with optional photo) */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { studentName, roomNumber, title, description, photo, priority } = req.body;
    if (req.user.role === "Faculty") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const isAdmin = req.user.role === "Admin";
    const resolvedName = isAdmin && studentName && studentName.trim()
      ? studentName.trim()
      : await resolveStudentName(req);

    if (!resolvedName) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const prio = VALID_PRIORITY.includes(priority) ? priority : "Medium";

    const [result] = await db.query(
      `INSERT INTO maintenance_requests (student_name, room_number, title, description, photo, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        resolvedName,
        roomNumber ? roomNumber.trim() : null,
        title.trim(),
        description ? description.trim() : null,
        photo && photo.trim() ? photo.trim() : null,
        prio,
      ]
    );

    const code = "MNT" + String(result.insertId).padStart(3, "0");
    await db.query(`UPDATE maintenance_requests SET request_code = ? WHERE id = ?`, [code, result.insertId]);

    const [rows] = await db.query(
      `SELECT ${MAINT_SELECT} FROM maintenance_requests WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Maintenance request submitted", data: rows[0] });
  } catch (error) {
    console.error("Maintenance create error:", error);
    res.status(500).json({ success: false, message: "Failed to submit maintenance request" });
  }
});

/* PATCH /api/maintenance/:id/status  { status }  (Admin updates status) */
router.patch("/:id/status", adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const [result] = await db.query(`UPDATE maintenance_requests SET status = ? WHERE id = ?`, [
      status,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Maintenance request not found" });
    }

    res.json({ success: true, message: `Maintenance request marked as ${status}` });
  } catch (error) {
    console.error("Maintenance status error:", error);
    res.status(500).json({ success: false, message: "Failed to update maintenance request" });
  }
});

/* DELETE /api/maintenance/:id  (Admin) */
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM maintenance_requests WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Maintenance request not found" });
    }

    res.json({ success: true, message: "Maintenance request removed" });
  } catch (error) {
    console.error("Maintenance delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove maintenance request" });
  }
});

module.exports = router;
