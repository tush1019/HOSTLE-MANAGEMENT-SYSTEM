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

const fs = require("fs");
const path = require("path");

function normalizeSqliteSchema(sql) {
  let s = String(sql || "");
  // Drop database-level statements
  s = s.replace(/CREATE DATABASE[^;]*;/gi, "");
  s = s.replace(/USE\s+\w+;/gi, "");
  // ENUM(...) -> TEXT
  s = s.replace(/ENUM\([^)]*\)/gi, "TEXT");
  // DECIMAL(...) -> REAL
  s = s.replace(/DECIMAL\([^)]*\)/gi, "REAL");
  // MEDIUMTEXT/LONGTEXT -> TEXT
  s = s.replace(/MEDIUMTEXT|LONGTEXT/gi, "TEXT");
  // VARCHAR(n) -> TEXT
  s = s.replace(/VARCHAR\(\d+\)/gi, "TEXT");
  // INT AUTO_INCREMENT PRIMARY KEY -> INTEGER PRIMARY KEY AUTOINCREMENT
  s = s.replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
  // TINYINT(...) -> INTEGER
  s = s.replace(/TINYINT\(\d+\)/gi, "INTEGER");
  // Remove KEY/INDEX/CONSTRAINT lines inside CREATE TABLE
  s = s.replace(/,\s*(UNIQUE KEY|KEY|INDEX|CONSTRAINT)[^,\n)]*/gi, "");
  // Remove ON UPDATE CURRENT_TIMESTAMP
  s = s.replace(/\s+ON UPDATE CURRENT_TIMESTAMP/gi, "");
  // Remove trailing commas before closing paren
  s = s.replace(/,\s*\)/g, ")");
  return s;
}

