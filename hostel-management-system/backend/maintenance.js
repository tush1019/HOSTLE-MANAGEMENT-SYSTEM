const express = require("express");
const db = require("./db");

const router = express.Router();

const VALID_PRIORITY = ["Low", "Medium", "High"];
const VALID_STATUS = ["Pending", "In Progress", "Resolved"];

const MAINT_SELECT = `id, request_code AS requestCode, student_name AS studentName,
  room_number AS roomNumber, title, description, photo,
  priority, status, created_at AS createdAt`;

/* GET /api/maintenance?search=&status=&room= */
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const room = (req.query.room || "").trim();
    const student = (req.query.student || "").trim();

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
    if (student) {
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
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${MAINT_SELECT} FROM maintenance_requests WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Maintenance request not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Maintenance get error:", error);
    res.status(500).json({ success: false, message: "Failed to load maintenance request" });
  }
});

/* POST /api/maintenance  (Student submits a maintenance request with optional photo) */
router.post("/", async (req, res) => {
  try {
    const { studentName, roomNumber, title, description, photo, priority } = req.body;

    if (!studentName || !studentName.trim()) {
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
        studentName.trim(),
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
router.patch("/:id/status", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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
