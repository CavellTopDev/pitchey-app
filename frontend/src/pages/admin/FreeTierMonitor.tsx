/**
 * Free Tier Monitoring Dashboard
 * Real-time monitoring of Cloudflare free tier usage
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api-client';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertCircle, CheckCircle, XCircle, TrendingUp, Server, Database, Zap } from 'lucide-react';

interface Metrics {
  requests: {
    daily: number;
    limit: number;
    percentage: number;
  };
  kvOperations: {
    reads: number;
    writes: number;
    storage: number;
    limit: number;
  };
  cpuTime: {
    average: number;
    p95: number;
    p99: number;
    violations: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  rateLimit: {
    blocked: number;
    passed: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
}

const FreeTierMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchHealth();
    fetchHistory();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchHealth();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      const response = await apiClient.get('/api/admin/metrics');
      setMetrics(response);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await apiClient.get('/api/admin/health');
      setHealth(response);
    } catch (error) {
      console.error('Failed to fetch health:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get('/api/admin/metrics/history?days=7');
      setHistory(response);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-6 h-6" />;
      case 'warning': return <AlertCircle className="w-6 h-6" />;
      case 'critical': return <XCircle className="w-6 h-6" />;
      default: return null;
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const cacheData = metrics ? [
    { name: 'Hits', value: metrics.cache.hits, color: '#10b981' },
    { name: 'Misses', value: metrics.cache.misses, color: '#ef4444' }
  ] : [];

  const requestData = metrics ? [
    { name: 'Used', value: metrics.requests.daily },
    { name: 'Remaining', value: metrics.requests.limit - metrics.requests.daily }
  ] : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Free Tier Monitor</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
          <button
            onClick={() => {
              fetchMetrics();
              fetchHealth();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`p-4 rounded-lg border ${
          health.status === 'healthy' ? 'bg-green-50 border-green-200' :
          health.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-3">
            <span className={getStatusColor(health.status)}>
              {getStatusIcon(health.status)}
            </span>
            <div className="flex-1">
              <h3 className="font-semibold text-lg capitalize">{health.status}</h3>
              {health.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {health.issues.map((issue, i) => (
                    <li key={i} className="text-sm">⚠️ {issue}</li>
                  ))}
                </ul>
              )}
              {health.recommendations.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-sm">Recommendations:</p>
                  <ul className="mt-1 space-y-1">
                    {health.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm">💡 {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Daily Requests */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Daily Requests</h3>
              <Server className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{metrics.requests.daily.toLocaleString()}</div>
            <div className="text-sm text-gray-500">of {metrics.requests.limit.toLocaleString()}</div>
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    metrics.requests.percentage > 90 ? 'bg-red-500' :
                    metrics.requests.percentage > 75 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(metrics.requests.percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metrics.requests.percentage.toFixed(1)}% used
              </div>
            </div>
          </div>

          {/* Cache Hit Rate */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Cache Hit Rate</h3>
              <Database className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">
              {(metrics.cache.hitRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">
              {metrics.cache.hits} hits / {metrics.cache.misses} misses
            </div>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={40}>
                <PieChart>
                  <Pie
                    data={cacheData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={10}
                    outerRadius={20}
                  >
                    {cacheData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CPU Time */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">CPU Time</h3>
              <Zap className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{metrics.cpuTime.average.toFixed(2)}ms</div>
            <div className="text-sm text-gray-500">avg / 10ms limit</div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>P95:</span>
                <span className={metrics.cpuTime.p95 > 10 ? 'text-red-500' : ''}>
                  {metrics.cpuTime.p95.toFixed(2)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>P99:</span>
                <span className={metrics.cpuTime.p99 > 10 ? 'text-red-500' : ''}>
                  {metrics.cpuTime.p99.toFixed(2)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>Violations:</span>
                <span className={metrics.cpuTime.violations > 0 ? 'text-red-500' : ''}>
                  {metrics.cpuTime.violations}
                </span>
              </div>
            </div>
          </div>

          {/* KV Operations */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">KV Operations</h3>
              <Database className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{metrics.kvOperations.reads.toLocaleString()}</div>
            <div className="text-sm text-gray-500">reads today</div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Writes:</span>
                <span>{metrics.kvOperations.writes}</span>
              </div>
              <div className="flex justify-between">
                <span>Storage:</span>
                <span>{formatBytes(metrics.kvOperations.storage)}</span>
              </div>
              <div className="bg-gray-200 rounded-full h-1 mt-2">
                <div 
                  className="bg-blue-500 h-1 rounded-full"
                  style={{ 
                    width: `${Math.min((metrics.kvOperations.reads / 100000) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Charts */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requests Over Time */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Daily Requests (7 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="requests.total" 
                  stroke="#3b82f6" 
                  name="Requests"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* CPU Performance */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">CPU Performance (7 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cpuTime.average" 
                  stroke="#10b981" 
                  name="Average"
                />
                <Line 
                  type="monotone" 
                  dataKey="cpuTime.p95" 
                  stroke="#f59e0b" 
                  name="P95"
                />
                <Line 
                  type="monotone" 
                  dataKey="cpuTime.p99" 
                  stroke="#ef4444" 
                  name="P99"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rate Limiting Stats */}
      {metrics && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Rate Limiting</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Requests Passed</p>
              <p className="text-2xl font-bold text-green-500">
                {metrics.rateLimit.passed.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Requests Blocked</p>
              <p className="text-2xl font-bold text-red-500">
                {metrics.rateLimit.blocked.toLocaleString()}
              </p>
            </div>
          </div>
          {metrics.rateLimit.blocked > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ Rate limiting is actively blocking requests. Consider increasing cache TTLs or upgrading to paid tier.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FreeTierMonitor;