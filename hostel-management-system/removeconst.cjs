const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/components/MobileNav.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
// remove line 192 (0-based 191)
const out = lines.filter((_, i) => i !== 191).join("\n");
fs.writeFileSync(p, out + "\n");
console.log("done");
