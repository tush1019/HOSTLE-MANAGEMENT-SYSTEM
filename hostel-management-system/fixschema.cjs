const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/backend/schema.sql";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/role ENUM\('Admin', 'Student'\) NOT NULL DEFAULT 'Student',/g, "role ENUM('Admin', 'Student', 'Faculty') NOT NULL DEFAULT 'Student',");
fs.writeFileSync(p, s);
console.log("done");
