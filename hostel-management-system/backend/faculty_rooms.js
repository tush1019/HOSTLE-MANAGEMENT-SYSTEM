const express = require("express");
const db = require("./db");

const router = express.Router();

async function ensureTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS faculty_room_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_name VARCHAR(120) NOT NULL,
    faculty_email VARCHAR(120),
    room_id INT,
    room_number VARCHAR(40),
    wing VARCHAR(20),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

/* GET /api/faculty-rooms */
router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.query(`SELECT * FROM faculty_room_assignments ORDER BY assigned_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Faculty rooms list error:", error);
    res.status(500).json({ success: false, message: "Failed to load assignments" });
  }
});

/* POST /api/faculty-rooms */
router.post("/", async (req, res) => {
  try {
    await ensureTable();
    const { facultyName, facultyEmail, roomId, roomNumber, wing } = req.body;
    if (!facultyName || !facultyName.trim()) {
      return res.status(400).json({ success: false, message: "Faculty name required" });
    }
    const [result] = await db.query(
      `INSERT INTO faculty_room_assignments (faculty_name, faculty_email, room_id, room_number, wing) VALUES (?, ?, ?, ?, ?)`,
      [facultyName.trim(), facultyEmail || null, roomId || null, roomNumber || null, wing || null]
    );
    res.json({ success: true, message: "Assigned", data: { id: result.insertId } });
  } catch (error) {
    console.error("Faculty room assign error:", error);
    res.status(500).json({ success: false, message: "Failed to assign" });
  }
});

/* DELETE /api/faculty-rooms/:id */
router.delete("/:id", async (req, res) => {
  try {
    await ensureTable();
    const [result] = await db.query(`DELETE FROM faculty_room_assignments WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Removed" });
  } catch (error) {
    console.error("Faculty room delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove" });
  }
});

module.exports = router;