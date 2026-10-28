const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const VALID_EVENT = ["Entry", "Exit"];

async function ensureTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS hostel_gate_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NULL,
    student_email VARCHAR(150) NULL,
    student_name VARCHAR(120) NOT NULL,
    room_number VARCHAR(20) NULL,
    event_type VARCHAR(10) NOT NULL,
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by VARCHAR(120) NULL,
    recorded_by_role VARCHAR(30) NULL,
    leave_id INT NULL,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // Backward-compatible: add student_email column if table existed without it
  try { await db.query(`ALTER TABLE hostel_gate_logs ADD COLUMN student_email VARCHAR(150) NULL`); } catch (e) { /* column may already exist */ }
}

/* GET /api/hostel-gate-logs?search=&eventType=&date=&student= */
router.get("/", async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = role === "Admin";
    const isStaff = ["Staff", "Warden", "Housekeeping", "Maintenance", "Admin Support"].includes(role);
    const isStudent = role === "Student";
    if (!isAdmin && !isStaff && !isStudent) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const search = String(req.query.search || "").trim();
    const eventType = String(req.query.eventType || "").trim();
    const date = String(req.query.date || "").trim();
    const student = String(req.query.student || "").trim();

    let sql = `SELECT id, student_id AS studentId, student_email AS studentEmail, student_name AS studentName, room_number AS roomNumber,
              event_type AS eventType, event_time AS eventTime, recorded_by AS recordedBy,
              recorded_by_role AS recordedByRole, leave_id AS leaveId, remarks, created_at AS createdAt
              FROM hostel_gate_logs`;
    const params = [];
    const where = [];

    if (isStudent) {
      const ident = await audit.getStudentIdentity(req.user);
      const clauses = [];
      // Stable identity only: student_id or verified email. Never name alone.
      if (ident.id) { clauses.push("student_id = ?"); params.push(ident.id); }
      if (ident.email) { clauses.push("LOWER(student_email) = LOWER(?)"); params.push(ident.email); }
      if (clauses.length === 0) {
        // No reliable identity -> hide all records (safe default)
        where.push("1 = 0");
      } else {
        where.push("(" + clauses.join(" OR ") + ")");
      }
    }
    if (search) {
      where.push("(student_name LIKE ? OR room_number LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }
    if (eventType && VALID_EVENT.includes(eventType)) {
      where.push("event_type = ?");
      params.push(eventType);
    }
    if (date) {
      where.push("DATE(event_time) = ?");
      params.push(date);
    }
    if (isAdmin && student) {
      where.push("student_name = ?");
      params.push(student);
    }

    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY event_time DESC LIMIT 500";

    await ensureTable();
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Gate log list error:", error);
    res.status(500).json({ success: false, message: "Failed to load gate logs" });
  }
});

/* GET /api/hostel-gate-logs/latest/:studentName */
router.get("/latest/:studentName", async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = role === "Admin";
    const isStaff = ["Staff", "Warden", "Housekeeping", "Maintenance", "Admin Support"].includes(role);
    const isStudent = role === "Student";
    if (!isAdmin && !isStaff && !isStudent) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const name = String(req.params.studentName || "").trim();
    if (isStudent) {
      const ident = await audit.getStudentIdentity(req.user);
      const nameMatch = (req.user.name || req.user.email || "").toLowerCase() === name.toLowerCase() || (req.user.email || "").toLowerCase() === name.toLowerCase();
      if (!nameMatch) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      try {
        const [matches] = await db.query("SELECT id, email FROM students WHERE LOWER(name) = LOWER(?)", [name]);
        if (matches && matches.length > 1) {
          const verified = (ident.id && matches.some((m) => m.id === ident.id)) || (ident.email && matches.some((m) => String(m.email || "").toLowerCase() === String(ident.email).toLowerCase()));
          if (!verified) {
            return res.status(403).json({ success: false, message: "Forbidden" });
          }
        }
      } catch (e) {}
    }
    await ensureTable();
    const [rows] = await db.query(
      `SELECT id, student_id AS studentId, student_email AS studentEmail, student_name AS studentName, room_number AS roomNumber,
              event_type AS eventType, event_time AS eventTime, recorded_by AS recordedBy,
              recorded_by_role AS recordedByRole, leave_id AS leaveId, remarks, created_at AS createdAt
       FROM hostel_gate_logs WHERE LOWER(student_name) = LOWER(?) ORDER BY event_time DESC LIMIT 1`,
      [name]
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("Gate log latest error:", error);
    res.status(500).json({ success: false, message: "Failed to load latest gate event" });
  }
});

