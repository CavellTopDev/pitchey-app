/**
 * Container Integration Test Configuration Management
 * 
 * Centralized configuration for container testing across different environments
 * and runtime platforms (Docker, Podman, Kubernetes)
 */

export interface ServiceConfig {
  port: number;
  memory: string;
  cpu: string;
  timeout: number;
  retries: number;
  healthEndpoint: string;
}

export interface ContainerTestConfig {
  runtime: 'docker' | 'podman' | 'kubernetes';
  environment: 'local' | 'ci' | 'staging' | 'production';
  
  // Base configuration
  baseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  
  // Service configurations
  services: {
    video: ServiceConfig;
    document: ServiceConfig;
    ai: ServiceConfig;
    media: ServiceConfig;
    code: ServiceConfig;
    redis: ServiceConfig & { ttl: number };
    prometheus: ServiceConfig;
    grafana: ServiceConfig;
  };
  
  // Database configuration
  database: {
    url: string;
    poolSize: number;
    timeout: number;
  };
  
  // Performance targets
  performance: {
    responseTime: Record<string, number>;
    throughput: Record<string, number>;
    resourceLimits: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  };
  
  // Security settings
  security: {
    enableScanners: boolean;
    vulnerabilityThreshold: 'low' | 'medium' | 'high' | 'critical';
    sandboxValidation: boolean;
  };
  
  // Monitoring configuration
  monitoring: {
    metricsInterval: number;
    alertThresholds: Record<string, number>;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  // Test data configuration
  testData: {
    fixtures: string;
    mockData: string;
    sampleFiles: {
      video: string[];
      document: string[];
      code: string[];
      media: string[];
    };
  };
}

// Performance targets for different services
export const PERFORMANCE_TARGETS = {
  VIDEO_PROCESSOR: {
    thumbnail: 5000,        // 5s for thumbnail generation
    transcode: 60000,       // 1min for video transcoding
    analyze: 3000,          // 3s for metadata analysis
    compress: 30000,        // 30s for compression
  },
  DOCUMENT_PROCESSOR: {
    pdf_generation: 10000,  // 10s for PDF generation
    ocr_extraction: 15000,  // 15s for OCR processing
    watermark: 2000,        // 2s for watermarking
    merge: 5000,           // 5s for document merging
  },
  AI_INFERENCE: {
    classification: 2000,   // 2s for text classification
    generation: 30000,      // 30s for content generation
    moderation: 1000,       // 1s for content moderation
    sentiment: 1500,        // 1.5s for sentiment analysis
  },
  MEDIA_TRANSCODER: {
    hls_transcode: 120000,  // 2min for HLS transcoding
    dash_creation: 90000,   // 1.5min for DASH creation
    quality_analysis: 5000, // 5s for quality analysis
    streaming_prep: 45000,  // 45s for streaming preparation
  },
  CODE_EXECUTOR: {
    validation: 1000,       // 1s for code validation
    execution: 30000,       // 30s for code execution
    deployment: 60000,      // 1min for deployment simulation
    security_scan: 5000,    // 5s for security scanning
  },
} as const;

// Resource utilization limits
export const RESOURCE_LIMITS = {
  CPU_USAGE: 80,           // Max 80% CPU utilization
  MEMORY_USAGE: 85,        // Max 85% memory utilization
  DISK_USAGE: 90,          // Max 90% disk utilization
  NETWORK_LATENCY: 100,    // Max 100ms network latency
  ERROR_RATE: 1,           // Max 1% error rate
  AVAILABILITY: 99.9,      // Min 99.9% uptime
} as const;

// Default service configuration template
export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  port: 8080,
  memory: '1G',
  cpu: '1.0',
  timeout: 30000,
  retries: 3,
  healthEndpoint: '/health',
};

// Container runtime commands
export const RUNTIME_COMMANDS = {
  docker: {
    up: 'docker-compose up -d',
    down: 'docker-compose down -v',
    logs: 'docker-compose logs',
    ps: 'docker-compose ps',
    exec: 'docker-compose exec',
    build: 'docker-compose build',
    scale: 'docker-compose up --scale',
  },
  podman: {
    up: 'podman-compose up -d',
    down: 'podman-compose down -v',
    logs: 'podman-compose logs',
    ps: 'podman-compose ps',
    exec: 'podman-compose exec',
    build: 'podman-compose build',
    scale: 'podman-compose up --scale',
  },
  kubernetes: {
    up: 'kubectl apply -f',
    down: 'kubectl delete -f',
    logs: 'kubectl logs',
    ps: 'kubectl get pods',
    exec: 'kubectl exec',
    build: 'docker build',
    scale: 'kubectl scale',
  },
} as const;

// Test categories and their configurations
export const TEST_CATEGORIES = {
  SMOKE: {
    timeout: 10000,
    retries: 1,
    parallel: true,
    description: 'Basic health and connectivity tests',
  },
  INTEGRATION: {
    timeout: 60000,
    retries: 2,
    parallel: false,
    description: 'Service integration and workflow tests',
  },
  PERFORMANCE: {
    timeout: 300000,
    retries: 1,
    parallel: false,
    description: 'Load testing and performance benchmarks',
  },
  SECURITY: {
    timeout: 120000,
    retries: 1,
    parallel: false,
    description: 'Security scanning and vulnerability tests',
  },
  E2E: {
    timeout: 600000,
    retries: 2,
    parallel: false,
    description: 'End-to-end workflow validation',
  },
} as const;

/**
 * Configuration factory for creating environment-specific configurations
 */
