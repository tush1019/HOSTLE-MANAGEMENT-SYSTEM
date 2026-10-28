const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/components/MobileNav.tsx";
const content = fs.readFileSync(p, "utf8");
const lines = content.split(/\r?\n/);
const out = lines.slice(0, 264).join("\n");
fs.writeFileSync(p, out + "\n");
console.log("done, lines:", lines.length);
