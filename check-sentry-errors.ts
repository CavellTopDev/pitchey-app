/**
 * Check Sentry logs for production errors in Deno Deploy
 */

// Since we can't directly query Sentry API without authentication,
// let's create a test endpoint that will trigger errors and report them to Sentry
// Then check the Sentry dashboard manually

const SENTRY_DSN = "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536";
const DEPLOYMENT_URL = "https://pitchey-backend-fresh-twh5p5qy4je9.deno.dev";

console.log("🔍 Checking Sentry error capture for Deno Deploy errors");
console.log(`📡 Deployment URL: ${DEPLOYMENT_URL}`);
console.log(`📊 Sentry DSN: ${SENTRY_DSN}`);

// Test multiple endpoints to trigger errors
const endpoints = [
  "/",
  "/api/health", 
  "/api/pitches",
  "/api/auth/login"
];

console.log("\n🚨 Triggering errors to capture in Sentry...");

for (const endpoint of endpoints) {
  try {
    console.log(`Testing ${endpoint}...`);
    const response = await fetch(`${DEPLOYMENT_URL}${endpoint}`);
    console.log(`  Status: ${response.status}`);
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
}

console.log("\n✅ Error capture attempts completed");
console.log(`📱 Check Sentry dashboard at: https://sentry.io/organizations/pitchey/issues/`);
console.log(`🔗 Project link: https://sentry.io/settings/pitchey/projects/pitchey-backend/`);

console.log("\n📋 Manual Steps to Check Sentry:");
console.log("1. Login to Sentry dashboard");
console.log("2. Navigate to the 'pitchey-backend' project");
console.log("3. Check the 'Issues' tab for recent errors");
console.log("4. Look for errors from the last few minutes");
console.log("5. Click on any 500 errors to see the full stack trace");

console.log("\n🔍 Expected Error Types:");
console.log("- Import/Module resolution errors");
console.log("- Environment variable issues"); 
console.log("- Database connection problems");
console.log("- Serverless compatibility issues");