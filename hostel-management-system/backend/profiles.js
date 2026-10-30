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
const { authMiddleware } = require("./middleware/auth");

const router = express.Router();

const AVATAR_MAX_CHARS = 350000;
const COVER_MAX_CHARS = 850000;
const DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const PROFILE_SELECT = `user_id AS userId, email, phone, mobile, bio, address,
  profile_photo AS profilePhoto, cover_photo AS coverPhoto,
  parent_guardian_name AS parentGuardianName, parent_guardian_mobile AS parentGuardianMobile,
  course, year_semester AS yearSemester, hostel, block, room_number AS roomNumber,
  department, designation, emergency_contact AS emergencyContact,
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
     WHERE user_id = ? AND LOWER(email) = LOWER(?) LIMIT 1`,
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

/* GET /api/profiles/me */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const profile = await findProfile(userId, email);
    if (!profile) {
      await ensureProfile(userId, email);
    }
    const updated = await findProfile(userId, email);
    // Attach server-generated role IDs without exposing secrets.
    let extra = {};
    try {
      const [urows] = await db.query(`SELECT admin_id, faculty_id, role FROM users WHERE id = ? LIMIT 1`, [userId]);
      if (urows && urows.length) {
        extra.role = urows[0].role;
        extra.adminId = urows[0].admin_id;
        extra.facultyId = urows[0].faculty_id;
      }
      const [srows] = await db.query(`SELECT student_code FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1`, [email]);
      if (srows && srows.length) extra.studentCode = srows[0].student_code;
    } catch { /* ignore */ }
    res.json({ success: true, data: { ...(updated || {}), ...extra } });
  } catch (error) {
    console.error("Profile get error:", error);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

/* PUT /api/profiles/me/details — save editable profile details */
router.put("/me/details", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const phone = cleanText(req.body.phone, 30);
    const mobile = cleanText(req.body.mobile, 30);
    const bio = cleanText(req.body.bio, 800);
    const address = cleanText(req.body.address, 200);
    const parentGuardianName = cleanText(req.body.parentGuardianName, 100);
    const parentGuardianMobile = cleanText(req.body.parentGuardianMobile, 30);
    const course = cleanText(req.body.course, 100);
    const yearSemester = cleanText(req.body.yearSemester, 30);
    const emergencyContact = cleanText(req.body.emergencyContact, 30);
    const role = req.user.role;
    const hostel = role === "Student" ? null : cleanText(req.body.hostel, 50);
    const block = role === "Student" ? null : cleanText(req.body.block, 50);
    const roomNumber = role === "Student" ? null : cleanText(req.body.roomNumber, 20);
    const department = cleanText(req.body.department, 100);
    const designation = cleanText(req.body.designation, 100);

    const profile = await ensureProfile(userId, email);
    if (!profile) {
      return res.status(500).json({ success: false, message: "Could not prepare profile" });
    }
    await db.query(
      `UPDATE user_profiles SET phone = ?, mobile = ?, bio = ?, address = ?,
        parent_guardian_name = ?, parent_guardian_mobile = ?, course = ?, year_semester = ?,
        emergency_contact = ?, hostel = COALESCE(?, hostel), block = COALESCE(?, block), room_number = COALESCE(?, room_number),
        department = ?, designation = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [phone, mobile, bio, address, parentGuardianName, parentGuardianMobile, course, yearSemester,
       emergencyContact, hostel, block, roomNumber, department, designation, profile.userId]
    );
    const updated = await findProfile(userId, email);
    res.json({ success: true, message: "Profile details saved", data: updated });
  } catch (error) {
    console.error("Profile details error:", error);
    res.status(500).json({ success: false, message: "Failed to save profile details" });
  }
});

/* PUT /api/profiles/me/photo  { kind: "avatar" | "cover", photo } */
router.put("/me/photo", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const kind = String(req.body.kind || "");
    const photo = String(req.body.photo || "");

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
router.delete("/me/photo", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const kind = String(req.body.kind || "");

    if (!["avatar", "cover"].includes(kind)) {
      return res.status(400).json({ success: false, message: "kind must be avatar or cover" });
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