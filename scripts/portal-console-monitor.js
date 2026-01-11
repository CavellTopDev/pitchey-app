#!/usr/bin/env node

/**
 * Portal Console Monitor
 * Automated script to visit all portal routes and capture console logs
 * Compares mock expectations with real-world behavior
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS !== 'false';
const OUTPUT_DIR = path.join(__dirname, '../logs/console-monitoring');

// Portal routes to monitor
const PORTAL_ROUTES = {
  creator: [
    '/creator/dashboard',
    '/creator/pitches',
    '/creator/pitches/drafts',
    '/creator/pitches/review',
    '/creator/pitches/analytics',
    '/creator/analytics',
    '/creator/collaborations',
    '/creator/team/members',
    '/creator/team/invite',
    '/creator/team/roles',
    '/creator/nda-management',
    '/creator/profile',
    '/creator/settings',
    '/create-pitch'
  ],
  investor: [
    '/investor/dashboard',
    '/investor/portfolio',
    '/investor/discover',
    '/investor/saved',
    '/investor/watchlist',
    '/investor/investments',
    '/investor/deals',
    '/investor/analytics',
    '/investor/network',
    '/investor/activity',
    '/investor/nda-history',
    '/investor/wallet',
    '/investor/settings'
  ],
  production: [
    '/production/dashboard',
    '/production/projects',
    '/production/projects/active',
    '/production/projects/completed',
    '/production/projects/development',
    '/production/projects/post',
    '/production/submissions',
    '/production/submissions/new',
    '/production/submissions/review',
    '/production/submissions/accepted',
    '/production/analytics',
    '/production/pipeline',
    '/production/collaborations',
    '/production/settings'
  ],
  public: [
    '/',
    '/browse',
    '/browse/genres',
    '/browse/top-rated',
    '/marketplace',
    '/search',
    '/about',
    '/how-it-works'
  ]
};

// Test accounts for authentication
const TEST_ACCOUNTS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123'
  },
  investor: {
    email: 'sarah.investor@demo.com',
    password: 'Demo123'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123'
  }
};

class ConsoleMonitor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.logs = [];
    this.errors = [];
    this.warnings = [];
    this.networkErrors = [];
    this.mockDiscrepancies = [];
  }

  async initialize() {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Launch browser
    this.browser = await puppeteer.launch({
      headless: HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ],
      devtools: !HEADLESS
    });

    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({
      width: 1920,
      height: 1080
    });

    // Setup console monitoring
    this.setupConsoleMonitoring();
    
    // Setup network monitoring
    this.setupNetworkMonitoring();
    
    // Setup error monitoring
    this.setupErrorMonitoring();
  }

  setupConsoleMonitoring() {
    this.page.on('console', async msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      const logEntry = {
        type,
        text,
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
        timestamp: new Date().toISOString()
      };

      this.logs.push(logEntry);

      // Categorize logs
      if (type === 'error') {
        this.errors.push(logEntry);
        this.checkMockDiscrepancy(logEntry);
      } else if (type === 'warning' || type === 'warn') {
        this.warnings.push(logEntry);
      }

      // Log to console in real-time
      const color = type === 'error' ? '\x1b[31m' : 
                    type === 'warning' ? '\x1b[33m' : 
                    '\x1b[0m';
      console.log(`${color}[${type.toUpperCase()}] ${text}\x1b[0m`);
    });
  }

  setupNetworkMonitoring() {
    this.page.on('requestfailed', request => {
      const failure = {
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      };
      
      this.networkErrors.push(failure);
      console.log(`\x1b[31m[NETWORK] Failed: ${request.url()}\x1b[0m`);
    });

    this.page.on('response', response => {
      if (response.status() >= 400) {
        const error = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        };
        
        this.networkErrors.push(error);
        console.log(`\x1b[31m[HTTP ${response.status()}] ${response.url()}\x1b[0m`);
      }
    });
  }

  setupErrorMonitoring() {
    this.page.on('pageerror', error => {
      const errorEntry = {
        type: 'pageerror',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      this.errors.push(errorEntry);
      console.log(`\x1b[31m[PAGE ERROR] ${error.message}\x1b[0m`);
    });
  }

  checkMockDiscrepancy(logEntry) {
    // Check for common mock vs real discrepancies
    const discrepancyPatterns = [
      {
        pattern: /Cannot read property.*of undefined/,
        issue: 'Missing null check - mock data may have different structure'
      },
      {
        pattern: /\.map is not a function/,
        issue: 'Data type mismatch - mock returns array, real returns object'
      },
      {
        pattern: /401|403|Unauthorized|Forbidden/,
        issue: 'Authentication mismatch - mock bypasses auth, real requires it'
      },
      {
        pattern: /fetch.*failed|Network request failed/,
        issue: 'Network error - mock does not simulate network failures'
      },
      {
        pattern: /Expected.*but received/,
        issue: 'Type validation failure - mock data types do not match real'
      }
    ];

    for (const { pattern, issue } of discrepancyPatterns) {
      if (pattern.test(logEntry.text)) {
        this.mockDiscrepancies.push({
          ...logEntry,
          issue,
          recommendation: this.getRecommendation(issue)
        });
      }
    }
  }

  getRecommendation(issue) {
    const recommendations = {
      'Missing null check': 'Add optional chaining (?.) and default values',
      'Data type mismatch': 'Update mock to match production API response structure',
      'Authentication mismatch': 'Include proper authentication in tests',
      'Network error': 'Add network failure scenarios to mock tests',
      'Type validation failure': 'Align mock data types with TypeScript interfaces'
    };

    for (const [key, recommendation] of Object.entries(recommendations)) {
      if (issue.includes(key)) {
        return recommendation;
      }
    }
    
    return 'Review mock implementation and update to match production behavior';
  }

  async login(portal) {
    const account = TEST_ACCOUNTS[portal];
    if (!account) return;

    console.log(`\n📝 Logging in as ${portal}...`);
    
    // Navigate to login page
    await this.page.goto(`${BASE_URL}/${portal}/login`, {
      waitUntil: 'networkidle2'
    });

    // Wait for login form
    await this.page.waitForSelector('input[type="email"]', { timeout: 5000 }).catch(() => {});
    
    // Fill login form
    await this.page.type('input[type="email"]', account.email);
    await this.page.type('input[type="password"]', account.password);
    
    // Submit form
    await Promise.all([
      this.page.click('button[type="submit"]'),
      this.page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]).catch(() => {});

    // Wait for dashboard to load
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async monitorRoute(route, portal = null) {
    console.log(`\n📍 Monitoring: ${route}`);
    
    const startLogs = this.logs.length;
    const startErrors = this.errors.length;
    
    try {
      await this.page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to scroll to trigger lazy loading
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for specific portal indicators
      if (portal) {
        await this.checkPortalSpecificElements(portal);
      }

    } catch (error) {
      console.log(`\x1b[31m   ❌ Error loading route: ${error.message}\x1b[0m`);
    }

    const newLogs = this.logs.length - startLogs;
    const newErrors = this.errors.length - startErrors;
    
    if (newErrors > 0) {
      console.log(`   \x1b[31m⚠️  ${newErrors} errors detected\x1b[0m`);
    } else if (newLogs > 0) {
      console.log(`   ✅ ${newLogs} logs captured`);
    } else {
      console.log(`   ✅ Clean - no console output`);
    }

    return {
      route,
      portal,
      logs: this.logs.slice(startLogs),
      errors: this.errors.slice(startErrors),
      timestamp: new Date().toISOString()
    };
  }

  async checkPortalSpecificElements(portal) {
    // Check for portal-specific elements that might cause errors
    const checks = {
      creator: [
        '[data-testid="pitch-counter"]',
        '[data-testid="draft-sync-indicator"]',
        '[data-testid="analytics-chart"]'
      ],
      investor: [
        '[data-testid="portfolio-summary"]',
        '[data-testid="investment-tracker"]',
        '[data-testid="nda-status"]'
      ],
      production: [
        '[data-testid="project-pipeline"]',
        '[data-testid="submission-queue"]',
        '[data-testid="revenue-tracker"]'
      ]
    };

    const elements = checks[portal] || [];
    
    for (const selector of elements) {
      const exists = await this.page.$(selector).then(el => !!el);
      if (!exists) {
        console.log(`   \x1b[33m⚠️  Missing element: ${selector}\x1b[0m`);
      }
    }
  }

  async monitorPortal(portalName) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎬 Monitoring ${portalName.toUpperCase()} Portal`);
    console.log(`${'='.repeat(50)}`);

    const routes = PORTAL_ROUTES[portalName];
    const results = [];

    // Login if needed
    if (portalName !== 'public') {
      await this.login(portalName);
    }

    // Monitor each route
    for (const route of routes) {
      const result = await this.monitorRoute(route, portalName);
      results.push(result);
    }

    return {
      portal: portalName,
      routes: results,
      summary: {
        totalRoutes: routes.length,
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        networkErrors: this.networkErrors.length,
        mockDiscrepancies: this.mockDiscrepancies.length
      }
    };
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: BASE_URL,
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        networkErrors: this.networkErrors.length,
        mockDiscrepancies: this.mockDiscrepancies.length
      },
      topErrors: this.getTopErrors(),
      mockDiscrepancies: this.mockDiscrepancies,
      networkErrors: this.networkErrors,
      recommendations: this.generateRecommendations()
    };

    // Save detailed logs
    await fs.writeFile(
      path.join(OUTPUT_DIR, `console-logs-${Date.now()}.json`),
      JSON.stringify(this.logs, null, 2)
    );

    // Save report
    await fs.writeFile(
      path.join(OUTPUT_DIR, `report-${Date.now()}.json`),
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  getTopErrors() {
    const errorCounts = {};
    
    this.errors.forEach(error => {
      const key = error.text.substring(0, 100);
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.errors.length > 50) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'High error count',
        action: 'Implement global error boundaries and error logging'
      });
    }

    if (this.mockDiscrepancies.length > 10) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Significant mock/real discrepancies',
        action: 'Update test mocks to match production API responses'
      });
    }

    if (this.networkErrors.length > 20) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Frequent network errors',
        action: 'Add retry logic and better error handling for API calls'
      });
    }

    const nullErrors = this.errors.filter(e => e.text.includes('Cannot read property'));
    if (nullErrors.length > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Many null reference errors',
        action: 'Add optional chaining and default values throughout codebase'
      });
    }

    return recommendations;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.initialize();

      // Monitor all portals
      const portalResults = [];
      
      for (const portal of ['public', 'creator', 'investor', 'production']) {
        const result = await this.monitorPortal(portal);
        portalResults.push(result);
        
        // Clear page cookies between portals
        const cookies = await this.page.cookies();
        await this.page.deleteCookie(...cookies);
      }

      // Generate and save report
      const report = await this.generateReport();

      // Print summary
      console.log(`\n${'='.repeat(50)}`);
      console.log('📊 MONITORING COMPLETE');
      console.log(`${'='.repeat(50)}`);
      console.log(`Total Logs: ${report.summary.totalLogs}`);
      console.log(`Total Errors: ${report.summary.totalErrors}`);
      console.log(`Total Warnings: ${report.summary.totalWarnings}`);
      console.log(`Network Errors: ${report.summary.networkErrors}`);
      console.log(`Mock Discrepancies: ${report.summary.mockDiscrepancies}`);
      
      if (report.recommendations.length > 0) {
        console.log(`\n📋 TOP RECOMMENDATIONS:`);
        report.recommendations.forEach(rec => {
          console.log(`  [${rec.priority}] ${rec.issue}: ${rec.action}`);
        });
      }

      console.log(`\n📁 Reports saved to: ${OUTPUT_DIR}`);

    } catch (error) {
      console.error('Monitoring failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the monitor
if (require.main === module) {
  const monitor = new ConsoleMonitor();
  monitor.run().catch(console.error);
}

module.exports = ConsoleMonitor;