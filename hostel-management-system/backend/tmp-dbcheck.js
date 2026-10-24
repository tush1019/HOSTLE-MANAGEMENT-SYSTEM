const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  try {
    const c = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "hostel_management",
    });
    const [u] = await c.query("SELECT COUNT(*) AS c FROM users");
    console.log("MySQL OK. users =", u[0].c);
    const [t] = await c.query("SHOW TABLES");
    console.log("tables:", t.map((x) => Object.values(x)[0]).join(", "));
    const [s] = await c.query("SELECT id, name, email, role FROM users LIMIT 20");
    console.log("user rows:", JSON.stringify(s));
    const [sv] = await c.query("SELECT category, COUNT(*) c FROM hostel_services GROUP BY category");
    console.log("services by category:", JSON.stringify(sv));
    await c.end();
  } catch (e) {
    console.log("MySQL FAIL:", e.message);
  }
  process.exit(0);
})();
