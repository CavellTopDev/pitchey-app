#!/usr/bin/env -S deno run --allow-all

/**
 * Neon PostgreSQL Database Metrics Dashboard
 * Real-time monitoring and performance tracking for production database
 * Usage: deno run --allow-all database-metrics.ts [--mode=dashboard|api|export]
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serve } from "@std/http/server.ts";

// Database connection
const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

// Metrics collection intervals
const METRICS_REFRESH_INTERVAL = 5000; // 5 seconds
const CACHE_TTL = 30000; // 30 seconds

// Metrics cache
let metricsCache: any = null;
let lastCacheUpdate = 0;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

// Logging utility
function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const colorMap: Record<string, string> = {
    'INFO': colors.blue,
    'SUCCESS': colors.green,
    'WARN': colors.yellow,
    'ERROR': colors.red,
    'METRICS': colors.cyan,
  };
  
  console.log(`${colorMap[level] || ''}[${timestamp}] [${level}] ${message}${colors.reset}`);
}

// Database metrics collector
class DatabaseMetrics {
  
  // Get database connection information
  async getConnectionInfo(): Promise<any> {
    try {
      const result = await sql`
        SELECT 
          current_database() as database_name,
          current_user as current_user,
          version() as postgres_version,
          now() as current_time,
          pg_database_size(current_database()) as database_size_bytes,
          pg_size_pretty(pg_database_size(current_database())) as database_size_pretty
      `;
      
      return result[0];
    } catch (error) {
      log('ERROR', `Failed to get connection info: ${error.message}`);
      return null;
    }
  }

  // Get real-time connection statistics
  async getConnectionStats(): Promise<any> {
    try {
      const result = await sql`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          count(*) FILTER (WHERE state = 'disabled') as disabled_connections,
          max(EXTRACT(EPOCH FROM (now() - query_start))) as longest_query_duration,
          avg(EXTRACT(EPOCH FROM (now() - query_start))) FILTER (WHERE state = 'active') as avg_active_query_duration
        FROM pg_stat_activity
        WHERE pid != pg_backend_pid()
      `;
      
      return result[0];
    } catch (error) {
      log('ERROR', `Failed to get connection stats: ${error.message}`);
      return null;
    }
  }

  // Get table size and growth metrics
  async getTableMetrics(): Promise<any[]> {
    try {
      const result = await sql`
        SELECT 
          schemaname,
          tablename,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size_pretty,
          COALESCE(n_tup_ins, 0) as inserts,
          COALESCE(n_tup_upd, 0) as updates,
          COALESCE(n_tup_del, 0) as deletes,
          COALESCE(n_live_tup, 0) as live_tuples,
          COALESCE(n_dead_tup, 0) as dead_tuples,
          COALESCE(n_tup_hot_upd, 0) as hot_updates,
          COALESCE(last_vacuum, '1970-01-01'::timestamp) as last_vacuum,
          COALESCE(last_analyze, '1970-01-01'::timestamp) as last_analyze,
          EXTRACT(EPOCH FROM (now() - COALESCE(last_vacuum, '1970-01-01'::timestamp))) / 3600 as hours_since_vacuum,
          EXTRACT(EPOCH FROM (now() - COALESCE(last_analyze, '1970-01-01'::timestamp))) / 3600 as hours_since_analyze
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
        WHERE t.schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `;
      
      return result;
    } catch (error) {
      log('ERROR', `Failed to get table metrics: ${error.message}`);
      return [];
    }
  }

  // Get index usage statistics
  async getIndexMetrics(): Promise<any[]> {
    try {
      const result = await sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as times_used,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          CASE 
            WHEN idx_scan = 0 THEN 'unused'
            WHEN idx_scan < 100 THEN 'low_usage'
            WHEN idx_scan < 1000 THEN 'medium_usage'
            ELSE 'high_usage'
          END as usage_category
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
        LIMIT 20
      `;
      
      return result;
    } catch (error) {
      log('ERROR', `Failed to get index metrics: ${error.message}`);
      return [];
    }
  }

  // Get query performance statistics
  async getQueryPerformance(): Promise<any[]> {
    try {
      // Check if pg_stat_statements is available
      const extensionCheck = await sql`
        SELECT count(*) as count 
        FROM pg_extension 
        WHERE extname = 'pg_stat_statements'
      `;
      
      if (extensionCheck[0]?.count === 0) {
        log('WARN', 'pg_stat_statements extension not available');
        return [];
      }

      const result = await sql`
        SELECT 
          LEFT(query, 100) as query_preview,
          calls,
          total_time,
          mean_time,
          max_time,
          min_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio,
          CASE 
            WHEN mean_time > 1000 THEN 'slow'
            WHEN mean_time > 100 THEN 'medium'
            ELSE 'fast'
          END as performance_category
        FROM pg_stat_statements 
        WHERE calls > 5  -- Only queries called more than 5 times
        ORDER BY total_time DESC 
        LIMIT 15
      `;
      
      return result;
    } catch (error) {
      log('ERROR', `Failed to get query performance: ${error.message}`);
      return [];
    }
  }

  // Get cache hit ratios
  async getCacheMetrics(): Promise<any> {
    try {
      const tableCache = await sql`
        SELECT 
          COALESCE(
            round(
              (sum(heap_blks_hit) * 100.0) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 
              2
            ), 0
          ) as table_cache_hit_ratio
        FROM pg_statio_user_tables
      `;
      
      const indexCache = await sql`
        SELECT 
          COALESCE(
            round(
              (sum(idx_blks_hit) * 100.0) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 
              2
            ), 0
          ) as index_cache_hit_ratio
        FROM pg_statio_user_indexes
      `;
      
      return {
        table_cache_hit_ratio: tableCache[0]?.table_cache_hit_ratio || 0,
        index_cache_hit_ratio: indexCache[0]?.index_cache_hit_ratio || 0,
      };
    } catch (error) {
      log('ERROR', `Failed to get cache metrics: ${error.message}`);
      return { table_cache_hit_ratio: 0, index_cache_hit_ratio: 0 };
    }
  }

  // Get lock information
  async getLockMetrics(): Promise<any[]> {
    try {
      const result = await sql`
        SELECT 
          l.locktype,
          l.database,
          COALESCE(l.relation::regclass::text, 'N/A') as relation,
          l.mode,
          l.granted,
          a.usename,
          a.application_name,
          EXTRACT(EPOCH FROM (now() - a.query_start)) * 1000 as duration_ms,
          LEFT(a.query, 80) as query_preview,
          CASE 
            WHEN NOT l.granted THEN 'blocked'
            WHEN EXTRACT(EPOCH FROM (now() - a.query_start)) > 30 THEN 'long_running'
            ELSE 'normal'
          END as lock_status
        FROM pg_locks l
        LEFT JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE a.query IS NOT NULL
        AND a.query NOT LIKE '%pg_locks%'
        ORDER BY EXTRACT(EPOCH FROM (now() - a.query_start)) DESC
        LIMIT 10
      `;
      
      return result;
    } catch (error) {
      log('ERROR', `Failed to get lock metrics: ${error.message}`);
      return [];
    }
  }

  // Get replication status (if applicable)
  async getReplicationMetrics(): Promise<any[]> {
    try {
      const result = await sql`
        SELECT 
          application_name,
          client_addr,
          state,
          sent_lsn,
          write_lsn,
          flush_lsn,
          replay_lsn,
          EXTRACT(EPOCH FROM (now() - backend_start)) as connection_age_seconds,
          CASE 
            WHEN state = 'streaming' THEN 'healthy'
            WHEN state = 'catchup' THEN 'catching_up'
            ELSE 'unhealthy'
          END as replication_health
        FROM pg_stat_replication
      `;
      
      return result;
    } catch (error) {
      // Replication might not be configured, which is normal
      return [];
    }
  }

  // Get comprehensive metrics
  async getAllMetrics(): Promise<any> {
    const startTime = Date.now();
    
    try {
      const [
        connectionInfo,
        connectionStats,
        tableMetrics,
        indexMetrics,
        queryPerformance,
        cacheMetrics,
        lockMetrics,
        replicationMetrics,
      ] = await Promise.all([
        this.getConnectionInfo(),
        this.getConnectionStats(),
        this.getTableMetrics(),
        this.getIndexMetrics(),
        this.getQueryPerformance(),
        this.getCacheMetrics(),
        this.getLockMetrics(),
        this.getReplicationMetrics(),
      ]);

      const collectionTime = Date.now() - startTime;

      return {
        timestamp: new Date().toISOString(),
        collection_time_ms: collectionTime,
        database: {
          info: connectionInfo,
          connections: connectionStats,
          cache: cacheMetrics,
        },
        tables: {
          metrics: tableMetrics,
          total_tables: tableMetrics.length,
          total_size_bytes: tableMetrics.reduce((sum, table) => sum + (table.total_size_bytes || 0), 0),
        },
        indexes: {
          metrics: indexMetrics,
          total_indexes: indexMetrics.length,
          unused_indexes: indexMetrics.filter(idx => idx.usage_category === 'unused').length,
        },
        queries: {
          performance: queryPerformance,
          slow_queries: queryPerformance.filter(q => q.performance_category === 'slow').length,
        },
        locks: {
          active_locks: lockMetrics,
          blocked_queries: lockMetrics.filter(l => l.lock_status === 'blocked').length,
          long_running_queries: lockMetrics.filter(l => l.lock_status === 'long_running').length,
        },
        replication: {
          replicas: replicationMetrics,
          healthy_replicas: replicationMetrics.filter(r => r.replication_health === 'healthy').length,
        },
        alerts: this.generateAlerts({
          connectionStats,
          cacheMetrics,
          tableMetrics,
          queryPerformance,
          lockMetrics,
        }),
      };
    } catch (error) {
      log('ERROR', `Failed to collect metrics: ${error.message}`);
      throw error;
    }
  }

  // Generate alerts based on metrics
  generateAlerts(metrics: any): any[] {
    const alerts = [];
    
    // High connection usage
    if (metrics.connectionStats?.total_connections > 80) {
      alerts.push({
        severity: 'warning',
        type: 'high_connections',
        message: `High connection usage: ${metrics.connectionStats.total_connections} connections`,
        value: metrics.connectionStats.total_connections,
        threshold: 80,
      });
    }
    
    // Low cache hit ratio
    if (metrics.cacheMetrics?.table_cache_hit_ratio < 95) {
      alerts.push({
        severity: 'warning',
        type: 'low_cache_hit_ratio',
        message: `Low table cache hit ratio: ${metrics.cacheMetrics.table_cache_hit_ratio}%`,
        value: metrics.cacheMetrics.table_cache_hit_ratio,
        threshold: 95,
      });
    }
    
    // Slow queries
    if (metrics.queryPerformance?.length > 0) {
      const slowQueries = metrics.queryPerformance.filter((q: any) => q.performance_category === 'slow');
      if (slowQueries.length > 0) {
        alerts.push({
          severity: 'info',
          type: 'slow_queries',
          message: `${slowQueries.length} slow queries detected`,
          value: slowQueries.length,
          threshold: 0,
        });
      }
    }
    
    // Large tables
    if (metrics.tableMetrics?.length > 0) {
      const largeTables = metrics.tableMetrics.filter((t: any) => t.total_size_bytes > 100 * 1024 * 1024); // > 100MB
      if (largeTables.length > 0) {
        alerts.push({
          severity: 'info',
          type: 'large_tables',
          message: `${largeTables.length} tables larger than 100MB`,
          value: largeTables.length,
          threshold: 0,
        });
      }
    }
    
    // Blocked queries
    if (metrics.lockMetrics?.length > 0) {
      const blockedQueries = metrics.lockMetrics.filter((l: any) => l.lock_status === 'blocked');
      if (blockedQueries.length > 0) {
        alerts.push({
          severity: 'critical',
          type: 'blocked_queries',
          message: `${blockedQueries.length} queries are blocked`,
          value: blockedQueries.length,
          threshold: 0,
        });
      }
    }
    
    return alerts;
  }
}

// Dashboard HTML generator
function generateDashboardHTML(metrics: any): string {
  const alertColors = {
    critical: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neon PostgreSQL Database Metrics Dashboard</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8f9fa; 
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            text-align: center;
        }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-bottom: 20px; 
        }
        .metric-card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .metric-title { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            color: #495057; 
        }
        .metric-value { 
            font-size: 24px; 
            font-weight: bold; 
            color: #28a745; 
            margin-bottom: 10px; 
        }
        .metric-subtitle { 
            font-size: 14px; 
            color: #6c757d; 
        }
        .alerts { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            margin-bottom: 20px; 
        }
        .alert { 
            padding: 10px; 
            border-radius: 4px; 
            margin-bottom: 10px; 
            color: white; 
        }
        .table-container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            margin-bottom: 20px; 
            overflow-x: auto; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 14px; 
        }
        th, td { 
            padding: 8px; 
            text-align: left; 
            border-bottom: 1px solid #dee2e6; 
        }
        th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
        }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px; 
        }
        .status-good { background-color: #28a745; }
        .status-warning { background-color: #ffc107; }
        .status-critical { background-color: #dc3545; }
        .refresh-info { 
            text-align: center; 
            color: #6c757d; 
            font-size: 14px; 
            margin-top: 20px; 
        }
        @media (max-width: 768px) {
            .metrics-grid { grid-template-columns: 1fr; }
            body { padding: 10px; }
        }
    </style>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => window.location.reload(), 30000);
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Neon PostgreSQL Database Metrics</h1>
            <p>Real-time monitoring dashboard • Last updated: ${new Date(metrics.timestamp).toLocaleString()}</p>
            <p>Collection time: ${metrics.collection_time_ms}ms</p>
        </div>

        ${metrics.alerts.length > 0 ? `
        <div class="alerts">
            <div class="metric-title">🚨 Active Alerts</div>
            ${metrics.alerts.map((alert: any) => `
                <div class="alert" style="background-color: ${alertColors[alert.severity] || '#6c757d'};">
                    <strong>${alert.type.replace(/_/g, ' ').toUpperCase()}</strong>: ${alert.message}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">📡 Database Connection</div>
                <div class="metric-value">${metrics.database.info?.database_name || 'N/A'}</div>
                <div class="metric-subtitle">
                    Size: ${metrics.database.info?.database_size_pretty || 'N/A'}<br>
                    User: ${metrics.database.info?.current_user || 'N/A'}
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-title">🔗 Active Connections</div>
                <div class="metric-value">${metrics.database.connections?.total_connections || 0}</div>
                <div class="metric-subtitle">
                    Active: ${metrics.database.connections?.active_connections || 0} | 
                    Idle: ${metrics.database.connections?.idle_connections || 0}
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-title">⚡ Cache Hit Ratio</div>
                <div class="metric-value">${metrics.database.cache?.table_cache_hit_ratio || 0}%</div>
                <div class="metric-subtitle">
                    Table: ${metrics.database.cache?.table_cache_hit_ratio || 0}% | 
                    Index: ${metrics.database.cache?.index_cache_hit_ratio || 0}%
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-title">📊 Tables</div>
                <div class="metric-value">${metrics.tables.total_tables}</div>
                <div class="metric-subtitle">
                    Total size: ${(metrics.tables.total_size_bytes / (1024*1024*1024)).toFixed(2)} GB
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-title">🔍 Indexes</div>
                <div class="metric-value">${metrics.indexes.total_indexes}</div>
                <div class="metric-subtitle">
                    Unused: ${metrics.indexes.unused_indexes}
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-title">🚀 Query Performance</div>
                <div class="metric-value">${metrics.queries.performance.length}</div>
                <div class="metric-subtitle">
                    Slow queries: ${metrics.queries.slow_queries}
                </div>
            </div>
        </div>

        <div class="table-container">
            <div class="metric-title">📈 Top Tables by Size</div>
            <table>
                <thead>
                    <tr>
                        <th>Table</th>
                        <th>Size</th>
                        <th>Live Tuples</th>
                        <th>Dead Tuples</th>
                        <th>Last Vacuum</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.tables.metrics.slice(0, 10).map((table: any) => `
                        <tr>
                            <td>${table.tablename}</td>
                            <td>${table.total_size_pretty}</td>
                            <td>${table.live_tuples?.toLocaleString() || 'N/A'}</td>
                            <td>${table.dead_tuples?.toLocaleString() || 'N/A'}</td>
                            <td>${table.hours_since_vacuum < 24 ? 'Recent' : `${Math.floor(table.hours_since_vacuum)}h ago`}</td>
                            <td>
                                <span class="status-indicator ${table.hours_since_vacuum > 168 ? 'status-warning' : 'status-good'}"></span>
                                ${table.hours_since_vacuum > 168 ? 'Needs vacuum' : 'Good'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${metrics.queries.performance.length > 0 ? `
        <div class="table-container">
            <div class="metric-title">⚡ Query Performance</div>
            <table>
                <thead>
                    <tr>
                        <th>Query</th>
                        <th>Calls</th>
                        <th>Total Time</th>
                        <th>Avg Time</th>
                        <th>Cache Hit</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.queries.performance.slice(0, 10).map((query: any) => `
                        <tr>
                            <td style="font-family: monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${query.query_preview}</td>
                            <td>${query.calls?.toLocaleString()}</td>
                            <td>${Math.round(query.total_time || 0)}ms</td>
                            <td>${Math.round(query.mean_time || 0)}ms</td>
                            <td>${Math.round(query.cache_hit_ratio || 0)}%</td>
                            <td>
                                <span class="status-indicator ${query.performance_category === 'slow' ? 'status-critical' : query.performance_category === 'medium' ? 'status-warning' : 'status-good'}"></span>
                                ${query.performance_category}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${metrics.locks.active_locks.length > 0 ? `
        <div class="table-container">
            <div class="metric-title">🔒 Active Locks</div>
            <table>
                <thead>
                    <tr>
                        <th>Lock Type</th>
                        <th>Relation</th>
                        <th>Mode</th>
                        <th>Duration</th>
                        <th>User</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${metrics.locks.active_locks.slice(0, 10).map((lock: any) => `
                        <tr>
                            <td>${lock.locktype}</td>
                            <td>${lock.relation}</td>
                            <td>${lock.mode}</td>
                            <td>${Math.round(lock.duration_ms || 0)}ms</td>
                            <td>${lock.usename || 'N/A'}</td>
                            <td>
                                <span class="status-indicator ${lock.lock_status === 'blocked' ? 'status-critical' : lock.lock_status === 'long_running' ? 'status-warning' : 'status-good'}"></span>
                                ${lock.lock_status}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="refresh-info">
            🔄 Dashboard auto-refreshes every 30 seconds<br>
            📊 Metrics collected from Neon PostgreSQL production database
        </div>
    </div>
</body>
</html>
  `;
}

// HTTP server for dashboard
async function startDashboardServer(port: number = 8080) {
  const metricsCollector = new DatabaseMetrics();
  
  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    
    try {
      switch (url.pathname) {
        case '/':
        case '/dashboard':
          // Check cache first
          const now = Date.now();
          if (!metricsCache || (now - lastCacheUpdate) > CACHE_TTL) {
            log('METRICS', 'Collecting fresh metrics...');
            metricsCache = await metricsCollector.getAllMetrics();
            lastCacheUpdate = now;
          }
          
          const html = generateDashboardHTML(metricsCache);
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
          });
          
        case '/api/metrics':
          // Check cache first
          const apiNow = Date.now();
          if (!metricsCache || (apiNow - lastCacheUpdate) > CACHE_TTL) {
            log('METRICS', 'Collecting fresh metrics for API...');
            metricsCache = await metricsCollector.getAllMetrics();
            lastCacheUpdate = apiNow;
          }
          
          return new Response(JSON.stringify(metricsCache, null, 2), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
          
        case '/api/health':
          const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            cache_age: lastCacheUpdate ? Math.floor((Date.now() - lastCacheUpdate) / 1000) : 'no-cache',
          };
          
          return new Response(JSON.stringify(health), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
          
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      log('ERROR', `Request failed: ${error.message}`);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: error.message }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };

  log('INFO', `Starting database metrics dashboard on port ${port}`);
  log('INFO', `Dashboard: http://localhost:${port}/dashboard`);
  log('INFO', `API: http://localhost:${port}/api/metrics`);
  log('INFO', `Health: http://localhost:${port}/api/health`);
  
  await serve(handler, { port });
}

// Export metrics to JSON file
async function exportMetrics(filename?: string) {
  const metricsCollector = new DatabaseMetrics();
  const metrics = await metricsCollector.getAllMetrics();
  
  const exportFile = filename || `database_metrics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  
  try {
    await Deno.writeTextFile(exportFile, JSON.stringify(metrics, null, 2));
    log('SUCCESS', `Metrics exported to: ${exportFile}`);
  } catch (error) {
    log('ERROR', `Failed to export metrics: ${error.message}`);
  }
}

// Console dashboard
async function displayConsoleDashboard() {
  const metricsCollector = new DatabaseMetrics();
  
  // Clear console and display header
  console.clear();
  console.log(`${colors.bright}${colors.blue}=== Neon PostgreSQL Database Metrics Dashboard ===${colors.reset}\n`);
  
  try {
    const metrics = await metricsCollector.getAllMetrics();
    
    // Display key metrics
    console.log(`${colors.cyan}📊 Database Overview:${colors.reset}`);
    console.log(`   Database: ${metrics.database.info?.database_name || 'N/A'}`);
    console.log(`   Size: ${metrics.database.info?.database_size_pretty || 'N/A'}`);
    console.log(`   Connections: ${metrics.database.connections?.total_connections || 0} (${metrics.database.connections?.active_connections || 0} active)`);
    console.log(`   Cache Hit Ratio: ${metrics.database.cache?.table_cache_hit_ratio || 0}%`);
    console.log();
    
    // Display alerts
    if (metrics.alerts.length > 0) {
      console.log(`${colors.red}🚨 Alerts:${colors.reset}`);
      metrics.alerts.forEach((alert: any) => {
        const severityColor = alert.severity === 'critical' ? colors.red : 
                             alert.severity === 'warning' ? colors.yellow : colors.blue;
        console.log(`   ${severityColor}${alert.severity.toUpperCase()}:${colors.reset} ${alert.message}`);
      });
      console.log();
    }
    
    // Display top tables
    console.log(`${colors.green}📈 Top Tables by Size:${colors.reset}`);
    metrics.tables.metrics.slice(0, 5).forEach((table: any) => {
      console.log(`   ${table.tablename}: ${table.total_size_pretty} (${table.live_tuples?.toLocaleString() || 'N/A'} rows)`);
    });
    console.log();
    
    // Display slow queries if any
    if (metrics.queries.slow_queries > 0) {
      console.log(`${colors.yellow}🐌 Slow Queries: ${metrics.queries.slow_queries}${colors.reset}`);
      metrics.queries.performance
        .filter((q: any) => q.performance_category === 'slow')
        .slice(0, 3)
        .forEach((query: any) => {
          console.log(`   ${Math.round(query.mean_time)}ms avg: ${query.query_preview}`);
        });
      console.log();
    }
    
    console.log(`${colors.blue}Last updated: ${new Date(metrics.timestamp).toLocaleString()}${colors.reset}`);
    console.log(`Collection time: ${metrics.collection_time_ms}ms`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Failed to collect metrics: ${error.message}${colors.reset}`);
  }
}

// Main execution
async function main() {
  const mode = Deno.args[0] || '--mode=dashboard';
  const port = parseInt(Deno.args[1]) || 8080;
  
  log('INFO', '=== Neon PostgreSQL Database Metrics ===');
  log('INFO', `Mode: ${mode}`);
  log('INFO', `Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}`);
  
  try {
    switch (mode) {
      case '--mode=dashboard':
      case 'dashboard':
        await startDashboardServer(port);
        break;
        
      case '--mode=api':
      case 'api':
        await startDashboardServer(port);
        break;
        
      case '--mode=export':
      case 'export':
        await exportMetrics();
        break;
        
      case '--mode=console':
      case 'console':
        await displayConsoleDashboard();
        break;
        
      default:
        console.log('Usage: deno run --allow-all database-metrics.ts [--mode=dashboard|api|export|console] [port]');
        console.log('  dashboard - Start web dashboard (default)');
        console.log('  api       - Start API server');
        console.log('  export    - Export metrics to JSON file');
        console.log('  console   - Display metrics in console');
        Deno.exit(1);
    }
  } catch (error) {
    log('ERROR', `Operation failed: ${error.message}`);
    Deno.exit(1);
  }
}

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const;
signals.forEach(signal => {
  Deno.addSignalListener(signal, async () => {
    log('INFO', `Received ${signal}, shutting down gracefully...`);
    await sql.end();
    Deno.exit(0);
  });
});

// Run if this is the main module
if (import.meta.main) {
  await main();
}