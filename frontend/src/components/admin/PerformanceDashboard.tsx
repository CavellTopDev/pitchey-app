import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { 
  Activity, 
  Database, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  Clock,
  Server,
  HardDrive,
  Wifi,
  RefreshCw
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  status: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
}

interface PerformanceMetrics {
  timestamp: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  requestsPerSecond: number;
  cacheHitRate: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
}

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    fetchMetrics();
    fetchHistoricalData();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchHistoricalData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/current');
      const data = await response.json();
      setMetrics(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('/api/metrics/historical?period=24h');
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const metricCards: MetricCard[] = metrics ? [
    {
      title: 'Response Time (P95)',
      value: `${metrics.responseTime.p95}ms`,
      change: -12,
      status: metrics.responseTime.p95 < 1000 ? 'good' : metrics.responseTime.p95 < 2000 ? 'warning' : 'critical',
      icon: <Clock className="w-5 h-5" />
    },
    {
      title: 'Error Rate',
      value: `${metrics.errorRate.toFixed(2)}%`,
      change: -0.5,
      status: metrics.errorRate < 1 ? 'good' : metrics.errorRate < 5 ? 'warning' : 'critical',
      icon: <AlertTriangle className="w-5 h-5" />
    },
    {
      title: 'Cache Hit Rate',
      value: `${metrics.cacheHitRate.toFixed(1)}%`,
      change: 3.2,
      status: metrics.cacheHitRate > 80 ? 'good' : metrics.cacheHitRate > 60 ? 'warning' : 'critical',
      icon: <Zap className="w-5 h-5" />
    },
    {
      title: 'Requests/sec',
      value: metrics.requestsPerSecond.toFixed(0),
      change: 15,
      status: 'good',
      icon: <Activity className="w-5 h-5" />
    },
    {
      title: 'Active Connections',
      value: metrics.activeConnections,
      status: metrics.activeConnections < 80 ? 'good' : metrics.activeConnections < 90 ? 'warning' : 'critical',
      icon: <Database className="w-5 h-5" />
    },
    {
      title: 'CPU Usage',
      value: `${metrics.cpuUsage.toFixed(1)}%`,
      status: metrics.cpuUsage < 70 ? 'good' : metrics.cpuUsage < 85 ? 'warning' : 'critical',
      icon: <Server className="w-5 h-5" />
    }
  ] : [];

  // Sample data for charts
  const responseTimeData = historicalData.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString(),
    p50: d.responseTime.p50,
    p95: d.responseTime.p95,
    p99: d.responseTime.p99
  }));

  const errorRateData = historicalData.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString(),
    rate: d.errorRate
  }));

  const cacheData = [
    { name: 'Hits', value: metrics?.cacheHitRate || 0, fill: '#10b981' },
    { name: 'Misses', value: 100 - (metrics?.cacheHitRate || 0), fill: '#ef4444' }
  ];

  const endpointPerformance = [
    { endpoint: '/api/pitches/trending', avgTime: 125, calls: 15420 },
    { endpoint: '/api/pitches/new', avgTime: 98, calls: 12350 },
    { endpoint: '/api/pitches/[id]', avgTime: 156, calls: 8920 },
    { endpoint: '/api/search', avgTime: 234, calls: 6540 },
    { endpoint: '/api/auth/login', avgTime: 312, calls: 3210 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time system performance metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Auto Refresh</label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => {
                fetchMetrics();
                fetchHistoricalData();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`p-2 rounded-lg ${getStatusColor(card.status)}`}>
                {card.icon}
              </span>
              {card.change && (
                <span className={`text-sm ${card.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {card.change > 0 ? '+' : ''}{card.change}%
                </span>
              )}
            </div>
            <h3 className="text-sm text-gray-600">{card.title}</h3>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Response Time Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Response Time Percentiles</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="p50" stroke="#10b981" name="P50" />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" />
              <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Error Rate Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Error Rate Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={errorRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Area type="monotone" dataKey="rate" stroke="#ef4444" fill="#fee2e2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cache Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cache Performance</h2>
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={cacheData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {cacheData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 ml-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Hit Rate</span>
                  <span className="font-semibold">{metrics?.cacheHitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Hits</span>
                  <span className="font-semibold">1.2M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Misses</span>
                  <span className="font-semibold">142K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Avg Save</span>
                  <span className="font-semibold">312ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoint Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Endpoints by Volume</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={endpointPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Endpoint Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  P95
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Calls
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {endpointPerformance.map((endpoint, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {endpoint.endpoint}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {endpoint.avgTime}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(endpoint.avgTime * 1.5).toFixed(0)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {endpoint.calls.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    0.12%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Healthy
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;