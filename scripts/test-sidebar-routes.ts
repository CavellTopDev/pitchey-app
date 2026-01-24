/**
 * Sidebar Route Testing Script
 * Tests all navigation routes for Creator, Investor, and Production portals
 * Run with: bun run scripts/test-sidebar-routes.ts
 */

const API_BASE = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Test cookies for each portal type
const COOKIES = {
  creator: 'better-auth.session_token=wNdGJBKFYkXWCOjsqyZ7mWwJlABw3AH3dnZRz7QDVdCMdXPYY6v7PDVN6PfV61BzwJlwwBHMO6AVQVZUV7Kzlg%3D%3D.fYyY%2FzAxbF1CXJ73nMx6dqwejBY5V36DmfGT07t0DxpMSEIKexW%2BLsJENnz7H%2FuY4HaLsYPqCHq0PgNGbHp7Gg%3D%3D',
  investor: 'better-auth.session_token=wNdGJBKFYkXWCOjsqyZ7mWwJlABw3AH3dnZRz7QDVdCMdXPYY6v7PDVN6PfV61BzwJlwwBHMO6AVQVZUV7Kzlg%3D%3D.fYyY%2FzAxbF1CXJ73nMx6dqwejBY5V36DmfGT07t0DxpMSEIKexW%2BLsJENnz7H%2FuY4HaLsYPqCHq0PgNGbHp7Gg%3D%3D',
  production: 'better-auth.session_token=wNdGJBKFYkXWCOjsqyZ7mWwJlABw3AH3dnZRz7QDVdCMdXPYY6v7PDVN6PfV61BzwJlwwBHMO6AVQVZUV7Kzlg%3D%3D.fYyY%2FzAxbF1CXJ73nMx6dqwejBY5V36DmfGT07t0DxpMSEIKexW%2BLsJENnz7H%2FuY4HaLsYPqCHq0PgNGbHp7Gg%3D%3D',
};

// API endpoints that correspond to each sidebar route
interface RouteTest {
  name: string;
  frontendRoute: string;
  apiEndpoint: string;
  method?: 'GET' | 'POST';
  requiresAuth: boolean;
}

const PRODUCTION_ROUTES: RouteTest[] = [
  // Dashboard
  { name: 'Overview', frontendRoute: '/production/dashboard', apiEndpoint: '/api/production/dashboard', requiresAuth: true },
  { name: 'Analytics', frontendRoute: '/production/analytics', apiEndpoint: '/api/production/analytics', requiresAuth: true },
  { name: 'Activity', frontendRoute: '/production/activity', apiEndpoint: '/api/production/activity', requiresAuth: true },
  { name: 'Statistics', frontendRoute: '/production/stats', apiEndpoint: '/api/production/stats', requiresAuth: true },

  // Projects
  { name: 'All Projects', frontendRoute: '/production/projects', apiEndpoint: '/api/production/projects', requiresAuth: true },
  { name: 'Active Projects', frontendRoute: '/production/projects/active', apiEndpoint: '/api/production/projects?status=active', requiresAuth: true },
  { name: 'In Development', frontendRoute: '/production/projects/development', apiEndpoint: '/api/production/projects?status=development', requiresAuth: true },
  { name: 'Post-Production', frontendRoute: '/production/projects/post', apiEndpoint: '/api/production/projects?status=post', requiresAuth: true },
  { name: 'Completed', frontendRoute: '/production/projects/completed', apiEndpoint: '/api/production/projects?status=completed', requiresAuth: true },
  { name: 'Pipeline', frontendRoute: '/production/pipeline', apiEndpoint: '/api/production/pipeline', requiresAuth: true },

  // Submissions
  { name: 'All Submissions', frontendRoute: '/production/submissions', apiEndpoint: '/api/production/submissions', requiresAuth: true },
  { name: 'New Submissions', frontendRoute: '/production/submissions/new', apiEndpoint: '/api/production/submissions?status=new', requiresAuth: true },
  { name: 'Under Review', frontendRoute: '/production/submissions/review', apiEndpoint: '/api/production/submissions?status=review', requiresAuth: true },
  { name: 'Shortlisted', frontendRoute: '/production/submissions/shortlisted', apiEndpoint: '/api/production/submissions?status=shortlisted', requiresAuth: true },
  { name: 'Accepted', frontendRoute: '/production/submissions/accepted', apiEndpoint: '/api/production/submissions?status=accepted', requiresAuth: true },
  { name: 'Rejected', frontendRoute: '/production/submissions/rejected', apiEndpoint: '/api/production/submissions?status=rejected', requiresAuth: true },
  { name: 'Archive', frontendRoute: '/production/submissions/archive', apiEndpoint: '/api/production/submissions?status=archived', requiresAuth: true },

  // Operations
  { name: 'Revenue', frontendRoute: '/production/revenue', apiEndpoint: '/api/production/revenue', requiresAuth: true },
  { name: 'Saved Pitches', frontendRoute: '/production/saved', apiEndpoint: '/api/production/saved-pitches', requiresAuth: true },
  { name: 'Collaborations', frontendRoute: '/production/collaborations', apiEndpoint: '/api/production/collaborations', requiresAuth: true },

  // Team
  { name: 'Invite Members', frontendRoute: '/production/team/invite', apiEndpoint: '/api/teams', requiresAuth: true },
  { name: 'Manage Roles', frontendRoute: '/production/team/roles', apiEndpoint: '/api/teams/roles', requiresAuth: true },

  // Legal
  { name: 'Documents', frontendRoute: '/legal/dashboard', apiEndpoint: '/api/legal/documents', requiresAuth: true },
  { name: 'Create Document', frontendRoute: '/legal/wizard', apiEndpoint: '/api/legal/templates', requiresAuth: true },
  { name: 'Templates', frontendRoute: '/legal/templates', apiEndpoint: '/api/legal/templates', requiresAuth: true },
  { name: 'Compare', frontendRoute: '/legal/compare', apiEndpoint: '/api/legal/documents', requiresAuth: true },

  // Account
  { name: 'Following', frontendRoute: '/production/following', apiEndpoint: '/api/user/following', requiresAuth: true },
  { name: 'Settings', frontendRoute: '/production/settings', apiEndpoint: '/api/user/settings', requiresAuth: true },
];

