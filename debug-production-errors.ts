#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Debug Production Backend Errors
 * 
 * This script simulates the production deployment locally to identify
 * where the 500 errors are coming from.
 */

console.log("🔍 DEBUGGING PRODUCTION DEPLOYMENT ERRORS");
console.log("=" .repeat(50));

// Simulate production environment variables
Deno.env.set("DENO_ENV", "production");
Deno.env.set("NODE_ENV", "production");

// Check critical environment variables
const criticalEnvVars = [
  "JWT_SECRET",
  "DATABASE_URL",
  "SENTRY_DSN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
];

console.log("\n📋 ENVIRONMENT VARIABLE CHECK:");
for (const envVar of criticalEnvVars) {
  const value = Deno.env.get(envVar);
  console.log(`   ${envVar}: ${value ? "✅ SET" : "❌ MISSING"}`);
  if (value && envVar !== "JWT_SECRET") {
    console.log(`     Value: ${value.substring(0, 30)}...`);
  }
}

// Test each import individually to find which is failing
console.log("\n🧪 TESTING IMPORTS:");

const imports = [
  { name: "Telemetry", path: "./src/utils/telemetry.ts" },
  { name: "Environment Validation", path: "./src/utils/env-validation.ts" },
  { name: "Database Client", path: "./src/db/client.ts" },
  { name: "Redis Service", path: "./src/services/redis-native.service.ts" },
  { name: "Response Utils", path: "./src/utils/response.ts" }
];

for (const imp of imports) {
  try {
    console.log(`   Testing ${imp.name}...`);
    const module = await import(imp.path);
    console.log(`   ✅ ${imp.name} imported successfully`);
  } catch (error) {
    console.log(`   ❌ ${imp.name} failed: ${error.message}`);
    console.log(`      Stack: ${error.stack}`);
  }
}

// Test environment validation specifically
console.log("\n🔧 TESTING ENVIRONMENT VALIDATION:");
try {
  const { validateEnvironment } = await import("./src/utils/env-validation.ts");
  const envConfig = validateEnvironment();
  console.log("   ✅ Environment validation passed");
  console.log(`   JWT_SECRET length: ${envConfig.JWT_SECRET?.length || 0}`);
  console.log(`   DATABASE_URL: ${envConfig.DATABASE_URL ? "set" : "missing"}`);
} catch (error) {
  console.log(`   ❌ Environment validation failed: ${error.message}`);
  if (error.missingVars) {
    console.log(`   Missing variables: ${error.missingVars.join(", ")}`);
  }
}

// Test telemetry initialization
console.log("\n📊 TESTING TELEMETRY INITIALIZATION:");
try {
  const { telemetry } = await import("./src/utils/telemetry.ts");
  telemetry.initialize();
  console.log("   ✅ Telemetry initialized successfully");
  
  const healthStatus = telemetry.getHealthStatus();
  console.log(`   Environment: ${healthStatus.environment}`);
  console.log(`   Initialized: ${healthStatus.initialized}`);
  console.log(`   Sentry Configured: ${healthStatus.config.sentryConfigured}`);
} catch (error) {
  console.log(`   ❌ Telemetry initialization failed: ${error.message}`);
  console.log(`      Stack: ${error.stack}`);
}

// Test database connection
console.log("\n🗄️  TESTING DATABASE CONNECTION:");
try {
  const { db } = await import("./src/db/client.ts");
  // Simple query to test connection
  await db.execute(sql`SELECT 1`);
  console.log("   ✅ Database connection successful");
} catch (error) {
  console.log(`   ❌ Database connection failed: ${error.message}`);
  console.log(`      Stack: ${error.stack}`);
}

// Test Redis connection
console.log("\n🔴 TESTING REDIS CONNECTION:");
try {
  const { nativeRedisService } = await import("./src/services/redis-native.service.ts");
  const redis = nativeRedisService;
  await redis.ping();
  console.log("   ✅ Redis connection successful");
} catch (error) {
  console.log(`   ❌ Redis connection failed: ${error.message}`);
  console.log("   This is expected if Redis is not available");
}

// Test basic server startup without running the server
console.log("\n🚀 TESTING SERVER MODULE IMPORTS:");
const serverModules = [
  "./src/services/userService.ts",
  "./src/services/pitch.service.ts",
  "./src/services/nda.service.ts",
  "./src/services/auth.service.ts"
];

for (const modulePath of serverModules) {
  try {
    console.log(`   Testing ${modulePath}...`);
    await import(modulePath);
    console.log(`   ✅ ${modulePath} imported successfully`);
  } catch (error) {
    console.log(`   ❌ ${modulePath} failed: ${error.message}`);
    console.log(`      Stack: ${error.stack?.split('\n')[0]}`);
  }
}

console.log("\n📋 SUMMARY:");
console.log("If any of the above tests failed, that's likely the root cause");
console.log("of the 500 errors in production.");
console.log("");
console.log("Common issues:");
console.log("1. Missing environment variables in Deno Deploy");
console.log("2. Database connection string format issues");
console.log("3. Import path resolution in Deno Deploy");
console.log("4. Sentry initialization errors");
console.log("5. Redis connection issues");

console.log("\n🔧 NEXT STEPS:");
console.log("1. Check Deno Deploy environment variables");
console.log("2. Verify DATABASE_URL format");
console.log("3. Check import paths for serverless compatibility");
console.log("4. Review Sentry DSN configuration");
