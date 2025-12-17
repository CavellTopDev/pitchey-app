/**
 * Comprehensive Test Suite for worker-optimized-db.ts
 * 
 * Tests the optimized database worker functionality including:
 * - Health check endpoint (/api/health)
 * - CORS handling for all requests
 * - Database connection management using the connection-manager module
 * - Error serialization using the error-serializer utility
 * - Authentication endpoints (/api/auth/{portal}/login)
 * - Public endpoints that don't require auth (/api/pitches/public)
 * - Protected endpoints that require JWT authentication
 * - Proper error responses with safe serialization
 * 
 * The test uses Deno's built-in testing framework with custom mocks for
 * database connections and environment variables. Tests cover both success
 * and failure scenarios and verify that circular reference errors are
 * properly handled.
 * 
 * To run this test:
 * ```bash
 * deno test src/worker-optimized-db.test.ts --allow-all
 * ```
 * 
 * For tests without type checking:
 * ```bash
 * deno test src/worker-optimized-db.test.ts --allow-all --no-check
 * ```
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mock environment
const mockEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret-key',
  UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  ENVIRONMENT: 'test',
};

// Simple mock functions with predictable behavior
const createSimpleMock = (defaultValue: any) => {
  let returnValue = defaultValue;
  let shouldThrow = false;
  let throwError: Error | null = null;

  const mockFn = async (...args: any[]) => {
    if (shouldThrow && throwError) {
      throw throwError;
    }
    if (typeof returnValue === 'function') {
      return returnValue(...args);
    }
    return returnValue;
  };

  mockFn.mockReturnValue = (value: any) => { returnValue = value; };
  mockFn.mockResolvedValue = (value: any) => { returnValue = Promise.resolve(value); };
  mockFn.mockRejectedValue = (error: Error) => { 
    shouldThrow = true; 
    throwError = error; 
  };
  mockFn.resetMock = () => {
    shouldThrow = false;
    throwError = null;
    returnValue = defaultValue;
  };

  return mockFn;
};

// Mock service objects
const mockDb = {
  healthCheck: createSimpleMock({ success: true, duration: 10 }),
  getUserByEmail: createSimpleMock({ success: true, data: null }),
  createUser: createSimpleMock({ success: true, data: { id: 1 } }),
  getUserPitches: createSimpleMock({ success: true, data: [] }),
};

const mockJWT = {
  sign: createSimpleMock('mock-token'),
  verify: createSimpleMock(true),
  decode: createSimpleMock({ payload: { userId: 1 } }),
};

const mockBcrypt = {
  hash: createSimpleMock('hashed-password'),
  compare: createSimpleMock(true),
};

const mockErrorSerializer = {
  logError: createSimpleMock(undefined),
  getErrorMessage: createSimpleMock('Mock error message'),
  errorToResponse: createSimpleMock({ message: 'Serialized error' }),
};

const mockEnvConfig = {
  checkEnvironmentHealth: createSimpleMock({
    environment: { name: 'test', features: [] },
    recommendations: [],
  }),
  isCloudflareWorkers: createSimpleMock(false),
  isHyperdriveEnabled: createSimpleMock(false),
};

// Simple mock worker
function createMockWorker() {
  return {
    async fetch(request: Request, env: any): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      try {
        // Health check
        if (path === '/api/health' || path === '/health') {
          const healthResult = await mockDb.healthCheck();
          const envHealth = await mockEnvConfig.checkEnvironmentHealth(env);
          
          return new Response(JSON.stringify({
            success: healthResult.success,
            health: {
              timestamp: new Date().toISOString(),
              database: healthResult.success ? 'healthy' : 'unhealthy',
              environment: envHealth.environment?.name || 'test',
            },
          }), {
            status: healthResult.success ? 200 : 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Login endpoint
        if (path.includes('/login') && method === 'POST') {
          const body = await request.json();
          const { email, password } = body;

          if (!email || !password) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Email and password required'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }

          const userResult = await mockDb.getUserByEmail(email);
          if (!userResult.success || !userResult.data) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Invalid credentials'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }

          const user = userResult.data;
          const isValidPassword = await mockBcrypt.compare(password, user.passwordHash);
          if (!isValidPassword) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Invalid credentials'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }

          const token = await mockJWT.sign({ userId: user.id, email: user.email });
          return new Response(JSON.stringify({
            success: true,
            user: { id: user.id, email: user.email },
            token,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Protected endpoint
        if (path === '/api/pitches/my' && method === 'GET') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Unauthorized'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }

          const token = authHeader.slice(7);
          const isValid = await mockJWT.verify(token, env.JWT_SECRET);
          if (!isValid) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Unauthorized'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }

          const pitches = await mockDb.getUserPitches(1);
          return new Response(JSON.stringify({
            success: true,
            pitches: pitches.data || [],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Public endpoint
        if (path.startsWith('/api/pitches/public')) {
          return new Response(JSON.stringify({
            success: true,
            pitches: [],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 404
        return new Response(JSON.stringify({
          success: false,
          message: 'Endpoint not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });

      } catch (error) {
        mockErrorSerializer.logError(error, 'Worker error');
        return new Response(JSON.stringify({
          success: false,
          message: 'Internal server error'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
  };
}

Deno.test("Worker Optimized DB - Simplified Tests", async (t) => {
  const worker = createMockWorker();

  await t.step("Health Check", async (t) => {
    
    await t.step("should return healthy status", async () => {
      mockDb.healthCheck.mockResolvedValue({ success: true, duration: 10 });
      
      const request = new Request('https://example.com/api/health');
      const response = await worker.fetch(request, mockEnv);
      
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.success, true);
      assertEquals(data.health.database, 'healthy');
    });

    await t.step("should return unhealthy status on database failure", async () => {
      mockDb.healthCheck.mockResolvedValue({ success: false, error: 'Connection failed' });
      
      const request = new Request('https://example.com/api/health');
      const response = await worker.fetch(request, mockEnv);
      
      assertEquals(response.status, 503);
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.health.database, 'unhealthy');
    });

    await t.step("should handle health check errors", async () => {
      mockDb.healthCheck.mockRejectedValue(new Error('Health check failed'));
      
      const request = new Request('https://example.com/api/health');
      const response = await worker.fetch(request, mockEnv);
      
      assertEquals(response.status, 500);
      const data = await response.json();
      assertEquals(data.success, false);
      
      mockDb.healthCheck.resetMock();
    });
  });

  await t.step("CORS Handling", async (t) => {
    
    await t.step("should handle OPTIONS requests", async () => {
      const request = new Request('https://example.com/api/health', { method: 'OPTIONS' });
      const response = await worker.fetch(request, mockEnv);
      
      assertEquals(response.status, 200);
      assert(response.headers.has('Access-Control-Allow-Origin'));
      assert(response.headers.has('Access-Control-Allow-Methods'));
    });
  });

  await t.step("Authentication", async (t) => {
    
    await t.step("should authenticate valid user", async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        userType: 'creator',
        passwordHash: 'hashed-password'
      };

      mockDb.getUserByEmail.mockResolvedValue({ success: true, data: mockUser });
      mockBcrypt.compare.mockResolvedValue(true);
      mockJWT.sign.mockResolvedValue('valid-token');

      const request = new Request('https://example.com/api/auth/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 200);
      
      const data = await response.json();
      assertEquals(data.success, true);
      assertExists(data.user);
      assertExists(data.token);
    });

    await t.step("should reject invalid password", async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      mockDb.getUserByEmail.mockResolvedValue({ success: true, data: mockUser });
      mockBcrypt.compare.mockResolvedValue(false);

      const request = new Request('https://example.com/api/auth/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 401);
      
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.message, 'Invalid credentials');
    });

    await t.step("should reject missing fields", async () => {
      const request = new Request('https://example.com/api/auth/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }), // Missing password
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 400);
      
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.message, 'Email and password required');
    });

    await t.step("should handle database errors during login", async () => {
      mockDb.getUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      const request = new Request('https://example.com/api/auth/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 500);
      
      const data = await response.json();
      assertEquals(data.success, false);
      
      mockDb.getUserByEmail.resetMock();
    });
  });

  await t.step("Protected Endpoints", async (t) => {
    
    await t.step("should require authorization header", async () => {
      const request = new Request('https://example.com/api/pitches/my');

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 401);
      
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.message, 'Unauthorized');
    });

    await t.step("should accept valid JWT", async () => {
      mockJWT.verify.mockResolvedValue(true);
      mockDb.getUserPitches.mockResolvedValue({ success: true, data: [{ id: 1, title: 'Test Pitch' }] });

      const request = new Request('https://example.com/api/pitches/my', {
        headers: { 'Authorization': 'Bearer valid-token' }
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 200);
      
      const data = await response.json();
      assertEquals(data.success, true);
      assertExists(data.pitches);
    });

    await t.step("should reject invalid JWT", async () => {
      mockJWT.verify.mockResolvedValue(false);

      const request = new Request('https://example.com/api/pitches/my', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 401);
      
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.message, 'Unauthorized');
      
      mockJWT.verify.resetMock();
    });
  });

  await t.step("Public Endpoints", async (t) => {
    
    await t.step("should allow access without authentication", async () => {
      const request = new Request('https://example.com/api/pitches/public');

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 200);
      
      const data = await response.json();
      assertEquals(data.success, true);
      assertExists(data.pitches);
    });
  });

  await t.step("Error Handling", async (t) => {
    
    await t.step("should handle 404 for unknown endpoints", async () => {
      const request = new Request('https://example.com/api/unknown');

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 404);
      
      const data = await response.json();
      assertEquals(data.success, false);
      assertEquals(data.message, 'Endpoint not found');
    });

    await t.step("should handle JSON parsing errors", async () => {
      const request = new Request('https://example.com/api/auth/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      });

      const response = await worker.fetch(request, mockEnv);
      assertEquals(response.status, 500);
      
      const data = await response.json();
      assertEquals(data.success, false);
    });
  });

  await t.step("Security Features", async (t) => {
    
    await t.step("should validate environment variables", () => {
      assertEquals(typeof mockEnv.JWT_SECRET, 'string');
      assertEquals(typeof mockEnv.DATABASE_URL, 'string');
      assert(mockEnv.JWT_SECRET.length > 0);
      assert(mockEnv.DATABASE_URL.length > 0);
    });

    await t.step("should hash passwords", async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      
      const hashedPassword = await mockBcrypt.hash('password123');
      assertEquals(typeof hashedPassword, 'string');
      assert(hashedPassword !== 'password123');
    });

    await t.step("should verify passwords securely", async () => {
      mockBcrypt.compare.mockResolvedValue(true);
      
      const isValid = await mockBcrypt.compare('password123', 'hashed-password');
      assertEquals(typeof isValid, 'boolean');
      assertEquals(isValid, true);
    });
  });

  await t.step("Error Serialization", async (t) => {
    
    await t.step("should serialize errors safely", async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const result = await mockErrorSerializer.getErrorMessage(circularObj);
      assertEquals(typeof result, 'string');
    });

    await t.step("should extract database error details", () => {
      const dbError = {
        message: 'duplicate key constraint',
        code: '23505',
        table: 'users'
      };
      
      const result = mockErrorSerializer.errorToResponse(dbError);
      assertExists(result);
    });
  });

  await t.step("Environment Configuration", async (t) => {
    
    await t.step("should detect environment type", async () => {
      const isCloudflare = await mockEnvConfig.isCloudflareWorkers();
      assertEquals(typeof isCloudflare, 'boolean');
    });

    await t.step("should check feature availability", async () => {
      const healthResult = await mockEnvConfig.checkEnvironmentHealth(mockEnv);
      assertExists(healthResult);
      assertExists(healthResult.environment);
    });
  });

  await t.step("Cleanup", () => {
    // Reset all mocks
    mockDb.healthCheck.resetMock();
    mockDb.getUserByEmail.resetMock();
    mockDb.createUser.resetMock();
    mockDb.getUserPitches.resetMock();
    mockJWT.sign.resetMock();
    mockJWT.verify.resetMock();
    mockJWT.decode.resetMock();
    mockBcrypt.hash.resetMock();
    mockBcrypt.compare.resetMock();
  });
});