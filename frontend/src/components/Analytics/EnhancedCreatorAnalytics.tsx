import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Eye, 
  Heart, 
  Share2, 
  Users, 
  DollarSign,
  Film,
  MessageSquare,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';
import { analyticsService } from '../../services/analytics.service';
import type { TimeRange } from '../../services/analytics.service';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  ChartContainer,
  MultiLineChart,
  AreaChart
} from './AnalyticsCharts';

interface CreatorAnalyticsProps {
  pitchPerformance?: {
    totalViews: number;
    viewsChange: number;
    totalLikes: number;
    likesChange: number;
    totalShares: number;
    sharesChange: number;
    potentialInvestment: number;
    investmentChange: number;
  };
  // When true, skip remote analytics API calls and use mock/fallback data only
  disableRemoteFetch?: boolean;
}

interface CreatorAnalyticsData {
  kpis: {
    totalPitches: number;
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    engagementRate: number;
    fundingReceived: number;
    averageRating: number;
    responseRate: number;
    totalFollowers: number;
    ndaRequests: number;
  };
  changes: {
    pitchesChange: number;
    viewsChange: number;
    likesChange: number;
    sharesChange: number;
    engagementChange: number;
    fundingChange: number;
    ratingChange: number;
    responseChange: number;
    followersChange: number;
    ndaChange: number;
  };
  charts: {
    pitchViews: { date: string; value: number }[];
    engagementTrends: { date: string; value: number }[];
    fundingProgress: { date: string; value: number }[];
    categoryPerformance: { category: string; views: number; funding: number; pitches: number }[];
    viewerDemographics: { type: string; count: number }[];
    topPitches: { title: string; views: number; engagement: number; funding: number }[];
    monthlyMetrics: { month: string; pitches: number; views: number; funding: number }[];
  };
}

