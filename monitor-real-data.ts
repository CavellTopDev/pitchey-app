#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Real-time monitoring script to ensure mock data doesn't leak into production
 * Continuously monitors API responses and alerts on suspicious patterns
 */

interface MockDataPattern {
  type: "number" | "string" | "pattern";
  value: any;
  description: string;
  severity: "high" | "medium" | "low";
}

const MOCK_PATTERNS: MockDataPattern[] = [
  // High severity - exact mock values
  { type: "number", value: 15000, description: "Hardcoded 15k views", severity: "high" },
  { type: "number", value: 892, description: "Hardcoded 892 followers", severity: "high" },
  { type: "number", value: 1234, description: "Common mock number", severity: "high" },
  { type: "string", value: "mockPitchesData", description: "Mock data array name", severity: "high" },
  
  // Medium severity - suspicious patterns
  { type: "pattern", value: /TODO|FIXME|XXX/, description: "Development markers", severity: "medium" },
  { type: "pattern", value: /test\d+@example\.com/, description: "Test emails", severity: "medium" },
  { type: "pattern", value: /dummy|sample|fake/i, description: "Mock data keywords", severity: "medium" },
  
  // Low severity - unrealistic values
  { type: "number", value: 99999, description: "Suspiciously round number", severity: "low" },
  { type: "pattern", value: /\b(1000|2000|3000|4000|5000)\b/, description: "Round thousands", severity: "low" },
];

class DataMonitor {
  private apiBase: string;
  private token: string | null = null;
  private checkInterval: number = 5000; // 5 seconds
  private issues: Map<string, Set<string>> = new Map();

  constructor(apiBase: string = "http://localhost:8001") {
    this.apiBase = apiBase;
  }

