// Minimal server to debug Deno Deploy issues
console.log("Starting minimal debug server...");

// Test environment variables
console.log("Environment check:");
console.log("- DATABASE_URL:", Deno.env.get("DATABASE_URL") ? "✅ Set" : "❌ Missing");
console.log("- JWT_SECRET:", Deno.env.get("JWT_SECRET") ? "✅ Set" : "❌ Missing");
console.log("- DENO_ENV:", Deno.env.get("DENO_ENV") || "not set");
console.log("- NODE_ENV:", Deno.env.get("NODE_ENV") || "not set");

// Test imports
try {
  console.log("\nTesting imports:");
  
  // Test database client
  const { db } = await import("./src/db/client.ts");
  console.log("✅ Database client imported");
  
  // Test SimpleBrowseService
  const { SimpleBrowseService } = await import("./src/services/simple-browse.service.ts");
  console.log("✅ SimpleBrowseService imported");
  
  // Test Stripe service (this might be the issue)
  try {
    const { stripeService } = await import("./src/services/stripe-service.ts");
    console.log("✅ Stripe service imported");
  } catch (e) {
    console.log("⚠️ Stripe service failed:", e.message);
  }
  
} catch (error) {
  console.error("❌ Import error:", error);
}

// Simple HTTP server
Deno.serve({ port: 8000 }, (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/") {
    return new Response(JSON.stringify({
      status: "ok",
      message: "Debug server running",
      env: {
        DATABASE_URL: Deno.env.get("DATABASE_URL") ? "set" : "missing",
        JWT_SECRET: Deno.env.get("JWT_SECRET") ? "set" : "missing",
        DENO_ENV: Deno.env.get("DENO_ENV") || "not set"
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  if (url.pathname === "/api/test-db") {
    try {
      const { db } = await import("./src/db/client.ts");
      const { pitches } = await import("./src/db/schema.ts");
      const { sql } = await import("npm:drizzle-orm@0.35.3");
      
      const result = await db.select({ count: sql`COUNT(*)` }).from(pitches);
      
      return new Response(JSON.stringify({
        success: true,
        pitchCount: result[0]?.count || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  return new Response("Not found", { status: 404 });
});