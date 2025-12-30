const jwt = require('jsonwebtoken');

const JWT_SECRET = 'vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz';

// Create a valid creator token
const token = jwt.sign({
  sub: '1',
  username: 'alex.creator',
  email: 'alex.creator@demo.com',
  userType: 'creator',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
}, JWT_SECRET);

console.log('Token:', token);

// Test the endpoint
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/creator/following?tab=activity', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.text())
.then(text => {
  console.log('Response:', text);
  try {
    const json = JSON.parse(text);
    console.log('Parsed:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('Not JSON:', text);
  }
})
.catch(err => console.error('Error:', err));
