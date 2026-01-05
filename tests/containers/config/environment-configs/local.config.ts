/**
 * Local Development Environment Configuration
 * Optimized for local testing with Docker/Podman on developer machines
 */

import { ContainerTestConfig } from '../test-config.ts';

export const localConfig: Partial<ContainerTestConfig> = {
  environment: 'local',
  baseUrl: 'http://localhost',
  timeout: 30000,
  retries: 3,
  parallel: false, // Avoid resource contention on local machines
  
  services: {
    video: {
      port: 8081,
      memory: '2G',
      cpu: '2.0',
      timeout: 60000,
      retries: 2,
      healthEndpoint: '/health',
    },
    document: {
      port: 8082,
      memory: '1.5G',
      cpu: '1.5',
      timeout: 30000,
      retries: 2,
      healthEndpoint: '/health',
    },
    ai: {
      port: 8083,
      memory: '4G',
      cpu: '3.0',
      timeout: 120000, // AI models take longer to load locally
      retries: 2,
      healthEndpoint: '/health',
    },
    media: {
      port: 8084,
      memory: '3G',
      cpu: '2.5',
      timeout: 60000,
      retries: 2,
      healthEndpoint: '/health',
    },
    code: {
      port: 8085,
      memory: '1G',
      cpu: '1.5',
      timeout: 30000,
      retries: 2,
      healthEndpoint: '/health',
    },
    redis: {
      port: 6379,
      memory: '512M',
      cpu: '0.5',
      timeout: 10000,
      retries: 3,
      healthEndpoint: '/health',
      ttl: 300,
    },
    prometheus: {
      port: 9090,
      memory: '512M',
      cpu: '0.5',
      timeout: 15000,
      retries: 2,
      healthEndpoint: '/api/v1/status/runtimeinfo',
    },
    grafana: {
      port: 3000,
      memory: '256M',
      cpu: '0.3',
      timeout: 15000,
      retries: 2,
      healthEndpoint: '/api/health',
    },
  },
  
  database: {
    url: Deno.env.get('TEST_DATABASE_URL') || 'postgresql://test:test@localhost:5432/pitchey_test',
    poolSize: 5,
    timeout: 10000,
  },
  
  performance: {
    responseTime: {
      thumbnail: 8000,        // More lenient for local testing
      transcode: 90000,       // Local machines may be slower
      analyze: 5000,
      compress: 45000,
    },
    throughput: {
      requests_per_second: 50, // Lower throughput expectations locally
      concurrent_users: 10,
      max_queue_size: 500,
    },
    resourceLimits: {
      cpu: 85,                // Allow higher CPU usage locally
      memory: 90,             // Allow higher memory usage locally
      disk: 95,
      network: 200,           // More lenient network latency
    },
  },
  
  security: {
    enableScanners: false,    // Disable heavy security scans for local dev
    vulnerabilityThreshold: 'medium',
    sandboxValidation: true,
  },
  
  monitoring: {
    metricsInterval: 15000,   // Less frequent metrics collection
    alertThresholds: {
      error_rate: 10,         // More lenient error rates for debugging
      response_time: 15000,
      cpu_usage: 85,
      memory_usage: 90,
    },
    logLevel: 'debug',        // Verbose logging for development
  },
  
  testData: {
    fixtures: './tests/containers/fixtures',
    mockData: './tests/containers/fixtures/mock-data',
    sampleFiles: {
      video: ['sample-small.mp4', 'sample-medium.mp4'],
      document: ['sample.pdf', 'nda-template.html'],
      code: ['hello.py', 'valid.js', 'test.sql'],
      media: ['audio-short.mp3', 'sample-stream.m3u8'],
    },
  },
};

export default localConfig;