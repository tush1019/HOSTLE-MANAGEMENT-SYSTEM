const express = require("express");
const db = require("./db");

const router = express.Router();

const VALID_STATUS = ["Pending", "Resolved"];

const ISSUE_SELECT = `id, room_number AS roomNumber, title, photo, description,
  status, created_at AS createdAt`;

/* GET /api/room-issues */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${ISSUE_SELECT} FROM room_issue_photos ORDER BY created_at DESC LIMIT 200`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Room issues list error:", error);
    res.status(500).json({ success: false, message: "Failed to load room issues" });
  }
});

/* POST /api/room-issues */
router.post("/", async (req, res) => {
  try {
    const { roomNumber, title, photo, description, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!photo || !photo.trim()) {
      return res.status(400).json({ success: false, message: "Photo is required" });
    }
    const [result] = await db.query(
      `INSERT INTO room_issue_photos (room_number, title, photo, description, status)
       VALUES (?, ?, ?, ?, ?)`,
      [roomNumber ? roomNumber.trim() : null, title.trim(), photo.trim(), description ? description.trim() : null, VALID_STATUS.includes(status) ? status : "Pending"]
    );
    const [rows] = await db.query(`SELECT ${ISSUE_SELECT} FROM room_issue_photos WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: "Room issue reported", data: rows[0] });
  } catch (error) {
    console.error("Room issue create error:", error);
    res.status(500).json({ success: false, message: "Failed to report room issue" });
  }
});

module.exports = router;