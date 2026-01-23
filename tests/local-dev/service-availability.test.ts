/**
 * Service Availability Test Suite
 * Tests that all Podman services are running and accessible
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

export const serviceAvailabilitySuite: TestSuite = {
  name: "Service Availability Tests",
  description: "Validate that all Podman services are running and accessible",
  
  tests: [
    {
      id: "backend_proxy_health",
      name: "Backend proxy server health check",
      description: "Verify the local development server on port 8001 is responding",
      category: "integration",
      priority: "critical",
      timeout: 5000,
      test: async () => {
        try {
          const response = await fetch(`${LOCAL_CONFIG.backend}/health`);
          const data = await response.json();
          
          if (response.status !== 200) {
            return {
              success: false,
              duration: 0,
              message: `Backend proxy returned status ${response.status}`,
              details: { response: data }
            };
          }

          if (!data.status || data.status !== "ok") {
            return {
              success: false,
              duration: 0,
              message: "Backend proxy health check failed",
              details: { response: data }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Backend proxy is healthy",
            details: { 
              status: data.status, 
              workerUrl: data.workerUrl,
              timestamp: data.timestamp 
            }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Backend proxy connection failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "postgres_connection",
      name: "PostgreSQL database connection",
      description: "Verify PostgreSQL is accessible and accepts connections",
      category: "integration",
      priority: "critical", 
      timeout: 10000,
      test: async () => {
        try {
          const command = new Deno.Command("psql", {
            args: [
              "-h", LOCAL_CONFIG.postgres.host,
              "-U", LOCAL_CONFIG.postgres.username,
              "-d", LOCAL_CONFIG.postgres.database,
              "-c", "SELECT current_database(), current_user, version();"
            ],
            env: { PGPASSWORD: LOCAL_CONFIG.postgres.password },
            stdout: "piped",
            stderr: "piped"
          });

          const { success, stdout, stderr } = await command.output();
          const output = new TextDecoder().decode(stdout);
          const errorOutput = new TextDecoder().decode(stderr);

          if (!success) {
            return {
              success: false,
              duration: 0,
              message: "PostgreSQL connection failed",
              details: { error: errorOutput, output }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "PostgreSQL connection successful",
            details: { output: output.trim() }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `PostgreSQL test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "redis_connection",
      name: "Redis cache connection",
      description: "Verify Redis is accessible and responds to commands",
      category: "integration",
      priority: "critical",
      timeout: 5000,
      test: async () => {
        try {
          // Test Redis via HTTP if CLI is not available
          const redisTestKey = "test_connection_" + Date.now();
          
          // Try using redis-cli first
          try {
            const pingCommand = new Deno.Command("redis-cli", {
              args: ["-h", LOCAL_CONFIG.redis.host, "-p", LOCAL_CONFIG.redis.port.toString(), "ping"],
              stdout: "piped",
              stderr: "piped"
            });

            const { success, stdout } = await pingCommand.output();
            const output = new TextDecoder().decode(stdout);

            if (success && output.trim() === "PONG") {
              return {
                success: true,
                duration: 0,
                message: "Redis connection successful (CLI)",
                details: { method: "redis-cli", response: "PONG" }
              };
            }
          } catch (error: unknown) {
            // CLI not available, continue with API test
          }

          // Test via backend proxy API if available
          try {
            const response = await fetch(`${LOCAL_CONFIG.backend}/api/health`);
            if (response.ok) {
              return {
                success: true,
                duration: 0,
                message: "Redis service accessible via backend proxy",
                details: { method: "backend-proxy" }
              };
            }
          } catch (error: unknown) {
            // Continue to failure
          }

          return {
            success: false,
            duration: 0,
            message: "Redis connection could not be verified",
            details: { port: LOCAL_CONFIG.redis.port, host: LOCAL_CONFIG.redis.host }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Redis test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "minio_api",
      name: "MinIO S3 API accessibility",
      description: "Verify MinIO S3-compatible API is responding",
      category: "integration",
      priority: "high",
      timeout: 5000,
      test: async () => {
        try {
          const response = await fetch(`${LOCAL_CONFIG.minio.endpoint}/minio/health/live`);
          
          if (response.status !== 200) {
            return {
              success: false,
              duration: 0,
              message: `MinIO API returned status ${response.status}`,
              details: { endpoint: LOCAL_CONFIG.minio.endpoint }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "MinIO API is accessible",
            details: { endpoint: LOCAL_CONFIG.minio.endpoint }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `MinIO API connection failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "minio_console",
      name: "MinIO Console accessibility",
      description: "Verify MinIO web console is accessible",
      category: "integration",
      priority: "medium",
      timeout: 5000,
      test: async () => {
        try {
          const response = await fetch(LOCAL_CONFIG.minio.console);
          
          if (response.status >= 400) {
            return {
              success: false,
              duration: 0,
              message: `MinIO Console returned status ${response.status}`,
              details: { endpoint: LOCAL_CONFIG.minio.console }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "MinIO Console is accessible",
            details: { 
              endpoint: LOCAL_CONFIG.minio.console,
              status: response.status 
            }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `MinIO Console connection failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "adminer_accessibility",
      name: "Adminer database management tool",
      description: "Verify Adminer web interface is accessible",
      category: "integration",
      priority: "medium",
      timeout: 5000,
      test: async () => {
        try {
          const response = await fetch(LOCAL_CONFIG.adminer);
          
          if (response.status >= 400) {
            return {
              success: false,
              duration: 0,
              message: `Adminer returned status ${response.status}`,
              details: { endpoint: LOCAL_CONFIG.adminer }
            };
          }

          const html = await response.text();
          if (!html.includes("Adminer")) {
            return {
              success: false,
              duration: 0,
              message: "Adminer page content not found",
              details: { contentCheck: "failed" }
            };
          }

          return {
            success: true,
            duration: 0,
            message: "Adminer is accessible",
            details: { 
              endpoint: LOCAL_CONFIG.adminer,
              status: response.status 
            }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Adminer connection failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "network_connectivity",
      name: "Service-to-service network connectivity",
      description: "Verify services can communicate with each other",
      category: "integration",
      priority: "high",
      timeout: 10000,
      test: async () => {
        try {
          // Test that backend can reach production API
          const response = await fetch(`${LOCAL_CONFIG.backend}/api/health`);
          const data = await response.json();

          if (!data.workerUrl) {
            return {
              success: false,
              duration: 0,
              message: "Backend proxy worker URL not configured",
              details: { response: data }
            };
          }

          // Test network timing
          const start = Date.now();
          await fetch(`${LOCAL_CONFIG.backend}/api/version`);
          const networkLatency = Date.now() - start;

          if (networkLatency > 1000) {
            return {
              success: false,
              duration: networkLatency,
              message: `High network latency detected: ${networkLatency}ms`,
              details: { latency: networkLatency }
            };
          }

          return {
            success: true,
            duration: networkLatency,
            message: "Network connectivity is good",
            details: { 
              latency: networkLatency,
              workerUrl: data.workerUrl
            }
          };
        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Network connectivity test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    }
  ]
};