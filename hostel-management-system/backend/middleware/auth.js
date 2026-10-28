const jwt = require("jsonwebtoken");
const db = require("../db");

const NODE_ENV = process.env.NODE_ENV || "development";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

if (NODE_ENV === "production" && !JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

const SECRET = JWT_SECRET || "dev-only-insecure-secret-change-me";

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES });
}

async function resolveUserFromHeaders(req) {
  const userId = req.headers["x-user-id"]
    ? parseInt(req.headers["x-user-id"], 10)
    : NaN;
  const email = (req.headers["x-user-email"] || "").trim().toLowerCase();
  if (!Number.isFinite(userId) || !email) return null;
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, role FROM users WHERE id = ? AND LOWER(email) = ? LIMIT 1",
      [userId, email]
    );
    if (rows && rows.length) {
      const u = rows[0];
      return { id: u.id, name: u.name, email: u.email, role: u.role };
    }
  } catch (e) {
    console.error("Header auth lookup failed:", e && e.message);
  }
  return null;
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  // 1. JWT Bearer token (preferred when available)
  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  // 2. Stateless session via headers sent by the frontend (x-user-id / x-user-email)
  const user = await resolveUserFromHeaders(req);
  if (user) {
    req.user = user;
    return next();
  }

  return res.status(401).json({ success: false, message: "Authentication required" });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

module.exports = { signToken, authMiddleware, requireRole, JWT_SECRET };