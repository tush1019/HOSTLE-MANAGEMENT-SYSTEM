-- HostelHub database schema
-- Run: mysql -u root -p < schema.sql   (or import via phpMyAdmin / MySQL Workbench)

CREATE DATABASE IF NOT EXISTS hostel_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE hostel_management;

-- Users (login accounts created via Signup page)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Student') NOT NULL DEFAULT 'Student',
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account profile (avatar, cover photo & editable student details; keyed to the login user)
-- Auto-created at server boot too — safe to re-run.
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

-- Email OTP verifications (one active row per email)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Student') NOT NULL DEFAULT 'Student',
  attempts TINYINT NOT NULL DEFAULT 0,
  resend_count TINYINT NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_otp_email (email),
  INDEX idx_otp_expires (expires_at)
);

-- Hostel students (room allocation records)
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  course VARCHAR(100) NULL,
  room_number VARCHAR(10) NULL,
  status ENUM('Active', 'Pending', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NOT NULL UNIQUE,
  floor VARCHAR(50) NOT NULL DEFAULT 'Ground Floor',
  type VARCHAR(30) NOT NULL DEFAULT '2 Seater',
  capacity INT NOT NULL DEFAULT 2,
  occupied INT NOT NULL DEFAULT 0,
  status ENUM('Available', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
  wing ENUM('Boys', 'Girls') NOT NULL DEFAULT 'Boys',
  category ENUM('Standard', 'Premium', 'Deluxe') NOT NULL DEFAULT 'Standard',
  washroom ENUM('Attached', 'Common') NOT NULL DEFAULT 'Common',
  amenities VARCHAR(500) NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  photo VARCHAR(255) NULL,
  -- Premium upgrade fields
  photo_gallery VARCHAR(2000) NULL,
  toilet_condition TEXT NULL,
  cleaning_status TEXT NULL,
  ground_sports_status TEXT NULL,
  shafts_status TEXT NULL,
  safety_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fee payments (with per-head charge breakdown)
CREATE TABLE IF NOT EXISTS fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_code VARCHAR(20) UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(10) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  room_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  electricity_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  food_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cleaning_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  other_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  method ENUM('UPI', 'Cash', 'Card', 'Bank Transfer') NOT NULL DEFAULT 'UPI',
  status ENUM('Paid', 'Pending') NOT NULL DEFAULT 'Paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hostel facilities & services (Warden, Kitchen, Cleaning, Ground, Charges ...)
CREATE TABLE IF NOT EXISTS facilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('Warden', 'Mess & Kitchen', 'Cleaning', 'Ground & Sports', 'Charges & Billing', 'Safety & Rules', 'General') NOT NULL DEFAULT 'General',
  title VARCHAR(200) NOT NULL,
  details TEXT NULL,
  contact_name VARCHAR(100) NULL,
  contact_phone VARCHAR(20) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  complaint_code VARCHAR(20) UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(10) NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT NULL,
  complaint_date DATE NOT NULL,
  priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
  status ENUM('Pending', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mess weekly menu
CREATE TABLE IF NOT EXISTS mess_menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day VARCHAR(15) NOT NULL UNIQUE,
  breakfast VARCHAR(255) NULL,
  lunch VARCHAR(255) NULL,
  dinner VARCHAR(255) NULL,
  status ENUM('Published', 'Pending') NOT NULL DEFAULT 'Published'
);

-- Notice board
CREATE TABLE IF NOT EXISTS notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  audience ENUM('All', 'Students', 'Admins') NOT NULL DEFAULT 'All',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed rooms (only inserted when table is empty)
INSERT INTO rooms (room_number, floor, type, capacity, occupied, status, wing, category, washroom, amenities, monthly_rent, photo)
SELECT * FROM (
  SELECT '101' AS room_number, 'Ground Floor' AS floor, '2 Seater' AS type, 2 AS capacity, 2 AS occupied, 'Occupied' AS status, 'Boys' AS wing, 'Standard' AS category, 'Common' AS washroom, 'Bed, Study Table, Fan, Cupboard' AS amenities, 4500 AS monthly_rent, '/rooms/boys-room.svg' AS photo UNION ALL
  SELECT '102', 'Ground Floor', '3 Seater', 3, 2, 'Available', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg' UNION ALL
  SELECT '103', 'Ground Floor', '2 Seater', 2, 0, 'Available', 'Girls', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 4500, '/rooms/girls-room.svg' UNION ALL
  SELECT '104', 'Ground Floor', '1 Seater', 1, 0, 'Available', 'Girls', 'Premium', 'Attached', 'Single Bed, Study Table, AC, Wardrobe, Attached Washroom', 9000, '/rooms/premium-room.svg' UNION ALL
  SELECT '201', 'First Floor', '3 Seater', 3, 3, 'Occupied', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg' UNION ALL
  SELECT '202', 'First Floor', '2 Seater', 2, 1, 'Available', 'Girls', 'Standard', 'Attached', 'Bed, Study Table, Cooler, Attached Washroom', 5500, '/rooms/girls-room.svg' UNION ALL
  SELECT '203', 'First Floor', '2 Seater', 2, 2, 'Occupied', 'Girls', 'Premium', 'Attached', 'Bed, Study Table, AC, Wardrobe, Attached Washroom', 8000, '/rooms/girls-room.svg' UNION ALL
  SELECT '301', 'Second Floor', '3 Seater', 3, 0, 'Maintenance', 'Boys', 'Standard', 'Common', 'Bed, Study Table, Fan, Cupboard', 3500, '/rooms/boys-room.svg' UNION ALL
  SELECT '302', 'Second Floor', '2 Seater', 2, 1, 'Available', 'Boys', 'Deluxe', 'Attached', 'Bed, Study Table, AC, Fridge, Attached Washroom', 7500, '/rooms/boys-room.svg' UNION ALL
  SELECT '401', 'Second Floor', '1 Seater', 1, 1, 'Occupied', 'Girls', 'Deluxe', 'Attached', 'Single Bed, Study Table, AC, Fridge, Wardrobe, Attached Washroom', 10000, '/rooms/premium-room.svg'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM rooms LIMIT 1);

-- Upgrade helper for older databases (safe to run repeatedly)
-- ALTER TABLE rooms ADD COLUMN wing ENUM('Boys','Girls') NOT NULL DEFAULT 'Boys';
-- ALTER TABLE rooms ADD COLUMN photo VARCHAR(255) NULL;
-- ALTER TABLE rooms ADD COLUMN photo_gallery VARCHAR(2000) NULL;
-- ALTER TABLE rooms ADD COLUMN toilet_condition TEXT NULL;
-- ALTER TABLE rooms ADD COLUMN cleaning_status TEXT NULL;
-- ALTER TABLE rooms ADD COLUMN ground_sports_status TEXT NULL;
-- ALTER TABLE rooms ADD COLUMN shafts_status TEXT NULL;
-- ALTER TABLE rooms ADD COLUMN safety_notes TEXT NULL;

INSERT INTO facilities (category, title, details, contact_name, contact_phone, status)
SELECT * FROM (
  SELECT 'Warden' AS category, 'Boys Hostel Warden' AS title, 'Boys wing warden — room allotment, discipline & night attendance. Office hours 9 AM – 6 PM.' AS details, 'Mr. R. Singh' AS contact_name, '9876501234' AS contact_phone, 'Active' AS status UNION ALL
  SELECT 'Warden', 'Girls Hostel Warden', 'Girls wing warden — entry register, visitor approval & safety. Available on call 24x7.', 'Mrs. S. Sharma', '9876505678', 'Active' UNION ALL
  SELECT 'Mess & Kitchen', 'Mess Timings', 'Breakfast 7:30–9 AM, Lunch 12:30–2 PM, Snacks 5–6 PM, Dinner 7:30–9 PM. Sunday special thali.', 'Mess Manager', '9876501111', 'Active' UNION ALL
  SELECT 'Mess & Kitchen', 'Kitchen Hygiene Rules', 'FSSAI-followed kitchen: RO water, daily deep-clean, pest control every month. Complaints via Complaints page.', 'Head Cook', '9876502222', 'Active' UNION ALL
  SELECT 'Cleaning', 'Room Cleaning Schedule', 'Rooms cleaned Mon/Wed/Fri. Washrooms cleaned daily 7–9 AM. Deep cleaning every Sunday.', 'Cleaning Supervisor', '9876503333', 'Active' UNION ALL
  SELECT 'Ground & Sports', 'Playground & Sports', 'Cricket/football ground open 5–8 AM & 4–7 PM. Sports kit issued against ID card.', 'Sports In-charge', '9876504444', 'Active' UNION ALL
  SELECT 'Charges & Billing', 'Monthly Fee Structure', 'Standard ₹3500–4500, Premium ₹5500–8000, Deluxe ₹7500–10000. Electricity above 100 units extra. Food included.', 'Accounts Office', '9876505555', 'Active' UNION ALL
  SELECT 'Safety & Rules', 'Safety & Gate Rules', 'Gate closes 9:30 PM. CCTV monitored campus. Girls wing entry only with warden approval.', 'Security Head', '9876506666', 'Active'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM facilities LIMIT 1);

-- Seed a week of mess menu (only when empty)
INSERT INTO mess_menu (day, breakfast, lunch, dinner, status)
SELECT * FROM (
  SELECT 'Monday' AS day, 'Poha & Tea' AS breakfast, 'Dal, Rice, Roti & Sabzi' AS lunch, 'Paneer, Rice & Roti' AS dinner, 'Published' AS status UNION ALL
  SELECT 'Tuesday', 'Aloo Paratha & Curd', 'Rajma, Rice & Roti', 'Mix Veg, Dal & Roti', 'Published' UNION ALL
  SELECT 'Wednesday', 'Bread, Butter & Milk', 'Chole, Rice & Roti', 'Aloo Gobi, Dal & Roti', 'Published' UNION ALL
  SELECT 'Thursday', 'Upma & Tea', 'Dal Makhani, Rice & Roti', 'Kadhi, Rice & Roti', 'Published' UNION ALL
  SELECT 'Friday', 'Poha & Milk', 'Dal, Rice, Roti & Mix Veg', 'Paneer Curry & Roti', 'Pending' UNION ALL
  SELECT 'Saturday', 'Idli & Sambar', 'Veg Biryani & Raita', 'Dal Tadka & Roti', 'Pending' UNION ALL
  SELECT 'Sunday', 'Chole Bhature', 'Special Thali', 'Khichdi & Kadhi', 'Pending'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM mess_menu LIMIT 1);
-- Seed a welcome notice (only when empty)
INSERT INTO notices (title, message, audience)
SELECT 'Welcome to HostelHub', 'Mess timings: Breakfast 8 AM, Lunch 1 PM, Dinner 8 PM. Contact the warden for any help.', 'All'

-- Hostel services & information (Emergency, Medical, WiFi, Laundry, Study Room,
-- Water & Electricity, Housekeeping, Entry & Exit Rules)
CREATE TABLE IF NOT EXISTS hostel_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('Emergency Contact', 'Medical Facilities', 'WiFi Information', 'Laundry Services', 'Study Room', 'Water & Electricity', 'Housekeeping', 'Entry & Exit Rules') NOT NULL DEFAULT 'General',
  title VARCHAR(200) NOT NULL,
  details TEXT NULL,
  contact_name VARCHAR(100) NULL,
  contact_phone VARCHAR(20) NULL,
  photo VARCHAR(1000) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance requests (students report broken things, can attach a photo)
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(20) UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(10) NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  photo VARCHAR(2000) NULL,
  priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
  status ENUM('Pending', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave management (students apply for leave, admin approves/rejects)
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leave_code VARCHAR(20) UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(10) NULL,
  reason VARCHAR(500) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  admin_remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mess photos & food quality ratings
CREATE TABLE IF NOT EXISTS mess_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  photo VARCHAR(2000) NULL,
  food_quality TINYINT NULL CHECK (food_quality BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gym room photos
CREATE TABLE IF NOT EXISTS gym_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  photo VARCHAR(2000) NULL,
  description TEXT NULL,
  equipment_type VARCHAR(100) NULL,
  status ENUM('Active', 'Maintenance') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Room issue photos (students click photo of something broken in room)
CREATE TABLE IF NOT EXISTS room_issue_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) NULL,
  title VARCHAR(200) NOT NULL,
  photo VARCHAR(2000) NULL,
  description TEXT NULL,
  status ENUM('Pending', 'Resolved') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed hostel services (only when empty)
INSERT INTO hostel_services (category, title, details, contact_name, contact_phone, status)
SELECT * FROM (
  SELECT 'Emergency Contact', 'Hostel Warden (24x7)', 'Emergency warden contact for any urgent hostel issue — nights, weekends & holidays.', 'Mr. R. Singh', '9876501234', 'Active' UNION ALL
  SELECT 'Emergency Contact', 'Security Office', 'Main gate security — entry/exit register, visitor escort, night patrol.', 'Security Head', '9876506666', 'Active' UNION ALL
  SELECT 'Emergency Contact', 'Nearest Hospital', 'City General Hospital — 24x7 emergency, ambulance on call.', 'Hospital Reception', '9876507777', 'Active' UNION ALL
  SELECT 'Medical Facilities', 'Hostel Medical Room', 'First-aid room on Ground Floor. Basic medicines, BP check, thermometer available 8 AM – 8 PM.', 'Nurse on Duty', '9876508888', 'Active' UNION ALL
  SELECT 'Medical Facilities', 'Doctor Visit Schedule', 'Visiting doctor: Mon–Sat 5–7 PM. Emergency cases referred to City General Hospital.', 'Medical Officer', '9876508888', 'Active' UNION ALL
  SELECT 'WiFi Information', 'Hostel WiFi Network', 'Network: HostelHub_Student. Password posted on notice board. Covers all rooms, mess, study room & gym.', 'IT Support', '9876509999', 'Active' UNION ALL
  SELECT 'WiFi Information', 'WiFi Support', 'Slow connection or no signal? Report via Maintenance Request with room number.', 'IT Support', '9876509999', 'Active' UNION ALL
  SELECT 'Laundry Services', 'Laundry Room', 'Ground Floor near Boys Wing. Washing machines 6 AM – 10 PM daily. Coin-operated / app payment.', 'Laundry In-charge', '9876501010', 'Active' UNION ALL
  SELECT 'Laundry Services', 'Laundry Rules', 'Clothes must be collected same day. Delicate items at own risk. Lost items not responsibility of hostel.', 'Laundry In-charge', '9876501010', 'Active' UNION ALL
  SELECT 'Study Room', 'Study Room (24x7)', 'First Floor Library Hall. Silent zone, power sockets at every table, AC, drinking water nearby.', 'Librarian', '9876501112', 'Active' UNION ALL
  SELECT 'Study Room', 'Study Room Rules', 'No food, no phone calls, keep silence. Seating first-come-first-served. Lights off by 11:30 PM.', 'Librarian', '9876501112', 'Active' UNION ALL
  SELECT 'Water & Electricity', 'Water Supply', 'RO filtered water available on all floors. Hot water 6–9 AM & 6–9 PM (winter schedule).', 'Maintenance Supervisor', '9876501212', 'Active' UNION ALL
  SELECT 'Water & Electricity', 'Electricity / Power', 'Power backup (inverter) in all rooms. Report outage via Maintenance Request.', 'Electrician', '9876501313', 'Active' UNION ALL
  SELECT 'Housekeeping', 'Room Cleaning Schedule', 'Rooms cleaned Mon/Wed/Fri. Washrooms cleaned daily 7–9 AM. Deep cleaning every Sunday.', 'Cleaning Supervisor', '9876503333', 'Active' UNION ALL
  SELECT 'Housekeeping', 'Request Extra Cleaning', 'Need extra cleaning or fresh linen? Raise a Housekeeping request below.', 'Cleaning Supervisor', '9876503333', 'Active' UNION ALL
  SELECT 'Entry & Exit Rules', 'Gate Timings', 'Main gate closes 9:30 PM. Late entry needs warden approval. No entry after 11 PM without prior permission.', 'Security Head', '9876506666', 'Active' UNION ALL
  SELECT 'Entry & Exit Rules', 'Visitor Rules', 'Visitors allowed 4–6 PM in visitor lounge only. Must show ID and sign register. Girls wing entry with warden approval.', 'Security Head', '9876506666', 'Active'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM hostel_services LIMIT 1);
WHERE NOT EXISTS (SELECT 1 FROM notices LIMIT 1);
