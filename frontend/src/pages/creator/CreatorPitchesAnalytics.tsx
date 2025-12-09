import { useState, useEffect } from 'react';
import { 
  TrendingUp, Eye, Heart, MessageSquare, Share2,
  Download, Calendar, Filter, BarChart3, PieChart,
  Activity, Users, Clock, Target, ArrowUp, ArrowDown,
  ExternalLink, Zap, Award, Globe, MapPin
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import DashboardHeader from '../../components/DashboardHeader';
import { useAuthStore } from '../../store/authStore';

interface PitchMetrics {
  pitchId: string;
  title: string;
  totalViews: number;
  uniqueViews: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  ndaRequests: number;
  engagementRate: number;
  conversionRate: number;
  averageTimeSpent: number;
  bounceRate: number;
  topCountries: string[];
  topDemographics: { age: string; percentage: number }[];
  recentTrend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface AnalyticsOverview {
  totalViews: number;
  totalEngagement: number;
  averageRating: number;
  activePitches: number;
  topPerformingPitch: string;
  growthRate: number;
}

interface TimeSeriesData {
  date: string;
  views: number;
  engagement: number;
  newFollowers: number;
}

export default function CreatorPitchesAnalytics() {
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedPitch, setSelectedPitch] = useState<string>('all');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [pitchMetrics, setPitchMetrics] = useState<PitchMetrics[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedPitch]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Simulate API call - replace with actual API
      setTimeout(() => {
        // Mock overview data
        setOverview({
          totalViews: 45678,
          totalEngagement: 3456,
          averageRating: 8.2,
          activePitches: 7,
          topPerformingPitch: 'The Quantum Paradox',
          growthRate: 23.5
        });

        // Mock pitch metrics
        setPitchMetrics([
          {
            pitchId: '1',
            title: 'The Quantum Paradox',
            totalViews: 15420,
            uniqueViews: 12350,
            likes: 892,
            comments: 156,
            shares: 234,
            saves: 445,
            ndaRequests: 23,
            engagementRate: 8.7,
            conversionRate: 2.1,
            averageTimeSpent: 345,
            bounceRate: 35,
            topCountries: ['USA', 'UK', 'Canada', 'Australia'],
            topDemographics: [
              { age: '25-34', percentage: 35 },
              { age: '35-44', percentage: 28 },
              { age: '18-24', percentage: 22 },
              { age: '45-54', percentage: 15 }
            ],
            recentTrend: 'up',
            trendPercentage: 15.3
          },
          {
            pitchId: '2',
            title: 'Midnight Café',
            totalViews: 8920,
            uniqueViews: 7640,
            likes: 456,
            comments: 89,
            shares: 123,
            saves: 267,
            ndaRequests: 12,
            engagementRate: 6.2,
            conversionRate: 1.4,
            averageTimeSpent: 298,
            bounceRate: 42,
            topCountries: ['USA', 'Canada', 'UK', 'Germany'],
            topDemographics: [
              { age: '35-44', percentage: 32 },
              { age: '25-34', percentage: 29 },
              { age: '45-54', percentage: 24 },
              { age: '18-24', percentage: 15 }
            ],
            recentTrend: 'down',
            trendPercentage: -3.2
          },
          {
            pitchId: '3',
            title: 'The Last Symphony',
            totalViews: 12140,
            uniqueViews: 9870,
            likes: 678,
            comments: 134,
            shares: 189,
            saves: 356,
            ndaRequests: 18,
            engagementRate: 7.8,
            conversionRate: 1.8,
            averageTimeSpent: 412,
            bounceRate: 28,
            topCountries: ['USA', 'UK', 'France', 'Germany'],
            topDemographics: [
              { age: '45-54', percentage: 38 },
              { age: '35-44', percentage: 31 },
              { age: '55-64', percentage: 18 },
              { age: '25-34', percentage: 13 }
            ],
            recentTrend: 'up',
            trendPercentage: 8.4
          }
        ]);

        // Mock time series data
        setTimeSeriesData([
          { date: '2024-11-09', views: 1240, engagement: 89, newFollowers: 12 },
          { date: '2024-11-10', views: 1580, engagement: 134, newFollowers: 18 },
          { date: '2024-11-11', views: 1320, engagement: 98, newFollowers: 8 },
          { date: '2024-11-12', views: 1890, engagement: 156, newFollowers: 22 },
          { date: '2024-11-13', views: 2100, engagement: 189, newFollowers: 29 },
          { date: '2024-11-14', views: 1750, engagement: 145, newFollowers: 15 },
          { date: '2024-11-15', views: 2340, engagement: 234, newFollowers: 34 }
        ]);

        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setLoading(false);
    }
  };

  // Chart data
  const viewsOverTimeData = timeSeriesData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: d.views,
    engagement: d.engagement
  }));

  const pitchComparisonData = pitchMetrics.map(p => ({
    title: p.title.length > 15 ? p.title.substring(0, 15) + '...' : p.title,
    views: p.totalViews
  }));

  const engagementBreakdownData = [
    { name: 'Likes', value: pitchMetrics.reduce((sum, p) => sum + p.likes, 0), fill: 'hsl(var(--chart-1))' },
    { name: 'Comments', value: pitchMetrics.reduce((sum, p) => sum + p.comments, 0), fill: 'hsl(var(--chart-2))' },
    { name: 'Shares', value: pitchMetrics.reduce((sum, p) => sum + p.shares, 0), fill: 'hsl(var(--chart-3))' },
    { name: 'Saves', value: pitchMetrics.reduce((sum, p) => sum + p.saves, 0), fill: 'hsl(var(--chart-4))' },
    { name: 'NDA Requests', value: pitchMetrics.reduce((sum, p) => sum + p.ndaRequests, 0), fill: 'hsl(var(--chart-5))' }
  ];

  const topCountriesData = [
    { name: 'USA', value: 45, fill: 'hsl(var(--chart-1))' },
    { name: 'UK', value: 18, fill: 'hsl(var(--chart-2))' },
    { name: 'Canada', value: 12, fill: 'hsl(var(--chart-3))' },
    { name: 'Germany', value: 10, fill: 'hsl(var(--chart-4))' },
    { name: 'Australia', value: 8, fill: 'hsl(var(--chart-5))' }
  ];

  // Chart configurations
  const viewsConfig = {
    views: {
      label: 'Views',
      color: 'hsl(var(--chart-1))'
    },
    engagement: {
      label: 'Engagement',
      color: 'hsl(var(--chart-2))'
    }
  };

  const pitchConfig = {
    views: {
      label: 'Views',
      color: 'hsl(var(--chart-1))'
    }
  };

  const engagementConfig = {
    value: {
      label: 'Engagement'
    }
  };

  const countriesConfig = {
    value: {
      label: 'Countries'
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          userType="creator"
          title="Pitch Analytics"
          onLogout={logout}
          useEnhancedNav={true}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="creator"
        title="Pitch Analytics"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pitch Analytics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track performance and engagement metrics for your pitches
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <select
              value={selectedPitch}
              onChange={(e) => setSelectedPitch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Pitches</option>
              {pitchMetrics.map(pitch => (
                <option key={pitch.pitchId} value={pitch.pitchId}>{pitch.title}</option>
              ))}
            </select>
            
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Views</span>
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{overview.totalViews.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="w-3 h-3" />
                <span>+{overview.growthRate}%</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Engagement</span>
                <Heart className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{overview.totalEngagement.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="w-3 h-3" />
                <span>+12.3%</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Avg Rating</span>
                <Award className="w-4 h-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{overview.averageRating}/10</p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="w-3 h-3" />
                <span>+0.3</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Active Pitches</span>
                <Activity className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{overview.activePitches}</p>
              <div className="text-sm text-gray-500">
                <span>Live projects</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Top Performer</span>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {overview.topPerformingPitch}
              </p>
              <div className="text-xs text-gray-500">
                <span>Best engagement</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Growth Rate</span>
                <Zap className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">+{overview.growthRate}%</p>
              <div className="text-sm text-gray-500">
                <span>This period</span>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Views Over Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Views & Engagement Over Time</CardTitle>
                <CardDescription>Track performance trends over the selected period</CardDescription>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={viewsConfig} className="h-[300px]">
                <LineChart data={viewsOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="var(--color-views)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-views)" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="var(--color-engagement)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-engagement)" }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Pitch Comparison */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Pitch Performance Comparison</CardTitle>
                <CardDescription>Total views across your active pitches</CardDescription>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={pitchConfig} className="h-[300px]">
                <BarChart data={pitchComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="title" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="views" fill="var(--color-views)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Engagement Breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Engagement Breakdown</CardTitle>
                <CardDescription>Types of user interaction with your content</CardDescription>
              </div>
              <PieChart className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={engagementConfig} className="h-[300px]">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={engagementBreakdownData} dataKey="value" nameKey="name">
                    {engagementBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </RechartsPieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Top Countries</CardTitle>
                <CardDescription>Geographic distribution of your audience</CardDescription>
              </div>
              <Globe className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={countriesConfig} className="h-[300px]">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={topCountriesData} dataKey="value" nameKey="name" innerRadius={60}>
                    {topCountriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </RechartsPieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Pitch Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Individual Pitch Performance</CardTitle>
            <CardDescription>Detailed metrics for each of your pitches</CardDescription>
          </CardHeader>
          <CardContent>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pitch Title
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversion
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg. Time
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NDA Requests
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pitchMetrics.map((pitch) => (
                  <tr key={pitch.pitchId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{pitch.title}</div>
                        <div className="text-sm text-gray-500">
                          Unique: {pitch.uniqueViews.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {pitch.totalViews.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Total views
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {pitch.engagementRate}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {(pitch.likes + pitch.comments + pitch.shares).toLocaleString()} interactions
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {pitch.conversionRate}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {pitch.bounceRate}% bounce
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {Math.floor(pitch.averageTimeSpent / 60)}m {pitch.averageTimeSpent % 60}s
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {pitch.ndaRequests}
                      </div>
                      <div className="text-xs text-gray-500">
                        Professional interest
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1 text-sm font-medium ${
                        pitch.recentTrend === 'up' ? 'text-green-600' :
                        pitch.recentTrend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {pitch.recentTrend === 'up' ? <ArrowUp className="w-3 h-3" /> :
                         pitch.recentTrend === 'down' ? <ArrowDown className="w-3 h-3" /> :
                         <span className="w-3 h-0.5 bg-gray-400 rounded"></span>}
                        {Math.abs(pitch.trendPercentage)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => window.open(`/pitch/${pitch.pitchId}`, '_blank')}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </CardContent>
        </Card>

        {/* Insights and Recommendations */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Analytics Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Best Performing Content</p>
                <p className="text-sm text-blue-700">
                  Sci-fi concepts show 35% higher engagement than average
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Audience Growth</p>
                <p className="text-sm text-blue-700">
                  25-34 age group represents your strongest demographic
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Optimal Timing</p>
                <p className="text-sm text-blue-700">
                  Posts at 2-4 PM EST get 40% more initial engagement
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}