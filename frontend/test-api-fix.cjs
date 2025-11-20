#!/usr/bin/env node

/**
 * Test API Fix Verification Script
 * Validates that the frontend API parsing fix works correctly
 */

const https = require('https');
const { URL } = require('url');

const API_BASE_URL = 'https://pitchey-optimized.cavelltheleaddev.workers.dev';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Simulate the fixed frontend parsing logic
function simulateOldParsing(response) {
  // This is what the frontend was doing before (broken)
  return response.data?.data?.pitches || [];
}

function simulateNewParsing(response) {
  // This is the new parsing logic (should work)
  return response.data?.items || response.data?.data?.pitches || [];
}

function simulateOldIndividualParsing(response) {
  // Old individual pitch parsing (broken)
  return response.data?.data?.pitch;
}

function simulateNewIndividualParsing(response) {
  // New individual pitch parsing (should work)
  return response.data?.pitch || response.data?.data?.pitch;
}

async function testFix() {
  console.log('🧪 Testing API Fix Implementation\n');

  console.log('1. Testing Public Pitches List Fix...');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/pitches/public`);
    
    if (response.status !== 200) {
      console.log(`❌ API returned status ${response.status}`);
      return;
    }

    const oldResult = simulateOldParsing(response);
    const newResult = simulateNewParsing(response);

    console.log(`   Old parsing result: ${oldResult.length} pitches`);
    console.log(`   New parsing result: ${newResult.length} pitches`);
    
    if (oldResult.length === 0 && newResult.length > 0) {
      console.log('   ✅ Fix successful! Marketplace will now show pitches');
      
      // Show sample pitch
      if (newResult[0]) {
        console.log(`   📄 Sample pitch: "${newResult[0].title}" (ID: ${newResult[0].id})`);
      }
    } else if (oldResult.length > 0) {
      console.log('   ⚠️  Old parsing was already working (unexpected)');
    } else {
      console.log('   ❌ Fix not working - both return 0 pitches');
    }
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
  }

  console.log('\n2. Testing Individual Pitch Fix...');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/pitches/public/162`);
    
    if (response.status !== 200) {
      console.log(`   ❌ API returned status ${response.status}`);
      return;
    }

    const oldResult = simulateOldIndividualParsing(response);
    const newResult = simulateNewIndividualParsing(response);

    console.log(`   Old parsing result: ${oldResult ? oldResult.title : 'null'}`);
    console.log(`   New parsing result: ${newResult ? newResult.title : 'null'}`);
    
    if (!oldResult && newResult) {
      console.log('   ✅ Fix successful! Individual pitch pages will now load');
      console.log(`   📄 Pitch details: "${newResult.title}" by ${newResult.creator?.username}`);
    } else if (oldResult) {
      console.log('   ⚠️  Old parsing was already working (unexpected)');
    } else {
      console.log('   ❌ Fix not working - both return null');
    }
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
  }

  console.log('\n3. Testing Response Format Details...');
  try {
    const listResponse = await makeRequest(`${API_BASE_URL}/api/pitches/public`);
    const individualResponse = await makeRequest(`${API_BASE_URL}/api/pitches/public/162`);

    console.log('   📊 Public Pitches Response Structure:');
    console.log(`      Keys: ${Object.keys(listResponse.data)}`);
    console.log(`      Has 'items': ${!!listResponse.data.items}`);
    console.log(`      Has 'data.pitches': ${!!listResponse.data.data?.pitches}`);
    console.log(`      Items count: ${listResponse.data.items?.length || 0}`);

    console.log('   📊 Individual Pitch Response Structure:');
    console.log(`      Keys: ${Object.keys(individualResponse.data)}`);
    console.log(`      Has 'pitch': ${!!individualResponse.data.pitch}`);
    console.log(`      Has 'data.pitch': ${!!individualResponse.data.data?.pitch}`);
    console.log(`      Pitch title: ${individualResponse.data.pitch?.title || individualResponse.data.data?.pitch?.title || 'Not found'}`);

  } catch (error) {
    console.log(`   ❌ Structure analysis failed: ${error.message}`);
  }

  console.log('\n4. Summary and Next Steps...');
  console.log('   🔧 Code changes applied to:');
  console.log('      - /src/lib/api.ts pitchAPI.getPublic()');
  console.log('      - /src/lib/api.ts pitchAPI.getPublicById()');
  console.log('   ');
  console.log('   📋 To verify the fix:');
  console.log('      1. Start the frontend: npm run dev');
  console.log('      2. Navigate to /marketplace');
  console.log('      3. Verify pitches are displayed');
  console.log('      4. Click on a pitch to test navigation');
  console.log('      5. Verify pitch detail page loads');
  console.log('   ');
  console.log('   🧪 Additional testing:');
  console.log('      1. Open comprehensive-user-flow-test.html');
  console.log('      2. Run all tests to verify end-to-end flow');
  console.log('      3. Test in multiple browsers');
}

// Run the test
if (require.main === module) {
  testFix().catch(error => {
    console.error(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
}