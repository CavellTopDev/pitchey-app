// Test Sentry Integration
// Run this after adding your Sentry DSN to verify it's working

import { sentryService, captureException, captureMessage } from "./src/services/sentry.service.ts";

console.log("🧪 Testing Sentry Integration");
console.log("==============================\n");

// Test 1: Send a test message
console.log("1. Sending test message to Sentry...");
captureMessage("Sentry integration test from Pitchey backend", "info");

// Test 2: Send a warning
console.log("2. Sending warning to Sentry...");
captureMessage("This is a test warning from deployment", "warning");

// Test 3: Send an error
console.log("3. Sending test error to Sentry...");
try {
  throw new Error("Test error - Sentry is working correctly!");
} catch (error) {
  captureException(error as Error, {
    test: true,
    environment: "testing",
    description: "This is a test error to verify Sentry integration"
  });
}

// Test 4: Test with user context
console.log("4. Setting user context...");
sentryService.setUser({
  id: "test-user-123",
  email: "test@pitchey.com",
  username: "testuser"
});

// Test 5: Add tags
console.log("5. Adding custom tags...");
sentryService.setTag("deployment", "test");
sentryService.setTag("version", "1.0.0");

// Test 6: Add breadcrumb
console.log("6. Adding breadcrumb...");
sentryService.addBreadcrumb({
  message: "Test script started",
  category: "test",
  level: "info",
  data: { script: "test-sentry.ts" }
});

console.log("\n✅ Test complete!");
console.log("\nNext steps:");
console.log("1. Go to https://sentry.io");
console.log("2. Check your pitchey-backend project");
console.log("3. You should see the test error and messages in the Issues tab");
console.log("\nIf you don't see anything:");
console.log("- Make sure SENTRY_DSN is set in your environment");
console.log("- Check that the DSN is correct");
console.log("- Verify you're looking at the right project in Sentry");

// Wait a moment for requests to complete
setTimeout(() => {
  console.log("\n👋 Exiting test script");
  Deno.exit(0);
}, 2000);