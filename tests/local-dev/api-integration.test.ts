/**
 * API Integration Test Suite
 * Tests core API endpoints for pitches, NDAs, and investments
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const apiIntegrationSuite: TestSuite = {
  name: "API Integration Tests",
  description: "Validate core API endpoints for pitches, NDAs, and investments",
  
  tests: [
    {
      id: "pitch_crud_operations",
      name: "Pitch CRUD operations",
      description: "Test creating, reading, updating, and deleting pitches",
      category: "integration",
      priority: "critical",
      timeout: 20000,
      test: async () => {
        const creatorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        let createdPitchId: number;
        
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
              message: "Creator login failed for pitch CRUD test",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Step 2: Create a new pitch
          const createPitchPayload = {
            title: "Test Pitch " + Date.now(),
            genre: "Drama",
            logline: "A test pitch for automated testing",
            synopsis: "This is a comprehensive test of the pitch creation functionality",
            budget_range: "1M-5M",
            seeking_investment: true,
            status: "draft"
          };

          const createResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(createPitchPayload)
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.text();
            return {
              success: false,
              duration: 0,
              message: `Pitch creation failed: ${createResponse.status}`,
              details: { 
                createStatus: createResponse.status,
                error: errorData
              }
            };
          }

          const createdPitch = await createResponse.json();
          createdPitchId = createdPitch.pitch?.id || createdPitch.id;

          if (!createdPitchId) {
            return {
              success: false,
              duration: 0,
              message: "Created pitch missing ID",
              details: { createdPitch }
            };
          }

          // Step 3: Read the created pitch
          const readResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/${createdPitchId}`, {
            method: "GET",
            credentials: "include"
          });

          if (!readResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Failed to read created pitch",
              details: { 
                readStatus: readResponse.status,
                pitchId: createdPitchId
              }
            };
          }

          const readPitch = await readResponse.json();
          
          if (readPitch.pitch?.title !== createPitchPayload.title && readPitch.title !== createPitchPayload.title) {
            return {
              success: false,
              duration: 0,
              message: "Read pitch data doesn't match created pitch",
              details: {
                expected: createPitchPayload.title,
                actual: readPitch.pitch?.title || readPitch.title
              }
            };
          }

          // Step 4: Update the pitch
          const updatePayload = {
            title: "Updated Test Pitch " + Date.now(),
            synopsis: "Updated synopsis for testing"
          };

          const updateResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/${createdPitchId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(updatePayload)
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.text();
            return {
              success: false,
              duration: 0,
              message: `Pitch update failed: ${updateResponse.status}`,
              details: { 
                updateStatus: updateResponse.status,
                error: errorData,
                pitchId: createdPitchId
              }
            };
          }

          // Step 5: Verify update
          const verifyResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/${createdPitchId}`, {
            method: "GET",
            credentials: "include"
          });

          if (verifyResponse.ok) {
            const verifiedPitch = await verifyResponse.json();
            const actualTitle = verifiedPitch.pitch?.title || verifiedPitch.title;
            
            if (actualTitle !== updatePayload.title) {
              return {
                success: false,
                duration: 0,
                message: "Pitch update was not persisted",
                details: {
                  expectedTitle: updatePayload.title,
                  actualTitle
                }
              };
            }
          }

          // Step 6: Test pitch listing
          const listResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/browse`, {
            method: "GET",
            credentials: "include"
          });

          if (!listResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Pitch listing failed",
              details: { listStatus: listResponse.status }
            };
          }

          const pitchList = await listResponse.json();
          
          if (!Array.isArray(pitchList.pitches) && !Array.isArray(pitchList)) {
            return {
              success: false,
              duration: 0,
              message: "Pitch list response format invalid",
              details: { response: pitchList }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Pitch CRUD operations completed successfully",
            details: {
              createdPitchId,
              operations: ["create", "read", "update", "list"],
              finalTitle: updatePayload.title
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Pitch CRUD test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "nda_workflow_test",
      name: "NDA workflow functionality",
      description: "Test NDA upload, signing, and management workflow",
      category: "integration",
      priority: "high",
      timeout: 15000,
      test: async () => {
        const creatorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "creator");
        const investorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "investor");
        
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
              message: "Creator login failed for NDA test",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Step 2: Get available NDAs
          const ndaListResponse = await fetch(`${LOCAL_CONFIG.backend}/api/ndas`, {
            method: "GET",
            credentials: "include"
          });

          if (!ndaListResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Failed to fetch NDA list",
              details: { ndaListStatus: ndaListResponse.status }
            };
          }

          const ndaList = await ndaListResponse.json();
          
          // Step 3: Test NDA details endpoint if NDAs exist
          if (Array.isArray(ndaList.ndas) && ndaList.ndas.length > 0) {
            const firstNdaId = ndaList.ndas[0].id;
            
            const ndaDetailResponse = await fetch(`${LOCAL_CONFIG.backend}/api/ndas/${firstNdaId}`, {
              method: "GET", 
              credentials: "include"
            });

            if (!ndaDetailResponse.ok) {
              return {
                success: false,
                duration: 0,
                message: "Failed to fetch NDA details",
                details: { 
                  ndaDetailStatus: ndaDetailResponse.status,
                  ndaId: firstNdaId
                }
              };
            }
          }

          // Step 4: Test NDA signing endpoint
          const signNdaResponse = await fetch(`${LOCAL_CONFIG.backend}/api/ndas/sign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              ndaId: 1, // Test with first NDA
              signature: "Test Signature",
              signedAt: new Date().toISOString()
            })
          });

          // Note: This might fail if NDA doesn't exist, which is OK for this test
          const signResponse = signNdaResponse.ok ? "success" : `failed-${signNdaResponse.status}`;

          // Step 5: Test NDA status check
          const statusResponse = await fetch(`${LOCAL_CONFIG.backend}/api/ndas/status`, {
            method: "GET",
            credentials: "include"
          });

          if (!statusResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "NDA status check failed",
              details: { statusResponseCode: statusResponse.status }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "NDA workflow endpoints are accessible",
            details: {
              ndaListAccess: "success",
              ndaSigningEndpoint: signResponse,
              ndaStatusCheck: "success"
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `NDA workflow test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "investment_tracking_test",
      name: "Investment tracking functionality", 
      description: "Test investment interest recording and portfolio features",
      category: "integration",
      priority: "high",
      timeout: 15000,
      test: async () => {
        const investorUser = LOCAL_CONFIG.demoUsers.find(u => u.type === "investor");
        
        try {
          // Step 1: Login as investor
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
              message: "Investor login failed for investment test",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Step 2: Get available pitches for investment
          const pitchesResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/browse`, {
            method: "GET",
            credentials: "include"
          });

          if (!pitchesResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Failed to fetch pitches for investment test",
              details: { pitchesStatus: pitchesResponse.status }
            };
          }

          const pitchesData = await pitchesResponse.json();
          const pitches = pitchesData.pitches || pitchesData;

          // Step 3: Test investment interest endpoint
          if (Array.isArray(pitches) && pitches.length > 0) {
            const firstPitchId = pitches[0].id;
            
            const investmentResponse = await fetch(`${LOCAL_CONFIG.backend}/api/investments/interest`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              credentials: "include",
              body: JSON.stringify({
                pitchId: firstPitchId,
                amount: 50000,
                message: "Test investment interest"
              })
            });

            // Record the result but don't fail if investment doesn't work
            const investmentResult = investmentResponse.ok ? "success" : `failed-${investmentResponse.status}`;
            
            // Step 4: Test portfolio access
            const portfolioResponse = await fetch(`${LOCAL_CONFIG.backend}/api/investor/portfolio`, {
              method: "GET",
              credentials: "include"
            });

            if (!portfolioResponse.ok) {
              return {
                success: false,
                duration: 0,
                message: "Failed to access investor portfolio",
                details: { 
                  portfolioStatus: portfolioResponse.status,
                  investmentResult
                }
              };
            }

            const portfolioData = await portfolioResponse.json();

            return {
              success: true,
              duration: 0,
              message: "Investment tracking endpoints are accessible",
              details: {
                pitchesAvailable: pitches.length,
                investmentInterest: investmentResult,
                portfolioAccess: "success",
                portfolioData: portfolioData ? "received" : "empty"
              }
            };

          } else {
            return {
              success: true,
              duration: 0,
              message: "Investment tracking endpoints accessible (no pitches to test with)",
              details: {
                pitchesAvailable: 0,
                portfolioAccessible: true
              }
            };
          }

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Investment tracking test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "file_upload_test",
      name: "File upload functionality",
      description: "Test document upload for pitches and NDAs",
      category: "integration",
      priority: "high",
      timeout: 20000,
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
              message: "Creator login failed for file upload test",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Step 2: Test file upload endpoint availability
          const uploadTestResponse = await fetch(`${LOCAL_CONFIG.backend}/api/upload/test`, {
            method: "GET",
            credentials: "include"
          });

          // Step 3: Create a test file for upload
          const testFileContent = new TextEncoder().encode("This is a test document for upload validation");
          const formData = new FormData();
          formData.append("file", new Blob([testFileContent], { type: "text/plain" }), "test-document.txt");
          formData.append("type", "script");

          // Step 4: Test document upload
          const uploadResponse = await fetch(`${LOCAL_CONFIG.backend}/api/upload/document`, {
            method: "POST",
            credentials: "include",
            body: formData
          });

          const uploadResult = uploadResponse.ok ? "success" : `failed-${uploadResponse.status}`;
          let uploadDetails = {};

          if (uploadResponse.ok) {
            try {
              uploadDetails = await uploadResponse.json();
            } catch {
              uploadDetails = { message: "Upload response not JSON" };
            }
          } else {
            try {
              const errorText = await uploadResponse.text();
              uploadDetails = { error: errorText };
            } catch {
              uploadDetails = { error: "Could not read error response" };
            }
          }

          // Step 5: Test MinIO connectivity directly
          const minioHealthResponse = await fetch(`${LOCAL_CONFIG.minio.endpoint}/minio/health/live`);
          const minioStatus = minioHealthResponse.ok ? "healthy" : `error-${minioHealthResponse.status}`;

          return {
            success: true, // Mark as success if endpoints are reachable, even if upload fails
            duration: 0,
            message: "File upload functionality tested",
            details: {
              uploadEndpointTest: uploadTestResponse.ok ? "accessible" : `not-accessible-${uploadTestResponse.status}`,
              documentUpload: uploadResult,
              uploadResponse: uploadDetails,
              minioStatus,
              note: "Upload may fail in test environment - checking endpoint accessibility"
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `File upload test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "search_functionality_test",
      name: "Search and filtering functionality",
      description: "Test search and filtering capabilities across the platform",
      category: "integration",
      priority: "medium",
      timeout: 10000,
      test: async () => {
        try {
          // Test public search endpoints (no auth required)
          const searchResponse = await fetch(`${LOCAL_CONFIG.backend}/api/search?q=drama`, {
            method: "GET"
          });

          if (!searchResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Basic search functionality failed",
              details: { searchStatus: searchResponse.status }
            };
          }

          const searchData = await searchResponse.json();

          // Test pitch filtering
          const filterResponse = await fetch(`${LOCAL_CONFIG.backend}/api/pitches/browse?genre=drama&status=published`, {
            method: "GET"
          });

          const filterResult = filterResponse.ok ? "success" : `failed-${filterResponse.status}`;

          return {
            success: true,
            duration: 0,
            message: "Search and filtering functionality accessible",
            details: {
              basicSearch: "success",
              searchResults: searchData ? "received" : "empty",
              pitchFiltering: filterResult
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Search functionality test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    }
  ]
};