/**
 * CI/CD Environment Configuration
 * Optimized for automated testing in GitHub Actions, GitLab CI, etc.
 */

import { ContainerTestConfig } from '../test-config.ts';

export const ciConfig: Partial<ContainerTestConfig> = {
  environment: 'ci',
  baseUrl: 'http://localhost',
  timeout: 45000,           // Slightly longer timeouts for CI runners
  retries: 2,               // Fewer retries to speed up CI
  parallel: true,           // Enable parallel testing for faster CI runs
  
  services: {
    video: {
      port: 8081,
      memory: '1.5G',       // Reduced memory for CI runners
      cpu: '1.5',           // Reduced CPU allocation
      timeout: 90000,
      retries: 1,
      healthEndpoint: '/health',
    },
    document: {
      port: 8082,
      memory: '1G',
      cpu: '1.0',
      timeout: 45000,
      retries: 1,
      healthEndpoint: '/health',
    },
    ai: {
      port: 8083,
      memory: '2G',         // Reduced AI memory for CI
      cpu: '2.0',
      timeout: 180000,      // Longer timeout for model loading in CI
      retries: 1,
      healthEndpoint: '/health',
    },
    media: {
      port: 8084,
      memory: '2G',
      cpu: '2.0',
      timeout: 90000,
      retries: 1,
      healthEndpoint: '/health',
    },
    code: {
      port: 8085,
      memory: '512M',
      cpu: '1.0',
      timeout: 45000,
      retries: 1,
      healthEndpoint: '/health',
    },
    redis: {
      port: 6379,
      memory: '256M',       // Minimal Redis for CI
      cpu: '0.3',
      timeout: 15000,
      retries: 2,
      healthEndpoint: '/health',
      ttl: 60,              // Shorter TTL for CI
    },
    prometheus: {
      port: 9090,
      memory: '256M',
      cpu: '0.3',
      timeout: 30000,
      retries: 1,
      healthEndpoint: '/api/v1/status/runtimeinfo',
    },
    grafana: {
      port: 3000,
      memory: '128M',
      cpu: '0.2',
      timeout: 30000,
      retries: 1,
      healthEndpoint: '/api/health',
    },
  },
  
  database: {
    url: Deno.env.get('CI_DATABASE_URL') || 'postgresql://postgres:postgres@localhost:5432/pitchey_ci_test',
    poolSize: 3,            // Smaller pool for CI
    timeout: 15000,
  },
  
  performance: {
    responseTime: {
      thumbnail: 12000,     // More lenient for CI runners
      transcode: 180000,    // CI runners may be slower
      analyze: 8000,
      compress: 90000,
    },
    throughput: {
      requests_per_second: 30,
      concurrent_users: 5,   // Lower concurrency in CI
      max_queue_size: 200,
    },
    resourceLimits: {
      cpu: 90,              // Higher CPU tolerance in CI
      memory: 95,           // Higher memory tolerance in CI
      disk: 98,
      network: 500,         // Very lenient network in CI
    },
  },
  
  security: {
    enableScanners: true,   // Enable security scanning in CI
    vulnerabilityThreshold: 'high',
    sandboxValidation: true,
  },
  
  monitoring: {
    metricsInterval: 30000, // Less frequent metrics in CI
    alertThresholds: {
      error_rate: 5,
      response_time: 20000,
      cpu_usage: 90,
      memory_usage: 95,
    },
    logLevel: 'warn',       // Reduce log noise in CI
  },
  
  testData: {
    fixtures: './tests/containers/fixtures',
    mockData: './tests/containers/fixtures/mock-data',
    sampleFiles: {
      video: ['ci-sample.mp4'],           // Minimal test files for CI
      document: ['ci-sample.pdf'],
      code: ['ci-test.py'],
      media: ['ci-audio.mp3'],
    },
  },
};

export default ciConfig;