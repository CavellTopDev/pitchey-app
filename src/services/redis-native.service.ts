/**
 * Mock Native Redis Service
 * Placeholder for local Redis connection functionality
 */

export const nativeRedisService = {
  connect: async () => false,
  isEnabled: () => false,
  set: async (key: string, value: any, ttl?: number) => {},
  get: async (key: string) => null,
  del: async (key: string) => {},
  deleteByPattern: async (pattern: string) => {},
  expire: async (key: string, seconds: number) => {},
  incr: async (key: string) => {},
  keys: async (pattern: string) => [],
  getStats: () => ({
    operations: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    uptime: 0
  })
};
