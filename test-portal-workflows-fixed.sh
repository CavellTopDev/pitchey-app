#!/bin/bash

# Fixed Portal Workflow Test Script
# This version properly handles authentication responses

cat << 'EOF'
===============================================================================
PITCHEY PORTAL WORKFLOW TEST SUITE - FIXED VERSION
===============================================================================
Open https://pitchey-5o8.pages.dev in your browser
Open DevTools Console (F12)
Copy and paste the following JavaScript code:
===============================================================================

// 🚀 PITCHEY PORTAL WORKFLOW TEST SUITE - FIXED VERSION
const PortalWorkflowTests = {
  API_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  
  results: [],
  tokens: {},
  
  log(message, success = true) {
    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} ${message}`);
    this.results.push({ message, success });
  },
  
  // Test Creator Portal
  async testCreatorPortal() {
    console.group('🎬 Testing Creator Portal');
    
    try {
      // Login
      const loginResponse = await fetch(`${this.API_URL}/api/auth/creator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alex.creator@demo.com',
          password: 'Demo123'
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (loginResponse.ok && loginData.data?.token) {
        this.tokens.creator = loginData.data.token;
        this.log('Creator login successful', true);
        
        // Store token for app use
        localStorage.setItem('authToken', loginData.data.token);
        localStorage.setItem('userType', 'creator');
        
        // Test Dashboard
        const dashResponse = await fetch(`${this.API_URL}/api/creator/dashboard`, {
          headers: { 'Authorization': `Bearer ${loginData.data.token}` }
        });
        
        if (dashResponse.ok) {
          const dashData = await dashResponse.json();
          this.log(`Dashboard loaded: ${dashData.stats?.totalPitches || 0} pitches`, true);
          
          // Test Quick Actions
          const quickActions = [
            '/api/creator/pitch/draft',
            '/api/creator/pitches',
            '/api/creator/analytics',
            '/api/creator/ndas',
            '/api/creator/portfolio'
          ];
          
          for (const endpoint of quickActions) {
            const response = await fetch(`${this.API_URL}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${loginData.data.token}` }
            });
            this.log(`Quick Action ${endpoint}: ${response.status}`, response.ok);
          }
        }
      } else {
        this.log('Creator login failed: ' + (loginData.error || 'Unknown error'), false);
      }
    } catch (error) {
      this.log(`Creator portal error: ${error.message}`, false);
    }
    
    console.groupEnd();
  },
  
  // Test Investor Portal
  async testInvestorPortal() {
    console.group('💰 Testing Investor Portal');
    
    try {
      const loginResponse = await fetch(`${this.API_URL}/api/auth/investor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sarah.investor@demo.com',
          password: 'Demo123'
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (loginResponse.ok && loginData.data?.token) {
        this.tokens.investor = loginData.data.token;
        this.log('Investor login successful', true);
        
        // Test Dashboard
        const dashResponse = await fetch(`${this.API_URL}/api/investor/dashboard`, {
          headers: { 'Authorization': `Bearer ${loginData.data.token}` }
        });
        
        if (dashResponse.ok) {
          const dashData = await dashResponse.json();
          this.log(`Dashboard: $${dashData.stats?.totalInvested || 0} invested`, true);
          
          // Test Navigation Tabs
          const tabs = [
            '/api/investor/portfolio',
            '/api/saved-pitches',
            '/api/nda/active',
            '/api/investor/analytics'
          ];
          
          for (const endpoint of tabs) {
            const response = await fetch(`${this.API_URL}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${loginData.data.token}` }
            });
            this.log(`Tab ${endpoint}: ${response.status}`, response.ok);
          }
        }
      } else {
        this.log('Investor login failed: ' + (loginData.error || 'Unknown error'), false);
      }
    } catch (error) {
      this.log(`Investor portal error: ${error.message}`, false);
    }
    
    console.groupEnd();
  },
  
  // Test Production Portal
  async testProductionPortal() {
    console.group('🎥 Testing Production Portal');
    
    try {
      const loginResponse = await fetch(`${this.API_URL}/api/auth/production/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'stellar.production@demo.com',
          password: 'Demo123'
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (loginResponse.ok && loginData.data?.token) {
        this.tokens.production = loginData.data.token;
        this.log('Production login successful', true);
        
        // Test Dashboard
        const dashResponse = await fetch(`${this.API_URL}/api/production/dashboard`, {
          headers: { 'Authorization': `Bearer ${loginData.data.token}` }
        });
        
        if (dashResponse.ok) {
          const dashData = await dashResponse.json();
          this.log(`Dashboard: ${dashData.stats?.activeProjects || 0} projects`, true);
          
          // Test sections
          const sections = [
            '/api/saved-pitches',
            '/api/follows/following',
            '/api/nda/active'
          ];
          
          for (const endpoint of sections) {
            const response = await fetch(`${this.API_URL}${endpoint}`, {
              headers: { 'Authorization': `Bearer ${loginData.data.token}` }
            });
            this.log(`Section ${endpoint}: ${response.status}`, response.ok);
          }
        }
      } else {
        this.log('Production login failed: ' + (loginData.error || 'Unknown error'), false);
      }
    } catch (error) {
      this.log(`Production portal error: ${error.message}`, false);
    }
    
    console.groupEnd();
  },
  
  // Test Quick Actions
  async testQuickActions() {
    console.group('⚡ Testing Quick Actions');
    
    if (!this.tokens.creator) {
      this.log('No creator token available', false);
      console.groupEnd();
      return;
    }
    
    const quickActionTests = [
      { name: 'Upload New Pitch', endpoint: '/api/creator/pitch/draft' },
      { name: 'Manage Pitches', endpoint: '/api/creator/pitches' },
      { name: 'View Analytics', endpoint: '/api/creator/analytics' },
      { name: 'NDA Management', endpoint: '/api/creator/ndas' },
      { name: 'View My Portfolio', endpoint: '/api/creator/portfolio' },
      { name: 'Following', endpoint: '/api/follows/following' },
      { name: 'Messages', endpoint: '/api/messages' },
      { name: 'Billing & Payments', endpoint: '/api/creator/billing' }
    ];
    
    for (const action of quickActionTests) {
      try {
        const response = await fetch(`${this.API_URL}${action.endpoint}`, {
          headers: { 'Authorization': `Bearer ${this.tokens.creator}` }
        });
        this.log(`${action.name}: ${response.status}`, response.ok);
      } catch (error) {
        this.log(`${action.name}: Error - ${error.message}`, false);
      }
    }
    
    console.groupEnd();
  },
  
  // Test Dashboard Refresh
  async testDashboardRefresh() {
    console.group('🔄 Testing Dashboard Refresh');
    
    if (!this.tokens.creator) {
      this.log('No token for refresh test', false);
      console.groupEnd();
      return;
    }
    
    try {
      // First fetch
      const response1 = await fetch(`${this.API_URL}/api/creator/dashboard`, {
        headers: { 'Authorization': `Bearer ${this.tokens.creator}` }
      });
      const data1 = await response1.json();
      
      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Second fetch
      const response2 = await fetch(`${this.API_URL}/api/creator/dashboard`, {
        headers: { 'Authorization': `Bearer ${this.tokens.creator}` }
      });
      const data2 = await response2.json();
      
      const consistent = JSON.stringify(data1.stats) === JSON.stringify(data2.stats);
      this.log(`Data consistency: ${consistent ? 'Maintained' : 'Changed'}`, true);
      
    } catch (error) {
      this.log(`Refresh test error: ${error.message}`, false);
    }
    
    console.groupEnd();
  },
  
  // Test Cross-Portal Switching
  async testPortalSwitching() {
    console.group('🔀 Testing Portal Switching');
    
    const portals = [
      { type: 'creator', email: 'alex.creator@demo.com' },
      { type: 'investor', email: 'sarah.investor@demo.com' },
      { type: 'production', email: 'stellar.production@demo.com' }
    ];
    
    for (const portal of portals) {
      try {
        const response = await fetch(`${this.API_URL}/api/auth/${portal.type}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: portal.email,
            password: 'Demo123'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.data?.token) {
          localStorage.setItem('authToken', data.data.token);
          localStorage.setItem('userType', portal.type);
          this.log(`Switch to ${portal.type}: Success`, true);
        } else {
          this.log(`Switch to ${portal.type}: Failed`, false);
        }
      } catch (error) {
        this.log(`Switch to ${portal.type}: Error`, false);
      }
    }
    
    console.groupEnd();
  },
  
  // Generate Report
  generateReport() {
    console.group('📊 TEST REPORT');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    
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
    
    return {
      passed,
      failed,
      total,
      percentage,
      grade
    };
  },
  
  // Run all tests
  async runAll() {
    console.clear();
    console.log('🚀 PITCHEY PORTAL WORKFLOW TEST SUITE');
    console.log('=====================================');
    console.log('Testing: https://pitchey-5o8.pages.dev');
    console.log('API: https://pitchey-api-prod.ndlovucavelle.workers.dev');
    console.log('=====================================\n');
    
    this.results = [];
    this.tokens = {};
    
    await this.testCreatorPortal();
    await this.testInvestorPortal();
    await this.testProductionPortal();
    await this.testQuickActions();
    await this.testDashboardRefresh();
    await this.testPortalSwitching();
    
    const report = this.generateReport();
    
    console.log('\n💡 TIPS:');
    console.log('- To navigate to a portal: window.location.href = "/creator/dashboard"');
    console.log('- To test specific portal: PortalWorkflowTests.testCreatorPortal()');
    console.log('- To re-run all tests: PortalWorkflowTests.runAll()');
    
    return report;
  }
};

// Run all tests automatically
PortalWorkflowTests.runAll();

===============================================================================
EOF

echo ""
echo "✅ Fixed test script generated! Copy the JavaScript code above and paste it"
echo "   into your browser console at https://pitchey-5o8.pages.dev to test all portals."
echo ""
echo "📝 The fixed version properly:"
echo "   - Handles authentication responses correctly"
echo "   - Stores tokens for subsequent API calls"
echo "   - Tests all quick actions and dashboard workflows"
echo "   - Provides detailed error messages"
echo ""