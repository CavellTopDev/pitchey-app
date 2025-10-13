#!/usr/bin/env node

/**
 * Comprehensive test for the 7 failing endpoints
 * Tests the specific endpoints that were returning 500/404 errors
 */

const SERVER_URL = 'http://localhost:8001';

// Test helper function
async function makeRequest(method, endpoint, headers = {}, body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(`${SERVER_URL}${endpoint}`, options);
        const data = await response.json();
        
        return {
            status: response.status,
            statusText: response.statusText,
            data,
            success: response.ok
        };
    } catch (error) {
        return {
            status: 0,
            statusText: 'Network Error',
            data: { error: error.message },
            success: false
        };
    }
}

// Get authentication token
async function getAuthToken(email, password) {
    const response = await makeRequest('POST', '/api/auth/login', {}, {
        email,
        password
    });
    
    if (response.success && response.data.token) {
        return response.data.token;
    }
    throw new Error(`Failed to authenticate: ${JSON.stringify(response.data)}`);
}

async function runEndpointTests() {
    console.log('🧪 Testing Endpoint Fixes\n');
    
    // Get tokens for different user types
    console.log('🔐 Authenticating users...');
    const creatorToken = await getAuthToken('alex.creator@demo.com', 'Demo123');
    const investorToken = await getAuthToken('sarah.investor@demo.com', 'Demo123');
    
    console.log('✅ Users authenticated successfully\n');
    
    const tests = [
        {
            name: '1. Search pitches endpoint',
            method: 'GET',
            endpoint: '/api/search/pitches?q=test',
            token: creatorToken,
            expectedSuccess: true,
            note: 'Fixed: pitches.synopsis -> pitches.shortSynopsis'
        },
        {
            name: '2. Get auth profile endpoint',
            method: 'GET',
            endpoint: '/api/auth/profile',
            token: creatorToken,
            expectedSuccess: true,
            note: 'Fixed: authenticateRequest -> authenticate'
        },
        {
            name: '3. Search pitches (second call)',
            method: 'GET',
            endpoint: '/api/search/pitches?q=test',
            token: investorToken,
            expectedSuccess: true,
            note: 'Should work with consistent authentication'
        },
        {
            name: '4. NDA status check',
            method: 'GET',
            endpoint: '/api/nda/status/1',
            token: investorToken,
            expectedSuccess: true,
            note: 'Authentication should work properly'
        },
        {
            name: '5. Search pitches with action query',
            method: 'GET',
            endpoint: '/api/search/pitches?q=action',
            token: creatorToken,
            expectedSuccess: true,
            note: 'Search field fix should resolve this'
        },
        {
            name: '6. Messages unread count',
            method: 'GET',
            endpoint: '/api/messages/unread-count',
            token: investorToken,
            expectedSuccess: true,
            note: 'Fixed: authentication and user scope issues'
        },
        {
            name: '7. Get pitch by ID (as investor)',
            method: 'GET',
            endpoint: '/api/pitches/1',
            token: investorToken,
            expectedSuccess: true,
            note: 'Fixed: should try public pitch access if user doesn\'t own it'
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        console.log(`Testing: ${test.name}`);
        console.log(`  ${test.method} ${test.endpoint}`);
        
        const result = await makeRequest(
            test.method,
            test.endpoint,
            { Authorization: `Bearer ${test.token}` }
        );
        
        const success = test.expectedSuccess ? result.success : !result.success;
        const status = success ? '✅ PASS' : '❌ FAIL';
        
        console.log(`  Status: ${result.status} ${result.statusText}`);
        console.log(`  Result: ${status}`);
        console.log(`  Note: ${test.note}`);
        
        if (!success) {
            console.log(`  Error: ${JSON.stringify(result.data, null, 2)}`);
        }
        
        results.push({
            test: test.name,
            passed: success,
            status: result.status,
            note: test.note
        });
        
        console.log('');
    }
    
    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
    
    if (passed === total) {
        console.log('🎉 ALL ENDPOINT FIXES SUCCESSFUL!');
        console.log('✅ 100% functionality achieved');
    } else {
        console.log('⚠️  Some endpoints still need fixes:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.test} (Status: ${r.status})`);
        });
    }
    
    return results;
}

// Run the tests
runEndpointTests()
    .then(() => {
        console.log('\n🏁 Test execution completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Test execution failed:', error);
        process.exit(1);
    });