// test-all-routes.ts
// Comprehensive API route tester for Pitchey Platform

const BASE_URL = 'http://localhost:8001';
const DEMO_ACCOUNTS = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
  investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123' },
};

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];
let tokens: Record<string, string> = {};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

async function makeRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string,
  expectedStatus: number = 200
): Promise<TestResult> {
  const startTime = performance.now();
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Math.round(performance.now() - startTime);
    const success = response.status === expectedStatus;
    
    let message = '';
    try {
      const data = await response.json();
      message = data.message || data.error || JSON.stringify(data).slice(0, 100);
    } catch {
      message = await response.text();
    }

    const result: TestResult = {
      endpoint,
      method,
      status: response.status,
      success,
      message: message.slice(0, 100),
      duration,
    };

    results.push(result);
    
    const icon = success ? '✅' : '❌';
    const color = success ? colors.green : colors.red;
    log(color, `${icon} ${method.padEnd(6)} ${endpoint.padEnd(50)} ${response.status} (${duration}ms)`);
    
    return result;

  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    const result: TestResult = {
      endpoint,
      method,
      status: 0,
      success: false,
      message: error.message,
      duration,
    };
    
    results.push(result);
    log(colors.red, `❌ ${method.padEnd(6)} ${endpoint.padEnd(50)} ERROR: ${error.message}`);
    
    return result;
  }
}

async function authenticateAllUsers() {
  log(colors.cyan, '\n🔐 Authenticating all user types...\n');
  
  for (const [userType, credentials] of Object.entries(DEMO_ACCOUNTS)) {
    const result = await makeRequest(
      `/api/auth/${userType}/login`,
      'POST',
      credentials
    );
    
    if (result.success) {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/${userType}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        const data = await response.json();
        tokens[userType] = data.token;
        log(colors.green, `  ✅ ${userType} authenticated`);
      } catch (error) {
        log(colors.red, `  ❌ Failed to extract ${userType} token`);
      }
    }
  }
}

async function testPublicRoutes() {
  log(colors.cyan, '\n📖 Testing Public Routes...\n');
  
  await makeRequest('/api/health', 'GET', null, undefined, 200);
  await makeRequest('/api/pitches/public', 'GET', null, undefined, 200);
  await makeRequest('/api/pitches/trending', 'GET', null, undefined, 200);
  await makeRequest('/api/pitches/featured', 'GET', null, undefined, 200);
  await makeRequest('/api/search/pitches?q=test', 'GET', null, undefined, 200);
}

async function testAuthRoutes() {
  log(colors.cyan, '\n🔐 Testing Authentication Routes...\n');
  
  // Test each portal login
  await makeRequest('/api/auth/creator/login', 'POST', DEMO_ACCOUNTS.creator);
  await makeRequest('/api/auth/investor/login', 'POST', DEMO_ACCOUNTS.investor);
  await makeRequest('/api/auth/production/login', 'POST', DEMO_ACCOUNTS.production);
  
  // Test universal login
  await makeRequest('/api/auth/login', 'POST', DEMO_ACCOUNTS.creator);
  
  // Test logout
  await makeRequest('/api/auth/logout', 'POST', {}, tokens.creator);
  
  // Test profile endpoints
  await makeRequest('/api/auth/profile', 'GET', null, tokens.creator);
}

async function testCreatorRoutes() {
  log(colors.cyan, '\n🎬 Testing Creator Routes...\n');
  
  const token = tokens.creator;
  
  // Dashboard
  await makeRequest('/api/creator/dashboard', 'GET', null, token);
  await makeRequest('/api/creator/stats', 'GET', null, token);
  
  // Pitches
  await makeRequest('/api/creator/pitches', 'GET', null, token);
  await makeRequest('/api/pitches/1', 'GET', null, token);
  
  // Create pitch
  await makeRequest('/api/pitches', 'POST', {
    title: 'Test Pitch ' + Date.now(),
    genre: 'drama',
    format: 'feature',
    logline: 'A compelling test pitch for automated testing',
    shortSynopsis: 'This is a test pitch created by automated testing suite',
    requireNDA: false,
    budgetBracket: 'Medium',
    estimatedBudget: 1000000,
    productionTimeline: '6-12 months',
  }, token, 201);
  
  // Analytics
  await makeRequest('/api/creator/analytics', 'GET', null, token);
  await makeRequest('/api/pitches/1/views', 'GET', null, token);
  await makeRequest('/api/pitches/1/engagement', 'GET', null, token);
}