function ensureSqliteSchema(db) {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const raw = fs.readFileSync(schemaPath, "utf8");
    const normalized = normalizeSqliteSchema(raw);
    // Extract CREATE TABLE statements
    const createRegex = /CREATE TABLE IF NOT EXISTS[\s\S]*?;/gi;
    const insertRegex = /INSERT (?:OR IGNORE )?INTO[\s\S]*?;/gi;
    const statements = [
      ...(normalized.match(createRegex) || []),
      ...(normalized.match(insertRegex) || []),
    ];
    for (const stmt of statements) {
      try { db.run(stmt); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.warn("SQLite schema load failed:", e.message);
  }
}
async function createSqliteFallback() {
  const initSqlJs = require("sql.js");
  const { Database } = await initSqlJs({
    locateFile: (filename) => require.resolve(`sql.js/dist/${filename}`),
  });

  const db = new Database();
  ensureSqliteSchema(db);
  try { db.run(`ALTER TABLE users ADD COLUMN admin_id TEXT`); } catch (e) { /* column may already exist */ }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Student' CHECK (role IN ('Admin', 'Student', 'Faculty')),
      admin_id TEXT UNIQUE,
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
      role TEXT NOT NULL DEFAULT 'Student' CHECK (role IN ('Admin', 'Student', 'Faculty')),
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
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_code TEXT UNIQUE,
      faculty_user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      class_name TEXT NOT NULL,
      session_date TEXT NOT NULL,
      start_time TEXT NULL,
      end_time TEXT NULL,
      room_number TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Present',
      marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (session_id, student_id)
    );
  `);

  /* Account-specific profile data (avatar, cover photo, editable details).
     Shared DDL works on both SQLite and MySQL (TEXT-affinity MEDIUMTEXT). */
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INT NOT NULL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      bio TEXT NULL,
      address VARCHAR(255) NULL,
      profile_photo MEDIUMTEXT NULL,
      cover_photo MEDIUMTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  /* New student-panel service tables */
  db.run(`
    CREATE TABLE IF NOT EXISTS hostel_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('Emergency Contact', 'Medical Facilities', 'WiFi Information', 'Laundry Services', 'Study Room', 'Water & Electricity', 'Housekeeping', 'Entry & Exit Rules')),
      title TEXT NOT NULL,
      details TEXT NULL,
      contact_name TEXT NULL,
      contact_phone TEXT NULL,
      photo TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT UNIQUE,
      student_name TEXT NOT NULL,
      room_number TEXT NULL,
      title TEXT NOT NULL,
      description TEXT NULL,
      photo TEXT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_code TEXT UNIQUE,
      student_name TEXT NOT NULL,
      room_number TEXT NULL,
      reason TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
      admin_remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mess_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      photo TEXT NULL,
      food_quality INTEGER NULL CHECK (food_quality BETWEEN 1 AND 5),
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gym_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      photo TEXT NULL,
      description TEXT NULL,
      equipment_type TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_issue_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NULL,
      title TEXT NOT NULL,
      photo TEXT NULL,
      description TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* Seed hostel services (SQLite fallback, only when empty) */
  db.run(`
    INSERT OR IGNORE INTO hostel_services (category, title, details, contact_name, contact_phone, status) VALUES
      ('Emergency Contact', 'Hostel Warden (24x7)', 'Emergency warden contact for any urgent hostel issue — nights, weekends & holidays.', 'Mr. R. Singh', '9876501234', 'Active'),
      ('Emergency Contact', 'Security Office', 'Main gate security — entry/exit register, visitor escort, night patrol.', 'Security Head', '9876506666', 'Active'),
      ('Emergency Contact', 'Nearest Hospital', 'City General Hospital — 24x7 emergency, ambulance on call.', 'Hospital Reception', '9876507777', 'Active'),
      ('Medical Facilities', 'Hostel Medical Room', 'First-aid room on Ground Floor. Basic medicines, BP check, thermometer available 8 AM – 8 PM.', 'Nurse on Duty', '9876508888', 'Active'),
      ('Medical Facilities', 'Doctor Visit Schedule', 'Visiting doctor: Mon–Sat 5–7 PM. Emergency cases referred to City General Hospital.', 'Medical Officer', '9876508888', 'Active'),
      ('WiFi Information', 'Hostel WiFi Network', 'Network: HostelHub_Student. Password posted on notice board. Covers all rooms, mess, study room & gym.', 'IT Support', '9876509999', 'Active'),
      ('WiFi Information', 'WiFi Support', 'Slow connection or no signal? Report via Maintenance Request with room number.', 'IT Support', '9876509999', 'Active'),
      ('Laundry Services', 'Laundry Room', 'Ground Floor near Boys Wing. Washing machines 6 AM – 10 PM daily. Coin-operated / app payment.', 'Laundry In-charge', '9876501010', 'Active'),
      ('Laundry Services', 'Laundry Rules', 'Clothes must be collected same day. Delicate items at own risk. Lost items not responsibility of hostel.', 'Laundry In-charge', '9876501010', 'Active'),
      ('Study Room', 'Study Room (24x7)', 'First Floor Library Hall. Silent zone, power sockets at every table, AC, drinking water nearby.', 'Librarian', '9876501112', 'Active'),
      ('Study Room', 'Study Room Rules', 'No food, no phone calls, keep silence. Seating first-come-first-served. Lights off by 11:30 PM.', 'Librarian', '9876501112', 'Active'),
      ('Water & Electricity', 'Water Supply', 'RO filtered water available on all floors. Hot water 6–9 AM & 6–9 PM (winter schedule).', 'Maintenance Supervisor', '9876501212', 'Active'),
      ('Water & Electricity', 'Electricity / Power', 'Power backup (inverter) in all rooms. Report outage via Maintenance Request.', 'Electrician', '9876501313', 'Active'),
      ('Housekeeping', 'Room Cleaning Schedule', 'Rooms cleaned Mon/Wed/Fri. Washrooms cleaned daily 7–9 AM. Deep cleaning every Sunday.', 'Cleaning Supervisor', '9876503333', 'Active'),
      ('Housekeeping', 'Request Extra Cleaning', 'Need extra cleaning or fresh linen? Raise a Housekeeping request below.', 'Cleaning Supervisor', '9876503333', 'Active'),
      ('Entry & Exit Rules', 'Gate Timings', 'Main gate closes 9:30 PM. Late entry needs warden approval. No entry after 11 PM without prior permission.', 'Security Head', '9876506666', 'Active'),
      ('Entry & Exit Rules', 'Visitor Rules', 'Visitors allowed 4–6 PM in visitor lounge only. Must show ID and sign register. Girls wing entry with warden approval.', 'Security Head', '9876506666', 'Active');
  `);

  /* Campus gallery (published campus photographs managed by admins). */
  db.run(`\n    CREATE TABLE IF NOT EXISTS campus_gallery (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      title VARCHAR(200) NOT NULL,\n      description TEXT NULL,\n      category VARCHAR(50) NOT NULL DEFAULT 'General',\n      image_url VARCHAR(2000) NULL,\n      image_data MEDIUMTEXT NULL,\n      display_order INT NOT NULL DEFAULT 0,\n      is_published INT NOT NULL DEFAULT 1,\n      is_cover INT NOT NULL DEFAULT 0,\n      created_by INT NULL,\n      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n    );\n  `);

  /* Persistent application settings (admin only). */
  db.run(`\n    CREATE TABLE IF NOT EXISTS app_settings (\n      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,\n      setting_value TEXT NULL,\n      updated_by INT NULL,\n      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n    );\n  `);

  /* Per-user display preferences (theme, accent, layout, notifications). */
  db.run(`\n    CREATE TABLE IF NOT EXISTS user_preferences (\n      user_id INT NOT NULL PRIMARY KEY,\n      theme VARCHAR(20) NOT NULL DEFAULT 'light',\n      accent_color VARCHAR(20) NOT NULL DEFAULT 'emerald',\n      layout VARCHAR(20) NOT NULL DEFAULT 'default',\n      notifications INT NOT NULL DEFAULT 1,\n      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n    );\n  `);

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

