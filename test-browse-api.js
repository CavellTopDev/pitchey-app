/**
 * Test Script for Browse API Endpoints
 * Run this with: node test-browse-api.js
 */

const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
// const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev'; // Production URL
// const API_BASE = 'http://localhost:8001'; // For local testing

async function testBrowseEndpoint(tab, description) {
  console.log(`\n🧪 Testing ${description}...`);
  
  try {
    const url = `${API_BASE}/api/browse?tab=${tab}&limit=10`;
    console.log(`📡 Requesting: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    // Handle nested data structure
    const responseData = data.data || data;
    console.log(`📊 Response:`, {
      success: data.success,
      tab: responseData.tab,
      itemCount: responseData.items?.length || 0,
      total: responseData.total,
      hasMore: responseData.hasMore
    });
    
    if (responseData.items && responseData.items.length > 0) {
      const item = responseData.items[0];
      console.log(`📝 Sample item:`, {
        title: item.title,
        creator: item.creator_name,
        views: item.view_count,
        likes: item.like_count,
        created: item.created_at?.substring(0, 10)
      });
    }
    
    // Verify tab-specific requirements
    if (tab === 'trending' && responseData.items) {
      const hasHighViews = responseData.items.every(item => (item.view_count || 0) > 10);
      const recentItems = responseData.items.filter(item => {
        const created = new Date(item.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return created >= weekAgo;
      });
      console.log(`✅ Trending validation: High views (${hasHighViews}), Recent items (${recentItems.length}/${responseData.items.length})`);
    }
    
    if (tab === 'new' && responseData.items) {
      const recentItems = responseData.items.filter(item => {
        const created = new Date(item.created_at);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return created >= monthAgo;
      });
      console.log(`✅ New validation: Recent items (${recentItems.length}/${responseData.items.length})`);
    }
    
    if (tab === 'popular' && responseData.items) {
      const popularItems = responseData.items.filter(item => 
        (item.view_count || 0) > 50 || (item.like_count || 0) > 20
      );
      console.log(`✅ Popular validation: High engagement items (${popularItems.length}/${responseData.items.length})`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${tab}:`, error.message);
  }
}

async function testPagination() {
  console.log(`\n🧪 Testing pagination...`);
  
  try {
    // Test first page
    const page1Response = await fetch(`${API_BASE}/api/browse?tab=new&limit=5&page=1`);
    const page1Data = await page1Response.json();
    
    // Test second page
    const page2Response = await fetch(`${API_BASE}/api/browse?tab=new&limit=5&page=2`);
    const page2Data = await page2Response.json();
    
    console.log(`✅ Page 1: ${page1Data.items?.length || 0} items`);
    console.log(`✅ Page 2: ${page2Data.items?.length || 0} items`);
    console.log(`✅ HasMore: Page 1 (${page1Data.hasMore}), Page 2 (${page2Data.hasMore})`);
    console.log(`✅ Total: ${page1Data.total}`);
    
    // Verify no duplicate items between pages
    if (page1Data.items && page2Data.items) {
      const page1Ids = page1Data.items.map(item => item.id);
      const page2Ids = page2Data.items.map(item => item.id);
      const duplicates = page1Ids.filter(id => page2Ids.includes(id));
      console.log(`✅ No duplicates between pages: ${duplicates.length === 0}`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing pagination:`, error.message);
  }
}

async function testResponseFormat() {
  console.log(`\n🧪 Testing response format consistency...`);
  
  const tabs = ['trending', 'new', 'popular'];
  
  for (const tab of tabs) {
    try {
      const response = await fetch(`${API_BASE}/api/browse?tab=${tab}&limit=3`);
      const data = await response.json();
      
      const hasRequiredFields = (
        typeof data.success === 'boolean' &&
        Array.isArray(data.items) &&
        typeof data.tab === 'string' &&
        typeof data.total === 'number' &&
        typeof data.page === 'number' &&
        typeof data.limit === 'number' &&
        typeof data.hasMore === 'boolean'
      );
      
      console.log(`✅ ${tab}: Required fields present (${hasRequiredFields})`);
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const hasItemFields = (
          item.id && 
          item.title && 
          item.creator_name !== undefined &&
          typeof item.view_count === 'number' &&
          typeof item.like_count === 'number' &&
          item.created_at
        );
        console.log(`✅ ${tab}: Item fields present (${hasItemFields})`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${tab} format:`, error.message);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting Browse API Tests...');
  console.log(`🌐 API Base: ${API_BASE}`);
  
  // Test each tab
  await testBrowseEndpoint('trending', 'Trending Tab (Last 7 days, view_count > 10)');
  await testBrowseEndpoint('new', 'New Tab (Last 30 days, sorted by date)');
  await testBrowseEndpoint('popular', 'Popular Tab (view_count > 50 OR like_count > 20)');
  
  // Test invalid tab (should default to trending)
  await testBrowseEndpoint('invalid', 'Invalid Tab (should default to trending)');
  
  // Test pagination
  await testPagination();
  
  // Test response format
  await testResponseFormat();
  
  console.log('\n✅ Browse API Tests Completed!');
}

// Run the tests
runAllTests().catch(console.error);