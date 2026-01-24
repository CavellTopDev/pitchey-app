/**
 * Authenticated Route Testing Script
 * Logs in via Better Auth and tests sidebar routes with valid session
 * Run with: bun run scripts/test-authenticated-routes.ts
 */

const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const FRONTEND_ORIGIN = 'https://pitchey-5o8.pages.dev';

// Test credentials - use a test account
const TEST_CREDENTIALS = {
  email: 'test@pitchey.com',
  password: 'TestPassword123!'
};

interface LoginResponse {
  success: boolean;
  data?: {
    user: any;
    session: any;
  };
  error?: any;
}

async function login(): Promise<string | null> {
  console.log('🔐 Attempting to log in...');

  try {
    const response = await fetch(`${API_BASE}/api/auth/sign-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': FRONTEND_ORIGIN,
      },
      body: JSON.stringify({
        email: TEST_CREDENTIALS.email,
        password: TEST_CREDENTIALS.password,
      }),
    });

    // Get session cookie from response
    const setCookie = response.headers.get('set-cookie');

    if (response.ok && setCookie) {
      // Extract the session token from set-cookie header
      const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) {
        console.log('✅ Login successful, got session token');
        return `better-auth.session_token=${match[1]}`;
      }
    }

    const body = await response.json() as LoginResponse;
    console.log('❌ Login failed:', body.error || 'Unknown error');
    console.log('   Status:', response.status);
    return null;
  } catch (error) {
    console.log('❌ Login error:', error);
    return null;
  }
}

async function testRoute(endpoint: string, cookie: string): Promise<{ status: number; success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Origin': FRONTEND_ORIGIN,
      },
    });

    return {
      status: response.status,
      success: response.status >= 200 && response.status < 400
    };
  } catch (error) {
    return { status: 0, success: false };
  }
}

async function runTests() {
  console.log('🧪 Authenticated Route Testing Script');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Try to login
  const sessionCookie = await login();

  if (!sessionCookie) {
    console.log('\n⚠️  Could not authenticate. Testing without session to verify 401 behavior...\n');
  }

  // Sample routes to test (one from each category)
  const testRoutes = [
    // Production Portal
    { name: 'Production Dashboard', endpoint: '/api/production/dashboard' },
    { name: 'Production Activity', endpoint: '/api/production/activity' },
    { name: 'Production Stats', endpoint: '/api/production/stats' },

    // Investor Portal
    { name: 'Investor Dashboard', endpoint: '/api/investor/dashboard' },
    { name: 'Investor Deals', endpoint: '/api/investor/deals' },
    { name: 'Investor Portfolio', endpoint: '/api/investor/portfolio' },

    // Creator Portal
    { name: 'Creator Dashboard', endpoint: '/api/creator/dashboard' },
    { name: 'Creator Activity', endpoint: '/api/creator/activity' },
    { name: 'Creator Pitches', endpoint: '/api/creator/pitches' },

    // Common Routes
    { name: 'User Settings', endpoint: '/api/user/settings' },
    { name: 'User Following', endpoint: '/api/user/following' },
    { name: 'Teams Roles', endpoint: '/api/teams/roles' },

    // Public Routes (should work without auth)
    { name: 'Pitches Browse (Public)', endpoint: '/api/pitches/browse' },
    { name: 'Pitches Discover (Public)', endpoint: '/api/pitches/discover' },
    { name: 'Health Check', endpoint: '/api/health' },
  ];

  console.log('Testing routes...\n');

  let passed = 0;
  let failed = 0;

  for (const route of testRoutes) {
    const result = await testRoute(route.endpoint, sessionCookie || '');
    const icon = result.success ? '✅' : '❌';
    const status = result.status === 401 ? '401 (Auth Required)' :
                   result.status === 404 ? '404 (Not Found)' :
                   result.status === 200 ? '200 (OK)' :
                   `${result.status}`;

    console.log(`${icon} ${route.name.padEnd(30)} ${status}`);

    if (result.success) passed++;
    else failed++;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);

  if (!sessionCookie) {
    console.log('\n📝 Note: Testing without authentication.');
    console.log('   - 401 responses are EXPECTED for protected routes');
    console.log('   - 200 responses for public routes confirm they work');
    console.log('   - 404 responses indicate missing endpoints (bugs)');
  }

  // Check for any 404s - these are real bugs
  console.log('\n🔍 Checking for 404 errors (missing endpoints)...');
  let has404 = false;
  for (const route of testRoutes) {
    const result = await testRoute(route.endpoint, sessionCookie || '');
    if (result.status === 404) {
      console.log(`   ⚠️  ${route.name}: ${route.endpoint} returns 404`);
      has404 = true;
    }
  }

  if (!has404) {
    console.log('   ✅ No 404 errors found - all endpoints are registered!');
  }
}

runTests();
