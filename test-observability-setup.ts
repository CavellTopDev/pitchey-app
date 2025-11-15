// Test Observability Setup
// Validates Sentry configuration and source map setup

async function testObservabilitySetup(): Promise<void> {
  console.log('🔬 OBSERVABILITY SETUP VALIDATION');
  console.log('==================================');
  console.log('');

  // Test 1: Frontend package dependencies
  console.log('📦 Testing Frontend Dependencies:');
  try {
    const packageJson = await Deno.readTextFile('./frontend/package.json');
    const pkg = JSON.parse(packageJson);
    
    const sentryReact = pkg.dependencies?.['@sentry/react'];
    const sentryVitePlugin = pkg.devDependencies?.['@sentry/vite-plugin'] || pkg.dependencies?.['@sentry/vite-plugin'];
    
    console.log(`   @sentry/react: ${sentryReact ? '✅ ' + sentryReact : '❌ Missing'}`);
    console.log(`   @sentry/vite-plugin: ${sentryVitePlugin ? '✅ ' + sentryVitePlugin : '❌ Missing'}`);
  } catch (error) {
    console.log(`   ❌ Error reading package.json: ${error.message}`);
  }

  // Test 2: Vite configuration
  console.log('\n🔧 Testing Vite Configuration:');
  try {
    const viteConfig = await Deno.readTextFile('./frontend/vite.config.ts');
    
    const hasSentryPlugin = viteConfig.includes('@sentry/vite-plugin');
    const hasSourcemapConfig = viteConfig.includes('sourcemap:') && viteConfig.includes('hidden');
    const hasConditionalPlugin = viteConfig.includes('SENTRY_ORG') && viteConfig.includes('SENTRY_PROJECT');
    
    console.log(`   Sentry plugin import: ${hasSentryPlugin ? '✅' : '❌'}`);
    console.log(`   Source map configuration: ${hasSourcemapConfig ? '✅' : '❌'}`);
    console.log(`   Conditional plugin activation: ${hasConditionalPlugin ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   ❌ Error reading vite.config.ts: ${error.message}`);
  }

  // Test 3: Frontend Sentry initialization
  console.log('\n🎨 Testing Frontend Sentry Setup:');
  try {
    const mainTsx = await Deno.readTextFile('./frontend/src/main.tsx');
    
    const hasSentryImport = mainTsx.includes('@sentry/react');
    const hasSentryInit = mainTsx.includes('Sentry.init');
    const hasIntegrations = mainTsx.includes('browserTracingIntegration') && mainTsx.includes('replayIntegration');
    const hasAuthScrubbing = mainTsx.includes('beforeSend') && mainTsx.includes('authorization');
    
    console.log(`   Sentry import: ${hasSentryImport ? '✅' : '❌'}`);
    console.log(`   Sentry.init call: ${hasSentryInit ? '✅' : '❌'}`);
    console.log(`   Browser integrations: ${hasIntegrations ? '✅' : '❌'}`);
    console.log(`   Authorization scrubbing: ${hasAuthScrubbing ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   ❌ Error reading main.tsx: ${error.message}`);
  }

  // Test 4: Backend Sentry integration
  console.log('\n🔧 Testing Backend Sentry Setup:');
  try {
    const workingServer = await Deno.readTextFile('./working-server.ts');
    
    const hasSentryImport = workingServer.includes('@sentry/deno');
    const hasRequestTagging = workingServer.includes('setTag') && workingServer.includes('route');
    const hasUserContext = workingServer.includes('setUser') && workingServer.includes('portal');
    const hasMethodTagging = workingServer.includes('method');
    
    console.log(`   Sentry Deno import: ${hasSentryImport ? '✅' : '❌'}`);
    console.log(`   Request route tagging: ${hasRequestTagging ? '✅' : '❌'}`);
    console.log(`   User context setting: ${hasUserContext ? '✅' : '❌'}`);
    console.log(`   HTTP method tagging: ${hasMethodTagging ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   ❌ Error reading working-server.ts: ${error.message}`);
  }

  // Test 5: Environment variable requirements
  console.log('\n🌍 Testing Environment Variables:');
  const envVars = [
    'SENTRY_ORG',
    'SENTRY_PROJECT', 
    'SENTRY_AUTH_TOKEN',
    'SENTRY_DSN',
    'VITE_SENTRY_DSN'
  ];
  
  envVars.forEach(varName => {
    const value = Deno.env.get(varName);
    console.log(`   ${varName}: ${value ? '✅ SET' : '❌ MISSING'}`);
  });

  // Test 6: Deployment script validation
  console.log('\n🚀 Testing Deployment Configuration:');
  try {
    const deployScript = await Deno.readTextFile('./deploy-observability-stack.sh');
    
    const hasSourceMapStrategy = deployScript.includes('FULL OBSERVABILITY');
    const hasPartialStrategy = deployScript.includes('PARTIAL OBSERVABILITY');
    const hasValidation = deployScript.includes('VALIDATION TESTS');
    
    console.log(`   Full observability strategy: ${hasSourceMapStrategy ? '✅' : '❌'}`);
    console.log(`   Partial observability fallback: ${hasPartialStrategy ? '✅' : '❌'}`);
    console.log(`   Validation tests: ${hasValidation ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   ❌ Error reading deployment script: ${error.message}`);
  }

  // Test 7: Generate configuration summary
  console.log('\n📋 CONFIGURATION SUMMARY:');
  console.log('========================');
  
  const sentryOrg = Deno.env.get('SENTRY_ORG');
  const sentryProject = Deno.env.get('SENTRY_PROJECT');
  const sentryAuthToken = Deno.env.get('SENTRY_AUTH_TOKEN');
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  const viteSentryDsn = Deno.env.get('VITE_SENTRY_DSN');

  if (sentryOrg && sentryProject && sentryAuthToken && sentryDsn && viteSentryDsn) {
    console.log('🎯 FULL OBSERVABILITY READY');
    console.log(`   Organization: ${sentryOrg}`);
    console.log(`   Project: ${sentryProject}`);
    console.log(`   Source Maps: ✅ Will be uploaded`);
    console.log(`   Backend Monitoring: ✅ Enabled`);
    console.log(`   Frontend Monitoring: ✅ Enabled`);
    console.log(`   Request Tagging: ✅ Enabled`);
    console.log(`   User Context: ✅ Enabled`);
    console.log(`   Session Replay: ✅ Enabled`);
  } else if (sentryDsn || viteSentryDsn) {
    console.log('📈 PARTIAL OBSERVABILITY READY');
    console.log(`   Backend Monitoring: ${sentryDsn ? '✅' : '❌'}`);
    console.log(`   Frontend Monitoring: ${viteSentryDsn ? '✅' : '❌'}`);
    console.log(`   Source Maps: ❌ Missing credentials`);
  } else {
    console.log('⚠️ MINIMAL OBSERVABILITY');
    console.log('   No Sentry configuration detected');
    console.log('   Only basic health checks available');
  }

  // Test 8: Deployment recommendations
  console.log('\n🎯 DEPLOYMENT RECOMMENDATIONS:');
  console.log('==============================');
  
  if (sentryOrg && sentryProject && sentryAuthToken && sentryDsn && viteSentryDsn) {
    console.log('✅ Ready for full observability deployment');
    console.log('   Run: ./deploy-observability-stack.sh');
    console.log('');
    console.log('📊 After deployment, set up these Sentry alerts:');
    console.log('   • Error rate > 1% for 5 minutes');
    console.log('   • P95 latency > 2s for dashboard endpoints');
    console.log('   • New issues in production environment');
    console.log('   • Session replay capture rate monitoring');
  } else {
    console.log('⚡ For full observability, set these environment variables:');
    if (!sentryOrg) console.log('   export SENTRY_ORG="your-org-slug"');
    if (!sentryProject) console.log('   export SENTRY_PROJECT="your-frontend-project-slug"');
    if (!sentryAuthToken) console.log('   export SENTRY_AUTH_TOKEN="your-auth-token"');
    if (!sentryDsn) console.log('   export SENTRY_DSN="your-backend-dsn"');
    if (!viteSentryDsn) console.log('   export VITE_SENTRY_DSN="your-frontend-dsn"');
    console.log('');
    console.log('Then run: ./deploy-observability-stack.sh');
  }

  console.log('\n✅ OBSERVABILITY SETUP VALIDATION COMPLETE');
}

if (import.meta.main) {
  await testObservabilitySetup();
}