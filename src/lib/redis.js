// Redis stub for Worker environment
// In production, use KV or Upstash Redis

class RedisStub {
  async get(key) {
    return null;
  }
  
  async set(key, value, options) {
    return 'OK';
  }
  
  async del(key) {
    return 1;
  }
  
  async expire(key, seconds) {
    return 1;
  }
  
  async ttl(key) {
    return -1;
  }
  
  async keys(pattern) {
    return [];
  }
  
  async flushall() {
    return 'OK';
  }
  
  async ping() {
    return 'PONG';
  }
}

export const redis = new RedisStub();
export const getRedis = () => redis;