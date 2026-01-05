/**
 * Security Validation Test Suite
 * Tests input validation, authentication bypass, and data exposure prevention
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const securitySuite: TestSuite = {
  name: "Security Validation Tests",
  description: "Validate security measures including input validation, authentication, and data protection",
  
  tests: [
    {
      id: "sql_injection_prevention",
      name: "SQL injection prevention",
      description: "Test that SQL injection attempts are properly blocked",
      category: "security",
      priority: "critical",
      timeout: 15000,
      test: async () => {
        const sqlInjectionPayloads = [
          "' OR '1'='1",
          "'; DROP TABLE users; --", 
          "1' UNION SELECT * FROM users --",
          "admin'--",
          "' OR 1=1 --",
          "\"; DROP DATABASE pitchey_local; --"
        ];

        const testEndpoints = [
          { 
            url: `${LOCAL_CONFIG.backend}/api/search`,
            param: "q",
            method: "GET"
          },
          {
            url: `${LOCAL_CONFIG.backend}/api/pitches/browse`,
            param: "genre", 
            method: "GET"
          }
        ];

        const results = [];

        try {
          for (const endpoint of testEndpoints) {
            for (const payload of sqlInjectionPayloads) {
              const testUrl = `${endpoint.url}?${endpoint.param}=${encodeURIComponent(payload)}`;
              
              try {
                const response = await fetch(testUrl, { method: endpoint.method });
                
                // Check if response indicates SQL injection success
                const responseText = await response.text();
                let responseData = null;
                
                try {
                  responseData = JSON.parse(responseText);
                } catch {
                  // Not JSON, continue with text analysis
                }

                // Red flags that might indicate SQL injection success
                const dangerousPatterns = [
                  /error in your sql syntax/i,
                  /mysql_fetch_array/i,
                  /postgresql error/i,
                  /ora-\d+/i,
                  /sqlite error/i,
                  /column .* does not exist/i,
                  /table .* doesn't exist/i
                ];

                const containsDangerousPattern = dangerousPatterns.some(pattern => 
                  pattern.test(responseText)
                );

                // Check for unexpected database information exposure
                const exposesDbInfo = responseData && (
                  responseData.error?.includes?.("database") ||
                  responseData.error?.includes?.("table") ||
                  responseData.error?.includes?.("column") ||
                  responseData.message?.includes?.("SQL")
                );

                results.push({
                  endpoint: endpoint.url,
                  payload: payload.substring(0, 20) + "...",
                  status: response.status,
                  blocked: response.status >= 400,
                  containsDangerousPattern,
                  exposesDbInfo: exposesDbInfo || false,
                  responseSize: responseText.length
                });

              } catch (fetchError) {
                results.push({
                  endpoint: endpoint.url,
                  payload: payload.substring(0, 20) + "...",
                  status: 0,
                  blocked: true, // Network error counts as blocked
                  error: fetchError.message
                });
              }

              // Rate limit to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }

          // Analyze results for security issues
          const vulnerabilities = results.filter(r => 
            !r.blocked || r.containsDangerousPattern || r.exposesDbInfo
          );

          const successfulBlocks = results.filter(r => r.blocked && !r.containsDangerousPattern);
          const totalTests = results.length;

          const securityGood = vulnerabilities.length === 0;

          return {
            success: securityGood,
            duration: 0,
            message: securityGood ? 
              "SQL injection prevention working correctly" : 
              `SECURITY VULNERABILITIES DETECTED: ${vulnerabilities.length} potential issues`,
            details: {
              testSummary: {
                totalTests,
                successfullyBlocked: successfulBlocks.length,
                potentialVulnerabilities: vulnerabilities.length,
                blockingRate: `${((successfulBlocks.length / totalTests) * 100).toFixed(1)}%`
              },
              vulnerabilities: vulnerabilities.map(v => ({
                endpoint: v.endpoint,
                payload: v.payload,
                issue: v.containsDangerousPattern ? "dangerous-pattern" : 
                       v.exposesDbInfo ? "database-info-exposure" : 
                       "not-blocked",
                status: v.status
              })),
              payloadsTested: sqlInjectionPayloads.length,
              endpointsTested: testEndpoints.length,
              securityLevel: securityGood ? "SECURE" : "VULNERABLE"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `SQL injection prevention test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "xss_prevention_test",
      name: "Cross-Site Scripting (XSS) prevention",
      description: "Test that XSS attempts are properly sanitized or blocked",
      category: "security",
      priority: "critical",
      timeout: 10000,
      test: async () => {
        const xssPayloads = [
          "<script>alert('XSS')</script>",
          "javascript:alert('XSS')",
          "<img src=x onerror=alert('XSS')>",
          "<svg onload=alert('XSS')>",
          "';alert('XSS');//",
          "<iframe src=\"javascript:alert('XSS')\"></iframe>"
        ];

        const testUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        let loginSuccessful = false;

        try {
          // Login to test authenticated endpoints
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: testUser.email,
              password: testUser.password
            })
          });

          loginSuccessful = loginResponse.ok;

          const results = [];

          // Test XSS in search endpoints
          for (const payload of xssPayloads) {
            const searchUrl = `${LOCAL_CONFIG.backend}/api/search?q=${encodeURIComponent(payload)}`;
            
            try {
              const response = await fetch(searchUrl);
              const responseText = await response.text();
              
              // Check if payload is reflected unescaped
              const isReflected = responseText.includes(payload);
              const isEscaped = responseText.includes(payload.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
              
              results.push({
                endpoint: "search",
                payload: payload.substring(0, 30) + "...",
                status: response.status,
                isReflected,
                isEscaped,
                responseLength: responseText.length
              });

            } catch (error) {
              results.push({
                endpoint: "search",
                payload: payload.substring(0, 30) + "...",
                status: 0,
                error: error.message
              });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // Test XSS in form inputs (if login was successful)
          if (loginSuccessful) {
            for (const payload of xssPayloads.slice(0, 3)) { // Test fewer payloads for forms
              try {
                const createResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  credentials: "include",
                  body: JSON.stringify({
                    title: payload,
                    genre: "Drama",
                    logline: "Test for XSS prevention"
                  })
                });

                const responseText = await createResponse.text();
                const isReflected = responseText.includes(payload);

                results.push({
                  endpoint: "pitch-creation",
                  payload: payload.substring(0, 30) + "...",
                  status: createResponse.status,
                  isReflected,
                  blocked: createResponse.status >= 400
                });

              } catch (error) {
                results.push({
                  endpoint: "pitch-creation", 
                  payload: payload.substring(0, 30) + "...",
                  status: 0,
                  error: error.message
                });
              }

              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Analyze results for XSS vulnerabilities
          const vulnerabilities = results.filter(r => 
            r.isReflected && !r.isEscaped && r.status < 400
          );

          const totalTests = results.length;
          const secureResponses = results.filter(r => 
            !r.isReflected || r.isEscaped || r.status >= 400
          ).length;

          const xssPreventionGood = vulnerabilities.length === 0;

          return {
            success: xssPreventionGood,
            duration: 0,
            message: xssPreventionGood ? 
              "XSS prevention working correctly" : 
              `XSS VULNERABILITIES DETECTED: ${vulnerabilities.length} potential issues`,
            details: {
              testSummary: {
                totalTests,
                secureResponses,
                vulnerabilities: vulnerabilities.length,
                securityRate: `${((secureResponses / totalTests) * 100).toFixed(1)}%`
              },
              vulnerabilities: vulnerabilities.map(v => ({
                endpoint: v.endpoint,
                payload: v.payload,
                issue: "unescaped-reflection",
                status: v.status
              })),
              loginRequired: !loginSuccessful ? "Failed to test authenticated endpoints" : "Tested authenticated endpoints",
              xssPayloadsTested: xssPayloads.length,
              securityLevel: xssPreventionGood ? "SECURE" : "VULNERABLE"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `XSS prevention test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "authentication_bypass_test",
      name: "Authentication bypass prevention",
      description: "Test that protected endpoints cannot be accessed without proper authentication",
      category: "security",
      priority: "critical",
      timeout: 15000,
      test: async () => {
        const protectedEndpoints = [
          { url: `${LOCAL_CONFIG.backend}/api/creator/dashboard`, method: "GET" },
          { url: `${LOCAL_CONFIG.backend}/api/investor/dashboard`, method: "GET" },
          { url: `${LOCAL_CONFIG.backend}/api/production/dashboard`, method: "GET" },
          { url: `${LOCAL_CONFIG.backend}/api/pitches`, method: "POST" },
          { url: `${LOCAL_CONFIG.backend}/api/ndas/sign`, method: "POST" },
          { url: `${LOCAL_CONFIG.backend}/api/investments/interest`, method: "POST" },
          { url: `${LOCAL_CONFIG.backend}/api/upload/document`, method: "POST" },
          { url: `${LOCAL_CONFIG.backend}/api/auth/session`, method: "GET" }
        ];

        const bypassAttempts = [
          { name: "No credentials", headers: {} },
          { name: "Invalid token", headers: { "Authorization": "Bearer invalid_token" } },
          { name: "Expired token", headers: { "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid" } },
          { name: "Malformed cookie", headers: { "Cookie": "session=invalid; auth=malformed" } },
          { name: "Admin headers", headers: { "X-Admin": "true", "X-Role": "admin" } },
          { name: "Bypass headers", headers: { "X-Forwarded-User": "admin", "X-Real-IP": "127.0.0.1" } }
        ];

        const results = [];

        try {
          for (const endpoint of protectedEndpoints) {
            for (const attempt of bypassAttempts) {
              try {
                const requestBody = endpoint.method === "POST" ? 
                  JSON.stringify({ test: "bypass attempt" }) : undefined;

                const response = await fetch(endpoint.url, {
                  method: endpoint.method,
                  headers: {
                    "Content-Type": "application/json",
                    ...attempt.headers
                  },
                  body: requestBody
                });

                const responseText = await response.text();
                
                // Check if access was granted (which would be a security issue)
                const accessGranted = response.status === 200 || response.status === 201;
                const properlyBlocked = response.status === 401 || response.status === 403;

                results.push({
                  endpoint: endpoint.url.split("/").pop(),
                  method: endpoint.method,
                  bypassAttempt: attempt.name,
                  status: response.status,
                  accessGranted,
                  properlyBlocked,
                  responseLength: responseText.length
                });

              } catch (error) {
                results.push({
                  endpoint: endpoint.url.split("/").pop(),
                  method: endpoint.method,
                  bypassAttempt: attempt.name,
                  status: 0,
                  accessGranted: false,
                  properlyBlocked: true, // Network error counts as blocked
                  error: error.message
                });
              }

              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Analyze results for authentication bypass vulnerabilities
          const bypassVulnerabilities = results.filter(r => r.accessGranted);
          const properlySecured = results.filter(r => r.properlyBlocked);
          const totalTests = results.length;

          const authenticationSecure = bypassVulnerabilities.length === 0;

          return {
            success: authenticationSecure,
            duration: 0,
            message: authenticationSecure ? 
              "Authentication protection working correctly" : 
              `CRITICAL SECURITY ISSUE: ${bypassVulnerabilities.length} authentication bypass vulnerabilities`,
            details: {
              testSummary: {
                totalTests,
                properlySecured: properlySecured.length,
                bypassVulnerabilities: bypassVulnerabilities.length,
                securityRate: `${((properlySecured.length / totalTests) * 100).toFixed(1)}%`
              },
              vulnerabilities: bypassVulnerabilities.map(v => ({
                endpoint: v.endpoint,
                method: v.method,
                bypassMethod: v.bypassAttempt,
                status: v.status,
                severity: "CRITICAL"
              })),
              endpointsTested: protectedEndpoints.length,
              bypassMethodsTested: bypassAttempts.length,
              securityLevel: authenticationSecure ? "SECURE" : "CRITICALLY VULNERABLE"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Authentication bypass test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "data_exposure_test",
      name: "Sensitive data exposure prevention",
      description: "Test that sensitive information is not exposed in API responses",
      category: "security",
      priority: "high",
      timeout: 10000,
      test: async () => {
        const sensitivePatterns = [
          { pattern: /password/i, type: "password field" },
          { pattern: /secret/i, type: "secret key" },
          { pattern: /token/i, type: "authentication token" },
          { pattern: /key/i, type: "API key" },
          { pattern: /hash/i, type: "password hash" },
          { pattern: /salt/i, type: "password salt" },
          { pattern: /private/i, type: "private key" },
          { pattern: /credential/i, type: "credentials" },
          { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: "email address" },
          { pattern: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, type: "credit card number" }
        ];

        const testEndpoints = [
          `${LOCAL_CONFIG.backend}/api/health`,
          `${LOCAL_CONFIG.backend}/api/pitches/browse`,
          `${LOCAL_CONFIG.backend}/api/search?q=test`,
          `${LOCAL_CONFIG.backend}/health`
        ];

        const results = [];

        try {
          for (const endpoint of testEndpoints) {
            try {
              const response = await fetch(endpoint);
              const responseText = await response.text();
              
              let responseData = null;
              try {
                responseData = JSON.parse(responseText);
              } catch {
                // Continue with text analysis
              }

              const exposures = [];

              // Check for sensitive patterns in response
              for (const { pattern, type } of sensitivePatterns) {
                const matches = responseText.match(pattern);
                if (matches && matches.length > 0) {
                  exposures.push({
                    type,
                    matches: matches.slice(0, 3), // Limit to first 3 matches
                    count: matches.length
                  });
                }
              }

              // Check for debug information exposure
              const debugExposure = 
                responseText.includes("stack trace") ||
                responseText.includes("debug") ||
                responseText.includes("localhost") ||
                responseText.includes("internal error") ||
                (responseData && responseData.stack);

              results.push({
                endpoint: endpoint.split("/").pop() || endpoint,
                status: response.status,
                exposures,
                debugExposure,
                responseSize: responseText.length,
                hasExposures: exposures.length > 0 || debugExposure
              });

            } catch (error) {
              results.push({
                endpoint: endpoint.split("/").pop() || endpoint,
                status: 0,
                error: error.message,
                hasExposures: false
              });
            }

            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Analyze results for data exposure
          const exposureIssues = results.filter(r => r.hasExposures);
          const secureEndpoints = results.filter(r => !r.hasExposures);
          const totalTests = results.length;

          const dataProtectionGood = exposureIssues.length === 0;

          return {
            success: dataProtectionGood,
            duration: 0,
            message: dataProtectionGood ? 
              "No sensitive data exposure detected" : 
              `DATA EXPOSURE ISSUES: ${exposureIssues.length} endpoints exposing sensitive information`,
            details: {
              testSummary: {
                totalTests,
                secureEndpoints: secureEndpoints.length,
                exposureIssues: exposureIssues.length,
                securityRate: `${((secureEndpoints.length / totalTests) * 100).toFixed(1)}%`
              },
              exposures: exposureIssues.map(e => ({
                endpoint: e.endpoint,
                status: e.status,
                sensitiveData: e.exposures.map(exp => ({
                  type: exp.type,
                  count: exp.count
                })),
                debugInfo: e.debugExposure
              })),
              patternsChecked: sensitivePatterns.length,
              endpointsTested: testEndpoints.length,
              securityLevel: dataProtectionGood ? "SECURE" : "DATA EXPOSED"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Data exposure test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "input_validation_test",
      name: "Input validation and sanitization",
      description: "Test that malicious input is properly validated and sanitized",
      category: "security",
      priority: "high",
      timeout: 15000,
      test: async () => {
        const maliciousInputs = [
          { type: "oversized", value: "A".repeat(100000) },
          { type: "null-bytes", value: "test\x00admin" },
          { type: "path-traversal", value: "../../../etc/passwd" },
          { type: "command-injection", value: "; cat /etc/passwd #" },
          { type: "unicode-bypass", value: "admin\u202e" },
          { type: "special-chars", value: "!@#$%^&*(){}[]|\\:;\"'<>?/~`" }
        ];

        const testUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        let authenticated = false;

        try {
          // Login to test authenticated endpoints
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: testUser.email,
              password: testUser.password
            })
          });

          authenticated = loginResponse.ok;

          const results = [];

          // Test input validation in search
          for (const input of maliciousInputs) {
            try {
              const searchUrl = `${LOCAL_CONFIG.backend}/api/search?q=${encodeURIComponent(input.value)}`;
              const response = await fetch(searchUrl);
              const responseText = await response.text();

              const handledProperly = 
                response.status >= 400 || // Rejected with error status
                responseText.length < 10000 || // Response not excessively long
                !responseText.includes(input.value); // Input not reflected back

              results.push({
                endpoint: "search",
                inputType: input.type,
                status: response.status,
                handledProperly,
                responseSize: responseText.length
              });

            } catch (error) {
              results.push({
                endpoint: "search",
                inputType: input.type,
                status: 0,
                handledProperly: true, // Network error counts as handled
                error: error.message
              });
            }

            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // Test input validation in form submission (if authenticated)
          if (authenticated) {
            for (const input of maliciousInputs.slice(0, 4)) { // Test fewer inputs for forms
              try {
                const createResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  credentials: "include",
                  body: JSON.stringify({
                    title: input.value,
                    genre: "Drama",
                    logline: "Input validation test"
                  })
                });

                const responseText = await createResponse.text();

                const handledProperly = 
                  createResponse.status >= 400 || // Rejected
                  (createResponse.status < 400 && responseText.includes("success")); // Properly processed

                results.push({
                  endpoint: "pitch-creation",
                  inputType: input.type,
                  status: createResponse.status,
                  handledProperly,
                  responseSize: responseText.length
                });

              } catch (error) {
                results.push({
                  endpoint: "pitch-creation",
                  inputType: input.type,
                  status: 0,
                  handledProperly: true,
                  error: error.message
                });
              }

              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Analyze results
          const improperlyHandled = results.filter(r => !r.handledProperly);
          const properlyValidated = results.filter(r => r.handledProperly);
          const totalTests = results.length;

          const inputValidationGood = improperlyHandled.length === 0;

          return {
            success: inputValidationGood,
            duration: 0,
            message: inputValidationGood ? 
              "Input validation working correctly" : 
              `INPUT VALIDATION ISSUES: ${improperlyHandled.length} inputs improperly handled`,
            details: {
              testSummary: {
                totalTests,
                properlyValidated: properlyValidated.length,
                improperlyHandled: improperlyHandled.length,
                validationRate: `${((properlyValidated.length / totalTests) * 100).toFixed(1)}%`
              },
              issues: improperlyHandled.map(i => ({
                endpoint: i.endpoint,
                inputType: i.inputType,
                status: i.status,
                issue: "improper-handling"
              })),
              authenticationStatus: authenticated ? "authenticated" : "unauthenticated",
              inputTypesTested: maliciousInputs.length,
              securityLevel: inputValidationGood ? "SECURE" : "VALIDATION ISSUES"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Input validation test failed: ${error.message}`,
            error
          };
        }
      }
    }
  ]
};