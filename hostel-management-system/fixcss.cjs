const fs = require("fs");
const p = "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/premium-global-redesign.css";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
// insert "}" after index 258 (line 259)
lines.splice(259, 0, "}");
fs.writeFileSync(p, lines.join("\n"));
console.log("done");