export class ConfigFactory {
  /**
   * Load configuration based on environment and runtime
   */
  static async loadConfig(
    environment: 'local' | 'ci' | 'staging' | 'production' = 'local',
    runtime: 'docker' | 'podman' | 'kubernetes' = 'docker'
  ): Promise<ContainerTestConfig> {
    try {
      // Load environment-specific config
      const envConfig = await import(`./environment-configs/${environment}.config.ts`);
      
      // Load runtime-specific config
      const runtimeConfig = await import(`./runtime-configs/${runtime}.config.ts`);
      
      // Merge configurations
      return {
        ...envConfig.default,
        ...runtimeConfig.default,
        environment,
        runtime,
      };
    } catch (error) {
      console.warn(`Failed to load specific config, using defaults: ${error}`);
      return this.getDefaultConfig(environment, runtime);
    }
  }
  
  /**
   * Get default configuration when specific config files are not available
   */
  static getDefaultConfig(
    environment: 'local' | 'ci' | 'staging' | 'production' = 'local',
    runtime: 'docker' | 'podman' | 'kubernetes' = 'docker'
  ): ContainerTestConfig {
    return {
      runtime,
      environment,
      baseUrl: 'http://localhost',
      timeout: 30000,
      retries: 3,
      parallel: environment === 'ci',
      
      services: {
        video: { ...DEFAULT_SERVICE_CONFIG, port: 8081, memory: '2G', cpu: '2.0' },
        document: { ...DEFAULT_SERVICE_CONFIG, port: 8082, memory: '1.5G', cpu: '1.5' },
        ai: { ...DEFAULT_SERVICE_CONFIG, port: 8083, memory: '4G', cpu: '3.0' },
        media: { ...DEFAULT_SERVICE_CONFIG, port: 8084, memory: '3G', cpu: '2.5' },
        code: { ...DEFAULT_SERVICE_CONFIG, port: 8085, memory: '1G', cpu: '1.5' },
        redis: { ...DEFAULT_SERVICE_CONFIG, port: 6379, memory: '512M', cpu: '0.5', ttl: 300 },
        prometheus: { ...DEFAULT_SERVICE_CONFIG, port: 9090, memory: '512M', cpu: '0.5' },
        grafana: { ...DEFAULT_SERVICE_CONFIG, port: 3000, memory: '256M', cpu: '0.3' },
      },
      
      database: {
        url: Deno.env.get('TEST_DATABASE_URL') || 'postgresql://test:test@localhost:5432/test',
        poolSize: 5,
        timeout: 10000,
      },
      
      performance: {
        responseTime: PERFORMANCE_TARGETS.VIDEO_PROCESSOR,
        throughput: {
          requests_per_second: 100,
          concurrent_users: 20,
          max_queue_size: 1000,
        },
        resourceLimits: RESOURCE_LIMITS,
      },
      
      security: {
        enableScanners: environment !== 'local',
        vulnerabilityThreshold: 'medium',
        sandboxValidation: true,
      },
      
      monitoring: {
        metricsInterval: 10000,
        alertThresholds: {
          error_rate: 5,
          response_time: 10000,
          cpu_usage: 80,
          memory_usage: 85,
        },
        logLevel: environment === 'ci' ? 'warn' : 'info',
      },
      
      testData: {
        fixtures: './tests/containers/fixtures',
        mockData: './tests/containers/fixtures/mock-data',
        sampleFiles: {
          video: ['sample.mp4', 'large-video.mp4', 'corrupted.mp4'],
          document: ['sample.pdf', 'large-doc.pdf', 'template.html'],
          code: ['valid.py', 'malicious.js', 'recursive.py'],
          media: ['audio.mp3', 'stream.m3u8', 'manifest.mpd'],
        },
      },
    };
  }
  
  /**
   * Validate configuration completeness and correctness
   */
  static validateConfig(config: ContainerTestConfig): boolean {
    const required = [
      'runtime', 'environment', 'baseUrl', 'services',
      'database', 'performance', 'security', 'monitoring', 'testData'
    ];
    
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }
    
    // Validate service configurations
    for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
      if (!serviceConfig.port || !serviceConfig.memory || !serviceConfig.cpu) {
        throw new Error(`Invalid service configuration for: ${serviceName}`);
      }
    }
    
    return true;
  }
}

/**
 * Utility functions for configuration management
 */
export const ConfigUtils = {
  /**
   * Get service URL for a given service
   */
  getServiceUrl(config: ContainerTestConfig, serviceName: keyof ContainerTestConfig['services']): string {
    const service = config.services[serviceName];
    return `${config.baseUrl}:${service.port}`;
  },
  
  /**
   * Get health check URL for a service
   */
  getHealthUrl(config: ContainerTestConfig, serviceName: keyof ContainerTestConfig['services']): string {
    const service = config.services[serviceName];
    return `${config.baseUrl}:${service.port}${service.healthEndpoint}`;
  },
  
  /**
   * Get runtime command for a specific action
   */
  getCommand(config: ContainerTestConfig, action: keyof typeof RUNTIME_COMMANDS.docker): string {
    return RUNTIME_COMMANDS[config.runtime][action];
  },
  
  /**
   * Check if running in CI environment
   */
  isCiEnvironment(): boolean {
    return !!(Deno.env.get('CI') || Deno.env.get('GITHUB_ACTIONS') || Deno.env.get('JENKINS_URL'));
  },
  
  /**
   * Get timeout for test category
   */
  getTimeout(category: keyof typeof TEST_CATEGORIES): number {
    return TEST_CATEGORIES[category].timeout;
  },
  
  /**
   * Get retry count for test category
   */
  getRetries(category: keyof typeof TEST_CATEGORIES): number {
    return TEST_CATEGORIES[category].retries;
  },
};

export default ConfigFactory;