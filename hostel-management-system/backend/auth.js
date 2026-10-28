const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { sendOtpEmail, isEmailConfigured } = require("./mailer");
const rateLimit = require("express-rate-limit");
const { signToken, authMiddleware, requireRole } = require("./middleware/auth");

/* Admin passkey — env override or built-in default (6 digits).
   NEVER change this default in source; set ADMIN_PASSKEY in .env instead. */
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || "484951";
const FACULTY_SIGNUP_KEY = process.env.FACULTY_SIGNUP_KEY;

// Demo OTP is only for local development/demo. It must never be enabled in
// production, where OTPs must only be delivered by the configured provider.
function isDemoOtpEnabled() {
  return process.env.DEMO_OTP_ENABLED === "true" && process.env.NODE_ENV !== "production";
}

const router = express.Router();

/* Stricter rate limit for auth endpoints: 20 requests / 15 min per IP. */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: "Too many attempts. Please try again later." },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function toCleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* Generic failure message — never reveals whether the email exists. */
const GENERIC_AUTH_FAIL = { success: false, message: "Invalid email or password" };

async function hashValue(value) {
  return await bcrypt.hash(String(value), 10);
}

async function compareValue(plain, hash) {
  try {
    return await bcrypt.compare(String(plain), hash);
  } catch {
    return false;
  }
}

async function comparePasswordOrDummy(password, user) {
  if (user) return await bcrypt.compare(password, user.password);
  return await bcrypt.compare(password, "$2a$12$dummyhashforusernotfound........................");
}

/* ============================================================
   LOGIN — POST /api/auth/login  { email, password }
   Verifies email + bcrypt password hash from the database.
   Only returns id/name/email/role/admin_id (never the password).
   ============================================================ */
