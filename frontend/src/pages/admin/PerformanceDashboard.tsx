import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  Activity, Database, Server, Users, Clock, TrendingUp,
  AlertTriangle, CheckCircle, XCircle, Zap, HardDrive,
  Cpu, Globe, Shield, DollarSign, RefreshCw
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  status: 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
}

interface PerformanceMetrics {
  responseTime: number[];
  errorRate: number[];
  throughput: number[];
  cpuUsage: number[];
  memoryUsage: number[];
  databaseConnections: number;
  cacheHitRate: number;
  activeUsers: number;
  apiCalls: number;
  uptime: number;
}

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Fetch performance metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/admin/metrics?range=${timeRange}`);
        const data = await response.json();
        setMetrics(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching metrics:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [timeRange, refreshInterval]);

  // Mock data for demonstration
  const mockData = {
    responseTime: Array.from({ length: 60 }, (_, i) => ({
      time: `${i}m`,
      p50: 80 + Math.random() * 40,
      p95: 150 + Math.random() * 100,
      p99: 300 + Math.random() * 200
    })),
    throughput: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      requests: Math.floor(1000 + Math.random() * 5000),
      success: Math.floor(900 + Math.random() * 4500),
      errors: Math.floor(Math.random() * 100)
    })),
    errorBreakdown: [
      { name: '4xx Errors', value: 234, color: '#fbbf24' },
      { name: '5xx Errors', value: 89, color: '#ef4444' },
      { name: 'Timeout', value: 45, color: '#f97316' },
      { name: 'Network', value: 12, color: '#dc2626' }
    ],
    databasePerformance: [
      { query: 'SELECT users', avgTime: 12, calls: 5432 },
      { query: 'UPDATE pitches', avgTime: 45, calls: 2341 },
      { query: 'INSERT ndas', avgTime: 23, calls: 1234 },
      { query: 'DELETE sessions', avgTime: 8, calls: 3421 },
      { query: 'JOIN analytics', avgTime: 89, calls: 876 }
    ],
    systemHealth: [
      { metric: 'CPU', value: 65, optimal: 70 },
      { metric: 'Memory', value: 72, optimal: 80 },
      { metric: 'Disk', value: 45, optimal: 60 },
      { metric: 'Network', value: 38, optimal: 50 },
      { metric: 'Cache', value: 92, optimal: 90 },
      { metric: 'Queue', value: 15, optimal: 30 }
    ]
  };

  const metricCards: MetricCard[] = [
    {
      title: 'Avg Response Time',
      value: '124ms',
      change: -12.5,
      status: 'success',
      icon: <Clock className="w-5 h-5" />
    },
    {
      title: 'Error Rate',
      value: '0.23%',
      change: -0.05,
      status: 'success',
      icon: <AlertTriangle className="w-5 h-5" />
    },
    {
      title: 'Throughput',
      value: '8.5K req/s',
      change: 15.2,
      status: 'success',
      icon: <Activity className="w-5 h-5" />
    },
    {
      title: 'CPU Usage',
      value: '65%',
      change: 5.3,
      status: 'warning',
      icon: <Cpu className="w-5 h-5" />
    },
    {
      title: 'Memory Usage',
      value: '72%',
      change: 2.1,
      status: 'warning',
      icon: <HardDrive className="w-5 h-5" />
    },
    {
      title: 'Active Users',
      value: '3,421',
      change: 8.7,
      status: 'success',
      icon: <Users className="w-5 h-5" />
    },
    {
      title: 'Database Connections',
      value: '127/200',
      change: 0,
      status: 'success',
      icon: <Database className="w-5 h-5" />
    },
    {
      title: 'Cache Hit Rate',
      value: '94.3%',
      change: 1.2,
      status: 'success',
      icon: <Zap className="w-5 h-5" />
    },
    {
      title: 'Uptime',
      value: '99.99%',
      change: 0,
      status: 'success',
      icon: <CheckCircle className="w-5 h-5" />
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'danger': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time system performance monitoring</p>
        </div>
        
        <div className="flex gap-2">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Refresh Interval */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="10000">10s</option>
            <option value="30000">30s</option>
            <option value="60000">1m</option>
            <option value="300000">5m</option>
          </select>

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${getStatusColor(card.status)}`}>
                {card.icon}
              </div>
              <span className={`text-sm font-medium ${
                card.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {card.change > 0 ? '+' : ''}{card.change}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
            <p className="text-sm text-gray-600 mt-1">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {['overview', 'response-time', 'throughput', 'errors', 'database', 'system'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedMetric(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  selectedMetric === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {selectedMetric === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Trend */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Response Time Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockData.responseTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="p50" stroke="#10b981" name="P50" />
                    <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" />
                    <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Throughput Chart */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Request Throughput</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockData.throughput.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="#10b981" />
                    <Area type="monotone" dataKey="errors" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Response Time Tab */}
          {selectedMetric === 'response-time' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Response Time Analysis</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={mockData.responseTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Milliseconds', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} name="Median (P50)" />
                  <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} name="95th Percentile" />
                  <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} name="99th Percentile" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Throughput Tab */}
          {selectedMetric === 'throughput' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Request Throughput</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={mockData.throughput}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="requests" fill="#3b82f6" name="Total Requests" />
                  <Bar dataKey="success" fill="#10b981" name="Successful" />
                  <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Errors Tab */}
          {selectedMetric === 'errors' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Error Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={mockData.errorBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {mockData.errorBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Recent Errors</h3>
                <div className="space-y-2">
                  {[
                    { type: '500', message: 'Internal Server Error', count: 23, time: '2m ago' },
                    { type: '404', message: 'Not Found', count: 45, time: '5m ago' },
                    { type: '429', message: 'Too Many Requests', count: 12, time: '8m ago' },
                    { type: '503', message: 'Service Unavailable', count: 3, time: '15m ago' },
                    { type: '401', message: 'Unauthorized', count: 67, time: '22m ago' }
                  ].map((error, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          error.type.startsWith('5') ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {error.type}
                        </span>
                        <span className="text-sm text-gray-900">{error.message}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{error.count} occurrences</span>
                        <span>{error.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Database Tab */}
          {selectedMetric === 'database' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Database Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Query
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Time (ms)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Calls
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Time (s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mockData.databasePerformance.map((query, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {query.query}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {query.avgTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {query.calls.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {((query.avgTime * query.calls) / 1000).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            query.avgTime < 50 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {query.avgTime < 50 ? 'Optimal' : 'Slow'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* System Tab */}
          {selectedMetric === 'system' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={mockData.systemHealth}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Current" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Radar name="Optimal" dataKey="optimal" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
        <div className="space-y-2">
          {[
            { level: 'warning', message: 'CPU usage approaching threshold (85%)', time: 'Just now' },
            { level: 'info', message: 'Scheduled maintenance window in 2 hours', time: '5m ago' },
            { level: 'success', message: 'Database backup completed successfully', time: '1h ago' }
          ].map((alert, index) => (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
              alert.level === 'warning' ? 'bg-yellow-50' :
              alert.level === 'success' ? 'bg-green-50' : 'bg-blue-50'
            }`}>
              <div className="flex items-center gap-3">
                {alert.level === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                {alert.level === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {alert.level === 'info' && <Activity className="w-5 h-5 text-blue-600" />}
                <span className="text-sm text-gray-900">{alert.message}</span>
              </div>
              <span className="text-xs text-gray-500">{alert.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;