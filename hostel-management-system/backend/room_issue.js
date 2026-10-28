const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

const VALID_STATUS = ["Pending", "Resolved"];

const ISSUE_SELECT = `id, room_number AS roomNumber, title, photo, description,
  status, created_at AS createdAt`;

async function resolveStudentRoom(req) {
  try {
    const [rows] = await db.query(
      `SELECT room_number FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [req.user.email]
    );
    if (rows && rows.length && rows[0].room_number) return rows[0].room_number;
  } catch (e) {}
  return null;
}

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

router.post("/", async (req, res) => {
  try {
    const { roomNumber, title, photo, description, status } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!photo || !photo.trim()) {
      return res.status(400).json({ success: false, message: "Photo is required" });
    }

    const isAdmin = req.user.role === "Admin";
    let resolvedRoom = roomNumber ? roomNumber.trim() : null;
    if (!isAdmin) {
      const allocated = await resolveStudentRoom(req);
      if (!allocated) {
        return res.status(400).json({ success: false, message: "No room allocated to your account" });
      }
      if (resolvedRoom && resolvedRoom !== allocated) {
        return res.status(403).json({ success: false, message: "You can only report issues for your allocated room" });
      }
      resolvedRoom = allocated;
    }

    const [result] = await db.query(
      `INSERT INTO room_issue_photos (room_number, title, photo, description, status)
       VALUES (?, ?, ?, ?, ?)`,
      [resolvedRoom, title.trim(), photo.trim(), description ? description.trim() : null, VALID_STATUS.includes(status) ? status : "Pending"]
    );
    const [rows] = await db.query(`SELECT ${ISSUE_SELECT} FROM room_issue_photos WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: "Room issue reported", data: rows[0] });
  } catch (error) {
    console.error("Room issue create error:", error);
    res.status(500).json({ success: false, message: "Failed to report room issue" });
  }
});

/* DELETE /api/room-issues/:id */
router.delete("/:id", requireRole("Admin"), async (req, res) => {
  try {
    const [result] = await db.query(`DELETE FROM room_issue_photos WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }
    res.json({ success: true, message: "Issue removed" });
  } catch (error) {
    console.error("Room issue delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove issue" });
  }
});

module.exports = router;
