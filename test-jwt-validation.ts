// Test JWT validation locally
import { createJWT, verifyJWT, extractJWT } from './src/utils/worker-jwt.ts';

async function testJWT() {
  const jwtSecret = 'vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz';
  
  // Create a test token
  console.log('Creating JWT token...');
  const token = await createJWT({
    sub: '1',
    email: 'alex.creator@demo.com',
    name: 'alex.creator',
    userType: 'creator'
  }, jwtSecret);
  
  console.log('Token created:', token);
  console.log('');
  
  // Test extraction
  console.log('Testing token extraction...');
  const authHeader = `Bearer ${token}`;
  const extracted = extractJWT(authHeader);
  console.log('Extracted token:', extracted === token ? '✅ Matches' : '❌ Does not match');
  console.log('');
  
  // Test verification
  console.log('Testing token verification...');
  const payload = await verifyJWT(token, jwtSecret);
  
  if (payload) {
    console.log('✅ Token verified successfully!');
    console.log('Payload:', JSON.stringify(payload, null, 2));
  } else {
    console.log('❌ Token verification failed');
  }
  
  // Test with wrong secret
  console.log('');
  console.log('Testing with wrong secret...');
  const wrongPayload = await verifyJWT(token, 'wrong-secret');
  if (wrongPayload) {
    console.log('❌ Token verified with wrong secret (should not happen)');
  } else {
    console.log('✅ Token correctly rejected with wrong secret');
  }
  
  // Test with malformed token
  console.log('');
  console.log('Testing with malformed token...');
  const malformedPayload = await verifyJWT('malformed.token.here', jwtSecret);
  if (malformedPayload) {
    console.log('❌ Malformed token verified (should not happen)');
  } else {
    console.log('✅ Malformed token correctly rejected');
  }
}

testJWT().catch(console.error);