const db = require("./db");

async function ensureAuditTable() {
  await db.query("CREATE TABLE IF NOT EXISTS hostel_audit_logs (id INT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(40) NOT NULL, entity_id INT NOT NULL, action VARCHAR(20) NOT NULL, previous_values TEXT NULL, new_values TEXT NULL, actor_id INT NULL, actor_email VARCHAR(150) NULL, actor_role VARCHAR(30) NULL, reason VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
}

async function resolveStudentId(name, email) {
  if (email) {
    try { const [rows] = await db.query("SELECT id FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]); if (rows && rows.length) return rows[0].id; } catch (e) {}
  }
  if (name) {
    try { const [rows] = await db.query("SELECT id FROM students WHERE LOWER(name) = LOWER(?) LIMIT 1", [name]); if (rows && rows.length) return rows[0].id; } catch (e) {}
  }
  return null;
}

async function getStudentIdentity(user) {
  const ident = { id: null, email: user && user.email ? user.email : null, name: user && (user.name || user.email) ? (user.name || user.email) : null };
  if (!user || !user.email) return ident;
  try {
    const [rows] = await db.query("SELECT id, email, name FROM students WHERE LOWER(email) = LOWER(?) LIMIT 1", [user.email]);
    if (rows && rows.length) { ident.id = rows[0].id; if (rows[0].email) ident.email = rows[0].email; if (rows[0].name) ident.name = rows[0].name; }
  } catch (e) {}
  return ident;
}

async function writeAudit(entityType, entityId, action, previousValues, newValues, req, reason) {
  try {
    await ensureAuditTable();
    await db.query(
      "INSERT INTO hostel_audit_logs (entity_type, entity_id, action, previous_values, new_values, actor_id, actor_email, actor_role, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [entityType, entityId, action, previousValues ? JSON.stringify(previousValues) : null, newValues ? JSON.stringify(newValues) : null,
       req.user && req.user.id ? Number(req.user.id) : null, req.user && req.user.email ? String(req.user.email) : null,
       req.user && req.user.role ? String(req.user.role) : null, reason ? String(reason).trim() : null]
    );
  } catch (e) { /* audit must not break main flow */ }
}

module.exports = { ensureAuditTable, resolveStudentId, getStudentIdentity, writeAudit };