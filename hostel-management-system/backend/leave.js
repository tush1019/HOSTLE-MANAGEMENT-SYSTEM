const express = require("express");
const db = require("./db");
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

const VALID_STATUS = ["Pending", "Approved", "Rejected"];

const LEAVE_SELECT = `id, leave_code AS leaveCode, student_name AS studentName,
  room_number AS roomNumber, reason, start_date AS startDate, end_date AS endDate,
  status, admin_remarks AS adminRemarks, created_at AS createdAt`;

/* GET /api/leave?search=&status=&student= */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const student = (req.query.student || "").trim();
    const isAdmin = req.user.role === "Admin";

    let sql = `SELECT ${LEAVE_SELECT} FROM leave_requests`;
    const params = [];
    const where = [];

    if (!isAdmin) {
      const name = await resolveStudentName(req);
      where.push("student_name = ?");
      params.push(name);
    } else if (student) {
      where.push("student_name = ?");
      params.push(student);
    }
    if (search) {
      where.push(`(student_name LIKE ? OR reason LIKE ? OR leave_code LIKE ? OR room_number LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (status && VALID_STATUS.includes(status)) {
      where.push("status = ?");
      params.push(status);
    }
    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Leave list error:", error);
    res.status(500).json({ success: false, message: "Failed to load leave requests" });
  }
});

/* GET /api/leave/:id */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${LEAVE_SELECT} FROM leave_requests WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }
    const record = rows[0];
    if (req.user.role !== "Admin") {
      const name = await resolveStudentName(req);
      if (record.studentName !== name) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }
    res.json({ success: true, data: record });
  } catch (error) {
    console.error("Leave get error:", error);
    res.status(500).json({ success: false, message: "Failed to load leave request" });
  }
});

/* POST /api/leave  (Student applies for leave) */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { studentName, roomNumber, reason, startDate, endDate } = req.body;
    const isAdmin = req.user.role === "Admin";
    const resolvedName = isAdmin && studentName && studentName.trim()
      ? studentName.trim()
      : await resolveStudentName(req);

    if (!resolvedName) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start and end dates are required" });
    }

    const [result] = await db.query(
      `INSERT INTO leave_requests (student_name, room_number, reason, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [resolvedName, roomNumber ? roomNumber.trim() : null, reason.trim(), startDate, endDate]
    );

    const code = "LV" + String(result.insertId).padStart(3, "0");
    await db.query(`UPDATE leave_requests SET leave_code = ? WHERE id = ?`, [code, result.insertId]);

    const [rows] = await db.query(
      `SELECT ${LEAVE_SELECT} FROM leave_requests WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Leave application submitted", data: rows[0] });
  } catch (error) {
    console.error("Leave create error:", error);
    res.status(500).json({ success: false, message: "Failed to submit leave application" });
  }
});

/* PATCH /api/leave/:id/status  { status, adminRemarks }  (Admin approves/rejects) */
router.patch("/:id/status", adminOnly, async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const [result] = await db.query(
      `UPDATE leave_requests SET status = ?, admin_remarks = ? WHERE id = ?`,
      [status, adminRemarks ? adminRemarks.trim() : null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    res.json({ success: true, message: `Leave request ${status.toLowerCase()}` });
  } catch (error) {
    console.error("Leave status error:", error);
    res.status(500).json({ success: false, message: "Failed to update leave request" });
  }
});

/* DELETE /api/leave/:id  (Admin) */
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM leave_requests WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    res.json({ success: true, message: "Leave request removed" });
  } catch (error) {
    console.error("Leave delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove leave request" });
  }
});

module.exports = router;
