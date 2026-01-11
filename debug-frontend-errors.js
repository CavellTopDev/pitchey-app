// Debugging script to capture console errors from the frontend
const http = require('http');

console.log('🔍 Pitchey Frontend Error Monitor');
console.log('==================================');

// Test API endpoints
const endpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/pitches?limit=2', name: 'Pitches List' },
    { path: '/api/browse', name: 'Browse' },
    { path: '/api/auth/session', name: 'Auth Session' },
    { path: '/api/notifications', name: 'Notifications' }
];

function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 8001,
            path: endpoint.path,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.success) {
                        console.log(`✅ ${endpoint.name}: SUCCESS`);
                    } else {
                        console.log(`⚠️  ${endpoint.name}: ${json.error?.message || 'Failed'}`);
                    }
                } catch (e) {
                    console.log(`❌ ${endpoint.name}: Invalid JSON response`);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ${endpoint.name}: ${e.message}`);
            resolve();
        });

        req.end();
    });
}

// Test frontend HTML for errors
function checkFrontendHTML() {
    return new Promise((resolve) => {
        http.get('http://localhost:5173', (res) => {
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                // Check for common error patterns
                const errorPatterns = [
                    /Error:/gi,
                    /Failed to/gi,
                    /Cannot read/gi,
                    /undefined is not/gi,
                    /NetworkError/gi,
                    /CORS/gi
                ];

                console.log('\n📝 Frontend HTML Analysis:');
                let foundErrors = false;
                errorPatterns.forEach(pattern => {
                    const matches = html.match(pattern);
                    if (matches) {
                        console.log(`   ⚠️  Found: ${matches[0]}`);
                        foundErrors = true;
                    }
                });
                
                if (!foundErrors) {
                    console.log('   ✅ No obvious errors in HTML');
                }
                
                // Check if React is loaded
                if (html.includes('id="root"')) {
                    console.log('   ✅ React root element found');
                } else {
                    console.log('   ❌ React root element missing');
                }
                
                resolve();
            });
        }).on('error', (e) => {
            console.log(`❌ Frontend check failed: ${e.message}`);
            resolve();
        });
    });
}

async function runTests() {
    console.log('\n🔌 Testing Backend API Endpoints:');
    console.log('─────────────────────────────────');
    
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint);
    }
    
    await checkFrontendHTML();
    
    console.log('\n📊 Summary:');
    console.log('───────────');
    console.log('Backend URL: http://localhost:8001');
    console.log('Frontend URL: http://localhost:5173');
    console.log('\n💡 To view the app with console:');
    console.log('   1. Open http://localhost:5173 in Chrome');
    console.log('   2. Press F12 to open DevTools');
    console.log('   3. Check Console tab for errors');
    console.log('   4. Check Network tab for failed requests');
}

runTests();