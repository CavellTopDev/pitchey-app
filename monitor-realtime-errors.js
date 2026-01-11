/**
 * Real-time error monitoring for Pitchey Frontend
 * This script continuously monitors API calls and reports issues
 */

const http = require('http');
const { exec } = require('child_process');

console.log('🔍 Pitchey Real-Time Error Monitor');
console.log('===================================');
console.log('Monitoring: http://localhost:5173');
console.log('Backend: http://localhost:8001');
console.log('-----------------------------------\n');

let requestCount = 0;
let errorCount = 0;
let lastError = null;

// Monitor specific endpoints
const criticalEndpoints = [
    '/api/auth/session',
    '/api/pitches',
    '/api/browse',
    '/api/notifications',
    '/api/search'
];

// Create a simple proxy to intercept and log requests
const monitoringServer = http.createServer((req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // Forward to actual backend
    const options = {
        hostname: 'localhost',
        port: 8001,
        path: req.url,
        method: req.method,
        headers: req.headers
    };
    
    const proxy = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        let responseData = '';
        proxyRes.on('data', (chunk) => {
            responseData += chunk;
            res.write(chunk);
        });
        
        proxyRes.on('end', () => {
            res.end();
            requestCount++;
            
            // Analyze response
            try {
                const data = JSON.parse(responseData);
                if (!data.success) {
                    errorCount++;
                    lastError = data.error;
                    console.log(`❌ ERROR in ${req.url}: ${data.error?.message || 'Unknown error'}`);
                } else if (criticalEndpoints.some(ep => req.url.startsWith(ep))) {
                    console.log(`✅ SUCCESS: ${req.url} - ${data.data?.length || 0} items`);
                }
            } catch (e) {
                // Not JSON, probably HTML or other content
            }
            
            // Print stats every 10 requests
            if (requestCount % 10 === 0) {
                printStats();
            }
        });
    });
    
    proxy.on('error', (e) => {
        errorCount++;
        console.log(`❌ PROXY ERROR: ${e.message}`);
        res.writeHead(500);
        res.end('Proxy Error');
    });
    
    req.on('data', (chunk) => proxy.write(chunk));
    req.on('end', () => proxy.end());
});

function printStats() {
    console.log('\n📊 Statistics:');
    console.log(`   Total Requests: ${requestCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Success Rate: ${((requestCount - errorCount) / requestCount * 100).toFixed(1)}%`);
    if (lastError) {
        console.log(`   Last Error: ${lastError.message || lastError}`);
    }
    console.log('');
}

// Start monitoring server on port 8002
monitoringServer.listen(8002, () => {
    console.log('🚀 Monitoring proxy started on port 8002');
    console.log('📝 To use the monitoring proxy:');
    console.log('   1. Update frontend .env: VITE_API_URL=http://localhost:8002');
    console.log('   2. Restart frontend: npm run dev');
    console.log('   3. All requests will be logged here\n');
    console.log('OR just watch the existing setup on ports 5173/8001\n');
    console.log('Monitoring existing traffic...\n');
});

// Also monitor the existing setup by polling
setInterval(async () => {
    try {
        const response = await new Promise((resolve, reject) => {
            http.get('http://localhost:8001/api/health', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', reject);
        });
        
        if (response.status !== 200) {
            console.log(`⚠️  Backend health check returned ${response.status}`);
        }
    } catch (e) {
        console.log('❌ Backend not responding:', e.message);
    }
}, 30000); // Check every 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n📊 Final Statistics:');
    printStats();
    console.log('👋 Monitoring stopped');
    process.exit(0);
});

console.log('Press Ctrl+C to stop monitoring\n');