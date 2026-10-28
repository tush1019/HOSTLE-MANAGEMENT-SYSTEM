const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/components/MobileNav.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
for (let i = 0; i < lines.length; i++) if (lines[i].trim() === "return (") console.log(i + 1);
