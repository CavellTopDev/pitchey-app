// Test script to check what's rendering on the frontend
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Testing Pitchey Frontend Display...\n');
  
  // Test Homepage
  console.log('1. Homepage (https://pitchey-frontend.deno.dev)');
  await page.goto('https://pitchey-frontend.deno.dev', { waitUntil: 'networkidle2' });
  
  // Wait for React to render
  await page.waitForTimeout(3000);
  
  // Get page content
  const homeContent = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.innerText.substring(0, 500),
      hasNavigation: !!document.querySelector('nav'),
      hasPitches: !!document.querySelector('[class*="pitch"]'),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText),
      links: Array.from(document.querySelectorAll('a')).map(a => a.innerText).filter(t => t)
    };
  });
  
  console.log('  Title:', homeContent.title);
  console.log('  Has Navigation:', homeContent.hasNavigation);
  console.log('  Has Pitches:', homeContent.hasPitches);
  console.log('  Buttons found:', homeContent.buttons);
  console.log('  Links found:', homeContent.links);
  console.log('  Body preview:', homeContent.bodyText);
  
  // Test Marketplace
  console.log('\n2. Marketplace (https://pitchey-frontend.deno.dev/marketplace)');
  await page.goto('https://pitchey-frontend.deno.dev/marketplace', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000);
  
  const marketContent = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText.substring(0, 500),
      pitchCount: document.querySelectorAll('[class*="pitch"]').length,
      hasFilters: !!document.querySelector('[class*="filter"]'),
      hasSearch: !!document.querySelector('input[type="search"], input[placeholder*="search" i]')
    };
  });
  
  console.log('  Pitch count:', marketContent.pitchCount);
  console.log('  Has filters:', marketContent.hasFilters);
  console.log('  Has search:', marketContent.hasSearch);
  console.log('  Body preview:', marketContent.bodyText);
  
  // Check for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('  Console error:', msg.text());
    }
  });
  
  await browser.close();
})();
