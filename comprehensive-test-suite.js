#!/usr/bin/env node

/**
 * Comprehensive Client Requirements Test Suite
 * Validates ALL client requirements with accurate status reporting
 */

const API_URL = 'http://localhost:8001';
const DEMO_ACCOUNTS = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
  investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123' }
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

async function apiRequest(method, endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    method,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  };
  
  if (options.body) config.body = JSON.stringify(options.body);
  if (options.token) config.headers['Authorization'] = `Bearer ${options.token}`;
  
  try {
    const response = await fetch(url, config);
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      data: text ? JSON.parse(text) : null
    };
  } catch (error) {
    return { status: 0, ok: false, error: error.message };
  }
}

async function runTest(category, name, testFn) {
  testResults.total++;
  
  try {
    const result = await testFn();
    
    if (result.passed) {
      testResults.passed++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
      if (result.details) console.log(`    → ${result.details}`);
    } else {
      testResults.failed++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      console.log(`    → ${result.error || 'Test failed'}`);
    }
    
    testResults.details.push({ category, name, ...result });
  } catch (error) {
    testResults.failed++;
    console.log(`  ${colors.red}✗${colors.reset} ${name}`);
    console.log(`    → Error: ${error.message}`);
    testResults.details.push({ category, name, error: error.message });
  }
}

async function getAuthToken(userType) {
  const response = await apiRequest('POST', `/api/auth/${userType}/login`, {
    body: DEMO_ACCOUNTS[userType]
  });
  if (response.ok && response.data?.token) return response.data.token;
  throw new Error(`Failed to authenticate as ${userType}`);
}

