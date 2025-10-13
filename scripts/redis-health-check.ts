#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Redis Health Check Script for Pitchey
 * Tests both local Redis and Upstash Redis connections
 */

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

class RedisHealthChecker {
  private localRedisUrl = 'redis://localhost:6379';
  private upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || '';
  private upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';

  /**
   * Check local Redis connection (Docker container)
   */
  async checkLocalRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple TCP connection test
      const connection = await Deno.connect({ hostname: 'localhost', port: 6379 });
      
      // Send PING command
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      await connection.write(encoder.encode('*1\r\n$4\r\nPING\r\n'));
      
      const buffer = new Uint8Array(1024);
      const bytesRead = await connection.read(buffer);
      const response = decoder.decode(buffer.subarray(0, bytesRead || 0));
      
      connection.close();
      
      const latency = Date.now() - startTime;
      
      if (response.includes('+PONG')) {
        return {
          service: 'Local Redis (Docker)',
          status: 'healthy',
          latency,
          details: {
            host: 'localhost',
            port: 6379,
            response: response.trim()
          }
        };
      } else {
        return {
          service: 'Local Redis (Docker)',
          status: 'unhealthy',
          error: `Unexpected response: ${response}`
        };
      }
    } catch (error) {
      return {
        service: 'Local Redis (Docker)',
        status: 'unhealthy',
        error: error.message,
        details: {
          suggestion: 'Run: docker run -d --name pitchey-redis -p 6379:6379 redis:7-alpine'
        }
      };
    }
  }

  /**
   * Check Upstash Redis connection
   */
  async checkUpstashRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    if (!this.upstashUrl || !this.upstashToken) {
      return {
        service: 'Upstash Redis',
        status: 'warning',
        error: 'Upstash credentials not configured',
        details: {
          suggestion: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables'
        }
      };
    }

    try {
      const response = await fetch(`${this.upstashUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['PING']),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        return {
          service: 'Upstash Redis',
          status: 'unhealthy',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      
      if (result.result === 'PONG') {
        return {
          service: 'Upstash Redis',
          status: 'healthy',
          latency,
          details: {
            url: this.upstashUrl,
            response: result.result
          }
        };
      } else {
        return {
          service: 'Upstash Redis',
          status: 'unhealthy',
          error: `Unexpected response: ${JSON.stringify(result)}`
        };
      }
    } catch (error) {
      return {
        service: 'Upstash Redis',
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Test basic Redis operations
   */
  async testRedisOperations(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    if (!this.upstashUrl || !this.upstashToken) {
      results.push({
        service: 'Redis Operations Test',
        status: 'warning',
        error: 'Upstash not configured - skipping operations test'
      });
      return results;
    }

    try {
      const testKey = 'health-check-test';
      const testValue = { timestamp: Date.now(), test: true };
      
      // Test SET operation
      const setResponse = await fetch(`${this.upstashUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SETEX', testKey, '60', JSON.stringify(testValue)]),
      });

      if (setResponse.ok) {
        results.push({
          service: 'Redis SET Operation',
          status: 'healthy',
          details: { operation: 'SETEX', key: testKey }
        });
      } else {
        results.push({
          service: 'Redis SET Operation',
          status: 'unhealthy',
          error: `SET failed: ${setResponse.status}`
        });
      }

      // Test GET operation
      const getResponse = await fetch(`${this.upstashUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['GET', testKey]),
      });

      if (getResponse.ok) {
        const getResult = await getResponse.json();
        const retrievedValue = JSON.parse(getResult.result);
        
        if (retrievedValue.test === testValue.test) {
          results.push({
            service: 'Redis GET Operation',
            status: 'healthy',
            details: { operation: 'GET', key: testKey, value_match: true }
          });
        } else {
          results.push({
            service: 'Redis GET Operation',
            status: 'unhealthy',
            error: 'Retrieved value does not match set value'
          });
        }
      } else {
        results.push({
          service: 'Redis GET Operation',
          status: 'unhealthy',
          error: `GET failed: ${getResponse.status}`
        });
      }

      // Test DEL operation
      const delResponse = await fetch(`${this.upstashUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['DEL', testKey]),
      });

      if (delResponse.ok) {
        results.push({
          service: 'Redis DEL Operation',
          status: 'healthy',
          details: { operation: 'DEL', key: testKey }
        });
      } else {
        results.push({
          service: 'Redis DEL Operation',
          status: 'unhealthy',
          error: `DEL failed: ${delResponse.status}`
        });
      }

    } catch (error) {
      results.push({
        service: 'Redis Operations Test',
        status: 'unhealthy',
        error: error.message
      });
    }

    return results;
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheckResult[]> {
    console.log('🔍 Starting Redis health checks...\n');
    
    const results: HealthCheckResult[] = [];
    
    // Check local Redis
    console.log('Checking local Redis...');
    const localResult = await this.checkLocalRedis();
    results.push(localResult);
    this.printResult(localResult);
    
    // Check Upstash Redis
    console.log('\nChecking Upstash Redis...');
    const upstashResult = await this.checkUpstashRedis();
    results.push(upstashResult);
    this.printResult(upstashResult);
    
    // Test operations
    console.log('\nTesting Redis operations...');
    const operationResults = await this.testRedisOperations();
    results.push(...operationResults);
    operationResults.forEach(result => this.printResult(result));
    
    return results;
  }

  /**
   * Print formatted health check result
   */
  private printResult(result: HealthCheckResult): void {
    const statusIcon = {
      'healthy': '✅',
      'unhealthy': '❌',
      'warning': '⚠️'
    }[result.status];

    console.log(`${statusIcon} ${result.service}: ${result.status.toUpperCase()}`);
    
    if (result.latency) {
      console.log(`   Latency: ${result.latency}ms`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  /**
   * Generate health summary
   */
  generateSummary(results: HealthCheckResult[]): void {
    const healthy = results.filter(r => r.status === 'healthy').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    
    console.log('\n📊 Health Check Summary:');
    console.log(`   Healthy: ${healthy}`);
    console.log(`   Unhealthy: ${unhealthy}`);
    console.log(`   Warnings: ${warnings}`);
    console.log(`   Total: ${results.length}`);
    
    if (unhealthy === 0 && warnings === 0) {
      console.log('\n🎉 All Redis services are healthy!');
    } else if (unhealthy > 0) {
      console.log('\n🚨 Some Redis services are unhealthy. Please check the errors above.');
    } else {
      console.log('\n⚠️  Some Redis services have warnings. Check configuration.');
    }
  }
}

// Main execution
if (import.meta.main) {
  const checker = new RedisHealthChecker();
  const results = await checker.runAllChecks();
  checker.generateSummary(results);
  
  // Exit with error code if any service is unhealthy
  const hasUnhealthy = results.some(r => r.status === 'unhealthy');
  if (hasUnhealthy) {
    Deno.exit(1);
  }
}

export { RedisHealthChecker, type HealthCheckResult };