router.post("/login", authRateLimit, async (req, res) => {
  try {
    const { email, password, passkey } = req.body;

    if (!email || !password) {
      return res.status(401).json(GENERIC_AUTH_FAIL);
    }

    const cleanEmail = toCleanEmail(email);

    const [rows] = await db.query(
      `SELECT id, name, email, password, role, admin_id
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanEmail]
    );

    const user = rows.length ? rows[0] : null;

    const passwordMatch = await comparePasswordOrDummy(password, user);

    if (!user || !passwordMatch) {
      return res.status(401).json(GENERIC_AUTH_FAIL);
    }

    if (user.role === "Admin" && String(passkey || "").trim() !== ADMIN_PASSKEY) {
      return res.status(401).json(GENERIC_AUTH_FAIL);
    }

    res.json({
      success: true,
      message: "Login successful",
      token: signToken({ id: user.id, email: user.email, role: user.role, admin_id: user.admin_id || null }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        admin_id: user.admin_id || null,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

/* ============================================================
   LOGOUT — POST /api/auth/logout
   Stateless auth: the client discards its session. This endpoint
   exists so the frontend has a single place to end a session and
   for future cookie/token based sessions.
   ============================================================ */
router.post("/logout", authRateLimit, (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

/* ============================================================
   REGISTER — POST /api/auth/register  { name, email, password, role, passkey? }
   Step 1 of OTP registration: validates input, blocks duplicates,
   generates a 6-digit code, stores a pending verification row and
   sends the code by email. No account is created yet.
   ============================================================ */
router.post("/register", authRateLimit, async (req, res) => {
  try {
    const { name, email, password, role, passkey } = req.body;

    if (!name || !String(name).trim() || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Full name is required" });
    }
    if (!email || !isValidEmail(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    if (String(password).length > 72) {
      return res.status(400).json({ success: false, message: "Password must be under 72 characters" });
    }

    const userRole = role || "Student";
    if (!["Admin", "Student", "Faculty"].includes(userRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Admin registration requires the correct passkey (validated on the server only)
    if (userRole === "Admin") {
      if (!passkey || String(passkey).trim() !== ADMIN_PASSKEY) {
        return res.status(400).json({
          success: false,
          message: "Admin registration requires the correct 6-digit passkey.",
        });
      }
    }

    // Faculty registration requires the configured backend pass key.
    if (userRole === "Faculty") {
      if (!FACULTY_SIGNUP_KEY) {
        return res.status(503).json({
          success: false,
          message: "Faculty signup is not configured. Set FACULTY_SIGNUP_KEY in the backend environment.",
        });
      }
      if (!passkey || String(passkey).trim() !== FACULTY_SIGNUP_KEY) {
        return res.status(400).json({
          success: false,
          message: "Faculty registration requires the correct 6-digit pass key.",
        });
      }
    }

    const cleanEmail = toCleanEmail(email);
    const cleanName = String(name).trim();

    // Block duplicate registration (account or pending OTP)
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered. Please login instead." });
    }
    const [existingOtp] = await db.query(
      "SELECT id FROM otp_verifications WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    if (existingOtp.length > 0) {
      // A pending verification already exists for this email — replace it
      // with the new registration instead of blocking the user.
      await db.query("DELETE FROM otp_verifications WHERE email = ?", [cleanEmail]);
    }

    const otp = generateOtp();
    const otpHash = await hashValue(otp);
    const passwordHash = await hashValue(password);
    const expiresAt = otpExpiry();

    await db.query(
      `INSERT INTO otp_verifications (email, otp_hash, name, password_hash, role, attempts, resend_count, last_sent_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, ?)`,
      [cleanEmail, otpHash, cleanName, passwordHash, userRole, expiresAt]
    );

    let emailSent = false;
    let demoOtp = null;
    try {
      if (isEmailConfigured()) {
        await sendOtpEmail(cleanEmail, otp, cleanName);
        emailSent = true;
      }
    } catch (sendErr) {
      console.error("OTP send failed:", sendErr.message);
    }

    // Demo OTP is returned only in non-production demo mode. In production,
    // or when demo mode is disabled, no OTP is exposed in the response.
    if (isDemoOtpEnabled()) {
      demoOtp = otp;
    } else if (process.env.NODE_ENV !== "production" && !emailSent) {
      // Backward-compatible local fallback when no email provider exists.
      demoOtp = otp;
    }

    res.status(200).json({
      success: true,
      message: emailSent ? "Verification code sent to your email." : "Verification code generated (dev mode).",
      email: cleanEmail,
      role: userRole,
      ...(demoOtp ? { demoOtp, devOtp: demoOtp } : {}),
    });
  } catch (error) {
    console.error("Register Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to start registration. Please try again." });
  }
});

/* ============================================================
   RESEND-OTP — POST /api/auth/resend-otp  { email }
   Regenerates and resends the verification code for a pending signup.
   Rate limited to one resend per minute per email.
   ============================================================ */
router.post("/resend-otp", authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    const cleanEmail = toCleanEmail(email);

    const [rows] = await db.query(
      "SELECT id, resend_count, last_sent_at, expires_at FROM otp_verifications WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    if (rows.length === 0) {
      return res.status(202).json({ success: true, message: "If a pending signup exists, a new code has been sent." });
    }
    const row = rows[0];
    const lastSent = row.last_sent_at ? new Date(String(row.last_sent_at)).getTime() : 0;
    const now = Date.now();
    if (now - lastSent < 60 * 1000) {
      return res.status(429).json({ success: false, message: "Please wait before requesting another code." });
    }

    const otp = generateOtp();
    const otpHash = await hashValue(otp);
    const expiresAt = otpExpiry();

    await db.query(
      `UPDATE otp_verifications SET otp_hash = ?, expires_at = ?, attempts = 0,
       resend_count = resend_count + 1, last_sent_at = CURRENT_TIMESTAMP
       WHERE email = ?`,
      [otpHash, expiresAt, cleanEmail]
    );

    let emailSent = false;
    let demoOtp = null;
    try {
      if (isEmailConfigured()) {
        const [nameRow] = await db.query("SELECT name FROM otp_verifications WHERE email = ? LIMIT 1", [cleanEmail]);
        await sendOtpEmail(cleanEmail, otp, nameRow && nameRow[0] ? nameRow[0].name : "there");
        emailSent = true;
      }
    } catch (sendErr) {
      console.error("OTP resend failed:", sendErr.message);
    }

    if (isDemoOtpEnabled()) {
      demoOtp = otp;
    } else if (process.env.NODE_ENV !== "production" && !emailSent) {
      demoOtp = otp;
    }

    res.json({
      success: true,
      message: emailSent ? "A new verification code has been sent." : "New code generated (dev mode).",
      ...(demoOtp ? { demoOtp, devOtp: demoOtp } : {}),
    });
  } catch (error) {
    console.error("Resend OTP Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to resend code. Please try again." });
  }
});

/* ============================================================
   VERIFY — POST /api/auth/verify  { email, otp }
   Step 2 of OTP registration: validates the code, then creates the
   user account and linked student record transactionally.
   Generates the Student ID on the backend only.
   ============================================================ */
router.post("/verify", authRateLimit, async (req, res) => {
  const pool = await db.getPool();
  const useTransaction = Boolean(pool);
  let connection = null;
  try {
    const { email, otp } = req.body;
    if (!email || !isValidEmail(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
      return res.status(400).json({ success: false, message: "Enter a valid 6-digit code." });
    }
    const cleanEmail = toCleanEmail(email);
    const code = String(otp).trim();

    const [rows] = await db.query(
      "SELECT id, otp_hash, name, password_hash, role, attempts, expires_at FROM otp_verifications WHERE email = ? LIMIT 1",
      [cleanEmail]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or expired code. Please request a new one." });
    }
    const row = rows[0];

    const expired = new Date(String(row.expires_at)).getTime() <= Date.now();
    if (expired) {
      await db.query("DELETE FROM otp_verifications WHERE email = ?", [cleanEmail]);
      return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new one." });
    }
    if ((row.attempts || 0) >= 5) {
      await db.query("DELETE FROM otp_verifications WHERE email = ?", [cleanEmail]);
      return res.status(400).json({ success: false, message: "Too many failed attempts. Please register again." });
    }

    const codeOk = await compareValue(code, row.otp_hash);
    if (!codeOk) {
      await db.query("UPDATE otp_verifications SET attempts = attempts + 1 WHERE email = ?", [cleanEmail]);
      return res.status(400).json({ success: false, message: "Invalid code. Please try again." });
    }

    const userRole = row.role || "Student";
    const cleanName = String(row.name || "").trim();
    const passwordHash = row.password_hash;

    if (useTransaction) {
      connection = await pool.getConnection();
      await connection.beginTransaction();
    }

    const run = (sql, params) => useTransaction ? connection.query(sql, params) : db.query(sql, params);

    const [result] = await run(
      `INSERT INTO users (name, email, password, role, email_verified) VALUES (?, ?, ?, ?, 1)`,
      [cleanName, cleanEmail, passwordHash, userRole]
    );
    const userId = result.insertId;

    if (userRole === "Admin") {
      const adminId = `ADM${String(userId).padStart(4, "0")}`;
      await run(`UPDATE users SET admin_id = ? WHERE id = ?`, [adminId, userId]);
    }

    await run(`INSERT INTO user_profiles (user_id, email) VALUES (?, ?)`, [userId, cleanEmail]);

    const studentCode = userRole === "Student" ? "STU" + String(userId).padStart(4, "0") : null;
    if (userRole === "Student") {
      await run(
        `INSERT INTO students (student_code, name, email, phone, course, room_number, status)
         VALUES (?, ?, ?, NULL, NULL, NULL, 'Active')`,
        [studentCode, cleanName, cleanEmail]
      );
    }

    await db.query("DELETE FROM otp_verifications WHERE email = ?", [cleanEmail]);

    if (useTransaction) {
      await connection.commit();
    }

    const [adminRow] = await db.query("SELECT admin_id FROM users WHERE id = ? LIMIT 1", [userId]);

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token: signToken({ id: userId, email: cleanEmail, role: userRole, admin_id: userRole === "Admin" ? (adminRow[0] && adminRow[0].admin_id) : null }),
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: userRole,
        admin_id: userRole === "Admin" ? (adminRow[0] && adminRow[0].admin_id) : null,
      },
      studentCode,
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch { /* ignore */ }
    }
    console.error("Verify Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create account. Please try again." });
  } finally {
    if (connection) connection.release();
  }
});

/* ============================================================
   PROVISION FACULTY — Admin only
   POST /api/auth/provision-faculty { name, email, password }
   Creates a Faculty login account. No self-service role elevation.
   ============================================================ */
router.post("/provision-faculty", authMiddleware, requireRole("Admin"), async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = toCleanEmail(email);
    if (!cleanName || !cleanEmail || !password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Name, valid email and password (min 6 chars) are required" });
    }
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    const [existing] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }
    const hash = await hashValue(password);
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, role, email_verified) VALUES (?, ?, ?, 'Faculty', 1)",
      [cleanName, cleanEmail, hash]
    );
    await db.query("INSERT INTO user_profiles (user_id, email) VALUES (?, ?)", [result.insertId, cleanEmail]);
    res.status(201).json({ success: true, message: "Faculty account created", data: { id: result.insertId, email: cleanEmail, role: "Faculty" } });
  } catch (error) {
    console.error("Provision faculty error:", error);
    res.status(500).json({ success: false, message: "Failed to create Faculty account" });
  }
});

module.exports = router;
