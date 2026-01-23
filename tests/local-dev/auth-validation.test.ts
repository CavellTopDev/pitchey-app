/**
 * Authentication Validation Test Suite
 * Tests Better Auth session-based authentication for all three portals
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const authenticationSuite: TestSuite = {
  name: "Authentication Validation Tests",
  description: "Validate Better Auth session-based authentication for all three portals",
  
  tests: [
    {
      id: "creator_login_flow",
      name: "Creator portal login flow",
      description: "Test complete login flow for creator demo account",
      category: "integration",
      priority: "critical",
      timeout: 10000,
      test: async () => {
        const creatorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        
        try {
          // Step 1: Attempt login
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include", // Important for session cookies
            body: JSON.stringify({
              email: creatorUser.email,
              password: creatorUser.password
            })
          });

          if (!loginResponse.ok) {
            const errorData = await loginResponse.text();
            return {
              success: false,
              duration: 0,
              message: `Creator login failed with status ${loginResponse.status}`,
              details: { 
                status: loginResponse.status,
                error: errorData,
                email: creatorUser.email
              }
            };
          }

          // Step 2: Verify session is created
          const sessionResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/session`, {
            method: "GET",
            credentials: "include"
          });

          if (!sessionResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Session validation failed after login",
              details: { sessionStatus: sessionResponse.status }
            };
          }

          const sessionData = await sessionResponse.json();
          
          if (!sessionData.user || sessionData.user.email !== creatorUser.email) {
            return {
              success: false,
              duration: 0,
              message: "Session data does not match logged-in user",
              details: { 
                expected: creatorUser.email,
                actual: sessionData.user?.email
              }
            };
          }

          // Step 3: Test protected endpoint access
          const dashboardResponse = await fetch(`${LOCAL_CONFIG.backend}/api/creator/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!dashboardResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Creator dashboard access failed after login",
              details: { dashboardStatus: dashboardResponse.status }
            };
          }

          // Step 4: Test logout
          const logoutResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-out`, {
            method: "POST",
            credentials: "include"
          });

          if (!logoutResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Logout failed",
              details: { logoutStatus: logoutResponse.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Creator authentication flow completed successfully",
            details: {
              email: creatorUser.email,
              sessionUser: sessionData.user?.email,
              userType: sessionData.user?.userType || sessionData.user?.user_type
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Creator authentication test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "investor_login_flow",
      name: "Investor portal login flow",
      description: "Test complete login flow for investor demo account",
      category: "integration",
      priority: "critical",
      timeout: 10000,
      test: async () => {
        const investorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "investor");
        
        try {
          // Step 1: Login
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: investorUser.email,
              password: investorUser.password
            })
          });

          if (!loginResponse.ok) {
            const errorData = await loginResponse.text();
            return {
              success: false,
              duration: 0,
              message: `Investor login failed with status ${loginResponse.status}`,
              details: { 
                status: loginResponse.status,
                error: errorData
              }
            };
          }

          // Step 2: Verify session
          const sessionResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/session`, {
            method: "GET",
            credentials: "include"
          });

          if (!sessionResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Investor session validation failed",
              details: { sessionStatus: sessionResponse.status }
            };
          }

          const sessionData = await sessionResponse.json();

          // Step 3: Test investor dashboard access
          const dashboardResponse = await fetch(`${LOCAL_CONFIG.backend}/api/investor/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!dashboardResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Investor dashboard access failed",
              details: { dashboardStatus: dashboardResponse.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Investor authentication flow completed successfully",
            details: {
              email: investorUser.email,
              sessionUser: sessionData.user?.email
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Investor authentication test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "production_login_flow",
      name: "Production company portal login flow",
      description: "Test complete login flow for production company demo account",
      category: "integration",
      priority: "critical",
      timeout: 10000,
      test: async () => {
        const productionUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "production");
        
        try {
          // Step 1: Login
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: productionUser.email,
              password: productionUser.password
            })
          });

          if (!loginResponse.ok) {
            const errorData = await loginResponse.text();
            return {
              success: false,
              duration: 0,
              message: `Production company login failed with status ${loginResponse.status}`,
              details: { 
                status: loginResponse.status,
                error: errorData
              }
            };
          }

          // Step 2: Verify session
          const sessionResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/session`, {
            method: "GET",
            credentials: "include"
          });

          if (!sessionResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Production company session validation failed",
              details: { sessionStatus: sessionResponse.status }
            };
          }

          const sessionData = await sessionResponse.json();

          // Step 3: Test production dashboard access
          const dashboardResponse = await fetch(`${LOCAL_CONFIG.backend}/api/production/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!dashboardResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Production dashboard access failed",
              details: { dashboardStatus: dashboardResponse.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Production company authentication flow completed successfully",
            details: {
              email: productionUser.email,
              sessionUser: sessionData.user?.email
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Production company authentication test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "invalid_credentials_test",
      name: "Invalid credentials rejection",
      description: "Test that invalid credentials are properly rejected",
      category: "integration",
      priority: "high",
      timeout: 5000,
      test: async () => {
        try {
          const response = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: "invalid@example.com",
              password: "wrongpassword"
            })
          });

          if (response.ok) {
            return {
              success: false,
              duration: 0,
              message: "Invalid credentials were accepted (security issue)",
              details: { status: response.status }
            };
          }

          if (response.status !== 401 && response.status !== 400) {
            return {
              success: false,
              duration: 0,
              message: `Unexpected status code for invalid credentials: ${response.status}`,
              details: { status: response.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Invalid credentials properly rejected",
            details: { status: response.status }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Invalid credentials test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "session_persistence_test",
      name: "Session persistence across requests",
      description: "Test that authenticated sessions persist across multiple requests",
      category: "integration",
      priority: "high",
      timeout: 15000,
      test: async () => {
        const testUser = LOCAL_CONFIG.demoUsers[0]; // Use first demo user
        let sessionCookies = "";

        try {
          // Step 1: Login and capture session cookies
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: testUser.email,
              password: testUser.password
            })
          });

          if (!loginResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: `Login failed for session persistence test`,
              details: { status: loginResponse.status }
            };
          }

          // Extract cookies from response
          const setCookieHeader = loginResponse.headers.get("set-cookie");
          if (setCookieHeader) {
            sessionCookies = setCookieHeader.split(";")[0]; // Get the session cookie
          }

          // Step 2: Make multiple requests with the same session
          const requests = [
            `${LOCAL_CONFIG.backend}/api/auth/session`,
            `${LOCAL_CONFIG.backend}/api/pitches/browse`,
            `${LOCAL_CONFIG.backend}/api/health`
          ];

          for (const url of requests) {
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "Cookie": sessionCookies
              }
            });

            if (!response.ok && !url.includes("/health")) {
              return {
                success: false,
                duration: 0,
                message: `Session persistence failed for ${url}`,
                details: { 
                  url,
                  status: response.status,
                  cookies: sessionCookies 
                }
              };
            }
          }

          // Step 3: Wait and test session is still valid
          await new Promise(resolve => setTimeout(resolve, 2000));

          const delayedResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/session`, {
            method: "GET",
            headers: {
              "Cookie": sessionCookies
            }
          });

          if (!delayedResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Session expired too quickly",
              details: { delayedStatus: delayedResponse.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Session persistence working correctly",
            details: { 
              requestsTested: requests.length,
              sessionDuration: "2+ seconds"
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Session persistence test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "concurrent_session_test",
      name: "Concurrent session handling",
      description: "Test that multiple concurrent sessions are handled properly",
      category: "integration", 
      priority: "medium",
      timeout: 15000,
      test: async () => {
        try {
          // Test concurrent logins with different users
          const loginPromises = LOCAL_CONFIG.demoUsers.map(user => 
            fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                email: user.email,
                password: user.password
              })
            })
          );

          const responses = await Promise.all(loginPromises);
          
          const successfulLogins = responses.filter(response => response.ok);
          
          if (successfulLogins.length !== LOCAL_CONFIG.demoUsers.length) {
            return {
              success: false,
              duration: 0,
              message: "Not all concurrent logins succeeded",
              details: { 
                total: LOCAL_CONFIG.demoUsers.length,
                successful: successfulLogins.length
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Concurrent sessions handled correctly",
            details: { 
              concurrentLogins: successfulLogins.length
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Concurrent session test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    }
  ]
};