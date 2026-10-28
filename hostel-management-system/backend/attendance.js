const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole("Faculty", "Admin"));

function facultyId(req) { return Number(req.user.id); }
function isAdmin(req) { return req.user.role === "Admin"; }
function code(prefix) { return prefix + Date.now().toString(36).toUpperCase(); }

router.get("/sessions", async (req, res) => {
  try {
    const { date, subject, class_name } = req.query;
    const params = [];
    let sql = `SELECT id, session_code AS sessionCode, faculty_user_id AS facultyUserId,
               subject, class_name AS className, session_date AS sessionDate,
               start_time AS startTime, end_time AS endTime, room_number AS room,
               status, created_at AS createdAt
               FROM attendance_sessions WHERE 1=1`;
    if (!isAdmin(req)) { sql += " AND faculty_user_id = ?"; params.push(facultyId(req)); }
    if (date) { sql += " AND session_date = ?"; params.push(date); }
    if (subject) { sql += " AND subject = ?"; params.push(subject); }
    if (class_name) { sql += " AND class_name = ?"; params.push(class_name); }
    sql += " ORDER BY session_date DESC, id DESC LIMIT 200";
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Attendance sessions list error:", error);
    res.status(500).json({ success: false, message: "Failed to load sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { subject, className, class_name, sessionDate, date, startTime, start_time, endTime, end_time, room } = req.body;
    const cls = class_name || className;
    const sdate = date || sessionDate;
    if (!subject || !subject.trim()) return res.status(400).json({ success: false, message: "Subject is required" });
    if (!cls || !cls.trim()) return res.status(400).json({ success: false, message: "Class is required" });
    if (!sdate) return res.status(400).json({ success: false, message: "Date is required" });

    const fid = facultyId(req);
    const [existing] = await db.query(
      `SELECT id FROM attendance_sessions WHERE faculty_user_id = ? AND subject = ? AND class_name = ? AND session_date = ? AND (start_time <=> ?)`,
      [fid, subject.trim(), cls.trim(), sdate, start_time || startTime || null]
    );
    if (existing && existing.length) {
      return res.status(409).json({ success: false, message: "Attendance session already exists for this class/date/time" });
    }

    const [result] = await db.query(
      `INSERT INTO attendance_sessions (session_code, faculty_user_id, subject, class_name, session_date, start_time, end_time, room_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open')`,
      [code("SES"), fid, subject.trim(), cls.trim(), sdate, start_time || startTime || null, end_time || endTime || null, room ? room.trim() : null]
    );
    const [rows] = await db.query(`SELECT id, session_code AS sessionCode, subject, class_name AS className, session_date AS sessionDate, start_time AS startTime, end_time AS endTime, room_number AS room, status FROM attendance_sessions WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: "Session created", data: rows[0] });
  } catch (error) {
    console.error("Attendance session create error:", error);
    res.status(500).json({ success: false, message: "Failed to create session" });
  }
});
/* GET session */
router.get("/sessions/:id", async (req, res) => {
  try {
    const params = [req.params.id];
    let sql = `SELECT id, session_code AS sessionCode, faculty_user_id AS facultyUserId, subject, class_name AS className, session_date AS sessionDate, start_time AS startTime, end_time AS endTime, room_number AS room, status, created_at AS createdAt FROM attendance_sessions WHERE id = ?`;
    if (!isAdmin(req)) { sql += " AND faculty_user_id = ?"; params.push(facultyId(req)); }
    const [rows] = await db.query(sql, params);
    if (!rows || !rows.length) return res.status(404).json({ success: false, message: "Session not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load session" });
  }
});

router.get("/sessions/:id/records", async (req, res) => {
  try {
    const params = [req.params.id];
    let sql = `SELECT id FROM attendance_sessions WHERE id = ?`;
    if (!isAdmin(req)) { sql += " AND faculty_user_id = ?"; params.push(facultyId(req)); }
    const [owner] = await db.query(sql, params);
    if (!owner || !owner.length) return res.status(404).json({ success: false, message: "Session not found" });
    const [rows] = await db.query(
      `SELECT ar.id, ar.session_id AS sessionId, ar.student_id AS studentId, ar.status, ar.marked_at AS markedAt,
              s.name AS studentName, s.student_code AS studentCode, s.room_number AS room
       FROM attendance_records ar JOIN students s ON s.id = ar.student_id
       WHERE ar.session_id = ? ORDER BY s.name`, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load records" });
  }
});

router.put("/sessions/:id/records", async (req, res) => {
  try {
    const params = [req.params.id];
    let sql = `SELECT id FROM attendance_sessions WHERE id = ?`;
    if (!isAdmin(req)) { sql += " AND faculty_user_id = ?"; params.push(facultyId(req)); }
    const [owner] = await db.query(sql, params);
    if (!owner || !owner.length) return res.status(404).json({ success: false, message: "Session not found" });
    const records = Array.isArray(req.body.records) ? req.body.records : [];
    if (!records.length) return res.status(400).json({ success: false, message: "No records provided" });
    for (const r of records) {
      const sid = Number(r.student_id || r.studentId);
      const status = ["Present","Absent","Late"].includes(r.status) ? r.status : "Present";
      if (!Number.isFinite(sid)) continue;
      const [existing] = await db.query(`SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?`, [req.params.id, sid]);
      if (existing && existing.length) {
        await db.query(`UPDATE attendance_records SET status = ?, marked_at = CURRENT_TIMESTAMP WHERE session_id = ? AND student_id = ?`, [status, req.params.id, sid]);
      } else {
        await db.query(`INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, ?)`, [req.params.id, sid, status]);
      }
    }
    res.json({ success: true, message: "Attendance saved" });
  } catch (error) {
    console.error("Attendance save error:", error);
    res.status(500).json({ success: false, message: "Failed to save attendance" });
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Draft","Open","Closed"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
    const params = [status, req.params.id];
    let sql = `UPDATE attendance_sessions SET status = ? WHERE id = ?`;
    if (!isAdmin(req)) { sql += " AND faculty_user_id = ?"; params.push(facultyId(req)); }
    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Session not found" });
    res.json({ success: true, message: "Session updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update session" });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const { month, class_name } = req.query;
    const params = [];
    let sql = `SELECT s.id AS studentId, s.name AS studentName, s.student_code AS studentCode,
               COUNT(ar.id) AS total,
               SUM(ar.status = 'Present') AS present,
               SUM(ar.status = 'Late') AS late,
               SUM(ar.status = 'Absent') AS absent
               FROM students s
               LEFT JOIN attendance_records ar ON ar.student_id = s.id
               LEFT JOIN attendance_sessions sess ON sess.id = ar.session_id
               WHERE 1=1`;
    if (!isAdmin(req)) {
      sql += " AND (sess.faculty_user_id = ? OR sess.id IS NULL)";
      params.push(facultyId(req));
    }
    if (month) { sql += " AND DATE_FORMAT(sess.session_date, '%Y-%m') = ?"; params.push(month); }
    if (class_name) { sql += " AND sess.class_name = ?"; params.push(class_name); }
    sql += " GROUP BY s.id, s.name, s.student_code ORDER BY s.name LIMIT 500";
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows.map(r => ({ ...r, total: Number(r.total||0), present: Number(r.present||0), late: Number(r.late||0), absent: Number(r.absent||0) })) });
  } catch (error) {
    console.error("Attendance summary error:", error);
    res.status(500).json({ success: false, message: "Failed to load summary" });
  }
});

module.exports = router;

