/**
 * Auto-scaling Configuration for Cloudflare Workers
 * Handles dynamic scaling based on traffic patterns and performance metrics
 */

export interface ScalingPolicy {
  name: string;
  metric: 'cpu' | 'memory' | 'requests' | 'latency' | 'errors';
  threshold: number;
  action: 'scale-up' | 'scale-down';
  cooldown: number; // seconds
  increment: number; // number of instances
}

export interface ScalingLimits {
  minInstances: number;
  maxInstances: number;
  maxScaleUpRate: number; // instances per minute
  maxScaleDownRate: number;
}

export interface PerformanceTarget {
  p50Latency: number; // milliseconds
  p95Latency: number;
  p99Latency: number;
  errorRate: number; // percentage
  successRate: number;
}

export class WorkerAutoScaler {
  private static readonly DEFAULT_POLICIES: ScalingPolicy[] = [
    // Scale up policies
    {
      name: 'high-cpu-usage',
      metric: 'cpu',
      threshold: 80, // 80% of 10ms limit = 8ms
      action: 'scale-up',
      cooldown: 60,
      increment: 2
    },
    {
      name: 'high-memory-usage',
      metric: 'memory',
      threshold: 100, // 100MB of 128MB limit
      action: 'scale-up',
      cooldown: 60,
      increment: 1
    },
    {
      name: 'high-request-rate',
      metric: 'requests',
      threshold: 900, // 900 req/s per worker
      action: 'scale-up',
      cooldown: 30,
      increment: 3
    },
    {
      name: 'high-latency',
      metric: 'latency',
      threshold: 500, // 500ms p95
      action: 'scale-up',
      cooldown: 45,
      increment: 2
    },
    {
      name: 'high-error-rate',
      metric: 'errors',
      threshold: 5, // 5% error rate
      action: 'scale-up',
      cooldown: 30,
      increment: 1
    },
    // Scale down policies
    {
      name: 'low-cpu-usage',
      metric: 'cpu',
      threshold: 20, // 20% of limit
      action: 'scale-down',
      cooldown: 300, // 5 minutes
      increment: 1
    },
    {
      name: 'low-request-rate',
      metric: 'requests',
      threshold: 100,
      action: 'scale-down',
      cooldown: 300,
      increment: 1
    }
  ];

  private static readonly SCALING_LIMITS: Record<string, ScalingLimits> = {
    development: {
      minInstances: 1,
      maxInstances: 5,
      maxScaleUpRate: 2,
      maxScaleDownRate: 1
    },
    staging: {
      minInstances: 2,
      maxInstances: 20,
      maxScaleUpRate: 5,
      maxScaleDownRate: 2
    },
    production: {
      minInstances: 5,
      maxInstances: 100,
      maxScaleUpRate: 10,
      maxScaleDownRate: 5
    }
  };

  private static readonly PERFORMANCE_TARGETS: PerformanceTarget = {
    p50Latency: 50,
    p95Latency: 200,
    p99Latency: 500,
    errorRate: 1,
    successRate: 99
  };

  /**
   * Calculate required worker instances based on current metrics
   */
  static calculateRequiredInstances(
    currentMetrics: {
      requestsPerSecond: number;
      avgCpuTime: number;
      avgMemory: number;
      p95Latency: number;
      errorRate: number;
    },
    currentInstances: number
  ): number {
    // Calculate based on request rate
    const requestBasedInstances = Math.ceil(currentMetrics.requestsPerSecond / 1000);
    
    // Calculate based on CPU usage
    const cpuBasedInstances = currentMetrics.avgCpuTime > 8 
      ? Math.ceil(currentInstances * (currentMetrics.avgCpuTime / 8))
      : currentInstances;
    
    // Calculate based on memory usage
    const memoryBasedInstances = currentMetrics.avgMemory > 100
      ? Math.ceil(currentInstances * (currentMetrics.avgMemory / 100))
      : currentInstances;
    
    // Calculate based on latency
    const latencyBasedInstances = currentMetrics.p95Latency > this.PERFORMANCE_TARGETS.p95Latency
      ? Math.ceil(currentInstances * (currentMetrics.p95Latency / this.PERFORMANCE_TARGETS.p95Latency))
      : currentInstances;
    
    // Take the maximum to ensure all constraints are met
    return Math.max(
      requestBasedInstances,
      cpuBasedInstances,
      memoryBasedInstances,
      latencyBasedInstances
    );
  }

