const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();

const adminOnly = [authMiddleware, requireRole("Admin")];
const readAccess = [authMiddleware, requireRole("Admin", "Faculty", "Student")];

/* GET /api/students?search= */
router.get("/", readAccess, async (req, res) => {
  try {
    const isAdmin = req.user.role === "Admin";
    const isFaculty = req.user.role === "Faculty";
    const isStudent = req.user.role === "Student";
    const search = isStudent ? "" : (req.query.search || "").trim();
    let email = (req.query.email || "").trim();
    if (isStudent) {
      // Students may only look up their own record.
      const [urows] = await db.query(`SELECT email FROM users WHERE id = ? LIMIT 1`, [req.user.id]);
      email = (urows && urows.length && urows[0].email) ? urows[0].email : req.user.email;
    }

    let sql = `SELECT id, student_code AS studentCode, name, email, phone,
                 course, room_number AS room, status, created_at AS createdAt
               FROM students`;
    const params = [];

    if (search) {
      sql += ` WHERE name LIKE ? OR student_code LIKE ? OR room_number LIKE ? OR course LIKE ?`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (email) {
      sql += search ? ` AND LOWER(email) = LOWER(?)` : ` WHERE LOWER(email) = LOWER(?)`;
      params.push(email);
    }

    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const [rows] = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Students list error:", error);
    res.status(500).json({ success: false, message: "Failed to load students" });
  }
});

/* POST /api/students */
router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, email, phone, course, room, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }

    const studentStatus = ["Active", "Pending", "Inactive"].includes(status) ? status : "Active";

    const [result] = await db.query(
      `INSERT INTO students (name, email, phone, course, room_number, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        course ? course.trim() : null,
        room ? room.trim() : null,
        studentStatus,
      ]
    );

    const code = "STU" + String(result.insertId).padStart(3, "0");
    await db.query(`UPDATE students SET student_code = ? WHERE id = ?`, [code, result.insertId]);

    const [rows] = await db.query(
      `SELECT id, student_code AS studentCode, name, email, phone,
              course, room_number AS room, status, created_at AS createdAt
       FROM students WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Student added", data: rows[0] });
  } catch (error) {
    console.error("Student create error:", error);
    res.status(500).json({ success: false, message: "Failed to add student" });
  }
});

/* PUT /api/students/:id */
router.put("/:id", adminOnly, async (req, res) => {
  try {
    const { name, email, phone, course, room, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Student name is required" });
    }

    const studentStatus = ["Active", "Pending", "Inactive"].includes(status) ? status : "Active";

    const [result] = await db.query(
      `UPDATE students
       SET name = ?, email = ?, phone = ?, course = ?, room_number = ?, status = ?
       WHERE id = ?`,
      [
        name.trim(),
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        course ? course.trim() : null,
        room ? room.trim() : null,
        studentStatus,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const [rows] = await db.query(
      `SELECT id, student_code AS studentCode, name, email, phone,
              course, room_number AS room, status, created_at AS createdAt
       FROM students WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true, message: "Student updated", data: rows[0] });
  } catch (error) {
    console.error("Student update error:", error);
    res.status(500).json({ success: false, message: "Failed to update student" });
  }
});

/* DELETE /api/students/:id */
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM students WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, message: "Student removed" });
  } catch (error) {
    console.error("Student delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove student" });
  }
});

module.exports = router;
