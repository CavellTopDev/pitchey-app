#!/usr/bin/env -S deno run --allow-net --allow-read

/**
 * Production Architecture Analysis
 * Comprehensive analysis of deployment setup, endpoint routing, and configuration
 */

interface EndpointTest {
  url: string;
  method: string;
  expectedStatus: number[];
  description: string;
  authRequired?: boolean;
  role?: string;
}

interface DeploymentAnalysis {
  url: string;
  status: number;
  responseTime: number;
  healthy: boolean;
  version?: string;
  environment?: string;
  features: string[];
  issues: string[];
}

const ENDPOINTS_TO_TEST: EndpointTest[] = [
  // Health checks
  { url: 'https://pitchey.pages.dev', method: 'GET', expectedStatus: [200], description: 'Frontend deployment (Cloudflare Pages)' },
  { url: 'https://pitchey-backend-fresh.deno.dev/api/health', method: 'GET', expectedStatus: [200], description: 'Backend health (Deno Deploy)' },
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health', method: 'GET', expectedStatus: [200], description: 'Worker API health (Cloudflare Workers)' },
  
  // Public API endpoints
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/pitches/featured', method: 'GET', expectedStatus: [200], description: 'Featured pitches (Worker)' },
  { url: 'https://pitchey-backend-fresh.deno.dev/api/pitches/featured', method: 'GET', expectedStatus: [200], description: 'Featured pitches (Deno)' },
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/pitches/trending', method: 'GET', expectedStatus: [200], description: 'Trending pitches (Worker)' },
  { url: 'https://pitchey-backend-fresh.deno.dev/api/pitches/trending', method: 'GET', expectedStatus: [200], description: 'Trending pitches (Deno)' },
  
  // Authentication endpoints
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/validate-token', method: 'GET', expectedStatus: [401], description: 'Token validation (Worker) - should require auth' },
  { url: 'https://pitchey-backend-fresh.deno.dev/api/auth/status', method: 'GET', expectedStatus: [401], description: 'Auth status (Deno) - should require auth' },
  
  // Role-specific endpoints
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/creator/pitches', method: 'GET', expectedStatus: [401, 403], description: 'Creator pitches (Worker) - requires auth', authRequired: true, role: 'creator' },
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/investor/dashboard', method: 'GET', expectedStatus: [401, 403], description: 'Investor dashboard (Worker) - requires auth', authRequired: true, role: 'investor' },
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/production/dashboard', method: 'GET', expectedStatus: [401, 403], description: 'Production dashboard (Worker) - requires auth', authRequired: true, role: 'production' },
  
  // Database test endpoints (should be protected or removed)
  { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/db-test', method: 'GET', expectedStatus: [401, 403, 404, 200], description: 'Database test endpoint (should be protected!)' }
];

async function testEndpoint(test: EndpointTest): Promise<{
  test: EndpointTest;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
  response?: any;
}> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(test.url, {
      method: test.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Production-Architecture-Analyzer/1.0'
      }
    });
    
    const responseTime = performance.now() - startTime;
    const success = test.expectedStatus.includes(response.status);
    
    let responseData;
    try {
      const text = await response.text();
      responseData = text.startsWith('{') ? JSON.parse(text) : text;
    } catch {
      responseData = 'Non-JSON response';
    }
    
    return {
      test,
      status: response.status,
      responseTime: Math.round(responseTime),
      success,
      response: responseData
    };
    
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      test,
      status: 0,
      responseTime: Math.round(responseTime),
      success: false,
      error: error.message
    };
  }
}

