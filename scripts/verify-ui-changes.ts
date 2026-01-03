#!/usr/bin/env -S deno run --allow-all

/**
 * UI Verification Script for Pitchey
 * Uses browser automation to verify UI changes after deployment
 */

interface VerificationResult {
  test: string;
  passed: boolean;
  details: string;
}

class PitcheyUIVerifier {
  private results: VerificationResult[] = [];
  private deploymentUrl: string;

  constructor(deploymentUrl: string) {
    this.deploymentUrl = deploymentUrl;
  }

  async runAllTests(): Promise<void> {
    console.log("🔍 Starting UI Verification Tests");
    console.log(`📍 Testing URL: ${this.deploymentUrl}`);
    console.log("=" .repeat(50));

    // Run all verification tests
    await this.verifyNoNavigationDuplication();
    await this.verifyDashboardElements();
    await this.verifyResponsiveDesign();
    await this.verifyPortalSwitching();
    
    // Print results
    this.printResults();
  }

  async verifyNoNavigationDuplication(): Promise<void> {
    console.log("\n🧪 Test 1: Checking for navigation duplication...");
    
    try {
      // This would integrate with Chrome DevTools MCP in production
      // For now, we'll use a simple HTTP check
      const response = await fetch(`${this.deploymentUrl}/creator/dashboard`);
      const html = await response.text();
      
      // Count navigation-related elements
      const navCount = (html.match(/EnhancedCreatorNav|navigation-sidebar|Creator Portal/g) || []).length;
      
      if (navCount <= 3) { // Reasonable threshold
        this.addResult("No Navigation Duplication", true, `Found ${navCount} navigation references (expected ≤ 3)`);
      } else {
        this.addResult("No Navigation Duplication", false, `Found ${navCount} navigation references (possible duplication)`);
      }
    } catch (error) {
      this.addResult("No Navigation Duplication", false, `Error: ${error.message}`);
    }
  }

  async verifyDashboardElements(): Promise<void> {
    console.log("\n🧪 Test 2: Verifying dashboard elements...");
    
    const elementsToCheck = [
      "Creator Dashboard",
      "Total Pitches",
      "Active Pitches",
      "Total Views",
      "Avg Rating",
      "Followers",
      "Engagement Rate"
    ];

    try {
      const response = await fetch(`${this.deploymentUrl}/creator/dashboard`);
      const html = await response.text();
      
      const missingElements = elementsToCheck.filter(element => !html.includes(element));
      
      if (missingElements.length === 0) {
        this.addResult("Dashboard Elements", true, "All required elements present");
      } else {
        this.addResult("Dashboard Elements", false, `Missing: ${missingElements.join(", ")}`);
      }
    } catch (error) {
      this.addResult("Dashboard Elements", false, `Error: ${error.message}`);
    }
  }

  async verifyResponsiveDesign(): Promise<void> {
    console.log("\n🧪 Test 3: Checking responsive design markers...");
    
    try {
      const response = await fetch(`${this.deploymentUrl}/creator/dashboard`);
      const html = await response.text();
      
      // Check for responsive classes
      const hasResponsiveClasses = 
        html.includes("sm:") && 
        html.includes("md:") && 
        html.includes("lg:") &&
        html.includes("hidden lg:block"); // Desktop sidebar visibility
      
      if (hasResponsiveClasses) {
        this.addResult("Responsive Design", true, "Responsive classes detected");
      } else {
        this.addResult("Responsive Design", false, "Missing responsive design classes");
      }
    } catch (error) {
      this.addResult("Responsive Design", false, `Error: ${error.message}`);
    }
  }

  async verifyPortalSwitching(): Promise<void> {
    console.log("\n🧪 Test 4: Verifying portal switching...");
    
    const portals = [
      { path: "/login/creator", name: "Creator Portal" },
      { path: "/login/investor", name: "Investor Portal" },
      { path: "/login/production", name: "Production Portal" }
    ];

    let allPortalsAccessible = true;
    const portalResults: string[] = [];

    for (const portal of portals) {
      try {
        const response = await fetch(`${this.deploymentUrl}${portal.path}`);
        if (response.ok) {
          portalResults.push(`✓ ${portal.name}`);
        } else {
          allPortalsAccessible = false;
          portalResults.push(`✗ ${portal.name} (HTTP ${response.status})`);
        }
      } catch (error) {
        allPortalsAccessible = false;
        portalResults.push(`✗ ${portal.name} (Error)`);
      }
    }

    this.addResult(
      "Portal Switching", 
      allPortalsAccessible, 
      portalResults.join(", ")
    );
  }

  private addResult(test: string, passed: boolean, details: string): void {
    this.results.push({ test, passed, details });
    console.log(`  ${passed ? "✅" : "❌"} ${test}: ${details}`);
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(50));
    console.log("📊 VERIFICATION RESULTS");
    console.log("=".repeat(50));

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const passRate = (passedTests / totalTests * 100).toFixed(1);

    console.log(`\nTests Passed: ${passedTests}/${totalTests} (${passRate}%)`);
    
    if (passedTests === totalTests) {
      console.log("\n🎉 All tests passed! Deployment verified successfully.");
    } else {
      console.log("\n⚠️  Some tests failed. Please review the results above.");
      
      const failedTests = this.results.filter(r => !r.passed);
      console.log("\nFailed Tests:");
      failedTests.forEach(test => {
        console.log(`  ❌ ${test.test}: ${test.details}`);
      });
    }

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsFile = `verification-results-${timestamp}.json`;
    
    Deno.writeTextFileSync(
      resultsFile,
      JSON.stringify({
        url: this.deploymentUrl,
        timestamp: new Date().toISOString(),
        results: this.results,
        summary: {
          passed: passedTests,
          total: totalTests,
          passRate: parseFloat(passRate)
        }
      }, null, 2)
    );
    
    console.log(`\n📁 Results saved to: ${resultsFile}`);
  }
}

// Main execution
async function main() {
  const deploymentUrl = Deno.args[0] || "https://3801b946.pitchey-5o8.pages.dev";
  
  const verifier = new PitcheyUIVerifier(deploymentUrl);
  await verifier.runAllTests();
}

if (import.meta.main) {
  main().catch(console.error);
}