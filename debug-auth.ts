#!/usr/bin/env deno run --allow-all

import { db } from "./src/db/client.ts";
import { sessions } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "test-secret-key-for-development";
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInNlc3Npb25JZCI6ImQ3N2ZlNDBmLTk3MTUtNGJlNy05YTE4LWM5NTI5NmE1ZjczNiIsImV4cCI6MTc1OTI0NDU1MzA2M30.oAtTK9WPGmFiiHltSo4ALNeav7Yv6nXPaiBd1bCUKdc";

console.log("🔍 Testing JWT verification and database query...");

try {
  // Step 1: Verify JWT
  console.log("\n1. Verifying JWT token...");
  const payload = await verify(token, key);
  console.log("✅ JWT payload:", payload);

  // Step 2: Query database
  console.log("\n2. Querying database for session...");
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.token, token),
  });
  
  console.log("📊 Database result:", session);
  
  if (!session) {
    console.log("❌ No session found in database");
  } else if (session.expiresAt < new Date()) {
    console.log("❌ Session has expired");
    console.log("Session expires at:", session.expiresAt);
    console.log("Current time:", new Date());
  } else {
    console.log("✅ Session is valid!");
    console.log("Session data:", {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      user: session.user?.email
    });
  }

} catch (error) {
  console.error("❌ Error:", error);
}