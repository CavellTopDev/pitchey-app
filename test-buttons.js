const puppeteer = require('puppeteer');

async function testQuickActionButtons() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to login
    await page.goto('https://pitchey.pages.dev/login/creator');
    
    // Login
    await page.type('input[type="email"]', 'alex.creator@demo.com');
    await page.type('input[type="password"]', 'Demo123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForNavigation();
    await page.waitForSelector('h2:contains("Quick Actions")', { timeout: 5000 });
    
    // Test each Quick Action button
    const buttons = [
        { text: 'Upload New Pitch', expectedUrl: '/creator/pitch/new' },
        { text: 'Manage Pitches', expectedUrl: '/creator/pitches' },
        { text: 'View Analytics', expectedUrl: '/creator/analytics' },
        { text: 'NDA Management', expectedUrl: '/creator/ndas' },
        { text: 'View My Portfolio', expectedUrl: '/creator/portfolio' },
        { text: 'Following', expectedUrl: '/creator/following' },
        { text: 'Messages', expectedUrl: '/creator/messages' },
        { text: 'Calendar', expectedUrl: '/creator/calendar' },
        { text: 'Billing', expectedUrl: '/creator/billing' }
    ];
    
    for (const button of buttons) {
        try {
            await page.click(`button:contains("${button.text}")`);
            await page.waitForTimeout(1000);
            const url = page.url();
            if (url.includes(button.expectedUrl)) {
                console.log(`✓ ${button.text} - Navigated correctly`);
            } else {
                console.log(`✗ ${button.text} - Wrong destination: ${url}`);
            }
            // Go back to dashboard
            await page.goto('https://pitchey.pages.dev/creator/dashboard');
        } catch (e) {
            console.log(`✗ ${button.text} - Error: ${e.message}`);
        }
    }
    
    await browser.close();
}

testQuickActionButtons();
