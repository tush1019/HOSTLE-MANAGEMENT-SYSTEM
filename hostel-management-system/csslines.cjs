const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/premium-global-redesign.css";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
for (let i = 170; i < 195; i++) console.log(i + 1 + ": " + lines[i]);
console.log("---");
for (let i = 250; i < 291; i++) console.log(i + 1 + ": " + lines[i]);