  /**
   * Generate Terraform configuration for auto-scaling
   */
  static generateTerraformConfig(environment: 'development' | 'staging' | 'production'): string {
    const limits = this.SCALING_LIMITS[environment];
    
    return `
# Auto-scaling configuration for Cloudflare Workers
# Environment: ${environment}

resource "cloudflare_worker_script" "app" {
  account_id = var.cloudflare_account_id
  name       = "pitchey-\${var.environment}"
  content    = file("./dist/worker.js")

  # KV Namespace bindings
  kv_namespace_binding {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.cache.id
  }

  # R2 bucket binding
  r2_bucket_binding {
    name        = "STORAGE"
    bucket_name = cloudflare_r2_bucket.storage.name
  }

  # Durable Object bindings
  durable_object_namespace_binding {
    name        = "WEBSOCKET_ROOMS"
    namespace_id = cloudflare_durable_object_namespace.websocket_rooms.id
  }
}

resource "cloudflare_worker_route" "app" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.pitchey.com/*"
  script_name = cloudflare_worker_script.app.name
}

# Auto-scaling rules (via Cloudflare API)
resource "null_resource" "autoscaling_rules" {
  provisioner "local-exec" {
    command = <<-EOT
      curl -X PUT "https://api.cloudflare.com/client/v4/accounts/\${var.cloudflare_account_id}/workers/scripts/\${cloudflare_worker_script.app.name}/settings" \\
        -H "Authorization: Bearer \${var.cloudflare_api_token}" \\
        -H "Content-Type: application/json" \\
        -d '{
          "limits": {
            "cpu_ms": 10,
            "memory_mb": 128
          },
          "scaling": {
            "min_instances": ${limits.minInstances},
            "max_instances": ${limits.maxInstances},
            "scale_up_rate": ${limits.maxScaleUpRate},
            "scale_down_rate": ${limits.maxScaleDownRate}
          }
        }'
    EOT
  }
}

# CloudWatch alarms for scaling triggers
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "pitchey-worker-high-cpu-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "Cloudflare/Workers"
  period              = "60"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Trigger when CPU usage is high"
  
  dimensions = {
    ScriptName = cloudflare_worker_script.app.name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "pitchey-worker-high-latency-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "Cloudflare/Workers"
  period              = "60"
  statistic           = "p95"
  threshold           = "${this.PERFORMANCE_TARGETS.p95Latency}"
  alarm_description   = "Trigger when p95 latency is high"
  
  dimensions = {
    ScriptName = cloudflare_worker_script.app.name
  }
}
`;
  }

  /**
   * Generate scaling decision based on current metrics
   */
  static makeScalingDecision(
    metrics: {
      timestamp: Date;
      cpu: number;
      memory: number;
      requests: number;
      latency: number;
      errors: number;
    },
    currentInstances: number,
    environment: 'development' | 'staging' | 'production',
    lastScalingAction?: { timestamp: Date; action: string }
  ): {
    action: 'scale-up' | 'scale-down' | 'none';
    newInstances: number;
    reason: string;
  } {
    const limits = this.SCALING_LIMITS[environment];
    const policies = this.DEFAULT_POLICIES;
    
    // Check cooldown period
    if (lastScalingAction) {
      const timeSinceLastAction = (metrics.timestamp.getTime() - lastScalingAction.timestamp.getTime()) / 1000;
      if (timeSinceLastAction < 60) {
        return {
          action: 'none',
          newInstances: currentInstances,
          reason: 'Cooldown period active'
        };
      }
    }
    
    // Evaluate each policy
    for (const policy of policies) {
      let metricValue = 0;
      switch (policy.metric) {
        case 'cpu':
          metricValue = metrics.cpu;
          break;
        case 'memory':
          metricValue = metrics.memory;
          break;
        case 'requests':
          metricValue = metrics.requests;
          break;
        case 'latency':
          metricValue = metrics.latency;
          break;
        case 'errors':
          metricValue = metrics.errors;
          break;
      }
      
      const shouldTrigger = policy.action === 'scale-up' 
        ? metricValue > policy.threshold
        : metricValue < policy.threshold;
      
      if (shouldTrigger) {
        let newInstances = currentInstances;
        
        if (policy.action === 'scale-up') {
          newInstances = Math.min(
            currentInstances + policy.increment,
            limits.maxInstances
          );
        } else {
          newInstances = Math.max(
            currentInstances - policy.increment,
            limits.minInstances
          );
        }
        
        if (newInstances !== currentInstances) {
          return {
            action: policy.action,
            newInstances,
            reason: `Policy '${policy.name}' triggered: ${policy.metric}=${metricValue}, threshold=${policy.threshold}`
          };
        }
      }
    }
    
    return {
      action: 'none',
      newInstances: currentInstances,
      reason: 'No scaling policies triggered'
    };
  }

  /**
   * Generate predictive scaling schedule based on historical patterns
   */
  static generatePredictiveSchedule(
    historicalData: Array<{
      hour: number;
      dayOfWeek: number;
      avgRequests: number;
      avgLatency: number;
    }>
  ): Array<{
    cronExpression: string;
    targetInstances: number;
    reason: string;
  }> {
    const schedule: Array<{
      cronExpression: string;
      targetInstances: number;
      reason: string;
    }> = [];

    // Group by hour and day
    const patterns = new Map<string, { requests: number[]; latency: number[] }>();
    
    for (const data of historicalData) {
      const key = `${data.dayOfWeek}-${data.hour}`;
      if (!patterns.has(key)) {
        patterns.set(key, { requests: [], latency: [] });
      }
      const pattern = patterns.get(key)!;
      pattern.requests.push(data.avgRequests);
      pattern.latency.push(data.avgLatency);
    }
    
    // Generate schedule based on patterns
    for (const [key, pattern] of patterns.entries()) {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      const avgRequests = pattern.requests.reduce((a, b) => a + b, 0) / pattern.requests.length;
      const avgLatency = pattern.latency.reduce((a, b) => a + b, 0) / pattern.latency.length;
      
      // Calculate required instances
      const requiredInstances = Math.ceil(avgRequests / 1000);
      
      // Generate cron expression
      const cronExpression = `0 ${hour} * * ${dayOfWeek}`;
      
      schedule.push({
        cronExpression,
        targetInstances: requiredInstances,
        reason: `Historical pattern: ${avgRequests.toFixed(0)} req/s, ${avgLatency.toFixed(0)}ms latency`
      });
    }
    
    return schedule;
  }
}

// Export utility functions
export function getScalingConfig(environment: 'development' | 'staging' | 'production') {
  return WorkerAutoScaler['SCALING_LIMITS'][environment];
}

export function evaluateScaling(metrics: any, currentInstances: number, environment: 'development' | 'staging' | 'production') {
  return WorkerAutoScaler.makeScalingDecision(metrics, currentInstances, environment);
}