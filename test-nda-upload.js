#!/usr/bin/env node

/**
 * Test NDA Upload Functionality
 */

const fs = require('fs');
const FormData = require('form-data');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:8001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-creator-token-alex';

// Colors for console output
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

async function testNDAUpload() {
  log('\n🔧 Testing NDA Upload Functionality\n', 'blue');
  
  try {
    // Create a test PDF file in memory
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj xref 0 3 0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\ntrailer<</Size 3/Root 1 0 R>>startxref 109 %%EOF');
    
    // Create form data
    const formData = new FormData();
    formData.append('file', pdfContent, {
      filename: 'test-nda-document.pdf',
      contentType: 'application/pdf'
    });
    formData.append('folder', 'nda-documents');
    formData.append('isPublic', 'false');
    formData.append('metadata', JSON.stringify({
      documentCategory: 'nda',
      isCustomNDA: true,
      originalFileName: 'test-nda-document.pdf'
    }));
    
    log('📤 Uploading NDA document...', 'yellow');
    
    const response = await fetch(`${API_URL}/api/upload/nda`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log('✅ NDA Upload Successful!', 'green');
      log('\n📋 Upload Result:', 'blue');
      console.log(JSON.stringify(result.data, null, 2));
      
      // Validate response structure
      const { data } = result;
      if (data.url && data.key && data.filename && data.metadata) {
        log('\n✔️ Response structure validated', 'green');
        log(`  - URL: ${data.url}`, 'green');
        log(`  - Key: ${data.key}`, 'green');
        log(`  - Filename: ${data.filename}`, 'green');
        log(`  - Document Category: ${data.metadata.documentCategory}`, 'green');
        log(`  - Is Custom NDA: ${data.metadata.isCustomNDA}`, 'green');
      }
    } else {
      log('❌ NDA Upload Failed', 'red');
      console.error('Error:', result);
    }
    
  } catch (error) {
    log('❌ Test Failed', 'red');
    console.error(error);
  }
}

// Test with invalid file type
async function testInvalidFileType() {
  log('\n🔧 Testing Invalid File Type Rejection\n', 'blue');
  
  try {
    const formData = new FormData();
    formData.append('file', Buffer.from('test content'), {
      filename: 'test.txt',
      contentType: 'text/plain'
    });
    
    log('📤 Uploading non-PDF file...', 'yellow');
    
    const response = await fetch(`${API_URL}/api/upload/nda`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok && result.error === 'NDA documents must be PDF files') {
      log('✅ Invalid file type correctly rejected!', 'green');
    } else {
      log('❌ Should have rejected non-PDF file', 'red');
      console.error(result);
    }
    
  } catch (error) {
    log('❌ Test Failed', 'red');
    console.error(error);
  }
}

// Test file size limit
async function testFileSizeLimit() {
  log('\n🔧 Testing File Size Limit\n', 'blue');
  
  try {
    // Create a buffer larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    
    const formData = new FormData();
    formData.append('file', largeBuffer, {
      filename: 'large-file.pdf',
      contentType: 'application/pdf'
    });
    
    log('📤 Uploading oversized file...', 'yellow');
    
    const response = await fetch(`${API_URL}/api/upload/nda`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok && result.error === 'NDA documents must be under 10MB') {
      log('✅ Oversized file correctly rejected!', 'green');
    } else {
      log('❌ Should have rejected oversized file', 'red');
      console.error(result);
    }
    
  } catch (error) {
    log('❌ Test Failed', 'red');
    console.error(error);
  }
}

// Run all tests
async function runAllTests() {
  log('========================================', 'blue');
  log('    NDA UPLOAD FUNCTIONALITY TESTS     ', 'blue');
  log('========================================', 'blue');
  
  await testNDAUpload();
  await testInvalidFileType();
  await testFileSizeLimit();
  
  log('\n========================================', 'blue');
  log('         ALL TESTS COMPLETED            ', 'blue');
  log('========================================', 'blue');
}

// Check if running directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testNDAUpload,
  testInvalidFileType,
  testFileSizeLimit
};