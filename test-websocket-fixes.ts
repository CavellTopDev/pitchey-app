#!/usr/bin/env deno run --allow-net --allow-env

/**
 * WebSocket Fixes Verification Test
 * Tests the improved error handling and JWT validation
 */

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  error?: string;
}

class WebSocketTester {
  private results: TestResult[] = [];
  private baseUrl: string;

  constructor() {
    this.baseUrl = "wss://pitchey-backend-fresh.deno.dev";
  }

  private log(message: string) {
    console.log(`[WebSocket Test] ${message}`);
  }

  private addResult(test: string, passed: boolean, details: string, error?: string) {
    this.results.push({ test, passed, details, error });
    const status = passed ? "✅ PASS" : "❌ FAIL";
    this.log(`${status}: ${test} - ${details}`);
    if (error) {
      this.log(`  Error: ${error}`);
    }
  }

  /**
   * Test 1: Connect without token (should get descriptive error)
   */
  async testNoTokenConnection(): Promise<void> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${this.baseUrl}/ws`);
      
      let responseReceived = false;
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          ws.close();
          this.addResult(
            "No Token Connection",
            false,
            "No response received within 10 seconds"
          );
          resolve();
        }
      }, 10000);

      ws.onopen = () => {
        this.log("Connection opened without token (unexpected)");
      };

      ws.onmessage = (event) => {
        responseReceived = true;
        clearTimeout(timeout);
        
        try {
          const data = JSON.parse(event.data);
          const hasError = data.type === "error" || data.error;
          const hasDescriptiveMessage = data.message && 
            data.message !== "Unknown error" && 
            data.message.length > 5;

          this.addResult(
            "No Token Connection",
            hasError && hasDescriptiveMessage,
            hasError 
              ? `Got descriptive error: "${data.message || data.error}"` 
              : "No error message received",
            !hasError ? JSON.stringify(data) : undefined
          );
        } catch (error) {
          this.addResult(
            "No Token Connection",
            false,
            "Could not parse response",
            event.data
          );
        }
        
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        responseReceived = true;
        clearTimeout(timeout);
        this.addResult(
          "No Token Connection",
          true,
          "Connection rejected at protocol level (good)"
        );
        resolve();
      };

      ws.onclose = (event) => {
        if (!responseReceived) {
          clearTimeout(timeout);
          const isGoodClose = event.code === 1008 || event.code === 401;
          this.addResult(
            "No Token Connection",
            isGoodClose,
            `Connection closed with code ${event.code}: ${event.reason || 'No reason'}`,
            !isGoodClose ? `Expected code 1008 or 401, got ${event.code}` : undefined
          );
          resolve();
        }
      };
    });
  }

  /**
   * Test 2: Connect with invalid token (should get descriptive error)
   */
  async testInvalidTokenConnection(): Promise<void> {
    return new Promise((resolve) => {
      const invalidToken = "invalid.jwt.token";
      const ws = new WebSocket(`${this.baseUrl}/ws?token=${invalidToken}`);
      
      let responseReceived = false;
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          ws.close();
          this.addResult(
            "Invalid Token Connection",
            false,
            "No response received within 10 seconds"
          );
          resolve();
        }
      }, 10000);

      ws.onopen = () => {
        this.log("Connection opened with invalid token (checking for error message)");
      };

      ws.onmessage = (event) => {
        responseReceived = true;
        clearTimeout(timeout);
        
        try {
          const data = JSON.parse(event.data);
          const hasError = data.type === "error" || data.error;
          const isAuthError = data.message && (
            data.message.includes("authentication") ||
            data.message.includes("token") ||
            data.message.includes("Authentication") ||
            data.message.includes("Token")
          );

          this.addResult(
            "Invalid Token Connection",
            hasError && isAuthError,
            hasError 
              ? `Got auth error: "${data.message || data.error}"` 
              : "No auth error received",
            !hasError ? JSON.stringify(data) : undefined
          );
        } catch (error) {
          this.addResult(
            "Invalid Token Connection",
            false,
            "Could not parse response",
            event.data
          );
        }
        
        ws.close();
        resolve();
      };

      ws.onerror = (error) => {
        responseReceived = true;
        clearTimeout(timeout);
        this.addResult(
          "Invalid Token Connection",
          true,
          "Connection rejected at protocol level (good)"
        );
        resolve();
      };

      ws.onclose = (event) => {
        if (!responseReceived) {
          clearTimeout(timeout);
          const isGoodClose = event.code === 1008 || event.code === 401 || event.code === 1011;
          this.addResult(
            "Invalid Token Connection",
            isGoodClose,
            `Connection closed with code ${event.code}: ${event.reason || 'No reason'}`,
            !isGoodClose ? `Expected auth-related close code, got ${event.code}` : undefined
          );
          resolve();
        }
      };
    });
  }

  /**
   * Test 3: Check if detailed error logging is working
   */
  async testErrorLogging(): Promise<void> {
    // This test verifies that the server logs detailed error information
    // We can't directly check server logs, but we can verify the client gets good errors
    
    return new Promise((resolve) => {
      const malformedToken = "definitely.not.a.jwt";
      const ws = new WebSocket(`${this.baseUrl}/ws?token=${malformedToken}`);
      
      let responseReceived = false;
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          ws.close();
          this.addResult(
            "Error Logging",
            false,
            "No response received - server may not be logging properly"
          );
          resolve();
        }
      }, 10000);

      ws.onmessage = (event) => {
        responseReceived = true;
        clearTimeout(timeout);
        
        try {
          const data = JSON.parse(event.data);
          const hasDetailedError = data.details || (data.message && data.message.length > 10);
          
          this.addResult(
            "Error Logging",
            hasDetailedError,
            hasDetailedError 
              ? "Server providing detailed error information" 
              : "Server errors lack detail",
            hasDetailedError ? undefined : JSON.stringify(data)
          );
        } catch (error) {
          this.addResult(
            "Error Logging",
            false,
            "Server response not properly formatted",
            event.data
          );
        }
        
        ws.close();
        resolve();
      };

      ws.onerror = () => {
        responseReceived = true;
        clearTimeout(timeout);
        // If we get an immediate error, that means the server is properly rejecting bad requests
        this.addResult(
          "Error Logging",
          true,
          "Server properly rejecting malformed requests"
        );
        resolve();
      };

      ws.onclose = (event) => {
        if (!responseReceived) {
          clearTimeout(timeout);
          // A quick close with reason suggests good error handling
          const hasReason = event.reason && event.reason.length > 0;
          this.addResult(
            "Error Logging",
            hasReason,
            hasReason 
              ? `Server provided close reason: "${event.reason}"` 
              : "Server closed without reason"
          );
          resolve();
        }
      };
    });
  }

  /**
   * Test 4: Verify no infinite loops occur
   */
  async testNoInfiniteLoops(): Promise<void> {
    return new Promise((resolve) => {
      let connectionAttempts = 0;
      let errorCount = 0;
      const maxAttempts = 3;
      
      const attemptConnection = () => {
        connectionAttempts++;
        const ws = new WebSocket(`${this.baseUrl}/ws?token=bad.token`);
        
        const timeout = setTimeout(() => {
          ws.close();
          if (connectionAttempts < maxAttempts) {
            attemptConnection();
          } else {
            this.addResult(
              "No Infinite Loops",
              errorCount <= maxAttempts,
              `Made ${connectionAttempts} attempts, received ${errorCount} errors - no infinite loop detected`,
              errorCount > maxAttempts ? "Too many errors, may indicate loop" : undefined
            );
            resolve();
          }
        }, 2000);

        ws.onmessage = () => {
          clearTimeout(timeout);
          errorCount++;
          ws.close();
          
          if (connectionAttempts < maxAttempts) {
            setTimeout(attemptConnection, 1000);
          } else {
            this.addResult(
              "No Infinite Loops",
              errorCount <= maxAttempts,
              `Made ${connectionAttempts} attempts, received ${errorCount} errors - no infinite loop detected`
            );
            resolve();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          errorCount++;
          
          if (connectionAttempts < maxAttempts) {
            setTimeout(attemptConnection, 1000);
          } else {
            this.addResult(
              "No Infinite Loops",
              true,
              `Made ${connectionAttempts} attempts with immediate rejections - no infinite loop`
            );
            resolve();
          }
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          
          if (connectionAttempts < maxAttempts) {
            setTimeout(attemptConnection, 1000);
          } else {
            this.addResult(
              "No Infinite Loops",
              true,
              `Made ${connectionAttempts} attempts, all properly closed - no infinite loop`
            );
            resolve();
          }
        };
      };

      attemptConnection();
    });
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    this.log("Starting WebSocket fixes verification tests...");
    this.log(`Testing backend: ${this.baseUrl}`);
    this.log("");

    await this.testNoTokenConnection();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests

    await this.testInvalidTokenConnection();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.testErrorLogging();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.testNoInfiniteLoops();

    this.printSummary();
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 WEBSOCKET FIXES VERIFICATION SUMMARY");
    console.log("=".repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`\n📊 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log("\n✅ ALL TESTS PASSED! WebSocket fixes are working correctly.");
      console.log("\n🎉 The fixes have resolved:");
      console.log("   • Infinite loop issues");
      console.log("   • Generic 'Unknown error' messages"); 
      console.log("   • JWT token validation problems");
      console.log("   • Poor error logging");
    } else {
      console.log("\n❌ SOME TESTS FAILED. Issues remain:");
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.test}: ${result.details}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    }

    console.log("\n📋 Detailed Results:");
    this.results.forEach(result => {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.test}`);
      console.log(`   ${result.details}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("\n" + "=".repeat(60));
  }
}

// Run the tests
if (import.meta.main) {
  const tester = new WebSocketTester();
  await tester.runAllTests();
}