async function testInvestorRoutes() {
  log(colors.cyan, '\n💰 Testing Investor Routes...\n');
  
  const token = tokens.investor;
  
  // Dashboard
  await makeRequest('/api/investor/dashboard', 'GET', null, token);
  await makeRequest('/api/investor/portfolio', 'GET', null, token);
  
  // Pitch discovery
  await makeRequest('/api/pitches', 'GET', null, token);
  await makeRequest('/api/pitches/1', 'GET', null, token);
  await makeRequest('/api/search/pitches?q=test', 'GET', null, token);
  
  // Watchlist
  await makeRequest('/api/watchlist', 'GET', null, token);
  await makeRequest('/api/watchlist/1', 'POST', {}, token);
  
  // NDA
  await makeRequest('/api/nda/status/1', 'GET', null, token);
}

async function testProductionRoutes() {
  log(colors.cyan, '\n🎥 Testing Production Routes...\n');
  
  const token = tokens.production;
  
  // Dashboard
  await makeRequest('/api/production/dashboard', 'GET', null, token);
  await makeRequest('/api/production/projects', 'GET', null, token);
  
  // Team management
  await makeRequest('/api/production/team', 'GET', null, token);
  
  // Content sourcing
  await makeRequest('/api/pitches', 'GET', null, token);
  await makeRequest('/api/search/pitches?q=action', 'GET', null, token);
}

async function testMessagingRoutes() {
  log(colors.cyan, '\n💬 Testing Messaging Routes...\n');
  
  const token = tokens.creator;
  
  await makeRequest('/api/messages/conversations', 'GET', null, token);
  await makeRequest('/api/messages/unread-count', 'GET', null, token);
}

async function testNotificationRoutes() {
  log(colors.cyan, '\n🔔 Testing Notification Routes...\n');
  
  const token = tokens.creator;
  
  await makeRequest('/api/notifications', 'GET', null, token);
  await makeRequest('/api/notifications/unread', 'GET', null, token);
}

async function generateReport() {
  log(colors.cyan, '\n\n' + '='.repeat(80));
  log(colors.cyan, '📊 TEST RESULTS SUMMARY');
  log(colors.cyan, '='.repeat(80) + '\n');
  
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const passRate = ((passed / total) * 100).toFixed(2);
  
  log(colors.blue, `Total Tests: ${total}`);
  log(colors.green, `Passed: ${passed}`);
  log(colors.red, `Failed: ${failed}`);
  log(colors.yellow, `Pass Rate: ${passRate}%\n`);
  
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.duration, 0) / results.length
  );
  log(colors.blue, `Average Response Time: ${avgDuration}ms\n`);
  
  if (failed > 0) {
    log(colors.red, '\n❌ Failed Tests:\n');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ${r.method.padEnd(6)} ${r.endpoint}`);
        console.log(`  Status: ${r.status} | ${r.message}\n`);
      });
  }
  
  // Group by status code
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  log(colors.blue, '\n📈 Status Code Distribution:\n');
  Object.entries(statusCodes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([code, count]) => {
      const color = code.startsWith('2') ? colors.green :
                    code.startsWith('4') ? colors.yellow :
                    code.startsWith('5') ? colors.red : colors.reset;
      log(color, `  ${code}: ${count} requests`);
    });
  
  // Save report to file
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, passRate, avgDuration },
    statusCodes,
    results,
  };
  
  await Deno.writeTextFile(
    'test-results.json',
    JSON.stringify(report, null, 2)
  );
  
  log(colors.green, '\n✅ Report saved to test-results.json\n');
}

async function runAllTests() {
  log(colors.cyan, '\n🚀 Starting Pitchey Platform Route Tests...\n');
  log(colors.cyan, `Base URL: ${BASE_URL}\n`);
  
  try {
    await authenticateAllUsers();
    await testPublicRoutes();
    await testAuthRoutes();
    await testCreatorRoutes();
    await testInvestorRoutes();
    await testProductionRoutes();
    await testMessagingRoutes();
    await testNotificationRoutes();
    
    await generateReport();
    
  } catch (error: any) {
    log(colors.red, `\n❌ Test suite error: ${error.message}`);
    Deno.exit(1);
  }
}

// Run all tests
if (import.meta.main) {
  runAllTests();
}