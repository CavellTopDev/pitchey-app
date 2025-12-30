/**
 * Core Web Vitals and Performance Monitoring Script
 * Uses Lighthouse and Puppeteer for comprehensive frontend performance testing
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Performance budgets and thresholds
const PERFORMANCE_BUDGETS = {
  // Core Web Vitals thresholds (Google's recommended values)
  coreWebVitals: {
    LCP: 2500,    // Largest Contentful Paint (ms)
    FID: 100,     // First Input Delay (ms) 
    CLS: 0.1,     // Cumulative Layout Shift
    FCP: 1800,    // First Contentful Paint (ms)
    TTI: 3800,    // Time to Interactive (ms)
    TBT: 300,     // Total Blocking Time (ms)
    SI: 3400,     // Speed Index (ms)
  },

  // Lighthouse scores (0-100)
  lighthouseScores: {
    performance: 90,
    accessibility: 95, 
    bestPractices: 90,
    seo: 90,
    pwa: 80,
  },

  // Resource budgets
  resourceBudgets: {
    totalSize: 2000000,      // 2MB total
    jsSize: 800000,          // 800KB JavaScript
    cssSize: 200000,         // 200KB CSS
    imageSize: 1000000,      // 1MB images
    fontSize: 100000,        // 100KB fonts
    requestCount: 50,        // Max 50 requests
  },

  // Network performance (3G simulation)
  networkBudgets: {
    downloadThroughput: 1600000,  // 1.6Mbps
    uploadThroughput: 750000,     // 750Kbps  
    latency: 150,                 // 150ms RTT
  },
};

// Test URLs with different user scenarios
const TEST_SCENARIOS = [
  {
    name: 'Homepage (Anonymous)',
    url: 'https://pitchey-5o8.pages.dev',
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g',
    category: 'marketing',
  },
  {
    name: 'Browse Pitches (Anonymous)', 
    url: 'https://pitchey-5o8.pages.dev/browse',
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g',
    category: 'discovery',
  },
  {
    name: 'Login Page',
    url: 'https://pitchey-5o8.pages.dev/auth/login',
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g',
    category: 'auth',
  },
  {
    name: 'Creator Dashboard (Authenticated)',
    url: 'https://pitchey-5o8.pages.dev/creator/dashboard', 
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g',
    category: 'dashboard',
    requiresAuth: true,
    userType: 'creator',
  },
  {
    name: 'Investor Portfolio (Authenticated)',
    url: 'https://pitchey-5o8.pages.dev/investor/portfolio',
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g', 
    category: 'dashboard',
    requiresAuth: true,
    userType: 'investor',
  },
  {
    name: 'Pitch Detail Page',
    url: 'https://pitchey-5o8.pages.dev/pitch/1',
    viewport: { width: 1366, height: 768 },
    throttling: 'fast3g',
    category: 'content',
  },
  {
    name: 'Mobile Homepage',
    url: 'https://pitchey-5o8.pages.dev',
    viewport: { width: 375, height: 667 }, // iPhone SE
    throttling: 'slow3g',
    category: 'mobile',
    isMobile: true,
  },
  {
    name: 'Mobile Browse',
    url: 'https://pitchey-5o8.pages.dev/browse',
    viewport: { width: 375, height: 667 },
    throttling: 'slow3g',
    category: 'mobile',
    isMobile: true,
  },
];

// Demo user credentials
const DEMO_CREDENTIALS = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
  investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123' },
};

class PerformanceAnalyzer {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.reportDir = path.join(__dirname, '../reports');
  }

  async ensureReportDirectory() {
    try {
      await fs.mkdir(this.reportDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  async runLighthouseAudit(url, options = {}) {
    console.log(`Running Lighthouse audit for: ${url}`);
    
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
    });

    const lighthouseOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
      formFactor: options.isMobile ? 'mobile' : 'desktop',
      throttling: {
        requestLatencyMs: options.throttling === 'slow3g' ? 562.5 : 150,
        downloadThroughputKbps: options.throttling === 'slow3g' ? 400 : 1600,
        uploadThroughputKbps: options.throttling === 'slow3g' ? 400 : 750,
        cpuSlowdownMultiplier: options.throttling === 'slow3g' ? 4 : 1,
      },
      screenEmulation: {
        mobile: options.isMobile || false,
        width: options.viewport?.width || 1366,
        height: options.viewport?.height || 768,
        deviceScaleFactor: options.isMobile ? 2 : 1,
        disabled: false,
      },
    };

    try {
      const runnerResult = await lighthouse(url, lighthouseOptions);
      await chrome.kill();
      
      return runnerResult.lhr;
    } catch (error) {
      await chrome.kill();
      throw error;
    }
  }

  async authenticateUser(page, userType) {
    console.log(`Authenticating as ${userType}...`);
    
    const credentials = DEMO_CREDENTIALS[userType];
    if (!credentials) {
      throw new Error(`No credentials found for user type: ${userType}`);
    }

    // Navigate to login page
    await page.goto('https://pitchey-5o8.pages.dev/auth/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.type('input[type="email"]', credentials.email);
    await page.type('input[type="password"]', credentials.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    
    console.log(`Successfully authenticated as ${userType}`);
  }

  async runRealUserMetrics(scenario) {
    console.log(`Running Real User Metrics for: ${scenario.name}`);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport(scenario.viewport);
      
      // Network throttling
      const client = await page.target().createCDPSession();
      if (scenario.throttling) {
        const throttling = scenario.throttling === 'slow3g' 
          ? { latency: 562.5, downloadThroughput: 50000, uploadThroughput: 50000 }
          : { latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 };
        
        await client.send('Network.emulateNetworkConditions', {
          offline: false,
          ...throttling,
        });
      }

      // Enable performance monitoring
      await page.evaluateOnNewDocument(() => {
        window.performanceMetrics = {
          navigationStart: 0,
          loadEventEnd: 0,
          firstPaint: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          firstInputDelay: 0,
          cumulativeLayoutShift: 0,
        };

        // Performance observer for Core Web Vitals
        if ('PerformanceObserver' in window) {
          // LCP observer
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            window.performanceMetrics.largestContentfulPaint = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });

          // FID observer
          new PerformanceObserver((entryList) => {
            entryList.getEntries().forEach((entry) => {
              if (entry.name === 'first-input') {
                window.performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
              }
            });
          }).observe({ entryTypes: ['first-input'] });

          // CLS observer  
          let clsValue = 0;
          new PerformanceObserver((entryList) => {
            entryList.getEntries().forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            window.performanceMetrics.cumulativeLayoutShift = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });

          // Paint timing
          new PerformanceObserver((entryList) => {
            entryList.getEntries().forEach((entry) => {
              if (entry.name === 'first-paint') {
                window.performanceMetrics.firstPaint = entry.startTime;
              } else if (entry.name === 'first-contentful-paint') {
                window.performanceMetrics.firstContentfulPaint = entry.startTime;
              }
            });
          }).observe({ entryTypes: ['paint'] });
        }
      });

      // Authenticate if required
      if (scenario.requiresAuth) {
        await this.authenticateUser(page, scenario.userType);
      }

      // Navigate to target page
      const startTime = Date.now();
      await page.goto(scenario.url, { waitUntil: 'networkidle0', timeout: 30000 });
      const loadTime = Date.now() - startTime;

      // Wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Collect performance metrics
      const navigationTiming = await page.evaluate(() => {
        const timing = performance.timing;
        return {
          navigationStart: timing.navigationStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          ttfb: timing.responseStart - timing.navigationStart,
        };
      });

      const webVitals = await page.evaluate(() => window.performanceMetrics || {});

      // Collect resource metrics
      const resources = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const summary = {
          totalSize: 0,
          jsSize: 0,
          cssSize: 0,
          imageSize: 0,
          fontSize: 0,
          requestCount: resources.length,
          resources: [],
        };

        resources.forEach(resource => {
          const size = resource.transferSize || 0;
          summary.totalSize += size;
          
          if (resource.name.includes('.js')) summary.jsSize += size;
          else if (resource.name.includes('.css')) summary.cssSize += size;
          else if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(resource.name)) summary.imageSize += size;
          else if (/\.(woff|woff2|ttf|otf)/.test(resource.name)) summary.fontSize += size;

          summary.resources.push({
            name: resource.name,
            type: resource.initiatorType,
            size: size,
            duration: resource.duration,
          });
        });

        return summary;
      });

      return {
        scenario: scenario.name,
        url: scenario.url,
        timestamp: new Date().toISOString(),
        loadTime,
        navigationTiming,
        webVitals,
        resources,
      };

    } finally {
      await browser.close();
    }
  }

  analyzeResults(lighthouseResult, rumResult) {
    const analysis = {
      scenario: rumResult.scenario,
      timestamp: rumResult.timestamp,
      scores: {},
      coreWebVitals: {},
      resourceBudget: {},
      recommendations: [],
      status: 'PASS',
    };

    // Analyze Lighthouse scores
    Object.entries(PERFORMANCE_BUDGETS.lighthouseScores).forEach(([category, threshold]) => {
      const score = lighthouseResult.categories[category]?.score * 100 || 0;
      analysis.scores[category] = {
        score: Math.round(score),
        threshold,
        status: score >= threshold ? 'PASS' : 'FAIL',
      };
      
      if (score < threshold) {
        analysis.status = 'FAIL';
        analysis.recommendations.push(`Improve ${category} score (${Math.round(score)}/${threshold})`);
      }
    });

    // Analyze Core Web Vitals
    const metrics = lighthouseResult.audits.metrics?.details?.items?.[0] || {};
    
    analysis.coreWebVitals = {
      LCP: {
        value: rumResult.webVitals.largestContentfulPaint || metrics.largestContentfulPaint || 0,
        threshold: PERFORMANCE_BUDGETS.coreWebVitals.LCP,
        status: (rumResult.webVitals.largestContentfulPaint || 0) <= PERFORMANCE_BUDGETS.coreWebVitals.LCP ? 'PASS' : 'FAIL',
      },
      FID: {
        value: rumResult.webVitals.firstInputDelay || 0,
        threshold: PERFORMANCE_BUDGETS.coreWebVitals.FID,
        status: (rumResult.webVitals.firstInputDelay || 0) <= PERFORMANCE_BUDGETS.coreWebVitals.FID ? 'PASS' : 'FAIL',
      },
      CLS: {
        value: rumResult.webVitals.cumulativeLayoutShift || 0,
        threshold: PERFORMANCE_BUDGETS.coreWebVitals.CLS,
        status: (rumResult.webVitals.cumulativeLayoutShift || 0) <= PERFORMANCE_BUDGETS.coreWebVitals.CLS ? 'PASS' : 'FAIL',
      },
      FCP: {
        value: rumResult.webVitals.firstContentfulPaint || metrics.firstContentfulPaint || 0,
        threshold: PERFORMANCE_BUDGETS.coreWebVitals.FCP,
        status: (rumResult.webVitals.firstContentfulPaint || 0) <= PERFORMANCE_BUDGETS.coreWebVitals.FCP ? 'PASS' : 'FAIL',
      },
      TTI: {
        value: metrics.interactive || 0,
        threshold: PERFORMANCE_BUDGETS.coreWebVitals.TTI,
        status: (metrics.interactive || 0) <= PERFORMANCE_BUDGETS.coreWebVitals.TTI ? 'PASS' : 'FAIL',
      },
    };

    // Check Core Web Vitals thresholds
    Object.entries(analysis.coreWebVitals).forEach(([metric, data]) => {
      if (data.status === 'FAIL') {
        analysis.status = 'FAIL';
        analysis.recommendations.push(`Improve ${metric} (${data.value.toFixed(0)}/${data.threshold})`);
      }
    });

    // Analyze resource budgets
    analysis.resourceBudget = {
      totalSize: {
        value: rumResult.resources.totalSize,
        threshold: PERFORMANCE_BUDGETS.resourceBudgets.totalSize,
        status: rumResult.resources.totalSize <= PERFORMANCE_BUDGETS.resourceBudgets.totalSize ? 'PASS' : 'FAIL',
      },
      jsSize: {
        value: rumResult.resources.jsSize,
        threshold: PERFORMANCE_BUDGETS.resourceBudgets.jsSize,
        status: rumResult.resources.jsSize <= PERFORMANCE_BUDGETS.resourceBudgets.jsSize ? 'PASS' : 'FAIL',
      },
      requestCount: {
        value: rumResult.resources.requestCount,
        threshold: PERFORMANCE_BUDGETS.resourceBudgets.requestCount,
        status: rumResult.resources.requestCount <= PERFORMANCE_BUDGETS.resourceBudgets.requestCount ? 'PASS' : 'FAIL',
      },
    };

    // Check resource budget violations
    Object.entries(analysis.resourceBudget).forEach(([budget, data]) => {
      if (data.status === 'FAIL') {
        analysis.status = 'FAIL';
        analysis.recommendations.push(`Reduce ${budget} (${(data.value / 1000).toFixed(0)}KB/${(data.threshold / 1000).toFixed(0)}KB)`);
      }
    });

    return analysis;
  }

  async generateReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportDir, `performance-report-${timestamp}.html`);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report - Pitchey Platform</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; margin-top: 5px; }
        .scenario { margin-bottom: 30px; border: 1px solid #e1e5e9; border-radius: 8px; }
        .scenario-header { background: #f8f9fa; padding: 15px 20px; font-weight: bold; }
        .scenario-content { padding: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-section { background: #fff; border: 1px solid #e1e5e9; border-radius: 6px; padding: 15px; }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status-pass { background: #d4edda; color: #155724; }
        .status-fail { background: #f8d7da; color: #721c24; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-top: 15px; }
        .chart-container { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Pitchey Performance Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${results.filter(r => r.status === 'PASS').length}/${results.length}</div>
                <div class="metric-label">Scenarios Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(results.reduce((sum, r) => sum + (r.scores.performance?.score || 0), 0) / results.length)}</div>
                <div class="metric-label">Avg Performance Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(results.reduce((sum, r) => sum + (r.coreWebVitals.LCP?.value || 0), 0) / results.length)}ms</div>
                <div class="metric-label">Avg LCP</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(results.reduce((sum, r) => sum + (r.resourceBudget.totalSize?.value || 0), 0) / results.length / 1024).toFixed(0)}KB</div>
                <div class="metric-label">Avg Bundle Size</div>
            </div>
        </div>

        ${results.map(result => `
            <div class="scenario">
                <div class="scenario-header">
                    ${result.scenario}
                    <span class="status-badge ${result.status === 'PASS' ? 'status-pass' : 'status-fail'}">${result.status}</span>
                </div>
                <div class="scenario-content">
                    <div class="metrics-grid">
                        <div class="metric-section">
                            <h4>Lighthouse Scores</h4>
                            ${Object.entries(result.scores).map(([category, data]) => `
                                <div>
                                    ${category}: <span class="${data.status === 'PASS' ? 'pass' : 'fail'}">${data.score}/100</span>
                                    (threshold: ${data.threshold})
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="metric-section">
                            <h4>Core Web Vitals</h4>
                            ${Object.entries(result.coreWebVitals).map(([metric, data]) => `
                                <div>
                                    ${metric}: <span class="${data.status === 'PASS' ? 'pass' : 'fail'}">${data.value.toFixed(0)}${metric === 'CLS' ? '' : 'ms'}</span>
                                    (threshold: ${data.threshold}${metric === 'CLS' ? '' : 'ms'})
                                </div>
                            `).join('')}
                        </div>

                        <div class="metric-section">
                            <h4>Resource Budget</h4>
                            ${Object.entries(result.resourceBudget).map(([budget, data]) => `
                                <div>
                                    ${budget}: <span class="${data.status === 'PASS' ? 'pass' : 'fail'}">
                                    ${budget.includes('Size') ? (data.value / 1024).toFixed(0) + 'KB' : data.value}
                                    </span>
                                    (threshold: ${budget.includes('Size') ? (data.threshold / 1024).toFixed(0) + 'KB' : data.threshold})
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    ${result.recommendations.length > 0 ? `
                        <div class="recommendations">
                            <h4>Recommendations</h4>
                            <ul>
                                ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('')}

        <div style="margin-top: 40px; text-align: center; color: #7f8c8d; font-size: 0.9em;">
            Report generated by Pitchey Performance Testing Framework
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(reportPath, html);
    console.log(`Performance report generated: ${reportPath}`);
    
    return reportPath;
  }

  async run() {
    console.log('Starting Pitchey Performance Analysis...');
    await this.ensureReportDirectory();

    for (const scenario of TEST_SCENARIOS) {
      try {
        console.log(`\n--- Testing ${scenario.name} ---`);
        
        // Run Lighthouse audit
        const lighthouseResult = await this.runLighthouseAudit(scenario.url, scenario);
        
        // Run Real User Metrics collection
        const rumResult = await this.runRealUserMetrics(scenario);
        
        // Analyze results
        const analysis = this.analyzeResults(lighthouseResult, rumResult);
        
        this.results.push(analysis);
        
        console.log(`✓ Completed ${scenario.name} - Status: ${analysis.status}`);
        
      } catch (error) {
        console.error(`✗ Failed ${scenario.name}:`, error.message);
        
        // Add failed result
        this.results.push({
          scenario: scenario.name,
          status: 'ERROR',
          error: error.message,
          timestamp: new Date().toISOString(),
          scores: {},
          coreWebVitals: {},
          resourceBudget: {},
          recommendations: [`Fix error: ${error.message}`],
        });
      }
    }

    // Generate comprehensive report
    const reportPath = await this.generateReport(this.results);
    
    // Save JSON results for CI/CD integration
    const jsonPath = path.join(this.reportDir, `performance-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(jsonPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        errors: this.results.filter(r => r.status === 'ERROR').length,
        avgPerformanceScore: Math.round(this.results.reduce((sum, r) => sum + (r.scores.performance?.score || 0), 0) / this.results.length),
      },
      results: this.results,
      budgets: PERFORMANCE_BUDGETS,
    }, null, 2));

    console.log(`\n--- Performance Analysis Complete ---`);
    console.log(`Total scenarios: ${this.results.length}`);
    console.log(`Passed: ${this.results.filter(r => r.status === 'PASS').length}`);
    console.log(`Failed: ${this.results.filter(r => r.status === 'FAIL').length}`);
    console.log(`Errors: ${this.results.filter(r => r.status === 'ERROR').length}`);
    console.log(`Report: ${reportPath}`);
    console.log(`Results: ${jsonPath}`);

    // Return results for CI/CD integration
    return {
      success: this.results.filter(r => r.status === 'FAIL' || r.status === 'ERROR').length === 0,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
      },
      reportPath,
      jsonPath,
    };
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer();
  
  analyzer.run()
    .then((results) => {
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Performance analysis failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;