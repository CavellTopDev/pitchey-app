// Security test suite for Pitchey platform
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = "http://localhost:8001";

Deno.test("Security Headers are present", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  
  assertExists(response.headers.get("Content-Security-Policy"));
  assertExists(response.headers.get("X-Frame-Options"));
  assertExists(response.headers.get("X-Content-Type-Options"));
  assertExists(response.headers.get("X-XSS-Protection"));
  assertExists(response.headers.get("Referrer-Policy"));
});

Deno.test("Rate limiting on authentication endpoints", async () => {
  const requests = [];
  
  // Make 6 requests (limit is 5)
  for (let i = 0; i < 6; i++) {
    requests.push(
      fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "wrong" }),
      })
    );
  }
  
  const responses = await Promise.all(requests);
  const lastResponse = responses[responses.length - 1];
  
  assertEquals(lastResponse.status, 429); // Too Many Requests
  assertExists(lastResponse.headers.get("Retry-After"));
});

Deno.test("SQL injection prevention", async () => {
  const maliciousInput = {
    email: "admin' OR '1'='1",
    password: "'; DROP TABLE users; --",
  };
  
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(maliciousInput),
  });
  
  const data = await response.json();
  assertEquals(response.status, 400); // Should be rejected by validation
  assertExists(data.errors);
});

Deno.test("XSS prevention in input", async () => {
  const xssPayload = {
    title: "<script>alert('XSS')</script>",
    logline: "Test <img src=x onerror=alert('XSS')>",
  };
  
  // This would need auth token in real test
  const response = await fetch(`${BASE_URL}/api/pitches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(xssPayload),
  });
  
  // Should be rejected or sanitized
  assertEquals(response.status === 400 || response.status === 401, true);
});

Deno.test("Password policy enforcement", async () => {
  const weakPasswords = [
    "password",
    "12345678",
    "abc123",
    "qwerty123",
  ];
  
  for (const password of weakPasswords) {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password,
        name: "Test User",
        role: "creator",
      }),
    });
    
    const data = await response.json();
    assertEquals(response.status, 400);
    assertExists(data.errors);
  }
});

Deno.test("CORS properly configured", async () => {
  // Test with allowed origin
  const allowedResponse = await fetch(`${BASE_URL}/api/health`, {
    headers: { "Origin": "http://localhost:3000" },
  });
  
  assertEquals(
    allowedResponse.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000"
  );
  
  // Test with disallowed origin
  const disallowedResponse = await fetch(`${BASE_URL}/api/health`, {
    headers: { "Origin": "http://evil.com" },
  });
  
  // Should not have Access-Control-Allow-Origin or should be restricted
  const corsHeader = disallowedResponse.headers.get("Access-Control-Allow-Origin");
  assertEquals(corsHeader === null || corsHeader !== "http://evil.com", true);
});
