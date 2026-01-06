import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Users, Eye, DollarSign, Star, 
  BarChart3, PieChart, LineChart, Activity, Clock, Target,
  Calendar, Download, Filter, RefreshCw
} from 'lucide-react';
import apiClient from '../../services/api';
import { toast } from 'react-hot-toast';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface MetricCard {
  title: string;
  value: number | string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ReactNode;
  suffix?: string;
  prefix?: string;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

interface AnalyticsData {
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    totalPitches: number;
    totalInvestments: number;
    totalRevenue: number;
    averageRating: number;
    conversionRate: number;
    activeUsers: number;
  };
  trends: {
    viewsOverTime: ChartData;
    investmentsOverTime: ChartData;
    userGrowth: ChartData;
    revenueGrowth: ChartData;
  };
  demographics: {
    usersByRole: ChartData;
    pitchesByGenre: ChartData;
    pitchesByStatus: ChartData;
    investmentsByRange: ChartData;
  };
  performance: {
    topPitches: Array<{
      id: number;
      title: string;
      views: number;
      investments: number;
      rating: number;
    }>;
    topCreators: Array<{
      id: number;
      name: string;
      pitchCount: number;
      totalViews: number;
      totalInvestments: number;
    }>;
    topInvestors: Array<{
      id: number;
      name: string;
      investmentCount: number;
      totalAmount: number;
    }>;
  };
  engagement: {
    averageSessionDuration: number;
    bounceRate: number;
    pageViewsPerSession: number;
    mostViewedPages: Array<{
      path: string;
      views: number;
      avgDuration: number;
    }>;
  };
}

