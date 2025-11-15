// Emergency Sentry Deployment Diagnosis
// Check why Sentry is still not initializing after production deployment

const PRODUCTION_BACKEND_URL = 'https://pitchey-backend-fresh.deno.dev';

interface SentryHealthCheck {
  url: string;
  status: number;
  response: any;
  telemetryInitialized: boolean;
  sentryConfigured: boolean;
  environment: string;
  timestamp: string;
}

async function diagnoseSentryDeployment(): Promise<void> {
  console.log('🔍 Emergency Sentry Deployment Diagnosis');
  console.log('========================================');
  console.log('');

  try {
    // Test health endpoint multiple times to ensure consistency
    const healthChecks: SentryHealthCheck[] = [];
    
    for (let i = 1; i <= 3; i++) {
      console.log(`📊 Health Check ${i}/3...`);
      
      const response = await fetch(`${PRODUCTION_BACKEND_URL}/api/health`);
      const data = await response.json();
      
      healthChecks.push({
        url: `${PRODUCTION_BACKEND_URL}/api/health`,
        status: response.status,
        response: data,
        telemetryInitialized: data?.telemetry?.initialized || false,
        sentryConfigured: data?.telemetry?.sentry?.configured || false,
        environment: data?.environment || 'unknown',
        timestamp: new Date().toISOString()
      });
      
      if (i < 3) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n📋 DIAGNOSIS RESULTS:');
    console.log('====================');
    
    // Analyze results
    const allInitialized = healthChecks.every(check => check.telemetryInitialized);
    const allConfigured = healthChecks.every(check => check.sentryConfigured);
    const environments = [...new Set(healthChecks.map(check => check.environment))];
    
    console.log(`✅ Sentry Initialized: ${allInitialized ? 'YES' : 'NO'}`);
    console.log(`✅ Sentry Configured: ${allConfigured ? 'YES' : 'NO'}`);
    console.log(`🌍 Environment(s): ${environments.join(', ')}`);
    console.log('');
    
    if (!allInitialized) {
      console.log('❌ PROBLEM IDENTIFIED:');
      console.log('=====================');
      console.log('Sentry is still not initializing after deployment.');
      console.log('');
      
      console.log('🔧 RECOMMENDED ACTIONS:');
      console.log('=======================');
      console.log('1. Check if deployment actually applied environment variables');
      console.log('2. Verify Sentry DSN format and validity');
      console.log('3. Check for deployment caching issues');
      console.log('4. Force redeploy with --force flag');
      console.log('');
      
      // Generate emergency redeploy script
      const emergencyDeploy = `
#!/bin/bash
echo "🚨 Emergency Sentry Redeploy"
echo "============================"

echo "🔄 Force redeploying with explicit Sentry configuration..."

DENO_DEPLOY_TOKEN=ddp_0xCz7itR2p7NIjymyodtIOI3wfjS2n0LB8oH \\
deployctl deploy \\
  --project=pitchey-backend-fresh \\
  --entrypoint=working-server.ts \\
  --env="SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536" \\
  --env="DENO_ENV=production" \\
  --env="NODE_ENV=production" \\
  --env="SENTRY_ENVIRONMENT=production" \\
  --env="SENTRY_RELEASE=pitchey-backend-v3.7-emergency" \\
  --env="CACHE_ENABLED=true" \\
  --production \\
  --force

echo "✅ Emergency deployment complete. Waiting for propagation..."
sleep 15

echo "🔍 Testing Sentry initialization..."
curl -s "https://pitchey-backend-fresh.deno.dev/api/health" | jq '.telemetry'

echo "🎯 If still failing, the issue may be in the Sentry initialization code itself."
`;
      
      await Deno.writeTextFile('./emergency-sentry-redeploy.sh', emergencyDeploy);
      console.log('📄 Generated: emergency-sentry-redeploy.sh');
      console.log('   Run: chmod +x emergency-sentry-redeploy.sh && ./emergency-sentry-redeploy.sh');
    } else {
      console.log('✅ SUCCESS: Sentry initialization confirmed working!');
    }
    
    // Log detailed responses
    console.log('\n📊 DETAILED HEALTH CHECK RESPONSES:');
    console.log('===================================');
    healthChecks.forEach((check, index) => {
      console.log(`\n${index + 1}. ${check.timestamp}`);
      console.log(`   Status: ${check.status}`);
      console.log(`   Telemetry: ${JSON.stringify(check.response.telemetry, null, 2)}`);
    });
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

if (import.meta.main) {
  await diagnoseSentryDeployment();
}