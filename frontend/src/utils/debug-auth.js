// Debug auth helper - paste this in browser console to check/fix auth

// Get API URL from environment config
const API_URL = window.API_URL || 'http://localhost:8001';

// Check current auth state
function checkAuth() {
  console.log('=== AUTH DEBUG ===');
  console.log('authToken:', localStorage.getItem('authToken'));
  console.log('token:', localStorage.getItem('token'));
  console.log('user:', localStorage.getItem('user'));
  
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const userData = JSON.parse(user);
      console.log('User data:', userData);
    } catch (e) {
      console.log('Failed to parse user data');
    }
  }
}

// Set auth token manually (for testing)
function setAuthToken(token) {
  localStorage.setItem('authToken', token);
  console.log('Auth token set successfully');
}

// Login and set token
async function quickLogin() {
  try {
    const response = await fetch(`${API_URL}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    const data = await response.json();
    if (data.success && data.token) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('Login successful! Token stored.');
      console.log('Now refresh the portfolio page.');
      return data.token;
    } else {
      console.error('Login failed:', data);
    }
  } catch (err) {
    console.error('Login error:', err);
  }
}

// Export for use in console
window.authDebug = {
  check: checkAuth,
  setToken: setAuthToken,
  login: quickLogin
};

console.log('Auth debug tools loaded. Use:');
console.log('- authDebug.check() to check current auth state');
console.log('- authDebug.login() to login and store token');
console.log('- authDebug.setToken(token) to manually set token');