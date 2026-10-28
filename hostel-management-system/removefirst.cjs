const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/components/MobileNav.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
// remove 0-based indices 132..192 (lines 133..193)
const out = lines.filter((_, i) => i < 132 || i > 192).join("\n");
fs.writeFileSync(p, out + "\n");
console.log("done");
