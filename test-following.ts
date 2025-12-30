import * as jwt from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const JWT_SECRET = 'vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz';

// Create a valid creator token
const payload = {
  sub: '1',
  username: 'alex.creator', 
  email: 'alex.creator@demo.com',
  userType: 'creator',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

const token = await jwt.create({ alg: "HS256", typ: "JWT" }, payload, key);

console.log('Testing with token:', token.substring(0, 50) + '...');

// Test the endpoint
const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/creator/following?tab=activity', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

console.log('Status:', response.status);
const text = await response.text();
console.log('Response:', text);

try {
  const json = JSON.parse(text);
  console.log('Parsed response:', JSON.stringify(json, null, 2));
} catch (e) {
  console.log('Raw response:', text);
}
