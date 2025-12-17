/**
 * Browse Endpoint Load Test
 * Tests the performance of browse and search endpoints under load
 */

import { VirtualUser, MetricsCollector, LOAD_TEST_CONFIGS } from '../load-test-config.ts';

const BASE_URL = Deno.env.get("LOAD_TEST_URL") || "http://localhost:8001";

async function runBrowseScenario(config: typeof LOAD_TEST_CONFIGS.load) {
  const metrics = new MetricsCollector();
  metrics.start();

  const scenario = config.scenarios.load || config.scenarios.browse;
  const vus = scenario.vus || 10;
  const duration = parseDuration(scenario.duration || '1m');

  console.log(`🚀 Starting Browse Load Test`);
  console.log(`   Virtual Users: ${vus}`);
  console.log(`   Duration: ${scenario.duration}`);
  console.log(`   Target URL: ${BASE_URL}`);
  console.log('');

  const users: VirtualUser[] = [];
  const tasks: Promise<void>[] = [];

  // Create virtual users
  for (let i = 0; i < vus; i++) {
    const user = new VirtualUser(`user-${i}`, BASE_URL, metrics);
    users.push(user);
  }

  // Start load test
  const startTime = Date.now();
  const endTime = startTime + duration;

  for (const user of users) {
    tasks.push(runUserSession(user, endTime, metrics));
  }

  // Wait for all users to complete
  await Promise.all(tasks);

  // Print results
  const summary = metrics.getSummary();
  printResults(summary, config.thresholds);
}

async function runUserSession(
  user: VirtualUser,
  endTime: number,
  metrics: MetricsCollector
) {
  // User flow simulation
  const endpoints = [
    '/api/browse?tab=trending',
    '/api/browse?tab=new',
    '/api/browse?tab=featured',
    '/api/search?q=thriller',
    '/api/search?genre=Drama',
    '/api/pitches?page=1&limit=20',
    '/api/pitches?status=published',
    '/api/browse?genre=Comedy&tab=trending'
  ];

  while (Date.now() < endTime) {
    // Random endpoint selection
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    try {
      // Make request
      const response = await user.request('GET', endpoint);
      
      // Random think time (100-500ms)
      await sleep(100 + Math.random() * 400);
      
      // Occasionally do a deeper browse
      if (Math.random() < 0.3 && response.ok) {
        const data = await response.json();
        if (data.data?.pitches?.length > 0) {
          const pitch = data.data.pitches[0];
          await user.request('GET', `/api/pitches/${pitch.id}`);
          await sleep(200 + Math.random() * 300);
        }
      }
    } catch (error) {
      metrics.record('errors', 1);
    }
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) return 60000; // Default 1 minute
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return 60000;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printResults(summary: any, thresholds: Record<string, string[]>) {
  console.log('\n📊 Load Test Results');
  console.log('=' .repeat(50));
  
  // Request metrics
  if (summary.http_req_duration) {
    console.log('\nHTTP Request Duration:');
    console.log(`  Min: ${summary.http_req_duration.min.toFixed(2)}ms`);
    console.log(`  Max: ${summary.http_req_duration.max.toFixed(2)}ms`);
    console.log(`  Avg: ${summary.http_req_duration.avg.toFixed(2)}ms`);
    console.log(`  P50: ${summary.http_req_duration.p50.toFixed(2)}ms`);
    console.log(`  P95: ${summary.http_req_duration.p95.toFixed(2)}ms`);
    console.log(`  P99: ${summary.http_req_duration.p99.toFixed(2)}ms`);
  }
  
  if (summary.http_reqs) {
    console.log('\nTotal Requests:');
    console.log(`  Count: ${summary.http_reqs.count}`);
    console.log(`  Rate: ${summary.http_reqs.rate.toFixed(2)} req/s`);
  }
  
  if (summary.http_req_failed) {
    const failRate = (summary.http_req_failed.count / summary.http_reqs.count) * 100;
    console.log('\nFailed Requests:');
    console.log(`  Count: ${summary.http_req_failed.count}`);
    console.log(`  Rate: ${failRate.toFixed(2)}%`);
  }
  
  if (summary.errors) {
    console.log('\nErrors:');
    console.log(`  Count: ${summary.errors.count}`);
  }
  
  // Check thresholds
  console.log('\n✅ Threshold Checks:');
  let allPassed = true;
  
  for (const [metric, checks] of Object.entries(thresholds)) {
    for (const check of checks) {
      const passed = evaluateThreshold(summary, metric, check);
      console.log(`  ${metric}: ${check} - ${passed ? '✅ PASS' : '❌ FAIL'}`);
      if (!passed) allPassed = false;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(allPassed ? '✅ All thresholds passed!' : '❌ Some thresholds failed!');
}

function evaluateThreshold(summary: any, metric: string, check: string): boolean {
  // Parse threshold check (e.g., "p(95)<1000" or "rate<0.05")
  const match = check.match(/^(p\((\d+)\)|rate|count|min|max|avg)<(.+)$/);
  if (!match) return false;
  
  const type = match[1];
  const percentile = match[2];
  const threshold = parseFloat(match[3]);
  
  if (metric === 'http_req_failed' && type === 'rate') {
    const failRate = (summary.http_req_failed?.count || 0) / (summary.http_reqs?.count || 1);
    return failRate < threshold;
  }
  
  if (metric === 'http_req_duration' && type.startsWith('p')) {
    const p = `p${percentile}`;
    return (summary.http_req_duration?.[p] || 0) < threshold;
  }
  
  if (metric === 'http_reqs' && type === 'rate') {
    return (summary.http_reqs?.rate || 0) > threshold;
  }
  
  return true;
}

// Run test if executed directly
if (import.meta.main) {
  const testType = Deno.args[0] || 'load';
  const config = LOAD_TEST_CONFIGS[testType as keyof typeof LOAD_TEST_CONFIGS];
  
  if (!config) {
    console.error(`Unknown test type: ${testType}`);
    console.log('Available types: smoke, load, stress, spike, soak');
    Deno.exit(1);
  }
  
  await runBrowseScenario(config);
}