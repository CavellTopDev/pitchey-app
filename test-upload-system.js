/**
 * Test Upload System
 * Test the complete file upload functionality including:
 * - Backend API endpoints
 * - File validation
 * - Storage integration
 * - Database operations
 */

const API_BASE = 'http://localhost:8001';
const TEST_TOKEN = 'demo-creator'; // Using demo token

// Helper to create a test file
function createTestFile(name, content, type) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
}

// Helper to make authenticated requests
async function makeRequest(url, options = {}) {
  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    ...options.headers
  };
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });
  
  const data = await response.json();
  return { response, data };
}

async function testUploadEndpoints() {
  console.log('🧪 Testing Upload System...\n');

  // Test 1: Check storage quota
  console.log('1. Testing storage quota endpoint...');
  try {
    const { response, data } = await makeRequest('/api/upload/quota');
    
    if (response.ok && data.success) {
      console.log('✅ Storage quota:', data.data);
    } else {
      console.log('❌ Storage quota failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Storage quota error:', error.message);
  }

  // Test 2: Test file validation with invalid file
  console.log('\n2. Testing file validation...');
  try {
    const invalidFile = createTestFile('test.exe', 'fake executable content', 'application/x-msdownload');
    const formData = new FormData();
    formData.append('file', invalidFile);
    formData.append('documentType', 'document');
    formData.append('folder', 'test');

    const { response, data } = await makeRequest('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      console.log('✅ File validation working - rejected invalid file:', data.error);
    } else {
      console.log('❌ File validation failed - accepted invalid file');
    }
  } catch (error) {
    console.log('❌ File validation error:', error.message);
  }

  // Test 3: Test valid file upload
  console.log('\n3. Testing valid file upload...');
  try {
    const testContent = 'This is a test document content for upload testing.';
    const validFile = createTestFile('test-document.txt', testContent, 'text/plain');
    const formData = new FormData();
    formData.append('file', validFile);
    formData.append('documentType', 'document');
    formData.append('folder', 'test-uploads');
    formData.append('isPublic', 'true');

    const { response, data } = await makeRequest('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok && data.success) {
      console.log('✅ File upload successful:', {
        url: data.data.file.url,
        key: data.data.file.key,
        provider: data.data.file.provider
      });

      // Store for cleanup
      window.testUploadKey = data.data.file.key;
      window.testUploadUrl = data.data.file.url;
      
      // Test file existence
      console.log('\n4. Testing file existence...');
      const response2 = await fetch(data.data.file.url);
      if (response2.ok) {
        console.log('✅ File accessible at URL');
      } else {
        console.log('❌ File not accessible at URL');
      }
      
    } else {
      console.log('❌ File upload failed:', data.error || data);
    }
  } catch (error) {
    console.log('❌ File upload error:', error.message);
  }

  // Test 4: Test multiple file upload
  console.log('\n5. Testing multiple file upload...');
  try {
    const file1 = createTestFile('doc1.txt', 'Document 1 content', 'text/plain');
    const file2 = createTestFile('doc2.txt', 'Document 2 content', 'text/plain');
    
    const formData = new FormData();
    formData.append('files', file1);
    formData.append('files', file2);
    formData.append('documentType', 'supporting');
    formData.append('folder', 'test-batch');
    formData.append('isPublic', 'true');

    const { response, data } = await makeRequest('/api/upload/multiple', {
      method: 'POST',
      body: formData
    });

    if (response.ok && data.success) {
      console.log('✅ Multiple file upload successful:', {
        total: data.data.summary.total,
        successful: data.data.summary.successful,
        failed: data.data.summary.failed
      });

      // Store keys for cleanup
      window.testBatchKeys = data.data.uploads.filter(u => u.success).map(u => u.result.key);
    } else {
      console.log('❌ Multiple file upload failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Multiple file upload error:', error.message);
  }

  // Test 5: Test presigned URL generation
  console.log('\n6. Testing presigned URL generation...');
  try {
    const { response, data } = await makeRequest('/api/upload/presigned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: 'presigned-test.txt',
        contentType: 'text/plain',
        folder: 'presigned-test',
        fileSize: 1024
      })
    });

    if (response.ok && data.success) {
      console.log('✅ Presigned URL generated:', {
        hasUploadUrl: !!data.data.uploadUrl,
        key: data.data.key,
        expiresAt: data.data.expiresAt
      });
    } else {
      console.log('❌ Presigned URL generation failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Presigned URL error:', error.message);
  }

  console.log('\n🔧 Upload system testing completed!');
  console.log('\nTo cleanup test files, run:');
  console.log('- Check window.testUploadKey and window.testBatchKeys for file keys to cleanup');
}

// Test health endpoint first
async function testHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Server is running:', data);
      return true;
    } else {
      console.log('❌ Server health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Upload System Tests\n');
  
  const serverHealthy = await testHealth();
  if (!serverHealthy) {
    console.log('❌ Cannot proceed - server not accessible');
    return;
  }
  
  console.log('');
  await testUploadEndpoints();
}

// Run tests if in browser
if (typeof window !== 'undefined') {
  window.testUploadSystem = runTests;
  console.log('Upload test loaded! Run testUploadSystem() to start tests.');
} else {
  // Run directly if in Node.js
  runTests().catch(console.error);
}