async function analyzeDeployment(url: string, name: string): Promise<DeploymentAnalysis> {
  const startTime = performance.now();
  const analysis: DeploymentAnalysis = {
    url,
    status: 0,
    responseTime: 0,
    healthy: false,
    features: [],
    issues: []
  };
  
  try {
    const response = await fetch(url);
    analysis.status = response.status;
    analysis.responseTime = Math.round(performance.now() - startTime);
    
    if (response.ok) {
      analysis.healthy = true;
      
      // Try to get detailed health information
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        // Extract version and environment info
        if (data.data) {
          analysis.version = data.data.version;
          analysis.environment = data.data.environment;
          
          if (data.data.telemetry) {
            analysis.features.push('Telemetry Integration');
            if (data.data.telemetry.initialized) {
              analysis.features.push('Sentry Monitoring');
            } else {
              analysis.issues.push('Telemetry configured but not initialized');
            }
          }
          
          if (data.data.redis) {
            if (data.data.redis.enabled) {
              analysis.features.push('Redis Cache');
            } else {
              analysis.features.push('Redis Available (disabled)');
            }
          }
          
          if (data.data.coverage) {
            analysis.features.push(`Test Coverage: ${data.data.coverage}`);
          }
        }
      } else {
        analysis.features.push('Static Content');
      }
    } else {
      analysis.issues.push(`HTTP ${response.status} - ${response.statusText}`);
    }
    
  } catch (error) {
    analysis.issues.push(`Connection failed: ${error.message}`);
  }
  
  return analysis;
}

async function checkSecurityConfiguration(): Promise<{ issues: string[], recommendations: string[] }> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check if database test endpoint is exposed
  try {
    const response = await fetch('https://pitchey-api-production.cavelltheleaddev.workers.dev/api/db-test');
    if (response.status === 200) {
      issues.push('🚨 Database test endpoint is publicly accessible');
      recommendations.push('Remove or protect /api/db-test endpoint in production');
    }
  } catch {
    // Good - endpoint not accessible
  }
  
  // Check CORS headers
  try {
    const response = await fetch('https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health', {
      method: 'OPTIONS'
    });
    
    const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
    if (corsOrigin === '*') {
      issues.push('🚨 CORS allows all origins (*)');
      recommendations.push('Configure specific allowed origins for CORS');
    }
  } catch {
    // Could not test CORS
  }
  
  // Check for demo tokens in production URLs (should not be accessible without auth)
  const demoTests = [
    'demo-creator-1',
    'demo-investor-2', 
    'demo-production-3'
  ];
  
  for (const token of demoTests) {
    try {
      const response = await fetch('https://pitchey-api-production.cavelltheleaddev.workers.dev/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 200) {
        issues.push(`🚨 Demo token "${token}" is valid in production`);
        recommendations.push('Remove or restrict demo tokens in production environment');
      }
    } catch {
      // Good - demo tokens not working
    }
  }
  
  return { issues, recommendations };
}

