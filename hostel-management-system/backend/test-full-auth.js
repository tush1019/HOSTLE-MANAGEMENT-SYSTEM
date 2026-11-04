const http = require('http');

// Step 1: Register - generate OTP
const body1 = JSON.stringify({ name: 'Test Student', email: 'studytest2@example.com', password: 'password123' });
const options1 = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body1)
  }
};

const req1 = http.request(options1, (res1) => {
  let data1 = '';
  res1.on('data', (chunk) => data1 += chunk);
  res1.on('end', () => {
    console.log('Step 1 Register Status:', res1.statusCode);
    console.log('Step 1 Register Response:', data1);
    
    // Parse OTP from response
    const resp1 = JSON.parse(data1);
    if (!resp1.success) {
      console.log('Registration failed, exiting');
      process.exit(1);
    }
    const otp = resp1.devOtp || resp1.otp;
    console.log('Using OTP:', otp);
    
    // Step 2: Verify OTP
    const body2 = JSON.stringify({ email: 'studytest2@example.com', otp: otp });
    const options2 = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/verify-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body2)
      }
    };
    
    const req2 = http.request(options2, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => data2 += chunk);
      res2.on('end', () => {
        console.log('Verify OTP Status:', res2.statusCode);
        console.log('Verify OTP Response:', data2);
        
        // Step 3: Login
        const body3 = JSON.stringify({ email: 'studytest2@example.com', password: 'password123' });
        const options3 = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        };
        
        const req3 = http.request(options3, (res3) => {
          let data3 = '';
          res3.on('data', (chunk) => data3 += chunk);
          res3.on('end', () => {
            console.log('Login Status:', res3.statusCode);
            console.log('Login Response:', data3);
            console.log('\n=== Full auth flow test completed ===');
            process.exit(0);
          });
          req3.on('error', (e) => console.error('Request error:', e.message));
        });
        
        req3.write(body3);
        req3.end();
      });
      req2.on('error', (e) => console.error('Request error:', e.message));
    });
    
    req2.write(body2);
    req2.end();
  });
  req1.on('error', (e) => console.error('Request error:', e.message));
});

req1.write(body1);
req1.end();