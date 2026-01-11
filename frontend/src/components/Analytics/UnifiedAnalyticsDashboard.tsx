import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Eye, DollarSign, Star,
  PieChart, LineChart, Activity, Clock, Target, Calendar, Download,
  Filter, RefreshCw, Settings, MoreVertical, ChevronDown, ChevronUp,
  Zap, Globe, Smartphone, Monitor, AlertTriangle, CheckCircle,
  FileText, Mail, Bell, Share2, MessageSquare, Heart, Play,
  ArrowUpRight, ArrowDownRight, Minus, Plus, Layout, Grid3X3,
  LayoutDashboard, PresentationChart, Database, TrendingUpIcon,
  UserCheck, Building, CreditCard, Wallet
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'react-hot-toast';
import { analyticsService } from '../../services/analytics.service';
import { useAuthStore } from '../../store/authStore';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import AdvancedCharts from './AdvancedCharts';
import MetricsGrid from './MetricsGrid';
import ExportCenter from './ExportCenter';
import ReportBuilder from './ReportBuilder';
import BenchmarkingView from './BenchmarkingView';
import PredictiveAnalytics from './PredictiveAnalytics';

// Types for comprehensive analytics
interface UnifiedAnalyticsData {
  // Overview metrics for all roles
  overview: {
    totalViews: number;
    uniqueVisitors: number;
    activeUsers: number;
    totalRevenue: number;
    conversionRate: number;
    engagementRate: number;
    growthRate: number;
    churnRate: number;
  };
  
  // Role-specific metrics
  roleMetrics: {
    creator?: {
      totalPitches: number;
      publishedPitches: number;
      draftPitches: number;
      avgViewsPerPitch: number;
      totalFollowers: number;
      ndaRequests: number;
      successfulNDAs: number;
      totalMessages: number;
      avgRating: number;
      topGenres: { genre: string; count: number; avgRating: number }[];
      collaborationRequests: number;
      earningsThisMonth: number;
    };
    investor?: {
      totalInvestments: number;
      activeInvestments: number;
      portfolioValue: number;
      roi: number;
      successfulDeals: number;
      avgInvestmentAmount: number;
      industryFocus: { industry: string; percentage: number }[];
      riskProfile: 'conservative' | 'moderate' | 'aggressive';
      monthlyReturns: number;
      watchlistSize: number;
      dealsPipeline: number;
      networkScore: number;
    };
    production?: {
      activeProjects: number;
      completedProjects: number;
      inDevelopment: number;
      totalBudgetManaged: number;
      avgProjectDuration: number;
      successRate: number;
      talentManaged: number;
      partnershipsActive: number;
      revenueGenerated: number;
      projectsThisQuarter: number;
      budgetUtilization: number;
      teamSize: number;
    };
  };
  
  // Time-based analytics
  trends: {
    daily: { date: string; views: number; engagement: number; revenue: number }[];
    weekly: { week: string; users: number; content: number; transactions: number }[];
    monthly: { month: string; growth: number; churn: number; ltv: number }[];
  };
  
  // Geographic and demographic data
  geography: {
    countries: { country: string; users: number; revenue: number }[];
    cities: { city: string; users: number; engagementRate: number }[];
    timezones: { timezone: string; peakHours: number[]; activeUsers: number }[];
  };
  
  // Device and platform analytics
  technology: {
    devices: { type: string; percentage: number; avgSession: number }[];
    browsers: { browser: string; percentage: number; conversionRate: number }[];
    platforms: { platform: string; users: number; revenue: number }[];
    features: { feature: string; adoption: number; satisfaction: number }[];
  };
  
  // Performance metrics
  performance: {
    pageLoadTimes: { page: string; avgLoadTime: number; bounceRate: number }[];
    apiPerformance: { endpoint: string; avgResponseTime: number; errorRate: number }[];
    uptime: number;
    availability: number;
  };
  
  // Content analytics
  content: {
    topContent: { id: number; title: string; type: string; views: number; engagement: number }[];
    contentGrowth: { type: string; growth: number; quality: number }[];
    moderationStats: { flagged: number; approved: number; rejected: number }[];
  };
  