/* Ensure the account profile table exists on MySQL (safe, runs once per boot). */
async function ensureUserProfileTable(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INT NOT NULL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      bio TEXT NULL,
      address VARCHAR(255) NULL,
      profile_photo MEDIUMTEXT NULL,
      cover_photo MEDIUMTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("[db] Verified table: user_profiles");
  } catch (error) {
    console.warn("user_profiles table migration skipped:", error.message);
  }
}

/* Add admin_id column to users (MySQL, safe to re-run). */
async function ensureAdminIdColumn(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    const have = new Set(
      rows.map((r) => r.COLUMN_NAME || Object.values(r)[0]).map((v) => String(v).toLowerCase())
    );
    if (!have.has("admin_id")) {
      await pool.query(`ALTER TABLE users ADD COLUMN admin_id VARCHAR(20) UNIQUE`);
      console.log("[db] Migrated: added users.admin_id");
    }
    /* Backfill admin IDs for existing admins that lack one. */
    await pool.query(
      `UPDATE users SET admin_id = CONCAT('ADM', LPAD(id, 4, '0'))
       WHERE role = 'Admin' AND (admin_id IS NULL OR admin_id = '')`
    );
  } catch (error) {
    console.warn("admin_id migration skipped:", error.message);
  }
}

/* Campus gallery table (MySQL, safe to re-run). */
async function ensureCampusGalleryTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campus_gallery (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'General',
        image_url VARCHAR(2000) NULL,
        image_data MEDIUMTEXT NULL,
        display_order INT NOT NULL DEFAULT 0,
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        is_cover TINYINT(1) NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_gallery_published (is_published, display_order)
      )
    `);
    console.log("[db] Verified table: campus_gallery");
  } catch (error) {
    console.warn("campus_gallery table migration skipped:", error.message);
  }
}

/* Application settings table (MySQL, safe to re-run). */
async function ensureAppSettingsTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("[db] Verified table: app_settings");
  } catch (error) {
    console.warn("app_settings table migration skipped:", error.message);
  }
}

/* User preferences table (MySQL, safe to re-run). */
async function ensureUserPreferencesTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INT NOT NULL PRIMARY KEY,
        theme VARCHAR(20) NOT NULL DEFAULT 'light',
        accent_color VARCHAR(20) NOT NULL DEFAULT 'emerald',
        layout VARCHAR(20) NOT NULL DEFAULT 'default',
        notifications TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("[db] Verified table: user_preferences");
  } catch (error) {
    console.warn("user_preferences table migration skipped:", error.message);
  }
}

/* Staff table (MySQL, safe to re-run). */
async function ensureStaffTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_code VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NULL,
        phone VARCHAR(20) NULL,
        department VARCHAR(100) NULL,
        designation VARCHAR(100) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Staff',
        responsibilities TEXT NULL,
        status ENUM('Active', 'Inactive', 'On Leave') NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[db] Verified table: staff");
  } catch (error) {
    console.warn("staff table migration skipped:", error.message);
  }
}

/* Chat messages table (MySQL, safe to re-run). */
async function ensureChatMessagesTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        recipient_id INT NOT NULL,
        body TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_sender (sender_id),
        INDEX idx_chat_recipient (recipient_id)
      )
    `);
    console.log("[db] Verified table: chat_messages");
  } catch (error) {
    console.warn("chat_messages table migration skipped:", error.message);
  }
}
/* Ensure Faculty is allowed in users.role and otp_verifications.role (MySQL, safe to re-run). */
/* Faculty attendance/assignment/timetable tables (MySQL, safe to re-run). */
async function ensureFacultyTables(pool) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_code VARCHAR(20) UNIQUE,
      faculty_user_id INT NOT NULL,
      subject VARCHAR(100) NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      session_date DATE NOT NULL,
      start_time VARCHAR(10) NULL,
      end_time VARCHAR(10) NULL,
      room_number VARCHAR(20) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      student_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Present',
      marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_attendance_record (session_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_code VARCHAR(20) UNIQUE,
      faculty_user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      instructions TEXT NULL,
      subject VARCHAR(100) NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      deadline DATETIME NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      submitted_at TIMESTAMP NULL,
      marks DECIMAL(6,2) NULL,
      feedback TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Not Submitted',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_assignment_submission (assignment_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS timetable_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faculty_user_id INT NOT NULL,
      subject VARCHAR(100) NOT NULL,
      class_name VARCHAR(100) NOT NULL,
      day_of_week VARCHAR(15) NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      room_number VARCHAR(20) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of statements) {
    try { await pool.query(sql); } catch (error) { console.warn("faculty table migration skipped:", error.message); }
  }
  console.log("[db] Verified faculty tables");
}


