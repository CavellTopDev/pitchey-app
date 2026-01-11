// Real-Time A/B Testing Analytics Dashboard
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  Activity, 
  BarChart3, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Filter
} from 'lucide-react';

// Import chart components (assuming Chart.js or similar is available)
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useWebSocket } from '../../hooks/useWebSocketAdvanced';
import { StatisticalAnalysis } from '../../utils/statistical-analysis';

// Types
interface ExperimentMetrics {
  experimentId: number;
  experimentName: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  totalParticipants: number;
  totalConversions: number;
  overallConversionRate: number;
  variants: VariantMetrics[];
  timeSeriesData: TimeSeriesData[];
  statisticalResults?: StatisticalResults;
  lastUpdated: string;
}

interface VariantMetrics {
  variantId: string;
  variantName: string;
  participants: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  averageOrderValue: number;
  bounceRate?: number;
  isControl: boolean;
  confidence?: {
    lower: number;
    upper: number;
  };
  lift?: number;
  isSignificant?: boolean;
}

interface TimeSeriesData {
  timestamp: string;
  date: string;
  hour?: string;
  variants: Record<string, {
    participants: number;
    conversions: number;
    conversionRate: number;
    cumulativeParticipants: number;
    cumulativeConversions: number;
  }>;
}

interface StatisticalResults {
  pValue: number;
  isStatisticallySignificant: boolean;
  winnerVariantId?: string;
  confidence: number;
  powerAnalysis: {
    currentPower: number;
    isAdequatelyPowered: boolean;
    recommendedSampleSize: number;
  };
  effect: {
    liftPercentage: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  };
}

interface RealTimeAnalyticsDashboardProps {
  experimentId: number;
  refreshInterval?: number; // in seconds, default 30
}

