const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const rateLimit = require("express-rate-limit");

// Always load the backend's own .env when present (local dev). On Render,
// process environment variables take precedence and are never overridden.
dotenv.config({ path: path.join(__dirname, ".env") });

const db = require("./db");

// Safe startup diagnostics: report presence only, never values.
function envPresent(key) {
  return process.env[key] ? "present" : "MISSING";
}
console.log("[startup] Environment check:", {
  NODE_ENV: process.env.NODE_ENV || "MISSING",
  JWT_SECRET: envPresent("JWT_SECRET"),
  JWT_EXPIRES: envPresent("JWT_EXPIRES"),
  ADMIN_PASSKEY: envPresent("ADMIN_PASSKEY"),
  FACULTY_SIGNUP_KEY: envPresent("FACULTY_SIGNUP_KEY"),
  DB_HOST: envPresent("DB_HOST"),
  DB_USER: envPresent("DB_USER"),
  DB_NAME: envPresent("DB_NAME"),
  PORT: process.env.PORT || "5000 (default)",
});

const authRoutes = require("./auth");
const studentRoutes = require("./students");
const roomRoutes = require("./rooms");
const feeRoutes = require("./fees");
const complaintRoutes = require("./complaints");
const messRoutes = require("./mess");
const facilityRoutes = require("./facilities");
const noticeRoutes = require("./notices");
const dashboardRoutes = require("./dashboard");
const serviceRoutes = require("./services");
const maintenanceRoutes = require("./maintenance");
const leaveRoutes = require("./leave");
const gymRoutes = require("./gym");
const roomIssueRoutes = require("./room_issue");
const profileRoutes = require("./profiles");
const campusGalleryRoutes = require("./campus_gallery");
const settingsRoutes = require("./settings");
const reportsRoutes = require("./reports");
const timetableRoutes = require("./timetable");
const assignmentRoutes = require("./assignments");
const attendanceRoutes = require("./attendance");
const facultyRoutes = require("./faculty");
const facultyRoomRoutes = require("./faculty_rooms");
const staffRoutes = require("./staff");
const chatRoutes = require("./chat");
const notificationRoutes = require("./notifications");
const hostelEntryExitRoutes = require("./hostel_entry_exit");

/* Validate required production environment variables without exposing values. */
if (process.env.NODE_ENV === "production") {
  const required = ["JWT_SECRET", "JWT_EXPIRES"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("[startup] Missing required production environment variables:", missing.join(", "));
    process.exit(1);
  }
}

/* Prevent silent ephemeral SQLite usage for account storage in production. */
if (process.env.NODE_ENV === "production" && !process.env.DB_HOST) {
  console.error("[startup] DB_HOST is MISSING. Configure a persistent MySQL database (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) in Render. Refusing to use ephemeral SQLite for account storage.");
  process.exit(1);
}

const app = express();

/* Render (and similar hosts) sit behind a proxy — required so express-rate-limit
   and req.ip work correctly instead of throwing 500 on every API call. */
app.set("trust proxy", 1);

const PORT = parseInt(process.env.PORT || "5000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* CORS — allow the React frontend (and same-origin tools) */
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-email"],
  })
);
app.use(express.json({ limit: "1mb" }));

/* Global API rate limit: 300 requests / 15 min per IP */
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: { success: false, message: "Too many requests. Please slow down." },
  })
);

// Health check (root serves the frontend now — see static setup below)
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HostelHub Backend is running 🚀",
  });
});

// Database test
app.get("/api/db-test", async (req, res) => {
  try {
    const pool = await db.getPool();
    const driver = pool ? "mysql" : "sqlite";
    const [rows] = await db.query("SELECT 1 AS connected");

    res.json({
      success: true,
      driver,
      message: driver === "mysql"
        ? "MySQL connected successfully"
        : "SQLite fallback connected successfully",
      data: rows,
    });
  } catch (error) {
    console.error("Database Error:", error.message);

    res.status(500).json({
      success: false,
      driver: db.getDatabaseType(),
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Email configuration test (does NOT send an email)
app.get("/api/email-test", async (req, res) => {
  const { isEmailConfigured, getTransporter } = require("./mailer");
  if (!isEmailConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Email is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in backend/.env",
    });
  }
  try {
    await getTransporter().verify();
    res.json({ success: true, message: "Email SMTP connection verified" });
  } catch (error) {
    console.error("Email test failed:", error.message);
    res.status(502).json({ success: false, message: "SMTP verification failed", error: error.message });
  }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Module routes
app.use("/api/students", studentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/facilities", facilityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/gym", gymRoutes);
app.use("/api/room-issues", roomIssueRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/campus-gallery", campusGalleryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports-faculty", reportsRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/faculty-rooms", facultyRoomRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/hostel-gate-logs", hostelEntryExitRoutes);

// 404 for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

const fs = require("fs");
const FRONTEND_DIST = path.join(__dirname, "..", "dist");
app.use(express.static(FRONTEND_DIST, { maxAge: 0, etag: false, lastModified: false }));

/* SPA fallback: any other GET returns the frontend index.html */
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    const indexFile = path.join(FRONTEND_DIST, "index.html");
    if (fs.existsSync(indexFile)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.sendFile(indexFile);
    }
    return res.status(503).send(
      "Frontend build not found. Set Render Build Command to: npm install && npm run build && cd backend && npm install"
    );
  }
  next();
});

// Central error handler (malformed JSON etc.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON in request body" });
  }
  console.error("Unhandled error:", err && err.message ? err.message : err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// Start server after initializing DB so startup logs report the active driver.
(async () => {
  try {
    const pool = await db.getPool();
    if (pool) {
      console.log("[db] Startup: MySQL pool connected successfully");
    } else {
      console.warn("[db] Startup: MySQL unavailable; using SQLite fallback");
    }
  } catch (error) {
    console.warn("[db] Startup: database initialization failed:", error.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HostelHub Backend running on port ${PORT}`);
  });
})();