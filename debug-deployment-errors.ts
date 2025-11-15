/**
 * Debug Deno Deploy startup errors by creating a minimal test deployment
 */

// Import the same telemetry system to see if there are initialization issues
import { telemetry } from "./src/utils/telemetry.ts";

console.log("🔧 Testing telemetry initialization...");
try {
  telemetry.initialize();
  console.log("✅ Telemetry initialized successfully");
} catch (error) {
  console.error("❌ Telemetry initialization failed:", error);
}

// Test environment validation
console.log("\n🔍 Testing environment validation...");
try {
  const { validateEnvironment } = await import("./src/utils/env-validation.ts");
  const envConfig = validateEnvironment();
  console.log("✅ Environment validation passed");
  console.log("📊 Environment config:", {
    hasJWT: !!envConfig.JWT_SECRET,
    hasDatabase: !!envConfig.DATABASE_URL,
    environment: envConfig.DENO_ENV
  });
} catch (error) {
  console.error("❌ Environment validation failed:", error);
  telemetry.logger.error("Environment validation error", error);
}

// Test database client initialization
console.log("\n🗄️ Testing database client...");
try {
  const { db } = await import("./src/db/client.ts");
  console.log("✅ Database client imported successfully");
  // Try a simple query test
  try {
    // Don't actually run the query, just test if we can construct it
    console.log("📊 Database client appears functional");
  } catch (queryError) {
    console.error("❌ Database query test failed:", queryError);
  }
} catch (error) {
  console.error("❌ Database client import failed:", error);
  telemetry.logger.error("Database client error", error);
}

// Test basic imports that might be failing
console.log("\n📦 Testing critical imports...");
const imports = [
  "./src/utils/response.ts",
  "./src/utils/filter-validation.ts",
  "./src/db/schema.ts"
];

for (const importPath of imports) {
  try {
    await import(importPath);
    console.log(`✅ ${importPath} imported successfully`);
  } catch (error) {
    console.error(`❌ ${importPath} import failed:`, error);
    telemetry.logger.error(`Import error for ${importPath}`, error);
  }
}

// Test if the issue is with the working-server.ts file size or complexity
console.log("\n📄 Testing working-server.ts structure...");
try {
  const serverText = await Deno.readTextFile("./working-server.ts");
  console.log(`📊 Server file size: ${Math.round(serverText.length / 1024)}KB`);
  
  // Check for potential issues
  const lineCount = serverText.split('\n').length;
  const importCount = (serverText.match(/^import /gm) || []).length;
  console.log(`📊 Lines: ${lineCount}, Imports: ${importCount}`);
  
  if (serverText.length > 1024 * 1024) { // 1MB
    console.warn("⚠️  Large file size might cause issues in Deno Deploy");
  }
} catch (error) {
  console.error("❌ Failed to read server file:", error);
}

console.log("\n🎯 Error capture complete - check Sentry dashboard for details");