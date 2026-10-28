const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const VALID_STATUS = ["Active", "Maintenance"];

const GYM_SELECT = `id, title, photo, description,
  equipment_type AS equipmentType, status, created_at AS createdAt`;

/* GET /api/gym/photos */
router.get("/photos", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${GYM_SELECT} FROM gym_photos ORDER BY created_at DESC LIMIT 200`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Gym photos list error:", error);
    res.status(500).json({ success: false, message: "Failed to load gym photos" });
  }
});

/* POST /api/gym/photos */
router.post("/photos", requireRole("Admin"), async (req, res) => {
  try {
    const { title, photo, description, equipmentType, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!photo || !photo.trim()) {
      return res.status(400).json({ success: false, message: "Photo is required" });
    }
    const [result] = await db.query(
      `INSERT INTO gym_photos (title, photo, description, equipment_type, status)
       VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), photo.trim(), description ? description.trim() : null, equipmentType ? equipmentType.trim() : null, VALID_STATUS.includes(status) ? status : "Active"]
    );
    const [rows] = await db.query(`SELECT ${GYM_SELECT} FROM gym_photos WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: "Gym photo added", data: rows[0] });
  } catch (error) {
    console.error("Gym photo create error:", error);
    res.status(500).json({ success: false, message: "Failed to add gym photo" });
  }
});

/* DELETE /api/gym/photos/:id */
router.delete("/photos/:id", requireRole("Admin"), async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM gym_photos WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Photo not found" });
    }
    res.json({ success: true, message: "Photo removed" });
  } catch (error) {
    console.error("Gym photo delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove photo" });
  }
});

module.exports = router;
