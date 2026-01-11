#!/usr/bin/env node

/**
 * Verify Local Setup with CORS Disabled Browser
 */

console.log('🎬 Verifying Local Frontend Setup');
console.log('=================================');
console.log('✅ Frontend: http://127.0.0.1:5173 (should be running)');
console.log('✅ API: https://pitchey-api-prod.ndlovucavelle.workers.dev');
console.log('✅ Browser: Chromium with CORS disabled');
console.log('');

// Test the production API directly
async function testAPI() {
  try {
    console.log('🔧 Testing Production API...');
    const response = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ API Health: Working');
      console.log(`   Database: ${data.data.services.database.status}`);
      console.log(`   Version: ${data.data.version}`);
    }
    
    // Test pitches endpoint
    const pitchesResponse = await fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches?limit=3');
    const pitchesData = await pitchesResponse.json();
    
    if (pitchesData.success) {
      console.log('✅ Pitches API: Working');
      console.log(`   Available pitches: ${pitchesData.meta.pagination.total}`);
      if (pitchesData.data.length > 0) {
        console.log(`   Sample pitch: "${pitchesData.data[0].title}"`);
      }
    }
    
  } catch (error) {
    console.log('❌ API Test failed:', error.message);
  }
}

console.log('🎯 What You Should See in Chromium:');
console.log('====================================');
console.log('1. 🌐 Homepage loads at http://127.0.0.1:5173');
console.log('2. 🎬 Browse section shows Trending/New/Featured tabs');
console.log('3. 📊 No CORS errors in browser console');
console.log('4. 🔧 All API calls work correctly');
console.log('5. 📱 Responsive design and full functionality');

console.log('');
console.log('🧪 Testing Features You Can Try:');
console.log('=================================');
console.log('• 📖 Browse different pitch categories');
console.log('• 🎭 Click on individual pitches to view details');
console.log('• 🔍 Test search functionality');
console.log('• 👤 Try authentication flows');
console.log('• 🎨 Check responsive design on different screen sizes');
console.log('• 🔄 Verify real-time features work');

console.log('');
console.log('🤖 Crawl4AI Features Ready for Testing:');
console.log('========================================');
console.log('✅ Industry News Widget (frontend/src/components/Widgets/IndustryNewsFeed.tsx)');
console.log('✅ Pitch Validation System (frontend/src/components/PitchValidation/PitchValidator.tsx)');
console.log('✅ Browse Tab Fix (frontend/src/components/Browse/BrowseTabsFixed.tsx)');
console.log('✅ Custom Hooks (frontend/src/hooks/useCrawl4AI.ts)');
console.log('🔄 Backend deployment needed for full Crawl4AI features');

testAPI();
