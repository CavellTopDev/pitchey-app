#!/usr/bin/env node

// Simple test script to verify content API integration
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8001';

async function testEndpoint(path, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${API_BASE}${path}`);
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ ${description} - API responding correctly`);
      console.log(`📊 Data keys: ${Object.keys(data.data || {}).join(', ')}`);
      return true;
    } else {
      console.log(`❌ ${description} - API returned success=false`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Content API Endpoints\n');
  console.log('='.repeat(50));
  
  const tests = [
    ['/api/content/how-it-works', 'How It Works content'],
    ['/api/content/about', 'About content'],
    ['/api/content/team', 'Team content'],
    ['/api/content/stats', 'Stats content']
  ];
  
  let passed = 0;
  
  for (const [path, description] of tests) {
    const success = await testEndpoint(path, description);
    if (success) passed++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📈 Results: ${passed}/${tests.length} tests passed`);
  
  if (passed === tests.length) {
    console.log('🎉 All content API endpoints are working!');
    console.log('\n✨ The updated How It Works and About pages should now:');
    console.log('   • Load content from backend APIs');
    console.log('   • Show loading states while fetching');
    console.log('   • Fall back to hardcoded content if API fails');
    console.log('   • Cache content for 5 minutes');
  } else {
    console.log('⚠️  Some endpoints failed - pages will use fallback content');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}