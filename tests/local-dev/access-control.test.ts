/**
 * Access Control Test Suite
 * Tests portal isolation and role-based access control
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const accessControlSuite: TestSuite = {
  name: "Access Control Tests",
  description: "Validate portal isolation and role-based access control",
  
  tests: [
    {
      id: "creator_portal_isolation",
      name: "Creator cannot access investor/production portals",
      description: "Verify creator users cannot access other portal endpoints",
      category: "security",
      priority: "critical",
      timeout: 15000,
      test: async () => {
        const creatorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        
        try {
          // Step 1: Login as creator
          const loginResponse = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: creatorUser.email,
              password: creatorUser.password
            })
          });

          if (!loginResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Creator login failed - cannot test access control",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Step 2: Test access to creator dashboard (should succeed)
          const creatorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/creator/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!creatorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "Creator cannot access their own dashboard",
              details: { creatorDashboardStatus: creatorDashboard.status }
            };
          }

          // Step 3: Test access to investor dashboard (should fail)
          const investorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/investor/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (investorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Creator can access investor dashboard",
              details: { 
                investorDashboardStatus: investorDashboard.status,
                severity: "HIGH"
              }
            };
          }

          // Step 4: Test access to production dashboard (should fail)
          const productionDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/production/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (productionDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Creator can access production dashboard",
              details: { 
                productionDashboardStatus: productionDashboard.status,
                severity: "HIGH"
              }
            };
          }

          // Step 5: Test access to admin endpoints (should fail)
          const adminEndpoint = await fetch(`${LOCAL_CONFIG.backend}/api/admin/users`, {
            method: "GET",
            credentials: "include"
          });

          if (adminEndpoint.ok) {
            return {
              success: false,
              duration: 0,
              message: "CRITICAL SECURITY ISSUE: Creator can access admin endpoints",
              details: { 
                adminEndpointStatus: adminEndpoint.status,
                severity: "CRITICAL"
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Creator portal isolation working correctly",
            details: {
              creatorDashboard: "accessible",
              investorDashboard: "blocked",
              productionDashboard: "blocked",
              adminEndpoints: "blocked"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Creator access control test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "investor_portal_isolation",
      name: "Investor cannot access creator/production portals",
      description: "Verify investor users cannot access other portal endpoints",
      category: "security",
      priority: "critical",
      timeout: 15000,
      test: async () => {
        const investorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "investor");
        
        try {
          // Login as investor
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
            return {
              success: false,
              duration: 0,
              message: "Investor login failed - cannot test access control",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Test investor dashboard (should succeed)
          const investorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/investor/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!investorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "Investor cannot access their own dashboard",
              details: { investorDashboardStatus: investorDashboard.status }
            };
          }

          // Test access to creator endpoints (should fail)
          const creatorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/creator/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (creatorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Investor can access creator dashboard",
              details: { 
                creatorDashboardStatus: creatorDashboard.status,
                severity: "HIGH"
              }
            };
          }

          // Test pitch creation (should fail - only creators can create)
          const pitchCreation = await fetch(`${LOCAL_CONFIG.backend}/api/pitches`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              title: "Test Pitch",
              genre: "Drama"
            })
          });

          if (pitchCreation.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Investor can create pitches",
              details: { 
                pitchCreationStatus: pitchCreation.status,
                severity: "HIGH"
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Investor portal isolation working correctly",
            details: {
              investorDashboard: "accessible",
              creatorDashboard: "blocked",
              pitchCreation: "blocked"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Investor access control test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "production_portal_isolation",
      name: "Production company cannot access creator/investor portals",
      description: "Verify production company users cannot access other portal endpoints",
      category: "security",
      priority: "critical",
      timeout: 15000,
      test: async () => {
        const productionUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "production");
        
        try {
          // Login as production company
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
            return {
              success: false,
              duration: 0,
              message: "Production company login failed - cannot test access control",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Test production dashboard (should succeed)
          const productionDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/production/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (!productionDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "Production company cannot access their own dashboard",
              details: { productionDashboardStatus: productionDashboard.status }
            };
          }

          // Test access to creator dashboard (should fail)
          const creatorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/creator/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (creatorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Production company can access creator dashboard",
              details: { 
                creatorDashboardStatus: creatorDashboard.status,
                severity: "HIGH"
              }
            };
          }

          // Test access to investor dashboard (should fail)
          const investorDashboard = await fetch(`${LOCAL_CONFIG.backend}/api/investor/dashboard`, {
            method: "GET",
            credentials: "include"
          });

          if (investorDashboard.ok) {
            return {
              success: false,
              duration: 0,
              message: "SECURITY ISSUE: Production company can access investor dashboard",
              details: { 
                investorDashboardStatus: investorDashboard.status,
                severity: "HIGH"
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Production company portal isolation working correctly",
            details: {
              productionDashboard: "accessible",
              creatorDashboard: "blocked",
              investorDashboard: "blocked"
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Production company access control test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "unauthenticated_access_control",
      name: "Unauthenticated users cannot access protected endpoints",
      description: "Verify that protected endpoints require authentication",
      category: "security",
      priority: "critical",
      timeout: 10000,
      test: async () => {
        const protectedEndpoints = [
          `${LOCAL_CONFIG.backend}/api/creator/dashboard`,
          `${LOCAL_CONFIG.backend}/api/investor/dashboard`,
          `${LOCAL_CONFIG.backend}/api/production/dashboard`,
          `${LOCAL_CONFIG.backend}/api/pitches`,
          `${LOCAL_CONFIG.backend}/api/ndas`,
          `${LOCAL_CONFIG.backend}/api/investments`,
          `${LOCAL_CONFIG.backend}/api/auth/session`
        ];

        try {
          const results = [];

          for (const endpoint of protectedEndpoints) {
            const response = await fetch(endpoint, {
              method: "GET"
              // No credentials included - testing unauthenticated access
            });

            const endpointName = endpoint.split("/").pop();
            
            if (response.ok) {
              results.push({
                endpoint: endpointName,
                status: "SECURITY ISSUE - ACCESSIBLE",
                httpStatus: response.status
              });
            } else if (response.status === 401 || response.status === 403) {
              results.push({
                endpoint: endpointName,
                status: "PROPERLY PROTECTED",
                httpStatus: response.status
              });
            } else {
              results.push({
                endpoint: endpointName,
                status: "UNEXPECTED STATUS",
                httpStatus: response.status
              });
            }
          }

          const securityIssues = results.filter(r => r.status.includes("SECURITY ISSUE"));
          const unexpectedStatuses = results.filter(r => r.status.includes("UNEXPECTED"));

          if (securityIssues.length > 0) {
            return {
              success: false,
              duration: 0,
              message: `CRITICAL SECURITY ISSUES: ${securityIssues.length} endpoints accessible without authentication`,
              details: {
                securityIssues,
                unexpectedStatuses,
                allResults: results
              }
            };
          }

          if (unexpectedStatuses.length > 0) {
            return {
              success: false,
              duration: 0,
              message: `Unexpected HTTP status codes from protected endpoints`,
              details: {
                unexpectedStatuses,
                allResults: results
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "All protected endpoints properly require authentication",
            details: {
              endpointsTested: protectedEndpoints.length,
              allProperlySecured: true,
              results
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Unauthenticated access control test failed: ${error.message}`,
            error
          };
        }
      }
    },

    {
      id: "cross_user_data_access",
      name: "Users cannot access other users' private data",
      description: "Verify users can only access their own data",
      category: "security",
      priority: "critical",
      timeout: 20000,
      test: async () => {
        const [user1, user2] = LOCAL_CONFIG.demoUsers;
        
        try {
          // Login as first user
          const login1Response = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: user1.email,
              password: user1.password
            })
          });

          if (!login1Response.ok) {
            return {
              success: false,
              duration: 0,
              message: "First user login failed",
              details: { user1LoginStatus: login1Response.status }
            };
          }

          // Get user1's profile
          const profile1Response = await fetch(`${LOCAL_CONFIG.backend}/api/auth/session`, {
            method: "GET",
            credentials: "include"
          });

          if (!profile1Response.ok) {
            return {
              success: false,
              duration: 0,
              message: "Cannot get first user's profile",
              details: { profile1Status: profile1Response.status }
            };
          }

          const profile1Data = await profile1Response.json();
          const user1Id = profile1Data.user?.id || profile1Data.user?.userId;

          // Logout user1
          await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-out`, {
            method: "POST",
            credentials: "include"
          });

          // Login as second user
          const login2Response = await fetch(`${LOCAL_CONFIG.backend}/api/auth/sign-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: user2.email,
              password: user2.password
            })
          });

          if (!login2Response.ok) {
            return {
              success: false,
              duration: 0,
              message: "Second user login failed",
              details: { user2LoginStatus: login2Response.status }
            };
          }

          // Try to access user1's data as user2 (should fail)
          const attemptedDataAccess = await fetch(`${LOCAL_CONFIG.backend}/api/users/${user1Id}`, {
            method: "GET",
            credentials: "include"
          });

          if (attemptedDataAccess.ok) {
            return {
              success: false,
              duration: 0,
              message: "CRITICAL SECURITY ISSUE: User can access another user's private data",
              details: { 
                attemptedAccessStatus: attemptedDataAccess.status,
                severity: "CRITICAL",
                user1Id,
                user2Email: user2.email
              }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Cross-user data access properly blocked",
            details: {
              dataAccessBlocked: true,
              user1Id,
              user2Email: user2.email
            }
          };

        } catch (error) {
          return {
            success: false,
            duration: 0,
            message: `Cross-user data access test failed: ${error.message}`,
            error
          };
        }
      }
    }
  ]
};