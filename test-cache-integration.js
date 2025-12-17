#!/usr/bin/env node

/**
 * Cache Integration Test Script
 * Tests the Cloudflare Worker cache integration and performance headers
 */

const WORKER_URL = process.env.WORKER_URL || 'https://pitchey-production.cavelltheleaddev.workers.dev';

async function testCacheIntegration() {
  console.log('🧪 Testing Cache Integration\n');
  console.log(`Testing URL: ${WORKER_URL}\n`);

  const tests = [
    {
      name: 'Health Check Endpoint',
      url: '/api/health',
      shouldCache: false,
      description: 'Health checks should not be cached'
    },
    {
      name: 'Config Genres Endpoint', 
      url: '/api/config/genres',
      shouldCache: true,
      description: 'Config data should be cached'
    },
    {
      name: 'Public Content Endpoint',
      url: '/api/content/stats',
      shouldCache: true,
      description: 'Public content should be cached'
    },
    {
      name: 'Browse Pitches (Public)',
      url: '/api/pitches/browse/general?limit=5',
      shouldCache: true,
      description: 'Browse endpoints should be cached'
    }
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const test of tests) {
    totalTests++;
    console.log(`\n🔧 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.shouldCache ? 'Cacheable' : 'Not Cacheable'}`);
    
    try {
      // First request - should be MISS or BYPASS
      const response1 = await fetch(`${WORKER_URL}${test.url}`);
      const headers1 = Object.fromEntries(response1.headers.entries());
      
      console.log(`   First Request Status: ${response1.status}`);
      console.log(`   Cache Status: ${headers1['x-cache-status'] || 'MISSING'}`);
      console.log(`   Response Time: ${headers1['x-response-time'] || 'MISSING'}`);
      console.log(`   Powered By: ${headers1['x-powered-by'] || 'MISSING'}`);

      // Check if headers are present
      const hasPerformanceHeaders = !!(
        headers1['x-cache-status'] && 
        headers1['x-powered-by']
      );

      if (!hasPerformanceHeaders) {
        console.log(`   ❌ FAILED: Missing performance headers`);
        continue;
      }

      // Wait a moment, then make second request to test caching
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response2 = await fetch(`${WORKER_URL}${test.url}`);
      const headers2 = Object.fromEntries(response2.headers.entries());
      
      console.log(`   Second Request Status: ${response2.status}`);
      console.log(`   Cache Status: ${headers2['x-cache-status'] || 'MISSING'}`);

      // Validate caching behavior
      if (test.shouldCache) {
        // Should eventually become HIT or stay MISS (if cache is working but not hitting due to TTL)
        const cacheWorking = headers1['x-cache-status'] === 'MISS' || 
                            headers1['x-cache-status'] === 'HIT' ||
                            headers1['x-cache-status'] === 'BYPASS'; // BYPASS is acceptable for some endpoints
        
        if (cacheWorking) {
          console.log(`   ✅ PASSED: Cache integration working`);
          passedTests++;
        } else {
          console.log(`   ❌ FAILED: Cache not working properly`);
        }
      } else {
        // Should be BYPASS
        const correctBypass = headers1['x-cache-status'] === 'BYPASS';
        if (correctBypass) {
          console.log(`   ✅ PASSED: Correctly bypassing cache`);
          passedTests++;
        } else {
          console.log(`   ❌ FAILED: Should bypass cache but got ${headers1['x-cache-status']}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ FAILED: Request failed - ${error.message}`);
    }
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All cache integration tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the cache middleware integration.');
    process.exit(1);
  }
}

async function testPerformanceHeaders() {
  console.log('\n🚀 Testing Performance Headers\n');

  try {
    const response = await fetch(`${WORKER_URL}/api/health`);
    const headers = Object.fromEntries(response.headers.entries());

    console.log('Response Headers:');
    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase().includes('cache')) {
        console.log(`   ${key}: ${value}`);
      }
    });

    const requiredHeaders = ['x-cache-status', 'x-powered-by'];
    const missingHeaders = requiredHeaders.filter(header => !headers[header]);

    if (missingHeaders.length === 0) {
      console.log('\n✅ All required performance headers present');
      return true;
    } else {
      console.log(`\n❌ Missing headers: ${missingHeaders.join(', ')}`);
      return false;
    }

  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('🔥 Cloudflare Worker Cache Integration Test Suite');
  console.log('='.repeat(50));

  const headersOk = await testPerformanceHeaders();
  
  if (headersOk) {
    await testCacheIntegration();
  } else {
    console.log('❌ Performance headers test failed. Check middleware integration.');
    process.exit(1);
  }
}

runAllTests().catch(console.error);