/* POST /api/hostel-gate-logs — record entry/exit */
router.post("/", async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = role === "Admin";
    const isStaff = ["Staff", "Warden", "Housekeeping", "Maintenance", "Admin Support"].includes(role);
    if (!isAdmin && !isStaff) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { studentName, studentId, studentEmail, roomNumber, eventType, remarks, leaveId } = req.body || {};
    if (!studentName || !String(studentName).trim()) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }
    const ev = VALID_EVENT.includes(eventType) ? eventType : null;
    if (!ev) {
      return res.status(400).json({ success: false, message: "event_type must be Entry or Exit" });
    }
    await ensureTable();
    let resolvedEmail = studentEmail ? String(studentEmail).trim() : null;
    let resolvedStudentId = studentId ? Number(studentId) : null;
    if (!resolvedStudentId && (resolvedEmail || studentName)) {
      resolvedStudentId = await audit.resolveStudentId(String(studentName || "").trim(), resolvedEmail);
    }
    if (!resolvedEmail && studentName) {
      try { const [rows] = await db.query("SELECT email FROM students WHERE LOWER(name) = LOWER(?) LIMIT 1", [String(studentName).trim()]); if (rows && rows.length && rows[0].email) resolvedEmail = String(rows[0].email).trim(); } catch (e) {}
    }
    if (!resolvedEmail && studentId) {
      try { const [rows] = await db.query(`SELECT email FROM students WHERE id = ? LIMIT 1`, [Number(studentId)]); if (rows && rows.length && rows[0].email) resolvedEmail = String(rows[0].email).trim(); } catch (e) {}
    }
    if (!resolvedEmail) {
      try { const [rows] = await db.query(`SELECT email FROM students WHERE LOWER(name) = LOWER(?) LIMIT 1`, [String(studentName).trim()]); if (rows && rows.length && rows[0].email) resolvedEmail = String(rows[0].email).trim(); } catch (e) {}
    }
    const [result] = await db.query(
      `INSERT INTO hostel_gate_logs (student_id, student_email, student_name, room_number, event_type, event_time, recorded_by, recorded_by_role, leave_id, remarks)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [
        resolvedStudentId,
        resolvedEmail,
        String(studentName).trim(),
        roomNumber ? String(roomNumber).trim() : null,
        ev,
        req.user.name || req.user.email,
        role,
        leaveId ? Number(leaveId) : null,
        remarks ? String(remarks).trim() : null,
      ]
    );
    const [rows] = await db.query(
      `SELECT id, student_id AS studentId, student_email AS studentEmail, student_name AS studentName, room_number AS roomNumber,
              event_type AS eventType, event_time AS eventTime, recorded_by AS recordedBy,
              recorded_by_role AS recordedByRole, leave_id AS leaveId, remarks, created_at AS createdAt
       FROM hostel_gate_logs WHERE id = ?`,
      [result.insertId]
    );
    if (rows && rows[0]) { await audit.writeAudit("hostel_gate_log", Number(result.insertId), "CREATE", null, rows[0], req, "Gate event recorded"); }
    res.status(201).json({ success: true, message: "Gate event recorded", data: rows[0] });
  } catch (error) {
    console.error("Gate log create error:", error);
    res.status(500).json({ success: false, message: "Failed to record gate event" });
  }
});

/* DELETE /api/hostel-gate-logs/:id — Admin only (correction) */
router.delete("/:id", requireRole("Admin"), async (req, res) => {
  try {
    await ensureTable();
    const [existing] = await db.query(`SELECT * FROM hostel_gate_logs WHERE id = ?`, [req.params.id]);
    if (existing && existing.length) {
      await audit.writeAudit("hostel_gate_log", Number(req.params.id), "DELETE", existing[0], null, req, "Admin removal");
    }
    const [result] = await db.query(`DELETE FROM hostel_gate_logs WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Log not found" });
    }
    res.json({ success: true, message: "Log removed" });
  } catch (error) {
    console.error("Gate log delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove log" });
  }
});



/* GET /api/hostel-gate-logs/overdue — Admin/Staff: students with approved leave past end_date and no recent Entry */
router.get("/overdue", async (req, res) => {
  try {
    const role = req.user.role;
    const isAdmin = role === "Admin";
    const isStaff = ["Staff", "Warden", "Housekeeping", "Maintenance", "Admin Support"].includes(role);
    if (!isAdmin && !isStaff) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    await ensureTable();

    let leaves = [];
    try {
      const [r] = await db.query("SELECT student_name AS studentName, room_number AS roomNumber, end_date AS leaveEndDate FROM leave_requests WHERE status = 'Approved' AND end_date < CURDATE()");
      leaves = r || [];
    } catch (e) {
      const [r] = await db.query("SELECT student_name AS studentName, room_number AS roomNumber, end_date AS leaveEndDate FROM leave_requests WHERE status = 'Approved' AND end_date < date('now')");
      leaves = r || [];
    }

    const [events] = await db.query("SELECT student_name AS studentName, event_type AS eventType, event_time AS eventTime FROM hostel_gate_logs ORDER BY event_time DESC");
    const latestByStudent = {};
    for (const e of (events || [])) {
      if (!latestByStudent[e.studentName]) latestByStudent[e.studentName] = e;
    }

    const overdue = [];
    for (const lr of leaves) {
      const last = latestByStudent[lr.studentName];
      const leaveEnd = new Date(lr.leaveEndDate).getTime();
      const returned = last && last.eventType === "Entry" && new Date(last.eventTime).getTime() >= leaveEnd;
      if (!returned) {
        overdue.push({ ...lr, lastEvent: last ? last.eventType : null, lastEventTime: last ? last.eventTime : null });
      }
    }
    res.json({ success: true, data: overdue });
  } catch (error) {
    console.error("Overdue error:", error);
    res.status(500).json({ success: false, message: "Failed to load overdue records" });
  }
});

module.exports = router;
