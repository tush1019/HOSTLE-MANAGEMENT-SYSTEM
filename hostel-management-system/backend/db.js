// dotenv is loaded by server.js before this module is required,
// but load it here too so db.js also works standalone (tests, scripts).
require("dotenv").config();
const mysql = require("mysql2/promise");

let mysqlPool = null;
let sqliteDb = null;
let sqliteReady = false;

function monthNameSql(expr) {
  return `CASE CAST(strftime('%m', ${expr}) AS INTEGER)
    WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Apr'
    WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Aug'
    WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dec'
    ELSE 'N/A' END`;
}

function normalizeSQLiteQuery(sql) {
  let normalized = String(sql || "");

  normalized = normalized.replace(/DATE_FORMAT\(([^,]+),\s*'%d %b %Y'\)/g, (_, expr) => `strftime('%d', ${expr}) || ' ' || ${monthNameSql(expr)} || ' ' || strftime('%Y', ${expr})`);
  normalized = normalized.replace(/DATE_FORMAT\(([^,]+),\s*'%b'\)/g, (_, expr) => monthNameSql(expr));
  normalized = normalized.replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/g, (_, expr) => `strftime('%Y', ${expr}) || '-' || printf('%02d', CAST(strftime('%m', ${expr}) AS INTEGER))`);
  normalized = normalized.replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/g, (_, expr) => `strftime('%Y-%m-%d', ${expr})`);
  normalized = normalized.replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+6\s+MONTH\)/gi, "date('now', '-6 months')");
  normalized = normalized.replace(/CURDATE\(\)/g, "date('now')");
  normalized = normalized.replace(
    /ORDER BY FIELD\(day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'\)/g,
    "ORDER BY CASE day WHEN 'Monday' THEN 0 WHEN 'Tuesday' THEN 1 WHEN 'Wednesday' THEN 2 WHEN 'Thursday' THEN 3 WHEN 'Friday' THEN 4 WHEN 'Saturday' THEN 5 WHEN 'Sunday' THEN 6 ELSE 99 END"
  );

  return normalized;
}

