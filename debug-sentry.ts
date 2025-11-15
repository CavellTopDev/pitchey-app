#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Debug Sentry Configuration
 * Checks environment variables and Sentry initialization
 */

import { telemetry } from "./src/utils/telemetry.ts";

console.log("🔍 Debugging Sentry Configuration\n");

// Check environment variables
console.log("Environment Variables:");
console.log(`SENTRY_DSN: ${Deno.env.get("SENTRY_DSN") ? "✅ Set" : "❌ Not Set"}`);
console.log(`DENO_ENV: ${Deno.env.get("DENO_ENV") || "undefined"}`);

// Test telemetry initialization
console.log("\nTelemetry Status:");
try {
  telemetry.initialize();
  const status = telemetry.getHealthStatus();
  console.log(`Initialized: ${status.initialized}`);
  console.log(`Environment: ${status.environment}`);
  console.log(`Sentry Configured: ${status.config.sentryConfigured}`);
  
  if (status.initialized) {
    console.log("\n✅ Telemetry initialized successfully!");
    
    // Test capturing a message
    telemetry.captureMessage("Test message from debug script", "info");
    console.log("📤 Sent test message to Sentry");
    
    // Test error capture
    try {
      throw new Error("Test error for Sentry validation");
    } catch (error) {
      telemetry.logger.error("Test error captured", error);
      console.log("📤 Sent test error to Sentry");
    }
  } else {
    console.log("\n❌ Telemetry not initialized");
    console.log("Possible causes:");
    console.log("1. SENTRY_DSN environment variable not set");
    console.log("2. Invalid Sentry DSN format");
    console.log("3. Network connectivity issues");
  }
  
} catch (error) {
  console.error("❌ Error testing telemetry:", error.message);
}

// Test direct environment check
console.log("\nDirect Environment Check:");
const sentryDsn = Deno.env.get("SENTRY_DSN");
if (sentryDsn) {
  console.log(`✅ SENTRY_DSN found: ${sentryDsn.substring(0, 20)}...`);
} else {
  console.log("❌ SENTRY_DSN not found in environment");
}