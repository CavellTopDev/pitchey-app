/**
 * Test script for comprehensive pitch endpoint
 * Tests /api/pitches/:id with various scenarios
 */

const WORKER_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

interface TestCase {
  name: string;
  endpoint: string;
  headers?: Record<string, string>;
  expectedStatus: number;
  expectedFields: string[];
}

const testCases: TestCase[] = [
  // Test 1: Public access to existing pitch
  {
    name: 'Public access to existing pitch',
    endpoint: '/api/pitches/162',
    expectedStatus: 200,
    expectedFields: ['id', 'title', 'logline', 'creator', 'analytics', 'access']
  },
  
  // Test 2: Non-existent pitch
  {
    name: 'Non-existent pitch',
    endpoint: '/api/pitches/999999',
    expectedStatus: 404,
    expectedFields: ['success', 'error']
  },
  
  // Test 3: Health check
  {
    name: 'Health check endpoint',
    endpoint: '/api/health',
    expectedStatus: 200,
    expectedFields: ['success', 'endpoints', 'services']
  },
  
  // Test 4: Test with malformed ID
  {
    name: 'Malformed pitch ID',
    endpoint: '/api/pitches/abc',
    expectedStatus: 404,
    expectedFields: ['success', 'error']
  }
];

async function runTest(testCase: TestCase): Promise<void> {
  try {
    console.log(`\n🧪 Running test: ${testCase.name}`);
    console.log(`📍 Testing: ${WORKER_URL}${testCase.endpoint}`);
    
    const response = await fetch(`${WORKER_URL}${testCase.endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...testCase.headers
      }
    });
    
    console.log(`📊 Status: ${response.status} (expected: ${testCase.expectedStatus})`);
    
    if (response.status !== testCase.expectedStatus) {
      console.error(`❌ Status mismatch! Expected ${testCase.expectedStatus}, got ${response.status}`);
      return;
    }
    
    const data = await response.json();
    console.log(`📋 Response type: ${typeof data}`);
    
    // Check expected fields
    const missingFields = testCase.expectedFields.filter(field => !(field in data));
    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
      console.log('Available fields:', Object.keys(data));
    } else {
      console.log(`✅ All expected fields present: ${testCase.expectedFields.join(', ')}`);
    }
    
    // Log relevant data for analysis
    if (data.success && data.pitch) {
      console.log(`📈 Pitch ID: ${data.pitch.id}, Title: ${data.pitch.title}`);
      console.log(`🔒 Access level: ${data.access?.level || 'unknown'}`);
      console.log(`👤 User type: ${data.access?.userType || 'unknown'}`);
      console.log(`📊 View count: ${data.pitch.viewCount || 0}`);
      console.log(`📄 Documents: ${data.pitch.documents?.length || 0}`);
      console.log(`👥 Characters: ${data.pitch.charactersList?.length || 0}`);
      console.log(`🎬 Related pitches: ${data.pitch.relatedPitches?.length || 0}`);
    }
    
    if (data.error) {
      console.log(`🚨 Error details: ${data.error}`);
    }
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error(`❌ Test failed with error:`, error.message);
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting comprehensive pitch endpoint tests...\n');
  console.log('🔗 Testing Worker URL:', WORKER_URL);
  
  for (const testCase of testCases) {
    await runTest(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between tests
  }
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📝 Summary:');
  console.log(`- Total tests run: ${testCases.length}`);
  console.log('- Check logs above for detailed results');
  console.log('- Verify that all expected fields are present');
  console.log('- Confirm access controls are working properly');
}

// Run tests if this script is executed directly
if (import.meta.main) {
  runAllTests().catch(console.error);
}

export { runAllTests, testCases };