const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/premium-global-redesign.css";
const s = fs.readFileSync(p, "utf8");
const lines = s.split(/\r?\n/);
console.log("total lines:", lines.length);
for (let i = lines.length - 15; i < lines.length; i++) console.log(i + 1 + ": " + lines[i]);
