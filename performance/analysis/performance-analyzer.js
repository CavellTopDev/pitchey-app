/**
 * Performance Analysis and Reporting Tool
 * Aggregates and analyzes performance test results from multiple sources
 */

const fs = require('fs').promises;
const path = require('path');

class PerformanceAnalyzer {
  constructor(reportsDirectory = './performance/reports') {
    this.reportsDir = reportsDirectory;
    this.trends = {
      api: [],
      lighthouse: [],
      websocket: [],
      database: []
    };
    this.baselines = {};
    this.alerts = [];
  }

  /**
   * Load and parse all performance test reports
   */
  async loadReports() {
    try {
      const files = await fs.readdir(this.reportsDir);
      const reports = {
        k6: [],
        lighthouse: [],
        websocket: [],
        database: []
      };

      for (const file of files) {
        const filePath = path.join(this.reportsDir, file);
        
        try {
          if (file.includes('k6-summary') && file.endsWith('.json')) {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            reports.k6.push({ file, data, timestamp: this.extractTimestamp(file) });
          }
          
          if (file.includes('performance-results') && file.endsWith('.json')) {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            reports.lighthouse.push({ file, data, timestamp: this.extractTimestamp(file) });
          }
          
          if (file.includes('ws-summary') && file.endsWith('.json')) {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            reports.websocket.push({ file, data, timestamp: this.extractTimestamp(file) });
          }
          
          if (file.includes('db-stress') && file.endsWith('.json')) {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            reports.database.push({ file, data, timestamp: this.extractTimestamp(file) });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      }

      // Sort by timestamp (newest first)
      Object.keys(reports).forEach(key => {
        reports[key].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      });

      return reports;
    } catch (error) {
      console.error('Failed to load reports:', error);
      return { k6: [], lighthouse: [], websocket: [], database: [] };
    }
  }

  /**
   * Extract timestamp from filename
   */
  extractTimestamp(filename) {
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return match ? match[1].replace(/-/g, ':') : new Date().toISOString();
  }

  /**
   * Analyze K6 load test results
   */
  analyzeK6Results(reports) {
    if (reports.length === 0) return null;

    const latest = reports[0];
    const metrics = latest.data.metrics || {};

    const analysis = {
      timestamp: latest.timestamp,
      summary: {
        totalRequests: metrics.http_reqs?.count || 0,
        requestRate: metrics.http_reqs?.rate || 0,
        errorRate: (metrics.http_req_failed?.rate || 0) * 100,
        averageResponseTime: metrics.http_req_duration?.avg || 0,
        p95ResponseTime: metrics.http_req_duration?.p95 || 0,
        p99ResponseTime: metrics.http_req_duration?.p99 || 0,
      },
      thresholds: {
        passed: Object.values(latest.data.thresholds || {}).filter(t => t.ok).length,
        total: Object.keys(latest.data.thresholds || {}).length,
        violations: Object.entries(latest.data.thresholds || {})
          .filter(([_, result]) => !result.ok)
          .map(([name]) => name),
      },
      trends: this.calculateTrends(reports, 'k6'),
    };

    // Performance assessment
    analysis.assessment = this.assessK6Performance(analysis);
    
    return analysis;
  }

  /**
   * Analyze Lighthouse Core Web Vitals results
   */
  analyzeLighthouseResults(reports) {
    if (reports.length === 0) return null;

    const latest = reports[0];
    const data = latest.data;

    const analysis = {
      timestamp: latest.timestamp,
      summary: {
        totalScenarios: data.summary?.total || 0,
        passedScenarios: data.summary?.passed || 0,
        failedScenarios: data.summary?.failed || 0,
        avgPerformanceScore: data.summary?.avgPerformanceScore || 0,
      },
      scenarios: data.results?.map(result => ({
        name: result.scenario,
        status: result.status,
        performanceScore: result.scores?.performance?.score || 0,
        coreWebVitals: {
          LCP: result.coreWebVitals?.LCP?.value || 0,
          FID: result.coreWebVitals?.FID?.value || 0,
          CLS: result.coreWebVitals?.CLS?.value || 0,
          FCP: result.coreWebVitals?.FCP?.value || 0,
          TTI: result.coreWebVitals?.TTI?.value || 0,
        },
        recommendations: result.recommendations || [],
      })) || [],
      trends: this.calculateTrends(reports, 'lighthouse'),
    };

    analysis.assessment = this.assessLighthousePerformance(analysis);

    return analysis;
  }

  /**
   * Analyze WebSocket performance results
   */
  analyzeWebSocketResults(reports) {
    if (reports.length === 0) return null;

    const latest = reports[0];
    const metrics = latest.data.metrics || {};

    const analysis = {
      timestamp: latest.timestamp,
      summary: {
        messagesSent: metrics.ws_messages_sent?.count || 0,
        messagesReceived: metrics.ws_messages_received?.count || 0,
        averageLatency: metrics.ws_message_latency?.avg || 0,
        connectionErrors: (metrics.ws_connection_errors?.rate || 0) * 100,
        messageErrors: (metrics.ws_message_errors?.rate || 0) * 100,
      },
      trends: this.calculateTrends(reports, 'websocket'),
    };

    analysis.assessment = this.assessWebSocketPerformance(analysis);

    return analysis;
  }

  /**
   * Analyze database performance results
   */
  analyzeDatabaseResults(reports) {
    if (reports.length === 0) return null;

    const latest = reports[0];
    const metrics = latest.data.metrics || {};

    const analysis = {
      timestamp: latest.timestamp,
      summary: {
        averageQueryTime: metrics.db_query_latency?.avg || 0,
        p95QueryTime: metrics.db_query_latency?.p95 || 0,
        slowQueries: (metrics.db_slow_queries?.rate || 0) * 100,
        connectionErrors: (metrics.db_connection_errors?.rate || 0) * 100,
        deadlocks: metrics.db_deadlocks?.count || 0,
      },
      trends: this.calculateTrends(reports, 'database'),
    };

    analysis.assessment = this.assessDatabasePerformance(analysis);

    return analysis;
  }

  /**
   * Calculate performance trends across multiple reports
   */
  calculateTrends(reports, type) {
    if (reports.length < 2) return { trend: 'insufficient_data', change: 0 };

    const latest = reports[0];
    const previous = reports[1];

    let currentValue, previousValue;

    switch (type) {
      case 'k6':
        currentValue = latest.data.metrics?.http_req_duration?.avg || 0;
        previousValue = previous.data.metrics?.http_req_duration?.avg || 0;
        break;
      case 'lighthouse':
        currentValue = latest.data.summary?.avgPerformanceScore || 0;
        previousValue = previous.data.summary?.avgPerformanceScore || 0;
        break;
      case 'websocket':
        currentValue = latest.data.metrics?.ws_message_latency?.avg || 0;
        previousValue = previous.data.metrics?.ws_message_latency?.avg || 0;
        break;
      case 'database':
        currentValue = latest.data.metrics?.db_query_latency?.avg || 0;
        previousValue = previous.data.metrics?.db_query_latency?.avg || 0;
        break;
      default:
        return { trend: 'unknown', change: 0 };
    }

    if (previousValue === 0) return { trend: 'insufficient_data', change: 0 };

    const changePercent = ((currentValue - previousValue) / previousValue) * 100;

    let trend;
    if (type === 'lighthouse') {
      // For lighthouse, higher is better
      trend = changePercent > 5 ? 'improving' : changePercent < -5 ? 'degrading' : 'stable';
    } else {
      // For other metrics, lower is better
      trend = changePercent > 10 ? 'degrading' : changePercent < -10 ? 'improving' : 'stable';
    }

    return {
      trend,
      change: changePercent,
      current: currentValue,
      previous: previousValue,
    };
  }

  /**
   * Assess K6 performance and generate recommendations
   */
  assessK6Performance(analysis) {
    const issues = [];
    const recommendations = [];
    let overall = 'good';

    // Check error rate
    if (analysis.summary.errorRate > 5) {
      issues.push('High error rate detected');
      recommendations.push('Investigate server errors and timeout issues');
      overall = 'critical';
    } else if (analysis.summary.errorRate > 1) {
      issues.push('Elevated error rate');
      recommendations.push('Monitor error patterns and consider scaling');
      overall = 'warning';
    }

    // Check response times
    if (analysis.summary.p95ResponseTime > 2000) {
      issues.push('Slow response times');
      recommendations.push('Optimize database queries and add caching');
      overall = overall === 'good' ? 'warning' : overall;
    }

    // Check threshold violations
    if (analysis.thresholds.violations.length > 0) {
      issues.push(`${analysis.thresholds.violations.length} threshold violations`);
      recommendations.push('Review and adjust performance thresholds');
      overall = overall === 'good' ? 'warning' : overall;
    }

    // Check trends
    if (analysis.trends.trend === 'degrading') {
      issues.push('Performance degrading over time');
      recommendations.push('Investigate recent changes and optimize performance');
      overall = overall === 'good' ? 'warning' : overall;
    }

    return {
      overall,
      issues,
      recommendations,
      score: this.calculatePerformanceScore(analysis.summary, 'k6'),
    };
  }

  /**
   * Assess Lighthouse performance
   */
  assessLighthousePerformance(analysis) {
    const issues = [];
    const recommendations = [];
    let overall = 'good';

    // Check overall performance score
    if (analysis.summary.avgPerformanceScore < 70) {
      issues.push('Low overall performance score');
      recommendations.push('Focus on Core Web Vitals optimization');
      overall = 'critical';
    } else if (analysis.summary.avgPerformanceScore < 85) {
      issues.push('Below-target performance score');
      recommendations.push('Optimize images, JavaScript, and CSS delivery');
      overall = 'warning';
    }

    // Check failed scenarios
    if (analysis.summary.failedScenarios > 0) {
      issues.push(`${analysis.summary.failedScenarios} scenarios failed performance targets`);
      recommendations.push('Review failed scenarios and implement optimizations');
      overall = overall === 'good' ? 'warning' : overall;
    }

    // Check Core Web Vitals across scenarios
    const avgLCP = analysis.scenarios.reduce((sum, s) => sum + s.coreWebVitals.LCP, 0) / analysis.scenarios.length;
    const avgCLS = analysis.scenarios.reduce((sum, s) => sum + s.coreWebVitals.CLS, 0) / analysis.scenarios.length;

    if (avgLCP > 2500) {
      issues.push('Poor Largest Contentful Paint (LCP)');
      recommendations.push('Optimize critical resource loading and server response times');
      overall = overall === 'good' ? 'warning' : overall;
    }

    if (avgCLS > 0.1) {
      issues.push('High Cumulative Layout Shift (CLS)');
      recommendations.push('Set explicit dimensions for images and reserve space for dynamic content');
      overall = overall === 'good' ? 'warning' : overall;
    }

    return {
      overall,
      issues,
      recommendations,
      score: analysis.summary.avgPerformanceScore,
    };
  }

  /**
   * Assess WebSocket performance
   */
  assessWebSocketPerformance(analysis) {
    const issues = [];
    const recommendations = [];
    let overall = 'good';

    // Check connection errors
    if (analysis.summary.connectionErrors > 5) {
      issues.push('High WebSocket connection error rate');
      recommendations.push('Investigate connection stability and Durable Object limits');
      overall = 'critical';
    }

    // Check message latency
    if (analysis.summary.averageLatency > 500) {
      issues.push('High WebSocket message latency');
      recommendations.push('Optimize message processing and reduce payload size');
      overall = overall === 'good' ? 'warning' : overall;
    }

    // Check message success rate
    const messageSuccessRate = 100 - analysis.summary.messageErrors;
    if (messageSuccessRate < 95) {
      issues.push('Poor WebSocket message delivery rate');
      recommendations.push('Implement message retry logic and improve error handling');
      overall = overall === 'good' ? 'warning' : overall;
    }

    return {
      overall,
      issues,
      recommendations,
      score: Math.max(0, 100 - analysis.summary.connectionErrors - (analysis.summary.averageLatency / 10)),
    };
  }

  /**
   * Assess database performance
   */
  assessDatabasePerformance(analysis) {
    const issues = [];
    const recommendations = [];
    let overall = 'good';

    // Check query performance
    if (analysis.summary.p95QueryTime > 1000) {
      issues.push('Slow database queries detected');
      recommendations.push('Add database indexes and optimize query patterns');
      overall = 'critical';
    } else if (analysis.summary.averageQueryTime > 200) {
      issues.push('Elevated database query times');
      recommendations.push('Review query performance and consider connection pooling');
      overall = 'warning';
    }

    // Check connection errors
    if (analysis.summary.connectionErrors > 2) {
      issues.push('Database connection issues');
      recommendations.push('Investigate connection pool configuration and database capacity');
      overall = overall === 'good' ? 'warning' : overall;
    }

    // Check deadlocks
    if (analysis.summary.deadlocks > 0) {
      issues.push('Database deadlocks detected');
      recommendations.push('Review transaction isolation levels and query ordering');
      overall = overall === 'good' ? 'warning' : overall;
    }

    return {
      overall,
      issues,
      recommendations,
      score: Math.max(0, 100 - (analysis.summary.averageQueryTime / 10) - (analysis.summary.connectionErrors * 5)),
    };
  }

  /**
   * Calculate a normalized performance score
   */
  calculatePerformanceScore(metrics, type) {
    switch (type) {
      case 'k6':
        const errorPenalty = metrics.errorRate * 10;
        const latencyPenalty = Math.min(metrics.p95ResponseTime / 100, 50);
        return Math.max(0, 100 - errorPenalty - latencyPenalty);
      default:
        return 50; // Default neutral score
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport() {
    const reports = await this.loadReports();
    
    const analysis = {
      timestamp: new Date().toISOString(),
      summary: {
        totalReports: Object.values(reports).reduce((sum, arr) => sum + arr.length, 0),
        lastUpdated: reports.k6[0]?.timestamp || reports.lighthouse[0]?.timestamp || new Date().toISOString(),
      },
      api: this.analyzeK6Results(reports.k6),
      frontend: this.analyzeLighthouseResults(reports.lighthouse),
      websocket: this.analyzeWebSocketResults(reports.websocket),
      database: this.analyzeDatabaseResults(reports.database),
    };

    // Calculate overall system health
    const scores = [
      analysis.api?.assessment?.score || 50,
      analysis.frontend?.assessment?.score || 50,
      analysis.websocket?.assessment?.score || 50,
      analysis.database?.assessment?.score || 50,
    ];
    
    analysis.overall = {
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      status: this.determineOverallStatus(analysis),
      recommendations: this.generateOverallRecommendations(analysis),
    };

    return analysis;
  }

  /**
   * Determine overall system status
   */
  determineOverallStatus(analysis) {
    const assessments = [
      analysis.api?.assessment?.overall,
      analysis.frontend?.assessment?.overall,
      analysis.websocket?.assessment?.overall,
      analysis.database?.assessment?.overall,
    ].filter(Boolean);

    if (assessments.includes('critical')) return 'critical';
    if (assessments.includes('warning')) return 'warning';
    return 'good';
  }

  /**
   * Generate system-wide recommendations
   */
  generateOverallRecommendations(analysis) {
    const recommendations = [];

    // Collect all recommendations from different areas
    [analysis.api, analysis.frontend, analysis.websocket, analysis.database]
      .filter(Boolean)
      .forEach(area => {
        if (area.assessment?.recommendations) {
          recommendations.push(...area.assessment.recommendations);
        }
      });

    // Add system-wide recommendations
    if (analysis.overall.score < 70) {
      recommendations.unshift('Consider comprehensive performance review and optimization');
    }

    // Remove duplicates and return top 5
    return [...new Set(recommendations)].slice(0, 5);
  }

  /**
   * Generate HTML performance dashboard
   */
  async generateHTMLDashboard(analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dashboardPath = path.join(this.reportsDir, `performance-dashboard-${timestamp}.html`);

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Pitchey Performance Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
            color: #2c3e50;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .score {
            font-size: 4rem;
            font-weight: bold;
            margin: 20px 0;
        }
        .score.good { color: #27ae60; }
        .score.warning { color: #f39c12; }
        .score.critical { color: #e74c3c; }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-good { background: #27ae60; }
        .status-warning { background: #f39c12; }
        .status-critical { background: #e74c3c; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 15px;
        }
        .card-title { font-size: 1.2rem; font-weight: bold; }
        .metric { margin: 10px 0; }
        .metric-label { color: #7f8c8d; font-size: 0.9rem; }
        .metric-value { font-weight: bold; font-size: 1.1rem; }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .recommendations h3 { margin-top: 0; color: #856404; }
        .recommendations ul { margin: 10px 0; }
        .recommendations li { margin: 5px 0; }
        .trend {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .trend-improving { background: #d4edda; color: #155724; }
        .trend-stable { background: #d1ecf1; color: #0c5460; }
        .trend-degrading { background: #f8d7da; color: #721c24; }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #7f8c8d;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Pitchey Performance Dashboard</h1>
            <div class="score ${analysis.overall.status}">${analysis.overall.score}</div>
            <span class="status-badge status-${analysis.overall.status}">${analysis.overall.status}</span>
            <p>Last Updated: ${new Date(analysis.timestamp).toLocaleString()}</p>
        </div>

        <div class="grid">
            ${this.generateAPICard(analysis.api)}
            ${this.generateFrontendCard(analysis.frontend)}
            ${this.generateWebSocketCard(analysis.websocket)}
            ${this.generateDatabaseCard(analysis.database)}
        </div>

        ${analysis.overall.recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>🎯 System Recommendations</h3>
            <ul>
                ${analysis.overall.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="footer">
            <p>Generated by Pitchey Performance Analysis Framework</p>
            <p>Report ID: dashboard-${timestamp}</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 5 * 60 * 1000);
    </script>
</body>
</html>`;

    await fs.writeFile(dashboardPath, html);
    return dashboardPath;
  }

  generateAPICard(api) {
    if (!api) {
      return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🌐 API Performance</div>
                <span class="status-badge status-warning">No Data</span>
            </div>
            <p>No API performance data available</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🌐 API Performance</div>
          <span class="status-badge status-${api.assessment.overall}">${api.assessment.overall}</span>
        </div>
        <div class="metric">
          <div class="metric-label">Average Response Time</div>
          <div class="metric-value">${Math.round(api.summary.averageResponseTime)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">95th Percentile</div>
          <div class="metric-value">${Math.round(api.summary.p95ResponseTime)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">Error Rate</div>
          <div class="metric-value">${api.summary.errorRate.toFixed(2)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Request Rate</div>
          <div class="metric-value">${api.summary.requestRate.toFixed(1)} req/s</div>
        </div>
        ${api.trends.trend !== 'insufficient_data' ? `
          <div class="metric">
            <div class="metric-label">Trend</div>
            <span class="trend trend-${api.trends.trend}">
              ${api.trends.trend} ${api.trends.change > 0 ? '+' : ''}${api.trends.change.toFixed(1)}%
            </span>
          </div>
        ` : ''}
      </div>
    `;
  }

  generateFrontendCard(frontend) {
    if (!frontend) {
      return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🎨 Frontend Performance</div>
                <span class="status-badge status-warning">No Data</span>
            </div>
            <p>No frontend performance data available</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🎨 Frontend Performance</div>
          <span class="status-badge status-${frontend.assessment.overall}">${frontend.assessment.overall}</span>
        </div>
        <div class="metric">
          <div class="metric-label">Performance Score</div>
          <div class="metric-value">${Math.round(frontend.summary.avgPerformanceScore)}/100</div>
        </div>
        <div class="metric">
          <div class="metric-label">Scenarios Passed</div>
          <div class="metric-value">${frontend.summary.passedScenarios}/${frontend.summary.totalScenarios}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Core Web Vitals</div>
          <div class="metric-value">
            ${frontend.scenarios.length > 0 ? 
              `LCP: ${Math.round(frontend.scenarios[0].coreWebVitals.LCP)}ms` : 
              'No data'
            }
          </div>
        </div>
      </div>
    `;
  }

  generateWebSocketCard(websocket) {
    if (!websocket) {
      return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🔌 WebSocket Performance</div>
                <span class="status-badge status-warning">No Data</span>
            </div>
            <p>No WebSocket performance data available</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔌 WebSocket Performance</div>
          <span class="status-badge status-${websocket.assessment.overall}">${websocket.assessment.overall}</span>
        </div>
        <div class="metric">
          <div class="metric-label">Average Latency</div>
          <div class="metric-value">${Math.round(websocket.summary.averageLatency)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">Messages Sent</div>
          <div class="metric-value">${websocket.summary.messagesSent}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Connection Errors</div>
          <div class="metric-value">${websocket.summary.connectionErrors.toFixed(2)}%</div>
        </div>
      </div>
    `;
  }

  generateDatabaseCard(database) {
    if (!database) {
      return `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🗄️ Database Performance</div>
                <span class="status-badge status-warning">No Data</span>
            </div>
            <p>No database performance data available</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗄️ Database Performance</div>
          <span class="status-badge status-${database.assessment.overall}">${database.assessment.overall}</span>
        </div>
        <div class="metric">
          <div class="metric-label">Average Query Time</div>
          <div class="metric-value">${Math.round(database.summary.averageQueryTime)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">95th Percentile</div>
          <div class="metric-value">${Math.round(database.summary.p95QueryTime)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">Connection Errors</div>
          <div class="metric-value">${database.summary.connectionErrors.toFixed(2)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Deadlocks</div>
          <div class="metric-value">${database.summary.deadlocks}</div>
        </div>
      </div>
    `;
  }

  /**
   * Generate JSON report for CI/CD integration
   */
  async generateJSONReport(analysis) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportsDir, `performance-analysis-${timestamp}.json`);

    const jsonReport = {
      ...analysis,
      cicd: {
        success: analysis.overall.status !== 'critical',
        score: analysis.overall.score,
        thresholds: {
          minimumScore: 70,
          passed: analysis.overall.score >= 70,
        },
        alerts: analysis.overall.status === 'critical' ? 
          ['Critical performance issues detected'] : 
          analysis.overall.status === 'warning' ?
          ['Performance warnings detected'] : [],
      },
    };

    await fs.writeFile(reportPath, JSON.stringify(jsonReport, null, 2));
    return reportPath;
  }

  /**
   * Main analysis runner
   */
  async run() {
    console.log('🔍 Starting Performance Analysis...');
    
    try {
      const analysis = await this.generateReport();
      
      // Generate reports
      const htmlPath = await this.generateHTMLDashboard(analysis);
      const jsonPath = await this.generateJSONReport(analysis);
      
      console.log('\n📊 Performance Analysis Complete');
      console.log(`Overall Score: ${analysis.overall.score}/100`);
      console.log(`Status: ${analysis.overall.status.toUpperCase()}`);
      console.log(`\nReports generated:`);
      console.log(`📄 HTML Dashboard: ${htmlPath}`);
      console.log(`📋 JSON Report: ${jsonPath}`);
      
      // Exit with appropriate code for CI/CD
      const success = analysis.overall.status !== 'critical';
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const reportsDir = process.argv[2] || './performance/reports';
  const analyzer = new PerformanceAnalyzer(reportsDir);
  analyzer.run();
}

module.exports = PerformanceAnalyzer;