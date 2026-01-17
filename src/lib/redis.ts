// Redis TypeScript stub for Worker environment
export const redis = {
  async get(key: string): Promise<string | null> {
    return null;
  },
  
  async set(key: string, value: string, options?: any): Promise<string> {
    return 'OK';
  },

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return 'OK';
  },
  
  async del(key: string): Promise<number> {
    return 1;
  },
  
  async expire(key: string, seconds: number): Promise<number> {
    return 1;
  },
  
  async ttl(key: string): Promise<number> {
    return -1;
  },
  
  async keys(pattern: string): Promise<string[]> {
    return [];
  },
  
  async flushall(): Promise<string> {
    return 'OK';
  },
  
  async ping(): Promise<string> {
    return 'PONG';
  }
};

export const getRedis = () => redis;