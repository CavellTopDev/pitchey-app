/**
 * Cache Analytics Dashboard
 * Real-time monitoring and analytics for cache performance
 */

import React, { useState, useEffect, useRef } from 'react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { cacheMetrics } from '../../cache/cache-metrics';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CacheMetrics {
  hits: number;
  misses: number;
  writes: number;
  invalidations: number;
  evictions: number;
  hitRate: number;
  avgLatencyMs: number;
  uptimeMs: number;
  requestsPerSecond: number;
}

interface LayerMetrics {
  name: string;
  hits: number;
  misses: number;
  hitRate: number;
  avgLatencyMs: number;
  size: number;
  maxSize: number;
}

interface HotKey {
  key: string;
  count: number;
  lastAccessed?: string;
}

const CacheAnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [layerMetrics, setLayerMetrics] = useState<LayerMetrics[]>([]);
  const [hotKeys, setHotKeys] = useState<HotKey[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [efficiencyScore, setEfficiencyScore] = useState<number>(0);
  const [refreshRate, setRefreshRate] = useState<number>(5000);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      // Get metrics from cache service
      const globalMetrics = cacheMetrics.getMetrics();
      setMetrics(globalMetrics);

      // Get layer metrics
      const layers = Array.from(cacheMetrics.getAllLayerMetrics().entries()).map(
        ([name, data]) => ({
          name,
          ...data,
          size: 0, // Would need to track this
          maxSize: 1000, // Configuration value
        })
      );
      setLayerMetrics(layers);

      // Get hot keys
      const hot = cacheMetrics.getHotKeys(10);
      setHotKeys(hot);

      // Get efficiency score
      const score = cacheMetrics.getEfficiencyScore();
      setEfficiencyScore(score);

      // Get time series data
      const hitSeries = cacheMetrics.getTimeSeriesData('hits', 60000, 60);
      const missSeries = cacheMetrics.getTimeSeriesData('misses', 60000, 60);
      const latencySeries = cacheMetrics.getTimeSeriesData('latency', 60000, 60);

      setTimeSeriesData({
        hits: hitSeries,
        misses: missSeries,
        latency: latencySeries,
      });
    } catch (error) {
      console.error('Failed to fetch cache metrics:', error);
    }
  };

  // Setup auto-refresh
  useEffect(() => {
    fetchMetrics();

    if (refreshRate > 0) {
      intervalRef.current = setInterval(fetchMetrics, refreshRate);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshRate]);

  // Format uptime
  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Format number with abbreviation
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
  };

  // Get color based on value
  const getColorForValue = (value: number, threshold: number): string => {
    if (value >= threshold) return 'text-green-600';
    if (value >= threshold * 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Chart configurations
  const hitRateChartData = {
    labels: layerMetrics.map(l => l.name),
    datasets: [
      {
        label: 'Hit Rate',
        data: layerMetrics.map(l => l.hitRate * 100),
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const latencyChartData = {
    labels: layerMetrics.map(l => l.name),
    datasets: [
      {
        label: 'Avg Latency (ms)',
        data: layerMetrics.map(l => l.avgLatencyMs),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
    ],
  };

  const cacheDistributionData = {
    labels: ['Hits', 'Misses', 'Evictions'],
    datasets: [
      {
        data: [
          metrics?.hits || 0,
          metrics?.misses || 0,
          metrics?.evictions || 0,
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 206, 86, 0.6)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const timeSeriesChartData = {
    labels: timeSeriesData.hits?.map((_, i) => i) || [],
    datasets: [
      {
        label: 'Hits',
        data: timeSeriesData.hits?.map(d => d.value) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: true,
      },
      {
        label: 'Misses',
        data: timeSeriesData.misses?.map(d => d.value) || [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: true,
      },
    ],
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cache Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time monitoring and performance metrics for multi-layer cache system
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                Refresh Rate:
              </label>
              <select
                value={refreshRate}
                onChange={(e) => setRefreshRate(Number(e.target.value))}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value={0}>Manual</option>
                <option value={1000}>1s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>

              <label className="text-sm font-medium text-gray-700 ml-6">
                Time Range:
              </label>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="1m">Last 1 min</option>
                <option value="5m">Last 5 min</option>
                <option value="15m">Last 15 min</option>
                <option value="1h">Last 1 hour</option>
                <option value="24h">Last 24 hours</option>
              </select>
            </div>

            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Hit Rate</div>
            <div className={`text-2xl font-bold ${getColorForValue(metrics?.hitRate || 0, 0.8)}`}>
              {((metrics?.hitRate || 0) * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Target: ≥80%
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Requests/sec</div>
            <div className="text-2xl font-bold text-gray-900">
              {metrics?.requestsPerSecond.toFixed(2) || '0'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Current load
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Avg Latency</div>
            <div className={`text-2xl font-bold ${getColorForValue(100 - (metrics?.avgLatencyMs || 100), 50)}`}>
              {metrics?.avgLatencyMs.toFixed(2) || '0'}ms
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Target: ≤50ms
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Efficiency Score</div>
            <div className={`text-2xl font-bold ${getColorForValue(efficiencyScore, 70)}`}>
              {efficiencyScore.toFixed(0)}/100
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Overall health
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Uptime</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatUptime(metrics?.uptimeMs || 0)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Since last restart
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Hit Rate by Layer</h3>
            <Bar data={hitRateChartData} options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                },
              },
            }} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Cache Distribution</h3>
            <Doughnut data={cacheDistributionData} options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' },
              },
            }} />
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Cache Activity Over Time</h3>
          <Line data={timeSeriesChartData} options={{
            responsive: true,
            plugins: {
              legend: { position: 'top' },
            },
            scales: {
              y: { beginAtZero: true },
            },
          }} />
        </div>

        {/* Layer Details Table */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Cache Layer Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Layer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hit Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Misses
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Avg Latency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {layerMetrics.map((layer) => (
                  <tr key={layer.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {layer.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={getColorForValue(layer.hitRate, 0.7)}>
                        {(layer.hitRate * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatNumber(layer.hits)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatNumber(layer.misses)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {layer.avgLatencyMs.toFixed(2)}ms
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {layer.size}/{layer.maxSize}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hot Keys */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Hot Keys (Most Accessed)</h3>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {hotKeys.map((key, index) => (
                <div
                  key={key.key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-500">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-mono text-gray-900">
                      {key.key}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {formatNumber(key.count)} accesses
                    </span>
                    {key.lastAccessed && (
                      <span className="text-xs text-gray-400">
                        {key.lastAccessed}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Requests</div>
              <div className="text-xl font-semibold">
                {formatNumber((metrics?.hits || 0) + (metrics?.misses || 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Writes</div>
              <div className="text-xl font-semibold">
                {formatNumber(metrics?.writes || 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Invalidations</div>
              <div className="text-xl font-semibold">
                {formatNumber(metrics?.invalidations || 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Evictions</div>
              <div className="text-xl font-semibold">
                {formatNumber(metrics?.evictions || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheAnalyticsDashboard;