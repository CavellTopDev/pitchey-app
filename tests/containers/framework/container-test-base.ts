/**
 * Container Test Base Framework
 * 
 * Provides core testing utilities and patterns for container integration tests
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ConfigFactory, ContainerTestConfig, ConfigUtils } from '../config/test-config.ts';

export interface TestContext {
  config: ContainerTestConfig;
  services: Map<string, ServiceInstance>;
  cleanup: (() => Promise<void>)[];
  startTime: number;
  testId: string;
}

export interface ServiceInstance {
  name: string;
  url: string;
  healthUrl: string;
  port: number;
  containerId?: string;
  isHealthy: boolean;
  startTime: number;
  metrics: ServiceMetrics;
}

export interface ServiceMetrics {
  responseTime: number[];
  errorCount: number;
  requestCount: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: Error;
  metrics?: ServiceMetrics;
  logs?: string[];
}

/**
 * Base class for all container integration tests
 */
export abstract class ContainerTestBase {
  protected config: ContainerTestConfig;
  protected context: TestContext;
  
  constructor(
    environment: 'local' | 'ci' | 'staging' | 'production' = 'local',
    runtime: 'docker' | 'podman' | 'kubernetes' = 'docker'
  ) {
    this.config = {} as ContainerTestConfig; // Will be loaded in setup
    this.context = {} as TestContext;         // Will be initialized in setup
  }
  
  /**
   * Setup test environment and services
   */
  async setup(): Promise<void> {
    try {
      // Load configuration
      this.config = await ConfigFactory.loadConfig();
      ConfigFactory.validateConfig(this.config);
      
      // Initialize test context
      this.context = {
        config: this.config,
        services: new Map(),
        cleanup: [],
        startTime: Date.now(),
        testId: this.generateTestId(),
      };
      
      console.log(`🚀 Setting up container test environment (${this.config.runtime})`);
      
      // Start container services
      await this.startServices();
      
      // Wait for services to be healthy
      await this.waitForServices();
      
      console.log('✅ Container test environment ready');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      await this.cleanup();
      throw error;
    }
  }
  
  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up container test environment');
    
    // Run all cleanup functions in reverse order
    for (const cleanupFn of this.context.cleanup.reverse()) {
      try {
        await cleanupFn();
      } catch (error) {
        console.error('⚠️ Cleanup error:', error);
      }
    }
    
    // Stop services
    await this.stopServices();
    