async function ensureFacultyRoleEnum(pool) {
  try {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('Admin', 'Student', 'Faculty') NOT NULL DEFAULT 'Student'");
    await pool.query("ALTER TABLE otp_verifications MODIFY COLUMN role ENUM('Admin', 'Student', 'Faculty') NOT NULL DEFAULT 'Student'");
    console.log("[db] Verified Faculty role support");
  } catch (error) {
    console.warn("faculty role migration skipped:", error.message);
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
    await ensureUserProfileTable(mysqlPool);
    await ensureAdminIdColumn(mysqlPool);
    await ensureCampusGalleryTable(mysqlPool);
    await ensureAppSettingsTable(mysqlPool);
    await ensureUserPreferencesTable(mysqlPool);
    await ensureStaffTable(mysqlPool);
    await ensureChatMessagesTable(mysqlPool);
    await ensureFacultyTables(mysqlPool);
    await ensureFacultyRoleEnum(mysqlPool);
    console.log("[db] MySQL pool connected successfully");
    return mysqlPool;
  } catch (error) {
    console.warn("[db] MySQL unavailable; using SQLite fallback:", error.message);
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
  /* Expose the pool so auth can wrap linked inserts in a transaction (MySQL).
     Returns null when MySQL is unavailable (SQLite fallback path). */
  getPool,
  getDatabaseType() {
    return mysqlPool ? "mysql" : "sqlite";
  },
};

module.exports = db;

