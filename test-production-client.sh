#!/bin/bash

# Pitchey Production Client-Side Test Script
# This script generates browser console commands to test the production environment
# Run this script to get JavaScript code you can paste into your browser console

cat << 'EOF'
===============================================================================
PITCHEY PRODUCTION TEST SUITE
===============================================================================
Open https://pitchey-5o8.pages.dev in your browser
Open DevTools Console (F12)
Copy and paste the following JavaScript code:
===============================================================================

// 🚀 PITCHEY PRODUCTION TEST SUITE
// Run this in your browser console at https://pitchey-5o8.pages.dev

const PitcheyProductionTests = {
  API_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  WS_URL: 'wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws',
  
  // Test results storage
  results: [],
  
  // Log helper
  log(message, success = true) {
    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} ${message}`);
    this.results.push({ message, success });
  },
  
  // 1. Test API Health
  async testHealth() {
    console.group('🏥 API Health Check');
    try {
      const response = await fetch(`${this.API_URL}/api/health`);
      const data = await response.json();
      this.log(`API is ${data.status || 'responding'}`, true);
    } catch (error) {
      this.log(`API health check failed: ${error.message}`, false);
    }
    console.groupEnd();
  },
  
  // 2. Test All Three Portals Login
  async testAllLogins() {
    console.group('🔐 Testing All Portal Logins');
    
    const logins = [
      { type: 'creator', email: 'alex.creator@demo.com', name: 'Alex (Creator)' },
      { type: 'investor', email: 'sarah.investor@demo.com', name: 'Sarah (Investor)' },
      { type: 'production', email: 'stellar.production@demo.com', name: 'Stellar (Production)' }
    ];
    
    for (const login of logins) {
      try {
        const response = await fetch(`${this.API_URL}/api/auth/${login.type}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: login.email, password: 'Demo123' })
        });
        
        const data = await response.json();
        if (data.token) {
          this.log(`${login.name} login successful`, true);
          
          // Store the last successful token for further tests
          if (login.type === 'creator') {
            this.creatorToken = data.token;
          }
        } else {
          this.log(`${login.name} login failed`, false);
        }
      } catch (error) {
        this.log(`${login.name} login error: ${error.message}`, false);
      }
    }
    console.groupEnd();
  },
  
  // 3. Test Public Endpoints
  async testPublicEndpoints() {
    console.group('🌍 Testing Public Endpoints');
    
    const endpoints = [
      '/api/pitches',
      '/api/pitches/trending',
      '/api/pitches/featured'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.API_URL}${endpoint}`);
        const data = await response.json();
        const count = data.data?.length || 0;
        this.log(`${endpoint}: ${count} items`, response.ok);
      } catch (error) {
        this.log(`${endpoint} failed: ${error.message}`, false);
      }
    }
    console.groupEnd();
  },
  
  // 4. Test Authenticated Endpoints
  async testAuthenticatedEndpoints() {
    console.group('🔒 Testing Authenticated Endpoints');
    
    if (!this.creatorToken) {
      this.log('No auth token available - skipping authenticated tests', false);
      console.groupEnd();
      return;
    }
    
    const endpoints = [
      '/api/creator/dashboard',
      '/api/user/profile',
      '/api/notifications'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.API_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${this.creatorToken}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.log(`${endpoint}: Success`, true);
        } else {
          this.log(`${endpoint}: ${response.status} ${response.statusText}`, false);
        }
      } catch (error) {
        this.log(`${endpoint} error: ${error.message}`, false);
      }
    }
    console.groupEnd();
  },
  
  // 5. Test WebSocket Connection
  async testWebSocket() {
    console.group('🔌 Testing WebSocket Connection');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.WS_URL);
      let timeout = setTimeout(() => {
        this.log('WebSocket connection timeout', false);
        ws.close();
        console.groupEnd();
        resolve();
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        this.log('WebSocket connected successfully', true);
        
        // Send auth if we have a token
        if (this.creatorToken) {
          ws.send(JSON.stringify({
            type: 'auth',
            token: this.creatorToken
          }));
          this.log('WebSocket authentication sent', true);
        }
        
        setTimeout(() => {
          ws.close();
          console.groupEnd();
          resolve();
        }, 1000);
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        this.log(`WebSocket error: ${error.type}`, false);
        console.groupEnd();
        resolve();
      };
      
      ws.onmessage = (event) => {
        this.log(`WebSocket message received: ${event.data.substring(0, 50)}...`, true);
      };
    });
  },
  
  // 6. Test Browse Tab Functionality
  async testBrowseTabs() {
    console.group('📑 Testing Browse Tab Filtering');
    
    const tabs = ['trending', 'latest', 'featured'];
    
    for (const tab of tabs) {
      try {
        const endpoint = tab === 'latest' ? '/api/pitches' : `/api/pitches/${tab}`;
        const response = await fetch(`${this.API_URL}${endpoint}`);
        const data = await response.json();
        
        if (response.ok && data.data) {
          this.log(`${tab.charAt(0).toUpperCase() + tab.slice(1)} tab: ${data.data.length} pitches`, true);
        } else {
          this.log(`${tab} tab failed to load`, false);
        }
      } catch (error) {
        this.log(`${tab} tab error: ${error.message}`, false);
      }
    }
    console.groupEnd();
  },
  
  // 7. Test Search Functionality
  async testSearch() {
    console.group('🔍 Testing Search Features');
    
    const searches = [
      { query: 'action', type: 'genre' },
      { query: 'space', type: 'keyword' },
      { query: 'trending', type: 'filter' }
    ];
    
    for (const search of searches) {
      try {
        const url = search.type === 'genre' 
          ? `${this.API_URL}/api/pitches?genre=${search.query}`
          : `${this.API_URL}/api/pitches?search=${search.query}`;
          
        const response = await fetch(url);
        const data = await response.json();
        const count = data.data?.length || 0;
        
        this.log(`Search "${search.query}" (${search.type}): ${count} results`, response.ok);
      } catch (error) {
        this.log(`Search "${search.query}" failed: ${error.message}`, false);
      }
    }
    console.groupEnd();
  },
  
  // 8. Generate Report
  generateReport() {
    console.group('📊 TEST REPORT');
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`Tests Passed: ${passed}/${total} (${percentage}%)`);
    console.log(`Tests Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.message}`);
      });
    }
    
    const grade = percentage >= 90 ? '🏆 EXCELLENT' :
                 percentage >= 70 ? '✅ GOOD' :
                 percentage >= 50 ? '⚠️ NEEDS IMPROVEMENT' :
                 '❌ CRITICAL ISSUES';
    
    console.log(`\nOverall Grade: ${grade}`);
    console.groupEnd();
  },
  
  // Run all tests
  async runAll() {
    console.clear();
    console.log('🚀 PITCHEY PRODUCTION TEST SUITE');
    console.log('=================================');
    console.log('Testing: https://pitchey-5o8.pages.dev');
    console.log('API: https://pitchey-api-prod.ndlovucavelle.workers.dev');
    console.log('=================================\n');
    
    this.results = [];
    
    await this.testHealth();
    await this.testAllLogins();
    await this.testPublicEndpoints();
    await this.testAuthenticatedEndpoints();
    await this.testWebSocket();
    await this.testBrowseTabs();
    await this.testSearch();
    
    this.generateReport();
    
    console.log('\n💡 TIP: Check specific features by running:');
    console.log('  PitcheyProductionTests.testHealth()');
    console.log('  PitcheyProductionTests.testAllLogins()');
    console.log('  PitcheyProductionTests.testWebSocket()');
    
    return this.results;
  }
};

// Run all tests automatically
PitcheyProductionTests.runAll();

// Also available for individual testing:
// PitcheyProductionTests.testHealth()
// PitcheyProductionTests.testAllLogins()
// PitcheyProductionTests.testPublicEndpoints()
// PitcheyProductionTests.testAuthenticatedEndpoints()
// PitcheyProductionTests.testWebSocket()
// PitcheyProductionTests.testBrowseTabs()
// PitcheyProductionTests.testSearch()

===============================================================================
EOF

echo ""
echo "✅ Test script generated! Copy the JavaScript code above and paste it into"
echo "   your browser console at https://pitchey-5o8.pages.dev to test the platform."
echo ""
echo "📝 You can also save the JavaScript code to a file:"
echo "   ./test-production-client.sh > production-tests.js"
echo ""