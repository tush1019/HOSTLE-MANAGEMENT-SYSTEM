const fs = require("fs");
const files = [
  "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/premium-global-redesign.css",
  "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/rooms-premium.css",
  "c:/Users/tusha/OneDrive/Desktop/HOSTEL MANAGEMENT SYSTEM/hostel-management-system/src/student-profile-premium.css",
];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  let depth = 0, min = 0;
  for (const ch of s) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < min) min = depth;
  }
  console.log(f.split("/").pop(), "final depth:", depth, "min:", min);
}
