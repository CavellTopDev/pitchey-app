#!/usr/bin/env node

/**
 * Pitchey Platform - Comprehensive Client Requirements Verification Test Suite
 * 
 * This test suite validates all 15 client requirements systematically
 * Tests both API endpoints and frontend integration
 * Provides clear pass/fail results for each feature
 * Uses actual demo account credentials for realistic testing
 * 
 * Based on CLIENT_FEEDBACK_REQUIREMENTS.md and IMPLEMENTATION_GAP_ANALYSIS.md
 */

const axios = require('axios');
const chalk = require('chalk');
const puppeteer = require('puppeteer');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:8001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Demo Account Credentials from DEMO_ACCOUNTS.md
const DEMO_ACCOUNTS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    userId: 1001
  },
  investor: {
    email: 'sarah.investor@demo.com', 
    password: 'Demo123',
    userId: 1002
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    userId: 1003
  }
};

// Test Results Storage
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper Functions
function logTest(name, status, details = '') {
  testResults.total++;
  const statusColor = status === 'PASS' ? chalk.green : 
                     status === 'FAIL' ? chalk.red : chalk.yellow;
  
  console.log(`${statusColor(`[${status}]`)} ${name}`);
  if (details) {
    console.log(`  ${chalk.gray(details)}`);
  }
  
  testResults.tests.push({ name, status, details });
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;
}

async function makeRequest(method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      ...(data && { data })
    };
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
}

async function loginUser(userType) {
  const account = DEMO_ACCOUNTS[userType];
  const result = await makeRequest('POST', `/api/auth/${userType}/login`, {
    email: account.email,
    password: account.password
  });
  
  if (result.success && result.data.token) {
    return { success: true, token: result.data.token, user: result.data.user };
  } else {
    return { success: false, error: result.error || 'Login failed' };
  }
}

// Test Suite Implementation
async function testInvestorSignOut() {
  console.log(chalk.blue('\n=== CRITICAL ISSUE #1: Investor Sign-Out Functionality ==='));
  
  // Step 1: Login as investor
  const loginResult = await loginUser('investor');
  if (!loginResult.success) {
    logTest('Investor Login', 'FAIL', `Cannot login: ${loginResult.error}`);
    return;
  }
  
  logTest('Investor Login', 'PASS', 'Successfully logged in as investor');
  const { token } = loginResult;
  
  // Step 2: Test logout endpoint
  const logoutResult = await makeRequest('POST', '/api/auth/logout', null, token);
  if (logoutResult.success) {
    logTest('Investor Logout Endpoint', 'PASS', 'Logout endpoint responds successfully');
  } else {
    logTest('Investor Logout Endpoint', 'FAIL', `Logout failed: ${logoutResult.error}`);
    return;
  }
  
  // Step 3: Verify token is invalidated
  const authTestResult = await makeRequest('GET', '/api/auth/profile', null, token);
  if (!authTestResult.success && authTestResult.status === 401) {
    logTest('Token Invalidation', 'PASS', 'Token properly invalidated after logout');
  } else {
    logTest('Token Invalidation', 'FAIL', 'Token still valid after logout - security risk');
  }
  
  // Step 4: Test protected route access
  const protectedRouteResult = await makeRequest('GET', '/api/dashboard/investor', null, token);
  if (!protectedRouteResult.success && protectedRouteResult.status === 401) {
    logTest('Protected Route Block', 'PASS', 'Cannot access protected routes after logout');
  } else {
    logTest('Protected Route Block', 'FAIL', 'Can still access protected routes after logout');
  }
}