async function analyzeArchitecture(): Promise<void> {
  console.log('🏗️ Production Architecture Analysis');
  console.log('=' .repeat(60));
  console.log();
  
  // 1. Analyze main deployments
  console.log('📊 Deployment Health Analysis:');
  console.log('-' .repeat(40));
  
  const deployments = [
    { url: 'https://pitchey.pages.dev', name: 'Frontend (Cloudflare Pages)' },
    { url: 'https://pitchey-backend-fresh.deno.dev/api/health', name: 'Backend (Deno Deploy)' },
    { url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health', name: 'API Worker (Cloudflare Workers)' }
  ];
  
  const deploymentResults: DeploymentAnalysis[] = [];
  
  for (const { url, name } of deployments) {
    const analysis = await analyzeDeployment(url, name);
    deploymentResults.push(analysis);
    
    const statusEmoji = analysis.healthy ? '✅' : '❌';
    console.log(`${statusEmoji} ${name}`);
    console.log(`   Status: ${analysis.status} | Response: ${analysis.responseTime}ms`);
    
    if (analysis.version) console.log(`   Version: ${analysis.version}`);
    if (analysis.environment) console.log(`   Environment: ${analysis.environment}`);
    
    if (analysis.features.length > 0) {
      console.log(`   Features: ${analysis.features.join(', ')}`);
    }
    
    if (analysis.issues.length > 0) {
      console.log(`   Issues: ${analysis.issues.join(', ')}`);
    }
    
    console.log();
  }
  
  // 2. Test API endpoints
  console.log('🔌 API Endpoint Testing:');
  console.log('-' .repeat(40));
  
  const results: any[] = [];
  
  for (const test of ENDPOINTS_TO_TEST) {
    const result = await testEndpoint(test);
    results.push(result);
    
    const emoji = result.success ? '✅' : result.status === 0 ? '🔴' : '⚠️';
    const roleInfo = test.role ? ` [${test.role}]` : '';
    
    console.log(`${emoji} ${test.description}${roleInfo}`);
    console.log(`   ${test.method} ${test.url}`);
    console.log(`   Status: ${result.status} | Time: ${result.responseTime}ms`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log();
    
    // Small delay to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 3. Security analysis
  console.log('🔒 Security Configuration Analysis:');
  console.log('-' .repeat(40));
  
  const security = await checkSecurityConfiguration();
  
  if (security.issues.length === 0) {
    console.log('✅ No major security issues detected');
  } else {
    console.log('Security Issues Found:');
    security.issues.forEach(issue => console.log(`   ${issue}`));
  }
  
  if (security.recommendations.length > 0) {
    console.log('\\nRecommendations:');
    security.recommendations.forEach(rec => console.log(`   💡 ${rec}`));
  }
  
  console.log();
  
  // 4. Architecture summary
  console.log('🏗️ Architecture Summary:');
  console.log('=' .repeat(60));
  
  const healthyDeployments = deploymentResults.filter(d => d.healthy).length;
  const totalDeployments = deploymentResults.length;
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  console.log(`📊 Deployment Health: ${healthyDeployments}/${totalDeployments} healthy`);
  console.log(`🔌 Endpoint Tests: ${successfulTests}/${totalTests} passing`);
  console.log(`🔒 Security Issues: ${security.issues.length} found`);
  
  console.log('\\n🌐 Production URLs:');
  console.log(`   Frontend: https://pitchey.pages.dev`);
  console.log(`   API (Primary): https://pitchey-api-production.cavelltheleaddev.workers.dev`);
  console.log(`   API (Backup): https://pitchey-backend-fresh.deno.dev`);
  
  console.log('\\n⚙️ Architecture Pattern:');
  console.log('   • Cloudflare Pages (Frontend) → Edge-first static deployment');
  console.log('   • Cloudflare Workers (API) → Global edge compute with fallback');
  console.log('   • Deno Deploy (Backend) → Serverless TypeScript runtime');
  console.log('   • Progressive Migration → Worker proxies to Deno for unimplemented routes');
  
  console.log('\\n🔄 Request Flow:');
  console.log('   1. User → Cloudflare Pages (Frontend)');
  console.log('   2. Frontend → Cloudflare Workers API (Edge)');
  console.log('   3. Workers → Deno Deploy (Fallback for missing endpoints)');
  console.log('   4. Database → Neon PostgreSQL via Hyperdrive (Workers) or direct (Deno)');
  
  console.log('\\n📈 Performance Characteristics:');
  const avgWorkerTime = results.filter(r => r.test.url.includes('workers.dev')).reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.test.url.includes('workers.dev')).length;
  const avgDenoTime = results.filter(r => r.test.url.includes('deno.dev')).reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.test.url.includes('deno.dev')).length;
  
  console.log(`   Workers API Average: ${Math.round(avgWorkerTime)}ms`);
  console.log(`   Deno API Average: ${Math.round(avgDenoTime)}ms`);
  
  if (avgWorkerTime > 0 && avgDenoTime > 0) {
    const improvement = ((avgDenoTime - avgWorkerTime) / avgDenoTime * 100);
    console.log(`   Workers Performance: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% vs Deno`);
  }
  
  console.log('\\n🛠️ Next Steps:');
  if (security.issues.length > 0) {
    console.log('   1. Address security issues listed above');
  }
  if (successfulTests < totalTests) {
    console.log('   2. Investigate failing endpoint tests');
  }
  console.log('   3. Monitor telemetry initialization in production');
  console.log('   4. Consider migrating more endpoints from Deno to Workers for better performance');
  console.log('   5. Set up automated health checks and alerting');
}

// Run architecture analysis
await analyzeArchitecture();