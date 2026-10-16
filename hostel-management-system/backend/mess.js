const express = require("express");
const db = require("./db");

const router = express.Router();

/* GET /api/mess/photos  — mess photos with food quality ratings */
router.get("/photos", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, photo, food_quality AS foodQuality, comment,
              created_at AS createdAt
       FROM mess_photos
       ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Mess photos list error:", error);
    res.status(500).json({ success: false, message: "Failed to load mess photos" });
  }
});

/* POST /api/mess/photos  { title, photo, foodQuality, comment }  (Student uploads mess photo + rates food) */
router.post("/photos", async (req, res) => {
  try {
    const { title, photo, foodQuality, comment } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!photo || !photo.trim()) {
      return res.status(400).json({ success: false, message: "Photo is required" });
    }

    const quality = foodQuality != null ? Number(foodQuality) : null;
    if (quality != null && (quality < 1 || quality > 5)) {
      return res.status(400).json({ success: false, message: "Food quality must be between 1 and 5" });
    }

    const [result] = await db.query(
      `INSERT INTO mess_photos (title, photo, food_quality, comment)
       VALUES (?, ?, ?, ?)`,
      [title.trim(), photo.trim(), quality, comment ? comment.trim() : null]
    );

    const [rows] = await db.query(
      `SELECT id, title, photo, food_quality AS foodQuality, comment, created_at AS createdAt
       FROM mess_photos WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: "Mess photo uploaded", data: rows[0] });
  } catch (error) {
    console.error("Mess photo create error:", error);
    res.status(500).json({ success: false, message: "Failed to upload mess photo" });
  }
});

/* GET /api/mess */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, day, breakfast, lunch, dinner, status FROM mess_menu
       ORDER BY FIELD(day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Mess list error:", error);
    res.status(500).json({ success: false, message: "Failed to load mess menu" });
  }
});

/* PUT /api/mess/:day  { breakfast, lunch, dinner, status } */
router.put("/:day", async (req, res) => {
  try {
    const { breakfast, lunch, dinner, status } = req.body;
    const menuStatus = ["Published", "Pending"].includes(status) ? status : "Published";

    const [result] = await db.query(
      `UPDATE mess_menu SET breakfast = ?, lunch = ?, dinner = ?, status = ?
       WHERE day = ?`,
      [
        breakfast ? breakfast.trim() : null,
        lunch ? lunch.trim() : null,
        dinner ? dinner.trim() : null,
        menuStatus,
        req.params.day,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Day not found" });
    }

    const [rows] = await db.query(`SELECT id, day, breakfast, lunch, dinner, status FROM mess_menu WHERE day = ?`, [
      req.params.day,
    ]);

    res.json({ success: true, message: `${req.params.day} menu updated`, data: rows[0] });
  } catch (error) {
    console.error("Mess update error:", error);
    res.status(500).json({ success: false, message: "Failed to update menu" });
  }
});

/* PATCH /api/mess/:day/status  { status } */
router.patch("/:day/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Published", "Pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const [result] = await db.query(`UPDATE mess_menu SET status = ? WHERE day = ?`, [
      status,
      req.params.day,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Day not found" });
    }

    res.json({ success: true, message: `${req.params.day} marked as ${status}` });
  } catch (error) {
    console.error("Mess status error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

module.exports = router;