const INVESTOR_ROUTES: RouteTest[] = [
  // Dashboard
  { name: 'Overview', frontendRoute: '/investor/dashboard', apiEndpoint: '/api/investor/dashboard', requiresAuth: true },
  { name: 'Portfolio', frontendRoute: '/investor/portfolio', apiEndpoint: '/api/investor/portfolio', requiresAuth: true },
  { name: 'Analytics', frontendRoute: '/investor/analytics', apiEndpoint: '/api/investor/analytics', requiresAuth: true },
  { name: 'Activity', frontendRoute: '/investor/activity', apiEndpoint: '/api/investor/activity', requiresAuth: true },
  { name: 'Performance', frontendRoute: '/investor/performance', apiEndpoint: '/api/investor/performance', requiresAuth: true },

  // Deals
  { name: 'Active Deals', frontendRoute: '/investor/deals', apiEndpoint: '/api/investor/deals', requiresAuth: true },
  { name: 'Pending Deals', frontendRoute: '/investor/pending-deals', apiEndpoint: '/api/investor/deals?status=pending', requiresAuth: true },
  { name: 'All Investments', frontendRoute: '/investor/all-investments', apiEndpoint: '/api/investor/investments', requiresAuth: true },
  { name: 'Completed Projects', frontendRoute: '/investor/completed-projects', apiEndpoint: '/api/investor/completed-projects', requiresAuth: true },

  // Discovery
  { name: 'Browse', frontendRoute: '/investor/browse', apiEndpoint: '/api/pitches/browse', requiresAuth: true },
  { name: 'Discover', frontendRoute: '/investor/discover', apiEndpoint: '/api/pitches/discover', requiresAuth: true },
  { name: 'Saved', frontendRoute: '/investor/saved', apiEndpoint: '/api/investor/saved-pitches', requiresAuth: true },
  { name: 'Watchlist', frontendRoute: '/investor/watchlist', apiEndpoint: '/api/investor/watchlist', requiresAuth: true },

  // Financial
  { name: 'Financial Overview', frontendRoute: '/investor/financial-overview', apiEndpoint: '/api/investor/financial-overview', requiresAuth: true },
  { name: 'Transaction History', frontendRoute: '/investor/transaction-history', apiEndpoint: '/api/investor/transactions', requiresAuth: true },
  { name: 'Budget Allocation', frontendRoute: '/investor/budget-allocation', apiEndpoint: '/api/investor/budget', requiresAuth: true },
  { name: 'ROI Analysis', frontendRoute: '/investor/roi-analysis', apiEndpoint: '/api/investor/roi', requiresAuth: true },
  { name: 'Reports', frontendRoute: '/investor/reports', apiEndpoint: '/api/investor/reports', requiresAuth: true },
  { name: 'Tax Documents', frontendRoute: '/investor/tax-documents', apiEndpoint: '/api/investor/tax-documents', requiresAuth: true },

  // Market Analysis
  { name: 'Market Trends', frontendRoute: '/investor/market-trends', apiEndpoint: '/api/investor/market-trends', requiresAuth: true },
  { name: 'Risk Assessment', frontendRoute: '/investor/risk-assessment', apiEndpoint: '/api/investor/risk-assessment', requiresAuth: true },

  // Network
  { name: 'Network', frontendRoute: '/investor/network', apiEndpoint: '/api/investor/network', requiresAuth: true },
  { name: 'Co-Investors', frontendRoute: '/investor/co-investors', apiEndpoint: '/api/investor/co-investors', requiresAuth: true },
  { name: 'Creators', frontendRoute: '/investor/creators', apiEndpoint: '/api/investor/creators', requiresAuth: true },
  { name: 'Production Companies', frontendRoute: '/investor/production-companies', apiEndpoint: '/api/investor/production-companies', requiresAuth: true },

  // Account
  { name: 'Wallet', frontendRoute: '/investor/wallet', apiEndpoint: '/api/investor/wallet', requiresAuth: true },
  { name: 'Payment Methods', frontendRoute: '/investor/payment-methods', apiEndpoint: '/api/investor/payment-methods', requiresAuth: true },
  { name: 'Settings', frontendRoute: '/investor/settings', apiEndpoint: '/api/user/settings', requiresAuth: true },
  { name: 'Following', frontendRoute: '/investor/following', apiEndpoint: '/api/user/following', requiresAuth: true },
  { name: 'NDA Requests', frontendRoute: '/investor/nda-requests', apiEndpoint: '/api/investor/ndas', requiresAuth: true },
];