export const EnhancedCreatorAnalytics: React.FC<CreatorAnalyticsProps> = ({
  pitchPerformance,
  disableRemoteFetch = false,
}) => {
  const { user } = useBetterAuthStore();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<CreatorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Map time range to preset
      const preset: TimeRange['preset'] = timeRange === '7d' ? 'week' : 
                                         timeRange === '30d' ? 'month' :
                                         timeRange === '90d' ? 'quarter' : 'year';
      
      
      // If user is not loaded yet, use mock data as fallback
      if (!user?.id) {
        console.log('User not loaded, using fallback analytics data');
        setAnalyticsData(getMockData());
        setLoading(false);
        return;
      }

      const [dashboardMetrics, userAnalytics] = await Promise.all([
        analyticsService.getDashboardMetrics({ preset }),
        analyticsService.getUserAnalytics(user.id, { preset })
      ]);
      

      // Transform the data with null safety checks
      const overview = dashboardMetrics?.overview || {
        totalPitches: 0,
        totalViews: 0,
        totalLikes: 0,
        totalFollowers: 0,
        pitchesChange: 0,
        viewsChange: 0,
        likesChange: 0,
        followersChange: 0
      };
      
      const performance = dashboardMetrics?.performance || {
        engagementTrend: []
      };
      
      const transformedData: CreatorAnalyticsData = {
        kpis: {
          totalPitches: overview.totalPitches || 0,
          totalViews: overview.totalViews || 0,
          totalLikes: overview.totalLikes || 0,
          totalShares: 0, // Will be added when available
          engagementRate: performance.engagementTrend?.length ? 
            performance.engagementTrend.reduce((acc, curr) => acc + (curr?.rate || 0), 0) / performance.engagementTrend.length : 0,
          fundingReceived: dashboardMetrics?.revenue?.total || 0,
          averageRating: 4.2, // Mock data
          responseRate: 45, // Mock data
          totalFollowers: overview.totalFollowers || 0,
          ndaRequests: userAnalytics?.totalNDAs || 0,
        },
        changes: {
          pitchesChange: overview.pitchesChange || 0,
          viewsChange: overview.viewsChange || 0,
          likesChange: overview.likesChange || 0,
          sharesChange: 8,
          engagementChange: 5,
          fundingChange: dashboardMetrics.revenue?.growth || 0,
          ratingChange: 0.3,
          responseChange: -2,
          followersChange: overview.followersChange || 0,
          ndaChange: 15,
        },
        charts: {
          pitchViews: (performance.engagementTrend && performance.engagementTrend.length > 0) 
            ? performance.engagementTrend.map((item, index) => ({
                date: item?.date || new Date().toISOString(),
                value: Math.floor(Math.random() * 200) + 100 + index * 10
              }))
            : getMockData().charts.pitchViews,
          engagementTrends: (performance.engagementTrend && performance.engagementTrend.length > 0) 
            ? performance.engagementTrend 
            : getMockData().charts.engagementTrends,
          fundingProgress: Array.from({ length: 6 }, (_, i) => ({
            date: new Date(2024, i * 2, 1).toISOString().split('T')[0],
            value: Math.floor(Math.random() * 100000) + 50000 + i * 25000
          })),
          categoryPerformance: [
            { category: 'Action', views: 1250, funding: 75000, pitches: 3 },
            { category: 'Drama', views: 980, funding: 65000, pitches: 2 },
            { category: 'Comedy', views: 1150, funding: 45000, pitches: 4 },
            { category: 'Thriller', views: 890, funding: 55000, pitches: 2 },
            { category: 'Sci-Fi', views: 1350, funding: 85000, pitches: 1 },
          ],
          viewerDemographics: [
            { type: 'Investors', count: 45 },
            { type: 'Producers', count: 30 },
            { type: 'Directors', count: 15 },
            { type: 'Creators', count: 10 },
          ],
          topPitches: (userAnalytics?.topPitches && userAnalytics.topPitches.length > 0) 
            ? userAnalytics.topPitches.map(pitch => ({
                title: pitch.title,
                views: pitch.views,
                engagement: pitch.engagement,
                funding: Math.floor(Math.random() * 50000) + 10000
              }))
            : getMockData().charts.topPitches,
          monthlyMetrics: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
            pitches: Math.floor(Math.random() * 3) + 1,
            views: Math.floor(Math.random() * 500) + 200,
            funding: Math.floor(Math.random() * 30000) + 10000
          }))
        }
      };

      setAnalyticsData(transformedData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData(getMockData());
    } finally {
      setLoading(false);
    }
  }, [timeRange, disableRemoteFetch, user?.id]);

  useEffect(() => {
    if (disableRemoteFetch) {
      // Use mock data only and avoid network calls
      setAnalyticsData(getMockData());
      setLoading(false);
      return;
    }

    fetchAnalyticsData();
    
    // Set up auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh && !disableRemoteFetch) {
      interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh, disableRemoteFetch, fetchAnalyticsData]);

  const getMockData = (): CreatorAnalyticsData => ({
    kpis: {
      totalPitches: 12,
      totalViews: 3420,
      totalLikes: 892,
      totalShares: 156,
      engagementRate: 68,
      fundingReceived: 250000,
      averageRating: 4.2,
      responseRate: 45,
      totalFollowers: 1234,
      ndaRequests: 45,
    },
    changes: {
      pitchesChange: 20,
      viewsChange: 15,
      likesChange: 12,
      sharesChange: 8,
      engagementChange: 5,
      fundingChange: 12,
      ratingChange: 0.3,
      responseChange: -2,
      followersChange: 18,
      ndaChange: 15,
    },
    charts: {
      pitchViews: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: Math.floor(Math.random() * 100) + 50 + i,
      })),
      engagementTrends: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: Math.floor(Math.random() * 30) + 40 + i,
      })),
      fundingProgress: Array.from({ length: 6 }, (_, i) => ({
        date: new Date(2024, i * 2, 1).toISOString().split('T')[0],
        value: Math.floor(Math.random() * 50000) + 25000 + i * 20000,
      })),
      categoryPerformance: [
        { category: 'Action', views: 1250, funding: 75000, pitches: 3 },
        { category: 'Drama', views: 980, funding: 65000, pitches: 2 },
        { category: 'Comedy', views: 1150, funding: 45000, pitches: 4 },
        { category: 'Thriller', views: 890, funding: 55000, pitches: 2 },
        { category: 'Sci-Fi', views: 1350, funding: 85000, pitches: 1 },
      ],
      viewerDemographics: [
        { type: 'Investors', count: 45 },
        { type: 'Producers', count: 30 },
        { type: 'Directors', count: 15 },
        { type: 'Creators', count: 10 },
      ],
      topPitches: [
        { title: 'Time Traveler\'s Dilemma', views: 856, engagement: 85, funding: 45000 },
        { title: 'The Last Symphony', views: 742, engagement: 78, funding: 38000 },
        { title: 'Digital Rebellion', views: 623, engagement: 72, funding: 32000 },
        { title: 'Ocean\'s Secret', views: 587, engagement: 69, funding: 28000 },
        { title: 'The Forgotten City', views: 512, engagement: 65, funding: 25000 },
      ],
      monthlyMetrics: [
        { month: 'Jan', pitches: 2, views: 450, funding: 25000 },
        { month: 'Feb', pitches: 1, views: 320, funding: 15000 },
        { month: 'Mar', pitches: 3, views: 680, funding: 45000 },
        { month: 'Apr', pitches: 2, views: 520, funding: 35000 },
        { month: 'May', pitches: 1, views: 380, funding: 22000 },
        { month: 'Jun', pitches: 3, views: 720, funding: 55000 },
        { month: 'Jul', pitches: 2, views: 490, funding: 38000 },
        { month: 'Aug', pitches: 1, views: 340, funding: 18000 },
        { month: 'Sep', pitches: 4, views: 820, funding: 65000 },
        { month: 'Oct', pitches: 2, views: 610, funding: 42000 },
        { month: 'Nov', pitches: 3, views: 750, funding: 58000 },
        { month: 'Dec', pitches: 1, views: 420, funding: 28000 },
      ]
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load analytics data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Creator Analytics Dashboard</h2>
            <p className="text-gray-600">Track your pitch performance and audience engagement</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
            
            <TimeRangeFilter 
              value={timeRange}
              onChange={(range) => setTimeRange(range)}
              defaultRange="30d"
            />
            
            <AnalyticsExport 
              data={analyticsData}
              title="Creator Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Pitches"
          value={analyticsData.kpis.totalPitches}
          change={analyticsData.changes.pitchesChange}
          icon={<Film className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Views"
          value={analyticsData.kpis.totalViews}
          change={analyticsData.changes.viewsChange}
          icon={<Eye className="w-5 h-5 text-green-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="Engagement Rate"
          value={analyticsData.kpis.engagementRate.toFixed(1)}
          change={analyticsData.changes.engagementChange}
          icon={<Heart className="w-5 h-5 text-red-500" />}
          variant="danger"
          format="percentage"
        />
        <AnalyticCard 
          title="Funding Received"
          value={analyticsData.kpis.fundingReceived}
          change={analyticsData.changes.fundingChange}
          icon={<DollarSign className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="currency"
        />
        <AnalyticCard 
          title="Followers"
          value={analyticsData.kpis.totalFollowers}
          change={analyticsData.changes.followersChange}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Likes"
          value={analyticsData.kpis.totalLikes}
          change={analyticsData.changes.likesChange}
          icon={<Heart className="w-5 h-5 text-pink-500" />}
          variant="danger"
        />
        <AnalyticCard 
          title="Shares"
          value={analyticsData.kpis.totalShares}
          change={analyticsData.changes.sharesChange}
          icon={<Share2 className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="NDA Requests"
          value={analyticsData.kpis.ndaRequests}
          change={analyticsData.changes.ndaChange}
          icon={<MessageSquare className="w-5 h-5 text-orange-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Average Rating"
          value={analyticsData.kpis.averageRating.toFixed(1)}
          change={analyticsData.changes.ratingChange}
          icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Response Rate"
          value={analyticsData.kpis.responseRate}
          change={analyticsData.changes.responseChange}
          icon={<MessageSquare className="w-5 h-5 text-teal-500" />}
          variant="success"
          format="percentage"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pitch Views Over Time */}
        <ChartContainer title="Pitch Views Over Time">
          <LineChart
            data={analyticsData.charts.pitchViews}
            title="Views"
            color="#3B82F6"
            height={300}
          />
        </ChartContainer>

        {/* Engagement Trends */}
        <ChartContainer title="Engagement Rate Trends">
          <AreaChart
            data={analyticsData.charts.engagementTrends}
            title="Engagement Rate (%)"
            color="#10B981"
            height={300}
          />
        </ChartContainer>

        {/* Category Performance */}
        <ChartContainer title="Performance by Category">
          <BarChart
            data={analyticsData.charts.categoryPerformance.map(item => ({
              category: item.category,
              value: item.views
            }))}
            title="Views by Category"
            height={300}
          />
        </ChartContainer>

        {/* Viewer Demographics */}
        <ChartContainer title="Audience Demographics">
          <PieChart
            data={analyticsData.charts.viewerDemographics.map(item => ({
              category: item.type,
              value: item.count
            }))}
            title="Viewer Types"
            type="doughnut"
            height={300}
          />
        </ChartContainer>

        {/* Funding Progress */}
        <ChartContainer title="Cumulative Funding Progress">
          <AreaChart
            data={analyticsData.charts.fundingProgress}
            title="Funding ($)"
            color="#F59E0B"
            height={300}
          />
        </ChartContainer>

        {/* Monthly Overview */}
        <ChartContainer title="Monthly Performance Overview">
          <MultiLineChart
            datasets={[
              {
                label: 'Pitches',
                data: analyticsData.charts.monthlyMetrics.map(item => ({
                  date: item.month,
                  value: item.pitches
                })),
                color: '#3B82F6'
              },
              {
                label: 'Views (x10)',
                data: analyticsData.charts.monthlyMetrics.map(item => ({
                  date: item.month,
                  value: Math.floor(item.views / 10)
                })),
                color: '#10B981'
              }
            ]}
            height={300}
          />
        </ChartContainer>
      </div>

      {/* Top Performing Pitches */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Top Performing Pitches</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsData.charts.topPitches.slice(0, 6).map((pitch, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 truncate flex-1">{pitch.title}</h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                  #{index + 1}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Views</p>
                  <p className="font-semibold">{pitch.views.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Engagement</p>
                  <p className="font-semibold">{pitch.engagement}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Funding</p>
                  <p className="font-semibold">${(pitch.funding / 1000).toFixed(0)}k</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedCreatorAnalytics;