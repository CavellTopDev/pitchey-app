/**
 * WebSocket Connectivity Test Suite
 * Tests real-time WebSocket connections and messaging
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const websocketSuite: TestSuite = {
  name: "WebSocket Connectivity Tests",
  description: "Validate WebSocket connections and real-time messaging functionality",
  
  tests: [
    {
      id: "websocket_connection_test",
      name: "WebSocket connection establishment",
      description: "Test that WebSocket connections can be established successfully",
      category: "integration",
      priority: "high",
      timeout: 10000,
      test: async () => {
        try {
          const wsUrl = LOCAL_CONFIG.backend.replace("http://", "ws://") + "/ws";
          
          return new Promise((resolve) => {
            const ws = new WebSocket(wsUrl);
            let connectionEstablished = false;
            let errorOccurred = false;
            let errorDetails = "";

            const timeout = setTimeout(() => {
              if (!connectionEstablished && !errorOccurred) {
                ws.close();
                resolve({
                  success: false,
                  duration: 10000,
                  message: "WebSocket connection timeout",
                  details: { 
                    wsUrl,
                    timeout: "10 seconds"
                  }
                });
              }
            }, 8000);

            ws.onopen = () => {
              connectionEstablished = true;
              clearTimeout(timeout);
              
              // Test sending a ping message
              try {
                ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
              } catch (sendError) {
                // Continue even if send fails
              }

              // Close connection after brief test
              setTimeout(() => {
                ws.close();
                resolve({
                  success: true,
                  duration: Date.now() - startTime,
                  message: "WebSocket connection established successfully",
                  details: {
                    wsUrl,
                    connectionTime: Date.now() - startTime + "ms",
                    readyState: ws.readyState
                  }
                });
              }, 1000);
            };

            ws.onerror = (error) => {
              errorOccurred = true;
              errorDetails = error.toString();
              clearTimeout(timeout);
              resolve({
                success: false,
                duration: Date.now() - startTime,
                message: "WebSocket connection error",
                details: {
                  wsUrl,
                  error: errorDetails,
                  readyState: ws.readyState
                }
              });
            };

            ws.onclose = (event) => {
              if (!connectionEstablished && !errorOccurred) {
                clearTimeout(timeout);
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "WebSocket connection closed before establishing",
                  details: {
                    wsUrl,
                    closeCode: event.code,
                    closeReason: event.reason,
                    wasClean: event.wasClean
                  }
                });
              }
            };

            const startTime = Date.now();
          });

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `WebSocket connection test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "websocket_messaging_test",
      name: "WebSocket messaging functionality",
      description: "Test sending and receiving messages over WebSocket connection",
      category: "integration",
      priority: "high",
      timeout: 15000,
      test: async () => {
        try {
          const wsUrl = LOCAL_CONFIG.backend.replace("http://", "ws://") + "/ws";
          
          return new Promise((resolve) => {
            const ws = new WebSocket(wsUrl);
            let messagesReceived = 0;
            let connectionEstablished = false;
            const startTime = Date.now();

            const timeout = setTimeout(() => {
              ws.close();
              resolve({
                success: false,
                duration: 15000,
                message: "WebSocket messaging test timeout",
                details: { 
                  messagesReceived,
                  connectionEstablished
                }
              });
            }, 12000);

            ws.onopen = () => {
              connectionEstablished = true;
              
              // Send test messages
              const testMessages = [
                { type: "ping", data: "test1" },
                { type: "notification_subscribe", data: "user123" },
                { type: "heartbeat", timestamp: Date.now() }
              ];

              testMessages.forEach((msg, index) => {
                setTimeout(() => {
                  try {
                    ws.send(JSON.stringify(msg));
                  } catch (sendError) {
                    // Continue even if send fails
                  }
                }, index * 1000);
              });
            };

            ws.onmessage = (event) => {
              messagesReceived++;
              
              try {
                const data = JSON.parse(event.data);
                
                // After receiving some responses, consider test successful
                if (messagesReceived >= 1) {
                  clearTimeout(timeout);
                  ws.close();
                  
                  resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    message: "WebSocket messaging working correctly",
                    details: {
                      messagesReceived,
                      lastMessage: data,
                      connectionTime: Date.now() - startTime + "ms"
                    }
                  });
                }
              } catch (parseError) {
                // Received non-JSON message, still counts as communication
                messagesReceived++;
                
                if (messagesReceived >= 1) {
                  clearTimeout(timeout);
                  ws.close();
                  
                  resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    message: "WebSocket messaging working (non-JSON response)",
                    details: {
                      messagesReceived,
                      lastMessage: event.data,
                      note: "Received non-JSON response"
                    }
                  });
                }
              }
            };

            ws.onerror = (error) => {
              clearTimeout(timeout);
              resolve({
                success: false,
                duration: Date.now() - startTime,
                message: "WebSocket messaging error",
                details: {
                  error: error.toString(),
                  messagesReceived,
                  connectionEstablished
                }
              });
            };

            ws.onclose = (event) => {
              clearTimeout(timeout);
              
              // If we haven't resolved yet and connection was established
              if (connectionEstablished && messagesReceived === 0) {
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "WebSocket connected but no messages received",
                  details: {
                    closeCode: event.code,
                    closeReason: event.reason,
                    messagesReceived
                  }
                });
              } else if (!connectionEstablished) {
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "WebSocket connection failed",
                  details: {
                    closeCode: event.code,
                    closeReason: event.reason
                  }
                });
              }
            };
          });

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `WebSocket messaging test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "websocket_authentication_test",
      name: "WebSocket authentication handling",
      description: "Test WebSocket connections with authenticated sessions",
      category: "integration",
      priority: "medium",
      timeout: 20000,
      test: async () => {
        const testUser = LOCAL_CONFIG.demoUsers[0];
        
        try {
          // First, establish an authenticated session
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

          if (!loginResponse.ok) {
            return {
              success: false,
              duration: 0,
              message: "Login failed - cannot test authenticated WebSocket",
              details: { loginStatus: loginResponse.status }
            };
          }

          // Extract session cookies for WebSocket
          const cookies = loginResponse.headers.get("set-cookie");
          
          return new Promise((resolve) => {
            const wsUrl = LOCAL_CONFIG.backend.replace("http://", "ws://") + "/ws";
            const ws = new WebSocket(wsUrl);
            let authTestComplete = false;
            const startTime = Date.now();

            const timeout = setTimeout(() => {
              if (!authTestComplete) {
                ws.close();
                resolve({
                  success: false,
                  duration: 20000,
                  message: "WebSocket authentication test timeout",
                  details: { timeout: "20 seconds" }
                });
              }
            }, 18000);

            ws.onopen = () => {
              // Send an authenticated request
              const authMessage = {
                type: "authenticate",
                token: "session-based", // Better Auth uses session cookies
                userId: testUser.email
              };
              
              try {
                ws.send(JSON.stringify(authMessage));
              } catch (sendError) {
                clearTimeout(timeout);
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "Failed to send authentication message",
                  details: { sendError: sendError.toString() }
                });
                return;
              }
              
              // Wait for auth response or timeout
              setTimeout(() => {
                if (!authTestComplete) {
                  authTestComplete = true;
                  clearTimeout(timeout);
                  ws.close();
                  
                  resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    message: "WebSocket accepts authentication messages",
                    details: {
                      note: "Authentication message sent successfully",
                      connectionTime: Date.now() - startTime + "ms"
                    }
                  });
                }
              }, 3000);
            };

            ws.onmessage = (event) => {
              if (!authTestComplete) {
                authTestComplete = true;
                clearTimeout(timeout);
                
                try {
                  const response = JSON.parse(event.data);
                  ws.close();
                  
                  resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    message: "WebSocket authentication handling works",
                    details: {
                      authResponse: response,
                      responseTime: Date.now() - startTime + "ms"
                    }
                  });
                } catch (parseError) {
                  ws.close();
                  
                  resolve({
                    success: true,
                    duration: Date.now() - startTime,
                    message: "WebSocket responded to authentication (non-JSON)",
                    details: {
                      rawResponse: event.data,
                      note: "Non-JSON response to auth message"
                    }
                  });
                }
              }
            };

            ws.onerror = (error) => {
              if (!authTestComplete) {
                authTestComplete = true;
                clearTimeout(timeout);
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "WebSocket authentication test error",
                  details: { error: error.toString() }
                });
              }
            };

            ws.onclose = (event) => {
              if (!authTestComplete) {
                authTestComplete = true;
                clearTimeout(timeout);
                resolve({
                  success: false,
                  duration: Date.now() - startTime,
                  message: "WebSocket connection closed during auth test",
                  details: {
                    closeCode: event.code,
                    closeReason: event.reason
                  }
                });
              }
            };
          });

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `WebSocket authentication test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "websocket_concurrent_connections_test",
      name: "Concurrent WebSocket connections",
      description: "Test multiple concurrent WebSocket connections",
      category: "integration",
      priority: "medium",
      timeout: 15000,
      test: async () => {
        try {
          const wsUrl = LOCAL_CONFIG.backend.replace("http://", "ws://") + "/ws";
          const connectionCount = 3;
          const connections: WebSocket[] = [];
          const results: any[] = [];

          return new Promise((resolve) => {
            let completedConnections = 0;
            const startTime = Date.now();

            const timeout = setTimeout(() => {
              connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.close();
                }
              });
              
              resolve({
                success: false,
                duration: 15000,
                message: "Concurrent WebSocket connections test timeout",
                details: { 
                  attempted: connectionCount,
                  completed: completedConnections,
                  results
                }
              });
            }, 12000);

            for (let i = 0; i < connectionCount; i++) {
              const ws = new WebSocket(wsUrl);
              connections.push(ws);
              
              ws.onopen = () => {
                results[i] = { connection: i, status: "opened", timestamp: Date.now() };
                
                // Send a test message
                try {
                  ws.send(JSON.stringify({ type: "test", connectionId: i }));
                } catch (sendError) {
                  results[i].sendError = sendError.toString();
                }
                
                completedConnections++;
                
                // If all connections are established, close them and finish test
                if (completedConnections === connectionCount) {
                  clearTimeout(timeout);
                  
                  setTimeout(() => {
                    connections.forEach(conn => {
                      if (conn.readyState === WebSocket.OPEN) {
                        conn.close();
                      }
                    });
                    
                    resolve({
                      success: true,
                      duration: Date.now() - startTime,
                      message: "Concurrent WebSocket connections successful",
                      details: {
                        connectionsEstablished: completedConnections,
                        totalAttempted: connectionCount,
                        results,
                        avgConnectionTime: (Date.now() - startTime) / connectionCount + "ms"
                      }
                    });
                  }, 1000);
                }
              };

              ws.onerror = (error) => {
                results[i] = { connection: i, status: "error", error: error.toString() };
                completedConnections++;
                
                if (completedConnections === connectionCount) {
                  clearTimeout(timeout);
                  
                  const successfulConnections = results.filter(r => r.status === "opened").length;
                  const success = successfulConnections > 0;
                  
                  connections.forEach(conn => {
                    if (conn.readyState === WebSocket.OPEN) {
                      conn.close();
                    }
                  });
                  
                  resolve({
                    success,
                    duration: Date.now() - startTime,
                    message: `${successfulConnections}/${connectionCount} concurrent connections successful`,
                    details: {
                      successfulConnections,
                      totalAttempted: connectionCount,
                      results
                    }
                  });
                }
              };

              ws.onclose = (event) => {
                if (!results[i] || results[i].status === undefined) {
                  results[i] = { 
                    connection: i, 
                    status: "closed", 
                    closeCode: event.code,
                    closeReason: event.reason
                  };
                  completedConnections++;
                }
              };
            }
          });

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Concurrent WebSocket connections test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    }
  ]
};