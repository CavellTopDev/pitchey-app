/**
 * Cloudflare Log Aggregation for Grafana
 * Collects and processes Cloudflare logs for analysis in Grafana
 */

interface CloudflareLog {
  timestamp: number;
  rayId: string;
  clientIP: string;
  clientCountry: string;
  clientRequestMethod: string;
  clientRequestURI: string;
  clientRequestUserAgent: string;
  edgeResponseStatus: number;
  edgeTimeToFirstByte: number;
  originResponseTime: number;
  cacheResponseStatus: string;
  workerName?: string;
  workerStatus: string;
  workerExecutionTime?: number;
  workerMemoryUsed?: number;
}

interface LogAggregation {
  timestamp: number;
  metrics: {
    requests_total: number;
    requests_by_status: Record<string, number>;
    requests_by_country: Record<string, number>;
    cache_hit_ratio: number;
    avg_response_time: number;
    p95_response_time: number;
    error_rate: number;
    worker_execution_time: number;
    worker_memory_usage: number;
    top_endpoints: Array<{ path: string; count: number; avg_time: number }>;
    bot_traffic_ratio: number;
  };
}

class CloudflareLogAggregator {
  private readonly CLOUDFLARE_API_TOKEN: string;
  private readonly CLOUDFLARE_ZONE_ID: string;
  private readonly WORKER_NAME: string;
  private readonly GRAFANA_LOKI_URL: string;
  private readonly GRAFANA_API_KEY: string;
  private readonly LOG_RETENTION_DAYS: number;

