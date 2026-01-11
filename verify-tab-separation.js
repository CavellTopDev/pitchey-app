#!/usr/bin/env node

// Quick verification script to test tab separation in Marketplace

const axios = require('axios');

const API_BASE = 'http://localhost:8001/api';

async function testTabSeparation() {
  console.log('🔍 Verifying Tab Separation in Marketplace\n');
  
  try {
    // Test 1: Fetch trending pitches
    console.log('1. Testing Trending Tab Data:');
    const trendingResponse = await axios.get(`${API_BASE}/pitches/trending?limit=3`);
    const trendingPitches = trendingResponse.data.data || trendingResponse.data.pitches || [];
    console.log(`   ✅ Found ${trendingPitches.length} trending pitches`);
    if (trendingPitches.length > 0) {
      console.log(`   📊 Top trending: "${trendingPitches[0].title}" with ${trendingPitches[0].viewCount || 0} views`);
    }
    
    // Test 2: Fetch new releases
    console.log('\n2. Testing New Tab Data:');
    const newResponse = await axios.get(`${API_BASE}/pitches/new?limit=3`);
    const newPitches = newResponse.data.data || newResponse.data.pitches || [];
    console.log(`   ✅ Found ${newPitches.length} new pitches`);
    if (newPitches.length > 0) {
      const date = new Date(newPitches[0].createdAt);
      console.log(`   📅 Latest: "${newPitches[0].title}" created ${date.toLocaleDateString()}`);
    }
    
    // Test 3: Test browse with search
    console.log('\n3. Testing Browse Tab with Search:');
    const searchResponse = await axios.get(`${API_BASE}/search?q=horizon&limit=3`);
    const searchResults = searchResponse.data.data || searchResponse.data.results || [];
    console.log(`   ✅ Search for "horizon" returned ${searchResults.length} results`);
    
    // Test 4: Verify data independence
    console.log('\n4. Verifying Data Independence:');
    
    // Check that trending and new have different sorting
    if (trendingPitches.length > 0 && newPitches.length > 0) {
      const trendingIds = trendingPitches.map(p => p.id);
      const newIds = newPitches.map(p => p.id);
      
      // They might have some overlap but order should be different
      const trendingOrder = trendingIds.join(',');
      const newOrder = newIds.join(',');
      
      if (trendingOrder !== newOrder) {
        console.log('   ✅ Trending and New tabs have different sorting/content');
      } else {
        console.log('   ⚠️  Trending and New tabs have identical ordering (might need investigation)');
      }
    }
    
    console.log('\n✨ Tab Separation Verification Complete!');
    console.log('\n📝 Manual Testing Checklist:');
    console.log('   [ ] Open http://localhost:5173/marketplace');
    console.log('   [ ] Click on TRENDING tab - verify it shows high-view content');
    console.log('   [ ] Click on NEW tab - verify it shows recent content');
    console.log('   [ ] Click on BROWSE tab - try applying filters');
    console.log('   [ ] Switch back to TRENDING - verify filters don\'t affect it');
    console.log('   [ ] Switch to BROWSE - verify filters are still applied');
    console.log('   [ ] Check browser console for any errors');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run the verification
testTabSeparation().catch(console.error);