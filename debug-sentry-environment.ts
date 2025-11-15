// Debug Sentry Environment Variables
// Check if environment variables are properly reaching the telemetry system

console.log('🔍 SENTRY ENVIRONMENT DEBUG');
console.log('===========================');
console.log('');

// Check all relevant environment variables
const envVars = [
  'SENTRY_DSN',
  'DENO_ENV', 
  'NODE_ENV',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE'
];

console.log('📋 Environment Variables:');
envVars.forEach(varName => {
  const value = Deno.env.get(varName);
  console.log(`   ${varName}: ${value ? '✅ SET' : '❌ MISSING'}`);
  if (value && varName === 'SENTRY_DSN') {
    // Show partial DSN for verification
    console.log(`      Value: ${value.substring(0, 30)}...`);
  } else if (value) {
    console.log(`      Value: ${value}`);
  }
});
console.log('');

// Test telemetry import and initialization
console.log('🔧 Testing Telemetry Import:');
try {
  const { telemetry } = await import('./src/utils/telemetry.ts');
  console.log('✅ Telemetry module imported successfully');
  
  console.log('📊 Telemetry Health Status:');
  const health = telemetry.getHealthStatus();
  console.log(JSON.stringify(health, null, 2));
  
  // Manual initialization test
  console.log('');
  console.log('🚀 Testing Manual Initialization:');
  telemetry.initialize();
  
  const healthAfterInit = telemetry.getHealthStatus();
  console.log('After manual init:');
  console.log(JSON.stringify(healthAfterInit, null, 2));
  
} catch (error) {
  console.error('❌ Failed to import/test telemetry:', error);
}