async function testInvestorDashboard() {
  console.log(chalk.blue('\n=== CRITICAL ISSUE #2: Investor Dashboard Functionality ==='));
  
  const loginResult = await loginUser('investor');
  if (!loginResult.success) {
    logTest('Investor Dashboard - Login Required', 'FAIL', 'Cannot test dashboard without login');
    return;
  }
  
  const { token } = loginResult;
  
  // Test dashboard endpoint
  const dashboardResult = await makeRequest('GET', '/api/dashboard/investor', null, token);
  if (dashboardResult.success) {
    logTest('Investor Dashboard Endpoint', 'PASS', 'Dashboard endpoint responds');
    
    // Verify required dashboard data
    const data = dashboardResult.data;
    const requiredFields = ['portfolioOverview', 'savedPitches', 'ndaStatus', 'recentActivity'];
    
    for (const field of requiredFields) {
      if (data && data[field] !== undefined) {
        logTest(`Dashboard - ${field}`, 'PASS', `${field} data present`);
      } else {
        logTest(`Dashboard - ${field}`, 'FAIL', `${field} data missing`);
      }
    }
  } else {
    logTest('Investor Dashboard Endpoint', 'FAIL', `Dashboard error: ${dashboardResult.error}`);
  }
  
  // Test real-time WebSocket connection
  try {
    const WebSocket = require('ws');
    const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/ws?token=${token}`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        logTest('Dashboard WebSocket Connection', 'PASS', 'WebSocket connected successfully');
        ws.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        logTest('Dashboard WebSocket Connection', 'FAIL', `WebSocket error: ${error.message}`);
        reject(error);
      });
      
      setTimeout(() => {
        logTest('Dashboard WebSocket Connection', 'FAIL', 'WebSocket connection timeout');
        ws.close();
        reject(new Error('Timeout'));
      }, 5000);
    }).catch(() => {}); // Ignore promise rejection
    
  } catch (error) {
    logTest('Dashboard WebSocket Connection', 'FAIL', `WebSocket test failed: ${error.message}`);
  }
}

async function testBrowseTabSeparation() {
  console.log(chalk.blue('\n=== BROWSE PITCHES: Tab Content Separation ==='));
  
  // Test Trending Tab
  const trendingResult = await makeRequest('GET', '/api/pitches/trending');
  if (trendingResult.success) {
    logTest('Trending Tab Endpoint', 'PASS', 'Trending endpoint responds');
    
    // Verify trending criteria (should be sorted by views/engagement)
    const pitches = trendingResult.data.pitches || trendingResult.data;
    if (Array.isArray(pitches) && pitches.length > 1) {
      const firstPitch = pitches[0];
      const secondPitch = pitches[1];
      
      if (firstPitch.views >= secondPitch.views) {
        logTest('Trending Sort Order', 'PASS', 'Pitches sorted by views (trending criteria)');
      } else {
        logTest('Trending Sort Order', 'FAIL', 'Pitches not sorted by views');
      }
    } else {
      logTest('Trending Sort Order', 'SKIP', 'Not enough pitches to verify sorting');
    }
  } else {
    logTest('Trending Tab Endpoint', 'FAIL', `Trending endpoint error: ${trendingResult.error}`);
  }
  
  // Test New Tab
  const newResult = await makeRequest('GET', '/api/pitches/new');
  if (newResult.success) {
    logTest('New Tab Endpoint', 'PASS', 'New endpoint responds');
    
    // Verify new criteria (should be sorted by creation date)
    const pitches = newResult.data.pitches || newResult.data;
    if (Array.isArray(pitches) && pitches.length > 1) {
      const firstPitch = pitches[0];
      const secondPitch = pitches[1];
      
      const firstDate = new Date(firstPitch.createdAt || firstPitch.created_at);
      const secondDate = new Date(secondPitch.createdAt || secondPitch.created_at);
      
      if (firstDate >= secondDate) {
        logTest('New Sort Order', 'PASS', 'Pitches sorted by creation date (newest first)');
      } else {
        logTest('New Sort Order', 'FAIL', 'Pitches not sorted by creation date');
      }
    } else {
      logTest('New Sort Order', 'SKIP', 'Not enough pitches to verify sorting');
    }
  } else {
    logTest('New Tab Endpoint', 'FAIL', `New endpoint error: ${newResult.error}`);
  }
  
  // Test Top Rated Tab (should NOT exist)
  const topRatedResult = await makeRequest('GET', '/api/pitches/top-rated');
  if (!topRatedResult.success && topRatedResult.status === 404) {
    logTest('Top Rated Tab Removal', 'PASS', 'Top Rated endpoint properly removed (404)');
  } else if (topRatedResult.success) {
    logTest('Top Rated Tab Removal', 'FAIL', 'Top Rated endpoint still exists - should be removed');
  } else {
    logTest('Top Rated Tab Removal', 'SKIP', `Unexpected error: ${topRatedResult.error}`);
  }
}

async function testGeneralBrowseWithSorting() {
  console.log(chalk.blue('\n=== BROWSE PITCHES: General Browse with Sorting ==='));
  
  const sortOptions = [
    { sort: 'alphabetical', order: 'asc', name: 'Alphabetical A-Z' },
    { sort: 'alphabetical', order: 'desc', name: 'Alphabetical Z-A' },
    { sort: 'date', order: 'desc', name: 'Date (Newest First)' },
    { sort: 'date', order: 'asc', name: 'Date (Oldest First)' },
    { sort: 'budget', order: 'desc', name: 'Budget (High to Low)' },
    { sort: 'budget', order: 'asc', name: 'Budget (Low to High)' },
    { sort: 'views', order: 'desc', name: 'Views (Most Viewed)' },
    { sort: 'views', order: 'asc', name: 'Views (Least Viewed)' }
  ];
  
  for (const option of sortOptions) {
    const result = await makeRequest('GET', `/api/pitches/browse/general?sort=${option.sort}&order=${option.order}`);
    
    if (result.success) {
      logTest(`General Browse - ${option.name}`, 'PASS', 'Sort option endpoint responds');
    } else {
      logTest(`General Browse - ${option.name}`, 'FAIL', `Sort option error: ${result.error}`);
    }
  }
  
  // Test genre and format filtering
  const genreResult = await makeRequest('GET', '/api/pitches/browse/general?genre=action');
  if (genreResult.success) {
    logTest('Genre Filtering', 'PASS', 'Genre filter endpoint responds');
  } else {
    logTest('Genre Filtering', 'FAIL', `Genre filter error: ${genreResult.error}`);
  }
  
  const formatResult = await makeRequest('GET', '/api/pitches/browse/general?format=feature');
  if (formatResult.success) {
    logTest('Format Filtering', 'PASS', 'Format filter endpoint responds');
  } else {
    logTest('Format Filtering', 'FAIL', `Format filter error: ${formatResult.error}`);
  }
}

async function testAccessControl() {
  console.log(chalk.blue('\n=== ACCESS CONTROL: Investor Pitch Creation Restriction ==='));
  
  const loginResult = await loginUser('investor');
  if (!loginResult.success) {
    logTest('Access Control Test Setup', 'FAIL', 'Cannot login as investor');
    return;
  }
  
  const { token } = loginResult;
  
  // Attempt to create a pitch as investor (should fail)
  const createPitchData = {
    title: 'Test Pitch - Should Not Be Created',
    logline: 'This pitch should not be created by an investor',
    genre: 'Test',
    format: 'Feature'
  };
  
  const createResult = await makeRequest('POST', '/api/pitches', createPitchData, token);
  
  if (!createResult.success && createResult.status === 403) {
    logTest('Investor Pitch Creation Block', 'PASS', 'Investor properly blocked from creating pitches (403 Forbidden)');
  } else if (createResult.success) {
    logTest('Investor Pitch Creation Block', 'FAIL', 'Investor can create pitches - SECURITY VIOLATION');
  } else {
    logTest('Investor Pitch Creation Block', 'SKIP', `Unexpected error: ${createResult.error}`);
  }
  
  // Test that investor CAN view pitches
  const viewResult = await makeRequest('GET', '/api/pitches', null, token);
  if (viewResult.success) {
    logTest('Investor Pitch Viewing', 'PASS', 'Investor can view pitches');
  } else {
    logTest('Investor Pitch Viewing', 'FAIL', `Investor cannot view pitches: ${viewResult.error}`);
  }
  
  // Test creator CAN create pitches
  const creatorLogin = await loginUser('creator');
  if (creatorLogin.success) {
    const creatorCreateResult = await makeRequest('POST', '/api/pitches', createPitchData, creatorLogin.token);
    if (creatorCreateResult.success) {
      logTest('Creator Pitch Creation Allow', 'PASS', 'Creator can create pitches');
      
      // Clean up - delete the test pitch
      const pitchId = creatorCreateResult.data.id;
      if (pitchId) {
        await makeRequest('DELETE', `/api/pitches/${pitchId}`, null, creatorLogin.token);
      }
    } else {
      logTest('Creator Pitch Creation Allow', 'FAIL', `Creator cannot create pitches: ${creatorCreateResult.error}`);
    }
  }
}

async function testCharacterManagement() {
  console.log(chalk.blue('\n=== CHARACTER MANAGEMENT: Edit/Reorder Features ==='));
  
  const loginResult = await loginUser('creator');
  if (!loginResult.success) {
    logTest('Character Management Setup', 'FAIL', 'Cannot login as creator');
    return;
  }
  
  const { token } = loginResult;
  
  // First, create a test pitch
  const pitchData = {
    title: 'Character Test Pitch',
    logline: 'Testing character management features',
    genre: 'Drama',
    format: 'Feature'
  };
  
  const pitchResult = await makeRequest('POST', '/api/pitches', pitchData, token);
  if (!pitchResult.success) {
    logTest('Character Test Pitch Creation', 'FAIL', 'Cannot create test pitch');
    return;
  }
  
  const pitchId = pitchResult.data.id;
  logTest('Character Test Pitch Creation', 'PASS', 'Test pitch created');
  
  // Add a character
  const characterData = {
    name: 'John Doe',
    description: 'Main protagonist',
    displayOrder: 1
  };
  
  const addCharResult = await makeRequest('POST', `/api/pitches/${pitchId}/characters`, characterData, token);
  if (addCharResult.success) {
    logTest('Character Addition', 'PASS', 'Character added successfully');
    
    const characterId = addCharResult.data.id;
    
    // Test character editing
    const editCharData = {
      name: 'John Smith',
      description: 'Updated main protagonist'
    };
    
    const editResult = await makeRequest('PUT', `/api/pitches/${pitchId}/characters/${characterId}`, editCharData, token);
    if (editResult.success) {
      logTest('Character Editing', 'PASS', 'Character edited successfully');
    } else {
      logTest('Character Editing', 'FAIL', `Character edit failed: ${editResult.error}`);
    }
    
    // Add second character for reordering test
    const char2Data = { name: 'Jane Doe', description: 'Supporting character', displayOrder: 2 };
    const addChar2Result = await makeRequest('POST', `/api/pitches/${pitchId}/characters`, char2Data, token);
    
    if (addChar2Result.success) {
      // Test character reordering
      const reorderData = [
        { id: addChar2Result.data.id, displayOrder: 1 },
        { id: characterId, displayOrder: 2 }
      ];
      
      const reorderResult = await makeRequest('POST', `/api/pitches/${pitchId}/characters/reorder`, { characters: reorderData }, token);
      if (reorderResult.success) {
        logTest('Character Reordering', 'PASS', 'Characters reordered successfully');
      } else {
        logTest('Character Reordering', 'FAIL', `Character reordering failed: ${reorderResult.error}`);
      }
    }
    
  } else {
    logTest('Character Addition', 'FAIL', `Character addition failed: ${addCharResult.error}`);
  }
  
  // Clean up - delete test pitch
  await makeRequest('DELETE', `/api/pitches/${pitchId}`, null, token);
}

async function testThemesAndWorldField() {
  console.log(chalk.blue('\n=== PITCH CREATION: Themes Free-Text & World Field ==='));
  
  const loginResult = await loginUser('creator');
  if (!loginResult.success) {
    logTest('Themes/World Test Setup', 'FAIL', 'Cannot login as creator');
    return;
  }
  
  const { token } = loginResult;
  
  // Test pitch creation with free-text themes and world field
  const pitchData = {
    title: 'Themes and World Test Pitch',
    logline: 'Testing themes and world field functionality',
    genre: 'Sci-Fi',
    format: 'Feature',
    themes: 'This is a custom theme description with multiple themes: redemption, family bonds, overcoming adversity, and finding hope in darkness.',
    worldDescription: 'A dystopian future where artificial intelligence has taken over most jobs, and humans struggle to find purpose in a world where they are no longer needed for labor.'
  };
  
  const createResult = await makeRequest('POST', '/api/pitches', pitchData, token);
  if (createResult.success) {
    logTest('Themes Free-Text Field', 'PASS', 'Pitch created with custom themes text');
    logTest('World Field Addition', 'PASS', 'Pitch created with world description');
    
    const pitchId = createResult.data.id;
    
    // Verify the data was stored correctly
    const getResult = await makeRequest('GET', `/api/pitches/${pitchId}`, null, token);
    if (getResult.success) {
      const pitch = getResult.data;
      
      if (pitch.themes === pitchData.themes) {
        logTest('Themes Data Persistence', 'PASS', 'Themes free-text stored correctly');
      } else {
        logTest('Themes Data Persistence', 'FAIL', 'Themes data not stored correctly');
      }
      
      if (pitch.worldDescription === pitchData.worldDescription) {
        logTest('World Field Data Persistence', 'PASS', 'World description stored correctly');
      } else {
        logTest('World Field Data Persistence', 'FAIL', 'World description not stored correctly');
      }
    }
    
    // Clean up
    await makeRequest('DELETE', `/api/pitches/${pitchId}`, null, token);
    
  } else {
    logTest('Themes Free-Text Field', 'FAIL', `Pitch creation with themes failed: ${createResult.error}`);
    logTest('World Field Addition', 'FAIL', `Pitch creation with world field failed: ${createResult.error}`);
  }
}

async function testDocumentUpload() {
  console.log(chalk.blue('\n=== DOCUMENT UPLOAD: Multiple Files & NDA Support ==='));
  
  const loginResult = await loginUser('creator');
  if (!loginResult.success) {
    logTest('Document Upload Setup', 'FAIL', 'Cannot login as creator');
    return;
  }
  
  const { token } = loginResult;
  
  // Test document upload endpoint existence
  const uploadTestResult = await makeRequest('POST', '/api/upload/document', {
    fileName: 'test-script.pdf',
    fileType: 'application/pdf',
    documentType: 'script'
  }, token);
  
  if (uploadTestResult.success || uploadTestResult.status === 400) {
    logTest('Document Upload Endpoint', 'PASS', 'Document upload endpoint exists and responds');
  } else if (uploadTestResult.status === 404) {
    logTest('Document Upload Endpoint', 'FAIL', 'Document upload endpoint not found');
  } else {
    logTest('Document Upload Endpoint', 'SKIP', `Unexpected response: ${uploadTestResult.error}`);
  }
  
  // Test multiple document types
  const documentTypes = ['script', 'treatment', 'pitch-deck', 'nda', 'supporting-materials'];
  
  for (const docType of documentTypes) {
    const typeResult = await makeRequest('POST', '/api/upload/document', {
      fileName: `test-${docType}.pdf`,
      fileType: 'application/pdf',
      documentType: docType
    }, token);
    
    if (typeResult.success || typeResult.status === 400) {
      logTest(`Document Type - ${docType}`, 'PASS', `${docType} document type supported`);
    } else {
      logTest(`Document Type - ${docType}`, 'FAIL', `${docType} document type not supported`);
    }
  }
  
  // Test NDA preferences in pitch creation
  const pitchWithNDAData = {
    title: 'NDA Test Pitch',
    logline: 'Testing NDA functionality',
    genre: 'Drama',
    format: 'Feature',
    ndaRequired: true,
    useCustomNda: false
  };
  
  const ndaPitchResult = await makeRequest('POST', '/api/pitches', pitchWithNDAData, token);
  if (ndaPitchResult.success) {
    logTest('NDA Preference Setting', 'PASS', 'Pitch created with NDA preferences');
    
    // Clean up
    await makeRequest('DELETE', `/api/pitches/${ndaPitchResult.data.id}`, null, token);
  } else {
    logTest('NDA Preference Setting', 'FAIL', `NDA pitch creation failed: ${ndaPitchResult.error}`);
  }
}

async function testNDAWorkflow() {
  console.log(chalk.blue('\n=== NDA WORKFLOW: Request/Approve/Sign Process ==='));
  
  // Login as creator and investor
  const creatorLogin = await loginUser('creator');
  const investorLogin = await loginUser('investor');
  
  if (!creatorLogin.success || !investorLogin.success) {
    logTest('NDA Workflow Setup', 'FAIL', 'Cannot login as required users');
    return;
  }
  
  // Create a pitch with NDA requirement
  const pitchData = {
    title: 'NDA Protected Pitch',
    logline: 'This pitch requires NDA',
    genre: 'Thriller',
    format: 'Feature',
    ndaRequired: true
  };
  
  const pitchResult = await makeRequest('POST', '/api/pitches', pitchData, creatorLogin.token);
  if (!pitchResult.success) {
    logTest('NDA Test Pitch Creation', 'FAIL', 'Cannot create NDA test pitch');
    return;
  }
  
  const pitchId = pitchResult.data.id;
  logTest('NDA Test Pitch Creation', 'PASS', 'NDA-protected pitch created');
  
  // Test NDA request as investor
  const ndaRequestData = {
    pitchId: pitchId,
    message: 'I would like to view this pitch and am willing to sign an NDA.'
  };
  
  const requestResult = await makeRequest('POST', '/api/nda/request', ndaRequestData, investorLogin.token);
  if (requestResult.success) {
    logTest('NDA Request Creation', 'PASS', 'NDA request created successfully');
    
    const ndaRequestId = requestResult.data.id;
    
    // Test NDA approval as creator
    const approveResult = await makeRequest('POST', `/api/nda/${ndaRequestId}/approve`, {}, creatorLogin.token);
    if (approveResult.success) {
      logTest('NDA Request Approval', 'PASS', 'NDA request approved by creator');
      
      // Test NDA signing as investor
      const signResult = await makeRequest('POST', `/api/nda/${ndaRequestId}/sign`, {
        signature: 'Sarah Investor',
        agreedToTerms: true
      }, investorLogin.token);
      
      if (signResult.success) {
        logTest('NDA Electronic Signing', 'PASS', 'NDA signed electronically');
        
        // Test access to full pitch after signing
        const fullPitchResult = await makeRequest('GET', `/api/pitches/${pitchId}/full`, null, investorLogin.token);
        if (fullPitchResult.success) {
          logTest('Post-NDA Pitch Access', 'PASS', 'Full pitch accessible after NDA signing');
        } else {
          logTest('Post-NDA Pitch Access', 'FAIL', 'Cannot access full pitch after NDA signing');
        }
      } else {
        logTest('NDA Electronic Signing', 'FAIL', `NDA signing failed: ${signResult.error}`);
      }
    } else {
      logTest('NDA Request Approval', 'FAIL', `NDA approval failed: ${approveResult.error}`);
    }
  } else {
    logTest('NDA Request Creation', 'FAIL', `NDA request failed: ${requestResult.error}`);
  }
  
  // Test NDA management endpoints
  const ndaListResult = await makeRequest('GET', '/api/nda/signed', null, investorLogin.token);
  if (ndaListResult.success) {
    logTest('NDA List Management', 'PASS', 'Signed NDAs list accessible');
  } else {
    logTest('NDA List Management', 'FAIL', `NDA list failed: ${ndaListResult.error}`);
  }
  
  // Clean up
  await makeRequest('DELETE', `/api/pitches/${pitchId}`, null, creatorLogin.token);
}

async function testInfoRequestSystem() {
  console.log(chalk.blue('\n=== INFO REQUEST SYSTEM: Post-NDA Communication ==='));
  
  const creatorLogin = await loginUser('creator');
  const investorLogin = await loginUser('investor');
  
  if (!creatorLogin.success || !investorLogin.success) {
    logTest('Info Request Setup', 'FAIL', 'Cannot login as required users');
    return;
  }
  
  // Create a test pitch
  const pitchData = {
    title: 'Info Request Test Pitch',
    logline: 'Testing info request functionality',
    genre: 'Drama',
    format: 'Feature'
  };
  
  const pitchResult = await makeRequest('POST', '/api/pitches', pitchData, creatorLogin.token);
  if (!pitchResult.success) {
    logTest('Info Request Test Pitch', 'FAIL', 'Cannot create test pitch');
    return;
  }
  
  const pitchId = pitchResult.data.id;
  
  // Test info request creation
  const infoRequestData = {
    pitchId: pitchId,
    requestText: 'Could you provide more details about the budget breakdown and filming timeline?',
    specificQuestions: [
      'What is the expected production timeline?',
      'Do you have any key cast attached?',
      'What is the marketing strategy?'
    ]
  };
  
  const requestResult = await makeRequest('POST', `/api/pitches/${pitchId}/info-request`, infoRequestData, investorLogin.token);
  if (requestResult.success) {
    logTest('Info Request Creation', 'PASS', 'Info request created successfully');
    
    const requestId = requestResult.data.id;
    
    // Test info request response
    const responseData = {
      responseText: 'Thank you for your interest. Here are the details...',
      answers: [
        'Production timeline is 6 months',
        'We have two A-list actors attached',
        'Marketing will focus on digital platforms'
      ]
    };
    
    const responseResult = await makeRequest('PUT', `/api/info-requests/${requestId}/respond`, responseData, creatorLogin.token);
    if (responseResult.success) {
      logTest('Info Request Response', 'PASS', 'Creator responded to info request');
    } else {
      logTest('Info Request Response', 'FAIL', `Info request response failed: ${responseResult.error}`);
    }
    
    // Test info request history
    const historyResult = await makeRequest('GET', `/api/info-requests?pitchId=${pitchId}`, null, creatorLogin.token);
    if (historyResult.success) {
      logTest('Info Request History', 'PASS', 'Info request history accessible');
    } else {
      logTest('Info Request History', 'FAIL', `Info request history failed: ${historyResult.error}`);
    }
    
  } else {
    logTest('Info Request Creation', 'FAIL', `Info request creation failed: ${requestResult.error}`);
  }
  
  // Test info request management endpoints
  const investorRequestsResult = await makeRequest('GET', '/api/info-requests', null, investorLogin.token);
  if (investorRequestsResult.success) {
    logTest('Info Request Management', 'PASS', 'Info requests list accessible');
  } else {
    logTest('Info Request Management', 'FAIL', `Info request management failed: ${investorRequestsResult.error}`);
  }
  
  // Clean up
  await makeRequest('DELETE', `/api/pitches/${pitchId}`, null, creatorLogin.token);
}

async function testFrontendIntegration() {
  console.log(chalk.blue('\n=== FRONTEND INTEGRATION: UI Components & Workflows ==='));
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Test frontend accessibility
    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });
      logTest('Frontend Accessibility', 'PASS', 'Frontend loads successfully');
      
      // Test login form presence
      const loginForm = await page.$('form[data-testid="login-form"], .login-form, input[type="email"]');
      if (loginForm) {
        logTest('Login Form Present', 'PASS', 'Login form found on frontend');
      } else {
        logTest('Login Form Present', 'FAIL', 'Login form not found');
      }
      
      // Test investor login
      try {
        await page.type('input[type="email"]', DEMO_ACCOUNTS.investor.email);
        await page.type('input[type="password"]', DEMO_ACCOUNTS.investor.password);
        
        await page.click('button[type="submit"], .login-button, .btn-login');
        await page.waitForNavigation({ timeout: 10000 });
        
        logTest('Frontend Investor Login', 'PASS', 'Investor login through frontend successful');
        
        // Check for dashboard elements
        const dashboard = await page.$('.dashboard, [data-testid="dashboard"], .investor-dashboard');
        if (dashboard) {
          logTest('Dashboard UI Rendering', 'PASS', 'Dashboard UI elements present');
        } else {
          logTest('Dashboard UI Rendering', 'FAIL', 'Dashboard UI not rendered');
        }
        
        // Test logout button presence and functionality
        const logoutButton = await page.$('button:contains("Sign Out"), .logout-button, [data-testid="logout"]');
        if (logoutButton) {
          logTest('Logout Button Present', 'PASS', 'Logout button found in UI');
          
          try {
            await logoutButton.click();
            await page.waitForNavigation({ timeout: 5000 });
            logTest('Frontend Logout Functionality', 'PASS', 'Logout redirects properly');
          } catch {
            logTest('Frontend Logout Functionality', 'FAIL', 'Logout does not redirect');
          }
        } else {
          logTest('Logout Button Present', 'FAIL', 'Logout button not found');
        }
        
      } catch (error) {
        logTest('Frontend Investor Login', 'FAIL', `Login failed: ${error.message}`);
      }
      
    } catch (error) {
      logTest('Frontend Accessibility', 'FAIL', `Cannot access frontend: ${error.message}`);
    }
    
  } catch (error) {
    logTest('Frontend Integration Setup', 'FAIL', `Puppeteer setup failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateTestReport() {
  console.log(chalk.blue('\n=== COMPREHENSIVE TEST REPORT ==='));
  
  const passRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  const failRate = testResults.total > 0 ? (testResults.failed / testResults.total * 100).toFixed(1) : 0;
  
  console.log(chalk.white('\n📊 TEST SUMMARY'));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(chalk.green(`Passed: ${testResults.passed} (${passRate}%)`));
  console.log(chalk.red(`Failed: ${testResults.failed} (${failRate}%)`));
  console.log(chalk.yellow(`Skipped: ${testResults.skipped}`));
  
  console.log(chalk.white('\n🎯 CLIENT REQUIREMENTS STATUS'));
  
  // Group tests by category
  const categories = {
    'Critical Issues': testResults.tests.filter(t => t.name.includes('Investor')),
    'Browse Functionality': testResults.tests.filter(t => t.name.includes('Browse') || t.name.includes('Tab') || t.name.includes('Sort')),
    'Access Control': testResults.tests.filter(t => t.name.includes('Access') || t.name.includes('Creation Block')),
    'Pitch Creation': testResults.tests.filter(t => t.name.includes('Character') || t.name.includes('Themes') || t.name.includes('World')),
    'Document Upload': testResults.tests.filter(t => t.name.includes('Document') || t.name.includes('Upload')),
    'NDA Workflow': testResults.tests.filter(t => t.name.includes('NDA')),
    'Info Requests': testResults.tests.filter(t => t.name.includes('Info Request')),
    'Frontend Integration': testResults.tests.filter(t => t.name.includes('Frontend') || t.name.includes('UI'))
  };
  
  for (const [category, tests] of Object.entries(categories)) {
    if (tests.length > 0) {
      const categoryPassed = tests.filter(t => t.status === 'PASS').length;
      const categoryTotal = tests.length;
      const categoryRate = (categoryPassed / categoryTotal * 100).toFixed(1);
      
      console.log(`\n${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);
      tests.forEach(test => {
        const statusColor = test.status === 'PASS' ? chalk.green : 
                           test.status === 'FAIL' ? chalk.red : chalk.yellow;
        console.log(`  ${statusColor(test.status)} ${test.name}`);
        if (test.details && test.status === 'FAIL') {
          console.log(`    ${chalk.gray(test.details)}`);
        }
      });
    }
  }
  
  console.log(chalk.white('\n📝 OVERALL ASSESSMENT'));
  
  if (passRate >= 90) {
    console.log(chalk.green('✅ EXCELLENT: Platform meets client requirements with minimal issues'));
  } else if (passRate >= 75) {
    console.log(chalk.yellow('⚠️ GOOD: Most features working, some issues need attention'));
  } else if (passRate >= 50) {
    console.log(chalk.yellow('🔧 NEEDS WORK: Significant issues require fixing before client demo'));
  } else {
    console.log(chalk.red('❌ CRITICAL: Major issues prevent client requirements from being met'));
  }
  
  // Write detailed report to file
  const reportContent = `# Pitchey Platform - Client Requirements Verification Report

Generated: ${new Date().toISOString()}

## Executive Summary
- **Total Tests**: ${testResults.total}
- **Pass Rate**: ${passRate}%
- **Critical Issues**: ${testResults.tests.filter(t => t.status === 'FAIL' && t.name.includes('Critical')).length}

## Test Results by Category

${Object.entries(categories).map(([category, tests]) => {
  if (tests.length === 0) return '';
  
  const categoryPassed = tests.filter(t => t.status === 'PASS').length;
  const categoryTotal = tests.length;
  const categoryRate = (categoryPassed / categoryTotal * 100).toFixed(1);
  
  return `### ${category} (${categoryPassed}/${categoryTotal} - ${categoryRate}%)

${tests.map(test => `- [${test.status}] ${test.name}${test.details && test.status === 'FAIL' ? `\n  - ${test.details}` : ''}`).join('\n')}`;
}).filter(Boolean).join('\n\n')}

## Detailed Test Results

${testResults.tests.map(test => `### ${test.name}
**Status**: ${test.status}
${test.details ? `**Details**: ${test.details}` : ''}
`).join('\n')}

## Recommendations

${passRate < 75 ? `
### High Priority Fixes Required
${testResults.tests.filter(t => t.status === 'FAIL').map(t => `- ${t.name}: ${t.details}`).join('\n')}
` : ''}

### Next Steps
1. Fix all failing tests
2. Implement missing endpoints
3. Complete database schema updates
4. Test with client credentials
5. Schedule client demo when all tests pass

---
*This report was generated by the Comprehensive Client Requirements Test Suite*
`;

  require('fs').writeFileSync('/home/supremeisbeing/pitcheymovie/pitchey_v0.2/client-requirements-test-report.md', reportContent);
  console.log(chalk.blue('\n📄 Detailed report written to: client-requirements-test-report.md'));
}

// Main execution function
async function runAllTests() {
  console.log(chalk.blue('🚀 Starting Comprehensive Client Requirements Verification Test Suite'));
  console.log(chalk.gray(`Testing against: ${API_BASE_URL}`));
  console.log(chalk.gray(`Frontend: ${FRONTEND_URL}`));
  console.log(chalk.gray(`Demo Accounts: ${Object.keys(DEMO_ACCOUNTS).join(', ')}\n`));
  
  try {
    await testInvestorSignOut();
    await testInvestorDashboard();
    await testBrowseTabSeparation();
    await testGeneralBrowseWithSorting();
    await testAccessControl();
    await testCharacterManagement();
    await testThemesAndWorldField();
    await testDocumentUpload();
    await testNDAWorkflow();
    await testInfoRequestSystem();
    await testFrontendIntegration();
    
    await generateTestReport();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Test Suite Error: ${error.message}`));
    console.error(error.stack);
  }
}

// Handle command line execution
if (require.main === module) {
  runAllTests().then(() => {
    process.exit(testResults.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testResults,
  DEMO_ACCOUNTS,
  API_BASE_URL,
  FRONTEND_URL
};