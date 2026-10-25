const express = require("express");
const db = require("./db");

const router = express.Router();

const ALLOWED_STATUSES = ["Active", "Inactive", "On Leave"];
const ALLOWED_ROLES = ["Staff", "Faculty", "Warden", "Maintenance", "Housekeeping", "Admin Support"];

function isAdminUser(userId, email) {
  return db.query(
    `SELECT id FROM users WHERE id = ? AND LOWER(email) = LOWER(?) AND role = 'Admin' LIMIT 1`,
    [userId, email]
  ).then(([rows]) => rows.length > 0);
}

function getUserIdEmail(req) {
  const userId = req.headers["x-user-id"]
    ? parseInt(req.headers["x-user-id"], 10)
    : req.body && req.body.userId ? parseInt(req.body.userId, 10) : NaN;
  const email = req.headers["x-user-email"]
    ? String(req.headers["x-user-email"]).trim()
    : String((req.body && req.body.email) || "").trim();
  return { userId, email };
}

async function requireAdmin(req, res) {
  const { userId, email } = getUserIdEmail(req);
  if (!Number.isFinite(userId) || !(await isAdminUser(userId, email))) {
    res.status(403).json({ success: false, message: "Administrator access required" });
    return null;
  }
  return { userId, email };
}

/* GET /api/staff?search=&status=&department= */
router.get("/", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const department = String(req.query.department || "").trim();

    let sql = `SELECT id, staff_code AS staffCode, name, email, phone,
                  department, designation, role, responsibilities, status,
                  created_at AS createdAt
                FROM staff`;
    const params = [];
    const clauses = [];
    if (search) {
      clauses.push(`(name LIKE ? OR staff_code LIKE ? OR email LIKE ? OR department LIKE ? OR designation LIKE ?)`);
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (status) {
      clauses.push(`status = ?`);
      params.push(status);
    }
    if (department) {
      clauses.push(`department = ?`);
      params.push(department);
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += ` ORDER BY created_at DESC, id DESC LIMIT 500`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Staff list error:", error);
    res.status(500).json({ success: false, message: "Failed to load staff" });
  }
});
/* POST /api/staff */
router.post("/", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const {
      staffCode, name, email, phone, department, designation, role,
      responsibilities, status,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Staff name is required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }
    const staffStatus = ALLOWED_STATUSES.includes(status) ? status : "Active";
    const staffRole = ALLOWED_ROLES.includes(role) ? role : "Staff";

    let code = staffCode ? String(staffCode).trim() : null;
    if (code) {
      const [existing] = await db.query(`SELECT id FROM staff WHERE staff_code = ? LIMIT 1`, [code]);
      if (existing && existing.length) {
        return res.status(409).json({ success: false, message: "Staff ID already exists" });
      }
    }

    const [result] = await db.query(
      `INSERT INTO staff (staff_code, name, email, phone, department, designation, role, responsibilities, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        String(name).trim(),
        email ? String(email).trim() : null,
        phone ? String(phone).trim() : null,
        department ? String(department).trim() : null,
        designation ? String(designation).trim() : null,
        staffRole,
        responsibilities ? String(responsibilities).trim() : null,
        staffStatus,
      ]
    );

    if (!code) {
      code = "STF" + String(result.insertId).padStart(3, "0");
      await db.query(`UPDATE staff SET staff_code = ? WHERE id = ?`, [code, result.insertId]);
    }

    const [rows] = await db.query(
      `SELECT id, staff_code AS staffCode, name, email, phone,
              department, designation, role, responsibilities, status,
              created_at AS createdAt
       FROM staff WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Staff member added", data: rows[0] });
  } catch (error) {
    console.error("Staff create error:", error);
    res.status(500).json({ success: false, message: "Failed to add staff member" });
  }
});

/* PUT /api/staff/:id */
router.put("/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff id" });
    }
    const {
      staffCode, name, email, phone, department, designation, role,
      responsibilities, status,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Staff name is required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }
    const staffStatus = ALLOWED_STATUSES.includes(status) ? status : "Active";
    const staffRole = ALLOWED_ROLES.includes(role) ? role : "Staff";

    if (staffCode) {
      const code = String(staffCode).trim();
      const [existing] = await db.query(
        `SELECT id FROM staff WHERE staff_code = ? AND id <> ? LIMIT 1`, [code, id]
      );
      if (existing && existing.length) {
        return res.status(409).json({ success: false, message: "Staff ID already exists" });
      }
    }

    const [result] = await db.query(
      `UPDATE staff
       SET staff_code = ?, name = ?, email = ?, phone = ?, department = ?, designation = ?,
           role = ?, responsibilities = ?, status = ?
       WHERE id = ?`,
      [
        staffCode ? String(staffCode).trim() : null,
        String(name).trim(),
        email ? String(email).trim() : null,
        phone ? String(phone).trim() : null,
        department ? String(department).trim() : null,
        designation ? String(designation).trim() : null,
        staffRole,
        responsibilities ? String(responsibilities).trim() : null,
        staffStatus,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }

    const [rows] = await db.query(
      `SELECT id, staff_code AS staffCode, name, email, phone,
              department, designation, role, responsibilities, status,
              created_at AS createdAt
       FROM staff WHERE id = ?`,
      [id]
    );
    res.json({ success: true, message: "Staff member updated", data: rows[0] });
  } catch (error) {
    console.error("Staff update error:", error);
    res.status(500).json({ success: false, message: "Failed to update staff member" });
  }
});

/* DELETE /api/staff/:id */
router.delete("/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff id" });
    }
    const [result] = await db.query(`DELETE FROM staff WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    res.json({ success: true, message: "Staff member removed" });
  } catch (error) {
    console.error("Staff delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove staff member" });
  }
});

module.exports = router;