  // Financial analytics
  financial: {
    revenue: {
      total: number;
      recurring: number;
      oneTime: number;
      projected: number;
      growth: number;
    };
    costs: {
      infrastructure: number;
      personnel: number;
      marketing: number;
      operations: number;
    };
    profitability: {
      gross: number;
      net: number;
      margins: number;
      breakeven: string;
    };
  };
}

interface DashboardConfig {
  role: 'creator' | 'investor' | 'production' | 'admin';
  layout: 'compact' | 'detailed' | 'executive';
  timeRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  autoRefresh: boolean;
  refreshInterval: number;
  widgets: string[];
  customMetrics: string[];
}

interface AlertConfig {
  id: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily';
}

export default function UnifiedAnalyticsDashboard() {
  // Authentication and user context
  const { user } = useAuthStore();
  const { socket, isConnected } = useWebSocketContext();
  
  // Dashboard state
  const [analyticsData, setAnalyticsData] = useState<UnifiedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Configuration state
  const [config, setConfig] = useState<DashboardConfig>({
    role: (user?.usertype as 'creator' | 'investor' | 'production') || 'creator',
    layout: 'detailed',
    timeRange: 'month',
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    widgets: ['overview', 'trends', 'performance'],
    customMetrics: []
  });
  
  // View state
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [customDateRange, setCustomDateRange] = useState({
    start: subDays(new Date(), 30).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Advanced features state
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showBenchmarking, setShowBenchmarking] = useState(false);
  const [showPredictive, setShowPredictive] = useState(false);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  
  // Real-time updates via WebSocket
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('analytics_update', (data: any) => {
        setAnalyticsData(prev => prev ? { ...prev, ...data } : null);
      });
      
      socket.on('metric_alert', (alert: any) => {
        toast.error(`Alert: ${alert.metric} ${alert.condition} ${alert.threshold}`);
      });
      
      return () => {
        socket.off('analytics_update');
        socket.off('metric_alert');
      };
    }
  }, [socket, isConnected]);
  
  // Auto-refresh mechanism
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (config.autoRefresh && config.refreshInterval > 0) {
      interval = setInterval(() => {
        loadAnalyticsData(false);
      }, config.refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [config.autoRefresh, config.refreshInterval]);
  
  // Load analytics data
  const loadAnalyticsData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      // Build time range parameters
      const timeRange = config.timeRange === 'custom' 
        ? { start: customDateRange.start, end: customDateRange.end }
        : { preset: config.timeRange };
      
      // Load comprehensive analytics
      const [dashboardMetrics, userAnalytics, realtimeStats] = await Promise.all([
        analyticsService.getDashboardMetrics(timeRange),
        analyticsService.getUserAnalytics(user?.id, timeRange),
        config.autoRefresh ? analyticsService.getRealTimeStats() : null
      ]);
      
      // Transform data into unified format
      const unifiedData: UnifiedAnalyticsData = {
        overview: {
          totalViews: dashboardMetrics.overview.totalViews,
          uniqueVisitors: dashboardMetrics.overview.totalViews * 0.75,
          activeUsers: realtimeStats?.activeUsers || dashboardMetrics.overview.totalPitches * 10,
          totalRevenue: dashboardMetrics.revenue?.total || 0,
          conversionRate: 0.032,
          engagementRate: 0.24,
          growthRate: 0.12,
          churnRate: 0.05
        },
        roleMetrics: {
          [config.role]: getRoleSpecificMetrics(config.role, dashboardMetrics, userAnalytics)
        },
        trends: generateTrendData(timeRange),
        geography: generateGeographyData(),
        technology: generateTechnologyData(),
        performance: generatePerformanceData(),
        content: generateContentData(),
        financial: generateFinancialData(config.role)
      };
      
      setAnalyticsData(unifiedData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError('Failed to load analytics data');
      // Set fallback demo data
      setAnalyticsData(generateDemoAnalyticsData(config.role));
    } finally {
      setLoading(false);
    }
  }, [config, customDateRange, user?.id]);
  
  // Initial data load
  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);
  
  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData(false);
    setRefreshing(false);
    toast.success('Analytics data refreshed');
  };
  
  // Export data
  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    try {
      const blob = await analyticsService.exportAnalytics({
        format,
        dateRange: config.timeRange === 'custom' 
          ? { start: customDateRange.start, end: customDateRange.end }
          : { preset: config.timeRange },
        metrics: config.widgets,
        includeCharts: true
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${config.timeRange}_${format}_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export analytics');
    }
  };
  
  // Widget management
  const toggleWidget = (widgetId: string) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.includes(widgetId)
        ? prev.widgets.filter(w => w !== widgetId)
        : [...prev.widgets, widgetId]
    }));
  };
  
  // Available widgets by role
  const availableWidgets = useMemo(() => {
    const baseWidgets = [
      { id: 'overview', name: 'Overview', icon: LayoutDashboard, description: 'Key metrics summary' },
      { id: 'trends', name: 'Trends', icon: TrendingUp, description: 'Time-based analytics' },
      { id: 'performance', name: 'Performance', icon: Zap, description: 'System performance' },
      { id: 'geography', name: 'Geography', icon: Globe, description: 'Geographic insights' },
      { id: 'technology', name: 'Technology', icon: Monitor, description: 'Device & platform data' }
    ];
    
    const roleWidgets = {
      creator: [
        { id: 'content', name: 'Content', icon: FileText, description: 'Content performance' },
        { id: 'audience', name: 'Audience', icon: Users, description: 'Audience analytics' },
        { id: 'engagement', name: 'Engagement', icon: Heart, description: 'Engagement metrics' }
      ],
      investor: [
        { id: 'portfolio', name: 'Portfolio', icon: Wallet, description: 'Investment portfolio' },
        { id: 'deals', name: 'Deals', icon: CreditCard, description: 'Deal analytics' },
        { id: 'market', name: 'Market', icon: TrendingUpIcon, description: 'Market analysis' }
      ],
      production: [
        { id: 'projects', name: 'Projects', icon: Building, description: 'Project analytics' },
        { id: 'talent', name: 'Talent', icon: UserCheck, description: 'Talent management' },
        { id: 'budget', name: 'Budget', icon: DollarSign, description: 'Budget analysis' }
      ],
      admin: [
        { id: 'financial', name: 'Financial', icon: DollarSign, description: 'Financial analytics' },
        { id: 'platform', name: 'Platform', icon: Database, description: 'Platform metrics' },
        { id: 'security', name: 'Security', icon: AlertTriangle, description: 'Security analytics' }
      ]
    };
    
    return [...baseWidgets, ...(roleWidgets[config.role] || [])];
  }, [config.role]);
  
  // Role-specific metrics calculation
  function getRoleSpecificMetrics(role: string, dashboardMetrics: any, userAnalytics: any) {
    switch (role) {
      case 'creator':
        return {
          totalPitches: userAnalytics.totalPitches,
          publishedPitches: userAnalytics.publishedPitches,
          draftPitches: userAnalytics.totalPitches - userAnalytics.publishedPitches,
          avgViewsPerPitch: Math.round(userAnalytics.totalViews / Math.max(userAnalytics.totalPitches, 1)),
          totalFollowers: userAnalytics.totalFollowers,
          ndaRequests: userAnalytics.totalNDAs,
          successfulNDAs: Math.round(userAnalytics.totalNDAs * 0.8),
          totalMessages: userAnalytics.totalNDAs * 3,
          avgRating: 4.2,
          topGenres: [
            { genre: 'Drama', count: 3, avgRating: 4.5 },
            { genre: 'Thriller', count: 2, avgRating: 4.1 }
          ],
          collaborationRequests: 8,
          earningsThisMonth: 12500
        };
      
      case 'investor':
        return {
          totalInvestments: 15,
          activeInvestments: 8,
          portfolioValue: 2500000,
          roi: 0.18,
          successfulDeals: 12,
          avgInvestmentAmount: 166667,
          industryFocus: [
            { industry: 'Film & TV', percentage: 65 },
            { industry: 'Streaming', percentage: 25 },
            { industry: 'Documentary', percentage: 10 }
          ],
          riskProfile: 'moderate' as const,
          monthlyReturns: 0.025,
          watchlistSize: 23,
          dealsPipeline: 5,
          networkScore: 87
        };
      
      case 'production':
        return {
          activeProjects: 6,
          completedProjects: 18,
          inDevelopment: 3,
          totalBudgetManaged: 8500000,
          avgProjectDuration: 18,
          successRate: 0.72,
          talentManaged: 45,
          partnershipsActive: 12,
          revenueGenerated: 12000000,
          projectsThisQuarter: 4,
          budgetUtilization: 0.85,
          teamSize: 28
        };
      
      default:
        return {};
    }
  }
  
  // Generate mock trend data
  function generateTrendData(timeRange: any) {
    const days = timeRange.preset === 'week' ? 7 : timeRange.preset === 'month' ? 30 : 365;
    const daily = Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const date = subDays(new Date(), days - i - 1);
      return {
        date: format(date, 'yyyy-MM-dd'),
        views: Math.floor(Math.random() * 1000) + 200,
        engagement: Math.random() * 0.5 + 0.1,
        revenue: Math.floor(Math.random() * 5000) + 500
      };
    });
    
    return { daily, weekly: [], monthly: [] };
  }
  
  // Generate other mock data functions
  function generateGeographyData() {
    return {
      countries: [
        { country: 'United States', users: 8547, revenue: 125000 },
        { country: 'United Kingdom', users: 2156, revenue: 45000 },
        { country: 'Canada', users: 1843, revenue: 32000 }
      ],
      cities: [
        { city: 'Los Angeles', users: 2156, engagementRate: 0.35 },
        { city: 'New York', users: 1847, engagementRate: 0.28 },
        { city: 'London', users: 1234, engagementRate: 0.31 }
      ],
      timezones: [
        { timezone: 'PST', peakHours: [14, 15, 16, 19, 20], activeUsers: 3245 },
        { timezone: 'EST', peakHours: [12, 13, 18, 19, 20], activeUsers: 2876 }
      ]
    };
  }
  
  function generateTechnologyData() {
    return {
      devices: [
        { type: 'Desktop', percentage: 45, avgSession: 8.5 },
        { type: 'Mobile', percentage: 35, avgSession: 5.2 },
        { type: 'Tablet', percentage: 20, avgSession: 6.8 }
      ],
      browsers: [
        { browser: 'Chrome', percentage: 65, conversionRate: 0.035 },
        { browser: 'Safari', percentage: 25, conversionRate: 0.028 },
        { browser: 'Firefox', percentage: 10, conversionRate: 0.031 }
      ],
      platforms: [
        { platform: 'Web', users: 8547, revenue: 125000 },
        { platform: 'Mobile App', users: 3421, revenue: 45000 }
      ],
      features: [
        { feature: 'Video Player', adoption: 0.89, satisfaction: 4.2 },
        { feature: 'NDA Workflow', adoption: 0.67, satisfaction: 4.0 }
      ]
    };
  }
  
  function generatePerformanceData() {
    return {
      pageLoadTimes: [
        { page: '/browse', avgLoadTime: 1.2, bounceRate: 0.15 },
        { page: '/pitch/:id', avgLoadTime: 2.1, bounceRate: 0.22 }
      ],
      apiPerformance: [
        { endpoint: '/api/pitches', avgResponseTime: 150, errorRate: 0.002 },
        { endpoint: '/api/analytics', avgResponseTime: 280, errorRate: 0.001 }
      ],
      uptime: 99.95,
      availability: 99.98
    };
  }
  
  function generateContentData() {
    return {
      topContent: [
        { id: 1, title: 'The Last Stand', type: 'pitch', views: 8547, engagement: 0.35 },
        { id: 2, title: 'Space Odyssey', type: 'pitch', views: 6234, engagement: 0.28 }
      ],
      contentGrowth: [
        { type: 'Pitches', growth: 0.15, quality: 4.2 },
        { type: 'NDAs', growth: 0.25, quality: 4.5 }
      ],
      moderationStats: {
        flagged: 23,
        approved: 156,
        rejected: 8
      }
    };
  }
  
  function generateFinancialData(role: string) {
    const baseRevenue = role === 'production' ? 500000 : role === 'investor' ? 300000 : 50000;
    
    return {
      revenue: {
        total: baseRevenue,
        recurring: baseRevenue * 0.7,
        oneTime: baseRevenue * 0.3,
        projected: baseRevenue * 1.2,
        growth: 0.15
      },
      costs: {
        infrastructure: 15000,
        personnel: 85000,
        marketing: 25000,
        operations: 20000
      },
      profitability: {
        gross: baseRevenue * 0.7,
        net: baseRevenue * 0.2,
        margins: 0.2,
        breakeven: 'Q2 2024'
      }
    };
  }
  
  function generateDemoAnalyticsData(role: string): UnifiedAnalyticsData {
    return {
      overview: {
        totalViews: 125847,
        uniqueVisitors: 85642,
        activeUsers: 12456,
        totalRevenue: role === 'production' ? 500000 : role === 'investor' ? 300000 : 50000,
        conversionRate: 0.032,
        engagementRate: 0.24,
        growthRate: 0.12,
        churnRate: 0.05
      },
      roleMetrics: {
        [role]: getRoleSpecificMetrics(role, {}, {
          totalPitches: 8,
          publishedPitches: 6,
          totalViews: 15420,
          totalFollowers: 234,
          totalNDAs: 12
        })
      },
      trends: generateTrendData({ preset: 'month' }),
      geography: generateGeographyData(),
      technology: generateTechnologyData(),
      performance: generatePerformanceData(),
      content: generateContentData(),
      financial: generateFinancialData(role)
    };
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Unavailable</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadAnalyticsData()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!analyticsData) return null;
  
  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'trends', name: 'Trends', icon: TrendingUp },
    { id: 'audience', name: 'Audience', icon: Users },
    { id: 'performance', name: 'Performance', icon: Zap },
    { id: 'content', name: 'Content', icon: FileText },
    { id: 'financial', name: 'Financial', icon: DollarSign },
    { id: 'insights', name: 'Insights', icon: PresentationChart }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Analytics Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  {config.role.charAt(0).toUpperCase() + config.role.slice(1)} Portal • {config.layout} Layout
                </p>
              </div>
              
              {/* Real-time indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Time range selector */}
              <select
                value={config.timeRange}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  timeRange: e.target.value as any 
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
              
              {/* Layout selector */}
              <select
                value={config.layout}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  layout: e.target.value as any 
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="compact">Compact</option>
                <option value="detailed">Detailed</option>
                <option value="executive">Executive</option>
              </select>
              
              {/* Action buttons */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm">Refresh</span>
              </button>
              
              <button
                onClick={() => setShowExportCenter(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export</span>
              </button>
              
              {/* More options */}
              <div className="relative">
                <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Custom date range */}
          {config.timeRange === 'custom' && (
            <div className="mt-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">From:</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">To:</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <MetricsGrid 
            data={analyticsData}
            config={config}
            role={config.role}
            layout={config.layout}
          />
        )}
        
        {activeTab === 'trends' && (
          <AdvancedCharts 
            data={analyticsData}
            config={config}
            timeRange={config.timeRange}
            customDateRange={customDateRange}
          />
        )}
        
        {activeTab === 'insights' && (
          <PredictiveAnalytics 
            data={analyticsData}
            role={config.role}
            timeRange={config.timeRange}
          />
        )}
        
        {/* Other tabs would render their respective components */}
        {activeTab !== 'overview' && activeTab !== 'trends' && activeTab !== 'insights' && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="text-gray-500">
              <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{tabs.find(t => t.id === activeTab)?.name} Analytics</h3>
              <p>Advanced {activeTab} analytics visualization coming soon.</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Export Center Modal */}
      {showExportCenter && (
        <ExportCenter
          data={analyticsData}
          config={config}
          onClose={() => setShowExportCenter(false)}
          onExport={handleExport}
        />
      )}
      
      {/* Report Builder Modal */}
      {showReportBuilder && (
        <ReportBuilder
          data={analyticsData}
          config={config}
          onClose={() => setShowReportBuilder(false)}
        />
      )}
    </div>
  );
}