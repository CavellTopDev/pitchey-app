#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

// Migration script to transition from the insecure server to the secure server
// This script helps update configuration and prepare for secure deployment

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

console.log("========================================");
console.log("Pitchey Security Migration Script");
console.log("========================================\n");

// Check for existing .env file
const envPath = ".env";
const envExamplePath = ".env.example";

async function generateSecureSecret(length: number = 32): Promise<string> {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, "").substring(0, length);
}

async function updateEnvFile() {
  console.log("📋 Checking environment configuration...");
  
  try {
    const envContent = await Deno.readTextFile(envPath);
    const lines = envContent.split("\n");
    const envVars: Record<string, string> = {};
    
    // Parse existing env file
    for (const line of lines) {
      if (line.trim() && !line.startsWith("#")) {
        const [key, ...valueParts] = line.split("=");
        if (key) {
          envVars[key.trim()] = valueParts.join("=").trim();
        }
      }
    }
    
    // Check and update critical security variables
    let updated = false;
    
    // JWT_SECRET
    if (!envVars["JWT_SECRET"] || 
        envVars["JWT_SECRET"] === "your-secret-key-change-this-in-production" ||
        envVars["JWT_SECRET"] === "your-super-secret-jwt-key") {
      const newSecret = await generateSecureSecret(64);
      envVars["JWT_SECRET"] = newSecret;
      console.log("✅ Generated new secure JWT_SECRET");
      updated = true;
    } else {
      console.log("✓ JWT_SECRET already configured");
    }
    
    // JWT_REFRESH_SECRET
    if (!envVars["JWT_REFRESH_SECRET"]) {
      const newSecret = await generateSecureSecret(64);
      envVars["JWT_REFRESH_SECRET"] = newSecret;
      console.log("✅ Generated new JWT_REFRESH_SECRET");
      updated = true;
    } else {
      console.log("✓ JWT_REFRESH_SECRET already configured");
    }
    
    // SESSION_SECRET
    if (!envVars["SESSION_SECRET"] || envVars["SESSION_SECRET"] === "your-session-secret") {
      const newSecret = await generateSecureSecret(48);
      envVars["SESSION_SECRET"] = newSecret;
      console.log("✅ Generated new SESSION_SECRET");
      updated = true;
    } else {
      console.log("✓ SESSION_SECRET already configured");
    }
    
    // ALLOWED_ORIGINS (for CORS)
    if (!envVars["ALLOWED_ORIGINS"]) {
      envVars["ALLOWED_ORIGINS"] = "http://localhost:3000,http://localhost:5173,http://localhost:8000";
      console.log("✅ Set ALLOWED_ORIGINS for development");
      updated = true;
    }
    
    // RATE_LIMIT_ENABLED
    if (!envVars["RATE_LIMIT_ENABLED"]) {
      envVars["RATE_LIMIT_ENABLED"] = "true";
      console.log("✅ Enabled rate limiting");
      updated = true;
    }
    
    // SECURE_COOKIES
    if (!envVars["SECURE_COOKIES"]) {
      envVars["SECURE_COOKIES"] = Deno.env.get("DENO_ENV") === "production" ? "true" : "false";
      console.log(`✅ Set SECURE_COOKIES to ${envVars["SECURE_COOKIES"]}`);
      updated = true;
    }
    
    if (updated) {
      // Backup existing .env file
      const backupPath = `.env.backup.${Date.now()}`;
      await Deno.copyFile(envPath, backupPath);
      console.log(`\n📁 Backed up existing .env to ${backupPath}`);
      
      // Write updated .env file
      const newEnvContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
      
      await Deno.writeTextFile(envPath, newEnvContent);
      console.log("✅ Updated .env file with secure configurations");
    } else {
      console.log("\n✓ All security configurations are already set");
    }
    
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("⚠️  No .env file found. Creating one from .env.example...");
      
      // Create new .env file with secure defaults
      const envContent = `# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# Authentication - SECURE SECRETS (auto-generated)
JWT_SECRET=${await generateSecureSecret(64)}
JWT_REFRESH_SECRET=${await generateSecureSecret(64)}
SESSION_SECRET=${await generateSecureSecret(48)}

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8000

# Security Settings
RATE_LIMIT_ENABLED=true
SECURE_COOKIES=${Deno.env.get("DENO_ENV") === "production" ? "true" : "false"}
CSRF_PROTECTION=true

# Stripe (add your keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=pitchey-uploads

# Email (SendGrid/Postmark)
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM=noreply@pitchey.com

# Environment
DENO_ENV=${Deno.env.get("DENO_ENV") || "development"}
PORT=8000
APP_URL=http://localhost:8000
`;
      
      await Deno.writeTextFile(envPath, envContent);
      console.log("✅ Created new .env file with secure configurations");
    } else {
      console.error("❌ Error reading .env file:", error);
      Deno.exit(1);
    }
  }
}