const RealTimeAnalyticsDashboard: React.FC<RealTimeAnalyticsDashboardProps> = ({
  experimentId,
  refreshInterval = 30
}) => {
  const [metrics, setMetrics] = useState<ExperimentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);

  // WebSocket connection for real-time updates
  const { lastMessage, connectionStatus } = useWebSocket({
    url: '/ws/experiments',
    protocols: ['experiment-analytics'],
    onOpen: () => {
    },
    onMessage: (data) => {
      if (data.type === 'experiment-update' && data.experimentId === experimentId) {
        fetchMetrics();
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Fetch experiment metrics
  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/experiments/${experimentId}/analytics?timeRange=${timeRange}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      setMetrics(data.data);
      
      // Initialize selected variants if not set
      if (selectedVariants.length === 0 && data.data.variants.length > 0) {
        setSelectedVariants(data.data.variants.map((v: VariantMetrics) => v.variantId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [experimentId, timeRange, autoRefresh, refreshInterval]);

  // Calculate statistical significance in real-time
  const statisticalResults = useMemo(() => {
    if (!metrics || metrics.variants.length < 2) return null;

    const control = metrics.variants.find(v => v.isControl);
    const variants = metrics.variants.filter(v => !v.isControl);

    if (!control) return null;

    const results = variants.map(variant => {
      try {
        const testResult = StatisticalAnalysis.performZTest({
          controlConversions: control.conversions,
          controlSampleSize: control.participants,
          variantConversions: variant.conversions,
          variantSampleSize: variant.participants
        });

        return {
          variantId: variant.variantId,
          ...testResult
        };
      } catch (error) {
        return null;
      }
    }).filter(Boolean);

    return results;
  }, [metrics]);

  // Prepare chart data
  const conversionTrendData = useMemo(() => {
    if (!metrics?.timeSeriesData) return [];

    return metrics.timeSeriesData.map(data => {
      const chartPoint: any = {
        time: data.hour || new Date(data.timestamp).toLocaleTimeString(),
        date: data.date,
        timestamp: data.timestamp
      };

      Object.entries(data.variants).forEach(([variantId, variantData]) => {
        if (selectedVariants.includes(variantId)) {
          chartPoint[variantId] = (variantData.conversionRate * 100).toFixed(2);
          chartPoint[`${variantId}_cumulative`] = variantData.cumulativeConversions;
          chartPoint[`${variantId}_participants`] = variantData.cumulativeParticipants;
        }
      });

      return chartPoint;
    });
  }, [metrics?.timeSeriesData, selectedVariants]);

  // Chart colors for variants
  const variantColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#F97316', // orange
  ];

  const getVariantColor = (index: number) => variantColors[index % variantColors.length];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Analytics Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
        <p className="mt-1 text-sm text-gray-500">Analytics data will appear once the experiment receives traffic.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{metrics.experimentName}</h2>
          <div className="flex items-center space-x-4 mt-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              metrics.status === 'active' ? 'bg-green-100 text-green-800' : 
              metrics.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {metrics.status}
            </span>
            <span className="text-sm text-gray-500">
              Started {new Date(metrics.startDate).toLocaleDateString()}
            </span>
            <span className={`inline-flex items-center text-xs ${
              connectionStatus === 'Connected' ? 'text-green-600' : 'text-gray-500'
            }`}>
              <Activity className="h-3 w-3 mr-1" />
              {connectionStatus === 'Connected' ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              autoRefresh 
                ? 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100' 
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>

          <button
            onClick={fetchMetrics}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Participants"
          value={metrics.totalParticipants.toLocaleString()}
          icon={Users}
          trend={null}
        />
        <MetricCard
          title="Total Conversions"
          value={metrics.totalConversions.toLocaleString()}
          icon={Target}
          trend={null}
        />
        <MetricCard
          title="Overall Conv. Rate"
          value={`${(metrics.overallConversionRate * 100).toFixed(2)}%`}
          icon={TrendingUp}
          trend={null}
        />
        <MetricCard
          title="Statistical Significance"
          value={statisticalResults?.some(r => r?.isStatisticallySignificant) ? 'Achieved' : 'Not Yet'}
          icon={statisticalResults?.some(r => r?.isStatisticallySignificant) ? CheckCircle : Clock}
          trend={null}
          status={statisticalResults?.some(r => r?.isStatisticallySignificant) ? 'success' : 'pending'}
        />
      </div>

      {/* Statistical Results Summary */}
      {statisticalResults && statisticalResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Statistical Analysis</h3>
          <div className="space-y-4">
            {statisticalResults.map((result, index) => (
              result && (
                <div key={result.variantId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">
                      {metrics.variants.find(v => v.variantId === result.variantId)?.variantName}
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      result.isStatisticallySignificant 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {result.isStatisticallySignificant ? 'Significant' : 'Not Significant'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Lift vs Control</p>
                      <p className={`font-semibold ${result.lift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.lift >= 0 ? '+' : ''}{result.lift.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Confidence</p>
                      <p className="font-semibold text-gray-900">
                        {((1 - result.pValue) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">P-Value</p>
                      <p className="font-semibold text-gray-900">{result.pValue.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CI Range</p>
                      <p className="font-semibold text-gray-900">
                        [{result.liftConfidenceInterval.lower.toFixed(1)}%, {result.liftConfidenceInterval.upper.toFixed(1)}%]
                      </p>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Variants Performance Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Variant Performance</h3>
        <div className="space-y-4">
          {metrics.variants.map((variant, index) => (
            <VariantCard
              key={variant.variantId}
              variant={variant}
              color={getVariantColor(index)}
              isSelected={selectedVariants.includes(variant.variantId)}
              onToggle={() => {
                setSelectedVariants(prev =>
                  prev.includes(variant.variantId)
                    ? prev.filter(id => id !== variant.variantId)
                    : [...prev, variant.variantId]
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Conversion Rate Trends */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Conversion Rate Trends</h3>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              {selectedVariants.length} of {metrics.variants.length} variants shown
            </span>
          </div>
        </div>
        
        {conversionTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={conversionTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: any, name: any) => [`${value}%`, name]}
              />
              <Legend />
              {selectedVariants.map((variantId, index) => (
                <Line
                  key={variantId}
                  type="monotone"
                  dataKey={variantId}
                  stroke={getVariantColor(index)}
                  strokeWidth={2}
                  dot={{ fill: getVariantColor(index), strokeWidth: 2 }}
                  name={metrics.variants.find(v => v.variantId === variantId)?.variantName || variantId}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No trend data available yet</p>
          </div>
        )}
      </div>

      {/* Participant Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Participant Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.variants.map((variant, index) => ({
                  name: variant.variantName,
                  value: variant.participants,
                  fill: getVariantColor(index)
                }))}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              >
                {metrics.variants.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={getVariantColor(index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [value.toLocaleString(), 'Participants']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.variants}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="variantName" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: any) => [`${(value * 100).toFixed(2)}%`, 'Conversion Rate']}
              />
              <Bar dataKey="conversionRate" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Export Data</h4>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => {
              const dataStr = JSON.stringify(metrics, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `experiment-${experimentId}-analytics-${new Date().toISOString().split('T')[0]}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
};

// Supporting Components
const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: number | null;
  status?: 'success' | 'warning' | 'error' | 'pending';
}> = ({ title, value, icon: Icon, trend, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-gray-600';
      default: return 'text-indigo-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-md ${
          status === 'success' ? 'bg-green-100' :
          status === 'warning' ? 'bg-yellow-100' :
          status === 'error' ? 'bg-red-100' :
          status === 'pending' ? 'bg-gray-100' :
          'bg-indigo-100'
        }`}>
          <Icon className={`h-6 w-6 ${getStatusColor()}`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {trend !== null && (
            <div className={`flex items-center text-sm ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend > 0 ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : trend < 0 ? (
                <TrendingDown className="h-4 w-4 mr-1" />
              ) : null}
              {trend !== 0 && `${Math.abs(trend)}%`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VariantCard: React.FC<{
  variant: VariantMetrics;
  color: string;
  isSelected: boolean;
  onToggle: () => void;
}> = ({ variant, color, isSelected, onToggle }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <button
            onClick={onToggle}
            className="mr-3"
          >
            <div className={`w-4 h-4 rounded border-2 ${
              isSelected ? 'bg-current border-current' : 'border-gray-300'
            }`} style={{ color: isSelected ? color : undefined }}>
              {isSelected && (
                <CheckCircle className="h-3 w-3 text-white" style={{ marginTop: '-2px', marginLeft: '-2px' }} />
              )}
            </div>
          </button>
          <div>
            <h4 className="font-medium text-gray-900">{variant.variantName}</h4>
            {variant.isControl && (
              <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs">
                Control
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold" style={{ color }}>
            {(variant.conversionRate * 100).toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">Conversion Rate</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Participants</p>
          <p className="font-semibold text-gray-900">{variant.participants.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Conversions</p>
          <p className="font-semibold text-gray-900">{variant.conversions.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">Revenue</p>
          <p className="font-semibold text-gray-900">${variant.revenue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500">AOV</p>
          <p className="font-semibold text-gray-900">${variant.averageOrderValue.toFixed(2)}</p>
        </div>
      </div>

      {variant.confidence && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
          <p className="text-gray-600">
            Confidence Interval: [{(variant.confidence.lower * 100).toFixed(2)}%, {(variant.confidence.upper * 100).toFixed(2)}%]
          </p>
        </div>
      )}
    </div>
  );
};

export default RealTimeAnalyticsDashboard;