// Detailed Frontend Testing
// Check for any client-side issues, WebSocket problems, or console errors

async function testFrontendDetailed() {
  console.log('🔍 DETAILED FRONTEND TESTING');
  console.log('═══════════════════════════════');
  
  // Test 1: HTML Structure
  console.log('\n📄 Step 1: HTML Structure Analysis');
  const htmlResponse = await fetch('https://pitchey-5o8.pages.dev/');
  const html = await htmlResponse.text();
  
  console.log(`HTML size: ${html.length} bytes`);
  console.log(`Status: ${htmlResponse.status}`);
  
  // Extract key information
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const scriptMatches = html.match(/src="([^"]*\.js[^"]*)"/g);
  const cssMatches = html.match(/href="([^"]*\.css[^"]*)"/g);
  
  console.log(`Title: ${titleMatch ? titleMatch[1] : 'Not found'}`);
  console.log(`Script files: ${scriptMatches ? scriptMatches.length : 0}`);
  console.log(`CSS files: ${cssMatches ? cssMatches.length : 0}`);
  
  if (scriptMatches) {
    console.log('Script URLs:');
    scriptMatches.forEach(match => {
      const url = match.match(/src="([^"]*)"/)[1];
      console.log(`  - ${url}`);
    });
  }
  
  // Test 2: Asset Accessibility
  console.log('\n📦 Step 2: Asset Accessibility Test');
  
  const assetUrls = [];
  if (scriptMatches) {
    scriptMatches.forEach(match => {
      const url = match.match(/src="([^"]*)"/)[1];
      if (!url.startsWith('http')) {
        assetUrls.push('https://pitchey-5o8.pages.dev' + url);
      } else {
        assetUrls.push(url);
      }
    });
  }
  
  if (cssMatches) {
    cssMatches.forEach(match => {
      const url = match.match(/href="([^"]*)"/)[1];
      if (!url.startsWith('http')) {
        assetUrls.push('https://pitchey-5o8.pages.dev' + url);
      } else {
        assetUrls.push(url);
      }
    });
  }
  
  for (const url of assetUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`✅ ${url}: ${response.status} (${response.headers.get('content-length')} bytes)`);
    } catch (error) {
      console.log(`❌ ${url}: Failed - ${error.message}`);
    }
  }
  
  // Test 3: API Configuration Check
  console.log('\n🔗 Step 3: API Configuration Analysis');
  
  // Download and analyze the main JS bundle to check API configuration
  if (assetUrls.length > 0) {
    const mainJsUrl = assetUrls.find(url => url.includes('.js'));
    if (mainJsUrl) {
      try {
        const jsResponse = await fetch(mainJsUrl);
        const jsContent = await jsResponse.text();
        
        // Look for API URLs
        const apiUrlMatches = jsContent.match(/https:\/\/[^"'\s]*(pitchey-backend|api)[^"'\s]*/g);
        const wsUrlMatches = jsContent.match(/wss?:\/\/[^"'\s]*(pitchey-backend|ws)[^"'\s]*/g);
        
        console.log('API URLs found in bundle:');
        if (apiUrlMatches) {
          [...new Set(apiUrlMatches)].forEach(url => console.log(`  📡 ${url}`));
        } else {
          console.log('  ⚠️ No API URLs detected');
        }
        
        console.log('WebSocket URLs found in bundle:');
        if (wsUrlMatches) {
          [...new Set(wsUrlMatches)].forEach(url => console.log(`  🔌 ${url}`));
        } else {
          console.log('  ⚠️ No WebSocket URLs detected');
        }
        
        // Check for specific error patterns
        const errorPatterns = [
          'WebSocket',
          'infinite',
          'retry',
          'Error',
          'failed',
          'VITE_API_URL',
          'localhost'
        ];
        
        console.log('\n🔍 Step 4: Code Pattern Analysis');
        errorPatterns.forEach(pattern => {
          const matches = jsContent.match(new RegExp(pattern, 'gi'));
          if (matches) {
            console.log(`  📊 "${pattern}": ${matches.length} occurrences`);
          }
        });
        
        // Check for environment variables
        if (jsContent.includes('localhost')) {
          console.log('  ⚠️ WARNING: localhost references found - possible development config');
        }
        
        if (jsContent.includes('VITE_API_URL')) {
          console.log('  ℹ️ VITE_API_URL references found - check build-time configuration');
        }
        
      } catch (error) {
        console.log(`❌ Failed to analyze JS bundle: ${error.message}`);
      }
    }
  }
  
  // Test 4: Real Browser Simulation
  console.log('\n🌐 Step 4: Browser Environment Simulation');
  
  // Simulate what happens when a browser loads the page
  try {
    const response = await fetch('https://pitchey-5o8.pages.dev/', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Deno Test) WebKit/537.36 Chrome/91.0.4472.124'
      }
    });
    
    const headers = response.headers;
    console.log('Response headers:');
    console.log(`  Content-Type: ${headers.get('content-type')}`);
    console.log(`  Content-Length: ${headers.get('content-length')}`);
    console.log(`  Cache-Control: ${headers.get('cache-control')}`);
    console.log(`  Server: ${headers.get('server')}`);
    
    // Check for CSP issues
    const csp = headers.get('content-security-policy');
    if (csp) {
      console.log('  CSP Policy present - checking WebSocket permissions...');
      if (csp.includes('pitchey-backend-fresh.deno.dev')) {
        console.log('  ✅ Backend domain allowed in CSP');
      } else {
        console.log('  ⚠️ Backend domain might be blocked by CSP');
      }
    }
    
  } catch (error) {
    console.log(`❌ Browser simulation failed: ${error.message}`);
  }
  
  console.log('\n═══════════════════════════════');
  console.log('✅ Frontend detailed analysis complete');
}

// Run the test
if (import.meta.main) {
  testFrontendDetailed().catch(console.error);
}