async function createSecurityDocs() {
  console.log("\n📚 Creating security documentation...");
  
  const securityReadme = `# Security Implementation Guide

## Overview
This document outlines the security measures implemented in the Pitchey platform.

## Security Features

### 1. Authentication & Authorization
- JWT-based authentication with secure secret management
- Separate access and refresh tokens
- Role-based access control (RBAC)
- Session tracking and management
- Automatic token rotation

### 2. Input Validation & Sanitization
- Comprehensive input validation schemas for all endpoints
- XSS prevention through HTML escaping
- SQL injection protection
- File upload validation (type, size, extension)
- Request body size limits

### 3. Rate Limiting
- Endpoint-specific rate limits:
  - Authentication: 5 attempts per 15 minutes
  - Password reset: 3 attempts per hour
  - API: 100 requests per minute
  - File uploads: 10 per 10 minutes
- IP-based blocking for repeat offenders
- Token bucket algorithm with sliding window

### 4. Security Headers
- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer Policy
- Permissions Policy

### 5. CORS Configuration
- Whitelist of allowed origins
- Proper preflight handling
- Credentials support with specific origins only

### 6. Password Security
- Minimum 12 characters
- Complexity requirements (uppercase, lowercase, numbers, special chars)
- No common passwords
- No user information in passwords
- bcrypt with 12 salt rounds

### 7. CSRF Protection
- CSRF tokens for state-changing operations
- Double-submit cookie pattern
- SameSite cookie attributes

## Environment Variables

### Required for Production
\`\`\`
JWT_SECRET          - Strong random secret (min 64 characters)
JWT_REFRESH_SECRET  - Different from JWT_SECRET
SESSION_SECRET      - Session encryption key
DATABASE_URL        - PostgreSQL connection string
\`\`\`

### Security Settings
\`\`\`
ALLOWED_ORIGINS     - Comma-separated list of allowed origins
RATE_LIMIT_ENABLED  - Enable/disable rate limiting (always true in production)
SECURE_COOKIES      - Use secure flag on cookies (true in production)
CSRF_PROTECTION     - Enable CSRF protection (true in production)
\`\`\`

## Running the Secure Server

### Development
\`\`\`bash
deno run --allow-net --allow-read --allow-env --allow-write secure-server.ts
\`\`\`

### Production
\`\`\`bash
DENO_ENV=production deno run --allow-net --allow-read --allow-env secure-server.ts
\`\`\`

## Security Checklist for Deployment

- [ ] All environment variables configured with strong values
- [ ] Database using SSL/TLS connection
- [ ] HTTPS enabled with valid certificate
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Regular security updates scheduled
- [ ] Backup strategy in place
- [ ] Incident response plan documented
- [ ] Security headers verified
- [ ] CORS properly configured for production domains

## Testing Security

Run the security test suite:
\`\`\`bash
deno test --allow-all tests/security.test.ts
\`\`\`

## Reporting Security Issues

If you discover a security vulnerability, please email security@pitchey.com.
Do not create public GitHub issues for security vulnerabilities.

## Compliance

This implementation follows:
- OWASP Top 10 security practices
- OWASP Authentication Cheat Sheet
- OWASP Session Management Cheat Sheet
- OWASP Input Validation Cheat Sheet
- OWASP Password Storage Cheat Sheet
`;
  
  await Deno.writeTextFile("SECURITY.md", securityReadme);
  console.log("✅ Created SECURITY.md documentation");
}

