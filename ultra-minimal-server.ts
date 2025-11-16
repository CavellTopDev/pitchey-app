// Ultra minimal server - no imports at all
console.log("Ultra minimal server starting...");

Deno.serve({ port: 8000 }, (req) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  return new Response(JSON.stringify({
    status: "running",
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: Deno.env.get("DATABASE_URL") ? "set" : "missing",
      JWT_SECRET: Deno.env.get("JWT_SECRET") ? "set" : "missing",
      DENO_ENV: Deno.env.get("DENO_ENV") || "not set",
      NODE_ENV: Deno.env.get("NODE_ENV") || "not set"
    },
    message: "If you see this, Deno Deploy is working!"
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
});