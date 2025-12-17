/**
 * Cloudflare Worker Analytics API Metrics Collector for Grafana
 * Collects performance, cache, and business metrics from Pitchey Worker
 */

interface CloudflareAnalyticsResponse {
  data: {
    viewer: {
      zones: Array<{
        httpRequestsAdaptiveGroups: Array<{
          count: number;
          sum: {
            bytes: number;
            cachedBytes: number;
          };
          avg: {
            sampleInterval: number;
          };
          dimensions: {
            datetime: string;
            clientCountryName: string;
            clientRequestHTTPStatusCode: number;
            edgeResponseStatus: number;
          };
        }>;
      }>;
    };
  };
}

interface WorkerAnalyticsResponse {
  data: {
    viewer: {
      zones: Array<{
        workers: {
          invocations: Array<{
            datetime: string;
            requests: number;
            errors: number;
            cpuTime: number;
            duration: number;
          }>;
        };
      }>;
    };
  };
}

interface GrafanaMetric {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

class PitcheyMetricsCollector {
  private readonly CLOUDFLARE_API_TOKEN: string;
  private readonly CLOUDFLARE_ZONE_ID: string;
  private readonly WORKER_NAME: string;
  private readonly GRAFANA_PUSH_URL: string;
  private readonly GRAFANA_API_KEY: string;

  constructor() {
    this.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
    this.CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID!;
    this.WORKER_NAME = process.env.CLOUDFLARE_WORKER_NAME || 'pitchey-production';
    this.GRAFANA_PUSH_URL = process.env.GRAFANA_PUSH_URL!;
    this.GRAFANA_API_KEY = process.env.GRAFANA_API_KEY!;
  }

  /**
   * Collect Worker Analytics metrics from Cloudflare
   */
  async collectWorkerMetrics(): Promise<GrafanaMetric[]> {
    const query = `
      query WorkerAnalytics($zoneTag: string!, $datetimeStart: datetime!, $datetimeEnd: datetime!) {
        viewer {
          zones(filter: {zoneTag: $zoneTag}) {
            workers: workersInvocationsAdaptive(
              limit: 10000
              filter: {
                scriptName: "${this.WORKER_NAME}"
                datetime_geq: $datetimeStart
                datetime_leq: $datetimeEnd
              }
            ) {
              invocations: group {
                datetime: dimensions { datetime }
                requests: sum { requests }
                errors: sum { errors }
                cpuTime: sum { cpuTime }
                duration: avg { duration }
              }
            }
          }
        }
      }
    `;

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const variables = {
      zoneTag: this.CLOUDFLARE_ZONE_ID,
      datetimeStart: fiveMinutesAgo.toISOString(),
      datetimeEnd: now.toISOString()
    };

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const data: WorkerAnalyticsResponse = await response.json();
    return this.transformWorkerMetrics(data);
  }

  /**
   * Collect Zone Analytics metrics for cache performance
   */
  async collectZoneMetrics(): Promise<GrafanaMetric[]> {
    const query = `
      query ZoneAnalytics($zoneTag: string!, $datetimeStart: datetime!, $datetimeEnd: datetime!) {
        viewer {
          zones(filter: {zoneTag: $zoneTag}) {
            httpRequestsAdaptiveGroups(
              limit: 10000
              filter: {
                datetime_geq: $datetimeStart
                datetime_leq: $datetimeEnd
              }
              orderBy: [datetime_ASC]
            ) {
              count
              sum {
                bytes
                cachedBytes
              }
              avg {
                sampleInterval
              }
              dimensions {
                datetime
                clientCountryName
                clientRequestHTTPStatusCode
                edgeResponseStatus
              }
            }
          }
        }
      }
    `;

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const variables = {
      zoneTag: this.CLOUDFLARE_ZONE_ID,
      datetimeStart: fiveMinutesAgo.toISOString(),
      datetimeEnd: now.toISOString()
    };

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const data: CloudflareAnalyticsResponse = await response.json();
    return this.transformZoneMetrics(data);
  }