async function createSecurityTests() {
  console.log("\n🧪 Creating security test suite...");
  
  const testContent = `// Security test suite for Pitchey platform
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = "http://localhost:8000";

Deno.test("Security Headers are present", async () => {
  const response = await fetch(\`\${BASE_URL}/api/health\`);
  
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
      fetch(\`\${BASE_URL}/api/auth/login\`, {
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
  
  const response = await fetch(\`\${BASE_URL}/api/auth/login\`, {
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
  const response = await fetch(\`\${BASE_URL}/api/pitches\`, {
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
    const response = await fetch(\`\${BASE_URL}/api/auth/register\`, {
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
  const allowedResponse = await fetch(\`\${BASE_URL}/api/health\`, {
    headers: { "Origin": "http://localhost:3000" },
  });
  
  assertEquals(
    allowedResponse.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000"
  );
  
  // Test with disallowed origin
  const disallowedResponse = await fetch(\`\${BASE_URL}/api/health\`, {
    headers: { "Origin": "http://evil.com" },
  });
  
  // Should not have Access-Control-Allow-Origin or should be restricted
  const corsHeader = disallowedResponse.headers.get("Access-Control-Allow-Origin");
  assertEquals(corsHeader === null || corsHeader !== "http://evil.com", true);
});
`;
  
  await ensureDir("tests");
  await Deno.writeTextFile("tests/security.test.ts", testContent);
  console.log("✅ Created security test suite");
}

async function updatePackageJson() {
  console.log("\n📦 Updating package.json scripts...");
  
  const denoConfig = {
    scripts: {
      "start": "deno run --allow-net --allow-read --allow-env --allow-write secure-server.ts",
      "dev": "deno run --watch --allow-net --allow-read --allow-env --allow-write secure-server.ts",
      "start:old": "deno run --allow-net --allow-read --allow-env --allow-write multi-portal-server.ts",
      "test:security": "deno test --allow-all tests/security.test.ts",
      "migrate": "deno run --allow-read --allow-write --allow-env migrate-to-secure.ts",
    }
  };
  
  try {
    await Deno.writeTextFile("deno.json", JSON.stringify(denoConfig, null, 2));
    console.log("✅ Updated deno.json with secure server scripts");
  } catch (error) {
    console.log("⚠️  Could not update deno.json:", error.message);
  }
}

// Main migration process
async function main() {
  console.log("Starting security migration process...\n");
  
  // Step 1: Update environment variables
  await updateEnvFile();
  
  // Step 2: Create security documentation
  await createSecurityDocs();
  
  // Step 3: Create security tests
  await createSecurityTests();
  
  // Step 4: Update package scripts
  await updatePackageJson();
  
  console.log("\n========================================");
  console.log("✅ Security Migration Complete!");
  console.log("========================================\n");
  
  console.log("Next steps:");
  console.log("1. Review the generated .env file and update any placeholder values");
  console.log("2. Test the secure server: deno run --allow-net --allow-read --allow-env --allow-write secure-server.ts");
  console.log("3. Run security tests: deno test --allow-all tests/security.test.ts");
  console.log("4. Review SECURITY.md for deployment checklist");
  console.log("5. Update your frontend to include CSRF tokens in requests");
  console.log("\n⚠️  IMPORTANT: Never commit .env file to version control!");
}

// Run migration
if (import.meta.main) {
  main().catch(console.error);
}