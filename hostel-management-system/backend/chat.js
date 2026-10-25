const express = require("express");
const db = require("./db");

const router = express.Router();

async function getUserById(id) {
  const [rows] = await db.query(`SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows && rows[0] ? rows[0] : null;
}

async function requireUser(req, res) {
  const userId = req.headers["x-user-id"] ? parseInt(req.headers["x-user-id"], 10) : NaN;
  const email = req.headers["x-user-email"] ? String(req.headers["x-user-email"]).trim() : "";
  if (!Number.isFinite(userId)) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  const user = await getUserById(userId);
  if (!user || (email && String(user.email).toLowerCase() !== email.toLowerCase())) {
    res.status(401).json({ success: false, message: "Invalid session" });
    return null;
  }
  return user;
}

function canMessage(sender, recipient) {
  if (!sender || !recipient) return false;
  if (sender.id === recipient.id) return false;
  if (sender.role === "Admin" && recipient.role === "Student") return true;
  if (sender.role === "Student" && recipient.role === "Admin") return true;
  return false;
}

/* GET /api/chat/contacts?search= */
router.get("/contacts", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const search = String(req.query.search || "").trim();
    const like = `%${search}%`;
    let rows;
    if (user.role === "Admin") {
      const [r] = await db.query(
        `SELECT id, name, email, role FROM users WHERE role = 'Student'
         AND (? = '%%' OR name LIKE ? OR email LIKE ?) ORDER BY name ASC LIMIT 50`,
        [search ? like : "%%", like, like]
      );
      rows = r;
    } else {
      const [r] = await db.query(
        `SELECT id, name, email, role FROM users WHERE role = 'Admin'
         AND (? = '%%' OR name LIKE ? OR email LIKE ?) ORDER BY name ASC LIMIT 50`,
        [search ? like : "%%", like, like]
      );
      rows = r;
    }
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Chat contacts error:", error);
    res.status(500).json({ success: false, message: "Failed to load contacts" });
  }
});


/* GET /api/chat/conversations */
router.get("/conversations", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const [rows] = await db.query(
      `SELECT
         CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partnerId,
         MAX(created_at) AS lastAt
       FROM chat_messages
       WHERE sender_id = ? OR recipient_id = ?
       GROUP BY partnerId
       ORDER BY lastAt DESC`,
      [user.id, user.id, user.id]
    );
    const partners = rows || [];
    const result = [];
    for (const p of partners) {
      const partner = await getUserById(p.partnerId);
      if (!partner) continue;
      const [lastRows] = await db.query(
        `SELECT body, created_at, sender_id FROM chat_messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [user.id, p.partnerId, p.partnerId, user.id]
      );
      const last = lastRows && lastRows[0];
      const [unreadRows] = await db.query(
        `SELECT COUNT(*) AS c FROM chat_messages WHERE sender_id = ? AND recipient_id = ? AND is_read = 0`,
        [p.partnerId, user.id]
      );
      const unread = unreadRows && unreadRows[0] ? Number(unreadRows[0].c || 0) : 0;
      result.push({
        partnerId: partner.id,
        partnerName: partner.name,
        partnerEmail: partner.email,
        partnerRole: partner.role,
        lastMessage: last ? last.body : "",
        lastAt: last ? last.created_at : p.lastAt,
        lastSenderId: last ? last.sender_id : null,
        unread,
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Chat conversations error:", error);
    res.status(500).json({ success: false, message: "Failed to load conversations" });
  }
});


/* GET /api/chat/messages?with=partnerId */
router.get("/messages", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const partnerId = parseInt(req.query.with, 10);
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation" });
    }
    const partner = await getUserById(partnerId);
    if (!partner || !canMessage(user, partner)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }
    await db.query(
      `UPDATE chat_messages SET is_read = 1, read_at = CURRENT_TIMESTAMP
       WHERE sender_id = ? AND recipient_id = ? AND is_read = 0`,
      [partnerId, user.id]
    );
    const [rows] = await db.query(
      `SELECT id, sender_id AS senderId, recipient_id AS recipientId, body, is_read AS isRead, created_at AS createdAt
       FROM chat_messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC, id ASC`,
      [user.id, partnerId, partnerId, user.id]
    );
    res.json({ success: true, data: rows || [] });
  } catch (error) {
    console.error("Chat messages error:", error);
    res.status(500).json({ success: false, message: "Failed to load messages" });
  }
});

/* POST /api/chat/messages */
router.post("/messages", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const recipientId = parseInt(req.body && req.body.recipientId, 10);
    const body = String((req.body && req.body.body) || "").trim();
    if (!Number.isFinite(recipientId)) {
      return res.status(400).json({ success: false, message: "Recipient required" });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }
    if (body.length > 2000) {
      return res.status(400).json({ success: false, message: "Message too long" });
    }
    const recipient = await getUserById(recipientId);
    if (!recipient || !canMessage(user, recipient)) {
      return res.status(403).json({ success: false, message: "Not allowed to message this user" });
    }
    const [result] = await db.query(
      `INSERT INTO chat_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)`,
      [user.id, recipientId, body]
    );
    const [rows] = await db.query(
      `SELECT id, sender_id AS senderId, recipient_id AS recipientId, body, is_read AS isRead, created_at AS createdAt
       FROM chat_messages WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, message: "Sent", data: rows[0] });
  } catch (error) {
    console.error("Chat send error:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

/* GET /api/chat/unread-count */
router.get("/unread-count", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM chat_messages WHERE recipient_id = ? AND is_read = 0`,
      [user.id]
    );
    const count = rows && rows[0] ? Number(rows[0].c || 0) : 0;
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error("Chat unread error:", error);
    res.status(500).json({ success: false, message: "Failed to load unread count" });
  }
});

module.exports = router;