  constructor() {
    this.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
    this.CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID!;
    this.WORKER_NAME = process.env.CLOUDFLARE_WORKER_NAME || 'pitchey-production';
    this.GRAFANA_LOKI_URL = process.env.GRAFANA_LOKI_URL!;
    this.GRAFANA_API_KEY = process.env.GRAFANA_API_KEY!;
    this.LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '7');
  }

  /**
   * Fetch logs from Cloudflare using GraphQL API
   */
  async fetchLogs(startTime: Date, endTime: Date): Promise<CloudflareLog[]> {
    const query = `
      query CloudflareLogs($zoneTag: string!, $datetimeStart: datetime!, $datetimeEnd: datetime!) {
        viewer {
          zones(filter: {zoneTag: $zoneTag}) {
            httpRequestsAdaptive(
              limit: 10000
              filter: {
                datetime_geq: $datetimeStart
                datetime_leq: $datetimeEnd
              }
              orderBy: [datetime_ASC]
            ) {
              timestamp: datetime
              rayId
              clientIP
              clientCountry
              clientRequestMethod
              clientRequestURI
              clientRequestUserAgent
              edgeResponseStatus
              edgeTimeToFirstByte
              originResponseTime
              cacheResponseStatus
              workerSubrequest
              workerStatus
            }
          }
        }
      }
    `;

    const variables = {
      zoneTag: this.CLOUDFLARE_ZONE_ID,
      datetimeStart: startTime.toISOString(),
      datetimeEnd: endTime.toISOString()
    };

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data?.viewer?.zones?.[0]?.httpRequestsAdaptive || [];
  }

  /**
   * Aggregate logs into metrics
   */
  aggregateLogs(logs: CloudflareLog[]): LogAggregation {
    if (logs.length === 0) {
      return {
        timestamp: Date.now(),
        metrics: {
          requests_total: 0,
          requests_by_status: {},
          requests_by_country: {},
          cache_hit_ratio: 0,
          avg_response_time: 0,
          p95_response_time: 0,
          error_rate: 0,
          worker_execution_time: 0,
          worker_memory_usage: 0,
          top_endpoints: [],
          bot_traffic_ratio: 0
        }
      };
    }

    const requestsByStatus: Record<string, number> = {};
    const requestsByCountry: Record<string, number> = {};
    const endpointMetrics: Record<string, { count: number; totalTime: number }> = {};
    
    let cacheHits = 0;
    let totalRequests = logs.length;
    let errorRequests = 0;
    let botRequests = 0;
    let totalResponseTime = 0;
    let totalWorkerTime = 0;
    let totalWorkerMemory = 0;
    let workerRequests = 0;

    const responseTimes: number[] = [];

    for (const log of logs) {
      // Status code distribution
      const statusGroup = `${Math.floor(log.edgeResponseStatus / 100)}xx`;
      requestsByStatus[statusGroup] = (requestsByStatus[statusGroup] || 0) + 1;

      // Country distribution
      requestsByCountry[log.clientCountry] = (requestsByCountry[log.clientCountry] || 0) + 1;

      // Cache metrics
      if (log.cacheResponseStatus === 'hit') {
        cacheHits++;
      }

      // Error rate
      if (log.edgeResponseStatus >= 400) {
        errorRequests++;
      }

      // Response time
      const responseTime = log.edgeTimeToFirstByte + (log.originResponseTime || 0);
      totalResponseTime += responseTime;
      responseTimes.push(responseTime);

      // Worker metrics
      if (log.workerStatus && log.workerStatus !== 'unknown') {
        workerRequests++;
        if (log.workerExecutionTime) {
          totalWorkerTime += log.workerExecutionTime;
        }
        if (log.workerMemoryUsed) {
          totalWorkerMemory += log.workerMemoryUsed;
        }
      }

      // Endpoint metrics
      const path = this.extractPath(log.clientRequestURI);
      if (!endpointMetrics[path]) {
        endpointMetrics[path] = { count: 0, totalTime: 0 };
      }
      endpointMetrics[path].count++;
      endpointMetrics[path].totalTime += responseTime;

      // Bot detection (simple heuristic)
      if (this.isBotTraffic(log.clientRequestUserAgent)) {
        botRequests++;
      }
    }

    // Calculate P95 response time
    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p95ResponseTime = responseTimes[p95Index] || 0;

    // Top endpoints
    const topEndpoints = Object.entries(endpointMetrics)
      .map(([path, metrics]) => ({
        path,
        count: metrics.count,
        avg_time: metrics.totalTime / metrics.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      timestamp: Date.now(),
      metrics: {
        requests_total: totalRequests,
        requests_by_status: requestsByStatus,
        requests_by_country: requestsByCountry,
        cache_hit_ratio: (cacheHits / totalRequests) * 100,
        avg_response_time: totalResponseTime / totalRequests,
        p95_response_time: p95ResponseTime,
        error_rate: (errorRequests / totalRequests) * 100,
        worker_execution_time: workerRequests > 0 ? totalWorkerTime / workerRequests : 0,
        worker_memory_usage: workerRequests > 0 ? totalWorkerMemory / workerRequests : 0,
        top_endpoints: topEndpoints,
        bot_traffic_ratio: (botRequests / totalRequests) * 100
      }
    };
  }

  /**
   * Extract path from URI for endpoint grouping
   */
  private extractPath(uri: string): string {
    try {
      const url = new URL(uri, 'https://example.com');
      let path = url.pathname;

      // Group dynamic paths
      path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id'); // UUIDs
      path = path.replace(/\/\d+/g, '/:id'); // Numeric IDs
      path = path.replace(/\/[a-f0-9]{24,}/g, '/:id'); // Long hex IDs

      return path;
    } catch {
      return '/unknown';
    }
  }

  /**
   * Simple bot detection based on user agent
   */
  private isBotTraffic(userAgent: string): boolean {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /monitoring/i,
      /uptime/i,
      /pingdom/i,
      /newrelic/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Send structured logs to Grafana Loki
   */
  async sendToLoki(aggregation: LogAggregation): Promise<void> {
    const logEntry = {
      streams: [
        {
          stream: {
            service: 'pitchey-worker',
            type: 'aggregated_metrics',
            zone: this.CLOUDFLARE_ZONE_ID
          },
          values: [
            [
              (aggregation.timestamp * 1000000).toString(), // Loki expects nanoseconds
              JSON.stringify({
                level: 'info',
                message: 'Aggregated metrics from Cloudflare logs',
                ...aggregation.metrics
              })
            ]
          ]
        }
      ]
    };

    const response = await fetch(`${this.GRAFANA_LOKI_URL}/loki/api/v1/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.GRAFANA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logEntry)
    });

    if (!response.ok) {
      throw new Error(`Failed to send to Loki: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send individual logs to Loki for detailed analysis
   */
  async sendDetailedLogsToLoki(logs: CloudflareLog[]): Promise<void> {
    const streams: Record<string, Array<[string, string]>> = {};

    for (const log of logs) {
      const streamKey = `${log.edgeResponseStatus}-${log.clientCountry}`;
      
      if (!streams[streamKey]) {
        streams[streamKey] = [];
      }

      const logLine = {
        timestamp: log.timestamp,
        ray_id: log.rayId,
        client_ip: log.clientIP,
        country: log.clientCountry,
        method: log.clientRequestMethod,
        uri: log.clientRequestURI,
        status: log.edgeResponseStatus,
        ttfb: log.edgeTimeToFirstByte,
        origin_time: log.originResponseTime,
        cache_status: log.cacheResponseStatus,
        worker_status: log.workerStatus,
        user_agent: log.clientRequestUserAgent?.substring(0, 100) // Truncate long UAs
      };

      streams[streamKey].push([
        (log.timestamp * 1000000).toString(),
        JSON.stringify(logLine)
      ]);
    }

    // Convert to Loki format and send in batches
    const batchSize = 100;
    const streamEntries = Object.entries(streams);

    for (let i = 0; i < streamEntries.length; i += batchSize) {
      const batch = streamEntries.slice(i, i + batchSize);
      
      const logEntry = {
        streams: batch.map(([streamKey, values]) => {
          const [status, country] = streamKey.split('-');
          return {
            stream: {
              service: 'pitchey-worker',
              type: 'request_log',
              status: status,
              country: country,
              zone: this.CLOUDFLARE_ZONE_ID
            },
            values: values.slice(0, 1000) // Limit values per stream
          };
        })
      };

      const response = await fetch(`${this.GRAFANA_LOKI_URL}/loki/api/v1/push`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GRAFANA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        console.warn(`Failed to send batch ${i} to Loki: ${response.status}`);
      }
    }
  }

  /**
   * Process logs for a specific time range
   */
  async processLogs(startTime: Date, endTime: Date): Promise<void> {
    console.log(`Processing logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    try {
      // Fetch logs
      const logs = await this.fetchLogs(startTime, endTime);
      console.log(`Fetched ${logs.length} log entries`);

      if (logs.length === 0) {
        console.log('No logs to process');
        return;
      }

      // Aggregate metrics
      const aggregation = this.aggregateLogs(logs);
      console.log('Generated aggregated metrics:', {
        requests: aggregation.metrics.requests_total,
        cache_hit_ratio: aggregation.metrics.cache_hit_ratio.toFixed(2) + '%',
        avg_response_time: aggregation.metrics.avg_response_time.toFixed(2) + 'ms'
      });

      // Send to Loki
      await Promise.all([
        this.sendToLoki(aggregation),
        this.sendDetailedLogsToLoki(logs.slice(0, 1000)) // Limit detailed logs
      ]);

      console.log('Successfully sent logs to Grafana Loki');
    } catch (error) {
      console.error('Error processing logs:', error);
      throw error;
    }
  }

  /**
   * Run continuous log processing
   */
  async startContinuousProcessing(intervalMinutes: number = 5): Promise<void> {
    console.log(`Starting continuous log processing every ${intervalMinutes} minutes`);

    const processInterval = async () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - intervalMinutes * 60 * 1000);

      try {
        await this.processLogs(startTime, endTime);
      } catch (error) {
        console.error('Processing cycle failed:', error);
      }
    };

    // Initial run
    await processInterval();

    // Set up interval
    setInterval(processInterval, intervalMinutes * 60 * 1000);
  }
}

// Export for use in other modules
export { CloudflareLogAggregator };

// CLI execution
if (import.meta.main) {
  const aggregator = new CloudflareLogAggregator();

  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--once')) {
    // Run once for specified time range or last 5 minutes
    const minutesBack = parseInt(args.find(arg => arg.startsWith('--minutes='))?.split('=')[1] || '5');
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutesBack * 60 * 1000);
    
    aggregator.processLogs(startTime, endTime)
      .then(() => {
        console.log('One-time processing completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('Processing failed:', error);
        process.exit(1);
      });
  } else {
    // Continuous processing
    const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '5');
    
    aggregator.startContinuousProcessing(interval)
      .catch(error => {
        console.error('Continuous processing failed:', error);
        process.exit(1);
      });
  }
}