  async authenticate(): Promise<void> {
    console.log("🔐 Authenticating monitor...");
    
    // Use demo creator account
    const demoUser = {
      email: "alice@example.com",
      password: "password123"
    };

    try {
      // Login with demo account
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoUser)
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.session?.token || data.token;
      
      if (this.token) {
        console.log("✅ Authentication successful as Alice (creator)");
      } else {
        throw new Error("No token received");
      }
    } catch (error) {
      console.error("❌ Authentication failed:", error);
      throw error;
    }
  }

  checkValue(value: any, path: string): string[] {
    const issues: string[] = [];

    for (const pattern of MOCK_PATTERNS) {
      let matched = false;

      switch (pattern.type) {
        case "number":
          if (typeof value === "number" && value === pattern.value) {
            matched = true;
          }
          break;
        
        case "string":
          if (typeof value === "string" && value.includes(pattern.value)) {
            matched = true;
          }
          break;
        
        case "pattern":
          if (typeof value === "string" && pattern.value.test(value)) {
            matched = true;
          }
          break;
      }

      if (matched) {
        const issue = `[${pattern.severity.toUpperCase()}] ${pattern.description} at ${path}: ${value}`;
        issues.push(issue);
      }
    }

    return issues;
  }

  scanObject(obj: any, path: string = "root"): string[] {
    const allIssues: string[] = [];

    if (obj === null || obj === undefined) {
      return allIssues;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        allIssues.push(...this.scanObject(item, `${path}[${index}]`));
      });
    } else if (typeof obj === "object") {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = `${path}.${key}`;
        allIssues.push(...this.checkValue(value, newPath));
        
        if (typeof value === "object" && value !== null) {
          allIssues.push(...this.scanObject(value, newPath));
        }
      });
    } else {
      allIssues.push(...this.checkValue(obj, path));
    }

    return allIssues;
  }

  async checkEndpoint(endpoint: string, description: string): Promise<void> {
    const headers: HeadersInit = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, { headers });
      
      if (!response.ok) {
        console.warn(`⚠️  ${description}: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      const issues = this.scanObject(data);

      if (issues.length > 0) {
        console.error(`\n🚨 MOCK DATA DETECTED in ${description}:`);
        
        // Group by severity
        const highSeverity = issues.filter(i => i.startsWith("[HIGH]"));
        const mediumSeverity = issues.filter(i => i.startsWith("[MEDIUM]"));
        const lowSeverity = issues.filter(i => i.startsWith("[LOW]"));

        if (highSeverity.length > 0) {
          console.error("  HIGH SEVERITY:");
          highSeverity.forEach(issue => console.error(`    ${issue}`));
        }
        if (mediumSeverity.length > 0) {
          console.warn("  MEDIUM SEVERITY:");
          mediumSeverity.forEach(issue => console.warn(`    ${issue}`));
        }
        if (lowSeverity.length > 0) {
          console.log("  LOW SEVERITY:");
          lowSeverity.forEach(issue => console.log(`    ${issue}`));
        }

        // Track issues
        if (!this.issues.has(endpoint)) {
          this.issues.set(endpoint, new Set());
        }
        issues.forEach(issue => this.issues.get(endpoint)!.add(issue));
      } else {
        console.log(`✅ ${description}: Clean`);
      }
    } catch (error) {
      console.error(`❌ Failed to check ${description}:`, error);
    }
  }

  async runChecks(): Promise<void> {
    const endpoints = [
      { path: "/api/creator/dashboard", name: "Creator Dashboard" },
      { path: "/api/pitches", name: "Public Pitches" },
      { path: "/api/trending", name: "Trending" },
      { path: "/api/profile", name: "User Profile" },
      { path: "/api/notifications", name: "Notifications" },
      { path: "/api/investor/portfolio", name: "Investor Portfolio" },
      { path: "/api/production/dashboard", name: "Production Dashboard" },
    ];

    console.log(`\n📊 Running checks at ${new Date().toLocaleTimeString()}...`);
    
    for (const endpoint of endpoints) {
      await this.checkEndpoint(endpoint.path, endpoint.name);
    }

    // Summary
    if (this.issues.size > 0) {
      console.log("\n📋 SUMMARY OF ISSUES:");
      this.issues.forEach((issues, endpoint) => {
        console.log(`  ${endpoint}: ${issues.size} unique issues`);
      });
    }
  }

  async start(): Promise<void> {
    console.log("🚀 Starting Real Data Monitor");
    console.log(`📍 Monitoring: ${this.apiBase}`);
    console.log(`⏱️  Check interval: ${this.checkInterval}ms`);
    console.log("Press Ctrl+C to stop\n");

    try {
      await this.authenticate();
    } catch (error) {
      console.error("Failed to start monitor:", error);
      return;
    }

    // Initial check
    await this.runChecks();

    // Set up interval
    setInterval(async () => {
      await this.runChecks();
    }, this.checkInterval);

    // Handle graceful shutdown
    Deno.addSignalListener("SIGINT", () => {
      console.log("\n👋 Shutting down monitor...");
      
      if (this.issues.size > 0) {
        console.log("\n📊 FINAL REPORT:");
        console.log(`Total endpoints with issues: ${this.issues.size}`);
        
        let totalIssues = 0;
        this.issues.forEach(issues => totalIssues += issues.size);
        console.log(`Total unique issues found: ${totalIssues}`);
      } else {
        console.log("\n✨ No mock data detected during monitoring session!");
      }
      
      Deno.exit(0);
    });
  }
}

// Check for realistic values
function validateRealisticRanges(data: any): string[] {
  const warnings: string[] = [];
  
  const ranges = {
    totalViews: { min: 0, max: 10000, field: "totalViews" },
    followers: { min: 0, max: 1000, field: "followers" },
    avgRating: { min: 0, max: 5, field: "avgRating" },
    likeCount: { min: 0, max: 1000, field: "likeCount" },
    ndaCount: { min: 0, max: 100, field: "ndaCount" },
  };

  function check(obj: any, path: string = ""): void {
    if (!obj) return;
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check if this key matches any of our range checks
      Object.values(ranges).forEach(range => {
        if (key === range.field && typeof value === "number") {
          if (value < range.min || value > range.max) {
            warnings.push(
              `Suspicious ${range.field} value at ${fullPath}: ${value} ` +
              `(expected ${range.min}-${range.max})`
            );
          }
        }
      });

      // Recurse into nested objects
      if (typeof value === "object" && value !== null) {
        check(value, fullPath);
      }
    });
  }

  check(data);
  return warnings;
}

// Main execution
if (import.meta.main) {
  const monitor = new DataMonitor();
  await monitor.start();
}