const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/App.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/role=\{role\}/g, "role={role as any}");
s = s.replace(/role=\{role!\}/g, "role={role! as any}");
fs.writeFileSync(p, s);
console.log("done");
