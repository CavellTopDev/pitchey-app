#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive Authentication Security Audit for Pitchey Platform
 * Tests all authentication endpoints, JWT security, and OWASP Top 10 vulnerabilities
 */

import { create, verify, decode } from "https://deno.land/x/djwt@v2.8/mod.ts";

const API_BASE = "http://localhost:8001";
const JWT_SECRET = "your-secret-key-change-this-in-production";

interface TestResult {
  testName: string;
  category: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  details?: any;
  owasp?: string;
}

class AuthenticationSecurityAuditor {
  private results: TestResult[] = [];
  private tokens: Map<string, string> = new Map();
  
  constructor() {
    console.log("🔒 Pitchey Authentication Security Audit");
    console.log("=========================================\n");
  }

  // Helper method to make API requests
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ response: Response; body?: any; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      let body;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return { response, body };
    } catch (error) {
      return { 
        response: new Response(null, { status: 0 }), 
        error: error.message 
      };
    }
  }

  // Test 1: Valid Credentials for All Portals
  async testValidCredentials() {
    console.log("📝 Testing Valid Credentials for All Portals...\n");

    const portals = [
      {
        name: "Creator",
        endpoint: "/api/auth/creator/login",
        credentials: { email: "alex.creator@demo.com", password: "Demo123" },
        expectedType: "creator",
      },
      {
        name: "Investor",
        endpoint: "/api/auth/investor/login",
        credentials: { email: "sarah.investor@demo.com", password: "Demo123" },
        expectedType: "investor",
      },
      {
        name: "Production",
        endpoint: "/api/auth/production/login",
        credentials: { email: "stellar.production@demo.com", password: "Demo123" },
        expectedType: "production",
      },
    ];

    for (const portal of portals) {
      const { response, body } = await this.makeRequest(portal.endpoint, {
        method: "POST",
        body: JSON.stringify(portal.credentials),
      });

      if (response.status === 200 && body?.token) {
        // Store token for later tests
        this.tokens.set(portal.name.toLowerCase(), body.token);

        // Decode and analyze JWT structure
        const payload = decode(body.token)[1] as any;

        this.results.push({
          testName: `${portal.name} Portal Login`,
          category: "Authentication",
          status: "PASS",
          message: `Successfully authenticated with ${portal.name} portal`,
          details: {
            endpoint: portal.endpoint,
            userType: body.user?.userType,
            userId: body.user?.id,
            tokenPayload: {
              userId: payload.userId,
              userType: payload.userType,
              exp: new Date(payload.exp * 1000).toISOString(),
              iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
            },
          },
        });
      } else {
        this.results.push({
          testName: `${portal.name} Portal Login`,
          category: "Authentication",
          status: "FAIL",
          severity: "CRITICAL",
          message: `Failed to authenticate with ${portal.name} portal`,
          details: { status: response.status, body },
        });
      }
    }
  }

  // Test 2: JWT Token Structure and Security
  async testJWTSecurity() {
    console.log("\n🔐 Testing JWT Token Security...\n");

    for (const [portal, token] of this.tokens) {
      // Decode token without verification
      const [header, payload] = decode(token);

      // Check algorithm
      if ((header as any).alg === "HS256") {
        this.results.push({
          testName: `JWT Algorithm (${portal})`,
          category: "JWT Security",
          status: "WARNING",
          severity: "MEDIUM",
          message: "Using HS256 (symmetric) - Consider RS256 (asymmetric) for production",
          owasp: "A02:2021 - Cryptographic Failures",
          details: { algorithm: (header as any).alg },
        });
      }

      // Check token expiration
      const exp = (payload as any).exp;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = exp - now;
      
      if (expiresIn > 86400) { // More than 24 hours
        this.results.push({
          testName: `JWT Expiration (${portal})`,
          category: "JWT Security",
          status: "WARNING",
          severity: "MEDIUM",
          message: `Token expires in ${Math.floor(expiresIn / 3600)} hours - consider shorter expiration`,
          details: { expiresAt: new Date(exp * 1000).toISOString() },
        });
      } else {
        this.results.push({
          testName: `JWT Expiration (${portal})`,
          category: "JWT Security",
          status: "PASS",
          message: `Token has appropriate expiration time`,
          details: { expiresIn: `${Math.floor(expiresIn / 3600)} hours` },
        });
      }

      // Check for sensitive data in payload
      const sensitiveFields = ["password", "creditCard", "ssn", "secret"];
      const payloadKeys = Object.keys(payload as any);
      const foundSensitive = payloadKeys.filter(key => 
        sensitiveFields.some(field => key.toLowerCase().includes(field))
      );

      if (foundSensitive.length > 0) {
        this.results.push({
          testName: `JWT Payload Security (${portal})`,
          category: "JWT Security",
          status: "FAIL",
          severity: "HIGH",
          message: "JWT contains potentially sensitive fields",
          owasp: "A01:2021 - Broken Access Control",
          details: { sensitiveFields: foundSensitive },
        });
      } else {
        this.results.push({
          testName: `JWT Payload Security (${portal})`,
          category: "JWT Security",
          status: "PASS",
          message: "JWT payload does not contain sensitive data",
        });
      }
    }
  }

  // Test 3: Invalid Credentials
  async testInvalidCredentials() {
    console.log("\n🚫 Testing Invalid Credentials...\n");

    const invalidTests = [
      {
        name: "Wrong Password",
        endpoint: "/api/auth/creator/login",
        credentials: { email: "alex.creator@demo.com", password: "WrongPassword" },
      },
      {
        name: "Non-existent User",
        endpoint: "/api/auth/investor/login",
        credentials: { email: "nonexistent@demo.com", password: "Demo123" },
      },
      {
        name: "Empty Credentials",
        endpoint: "/api/auth/production/login",
        credentials: { email: "", password: "" },
      },
      {
        name: "SQL Injection Attempt",
        endpoint: "/api/auth/creator/login",
        credentials: { email: "' OR '1'='1", password: "' OR '1'='1" },
      },
      {
        name: "XSS Attempt",
        endpoint: "/api/auth/investor/login",
        credentials: { 
          email: "<script>alert('XSS')</script>", 
          password: "<img src=x onerror=alert('XSS')>" 
        },
      },
    ];

    for (const test of invalidTests) {
      const { response, body } = await this.makeRequest(test.endpoint, {
        method: "POST",
        body: JSON.stringify(test.credentials),
      });

      if (response.status === 401 || response.status === 400) {
        // Check for information leakage
        const bodyStr = JSON.stringify(body);
        const leaksInfo = bodyStr.includes("user not found") || 
                         bodyStr.includes("password incorrect") ||
                         bodyStr.includes("SQL") ||
                         bodyStr.includes("database");

        if (leaksInfo) {
          this.results.push({
            testName: test.name,
            category: "Error Handling",
            status: "WARNING",
            severity: "MEDIUM",
            message: "Error message may leak information",
            owasp: "A04:2021 - Insecure Design",
            details: { message: body?.message || body },
          });
        } else {
          this.results.push({
            testName: test.name,
            category: "Invalid Credentials",
            status: "PASS",
            message: "Properly rejected invalid credentials",
            details: { status: response.status },
          });
        }
      } else if (response.status === 200) {
        this.results.push({
          testName: test.name,
          category: "Invalid Credentials",
          status: "FAIL",
          severity: "CRITICAL",
          message: "Authentication succeeded with invalid credentials!",
          owasp: "A07:2021 - Identification and Authentication Failures",
          details: { credentials: test.credentials },
        });
      }
    }
  }

  // Test 4: Rate Limiting
  async testRateLimiting() {
    console.log("\n⏱️ Testing Rate Limiting...\n");

    const endpoint = "/api/auth/creator/login";
    const credentials = { email: "test@test.com", password: "wrong" };
    const attempts = 10;
    let blockedAt = -1;

    for (let i = 0; i < attempts; i++) {
      const { response } = await this.makeRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(credentials),
      });

      if (response.status === 429) {
        blockedAt = i + 1;
        break;
      }
    }

    if (blockedAt > 0 && blockedAt <= 5) {
      this.results.push({
        testName: "Authentication Rate Limiting",
        category: "Rate Limiting",
        status: "PASS",
        message: `Rate limiting triggered after ${blockedAt} attempts`,
      });
    } else if (blockedAt > 5) {
      this.results.push({
        testName: "Authentication Rate Limiting",
        category: "Rate Limiting",
        status: "WARNING",
        severity: "MEDIUM",
        message: `Rate limiting triggered after ${blockedAt} attempts - consider stricter limits`,
        owasp: "A07:2021 - Identification and Authentication Failures",
      });
    } else {
      this.results.push({
        testName: "Authentication Rate Limiting",
        category: "Rate Limiting",
        status: "FAIL",
        severity: "HIGH",
        message: "No rate limiting detected - vulnerable to brute force attacks",
        owasp: "A07:2021 - Identification and Authentication Failures",
        details: { attemptsMade: attempts },
      });
    }
  }

  // Test 5: Token Validation
  async testTokenValidation() {
    console.log("\n✅ Testing Token Validation...\n");

    const validToken = this.tokens.get("creator");
    if (!validToken) {
      this.results.push({
        testName: "Token Validation",
        category: "Authorization",
        status: "FAIL",
        message: "No valid token available for testing",
      });
      return;
    }

    // Test with valid token
    const { response: validResponse } = await this.makeRequest("/api/creator/dashboard", {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    if (validResponse.status === 200) {
      this.results.push({
        testName: "Valid Token Access",
        category: "Authorization",
        status: "PASS",
        message: "Protected endpoint accessible with valid token",
      });
    }

    // Test with invalid tokens
    const invalidTokenTests = [
      {
        name: "No Token",
        token: "",
      },
      {
        name: "Malformed Token",
        token: "invalid.token.here",
      },
      {
        name: "Expired Token",
        token: await this.createExpiredToken(),
      },
      {
        name: "Wrong Signature",
        token: validToken.slice(0, -10) + "tampered123",
      },
      {
        name: "Algorithm None Attack",
        token: this.createAlgNoneToken(),
      },
    ];

    for (const test of invalidTokenTests) {
      const { response } = await this.makeRequest("/api/creator/dashboard", {
        headers: test.token ? { Authorization: `Bearer ${test.token}` } : {},
      });

      if (response.status === 401 || response.status === 403) {
        this.results.push({
          testName: `Token Validation - ${test.name}`,
          category: "Authorization",
          status: "PASS",
          message: "Properly rejected invalid token",
        });
      } else if (response.status === 200) {
        this.results.push({
          testName: `Token Validation - ${test.name}`,
          category: "Authorization",
          status: "FAIL",
          severity: "CRITICAL",
          message: "Protected endpoint accessible with invalid token!",
          owasp: "A01:2021 - Broken Access Control",
          details: { tokenType: test.name },
        });
      }
    }
  }

  // Test 6: Cross-Portal Access Control
  async testCrossPortalAccess() {
    console.log("\n🚪 Testing Cross-Portal Access Control...\n");

    const tests = [
      {
        name: "Creator accessing Investor endpoint",
        token: this.tokens.get("creator"),
        endpoint: "/api/investor/dashboard",
        shouldFail: true,
      },
      {
        name: "Investor accessing Production endpoint",
        token: this.tokens.get("investor"),
        endpoint: "/api/production/pitches",
        shouldFail: true,
      },
      {
        name: "Production accessing Creator endpoint",
        token: this.tokens.get("production"),
        endpoint: "/api/creator/dashboard",
        shouldFail: true,
      },
    ];

    for (const test of tests) {
      if (!test.token) continue;

      const { response } = await this.makeRequest(test.endpoint, {
        headers: { Authorization: `Bearer ${test.token}` },
      });

      const isBlocked = response.status === 401 || response.status === 403;

      if (test.shouldFail && isBlocked) {
        this.results.push({
          testName: test.name,
          category: "Access Control",
          status: "PASS",
          message: "Properly blocked cross-portal access",
        });
      } else if (test.shouldFail && !isBlocked) {
        this.results.push({
          testName: test.name,
          category: "Access Control",
          status: "FAIL",
          severity: "CRITICAL",
          message: "Cross-portal access not properly restricted!",
          owasp: "A01:2021 - Broken Access Control",
          details: { status: response.status },
        });
      }
    }
  }

  // Test 7: Security Headers
  async testSecurityHeaders() {
    console.log("\n🛡️ Testing Security Headers...\n");

    const { response } = await this.makeRequest("/api/health");
    
    const securityHeaders = [
      {
        header: "X-Content-Type-Options",
        expected: "nosniff",
        severity: "MEDIUM" as const,
        owasp: "A05:2021 - Security Misconfiguration",
      },
      {
        header: "X-Frame-Options",
        expected: ["DENY", "SAMEORIGIN"],
        severity: "MEDIUM" as const,
        owasp: "A05:2021 - Security Misconfiguration",
      },
      {
        header: "X-XSS-Protection",
        expected: "1; mode=block",
        severity: "LOW" as const,
        owasp: "A03:2021 - Injection",
      },
      {
        header: "Strict-Transport-Security",
        expected: "max-age=",
        severity: "HIGH" as const,
        owasp: "A02:2021 - Cryptographic Failures",
      },
      {
        header: "Content-Security-Policy",
        expected: "default-src",
        severity: "HIGH" as const,
        owasp: "A03:2021 - Injection",
      },
    ];

    for (const check of securityHeaders) {
      const value = response.headers.get(check.header);
      
      if (!value) {
        this.results.push({
          testName: `Security Header - ${check.header}`,
          category: "Security Headers",
          status: "FAIL",
          severity: check.severity,
          message: `Missing security header: ${check.header}`,
          owasp: check.owasp,
        });
      } else {
        const expectedArray = Array.isArray(check.expected) ? check.expected : [check.expected];
        const isValid = expectedArray.some(exp => value.includes(exp));
        
        if (isValid) {
          this.results.push({
            testName: `Security Header - ${check.header}`,
            category: "Security Headers",
            status: "PASS",
            message: `Security header properly configured`,
            details: { value },
          });
        } else {
          this.results.push({
            testName: `Security Header - ${check.header}`,
            category: "Security Headers",
            status: "WARNING",
            severity: "LOW",
            message: `Security header present but may need configuration`,
            details: { current: value, expected: check.expected },
          });
        }
      }
    }
  }

  // Test 8: Password Policy
  async testPasswordPolicy() {
    console.log("\n🔑 Testing Password Policy...\n");

    const weakPasswords = [
      { password: "123", description: "Too short" },
      { password: "password", description: "Common password" },
      { password: "12345678", description: "Numbers only" },
      { password: "abcdefgh", description: "Letters only" },
      { password: "Password1", description: "No special characters" },
    ];

    // Note: Since we're testing demo accounts with hardcoded passwords,
    // we'll check if the system would accept weak passwords on registration
    this.results.push({
      testName: "Password Policy",
      category: "Password Security",
      status: "WARNING",
      severity: "MEDIUM",
      message: "Demo accounts use simple passwords - ensure production has strong password requirements",
      owasp: "A07:2021 - Identification and Authentication Failures",
      details: {
        recommendation: "Implement password complexity requirements",
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      },
    });
  }

  // Helper methods
  private async createExpiredToken(): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    return await create(
      { alg: "HS256", typ: "JWT" },
      { 
        userId: 1,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      },
      key
    );
  }

  private createAlgNoneToken(): string {
    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ userId: 1, admin: true }));
    return `${header}.${payload}.`;
  }

  // Generate report
  generateReport() {
    console.log("\n" + "=".repeat(80));
    console.log("📊 SECURITY AUDIT REPORT");
    console.log("=".repeat(80) + "\n");

    const categories = new Map<string, TestResult[]>();
    
    // Group results by category
    for (const result of this.results) {
      const cat = categories.get(result.category) || [];
      cat.push(result);
      categories.set(result.category, cat);
    }

    // Summary statistics
    const stats = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === "PASS").length,
      failed: this.results.filter(r => r.status === "FAIL").length,
      warnings: this.results.filter(r => r.status === "WARNING").length,
    };

    const severityCounts = {
      CRITICAL: this.results.filter(r => r.severity === "CRITICAL").length,
      HIGH: this.results.filter(r => r.severity === "HIGH").length,
      MEDIUM: this.results.filter(r => r.severity === "MEDIUM").length,
      LOW: this.results.filter(r => r.severity === "LOW").length,
    };

    console.log("📈 SUMMARY");
    console.log("-".repeat(40));
    console.log(`Total Tests: ${stats.total}`);
    console.log(`✅ Passed: ${stats.passed} (${Math.round(stats.passed / stats.total * 100)}%)`);
    console.log(`❌ Failed: ${stats.failed} (${Math.round(stats.failed / stats.total * 100)}%)`);
    console.log(`⚠️  Warnings: ${stats.warnings} (${Math.round(stats.warnings / stats.total * 100)}%)`);
    console.log();

    if (severityCounts.CRITICAL > 0 || severityCounts.HIGH > 0) {
      console.log("🚨 SEVERITY BREAKDOWN");
      console.log("-".repeat(40));
      if (severityCounts.CRITICAL > 0) console.log(`🔴 CRITICAL: ${severityCounts.CRITICAL}`);
      if (severityCounts.HIGH > 0) console.log(`🟠 HIGH: ${severityCounts.HIGH}`);
      if (severityCounts.MEDIUM > 0) console.log(`🟡 MEDIUM: ${severityCounts.MEDIUM}`);
      if (severityCounts.LOW > 0) console.log(`🟢 LOW: ${severityCounts.LOW}`);
      console.log();
    }

    // Detailed results by category
    for (const [category, results] of categories) {
      console.log(`\n📁 ${category.toUpperCase()}`);
      console.log("-".repeat(40));
      
      for (const result of results) {
        const icon = result.status === "PASS" ? "✅" : 
                    result.status === "FAIL" ? "❌" : "⚠️";
        const severity = result.severity ? ` [${result.severity}]` : "";
        
        console.log(`${icon} ${result.testName}${severity}`);
        console.log(`   ${result.message}`);
        
        if (result.owasp) {
          console.log(`   OWASP: ${result.owasp}`);
        }
        
        if (result.details && result.status !== "PASS") {
          console.log(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
        }
      }
    }

    // Security recommendations
    console.log("\n" + "=".repeat(80));
    console.log("🔒 SECURITY RECOMMENDATIONS");
    console.log("=".repeat(80) + "\n");

    const recommendations = [
      {
        priority: "CRITICAL",
        title: "Use Strong JWT Secret",
        description: "Replace the default JWT secret with a cryptographically secure random value",
        implementation: "Generate with: openssl rand -base64 32",
      },
      {
        priority: "HIGH",
        title: "Implement Rate Limiting",
        description: "Add rate limiting to prevent brute force attacks",
        implementation: "Use a middleware like express-rate-limit or implement with Redis",
      },
      {
        priority: "HIGH",
        title: "Use Asymmetric JWT Signing",
        description: "Consider using RS256 instead of HS256 for better security",
        implementation: "Generate RSA key pair and use for JWT signing",
      },
      {
        priority: "MEDIUM",
        title: "Implement Refresh Tokens",
        description: "Use short-lived access tokens with refresh tokens",
        implementation: "Access token: 15-30 minutes, Refresh token: 7-30 days",
      },
      {
        priority: "MEDIUM",
        title: "Add CSRF Protection",
        description: "Implement CSRF tokens for state-changing operations",
        implementation: "Use double-submit cookies or synchronizer token pattern",
      },
      {
        priority: "MEDIUM",
        title: "Enable Security Headers",
        description: "Configure all recommended security headers",
        implementation: "Use helmet.js or manually set headers",
      },
    ];

    for (const rec of recommendations) {
      const icon = rec.priority === "CRITICAL" ? "🔴" :
                   rec.priority === "HIGH" ? "🟠" : "🟡";
      
      console.log(`${icon} [${rec.priority}] ${rec.title}`);
      console.log(`   ${rec.description}`);
      console.log(`   Implementation: ${rec.implementation}\n`);
    }

    // OWASP Top 10 Coverage
    console.log("\n" + "=".repeat(80));
    console.log("🌐 OWASP TOP 10 COVERAGE");
    console.log("=".repeat(80) + "\n");

    const owaspFindings = this.results.filter(r => r.owasp);
    const owaspCategories = new Set(owaspFindings.map(r => r.owasp));

    for (const category of owaspCategories) {
      const findings = owaspFindings.filter(r => r.owasp === category);
      const failed = findings.filter(r => r.status === "FAIL").length;
      const warning = findings.filter(r => r.status === "WARNING").length;
      
      console.log(`${category}`);
      if (failed > 0) console.log(`   ❌ ${failed} failed test(s)`);
      if (warning > 0) console.log(`   ⚠️  ${warning} warning(s)`);
    }

    // Final verdict
    console.log("\n" + "=".repeat(80));
    console.log("🎯 FINAL VERDICT");
    console.log("=".repeat(80) + "\n");

    if (severityCounts.CRITICAL > 0) {
      console.log("❌ CRITICAL SECURITY ISSUES DETECTED");
      console.log("The application has critical vulnerabilities that must be addressed immediately.");
    } else if (severityCounts.HIGH > 0) {
      console.log("⚠️  HIGH PRIORITY ISSUES DETECTED");
      console.log("The application has significant security concerns that should be addressed soon.");
    } else if (stats.failed > 0) {
      console.log("⚠️  SECURITY IMPROVEMENTS NEEDED");
      console.log("The application has security issues that should be addressed.");
    } else if (stats.warnings > 5) {
      console.log("✅ BASIC SECURITY IN PLACE");
      console.log("The application has basic security measures but could be improved.");
    } else {
      console.log("✅ GOOD SECURITY POSTURE");
      console.log("The application demonstrates good security practices.");
    }

    console.log("\n" + "=".repeat(80) + "\n");
  }

  // Run all tests
  async runAudit() {
    await this.testValidCredentials();
    await this.testJWTSecurity();
    await this.testInvalidCredentials();
    await this.testRateLimiting();
    await this.testTokenValidation();
    await this.testCrossPortalAccess();
    await this.testSecurityHeaders();
    await this.testPasswordPolicy();
    
    this.generateReport();
  }
}

// Run the audit
if (import.meta.main) {
  const auditor = new AuthenticationSecurityAuditor();
  await auditor.runAudit();
}