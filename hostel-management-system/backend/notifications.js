const express = require("express");
const db = require("./db");
const { authMiddleware, requireRole } = require("./middleware/auth");

const router = express.Router();
router.use(authMiddleware);

/* GET /api/notifications — current user's notifications */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, user_id AS userId, type, title, message, related_type AS relatedType, related_id AS relatedId, is_read AS isRead, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Notifications list error:", error && error.message ? error.message : error);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
});

/* GET /api/notifications/unread-count */
router.get("/unread-count", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ success: true, data: { count: Number((rows && rows[0] && rows[0].c) || 0) } });
  } catch (error) {
    console.error("Notifications count error:", error && error.message ? error.message : error);
    res.status(500).json({ success: false, message: "Failed to count notifications" });
  }
});

/* PATCH /api/notifications/:id/read */
router.patch("/:id/read", async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!result || !result.affectedRows) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, message: "Marked as read" });
  } catch (error) {
    console.error("Notification read error:", error && error.message ? error.message : error);
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
});

/* PATCH /api/notifications/read-all */
router.patch("/read-all", async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id]);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Notification read-all error:", error && error.message ? error.message : error);
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
});

module.exports = router;