  /**
   * Collect custom application metrics from the Worker
   */
  async collectApplicationMetrics(): Promise<GrafanaMetric[]> {
    const workerUrl = 'https://pitchey-production.cavelltheleaddev.workers.dev';
    const metricsEndpoint = `${workerUrl}/metrics`;

    try {
      const response = await fetch(metricsEndpoint, {
        headers: {
          'Authorization': `Bearer ${process.env.WORKER_METRICS_TOKEN}`
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch application metrics:', response.status);
        return [];
      }

      const metrics = await response.json();
      return this.transformApplicationMetrics(metrics);
    } catch (error) {
      console.warn('Error collecting application metrics:', error);
      return [];
    }
  }

  /**
   * Transform Worker metrics to Grafana format
   */
  private transformWorkerMetrics(data: WorkerAnalyticsResponse): GrafanaMetric[] {
    const metrics: GrafanaMetric[] = [];
    const zones = data.data?.viewer?.zones || [];

    zones.forEach(zone => {
      zone.workers?.invocations?.forEach(invocation => {
        const timestamp = new Date(invocation.datetime).getTime();
        const baseLabels = {
          worker: this.WORKER_NAME,
          zone: this.CLOUDFLARE_ZONE_ID
        };

        metrics.push(
          {
            name: 'cloudflare_worker_requests_total',
            value: invocation.requests,
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_worker_errors_total',
            value: invocation.errors,
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_worker_cpu_time_seconds',
            value: invocation.cpuTime / 1000, // Convert to seconds
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_worker_duration_seconds',
            value: invocation.duration / 1000, // Convert to seconds
            timestamp,
            labels: baseLabels
          }
        );
      });
    });

    return metrics;
  }

  /**
   * Transform Zone metrics to Grafana format
   */
  private transformZoneMetrics(data: CloudflareAnalyticsResponse): GrafanaMetric[] {
    const metrics: GrafanaMetric[] = [];
    const zones = data.data?.viewer?.zones || [];

    zones.forEach(zone => {
      zone.httpRequestsAdaptiveGroups?.forEach(group => {
        const timestamp = new Date(group.dimensions.datetime).getTime();
        const baseLabels = {
          zone: this.CLOUDFLARE_ZONE_ID,
          country: group.dimensions.clientCountryName,
          status: group.dimensions.clientRequestHTTPStatusCode.toString()
        };

        // Calculate cache hit rate
        const cacheHitRate = group.sum.cachedBytes > 0 ? 
          (group.sum.cachedBytes / group.sum.bytes) * 100 : 0;

        metrics.push(
          {
            name: 'cloudflare_zone_requests_total',
            value: group.count,
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_cache_hit_rate',
            value: cacheHitRate,
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_bytes_total',
            value: group.sum.bytes,
            timestamp,
            labels: baseLabels
          },
          {
            name: 'cloudflare_cached_bytes_total',
            value: group.sum.cachedBytes,
            timestamp,
            labels: baseLabels
          }
        );
      });
    });

    return metrics;
  }

  /**
   * Transform application metrics to Grafana format
   */
  private transformApplicationMetrics(data: any): GrafanaMetric[] {
    const metrics: GrafanaMetric[] = [];
    const timestamp = Date.now();

    // Cache metrics
    if (data.cache) {
      const cacheLabels = { service: 'pitchey-cache' };
      
      metrics.push(
        {
          name: 'pitchey_cache_hits_total',
          value: data.cache.hits || 0,
          timestamp,
          labels: cacheLabels
        },
        {
          name: 'pitchey_cache_misses_total',
          value: data.cache.misses || 0,
          timestamp,
          labels: cacheLabels
        },
        {
          name: 'pitchey_cache_response_time_ms',
          value: data.cache.avgResponseTime || 0,
          timestamp,
          labels: cacheLabels
        }
      );
    }

    // Database metrics
    if (data.database) {
      const dbLabels = { service: 'pitchey-database' };
      
      metrics.push(
        {
          name: 'pitchey_db_queries_total',
          value: data.database.queries || 0,
          timestamp,
          labels: dbLabels
        },
        {
          name: 'pitchey_db_connections_active',
          value: data.database.activeConnections || 0,
          timestamp,
          labels: dbLabels
        }
      );
    }

    // Business metrics
    if (data.business) {
      const businessLabels = { service: 'pitchey-business' };
      
      metrics.push(
        {
          name: 'pitchey_pitches_created_total',
          value: data.business.pitchesCreated || 0,
          timestamp,
          labels: businessLabels
        },
        {
          name: 'pitchey_user_logins_total',
          value: data.business.userLogins || 0,
          timestamp,
          labels: businessLabels
        },
        {
          name: 'pitchey_nda_requests_total',
          value: data.business.ndaRequests || 0,
          timestamp,
          labels: businessLabels
        }
      );
    }

    return metrics;
  }

  /**
   * Push metrics to Grafana Cloud
   */
  async pushToGrafana(metrics: GrafanaMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    // Convert to Prometheus format
    const prometheusMetrics = metrics.map(metric => {
      const labels = Object.entries(metric.labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');
      
      return `${metric.name}{${labels}} ${metric.value} ${metric.timestamp}`;
    }).join('\n');

    try {
      const response = await fetch(this.GRAFANA_PUSH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GRAFANA_API_KEY}`,
          'Content-Type': 'text/plain'
        },
        body: prometheusMetrics
      });

      if (!response.ok) {
        throw new Error(`Failed to push metrics: ${response.status} ${response.statusText}`);
      }

      console.log(`Successfully pushed ${metrics.length} metrics to Grafana`);
    } catch (error) {
      console.error('Error pushing metrics to Grafana:', error);
      throw error;
    }
  }

  /**
   * Collect and push all metrics
   */
  async collectAndPush(): Promise<void> {
    console.log('Starting metrics collection...');
    
    try {
      const [workerMetrics, zoneMetrics, appMetrics] = await Promise.allSettled([
        this.collectWorkerMetrics(),
        this.collectZoneMetrics(),
        this.collectApplicationMetrics()
      ]);

      const allMetrics: GrafanaMetric[] = [];

      if (workerMetrics.status === 'fulfilled') {
        allMetrics.push(...workerMetrics.value);
      } else {
        console.warn('Failed to collect worker metrics:', workerMetrics.reason);
      }

      if (zoneMetrics.status === 'fulfilled') {
        allMetrics.push(...zoneMetrics.value);
      } else {
        console.warn('Failed to collect zone metrics:', zoneMetrics.reason);
      }

      if (appMetrics.status === 'fulfilled') {
        allMetrics.push(...appMetrics.value);
      } else {
        console.warn('Failed to collect app metrics:', appMetrics.reason);
      }

      await this.pushToGrafana(allMetrics);
      console.log(`Collection completed. Pushed ${allMetrics.length} metrics.`);
    } catch (error) {
      console.error('Error during metrics collection:', error);
      throw error;
    }
  }
}

// Export for use in scripts
export { PitcheyMetricsCollector };

// CLI execution
if (import.meta.main) {
  const collector = new PitcheyMetricsCollector();
  
  // Run once
  if (process.argv.includes('--once')) {
    collector.collectAndPush()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } 
  // Run continuously
  else {
    const intervalMinutes = parseInt(process.argv.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '5');
    console.log(`Starting continuous collection every ${intervalMinutes} minutes...`);
    
    setInterval(async () => {
      try {
        await collector.collectAndPush();
      } catch (error) {
        console.error('Collection cycle failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Initial run
    collector.collectAndPush().catch(console.error);
  }
}