async function createSqliteFallback() {
  const initSqlJs = require("sql.js");
  const { Database } = await initSqlJs({
    locateFile: (filename) => require.resolve(`sql.js/dist/${filename}`),
  });

  const db = new Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Student' CHECK (role IN ('Admin', 'Student')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Student' CHECK (role IN ('Admin', 'Student')),
      attempts INTEGER NOT NULL DEFAULT 0,
      resend_count INTEGER NOT NULL DEFAULT 1,
      last_sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_code TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NULL,
      phone TEXT NULL,
      course TEXT NULL,
      room_number TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL UNIQUE,
      floor TEXT NOT NULL DEFAULT 'Ground Floor',
      type TEXT NOT NULL DEFAULT '2 Seater',
      capacity INTEGER NOT NULL DEFAULT 2,
      occupied INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance')),
      wing TEXT NOT NULL DEFAULT 'Boys' CHECK (wing IN ('Boys', 'Girls')),
      category TEXT NOT NULL DEFAULT 'Standard' CHECK (category IN ('Standard', 'Premium', 'Deluxe')),
      washroom TEXT NOT NULL DEFAULT 'Common' CHECK (washroom IN ('Attached', 'Common')),
      amenities TEXT,
      monthly_rent REAL NOT NULL DEFAULT 0,
      photo TEXT,
      -- Premium upgrade fields
      photo_gallery TEXT,
      toilet_condition TEXT,
      cleaning_status TEXT,
      ground_sports_status TEXT,
      shafts_status TEXT,
      safety_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_code TEXT UNIQUE,
      student_name TEXT NOT NULL,
      room_number TEXT NULL,
      amount REAL NOT NULL,
      room_charge REAL NOT NULL DEFAULT 0,
      electricity_charge REAL NOT NULL DEFAULT 0,
      food_charge REAL NOT NULL DEFAULT 0,
      cleaning_charge REAL NOT NULL DEFAULT 0,
      other_charge REAL NOT NULL DEFAULT 0,
      payment_date DATE NOT NULL,
      method TEXT NOT NULL DEFAULT 'UPI' CHECK (method IN ('UPI', 'Cash', 'Card', 'Bank Transfer')),
      status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Pending')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* Hostel facilities & services (Warden, Kitchen, Cleaning, Ground, Charges ...) */
  db.run(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('Warden', 'Mess & Kitchen', 'Cleaning', 'Ground & Sports', 'Charges & Billing', 'Safety & Rules', 'General')),
      title TEXT NOT NULL,
      details TEXT NULL,
      contact_name TEXT NULL,
      contact_phone TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_code TEXT UNIQUE,
      student_name TEXT NOT NULL,
      room_number TEXT NULL,
      subject TEXT NOT NULL,
      description TEXT NULL,
      complaint_date DATE NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mess_menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL UNIQUE,
      breakfast TEXT NULL,
      lunch TEXT NULL,
      dinner TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Published', 'Pending'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'All' CHECK (audience IN ('All', 'Students', 'Admins')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    INSERT OR IGNORE INTO rooms (room_number, floor, type, capacity, occupied, status, wing, category, washroom, amenities, monthly_rent, photo) VALUES
      ('101', 'Ground Floor', '2 Seater', 2, 2, 'Occupied', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 4500, '/rooms/boys-room.svg'),
      ('102', 'Ground Floor', '3 Seater', 3, 2, 'Available', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg'),
      ('103', 'Ground Floor', '2 Seater', 2, 0, 'Available', 'Girls', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 4500, '/rooms/girls-room.svg'),
      ('104', 'Ground Floor', '1 Seater', 1, 0, 'Available', 'Girls', 'Premium', 'Attached', 'Single Bed, Study Table, AC, Wardrobe, Attached Washroom', 9000, '/rooms/premium-room.svg'),
      ('201', 'First Floor', '3 Seater', 3, 3, 'Occupied', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg'),
      ('202', 'First Floor', '2 Seater', 2, 1, 'Available', 'Girls', 'Standard', 'Attached', 'Bed, Study Table, Cooler, Attached Washroom', 5500, '/rooms/girls-room.svg'),
      ('203', 'First Floor', '2 Seater', 2, 2, 'Occupied', 'Girls', 'Premium', 'Attached', 'Bed, Study Table, AC, Wardrobe, Attached Washroom', 8000, '/rooms/girls-room.svg'),
      ('301', 'Second Floor', '3 Seater', 3, 0, 'Maintenance', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg'),
      ('302', 'Second Floor', '2 Seater', 2, 1, 'Available', 'Boys', 'Deluxe', 'Attached', 'Bed, Study Table, AC, Fridge, Attached Washroom', 7500, '/rooms/boys-room.svg'),
      ('401', 'Second Floor', '1 Seater', 1, 1, 'Occupied', 'Girls', 'Deluxe', 'Attached', 'Single Bed, Study Table, AC, Fridge, Wardrobe, Attached Washroom', 10000, '/rooms/premium-room.svg');
  `);

  db.run(`
    INSERT OR IGNORE INTO facilities (category, title, details, contact_name, contact_phone, status) VALUES
      ('Warden', 'Boys Hostel Warden', 'Boys wing warden — room allotment, discipline & night attendance. Office hours 9 AM – 6 PM.', 'Mr. R. Singh', '9876501234', 'Active'),
      ('Warden', 'Girls Hostel Warden', 'Girls wing warden — entry register, visitor approval & safety. Available on call 24x7.', 'Mrs. S. Sharma', '9876505678', 'Active'),
      ('Mess & Kitchen', 'Mess Timings', 'Breakfast 7:30–9 AM, Lunch 12:30–2 PM, Snacks 5–6 PM, Dinner 7:30–9 PM. Sunday special thali.', 'Mess Manager', '9876501111', 'Active'),
      ('Mess & Kitchen', 'Kitchen Hygiene Rules', 'FSSAI-followed kitchen: RO water, daily deep-clean, pest control every month. Complaints via Complaints page.', 'Head Cook', '9876502222', 'Active'),
      ('Cleaning', 'Room Cleaning Schedule', 'Rooms cleaned Mon/Wed/Fri. Washrooms cleaned daily 7–9 AM. Deep cleaning every Sunday.', 'Cleaning Supervisor', '9876503333', 'Active'),
      ('Ground & Sports', 'Playground & Sports', 'Cricket/football ground open 5–8 AM & 4–7 PM. Sports kit issued against ID card.', 'Sports In-charge', '9876504444', 'Active'),
      ('Charges & Billing', 'Monthly Fee Structure', 'Standard ₹3500–4500, Premium ₹5500–8000, Deluxe ₹7500–10000. Electricity above 100 units extra. Food included.', 'Accounts Office', '9876505555', 'Active'),
      ('Safety & Rules', 'Safety & Gate Rules', 'Gate closes 9:30 PM. CCTV monitored campus. Girls wing entry only with warden approval.', 'Security Head', '9876506666', 'Active');
  `);

  db.run(`
    INSERT OR IGNORE INTO mess_menu (day, breakfast, lunch, dinner, status) VALUES
      ('Monday', 'Poha & Tea', 'Dal, Rice, Roti & Sabzi', 'Paneer, Rice & Roti', 'Published'),
      ('Tuesday', 'Aloo Paratha & Curd', 'Rajma, Rice & Roti', 'Mix Veg, Dal & Roti', 'Published'),
      ('Wednesday', 'Bread, Butter & Milk', 'Chole, Rice & Roti', 'Aloo Gobi, Dal & Roti', 'Published'),
      ('Thursday', 'Upma & Tea', 'Dal Makhani, Rice & Roti', 'Kadhi, Rice & Roti', 'Published'),
      ('Friday', 'Poha & Milk', 'Dal, Rice, Roti & Mix Veg', 'Paneer Curry & Roti', 'Pending'),
      ('Saturday', 'Idli & Sambar', 'Veg Biryani & Raita', 'Dal Tadka & Roti', 'Pending'),
      ('Sunday', 'Chole Bhature', 'Special Thali', 'Khichdi & Kadhi', 'Pending');
  `);

  db.run(`
    INSERT OR IGNORE INTO notices (title, message, audience) VALUES
      ('Welcome to HostelHub', 'Mess timings: Breakfast 8 AM, Lunch 1 PM, Dinner 8 PM. Contact the warden for any help.', 'All');
  `);

  return db;
}

/* Add premium room columns to older MySQL databases (safe, runs once per boot). */
async function ensurePremiumRoomColumns(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'`
    );
    const have = new Set(
      rows.map((r) => r.COLUMN_NAME || Object.values(r)[0]).map((v) => String(v).toLowerCase())
    );
    const missing = {
      photo_gallery: "VARCHAR(2000) NULL",
      toilet_condition: "TEXT NULL",
      cleaning_status: "TEXT NULL",
      ground_sports_status: "TEXT NULL",
      shafts_status: "TEXT NULL",
      safety_notes: "TEXT NULL",
    };
    for (const [name, def] of Object.entries(missing)) {
      if (!have.has(name)) {
        await pool.query(`ALTER TABLE rooms ADD COLUMN ${name} ${def}`);
        console.log(`[db] Migrated: added rooms.${name}`);
      }
    }
  } catch (error) {
    console.warn("rooms column migration skipped:", error.message);
  }
}

async function getPool() {
  if (mysqlPool) return mysqlPool;

  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hostel_management",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    await mysqlPool.query("SELECT 1 AS connected");
    await ensurePremiumRoomColumns(mysqlPool);
    return mysqlPool;
  } catch (error) {
    mysqlPool = null;
    return null;
  }
}

