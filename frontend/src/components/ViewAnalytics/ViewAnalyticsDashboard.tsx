import React, { useState, useEffect } from 'react';
import { 
  Eye, TrendingUp, Users, Clock, Globe, 
  Monitor, Smartphone, Tablet, BarChart3, 
  Calendar, ChevronDown, Download 
} from 'lucide-react';
import { viewService, ViewAnalytics, ViewAnalyticsQuery } from '../../services/view.service';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
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
  Filler
} from 'chart.js';

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

interface ViewAnalyticsDashboardProps {
  pitchId?: string;
  userId?: string;
  className?: string;
}

export const ViewAnalyticsDashboard: React.FC<ViewAnalyticsDashboardProps> = ({
  pitchId,
  userId,
  className = ''
}) => {
  const [analytics, setAnalytics] = useState<ViewAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  useEffect(() => {
    loadAnalytics();
  }, [pitchId, userId, timeRange, groupBy]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(
        Date.now() - (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0];

      const query: ViewAnalyticsQuery = {
        pitchId,
        userId,
        startDate,
        endDate,
        groupBy
      };

      const data = await viewService.getViewAnalytics(query);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    if (!analytics) return;
    
    const csv = [
      ['Period', 'Views', 'Unique Viewers', 'Avg Duration', 'Mobile', 'Desktop', 'Tablet'],
      ...analytics.analytics.map(row => [
        row.period,
        row.views,
        row.unique_viewers,
        row.avg_duration,
        row.mobile_views,
        row.desktop_views,
        row.tablet_views
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `view-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-white rounded-xl border p-6 ${className}`}>
        <p className="text-gray-500 text-center">No analytics data available</p>
      </div>
    );
  }

  // Prepare chart data
  const viewsChartData = {
    labels: analytics.analytics.map(a => 
      new Date(a.period).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    ),
    datasets: [
      {
        label: 'Total Views',
        data: analytics.analytics.map(a => a.views),
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Unique Viewers',
        data: analytics.analytics.map(a => a.unique_viewers),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  const deviceChartData = {
    labels: ['Mobile', 'Desktop', 'Tablet'],
    datasets: [{
      data: [
        analytics.analytics.reduce((sum, a) => sum + a.mobile_views, 0),
        analytics.analytics.reduce((sum, a) => sum + a.desktop_views, 0),
        analytics.analytics.reduce((sum, a) => sum + a.tablet_views, 0)
      ],
      backgroundColor: [
        'rgba(147, 51, 234, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)'
      ]
    }]
  };

  const sourcesChartData = {
    labels: analytics.sources.map(s => s.source),
    datasets: [{
      label: 'Traffic Sources',
      data: analytics.sources.map(s => s.count),
      backgroundColor: 'rgba(147, 51, 234, 0.8)'
    }]
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">View Analytics</h2>
          <div className="flex items-center gap-4">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            {/* Group By Selector */}
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>

            {/* Export Button */}
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-purple-900">
                  {analytics.summary.totalViews.toLocaleString()}
                </p>
              </div>
              <Eye className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Viewers</p>
                <p className="text-2xl font-bold text-blue-900">
                  {analytics.summary.uniqueViewers.toLocaleString()}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-green-900">
                  {Math.floor(analytics.summary.avgDuration / 60)}:{(analytics.summary.avgDuration % 60).toString().padStart(2, '0')}
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Views Chart */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Views Over Time</h3>
          <Line 
            data={viewsChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom'
                },
                tooltip: {
                  mode: 'index',
                  intersect: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }}
            height={300}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Breakdown */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Device Breakdown</h3>
          <div className="h-64">
            <Doughnut 
              data={deviceChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
          <div className="h-64">
            <Bar 
              data={sourcesChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Top Viewers (for creators) */}
      {analytics.topViewers.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Top Viewers</h3>
          <div className="space-y-3">
            {analytics.topViewers.map((viewer, index) => (
              <div key={viewer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-600">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{viewer.username}</p>
                    <p className="text-sm text-gray-500 capitalize">{viewer.user_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{viewer.view_count} views</p>
                  <p className="text-xs text-gray-500">
                    Last: {new Date(viewer.last_viewed).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};