    console.log('✅ Cleanup completed');
  }
  
  /**
   * Start container services using the configured runtime
   */
  protected async startServices(): Promise<void> {
    const command = ConfigUtils.getCommand(this.config, 'up');
    console.log(`Starting services: ${command}`);
    
    const process = new Deno.Command(command.split(' ')[0], {
      args: command.split(' ').slice(1),
      stdout: 'piped',
      stderr: 'piped',
    });
    
    const { code, stdout, stderr } = await process.output();
    
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Failed to start services: ${error}`);
    }
    
    // Register cleanup for stopping services
    this.context.cleanup.push(async () => {
      await this.stopServices();
    });
  }
  
  /**
   * Stop container services
   */
  protected async stopServices(): Promise<void> {
    const command = ConfigUtils.getCommand(this.config, 'down');
    console.log(`Stopping services: ${command}`);
    
    try {
      const process = new Deno.Command(command.split(' ')[0], {
        args: command.split(' ').slice(1),
        stdout: 'piped',
        stderr: 'piped',
      });
      
      await process.output();
    } catch (error) {
      console.error('Error stopping services:', error);
    }
  }
  
  /**
   * Wait for all services to be healthy
   */
  protected async waitForServices(maxWaitTime: number = 120000): Promise<void> {
    console.log('⏳ Waiting for services to be healthy...');
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      let allHealthy = true;
      
      for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
        if (serviceName === 'prometheus' || serviceName === 'grafana') {
          continue; // Skip monitoring services for basic health checks
        }
        
        const healthUrl = ConfigUtils.getHealthUrl(this.config, serviceName as keyof typeof this.config.services);
        
        try {
          const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
          });
          
          if (!response.ok) {
            allHealthy = false;
            console.log(`❌ ${serviceName} not healthy (${response.status})`);
            break;
          }
          
          // Register service instance
          if (!this.context.services.has(serviceName)) {
            this.context.services.set(serviceName, {
              name: serviceName,
              url: ConfigUtils.getServiceUrl(this.config, serviceName as keyof typeof this.config.services),
              healthUrl,
              port: serviceConfig.port,
              isHealthy: true,
              startTime: Date.now(),
              metrics: {
                responseTime: [],
                errorCount: 0,
                requestCount: 0,
                resourceUsage: { cpu: 0, memory: 0, network: 0 },
              },
            });
          }
          
          console.log(`✅ ${serviceName} healthy`);
        } catch (error) {
          allHealthy = false;
          console.log(`❌ ${serviceName} health check failed:`, error.message);
          break;
        }
      }
      
      if (allHealthy) {
        console.log('✅ All services are healthy');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Services did not become healthy within ${maxWaitTime}ms`);
  }
  
  /**
   * Make HTTP request to a service with metrics collection
   */
  protected async makeRequest(
    serviceName: string,
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const service = this.context.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const url = `${service.url}${path}`;
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout),
      });
      
      const duration = performance.now() - startTime;
      
      // Update metrics
      service.metrics.requestCount++;
      service.metrics.responseTime.push(duration);
      
      if (!response.ok) {
        service.metrics.errorCount++;
      }
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      service.metrics.requestCount++;
      service.metrics.errorCount++;
      service.metrics.responseTime.push(duration);
      
      throw error;
    }
  }
  
  /**
   * Upload file to a service
   */
  protected async uploadFile(
    serviceName: string,
    path: string,
    file: Uint8Array,
    filename: string,
    contentType: string = 'application/octet-stream'
  ): Promise<Response> {
    const formData = new FormData();
    formData.append('file', new Blob([file], { type: contentType }), filename);
    
    return this.makeRequest(serviceName, path, {
      method: 'POST',
      body: formData,
    });
  }
  
  /**
   * Check service health
   */
  protected async checkHealth(serviceName: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(serviceName, '/health');
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Get service metrics from Prometheus
   */
  protected async getMetrics(serviceName?: string): Promise<string> {
    const response = await this.makeRequest('prometheus', '/api/v1/query', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get metrics: ${response.status}`);
    }
    
    return response.text();
  }
  
  /**
   * Execute command in service container
   */
  protected async execInContainer(
    serviceName: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    const execCommand = ConfigUtils.getCommand(this.config, 'exec');
    const fullCommand = `${execCommand} ${serviceName} ${command.join(' ')}`;
    
    const process = new Deno.Command(fullCommand.split(' ')[0], {
      args: fullCommand.split(' ').slice(1),
      stdout: 'piped',
      stderr: 'piped',
    });
    
    const { code, stdout, stderr } = await process.output();
    
    return {
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      code,
    };
  }
  
  /**
   * Get container logs
   */
  protected async getLogs(serviceName: string, lines: number = 100): Promise<string[]> {
    const logsCommand = ConfigUtils.getCommand(this.config, 'logs');
    const fullCommand = `${logsCommand} --tail ${lines} ${serviceName}`;
    
    const process = new Deno.Command(fullCommand.split(' ')[0], {
      args: fullCommand.split(' ').slice(1),
      stdout: 'piped',
      stderr: 'piped',
    });
    
    const { stdout } = await process.output();
    const logs = new TextDecoder().decode(stdout);
    
    return logs.split('\n').filter(line => line.trim());
  }
  
  /**
   * Assert response time is within acceptable limits
   */
  protected assertResponseTime(
    responseTime: number,
    maxTime: number,
    operation: string
  ): void {
    if (responseTime > maxTime) {
      throw new Error(`${operation} took ${responseTime}ms, expected < ${maxTime}ms`);
    }
  }
  
  /**
   * Assert service health
   */
  protected async assertServiceHealthy(serviceName: string): Promise<void> {
    const isHealthy = await this.checkHealth(serviceName);
    if (!isHealthy) {
      throw new Error(`Service ${serviceName} is not healthy`);
    }
  }
  
  /**
   * Assert error rate is within acceptable limits
   */
  protected assertErrorRate(serviceName: string, maxErrorRate: number = 5): void {
    const service = this.context.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const errorRate = (service.metrics.errorCount / service.metrics.requestCount) * 100;
    if (errorRate > maxErrorRate) {
      throw new Error(`Error rate ${errorRate}% exceeds maximum ${maxErrorRate}%`);
    }
  }
  
  /**
   * Generate unique test ID
   */
  protected generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Wait for a condition to be met
   */
  protected async waitFor(
    condition: () => Promise<boolean>,
    timeout: number = 30000,
    interval: number = 1000,
    description: string = 'condition'
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for ${description} after ${timeout}ms`);
  }
  
  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  
  /**
   * Load test fixture file
   */
  protected async loadFixture(filename: string): Promise<Uint8Array> {
    const fixturePath = `${this.config.testData.fixtures}/${filename}`;
    try {
      return await Deno.readFile(fixturePath);
    } catch (error) {
      throw new Error(`Failed to load fixture ${filename}: ${error.message}`);
    }
  }
  
  /**
   * Save test results
   */
  protected async saveTestResults(results: TestResult[]): Promise<void> {
    const reportPath = `./tests/containers/reports/test-results-${this.context.testId}.json`;
    
    const report = {
      testId: this.context.testId,
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      runtime: this.config.runtime,
      duration: Date.now() - this.context.startTime,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      },
    };
    
    try {
      await Deno.mkdir('./tests/containers/reports', { recursive: true });
      await Deno.writeTextFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Test results saved to ${reportPath}`);
    } catch (error) {
      console.error('Failed to save test results:', error);
    }
  }
}

export default ContainerTestBase;