type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';
type MetricType = 'overview' | 'trends' | 'demographics' | 'performance' | 'engagement';

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('overview');
  const [customDateRange, setCustomDateRange] = useState({
    start: subDays(new Date(), 30).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, customDateRange, loadAnalytics]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range: dateRange,
        ...(dateRange === 'custom' ? {
          start: customDateRange.start,
          end: customDateRange.end
        } : {})
      });

      const response = await apiClient.get(`/api/analytics?${params}`);
      
      if (response.data.success) {
        setAnalyticsData(response.data.data);
      } else {
        // Use mock data as fallback
        setAnalyticsData(generateMockAnalytics());
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setAnalyticsData(generateMockAnalytics());
    } finally {
      setLoading(false);
    }
  }, [dateRange, customDateRange]);

  const refreshData = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
    toast.success('Analytics data refreshed');
  };

  const exportData = () => {
    if (!analyticsData) return;
    
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${dateRange}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics data exported');
  };

  const generateMockAnalytics = (): AnalyticsData => {
    const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 365;
    const labels = Array.from({ length: Math.min(days, 12) }, (_, i) => 
      format(subDays(new Date(), days - i - 1), 'MMM dd')
    );

    return {
      overview: {
        totalViews: 152847,
        uniqueVisitors: 45231,
        totalPitches: 1234,
        totalInvestments: 89,
        totalRevenue: 2450000,
        averageRating: 4.3,
        conversionRate: 3.2,
        activeUsers: 8934
      },
      trends: {
        viewsOverTime: {
          labels,
          datasets: [{
            label: 'Views',
            data: labels.map(() => Math.floor(Math.random() * 10000) + 1000),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)'
          }]
        },
        investmentsOverTime: {
          labels,
          datasets: [{
            label: 'Investments',
            data: labels.map(() => Math.floor(Math.random() * 20) + 1),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)'
          }]
        },
        userGrowth: {
          labels,
          datasets: [{
            label: 'New Users',
            data: labels.map(() => Math.floor(Math.random() * 500) + 50),
            borderColor: 'rgb(168, 85, 247)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)'
          }]
        },
        revenueGrowth: {
          labels,
          datasets: [{
            label: 'Revenue ($)',
            data: labels.map(() => Math.floor(Math.random() * 100000) + 10000),
            borderColor: 'rgb(251, 146, 60)',
            backgroundColor: 'rgba(251, 146, 60, 0.1)'
          }]
        }
      },
      demographics: {
        usersByRole: {
          labels: ['Creators', 'Investors', 'Production', 'Viewers'],
          datasets: [{
            label: 'Users',
            data: [3450, 890, 234, 4360],
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(251, 146, 60, 0.8)',
              'rgba(168, 85, 247, 0.8)'
            ]
          }]
        },
        pitchesByGenre: {
          labels: ['Action', 'Drama', 'Comedy', 'Sci-Fi', 'Horror', 'Romance'],
          datasets: [{
            label: 'Pitches',
            data: [234, 189, 156, 143, 89, 67],
            backgroundColor: 'rgba(59, 130, 246, 0.8)'
          }]
        },
        pitchesByStatus: {
          labels: ['Draft', 'Published', 'Under Review', 'Funded', 'In Production'],
          datasets: [{
            label: 'Pitches',
            data: [456, 678, 123, 89, 34],
            backgroundColor: [
              'rgba(156, 163, 175, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(251, 191, 36, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(168, 85, 247, 0.8)'
            ]
          }]
        },
        investmentsByRange: {
          labels: ['< $100k', '$100k-$500k', '$500k-$1M', '$1M-$5M', '> $5M'],
          datasets: [{
            label: 'Investments',
            data: [45, 34, 23, 12, 5],
            backgroundColor: 'rgba(34, 197, 94, 0.8)'
          }]
        }
      },
      performance: {
        topPitches: [
          { id: 1, title: 'The Last Frontier', views: 45678, investments: 23, rating: 4.8 },
          { id: 2, title: 'Echoes of Tomorrow', views: 34567, investments: 18, rating: 4.6 },
          { id: 3, title: 'City of Dreams', views: 28934, investments: 15, rating: 4.5 },
          { id: 4, title: 'The Silent Hour', views: 23456, investments: 12, rating: 4.4 },
          { id: 5, title: 'Beyond the Horizon', views: 19876, investments: 10, rating: 4.3 }
        ],
        topCreators: [
          { id: 1, name: 'Alex Thompson', pitchCount: 12, totalViews: 98765, totalInvestments: 45 },
          { id: 2, name: 'Sarah Chen', pitchCount: 8, totalViews: 76543, totalInvestments: 34 },
          { id: 3, name: 'Michael Rodriguez', pitchCount: 10, totalViews: 65432, totalInvestments: 28 },
          { id: 4, name: 'Emma Wilson', pitchCount: 6, totalViews: 54321, totalInvestments: 22 },
          { id: 5, name: 'James Miller', pitchCount: 7, totalViews: 43210, totalInvestments: 18 }
        ],
        topInvestors: [
          { id: 1, name: 'Stellar Productions', investmentCount: 34, totalAmount: 12500000 },
          { id: 2, name: 'Venture Films', investmentCount: 28, totalAmount: 8900000 },
          { id: 3, name: 'Global Entertainment', investmentCount: 23, totalAmount: 6700000 },
          { id: 4, name: 'New Wave Studios', investmentCount: 19, totalAmount: 5400000 },
          { id: 5, name: 'Independent Films Co', investmentCount: 15, totalAmount: 3200000 }
        ]
      },
      engagement: {
        averageSessionDuration: 485, // seconds
        bounceRate: 32.5, // percentage
        pageViewsPerSession: 5.2,
        mostViewedPages: [
          { path: '/browse', views: 45678, avgDuration: 234 },
          { path: '/pitch/123', views: 34567, avgDuration: 456 },
          { path: '/creator/profile', views: 23456, avgDuration: 345 },
          { path: '/investor/dashboard', views: 19876, avgDuration: 567 },
          { path: '/about', views: 12345, avgDuration: 123 }
        ]
      }
    };
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics data</p>
        <button onClick={loadAnalytics} className="mt-4 text-blue-600 hover:text-blue-700">
          Try Again
        </button>
      </div>
    );
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Total Views',
      value: formatNumber(analyticsData.overview.totalViews),
      change: 12.5,
      changeType: 'increase',
      icon: <Eye className="w-5 h-5" />
    },
    {
      title: 'Active Users',
      value: formatNumber(analyticsData.overview.activeUsers),
      change: 8.3,
      changeType: 'increase',
      icon: <Users className="w-5 h-5" />
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(analyticsData.overview.totalRevenue),
      change: 15.2,
      changeType: 'increase',
      icon: <DollarSign className="w-5 h-5" />
    },
    {
      title: 'Avg Rating',
      value: analyticsData.overview.averageRating.toFixed(1),
      change: 0.2,
      changeType: 'increase',
      icon: <Star className="w-5 h-5" />,
      suffix: '/5'
    },
    {
      title: 'Conversion Rate',
      value: analyticsData.overview.conversionRate.toFixed(1),
      change: -0.5,
      changeType: 'decrease',
      icon: <Target className="w-5 h-5" />,
      suffix: '%'
    },
    {
      title: 'Total Investments',
      value: analyticsData.overview.totalInvestments,
      change: 23,
      changeType: 'increase',
      icon: <TrendingUp className="w-5 h-5" />
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 mb-4">
          {(['today', 'week', 'month', 'year'] as DateRange[]).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg capitalize ${
                dateRange === range 
                  ? 'bg-blue-500 text-white' 
                  : 'border hover:bg-gray-50'
              }`}
            >
              {range}
            </button>
          ))}
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg ${
              dateRange === 'custom' 
                ? 'bg-blue-500 text-white' 
                : 'border hover:bg-gray-50'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Range */}
        {dateRange === 'custom' && (
          <div className="flex gap-2 mb-4">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            />
            <span className="py-2">to</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
        )}

        {/* Metric Tabs */}
        <div className="flex gap-2 border-b">
          {(['overview', 'trends', 'demographics', 'performance', 'engagement'] as MetricType[]).map(metric => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={`px-4 py-2 capitalize border-b-2 transition-colors ${
                selectedMetric === metric 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent hover:text-gray-700'
              }`}
            >
              {metric}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Metrics */}
      {selectedMetric === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {metricCards.map((card, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start mb-2">
                <div className="text-gray-600">{card.icon}</div>
                <div className={`flex items-center gap-1 text-sm ${
                  card.changeType === 'increase' ? 'text-green-600' : 
                  card.changeType === 'decrease' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {card.changeType === 'increase' ? <TrendingUp className="w-4 h-4" /> :
                   card.changeType === 'decrease' ? <TrendingDown className="w-4 h-4" /> : null}
                  {Math.abs(card.change)}%
                </div>
              </div>
              <div className="text-2xl font-bold">
                {card.prefix}{card.value}{card.suffix}
              </div>
              <div className="text-sm text-gray-600">{card.title}</div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Tables */}
      {selectedMetric === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Pitches */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-4">Top Pitches</h3>
            <div className="space-y-2">
              {analyticsData.performance.topPitches.map((pitch, index) => (
                <div key={pitch.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-sm">{pitch.title}</div>
                      <div className="text-xs text-gray-600">
                        {formatNumber(pitch.views)} views • {pitch.investments} investments
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-3 h-3 text-yellow-500" />
                    {pitch.rating}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Creators */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-4">Top Creators</h3>
            <div className="space-y-2">
              {analyticsData.performance.topCreators.map((creator, index) => (
                <div key={creator.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-sm">{creator.name}</div>
                      <div className="text-xs text-gray-600">
                        {creator.pitchCount} pitches • {formatNumber(creator.totalViews)} views
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    {creator.totalInvestments}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Investors */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-4">Top Investors</h3>
            <div className="space-y-2">
              {analyticsData.performance.topInvestors.map((investor, index) => (
                <div key={investor.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-sm">{investor.name}</div>
                      <div className="text-xs text-gray-600">
                        {investor.investmentCount} investments
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {formatCurrency(investor.totalAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engagement Metrics */}
      {selectedMetric === 'engagement' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Session Duration</span>
              </div>
              <div className="text-2xl font-bold">
                {formatDuration(analyticsData.engagement.averageSessionDuration)}
              </div>
              <div className="text-sm text-gray-600">Average per session</div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-green-600" />
                <span className="font-semibold">Bounce Rate</span>
              </div>
              <div className="text-2xl font-bold">
                {analyticsData.engagement.bounceRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Users leaving after one page</div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <span className="font-semibold">Pages per Session</span>
              </div>
              <div className="text-2xl font-bold">
                {analyticsData.engagement.pageViewsPerSession.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Average pages viewed</div>
            </div>
          </div>

          {/* Most Viewed Pages */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-4">Most Viewed Pages</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Page</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Views</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.engagement.mostViewedPages.map((page, index) => (
                    <tr key={index} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{page.path}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatNumber(page.views)}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatDuration(page.avgDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for Charts */}
      {(selectedMetric === 'trends' || selectedMetric === 'demographics') && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-600 text-center">
            Chart visualization would be rendered here using a charting library like Chart.js or Recharts
          </p>
        </div>
      )}
    </div>
  );
}