const CREATOR_ROUTES: RouteTest[] = [
  // Dashboard
  { name: 'Overview', frontendRoute: '/creator/dashboard', apiEndpoint: '/api/creator/dashboard', requiresAuth: true },
  { name: 'Analytics', frontendRoute: '/creator/analytics', apiEndpoint: '/api/creator/analytics', requiresAuth: true },
  { name: 'Activity', frontendRoute: '/creator/activity', apiEndpoint: '/api/creator/activity', requiresAuth: true },
  { name: 'Statistics', frontendRoute: '/creator/stats', apiEndpoint: '/api/creator/stats', requiresAuth: true },

  // Pitches
  { name: 'All Pitches', frontendRoute: '/creator/pitches', apiEndpoint: '/api/creator/pitches', requiresAuth: true },
  { name: 'Create Pitch', frontendRoute: '/creator/pitch/new', apiEndpoint: '/api/creator/pitches', requiresAuth: true },
  { name: 'Published', frontendRoute: '/creator/pitches/published', apiEndpoint: '/api/creator/pitches?status=published', requiresAuth: true },
  { name: 'Drafts', frontendRoute: '/creator/pitches/drafts', apiEndpoint: '/api/creator/pitches?status=draft', requiresAuth: true },
  { name: 'In Review', frontendRoute: '/creator/pitches/review', apiEndpoint: '/api/creator/pitches?status=review', requiresAuth: true },
  { name: 'Pitch Analytics', frontendRoute: '/creator/pitches/analytics', apiEndpoint: '/api/creator/pitches/analytics', requiresAuth: true },

  // Team
  { name: 'Team Members', frontendRoute: '/creator/team/members', apiEndpoint: '/api/teams', requiresAuth: true },
  { name: 'Invite Members', frontendRoute: '/creator/team/invite', apiEndpoint: '/api/teams', requiresAuth: true },
  { name: 'Manage Roles', frontendRoute: '/creator/team/roles', apiEndpoint: '/api/teams/roles', requiresAuth: true },
  { name: 'Collaborations', frontendRoute: '/creator/collaborations', apiEndpoint: '/api/creator/collaborations', requiresAuth: true },

  // Other
  { name: 'Portfolio', frontendRoute: '/creator/portfolio', apiEndpoint: '/api/creator/portfolio', requiresAuth: true },
  { name: 'NDAs', frontendRoute: '/creator/ndas', apiEndpoint: '/api/creator/ndas', requiresAuth: true },
  { name: 'Messages', frontendRoute: '/creator/messages', apiEndpoint: '/api/messages', requiresAuth: true },
  { name: 'Calendar', frontendRoute: '/creator/calendar', apiEndpoint: '/api/creator/calendar', requiresAuth: true },
  { name: 'Following', frontendRoute: '/creator/following', apiEndpoint: '/api/user/following', requiresAuth: true },
  { name: 'Profile', frontendRoute: '/creator/profile', apiEndpoint: '/api/user/profile', requiresAuth: true },
  { name: 'Settings', frontendRoute: '/creator/settings', apiEndpoint: '/api/user/settings', requiresAuth: true },

  // Legal
  { name: 'Legal Dashboard', frontendRoute: '/legal/dashboard', apiEndpoint: '/api/legal/documents', requiresAuth: true },
  { name: 'Legal Wizard', frontendRoute: '/legal/wizard', apiEndpoint: '/api/legal/templates', requiresAuth: true },
  { name: 'Legal Library', frontendRoute: '/legal/library', apiEndpoint: '/api/legal/library', requiresAuth: true },
  { name: 'Legal Templates', frontendRoute: '/legal/templates', apiEndpoint: '/api/legal/templates', requiresAuth: true },
  { name: 'Legal Compare', frontendRoute: '/legal/compare', apiEndpoint: '/api/legal/documents', requiresAuth: true },
];

