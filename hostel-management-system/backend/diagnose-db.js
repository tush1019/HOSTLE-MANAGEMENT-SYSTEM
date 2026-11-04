/**
 * Diagnostic script to check Aiven MySQL database tables
 * Reads configuration from existing environment variables
 * Does NOT print any credentials
 *
 * Usage for Aiven production diagnostic:
 *   node diagnose-db.js        # uses local .env (localhost)
 *   node diagnose-db.js aiven  # uses .env.aiven.local for Aiven connection
 *   node diagnose-db.js prod   # same as aiven (loads .env.aiven.local)
 *
 * The .env.aiven.local file must exist in the same directory and contain:
 # AIVEN_MYSQL_HOST, AIVEN_MYSQL_PORT, AIVEN_MYSQL_USER,
 # AIVEN_MYSQL_DATABASE, AIVEN_MYSQL_SSL (true/false)
 * Password is read from AIVEN_MYSQL_PASSWORD environment variable (NOT stored in file)
 */
require('dotenv').config();

// Load Aiven config file if it exists (for production diagnostics)
if (process.argv[2] === 'aiven' || process.argv[2] === 'prod') {
  require('dotenv').config({ path: './.env.aiven.local' });
}

async function runDiagnostic() {
  const mode = process.argv[2] || '';
  if (mode === 'aiven' || mode === 'prod') {
    const aivenHost = process.env.AIVEN_MYSQL_HOST;
    const aivenPort = process.env.AIVEN_MYSQL_PORT || '28490';
    const aivenUser = process.env.AIVEN_MYSQL_USER || 'avnadmin';
    const aivenDatabase = process.env.AIVEN_MYSQL_DATABASE || 'defaultdb';
    const aivenSsl = process.env.AIVEN_MYSQL_SSL === 'true';
    const aivenPassword = process.env.AIVEN_MYSQL_PASSWORD;
    if (!aivenHost) {
      console.error('❌ AIVEN_MYSQL_HOST not set. Set AIVEN_MYSQL_HOST environment variable or use .env.aiven.local');
      process.exit(1);
    }
    console.log('=== Aiven MySQL Production Diagnostics ===');
    console.log('Host: ' + aivenHost);
    console.log('Port: ' + aivenPort);
    console.log('User: ' + aivenUser);
    console.log('Database: ' + aivenDatabase);
    console.log('SSL: ' + aivenSsl);
    const sslConfig = aivenSsl ? { rejectUnauthorized: false } : false;
    let connection;
    try {
      connection = await require('mysql2/promise').createConnection({
        host: aivenHost,
        port: parseInt(aivenPort, 10),
        user: aivenUser,
        password: aivenPassword,
        database: aivenDatabase,
        ssl: sslConfig
      });
      console.log('✅ Aiven Connection successful!');
      const [rows] = await connection.execute('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
      console.log('');
      console.log('Tables in database "' + aivenDatabase + '":');
      console.log('');
      if (rows.length === 0) { console.log('(No tables found)'); }
      else { rows.forEach(row => console.log('• ' + row.TABLE_NAME)); }
      console.log('');
      console.log('Total tables:', rows.length);
    } catch (error) {
      console.error('❌ Aiven Connection failed:', error.message);
      console.error('To set Aiven password securely: set AIVEN_MYSQL_PASSWORD=your_password');
      process.exit(1);
    } finally { if (connection) { await connection.end(); } }
  } else {
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || 3306;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME;
    const sslConfig = dbHost && !dbHost.includes('localhost') ? { rejectUnauthorized: false } : false;
    console.log('=== Database Diagnostics (Local Mode) ===');
    console.log('Host:', dbHost);
    console.log('Database:', dbName);
    let connection;
    try {
      connection = await require('mysql2/promise').createConnection({ host: dbHost, port: parseInt(dbPort, 10), user: dbUser, password: dbPassword, database: dbName, ssl: sslConfig });
      console.log('✅ Connection successful!');
      const [rows] = await connection.execute('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
      console.log('');
      console.log('Tables in database "' + dbName + '":');
      console.log('');
      if (rows.length === 0) { console.log('(No tables found)'); }
      else { rows.forEach(row => console.log('• ' + row.TABLE_NAME)); }
      console.log('');
      console.log('Total tables:', rows.length);
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      process.exit(1);
    } finally { if (connection) { await connection.end(); } }
  }
}
runDiagnostic();