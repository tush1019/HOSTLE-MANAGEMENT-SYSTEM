const express = require("express");
const db = require("./db");
const { getFacultyScope } = require("./facultyScope");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
const adminOnly = [authMiddleware, requireRole("Admin")];
async function resolveStudentName(req) {
  try {
    const [rows] = await db.query(
      `SELECT name FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [req.user.email]
    );
    if (rows && rows.length) return rows[0].name;
  } catch (e) {}
  return req.user.email || req.user.name || "Unknown";
}


const VALID_PRIORITY = ["Low", "Medium", "High"];
const VALID_STATUS = ["Pending", "In Progress", "Resolved"];

/* GET /api/complaints?search= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const isAdmin = req.user.role === "Admin";
    const isFaculty = req.user.role === "Faculty";
    const isPrivileged = isAdmin || isFaculty;

    let sql = `SELECT id, complaint_code AS complaintCode, student_name AS student,
                 room_number AS room, subject, description,
                 DATE_FORMAT(complaint_date, '%d %b %Y') AS date,
                 priority, status, created_at AS createdAt
               FROM complaints`;
    const params = [];
    const where = [];

    if (isFaculty) {
      const scope = await getFacultyScope(req.user.email);
      if (scope.rooms.length === 0) {
        return res.json({ success: true, data: [], summary: { total: 0, pending: 0, inProgress: 0, resolved: 0 } });
      }
      const placeholders = scope.rooms.map(() => "?").join(",");
      where.push("TRIM(room_number) IN (" + placeholders + ")");
      params.push(...scope.rooms);
    } else if (!isAdmin) {
      const name = await resolveStudentName(req);
      where.push("student_name = ?");
      params.push(name);
    }
    if (search) {
      where.push(`(student_name LIKE ? OR complaint_code LIKE ? OR subject LIKE ? OR room_number LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const [rows] = await db.query(sql, params);

    let summary = {};
    if (isPrivileged) {
      const [summaryRows] = await db.query(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status = 'Pending'), 0) AS pending,
               COALESCE(SUM(status = 'In Progress'), 0) AS inProgress,
               COALESCE(SUM(status = 'Resolved'), 0) AS resolved
        FROM complaints
      `);
      summary = summaryRows[0] || {};
    }

    res.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error("Complaints list error:", error);
    res.status(500).json({ success: false, message: "Failed to load complaints" });
  }
});

/* POST /api/complaints */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { student, room, subject, description, priority, status } = req.body;

    if (req.user.role === "Faculty") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const isAdmin = req.user.role === "Admin";
    const studentName = isAdmin
      ? (student && student.trim() ? student.trim() : (await resolveStudentName(req)))
      : await resolveStudentName(req);

    if (!studentName) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required" });
    }

    const prio = VALID_PRIORITY.includes(priority) ? priority : "Medium";
    const compStatus = VALID_STATUS.includes(status) ? status : "Pending";

    const [result] = await db.query(
      `INSERT INTO complaints (student_name, room_number, subject, description, complaint_date, priority, status)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`,
      [
        studentName,
        room ? room.trim() : null,
        subject.trim(),
        description ? description.trim() : null,
        prio,
        compStatus,
      ]
    );

    const code = "CMP" + String(result.insertId).padStart(3, "0");
    await db.query(`UPDATE complaints SET complaint_code = ? WHERE id = ?`, [code, result.insertId]);

    const [rows] = await db.query(
      `SELECT id, complaint_code AS complaintCode, student_name AS student,
              room_number AS room, subject, description,
              DATE_FORMAT(complaint_date, '%d %b %Y') AS date,
              priority, status FROM complaints WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Complaint submitted", data: rows[0] });
  } catch (error) {
    console.error("Complaint create error:", error);
    res.status(500).json({ success: false, message: "Failed to submit complaint" });
  }
});

/* PATCH /api/complaints/:id/status  { status } */
router.patch("/:id/status", adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const [result] = await db.query(`UPDATE complaints SET status = ? WHERE id = ?`, [
      status,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, message: `Complaint marked as ${status}` });
  } catch (error) {
    console.error("Complaint status error:", error);
    res.status(500).json({ success: false, message: "Failed to update complaint" });
  }
});

/* PUT /api/complaints/:id  (full update) */
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { student, room, subject, description, priority, status } = req.body;

    if (!student || !student.trim()) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required" });
    }

    const prio = VALID_PRIORITY.includes(priority) ? priority : "Medium";
    const compStatus = VALID_STATUS.includes(status) ? status : "Pending";

    const [result] = await db.query(
      `UPDATE complaints
       SET student_name = ?, room_number = ?, subject = ?, description = ?,
           priority = ?, status = ?
       WHERE id = ?`,
      [
        student.trim(),
        room ? room.trim() : null,
        subject.trim(),
        description ? description.trim() : null,
        prio,
        compStatus,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, message: "Complaint updated" });
  } catch (error) {
    console.error("Complaint update error:", error);
    res.status(500).json({ success: false, message: "Failed to update complaint" });
  }
});


/* DELETE /api/complaints/:id */
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM complaints WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({ success: true, message: "Complaint removed" });
  } catch (error) {
    console.error("Complaint delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove complaint" });
  }
});

module.exports = router;
