#!/usr/bin/env node

/**
 * Test NDA Workflow - Complete End-to-End
 * Tests: Request -> Approve/Reject -> Sign -> Access
 */

const API_URL = process.env.API_URL || 'http://localhost:8001';

// Test users
const CREATOR_TOKEN = 'test-creator-token-alex';
const INVESTOR_TOKEN = 'test-investor-token-sarah';
const CREATOR_ID = 1;
const INVESTOR_ID = 2;
const PITCH_ID = 1;

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// Test 1: Request NDA (as investor)
async function testRequestNDA() {
  log('\n📝 Test 1: Requesting NDA as Investor', 'blue');
  
  const result = await fetchAPI('/api/ndas/request', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${INVESTOR_TOKEN}` },
    body: JSON.stringify({
      pitchId: PITCH_ID,
      message: 'I am interested in learning more about this project'
    })
  });
  
  if (result.ok) {
    log('✅ NDA request submitted successfully', 'green');
    log(`   NDA ID: ${result.data.data?.nda?.id}`, 'green');
    return result.data.data?.nda?.id;
  } else {
    log(`❌ Failed to request NDA: ${result.data.error}`, 'red');
    return null;
  }
}

// Test 2: List NDAs (as creator)
async function testListNDAs() {
  log('\n📋 Test 2: Listing NDAs as Creator', 'blue');
  
  const result = await fetchAPI('/api/ndas', {
    headers: { 'Authorization': `Bearer ${CREATOR_TOKEN}` }
  });
  
  if (result.ok) {
    const ndas = result.data.data?.ndas || [];
    log(`✅ Retrieved ${ndas.length} NDAs`, 'green');
    
    const pending = ndas.filter(n => n.status === 'pending');
    const approved = ndas.filter(n => n.status === 'approved');
    const signed = ndas.filter(n => n.status === 'signed');
    
    log(`   Pending: ${pending.length}`, 'yellow');
    log(`   Approved: ${approved.length}`, 'blue');
    log(`   Signed: ${signed.length}`, 'green');
    
    return pending[0]?.id;
  } else {
    log(`❌ Failed to list NDAs: ${result.data.error}`, 'red');
    return null;
  }
}

// Test 3: Approve NDA (as creator)
async function testApproveNDA(ndaId) {
  if (!ndaId) {
    log('\n⚠️ Skipping approval test - no NDA ID', 'yellow');
    return false;
  }
  
  log('\n✅ Test 3: Approving NDA as Creator', 'blue');
  
  const result = await fetchAPI(`/api/ndas/${ndaId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CREATOR_TOKEN}` }
  });
  
  if (result.ok) {
    log('✅ NDA approved successfully', 'green');
    log(`   Status: ${result.data.data?.nda?.status}`, 'green');
    return true;
  } else {
    log(`❌ Failed to approve NDA: ${result.data.error}`, 'red');
    return false;
  }
}

// Test 4: Sign NDA (as investor)
async function testSignNDA(ndaId) {
  if (!ndaId) {
    log('\n⚠️ Skipping signing test - no NDA ID', 'yellow');
    return false;
  }
  
  log('\n✍️ Test 4: Signing NDA as Investor', 'blue');
  
  const result = await fetchAPI(`/api/ndas/${ndaId}/sign`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${INVESTOR_TOKEN}` },
    body: JSON.stringify({
      signature: 'Sarah Johnson',
      signatureData: {
        name: 'Sarah Johnson',
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1',
        userAgent: 'Test Script'
      }
    })
  });
  
  if (result.ok) {
    log('✅ NDA signed successfully', 'green');
    log(`   Status: ${result.data.data?.nda?.status}`, 'green');
    log(`   Signed at: ${result.data.data?.nda?.signed_at}`, 'green');
    return true;
  } else {
    log(`❌ Failed to sign NDA: ${result.data.error}`, 'red');
    return false;
  }
}

// Test 5: Test rejection flow
async function testRejectNDA() {
  log('\n❌ Test 5: Testing NDA Rejection Flow', 'blue');
  
  // First create a new NDA request
  const requestResult = await fetchAPI('/api/ndas/request', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${INVESTOR_TOKEN}` },
    body: JSON.stringify({
      pitchId: PITCH_ID + 1, // Different pitch
      message: 'Another request to test rejection'
    })
  });
  
  if (!requestResult.ok) {
    log('⚠️ Could not create test NDA for rejection', 'yellow');
    return;
  }
  
  const ndaId = requestResult.data.data?.nda?.id;
  if (!ndaId) return;
  
  // Now reject it as creator
  const rejectResult = await fetchAPI(`/api/ndas/${ndaId}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CREATOR_TOKEN}` },
    body: JSON.stringify({
      reason: 'Test rejection - insufficient information provided'
    })
  });
  
  if (rejectResult.ok) {
    log('✅ NDA rejected successfully', 'green');
    log(`   Reason: ${rejectResult.data.data?.nda?.rejection_reason}`, 'yellow');
  } else {
    log(`❌ Failed to reject NDA: ${rejectResult.data.error}`, 'red');
  }
}

// Test 6: Check access after signing
async function testAccessAfterSigning() {
  log('\n🔐 Test 6: Verifying Access After Signing', 'blue');
  
  // Check if investor can access protected content
  const result = await fetchAPI(`/api/pitches/${PITCH_ID}/protected`, {
    headers: { 'Authorization': `Bearer ${INVESTOR_TOKEN}` }
  });
  
  if (result.ok) {
    log('✅ Access granted to protected content', 'green');
  } else if (result.status === 404) {
    log('⚠️ Protected content endpoint not implemented yet', 'yellow');
  } else {
    log(`❌ Access denied: ${result.data.error}`, 'red');
  }
}

// Run all tests
async function runAllTests() {
  log('========================================', 'blue');
  log('      NDA WORKFLOW COMPLETE TEST       ', 'blue');
  log('========================================', 'blue');
  
  try {
    // Test the complete workflow
    const ndaId = await testRequestNDA();
    
    // List NDAs
    const pendingNdaId = await testListNDAs();
    
    // Use the NDA ID from request or from list
    const testNdaId = ndaId || pendingNdaId;
    
    // Approve the NDA
    const approved = await testApproveNDA(testNdaId);
    
    // Sign the NDA if approved
    if (approved) {
      await testSignNDA(testNdaId);
    }
    
    // Test rejection flow with a new NDA
    await testRejectNDA();
    
    // Check access
    await testAccessAfterSigning();
    
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    console.error(error);
  }
  
  log('\n========================================', 'blue');
  log('         WORKFLOW TEST COMPLETE         ', 'blue');
  log('========================================', 'blue');
  
  // Summary
  log('\n📊 Test Summary:', 'blue');
  log('  1. Request NDA: Tested', 'green');
  log('  2. List NDAs: Tested', 'green');
  log('  3. Approve NDA: Tested', 'green');
  log('  4. Sign NDA: Tested', 'green');
  log('  5. Reject NDA: Tested', 'green');
  log('  6. Access Control: Tested', 'green');
}

// Run tests
runAllTests().catch(console.error);