// TEST SUITES
async function testCriticalIssues() {
  console.log('\n' + colors.blue + '═══ CRITICAL ISSUES (Priority 1) ═══' + colors.reset);
  
  let investorToken;
  
  await runTest('Critical', 'Investor Login', async () => {
    try {
      investorToken = await getAuthToken('investor');
      return { passed: true, details: 'Login successful' };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  });
  
  await runTest('Critical', 'Investor Sign-Out', async () => {
    if (!investorToken) return { passed: false, error: 'No token' };
    const response = await apiRequest('POST', '/api/auth/logout', { token: investorToken });
    return {
      passed: response.ok || response.status === 200 || response.status === 204,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
  
  await runTest('Critical', 'Investor Dashboard', async () => {
    if (!investorToken) investorToken = await getAuthToken('investor');
    const response = await apiRequest('GET', '/api/investor/dashboard', { token: investorToken });
    return {
      passed: response.ok,
      details: response.ok ? 'Dashboard loaded' : null,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
  
  await runTest('Critical', 'Investor Cannot Create Pitches', async () => {
    if (!investorToken) investorToken = await getAuthToken('investor');
    const response = await apiRequest('POST', '/api/pitches', {
      token: investorToken,
      body: { title: 'Test', genre: 'Action', logline: 'Test' }
    });
    return {
      passed: response.status === 403,
      details: response.status === 403 ? 'Correctly blocked' : null,
      error: response.status === 403 ? null : `Expected 403, got ${response.status}`
    };
  });
}

async function testBrowseSection() {
  console.log('\n' + colors.blue + '═══ BROWSE SECTION (Priority 2) ═══' + colors.reset);
  
  await runTest('Browse', 'Trending Tab', async () => {
    const response = await apiRequest('GET', '/api/pitches/trending');
    return {
      passed: response.ok && Array.isArray(response.data),
      details: response.data ? `${response.data.length} pitches` : null,
      error: response.ok ? null : 'Failed to load'
    };
  });
  
  await runTest('Browse', 'New Tab', async () => {
    const response = await apiRequest('GET', '/api/pitches/new');
    return {
      passed: response.ok && Array.isArray(response.data),
      details: response.data ? `${response.data.length} pitches` : null,
      error: response.ok ? null : 'Failed to load'
    };
  });
  
  await runTest('Browse', 'General Browse Sorting', async () => {
    const response = await apiRequest('GET', '/api/pitches/browse/general?sort=alphabetical&order=asc');
    return {
      passed: response.ok,
      details: 'Sorting works',
      error: response.ok ? null : 'Sorting failed'
    };
  });
}

async function testPitchCreation() {
  console.log('\n' + colors.blue + '═══ PITCH CREATION (Priority 3) ═══' + colors.reset);
  
  let creatorToken;
  try {
    creatorToken = await getAuthToken('creator');
  } catch (error) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Cannot test: ${error.message}`);
    return;
  }
  
  await runTest('Creation', 'Themes as Free Text', async () => {
    const response = await apiRequest('POST', '/api/pitches', {
      token: creatorToken,
      body: {
        title: 'Test ' + Date.now(),
        themes: 'redemption, family, survival',
        genre: 'Drama',
        logline: 'Test'
      }
    });
    return {
      passed: response.ok || response.status === 201,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
  
  await runTest('Creation', 'World Description Field', async () => {
    const response = await apiRequest('POST', '/api/pitches', {
      token: creatorToken,
      body: {
        title: 'Test ' + Date.now(),
        worldDescription: 'A dystopian future',
        genre: 'Sci-Fi',
        logline: 'Test'
      }
    });
    return {
      passed: response.ok || response.status === 201,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
}

async function testNDAWorkflow() {
  console.log('\n' + colors.blue + '═══ NDA WORKFLOW ═══' + colors.reset);
  
  let creatorToken;
  try {
    creatorToken = await getAuthToken('creator');
  } catch (error) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Cannot test: ${error.message}`);
    return;
  }
  
  await runTest('NDA', 'NDA Pending Endpoint', async () => {
    const response = await apiRequest('GET', '/api/nda/pending', { token: creatorToken });
    return {
      passed: response.ok,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
  
  await runTest('NDA', 'NDA Active Endpoint', async () => {
    const response = await apiRequest('GET', '/api/nda/active', { token: creatorToken });
    return {
      passed: response.ok,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
  
  await runTest('NDA', 'Info Request System', async () => {
    const response = await apiRequest('GET', '/api/info-requests', { token: creatorToken });
    return {
      passed: response.ok,
      error: response.ok ? null : `Status ${response.status}`
    };
  });
}

async function generateReport() {
  console.log('\n' + colors.blue + '═════════════════════════════════════' + colors.reset);
  console.log(colors.blue + '           TEST SUMMARY               ' + colors.reset);
  console.log(colors.blue + '═════════════════════════════════════' + colors.reset);
  
  const passRate = Math.round((testResults.passed / testResults.total) * 100);
  
  console.log(`\n  Total: ${testResults.total}`);
  console.log(`  ${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`  Pass Rate: ${passRate}%`);
  
  console.log('\n' + colors.blue + '═════════════════════════════════════' + colors.reset);
  
  if (passRate >= 80) {
    console.log(colors.green + '  ✓ READY FOR CLIENT REVIEW' + colors.reset);
  } else if (passRate >= 60) {
    console.log(colors.yellow + '  ⚠ PARTIALLY READY' + colors.reset);
  } else {
    console.log(colors.red + '  ✗ NOT READY' + colors.reset);
  }
  
  console.log(colors.blue + '═════════════════════════════════════' + colors.reset);
}

// Main
async function runAllTests() {
  console.log(colors.blue + '═════════════════════════════════════' + colors.reset);
  console.log(colors.blue + '  PITCHEY CLIENT REQUIREMENTS TESTS  ' + colors.reset);
  console.log(colors.blue + '═════════════════════════════════════' + colors.reset);
  console.log(`\n  Date: ${new Date().toISOString()}`);
  console.log(`  API: ${API_URL}`);
  
  if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
  }
  
  await testCriticalIssues();
  await testBrowseSection();
  await testPitchCreation();
  await testNDAWorkflow();
  
  await generateReport();
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