async function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  sqliteDb = await createSqliteFallback();
  return sqliteDb;
}

async function querySqlite(sql, params = []) {
  const db = await getSqliteDb();
  const normalized = normalizeSQLiteQuery(sql);

  if (/^\s*SELECT|^\s*WITH/i.test(normalized.trim())) {
    const statement = db.prepare(normalized);
    if (params.length) statement.bind(params);
    const rows = [];
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
    statement.free();
    return [rows];
  }

  const statement = db.prepare(normalized);
  if (params.length) statement.bind(params);
  statement.step();
  statement.free();

  const [changesResult] = db.exec("SELECT changes() AS affected_rows, last_insert_rowid() AS insert_id");
  const affectedRows = changesResult && changesResult.values && changesResult.values[0]
    ? Number(changesResult.values[0][0] || 0)
    : 0;
  const insertId = changesResult && changesResult.values && changesResult.values[0]
    ? Number(changesResult.values[0][1] || 0)
    : 0;

  return [{ affectedRows, insertId }];
}

const db = {
  async query(sql, params = []) {
    const pool = await getPool();
    if (pool) {
      try {
        return await pool.query(sql, params);
      } catch (error) {
        // Fall back to the local SQLite store when MySQL is unreachable.
      }
    }

    return querySqlite(sql, params);
  },
};

module.exports = db;

