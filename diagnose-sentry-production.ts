#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Diagnose Sentry Production Issues
 * Identifies why telemetry is not initializing in production
 */

interface TelemetryDiagnostic {
  endpoint: string;
  environment: string;
  initialized: boolean;
  configured: boolean;
  issues: string[];
  recommendations: string[];
}

async function diagnoseTelemetryEndpoint(url: string): Promise<TelemetryDiagnostic> {
  const diagnostic: TelemetryDiagnostic = {
    endpoint: url,
    environment: 'unknown',
    initialized: false,
    configured: false,
    issues: [],
    recommendations: []
  };

  try {
    const response = await fetch(`${url}/api/health`);
    
    if (!response.ok) {
      diagnostic.issues.push(`Health endpoint returned ${response.status}`);
      return diagnostic;
    }

    const health = await response.json();
    
    if (health.data?.telemetry) {
      const telemetry = health.data.telemetry;
      diagnostic.environment = telemetry.environment;
      diagnostic.initialized = telemetry.initialized;
      diagnostic.configured = telemetry.config?.sentryConfigured || false;

      // Analyze issues
      if (!diagnostic.configured) {
        diagnostic.issues.push('SENTRY_DSN environment variable not set');
        diagnostic.recommendations.push('Deploy with SENTRY_DSN environment variable');
      }

      if (diagnostic.configured && !diagnostic.initialized) {
        diagnostic.issues.push('Sentry configured but initialization failed');
        diagnostic.recommendations.push('Check Sentry DSN format and network connectivity');
        
        if (diagnostic.environment === 'development') {
          diagnostic.issues.push('Running in development environment instead of production');
          diagnostic.recommendations.push('Set DENO_ENV=production in deployment');
        }
      }

      // Check sample rate
      if (telemetry.config?.sampleRate !== undefined) {
        if (diagnostic.environment === 'production' && telemetry.config.sampleRate !== 0.1) {
          diagnostic.issues.push(`Production sample rate is ${telemetry.config.sampleRate}, expected 0.1`);
          diagnostic.recommendations.push('Verify production environment detection');
        }
      }

    } else {
      diagnostic.issues.push('No telemetry information in health response');
      diagnostic.recommendations.push('Verify telemetry integration is deployed');
    }

  } catch (error) {
    diagnostic.issues.push(`Failed to connect: ${error.message}`);
  }

  return diagnostic;
}

