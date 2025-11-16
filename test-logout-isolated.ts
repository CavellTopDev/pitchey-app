#!/usr/bin/env deno run --allow-all

/**
 * Isolated Logout Test - Tests logout functionality without full server dependencies
 * This helps debug the investor logout issue specifically
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Mock user store for testing
const mockUsers = new Map();
const mockSessions = new Map();

// Test credentials
const testCredentials = {
  'creator': { email: 'alex.creator@demo.com', password: 'Demo123', userType: 'creator', id: 1 },
  'investor': { email: 'sarah.investor@demo.com', password: 'Demo123', userType: 'investor', id: 2 },
  'production': { email: 'stellar.production@demo.com', password: 'Demo123', userType: 'production', id: 3 }
};

// Initialize mock users
Object.values(testCredentials).forEach(user => {
  mockUsers.set(user.email, user);
});

function generateToken(user: any): string {
  const payload = {
    userId: user.id,
    userType: user.userType,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  return btoa(JSON.stringify(payload));
}

function verifyToken(token: string): any {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

console.log("🧪 Starting Isolated Logout Test Server...");
console.log("📝 Test endpoints:");
console.log("   POST /api/auth/{creator|investor|production}/login");
console.log("   POST /api/auth/logout");
console.log("   GET /health");
console.log("   GET /test-logout");

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  console.log(`${method} ${pathname}`);

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Health check
    if (pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        service: 'logout-test',
        timestamp: new Date().toISOString(),
        endpoints: [
          'POST /api/auth/{creator|investor|production}/login',
          'POST /api/auth/logout',
          'GET /test-logout'
        ]
      }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // Test logout page
    if (pathname === '/test-logout' && method === 'GET') {
      const html = `<!DOCTYPE html>
<html>
<head>
    <title>Logout Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        button { padding: 10px 20px; margin: 5px; }
        .result { margin: 10px 0; padding: 10px; border-radius: 4px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        pre { background: #f8f9fa; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Logout Functionality Test</h1>
        <div id="results"></div>
        
        <h3>Quick Tests</h3>
        <button onclick="testCreatorLogout()">Test Creator Logout</button>
        <button onclick="testInvestorLogout()">Test Investor Logout</button>
        <button onclick="testProductionLogout()">Test Production Logout</button>
        
        <script>
            function log(message, type = 'info') {
                const div = document.createElement('div');
                div.className = 'result ' + type;
                div.innerHTML = message;
                document.getElementById('results').appendChild(div);
            }
            
            async function testUserLogout(userType) {
                log('Testing ' + userType + ' logout workflow...', 'info');
                
                // Step 1: Login
                try {
                    const loginResponse = await fetch('/api/auth/' + userType + '/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userType === 'creator' ? 'alex.creator@demo.com' :
                                   userType === 'investor' ? 'sarah.investor@demo.com' :
                                   'stellar.production@demo.com',
                            password: 'Demo123'
                        })
                    });
                    
                    const loginData = await loginResponse.json();
                    
                    if (!loginResponse.ok) {
                        log('❌ Login failed: ' + JSON.stringify(loginData), 'error');
                        return;
                    }
                    
                    log('✅ ' + userType + ' login successful', 'success');
                    const token = loginData.data?.token || loginData.token;
                    
                    if (!token) {
                        log('❌ No token received from login', 'error');
                        return;
                    }
                    
                    // Step 2: Test logout
                    const logoutResponse = await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    
                    const logoutData = await logoutResponse.json();
                    
                    if (logoutResponse.ok) {
                        log('✅ ' + userType + ' logout successful', 'success');
                        log('<pre>' + JSON.stringify(logoutData, null, 2) + '</pre>', 'info');
                    } else {
                        log('❌ ' + userType + ' logout failed: ' + JSON.stringify(logoutData), 'error');
                    }
                    
                } catch (error) {
                    log('❌ Error testing ' + userType + ' logout: ' + error.message, 'error');
                }
            }
            
            function testCreatorLogout() { testUserLogout('creator'); }
            function testInvestorLogout() { testUserLogout('investor'); }
            function testProductionLogout() { testUserLogout('production'); }
        </script>
    </div>
</body>
</html>`;
      return new Response(html, { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Login endpoints
    const loginMatch = pathname.match(/^\/api\/auth\/(creator|investor|production)\/login$/);
    if (loginMatch && method === 'POST') {
      const userType = loginMatch[1];
      const body = await request.json();
      
      console.log(`🔐 Login attempt for ${userType}:`, body);
      
      const user = mockUsers.get(body.email);
      
      if (!user || user.password !== body.password || user.userType !== userType) {
        console.log(`❌ Invalid credentials for ${userType}`);
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Invalid credentials' }
        }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }
      
      const token = generateToken(user);
      mockSessions.set(token, { userId: user.id, userType: user.userType });
      
      console.log(`✅ ${userType} login successful, token: ${token.substring(0, 20)}...`);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          user: { id: user.id, email: user.email, userType: user.userType },
          token: token
        }
      }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // Logout endpoint
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const authHeader = request.headers.get('authorization');
      let userInfo = null;
      
      console.log('🚪 Logout request received');
      console.log('Auth header:', authHeader);
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        
        if (payload && mockSessions.has(token)) {
          userInfo = mockSessions.get(token);
          mockSessions.delete(token);
          console.log(`✅ Session invalidated for user ${userInfo.userId} (${userInfo.userType})`);
        } else {
          console.log('⚠️ Token invalid or session not found');
        }
      } else {
        console.log('⚠️ No auth header provided');
      }
      
      console.log(`✅ Logout completed for ${userInfo ? userInfo.userType : 'unknown'} user`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Logged out successfully',
        userType: userInfo?.userType || null,
        sessionInvalidated: !!userInfo
      }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // 404 for unknown endpoints
    return new Response(JSON.stringify({
      error: { message: 'Endpoint not found' },
      availableEndpoints: [
        'POST /api/auth/{creator|investor|production}/login',
        'POST /api/auth/logout',
        'GET /health',
        'GET /test-logout'
      ]
    }), { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({
      error: { message: 'Internal server error', details: error.message }
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
};

console.log("🚀 Server starting on port 8001...");
await serve(handler, { port: 8001 });