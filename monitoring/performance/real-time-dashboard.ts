#!/usr/bin/env deno run --allow-net --allow-read --allow-write
/**
 * Real-time Metrics Dashboard for Pitchey Cloudflare Worker
 * Generates interactive HTML dashboard with live metrics
 */

interface DashboardMetrics {
  timestamp: string;
  responseTime: {
    current: number;
    avg24h: number;
    p95: number;
    trend: 'up' | 'down' | 'stable';
  };
  cachePerformance: {
    hitRate: number;
    missRate: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  errorRate: {
    current: number;
    avg24h: number;
    trend: 'up' | 'down' | 'stable';
  };
  endpointHealth: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
  systemStatus: 'operational' | 'degraded' | 'major_outage';
}

interface EndpointMetric {
  endpoint: string;
  responseTime: number;
  cacheHitRate: number;
  errorRate: number;
  requestCount: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: string;
}

class RealTimeDashboard {
  private apiUrl: string;
  private dataDir: string;
  private dashboardFile: string;

  constructor(apiUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev') {
    this.apiUrl = apiUrl;
    this.dataDir = './dashboard-data';
    this.dashboardFile = './performance-dashboard.html';
  }

  private async ensureDataDir() {
    try {
      await Deno.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  private async loadHistoricalData(): Promise<any[]> {
    try {
      const files = [];
      for await (const entry of Deno.readDir('./health-logs')) {
        if (entry.name.endsWith('.jsonl')) {
          files.push(`./health-logs/${entry.name}`);
        }
      }

      const data = [];
      for (const file of files) {
        try {
          const content = await Deno.readTextFile(file);
          const lines = content.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              data.push(JSON.parse(line));
            }
          }
        } catch (error) {
          console.warn(`Could not read ${file}:`, error.message);
        }
      }

      return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch {
      return [];
    }
  }

  private async loadBaselineData(): Promise<any[]> {
    try {
      const files = [];
      for await (const entry of Deno.readDir('./baseline-data')) {
        if (entry.name.startsWith('baseline-') && entry.name.endsWith('.json')) {
          files.push(`./baseline-data/${entry.name}`);
        }
      }

      const data = [];
      for (const file of files) {
        try {
          const content = await Deno.readTextFile(file);
          data.push(JSON.parse(content));
        } catch (error) {
          console.warn(`Could not read ${file}:`, error.message);
        }
      }

      return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch {
      return [];
    }
  }

  private calculateTrend(current: number, historical: number[]): 'up' | 'down' | 'stable' {
    if (historical.length < 2) return 'stable';
    
    const recent = historical.slice(-5);
    const older = historical.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private analyzeMetrics(healthData: any[], baselineData: any[]): DashboardMetrics {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Filter recent health data
    const recentHealth = healthData.filter(entry => 
      new Date(entry.timestamp) >= last24h
    );

    // Calculate response time metrics
    const responseTimes: number[] = [];
    const cacheHits: number[] = [];
    const errorCounts: number[] = [];
    let endpointHealth = { healthy: 0, degraded: 0, unhealthy: 0, total: 0 };

    for (const entry of recentHealth) {
      if (entry.results) {
        for (const result of entry.results) {
          responseTimes.push(result.responseTime);
          cacheHits.push(result.cacheStatus === 'HIT' ? 1 : 0);
          errorCounts.push(result.status === 'unhealthy' ? 1 : 0);
          
          // Count endpoint health
          if (result.status === 'healthy') endpointHealth.healthy++;
          else if (result.status === 'degraded') endpointHealth.degraded++;
          else endpointHealth.unhealthy++;
          endpointHealth.total++;
        }
      }
    }

    // Current metrics (latest baseline or health check)
    let currentResponseTime = 0;
    let currentCacheHitRate = 0;
    let currentErrorRate = 0;

    if (baselineData.length > 0) {
      const latest = baselineData[baselineData.length - 1];
      if (latest.results) {
        const latestResponses = latest.results.map((r: any) => r.responseTime);
        currentResponseTime = latestResponses.reduce((a: number, b: number) => a + b, 0) / latestResponses.length;
        const latestCacheHits = latest.results.filter((r: any) => r.cacheStatus === 'HIT').length;
        currentCacheHitRate = (latestCacheHits / latest.results.length) * 100;
      }
    }

    // Historical averages
    const avg24hResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : currentResponseTime;
    
    const avg24hCacheHitRate = cacheHits.length > 0
      ? (cacheHits.reduce((a, b) => a + b, 0) / cacheHits.length) * 100
      : currentCacheHitRate;

    const avg24hErrorRate = errorCounts.length > 0
      ? (errorCounts.reduce((a, b) => a + b, 0) / errorCounts.length) * 100
      : 0;

    // P95 calculation
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
    const p95 = sortedResponseTimes.length > 0 
      ? sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)]
      : currentResponseTime;

    // Determine system status
    let systemStatus: 'operational' | 'degraded' | 'major_outage' = 'operational';
    const unhealthyPercentage = endpointHealth.total > 0 
      ? (endpointHealth.unhealthy / endpointHealth.total) * 100 
      : 0;
    
    if (unhealthyPercentage > 50) systemStatus = 'major_outage';
    else if (unhealthyPercentage > 20 || avg24hResponseTime > 1000) systemStatus = 'degraded';

    return {
      timestamp: new Date().toISOString(),
      responseTime: {
        current: Math.round(currentResponseTime * 100) / 100,
        avg24h: Math.round(avg24hResponseTime * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        trend: this.calculateTrend(currentResponseTime, responseTimes),
      },
      cachePerformance: {
        hitRate: Math.round(avg24hCacheHitRate * 100) / 100,
        missRate: Math.round((100 - avg24hCacheHitRate) * 100) / 100,
        trend: this.calculateTrend(avg24hCacheHitRate, cacheHits.map(h => h * 100)),
      },
      errorRate: {
        current: Math.round(currentErrorRate * 100) / 100,
        avg24h: Math.round(avg24hErrorRate * 100) / 100,
        trend: this.calculateTrend(currentErrorRate, errorCounts.map(e => e * 100)),
      },
      endpointHealth,
      systemStatus,
    };
  }

  private getEndpointMetrics(healthData: any[]): EndpointMetric[] {
    const endpointMap = new Map<string, any[]>();
    
    // Group by endpoint
    for (const entry of healthData) {
      if (entry.results) {
        for (const result of entry.results) {
          if (!endpointMap.has(result.endpoint)) {
            endpointMap.set(result.endpoint, []);
          }
          endpointMap.get(result.endpoint)!.push(result);
        }
      }
    }

    return Array.from(endpointMap.entries()).map(([endpoint, results]) => {
      const recent = results.slice(-10); // Last 10 checks
      const responseTimes = recent.map(r => r.responseTime);
      const cacheHits = recent.filter(r => r.cacheStatus === 'HIT').length;
      const errors = recent.filter(r => r.status === 'unhealthy').length;
      const latest = recent[recent.length - 1];

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const cacheHitRate = (cacheHits / recent.length) * 100;
      const errorRate = (errors / recent.length) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (errorRate > 20 || avgResponseTime > 2000) status = 'unhealthy';
      else if (errorRate > 5 || avgResponseTime > 1000) status = 'degraded';

      return {
        endpoint,
        responseTime: Math.round(avgResponseTime * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        requestCount: recent.length,
        status,
        lastChecked: latest?.timestamp || new Date().toISOString(),
      };
    });
  }

  private generateDashboardHTML(metrics: DashboardMetrics, endpointMetrics: EndpointMetric[], historicalData: any[]): string {
    const statusColor = metrics.systemStatus === 'operational' ? '#22c55e' : 
                       metrics.systemStatus === 'degraded' ? '#f59e0b' : '#ef4444';
    
    const statusIcon = metrics.systemStatus === 'operational' ? '✅' : 
                      metrics.systemStatus === 'degraded' ? '⚠️' : '🚨';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }

        .dashboard {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid ${statusColor};
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.2s ease;
        }

        .metric-card:hover {
            transform: translateY(-4px);
        }

        .metric-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 16px;
        }

        .metric-title {
            font-size: 1rem;
            color: #e2e8f0;
            font-weight: 500;
        }

        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .metric-subtitle {
            font-size: 0.875rem;
            color: #94a3b8;
        }

        .trend-up { color: #ef4444; }
        .trend-down { color: #22c55e; }
        .trend-stable { color: #64748b; }

        .endpoint-table {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            overflow: hidden;
            backdrop-filter: blur(10px);
            margin-bottom: 30px;
        }

        .table-header {
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px 20px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
            color: #e2e8f0;
        }

        .status-healthy { color: #22c55e; }
        .status-degraded { color: #f59e0b; }
        .status-unhealthy { color: #ef4444; }

        .chart-container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px;
            backdrop-filter: blur(10px);
            margin-bottom: 30px;
        }

        .last-updated {
            text-align: center;
            color: #94a3b8;
            font-size: 0.875rem;
            margin-top: 20px;
        }

        .auto-refresh {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(59, 130, 246, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.875rem;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        .refreshing {
            animation: pulse 1s infinite;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🎬 Pitchey Performance Dashboard</h1>
            <div class="status-indicator">
                ${statusIcon} System Status: ${metrics.systemStatus.replace('_', ' ').toUpperCase()}
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">⚡ Response Time</div>
                </div>
                <div class="metric-value">${metrics.responseTime.current}ms</div>
                <div class="metric-subtitle">
                    24h avg: ${metrics.responseTime.avg24h}ms | P95: ${metrics.responseTime.p95}ms
                    <span class="trend-${metrics.responseTime.trend}">
                        ${metrics.responseTime.trend === 'up' ? '↗️' : 
                          metrics.responseTime.trend === 'down' ? '↘️' : '→'}
                    </span>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">💾 Cache Performance</div>
                </div>
                <div class="metric-value">${metrics.cachePerformance.hitRate}%</div>
                <div class="metric-subtitle">
                    Hit rate | Miss: ${metrics.cachePerformance.missRate}%
                    <span class="trend-${metrics.cachePerformance.trend}">
                        ${metrics.cachePerformance.trend === 'improving' ? '↗️' : 
                          metrics.cachePerformance.trend === 'degrading' ? '↘️' : '→'}
                    </span>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">🚨 Error Rate</div>
                </div>
                <div class="metric-value">${metrics.errorRate.avg24h}%</div>
                <div class="metric-subtitle">
                    24h average | Current: ${metrics.errorRate.current}%
                    <span class="trend-${metrics.errorRate.trend}">
                        ${metrics.errorRate.trend === 'up' ? '↗️' : 
                          metrics.errorRate.trend === 'down' ? '↘️' : '→'}
                    </span>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-header">
                    <div class="metric-title">🏥 Endpoint Health</div>
                </div>
                <div class="metric-value">${metrics.endpointHealth.healthy}/${metrics.endpointHealth.total}</div>
                <div class="metric-subtitle">
                    Healthy | Degraded: ${metrics.endpointHealth.degraded} | Down: ${metrics.endpointHealth.unhealthy}
                </div>
            </div>
        </div>

        <div class="endpoint-table">
            <div class="table-header">
                <h3>📊 Endpoint Performance</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Status</th>
                        <th>Avg Response</th>
                        <th>Cache Hit Rate</th>
                        <th>Error Rate</th>
                        <th>Last Checked</th>
                    </tr>
                </thead>
                <tbody>
                    ${endpointMetrics.map(endpoint => `
                        <tr>
                            <td><code>${endpoint.endpoint}</code></td>
                            <td class="status-${endpoint.status}">
                                ${endpoint.status === 'healthy' ? '✅' : 
                                  endpoint.status === 'degraded' ? '⚠️' : '❌'}
                                ${endpoint.status}
                            </td>
                            <td>${endpoint.responseTime}ms</td>
                            <td>${endpoint.cacheHitRate}%</td>
                            <td>${endpoint.errorRate}%</td>
                            <td>${new Date(endpoint.lastChecked).toLocaleTimeString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="chart-container">
            <h3>📈 Response Time Trend (24h)</h3>
            <canvas id="responseTimeChart" width="800" height="200"></canvas>
        </div>

        <div class="last-updated">
            Last updated: ${new Date(metrics.timestamp).toLocaleString()}
        </div>

        <div class="auto-refresh" id="autoRefresh">
            🔄 Auto-refresh: 30s
        </div>
    </div>

    <script>
        // Historical data for charts
        const historicalData = ${JSON.stringify(historicalData.slice(-50))};
        
        // Response time chart
        const ctx = document.getElementById('responseTimeChart').getContext('2d');
        const responseTimeData = historicalData.map(entry => ({
            x: new Date(entry.timestamp),
            y: entry.summary ? entry.summary.avgResponseTime : 0
        })).filter(point => point.y > 0);

        new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Average Response Time (ms)',
                    data: responseTimeData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: {
                                hour: 'HH:mm'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e2e8f0'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e2e8f0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                }
            }
        });

        // Auto-refresh functionality
        let refreshCount = 30;
        const autoRefreshElement = document.getElementById('autoRefresh');
        
        setInterval(() => {
            refreshCount--;
            autoRefreshElement.textContent = \`🔄 Auto-refresh: \${refreshCount}s\`;
            
            if (refreshCount <= 0) {
                autoRefreshElement.classList.add('refreshing');
                autoRefreshElement.textContent = '🔄 Refreshing...';
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        }, 1000);
    </script>
</body>
</html>`;
  }

  async generateDashboard(): Promise<void> {
    await this.ensureDataDir();
    
    console.log('📊 Generating real-time performance dashboard...');

    // Load data
    const [healthData, baselineData] = await Promise.all([
      this.loadHistoricalData(),
      this.loadBaselineData()
    ]);

    console.log(`📈 Loaded ${healthData.length} health check entries and ${baselineData.length} baseline tests`);

    // Analyze metrics
    const metrics = this.analyzeMetrics(healthData, baselineData);
    const endpointMetrics = this.getEndpointMetrics(healthData);

    // Generate HTML
    const html = this.generateDashboardHTML(metrics, endpointMetrics, healthData);

    // Write dashboard
    await Deno.writeTextFile(this.dashboardFile, html);

    // Save metrics data
    const metricsData = {
      timestamp: new Date().toISOString(),
      metrics,
      endpointMetrics,
    };
    await Deno.writeTextFile(`${this.dataDir}/latest-metrics.json`, JSON.stringify(metricsData, null, 2));

    console.log(`✅ Dashboard generated: ${this.dashboardFile}`);
    console.log(`📊 Metrics saved: ${this.dataDir}/latest-metrics.json`);
  }

  async startContinuousGeneration(intervalMinutes = 1): Promise<void> {
    console.log(`🚀 Starting continuous dashboard generation (interval: ${intervalMinutes} minutes)`);
    
    // Generate initial dashboard
    await this.generateDashboard();
    
    // Schedule regeneration
    setInterval(async () => {
      try {
        await this.generateDashboard();
        console.log(`🔄 Dashboard updated - ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error('❌ Failed to update dashboard:', error.message);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

// CLI Interface
if (import.meta.main) {
  const args = Deno.args;
  const apiUrl = Deno.env.get('API_URL') || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  
  const dashboard = new RealTimeDashboard(apiUrl);
  
  if (args.includes('--continuous') || args.includes('-c')) {
    const interval = parseInt(Deno.env.get('DASHBOARD_REFRESH_INTERVAL') || '1');
    try {
      await dashboard.startContinuousGeneration(interval);
    } catch (error) {
      console.error('❌ Dashboard generation failed:', error.message);
      Deno.exit(1);
    }
  } else {
    // Generate single dashboard
    try {
      await dashboard.generateDashboard();
      console.log('\n🌐 Open performance-dashboard.html in your browser to view the dashboard');
    } catch (error) {
      console.error('❌ Dashboard generation failed:', error.message);
      Deno.exit(1);
    }
  }
}