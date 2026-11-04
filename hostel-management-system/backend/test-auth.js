const http = require('http');

const body = JSON.stringify({ name: 'Test User', email: 'testuser@example.com', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Register Status: ${res.statusCode}`);
    console.log(`Register Response: ${data}`);
    
    // Now try login
    const loginBody = JSON.stringify({ email: 'testuser@example.com', password: 'password123' });
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginBody)
      }
    };
    
    const loginReq = http.request(loginOptions, (loginRes) => {
      let loginData = '';
      loginRes.on('data', (chunk) => loginData += chunk);
      loginRes.on('end', () => {
        console.log(`Login Status: ${loginRes.statusCode}`);
        console.log(`Login Response: ${loginData}`);
        loginReq.destroy();
        process.exit(0);
      });
    });
    
    loginReq.on('error', (e) => console.error(`Login request error: ${e.message}`));
    loginReq.write(loginBody);
    loginReq.end();
    
    req.destroy();
  });
});

req.on('error', (e) => console.error(`Request error: ${e.message}`));
req.write(body);
req.end();