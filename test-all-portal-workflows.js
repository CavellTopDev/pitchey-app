const { chromium } = require('playwright');
const fs = require('fs').promises;

// Configuration
const BASE_URL = 'https://7990cec7.pitchey-5o8.pages.dev';
const API_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Demo credentials
const credentials = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    name: 'Alex Rodriguez'
  },
  investor: {
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    name: 'Sarah Thompson'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    name: 'Stellar Pictures'
  }
};

// Test results storage
const results = {
  creator: { routes: {}, workflows: {} },
  investor: { routes: {}, workflows: {} },
  production: { routes: {}, workflows: {} }
};

// Helper function to check if a route is accessible
async function checkRoute(page, routePath, routeName, portal) {
  try {
    console.log(`  Checking ${routeName}...`);
    const response = await page.goto(`${BASE_URL}${routePath}`, { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
    
    // Check for common error indicators
    const pageContent = await page.content();
    const hasError = pageContent.includes('Error') || 
                     pageContent.includes('error') ||
                     pageContent.includes('404') ||
                     pageContent.includes('not found');
    
    // Check if redirected to login (unauthorized)
    const currentUrl = page.url();
    const wasRedirected = currentUrl.includes('/login') && !routePath.includes('/login');
    
    // Take screenshot for documentation
    await page.screenshot({ 
      path: `screenshots/${portal}-${routeName.replace(/\s+/g, '-').toLowerCase()}.png`,
      fullPage: false 
    });
    
    const status = response.status();
    const success = status >= 200 && status < 400 && !hasError && !wasRedirected;
    
    results[portal].routes[routeName] = {
      path: routePath,
      status: status,
      success: success,
      hasError: hasError,
      wasRedirected: wasRedirected,
      url: currentUrl
    };
    
    return success;
  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results[portal].routes[routeName] = {
      path: routePath,
      status: 'error',
      success: false,
      error: error.message
    };
    return false;
  }
}

// Helper function to test a workflow
async function testWorkflow(page, workflowName, steps, portal) {
  console.log(`  Testing workflow: ${workflowName}`);
  const workflowResult = { steps: [], success: true };
  
  for (const step of steps) {
    try {
      console.log(`    - ${step.name}`);
      const stepResult = await step.action(page);
      workflowResult.steps.push({
        name: step.name,
        success: stepResult,
        error: null
      });
      if (!stepResult) {
        workflowResult.success = false;
        break;
      }
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      workflowResult.steps.push({
        name: step.name,
        success: false,
        error: error.message
      });
      workflowResult.success = false;
      break;
    }
  }
  
  results[portal].workflows[workflowName] = workflowResult;
  return workflowResult.success;
}

// Main test function
async function testAllPortals() {
  console.log('🎬 Starting Pitchey Portal Workflow Tests');
  console.log('=========================================\n');
  
  // Create screenshots directory
  await fs.mkdir('screenshots', { recursive: true });
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // Test Creator Portal
  console.log('👤 TESTING CREATOR PORTAL');
  console.log('-------------------------');
  await testCreatorPortal(browser);
  
  // Test Investor Portal
  console.log('\n💰 TESTING INVESTOR PORTAL');
  console.log('---------------------------');
  await testInvestorPortal(browser);
  
  // Test Production Portal
  console.log('\n🏢 TESTING PRODUCTION PORTAL');
  console.log('-----------------------------');
  await testProductionPortal(browser);
  
  await browser.close();
  
  // Generate report
  await generateReport();
}

// Creator Portal Tests
async function testCreatorPortal(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Login
  console.log('  Logging in...');
  await page.goto(`${BASE_URL}/creator/login`);
  await page.fill('input[type="email"], input[name="email"], #email', credentials.creator.email);
  await page.fill('input[type="password"], input[name="password"], #password', credentials.creator.password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  
  // Wait for navigation or error
  await page.waitForTimeout(3000);
  
  // Check routes
  console.log('\n  Checking routes:');
  const creatorRoutes = [
    ['/creator/dashboard', 'Dashboard'],
    ['/creator/pitches', 'My Pitches'],
    ['/creator/create-pitch', 'Create Pitch'],
    ['/creator/analytics', 'Analytics'],
    ['/creator/messages', 'Messages'],
    ['/creator/profile', 'Profile'],
    ['/creator/settings', 'Settings'],
    ['/creator/nda', 'NDA Management'],
    ['/creator/collaborations', 'Collaborations'],
    ['/creator/team', 'Team'],
    ['/creator/drafts', 'Drafts'],
    ['/creator/reviews', 'Reviews']
  ];
  
  for (const [path, name] of creatorRoutes) {
    await checkRoute(page, path, name, 'creator');
  }
  
  // Test workflows
  console.log('\n  Testing workflows:');
  
  // Workflow 1: Create a pitch
  await testWorkflow(page, 'Create Pitch', [
    {
      name: 'Navigate to Create Pitch',
      action: async (p) => {
        await p.goto(`${BASE_URL}/creator/create-pitch`);
        return await p.isVisible('form, [data-testid="pitch-form"], .pitch-form');
      }
    },
    {
      name: 'Fill pitch title',
      action: async (p) => {
        const titleInput = await p.$('input[name="title"], input[placeholder*="title"], #title');
        if (titleInput) {
          await titleInput.fill('Test Pitch - Automated');
          return true;
        }
        return false;
      }
    },
    {
      name: 'Check for genre dropdown',
      action: async (p) => {
        return await p.isVisible('select[name="genre"], [data-testid="genre-select"], #genre');
      }
    }
  ], 'creator');
  
  // Workflow 2: View analytics
  await testWorkflow(page, 'View Analytics', [
    {
      name: 'Navigate to Analytics',
      action: async (p) => {
        await p.goto(`${BASE_URL}/creator/analytics`);
        return !p.url().includes('/login');
      }
    },
    {
      name: 'Check for analytics content',
      action: async (p) => {
        const hasCharts = await p.isVisible('canvas, svg, .chart, .analytics');
        const hasStats = await p.isVisible('.stat, .metric, [data-testid*="stat"]');
        return hasCharts || hasStats;
      }
    }
  ], 'creator');
  
  await context.close();
}

// Investor Portal Tests
async function testInvestorPortal(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Login
  console.log('  Logging in...');
  await page.goto(`${BASE_URL}/investor/login`);
  await page.fill('input[type="email"], input[name="email"], #email', credentials.investor.email);
  await page.fill('input[type="password"], input[name="password"], #password', credentials.investor.password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  
  // Wait for navigation
  await page.waitForTimeout(3000);
  
  // Check routes
  console.log('\n  Checking routes:');
  const investorRoutes = [
    ['/investor/dashboard', 'Dashboard'],
    ['/investor/discover', 'Discover Pitches'],
    ['/investor/portfolio', 'Portfolio'],
    ['/investor/saved', 'Saved Pitches'],
    ['/investor/investments', 'Investments'],
    ['/investor/analytics', 'Analytics'],
    ['/investor/wallet', 'Wallet'],
    ['/investor/transactions', 'Transactions'],
    ['/investor/nda', 'NDA History'],
    ['/investor/messages', 'Messages'],
    ['/investor/settings', 'Settings'],
    ['/investor/network', 'Network'],
    ['/investor/deals', 'Deals']
  ];
  
  for (const [path, name] of investorRoutes) {
    await checkRoute(page, path, name, 'investor');
  }
  
  // Test workflows
  console.log('\n  Testing workflows:');
  
  // Workflow 1: Browse pitches
  await testWorkflow(page, 'Browse Pitches', [
    {
      name: 'Navigate to Discover',
      action: async (p) => {
        await p.goto(`${BASE_URL}/investor/discover`);
        return !p.url().includes('/login');
      }
    },
    {
      name: 'Check for pitch listings',
      action: async (p) => {
        return await p.isVisible('.pitch-card, .pitch-item, [data-testid*="pitch"]');
      }
    },
    {
      name: 'Check for filters',
      action: async (p) => {
        return await p.isVisible('button:has-text("Filter"), .filter, [data-testid*="filter"]');
      }
    }
  ], 'investor');
  
  // Workflow 2: View portfolio
  await testWorkflow(page, 'View Portfolio', [
    {
      name: 'Navigate to Portfolio',
      action: async (p) => {
        await p.goto(`${BASE_URL}/investor/portfolio`);
        return !p.url().includes('/login');
      }
    },
    {
      name: 'Check for portfolio content',
      action: async (p) => {
        const hasPortfolio = await p.isVisible('.portfolio, [data-testid*="portfolio"]');
        const hasEmpty = await p.isVisible('text=/no investments|empty|no pitches/i');
        return hasPortfolio || hasEmpty;
      }
    }
  ], 'investor');
  
  await context.close();
}

// Production Portal Tests
async function testProductionPortal(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Login
  console.log('  Logging in...');
  await page.goto(`${BASE_URL}/production/login`);
  await page.fill('input[type="email"], input[name="email"], #email', credentials.production.email);
  await page.fill('input[type="password"], input[name="password"], #password', credentials.production.password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  
  // Wait for navigation
  await page.waitForTimeout(3000);
  
  // Check routes
  console.log('\n  Checking routes:');
  const productionRoutes = [
    ['/production/dashboard', 'Dashboard'],
    ['/production/projects', 'Projects'],
    ['/production/submissions', 'Submissions'],
    ['/production/pipeline', 'Pipeline'],
    ['/production/analytics', 'Analytics'],
    ['/production/revenue', 'Revenue'],
    ['/production/team', 'Team Management'],
    ['/production/collaborations', 'Collaborations'],
    ['/production/active', 'Active Projects'],
    ['/production/completed', 'Completed Projects'],
    ['/production/development', 'In Development'],
    ['/production/post', 'Post Production'],
    ['/production/settings', 'Settings']
  ];
  
  for (const [path, name] of productionRoutes) {
    await checkRoute(page, path, name, 'production');
  }
  
  // Test workflows
  console.log('\n  Testing workflows:');
  
  // Workflow 1: View submissions
  await testWorkflow(page, 'View Submissions', [
    {
      name: 'Navigate to Submissions',
      action: async (p) => {
        await p.goto(`${BASE_URL}/production/submissions`);
        return !p.url().includes('/login');
      }
    },
    {
      name: 'Check for submission tabs',
      action: async (p) => {
        return await p.isVisible('button:has-text("New"), [role="tab"], .tab');
      }
    },
    {
      name: 'Check for submission content',
      action: async (p) => {
        const hasSubmissions = await p.isVisible('.submission, [data-testid*="submission"]');
        const hasEmpty = await p.isVisible('text=/no submissions|empty/i');
        return hasSubmissions || hasEmpty;
      }
    }
  ], 'production');
  
  // Workflow 2: View projects
  await testWorkflow(page, 'View Projects', [
    {
      name: 'Navigate to Projects',
      action: async (p) => {
        await p.goto(`${BASE_URL}/production/projects`);
        return !p.url().includes('/login');
      }
    },
    {
      name: 'Check for project content',
      action: async (p) => {
        const hasProjects = await p.isVisible('.project, [data-testid*="project"]');
        const hasEmpty = await p.isVisible('text=/no projects|empty/i');
        return hasProjects || hasEmpty;
      }
    }
  ], 'production');
  
  await context.close();
}

// Generate comprehensive report
async function generateReport() {
  console.log('\n\n📊 GENERATING WORKFLOW STATUS REPORT');
  console.log('=====================================\n');
  
  let report = '# Pitchey Portal Workflow Test Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Frontend URL: ${BASE_URL}\n`;
  report += `API URL: ${API_URL}\n\n`;
  
  for (const portal of ['creator', 'investor', 'production']) {
    const portalName = portal.charAt(0).toUpperCase() + portal.slice(1);
    report += `## ${portalName} Portal\n\n`;
    
    // Routes status
    report += '### Routes Status\n\n';
    report += '| Route | Path | Status | Working |\n';
    report += '|-------|------|--------|----------|\n';
    
    const routes = results[portal].routes;
    let workingRoutes = 0;
    let totalRoutes = 0;
    
    for (const [name, data] of Object.entries(routes)) {
      const status = data.success ? '✅' : '❌';
      const statusText = data.wasRedirected ? 'Unauthorized' : 
                         data.hasError ? 'Error' : 
                         data.status === 'error' ? 'Failed' : 
                         `${data.status}`;
      report += `| ${name} | ${data.path} | ${statusText} | ${status} |\n`;
      if (data.success) workingRoutes++;
      totalRoutes++;
    }
    
    report += `\n**Working: ${workingRoutes}/${totalRoutes} routes**\n\n`;
    
    // Workflows status
    report += '### Workflows Status\n\n';
    report += '| Workflow | Steps Completed | Status |\n';
    report += '|----------|----------------|--------|\n';
    
    const workflows = results[portal].workflows;
    let workingWorkflows = 0;
    let totalWorkflows = 0;
    
    for (const [name, data] of Object.entries(workflows)) {
      const completedSteps = data.steps.filter(s => s.success).length;
      const totalSteps = data.steps.length;
      const status = data.success ? '✅' : '❌';
      report += `| ${name} | ${completedSteps}/${totalSteps} | ${status} |\n`;
      if (data.success) workingWorkflows++;
      totalWorkflows++;
    }
    
    report += `\n**Working: ${workingWorkflows}/${totalWorkflows} workflows**\n\n`;
    
    // Detailed workflow steps
    if (Object.keys(workflows).length > 0) {
      report += '#### Workflow Details\n\n';
      for (const [name, data] of Object.entries(workflows)) {
        report += `**${name}:**\n`;
        for (const step of data.steps) {
          const status = step.success ? '✅' : '❌';
          const error = step.error ? ` (${step.error})` : '';
          report += `- ${status} ${step.name}${error}\n`;
        }
        report += '\n';
      }
    }
  }
  
  // Summary statistics
  report += '## Summary Statistics\n\n';
  
  let totalWorkingRoutes = 0;
  let totalRoutesCount = 0;
  let totalWorkingWorkflows = 0;
  let totalWorkflowsCount = 0;
  
  for (const portal of ['creator', 'investor', 'production']) {
    const routes = Object.values(results[portal].routes);
    const workflows = Object.values(results[portal].workflows);
    
    totalWorkingRoutes += routes.filter(r => r.success).length;
    totalRoutesCount += routes.length;
    totalWorkingWorkflows += workflows.filter(w => w.success).length;
    totalWorkflowsCount += workflows.length;
  }
  
  const routePercentage = ((totalWorkingRoutes / totalRoutesCount) * 100).toFixed(1);
  const workflowPercentage = ((totalWorkingWorkflows / totalWorkflowsCount) * 100).toFixed(1);
  
  report += `- **Total Routes Tested:** ${totalRoutesCount}\n`;
  report += `- **Working Routes:** ${totalWorkingRoutes} (${routePercentage}%)\n`;
  report += `- **Total Workflows Tested:** ${totalWorkflowsCount}\n`;
  report += `- **Working Workflows:** ${totalWorkingWorkflows} (${workflowPercentage}%)\n\n`;
  
  // Issues found
  report += '## Issues Found\n\n';
  
  for (const portal of ['creator', 'investor', 'production']) {
    const portalName = portal.charAt(0).toUpperCase() + portal.slice(1);
    const failedRoutes = Object.entries(results[portal].routes)
      .filter(([_, data]) => !data.success);
    const failedWorkflows = Object.entries(results[portal].workflows)
      .filter(([_, data]) => !data.success);
    
    if (failedRoutes.length > 0 || failedWorkflows.length > 0) {
      report += `### ${portalName} Portal Issues\n\n`;
      
      if (failedRoutes.length > 0) {
        report += '**Failed Routes:**\n';
        for (const [name, data] of failedRoutes) {
          const reason = data.wasRedirected ? 'Redirected to login' :
                        data.hasError ? 'Page contains error' :
                        data.error || 'Unknown error';
          report += `- ${name}: ${reason}\n`;
        }
        report += '\n';
      }
      
      if (failedWorkflows.length > 0) {
        report += '**Failed Workflows:**\n';
        for (const [name, data] of failedWorkflows) {
          const failedStep = data.steps.find(s => !s.success);
          const reason = failedStep ? `Failed at: ${failedStep.name}` : 'Unknown failure';
          report += `- ${name}: ${reason}\n`;
        }
        report += '\n';
      }
    }
  }
  
  // Save reports
  await fs.writeFile('workflow-test-report.md', report);
  await fs.writeFile('workflow-test-results.json', JSON.stringify(results, null, 2));
  
  console.log('📄 Report saved to: workflow-test-report.md');
  console.log('📊 Raw results saved to: workflow-test-results.json');
  
  // Print summary to console
  console.log('\n📈 SUMMARY:');
  console.log(`  Routes: ${totalWorkingRoutes}/${totalRoutesCount} working (${routePercentage}%)`);
  console.log(`  Workflows: ${totalWorkingWorkflows}/${totalWorkflowsCount} working (${workflowPercentage}%)`);
}

// Run the tests
testAllPortals().catch(console.error);