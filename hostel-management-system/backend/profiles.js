/* ============================================================
   PROFILE — /api/profiles/me
   Account-specific profile data (avatar, cover photo, editable
   details). Stateless auth: a request must know BOTH the user id
   and the account email, verified against the users table.
   Photos are base64 data URLs (same storage pattern as the
   maintenance/mess photo tables) with strict size limits so every
   request body stays under the server's 1 MB JSON limit.
   ============================================================ */
const express = require("express");
const db = require("./db");

const router = express.Router();

const AVATAR_MAX_CHARS = 350000;
const COVER_MAX_CHARS = 850000;
const DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const PROFILE_SELECT = `user_id AS userId, email, phone, bio, address,
  profile_photo AS profilePhoto, cover_photo AS coverPhoto,
  updated_at AS updatedAt`;

function cleanText(value, max) {
  if (value == null) return null;
  const text = String(value).trim().slice(0, max);
  return text ? text : null;
}

async function verifyAccount(userId, email) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE id = ? AND LOWER(email) = LOWER(?) LIMIT 1`,
    [userId, email]
  );
  return rows.length > 0;
}

async function findProfile(userId, email) {
  const [rows] = await db.query(
    `SELECT ${PROFILE_SELECT} FROM user_profiles
     WHERE user_id = ? OR LOWER(email) = LOWER(?) LIMIT 1`,
    [userId, email]
  );
  return rows[0] || null;
}

async function ensureProfile(userId, email) {
  const existing = await findProfile(userId, email);
  if (existing) return existing;
  try {
    await db.query(`INSERT INTO user_profiles (user_id, email) VALUES (?, ?)`, [userId, email]);
  } catch {
    /* Row may already exist (race) — re-read below. */
  }
  return findProfile(userId, email);
}

/* GET /api/profiles/me?userId=&email= */
router.get("/me", async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    const email = String(req.query.email || "").trim();
    if (!Number.isFinite(userId) || !email) {
      return res.status(400).json({ success: false, message: "userId and email are required" });
    }
    if (!(await verifyAccount(userId, email))) {
      return res.status(403).json({ success: false, message: "Session does not match any account" });
    }
    const profile = await findProfile(userId, email);
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("Profile get error:", error);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

/* PUT /api/profiles/me/details — save editable profile details */
router.put("/me/details", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId, 10);
    const email = String(req.body.email || "").trim();
    if (!Number.isFinite(userId) || !email) {
      return res.status(400).json({ success: false, message: "userId and email are required" });
    }
    if (!(await verifyAccount(userId, email))) {
      return res.status(403).json({ success: false, message: "Session does not match any account" });
    }
    const phone = cleanText(req.body.phone, 30);
    const bio = cleanText(req.body.bio, 800);
    const address = cleanText(req.body.address, 200);

    const profile = await ensureProfile(userId, email);
    if (!profile) {
      return res.status(500).json({ success: false, message: "Could not prepare profile" });
    }
    await db.query(
      `UPDATE user_profiles SET phone = ?, bio = ?, address = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [phone, bio, address, profile.userId]
    );
    const updated = await findProfile(userId, email);
    res.json({ success: true, message: "Profile details saved", data: updated });
  } catch (error) {
    console.error("Profile details error:", error);
    res.status(500).json({ success: false, message: "Failed to save profile details" });
  }
});

/* PUT /api/profiles/me/photo  { kind: "avatar" | "cover", photo } */
router.put("/me/photo", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId, 10);
    const email = String(req.body.email || "").trim();
    const kind = String(req.body.kind || "");
    const photo = String(req.body.photo || "");

    if (!Number.isFinite(userId) || !email) {
      return res.status(400).json({ success: false, message: "userId and email are required" });
    }
    if (!["avatar", "cover"].includes(kind)) {
      return res.status(400).json({ success: false, message: "kind must be avatar or cover" });
    }
    if (!DATA_URL_RE.test(photo)) {
      return res.status(400).json({ success: false, message: "Photo must be a valid image data URL" });
    }
    const maxChars = kind === "avatar" ? AVATAR_MAX_CHARS : COVER_MAX_CHARS;
    if (photo.length > maxChars) {
      return res.status(413).json({
        success: false,
        message: kind === "avatar" ? "Profile photo is too large" : "Cover photo is too large",
      });
    }
    if (!(await verifyAccount(userId, email))) {
      return res.status(403).json({ success: false, message: "Session does not match any account" });
    }
    const profile = await ensureProfile(userId, email);
    if (!profile) {
      return res.status(500).json({ success: false, message: "Could not prepare profile" });
    }
    const column = kind === "avatar" ? "profile_photo" : "cover_photo";
    await db.query(
      `UPDATE user_profiles SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [photo, profile.userId]
    );
    const updated = await findProfile(userId, email);
    res.json({
      success: true,
      message: kind === "avatar" ? "Profile photo updated" : "Cover photo updated",
      data: updated,
    });
  } catch (error) {
    console.error("Profile photo error:", error);
    res.status(500).json({ success: false, message: "Failed to save photo" });
  }
});

/* DELETE /api/profiles/me/photo  { kind: "avatar" | "cover" } — remove a saved photo */
router.delete("/me/photo", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId, 10);
    const email = String(req.body.email || "").trim();
    const kind = String(req.body.kind || "");

    if (!Number.isFinite(userId) || !email) {
      return res.status(400).json({ success: false, message: "userId and email are required" });
    }
    if (!["avatar", "cover"].includes(kind)) {
      return res.status(400).json({ success: false, message: "kind must be avatar or cover" });
    }
    if (!(await verifyAccount(userId, email))) {
      return res.status(403).json({ success: false, message: "Session does not match any account" });
    }
    const profile = await ensureProfile(userId, email);
    if (!profile) {
      return res.status(500).json({ success: false, message: "Could not prepare profile" });
    }
    const column = kind === "avatar" ? "profile_photo" : "cover_photo";
    await db.query(
      `UPDATE user_profiles SET ${column} = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [profile.userId]
    );
    const updated = await findProfile(userId, email);
    res.json({ success: true, message: "Photo removed", data: updated });
  } catch (error) {
    console.error("Profile photo delete error:", error);
    res.status(500).json({ success: false, message: "Failed to remove photo" });
  }
});

module.exports = router;