interface TestResult {
  route: RouteTest;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
}

async function testRoute(route: RouteTest, cookie: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE}${route.apiEndpoint}`, {
      method: route.method || 'GET',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Origin': 'https://pitchey-5o8.pages.dev',
      },
    });

    const responseTime = Date.now() - start;
    const success = response.status >= 200 && response.status < 400;

    return {
      route,
      status: response.status,
      success,
      responseTime,
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      route,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

async function testPortalRoutes(
  portalName: string,
  routes: RouteTest[],
  cookie: string
): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${portalName} Portal Routes`);
  console.log(`${'='.repeat(60)}\n`);

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const route of routes) {
    const result = await testRoute(route, cookie);
    results.push(result);

    if (result.success) {
      passed++;
      console.log(`✅ ${route.name.padEnd(25)} ${result.status} (${result.responseTime}ms)`);
    } else {
      failed++;
      console.log(`❌ ${route.name.padEnd(25)} ${result.status} - ${result.error} (${result.responseTime}ms)`);
    }
  }

  console.log(`\n${portalName} Summary: ${passed}/${routes.length} passed, ${failed} failed`);

  return { passed, failed, results };
}

async function main() {
  console.log('🧪 Sidebar Route Testing Script');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Test all portals
  const productionResults = await testPortalRoutes('Production', PRODUCTION_ROUTES, COOKIES.production);
  const investorResults = await testPortalRoutes('Investor', INVESTOR_ROUTES, COOKIES.investor);
  const creatorResults = await testPortalRoutes('Creator', CREATOR_ROUTES, COOKIES.creator);

  // Overall summary
  const totalPassed = productionResults.passed + investorResults.passed + creatorResults.passed;
  const totalFailed = productionResults.failed + investorResults.failed + creatorResults.failed;
  const totalRoutes = PRODUCTION_ROUTES.length + INVESTOR_ROUTES.length + CREATOR_ROUTES.length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('OVERALL SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Routes Tested: ${totalRoutes}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${((totalPassed / totalRoutes) * 100).toFixed(1)}%`);

  // List all failed routes
  if (totalFailed > 0) {
    console.log(`\n❌ FAILED ROUTES:`);

    const allResults = [
      ...productionResults.results.map(r => ({ ...r, portal: 'Production' })),
      ...investorResults.results.map(r => ({ ...r, portal: 'Investor' })),
      ...creatorResults.results.map(r => ({ ...r, portal: 'Creator' })),
    ];

    for (const result of allResults.filter(r => !r.success)) {
      console.log(`  [${(result as any).portal}] ${result.route.name}: ${result.route.apiEndpoint} - ${result.error}`);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);
