/**
 * Vitest Test Setup File
 * 
 * Global configuration and setup for all tests in the workflow test suite.
 * This file is run before every test file.
 */

import { beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Global Test Setup
// ============================================================================

// Mock global objects available in Cloudflare Workers
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => `test-uuid-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    getRandomValues: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  },
  writable: true
});

// Mock console methods to reduce noise during tests (optional)
const originalConsole = { ...console };

// Global mock for Neon database client
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn().mockResolvedValue(undefined))
}));

// ============================================================================
// Before/After Hooks
// ============================================================================

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset timers if any tests use them
  vi.clearAllTimers();
  
  // Set up fresh Date mock if needed
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  
  // Reset fetch mock
  global.fetch = vi.fn();
  
  // Reset any environment variables
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
  
  // Clear any pending timers
  vi.clearAllTimers();
  
  // Restore console if it was mocked
  Object.assign(console, originalConsole);
});

// ============================================================================
// Global Test Utilities
// ============================================================================

// Utility function to create consistent test timestamps
export const createTestTimestamp = (offsetDays: number = 0): string => {
  const baseDate = new Date('2024-01-15T10:00:00.000Z');
  baseDate.setDate(baseDate.getDate() + offsetDays);
  return baseDate.toISOString();
};

// Utility function to create test UUIDs with predictable patterns
export const createTestUUID = (prefix: string = 'test'): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Utility function to simulate async delays in tests
export const simulateDelay = (ms: number = 100): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Utility function to create mock workflow step
export const createMockWorkflowStep = (overrides: any = {}) => {
  return {
    do: vi.fn().mockImplementation((name, fn) => fn()),
    waitForEvent: vi.fn(),
    sleep: vi.fn(),
    ...overrides
  };
};

// Utility function to create mock workflow environment
export const createMockWorkflowEnv = (overrides: any = {}) => {
  return {
    HYPERDRIVE: {
      connectionString: 'postgresql://test@localhost/test'
    },
    WORKFLOW_INSTANCE_ID: createTestUUID('workflow'),
    NOTIFICATION_QUEUE: {
      send: vi.fn().mockResolvedValue({ messageId: 'msg_test', status: 'sent' })
    },
    DOCUMENTS: {
      put: vi.fn().mockResolvedValue({ url: 'https://test.com/doc', etag: 'test-etag' }),
      get: vi.fn().mockResolvedValue('{"test": "content"}')
    },
    CONTRACTS: {
      put: vi.fn().mockResolvedValue({ url: 'https://test.com/contract' }),
      get: vi.fn().mockResolvedValue('{"contract": "content"}')
    },
    NDA_TEMPLATES: {
      get: vi.fn().mockResolvedValue({ type: 'standard', clauses: ['test'] })
    },
    DEAL_CACHE: {
      put: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(null)
    },
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    DATABASE_URL: 'postgresql://test@localhost/test',
    JWT_SECRET: 'test-secret',
    FRONTEND_URL: 'http://localhost:5173',
    ...overrides
  };
};

// Utility function to create test database responses
export const createMockDbResponse = (data: any[] = []) => {
  return vi.fn().mockResolvedValue(data);
};

// ============================================================================
// Test Data Factories
// ============================================================================

export const TestDataFactory = {
  // Create test user data
  createUser: (overrides: any = {}) => ({
    id: createTestUUID('user'),
    email: 'test@example.com',
    name: 'Test User',
    email_verified: true,
    phone_verified: true,
    identity_verified: true,
    trust_score: 85,
    created_at: createTestTimestamp(-90),
    ...overrides
  }),

  // Create test pitch data
  createPitch: (overrides: any = {}) => ({
    id: createTestUUID('pitch'),
    title: 'Test Movie Pitch',
    creator_id: createTestUUID('creator'),
    funding_goal: 1000000,
    current_funding: 0,
    status: 'active',
    created_at: createTestTimestamp(-30),
    ...overrides
  }),

  // Create test investment deal data
  createInvestmentDeal: (overrides: any = {}) => ({
    investorId: createTestUUID('investor'),
    pitchId: createTestUUID('pitch'),
    amount: 100000,
    investorType: 'accredited',
    investorEmail: 'investor@test.com',
    creatorId: createTestUUID('creator'),
    creatorEmail: 'creator@test.com',
    pitchTitle: 'Test Investment Pitch',
    minimumInvestment: 50000,
    maximumInvestment: 500000,
    targetRaise: 1000000,
    ...overrides
  }),

  // Create test production deal data
  createProductionDeal: (overrides: any = {}) => ({
    productionCompanyId: createTestUUID('prod'),
    productionCompanyUserId: createTestUUID('prod-user'),
    pitchId: createTestUUID('pitch'),
    creatorId: createTestUUID('creator'),
    interestType: 'option' as const,
    message: 'Test production interest',
    proposedBudget: 2000000,
    proposedTimeline: '18 months',
    ...overrides
  }),

  // Create test NDA data
  createNDARequest: (overrides: any = {}) => ({
    requesterId: createTestUUID('requester'),
    requesterType: 'investor' as const,
    requesterEmail: 'requester@test.com',
    requesterName: 'Test Requester',
    creatorId: createTestUUID('creator'),
    pitchId: createTestUUID('pitch'),
    templateId: 'standard_nda_v1',
    durationMonths: 24,
    ...overrides
  })
};

// ============================================================================
// Custom Test Matchers (if needed)
// ============================================================================

// Add any custom matchers here
// Example:
// expect.extend({
//   toBeValidUUID(received: string) {
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//     const pass = uuidRegex.test(received);
//     
//     return {
//       message: () => `expected ${received} to ${pass ? 'not ' : ''}be a valid UUID`,
//       pass,
//     };
//   },
// });

// ============================================================================
// Global Error Handling for Tests
// ============================================================================

// Catch unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// ============================================================================
// Test Environment Information
// ============================================================================

console.log(`🧪 Test Environment Initialized
- Node Version: ${process.version}
- Test Framework: Vitest
- Environment: ${process.env.NODE_ENV}
- Timestamp: ${new Date().toISOString()}
`);

// Export utilities for use in individual test files
export default {
  createTestTimestamp,
  createTestUUID,
  simulateDelay,
  createMockWorkflowStep,
  createMockWorkflowEnv,
  createMockDbResponse,
  TestDataFactory
};