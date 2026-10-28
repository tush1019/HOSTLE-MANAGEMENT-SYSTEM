const db = require("./db");

async function ensureFacultyRoomAssignmentsTable() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS faculty_room_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faculty_name VARCHAR(120) NOT NULL,
      faculty_email VARCHAR(120),
      room_id INT,
      room_number VARCHAR(40),
      wing VARCHAR(20),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) { /* table may already exist */ }
}

async function getFacultyScope(email) {
  const scope = { rooms: [], wings: [] };
  if (!email) return scope;
  try {
    await ensureFacultyRoomAssignmentsTable();
    const [rows] = await db.query(
      `SELECT room_number, wing FROM faculty_room_assignments WHERE faculty_email = ?`,
      [email]
    );
    for (const r of rows || []) {
      if (r.room_number) scope.rooms.push(String(r.room_number).trim());
      if (r.wing) scope.wings.push(String(r.wing).trim());
    }
    scope.rooms = [...new Set(scope.rooms)];
    scope.wings = [...new Set(scope.wings)];
  } catch (e) {
    // safe default: no scope -> no records exposed
  }
  return scope;
}

module.exports = { ensureFacultyRoomAssignmentsTable, getFacultyScope };