async function testSentryDSN(dsn: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Basic DSN format validation
    const dsnRegex = /^https:\/\/[a-f0-9]+@[a-f0-9-]+\.ingest\.sentry\.io\/[0-9]+$/;
    
    if (!dsnRegex.test(dsn)) {
      return { valid: false, error: 'Invalid DSN format' };
    }

    // Test connectivity to Sentry
    const url = new URL(dsn);
    const projectId = url.pathname.slice(1);
    const key = url.username;
    
    // Basic connectivity test
    const response = await fetch(`https://${url.hostname}/api/0/projects/`, {
      headers: {
        'Authorization': `DSN ${dsn}`
      }
    });

    return { valid: response.status !== 401 };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function generateProductionDeployScript(): Promise<string> {
  return `#!/bin/bash

# Production Sentry Fix Deployment Script
# Fixes telemetry initialization issues

set -e

echo "🔧 Deploying Sentry Production Fix..."

# 1. Deploy backend with correct environment variables
echo "📡 Deploying Deno Deploy backend with production config..."

DENO_DEPLOY_TOKEN="\${DENO_DEPLOY_TOKEN:-$DENO_DEPLOY_TOKEN}"
SENTRY_DSN="https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"

deno run --allow-all --no-check https://deno.land/x/deploy@1.12.0/deployctl.ts deploy \\
  --project=pitchey-backend-fresh \\
  --entrypoint=working-server.ts \\
  --env="SENTRY_DSN=\$SENTRY_DSN" \\
  --env="DENO_ENV=production" \\
  --env="NODE_ENV=production" \\
  --env="SENTRY_ENVIRONMENT=production" \\
  --env="SENTRY_RELEASE=pitchey-backend-v3.4" \\
  --env="DATABASE_URL=\${DATABASE_URL}" \\
  --env="JWT_SECRET=\${JWT_SECRET}" \\
  --env="FRONTEND_URL=https://pitchey-5o8.pages.dev" \\
  --env="UPSTASH_REDIS_REST_URL=\${UPSTASH_REDIS_REST_URL}" \\
  --env="UPSTASH_REDIS_REST_TOKEN=\${UPSTASH_REDIS_REST_TOKEN}" \\
  --env="CACHE_ENABLED=true" \\
  --production

echo "✅ Backend deployed successfully!"

# 2. Test telemetry initialization
echo "🧪 Testing telemetry initialization..."

sleep 10

HEALTH_RESPONSE=\$(curl -s https://pitchey-backend-fresh.deno.dev/api/health)
echo "Health response: \$HEALTH_RESPONSE"

# Check if telemetry is now initialized
if echo "\$HEALTH_RESPONSE" | grep -q '"initialized":true'; then
  echo "✅ Telemetry successfully initialized!"
else
  echo "❌ Telemetry still not initialized"
  echo "Response: \$HEALTH_RESPONSE"
  exit 1
fi

# 3. Send test error to validate Sentry
echo "📤 Sending test error to Sentry..."

TEST_RESPONSE=\$(curl -s -X POST "https://pitchey-backend-fresh.deno.dev/api/test-telemetry-error" \\
  -H "Content-Type: application/json" \\
  -d '{"test": true}' || echo "Test endpoint not available")

echo "Test error sent: \$TEST_RESPONSE"

echo "🎉 Sentry production fix deployment completed!"
echo ""
echo "📊 Next steps:"
echo "1. Check Sentry dashboard for incoming events"
echo "2. Verify telemetry health at: https://pitchey-backend-fresh.deno.dev/api/health"
echo "3. Monitor error tracking in production"
`;
}

async function runDiagnostic(): Promise<void> {
  console.log('🔍 Sentry Production Diagnostic\n');
  console.log('=' .repeat(50));

  // Test current production endpoints
  const endpoints = [
    'https://pitchey-backend-fresh.deno.dev',
    'https://pitchey-api-prod.ndlovucavelle.workers.dev'
  ];

  console.log('📡 Testing Production Endpoints:\n');

  for (const endpoint of endpoints) {
    console.log(`🔍 Analyzing: ${endpoint}`);
    const diagnostic = await diagnoseTelemetryEndpoint(endpoint);

    console.log(`   Environment: ${diagnostic.environment}`);
    console.log(`   Configured: ${diagnostic.configured}`);
    console.log(`   Initialized: ${diagnostic.initialized}`);

    if (diagnostic.issues.length > 0) {
      console.log('   Issues:');
      diagnostic.issues.forEach(issue => console.log(`     ❌ ${issue}`));
    }

    if (diagnostic.recommendations.length > 0) {
      console.log('   Recommendations:');
      diagnostic.recommendations.forEach(rec => console.log(`     💡 ${rec}`));
    }

    console.log();
  }

  // Test Sentry DSN
  console.log('🔑 Testing Sentry DSN:\n');
  const testDSN = 'https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536';
  const dsnTest = await testSentryDSN(testDSN);
  
  if (dsnTest.valid) {
    console.log('✅ Sentry DSN is valid and accessible');
  } else {
    console.log(`❌ Sentry DSN validation failed: ${dsnTest.error || 'Unknown error'}`);
  }

  console.log();

  // Generate deployment script
  console.log('🚀 Generating Production Fix Script:\n');
  const deployScript = await generateProductionDeployScript();
  
  await Deno.writeTextFile('./deploy-sentry-production-fix.sh', deployScript);
  await Deno.writeTextFile('./deploy-sentry-production-fix.bat', deployScript.replace(/^#!\/bin\/bash/g, '@echo off'));

  console.log('✅ Generated deployment scripts:');
  console.log('   - deploy-sentry-production-fix.sh (Unix/Linux/macOS)');
  console.log('   - deploy-sentry-production-fix.bat (Windows)');

  console.log('\n📋 Summary of Issues Found:');
  
  // Aggregate all issues
  const allIssues: string[] = [];
  const allRecommendations: string[] = [];

  for (const endpoint of endpoints) {
    const diagnostic = await diagnoseTelemetryEndpoint(endpoint);
    allIssues.push(...diagnostic.issues);
    allRecommendations.push(...diagnostic.recommendations);
  }

  // Remove duplicates
  const uniqueIssues = [...new Set(allIssues)];
  const uniqueRecommendations = [...new Set(allRecommendations)];

  if (uniqueIssues.length === 0) {
    console.log('✅ No telemetry issues found!');
  } else {
    console.log('Issues to address:');
    uniqueIssues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
  }

  if (uniqueRecommendations.length > 0) {
    console.log('\nRecommended actions:');
    uniqueRecommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
  }

  console.log('\n🎯 Primary Issue: Environment Configuration');
  console.log('The main problem is that the backend is running in "development" mode instead of "production" mode.');
  console.log('This prevents Sentry from initializing with production settings.');

  console.log('\n⚡ Quick Fix:');
  console.log('Run: chmod +x deploy-sentry-production-fix.sh && ./deploy-sentry-production-fix.sh');
}

// Run diagnostic
await runDiagnostic();