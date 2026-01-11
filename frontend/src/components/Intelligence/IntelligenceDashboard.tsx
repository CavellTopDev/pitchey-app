/**
 * Intelligence Dashboard Component
 * Comprehensive UI for Crawl4AI intelligence layer features
 * Displays market intelligence, trends, opportunities, and competitive analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useIntelligenceWebSocket } from '../../hooks/useIntelligenceWebSocket';
import type { 
  MarketNewsUpdate, 
  TrendAlert, 
  OpportunityUpdate, 
  CompetitiveChange, 
  EnrichmentComplete 
} from '../../types/websocket';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  PieChart,
  Globe,
  Lightbulb,
  DollarSign,
  Clock,
  Eye,
  Star
} from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Types
interface MarketIntelligence {
  id: string;
  intelligenceType: 'news' | 'box_office' | 'trends' | 'opportunities' | 'alerts';
  title: string;
  summary?: string;
  sourceName: string;
  category: string;
  relevanceScore: number;
  impactScore: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  publishedDate?: string;
  createdAt: string;
}

interface TrendAnalysis {
  id: string;
  trendName: string;
  trendDirection: 'rising' | 'stable' | 'falling' | 'volatile';
  trendStrength: number;
  momentumScore: number;
  factorsDrivingTrend: string[];
}

interface InvestmentOpportunity {
  id: string;
  title: string;
  opportunityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  timeSensitivity: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  estimatedRoiMin?: number;
  estimatedRoiMax?: number;
  alertLevel: 'info' | 'low' | 'medium' | 'high' | 'urgent';
}

interface IntelligenceDashboard {
  marketNews: {
    count: number;
    avgRelevance: number;
    latestUpdate: string;
    topStories: MarketIntelligence[];
  };
  opportunities: {
    count: number;
    avgScore: number;
    latestUpdate: string;
    highPriority: InvestmentOpportunity[];
  };
  trends: {
    count: number;
    avgStrength: number;
    latestUpdate: string;
    rising: TrendAnalysis[];
    falling: TrendAnalysis[];
  };
  competitive: {
    analysisDate: string;
    competitorCount: number;
    recommendations: string[];
    marketGaps: string[];
  };
}

const IntelligenceDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<IntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'trends' | 'opportunities' | 'competitive'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    timeRange: '7d',
    category: 'all',
    urgency: 'all'
  });

  // Real-time updates via WebSocket
  const [realtimeUpdates, setRealtimeUpdates] = useState<{
    news: MarketNewsUpdate[];
    trends: TrendAlert[];
    opportunities: OpportunityUpdate[];
    competitive: CompetitiveChange[];
  }>({
    news: [],
    trends: [],
    opportunities: [],
    competitive: []
  });

  // WebSocket handlers for real-time intelligence updates
  const handleMarketNews = useCallback((news: MarketNewsUpdate) => {
    setRealtimeUpdates(prev => ({
      ...prev,
      news: [news, ...prev.news].slice(0, 10) // Keep last 10 news items
    }));
    
    // Merge with dashboard data if available
    setDashboardData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        marketIntelligence: {
          ...prev.marketIntelligence,
          news: [
            {
              id: news.id,
              headline: news.headline,
              summary: news.summary,
              source: news.source,
              impact: news.impact,
              relevanceScore: news.relevanceScore,
              tags: news.tags,
              publishedAt: news.publishedAt,
              url: news.url || ''
            },
            ...prev.marketIntelligence.news
          ].slice(0, 20) // Keep last 20 news items
        }
      };
    });
  }, []);

  const handleTrendAlert = useCallback((trend: TrendAlert) => {
    setRealtimeUpdates(prev => ({
      ...prev,
      trends: [trend, ...prev.trends].slice(0, 10)
    }));

    // Merge with dashboard data
    setDashboardData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        trends: {
          ...prev.trends,
          trending: [
            {
              id: trend.id,
              name: trend.name,
              type: trend.type,
              direction: trend.direction,
              strength: trend.strength,
              confidence: trend.confidence,
              timeframe: trend.timeframe,
              description: trend.description,
              impact: trend.impact
            },
            ...prev.trends.trending
          ].slice(0, 15)
        }
      };
    });
  }, []);

  const handleOpportunityUpdate = useCallback((opportunity: OpportunityUpdate) => {
    setRealtimeUpdates(prev => ({
      ...prev,
      opportunities: [opportunity, ...prev.opportunities].slice(0, 10)
    }));

    // Merge with dashboard data
    setDashboardData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        opportunities: {
          ...prev.opportunities,
          highValue: [
            {
              id: opportunity.id,
              title: opportunity.title,
              type: opportunity.type,
              description: opportunity.description,
              confidence: opportunity.confidence,
              potentialValue: opportunity.potentialValue,
              timeToAct: opportunity.timeToAct,
              requirements: opportunity.requirements,
              competitionLevel: opportunity.competitionLevel
            },
            ...prev.opportunities.highValue
          ].slice(0, 15)
        }
      };
    });
  }, []);

  const handleCompetitiveChange = useCallback((change: CompetitiveChange) => {
    setRealtimeUpdates(prev => ({
      ...prev,
      competitive: [change, ...prev.competitive].slice(0, 10)
    }));
  }, []);

  const handleEnrichmentComplete = useCallback((enrichment: EnrichmentComplete) => {
    // Could show a toast notification or update pitch-specific data
  }, []);

  // Initialize WebSocket connection for intelligence updates
  const { 
    isConnected: wsConnected, 
    lastUpdate, 
    updateCount,
    errors: wsErrors,
    clearErrors: clearWsErrors,
    requestMarketNews,
    requestTrends,
    requestOpportunities,
    requestCompetitiveAnalysis
  } = useIntelligenceWebSocket({
    onMarketNews: handleMarketNews,
    onTrendAlert: handleTrendAlert,
    onOpportunityUpdate: handleOpportunityUpdate,
    onCompetitiveChange: handleCompetitiveChange,
    onEnrichmentComplete: handleEnrichmentComplete,
    autoSubscribe: true
  });

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/intelligence/dashboard');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6 w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="h-4 bg-gray-300 rounded mb-4 w-2/3"></div>
                  <div className="h-8 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Failed to Load Intelligence Dashboard
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  // Chart configurations
  const trendChartData = {
    labels: dashboardData.trends.rising.slice(0, 6).map(t => t.trendName),
    datasets: [
      {
        label: 'Trend Strength',
        data: dashboardData.trends.rising.slice(0, 6).map(t => t.trendStrength),
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
        fill: true,
      },
      {
        label: 'Momentum',
        data: dashboardData.trends.rising.slice(0, 6).map(t => t.momentumScore),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        fill: true,
      }
    ]
  };

  const opportunityDistributionData = {
    labels: ['High Priority', 'Medium Priority', 'Low Priority'],
    datasets: [{
      data: [
        dashboardData.opportunities.highPriority.filter(o => o.alertLevel === 'urgent' || o.alertLevel === 'high').length,
        dashboardData.opportunities.highPriority.filter(o => o.alertLevel === 'medium').length,
        dashboardData.opportunities.highPriority.filter(o => o.alertLevel === 'low' || o.alertLevel === 'info').length
      ],
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(34, 197, 94, 0.8)'
      ],
      borderWidth: 0
    }]
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Info className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'rising': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'falling': return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'stable': return <Activity className="h-5 w-5 text-blue-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Intelligence Dashboard
            </h1>
            <p className="text-gray-600">
              Real-time market intelligence and competitive analysis
            </p>
            <div className="flex items-center space-x-4 mt-2">
              {/* WebSocket Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {wsConnected ? 'Live Updates Active' : 'Connecting...'}
                </span>
              </div>
              
              {/* Update Stats */}
              {updateCount > 0 && (
                <div className="text-sm text-gray-600">
                  {updateCount} update{updateCount !== 1 ? 's' : ''} received
                  {lastUpdate && (
                    <span className="text-gray-400 ml-1">
                      (last: {new Date(lastUpdate).toLocaleTimeString()})
                    </span>
                  )}
                </div>
              )}
              
              {/* WebSocket Errors */}
              {wsErrors.length > 0 && (
                <button
                  onClick={clearWsErrors}
                  className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>{wsErrors.length} error{wsErrors.length !== 1 ? 's' : ''}</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search intelligence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            {/* Real-time Intelligence Action Buttons */}
            {wsConnected && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={requestMarketNews}
                  className="flex items-center space-x-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Globe className="h-3 w-3" />
                  <span>Live News</span>
                </button>
                <button
                  onClick={requestTrends}
                  className="flex items-center space-x-1 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <TrendingUp className="h-3 w-3" />
                  <span>Trends</span>
                </button>
                <button
                  onClick={requestOpportunities}
                  className="flex items-center space-x-1 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span>Opportunities</span>
                </button>
                <button
                  onClick={requestCompetitiveAnalysis}
                  className="flex items-center space-x-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  <Target className="h-3 w-3" />
                  <span>Competitors</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'news', label: 'Market News', icon: Globe },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
              { id: 'opportunities', label: 'Opportunities', icon: Target },
              { id: 'competitive', label: 'Competitive', icon: Eye }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Market News</h3>
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {dashboardData.marketNews.count}
                </div>
                <div className="text-sm text-gray-500">
                  Avg. Relevance: {(dashboardData.marketNews.avgRelevance * 100).toFixed(1)}%
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Opportunities</h3>
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {dashboardData.opportunities.count}
                </div>
                <div className="text-sm text-gray-500">
                  Avg. Score: {dashboardData.opportunities.avgScore.toFixed(1)}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Active Trends</h3>
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {dashboardData.trends.count}
                </div>
                <div className="text-sm text-gray-500">
                  Avg. Strength: {dashboardData.trends.avgStrength.toFixed(1)}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Competitors</h3>
                  <Eye className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {dashboardData.competitive.competitorCount}
                </div>
                <div className="text-sm text-gray-500">
                  Monitored platforms
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Trend Analysis Chart */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Rising Trends</h3>
                <div className="h-64">
                  <Line 
                    data={trendChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Opportunity Distribution */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Opportunity Distribution</h3>
                <div className="h-64 flex items-center justify-center">
                  <Doughnut 
                    data={opportunityDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom' as const,
                        },
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Recent Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top News */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">Top Market News</h3>
                <div className="space-y-4">
                  {dashboardData.marketNews.topStories.slice(0, 5).map((story) => (
                    <div key={story.id} className="flex items-start space-x-3">
                      {getUrgencyIcon(story.urgencyLevel)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {story.title}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">{story.sourceName}</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            Relevance: {(story.relevanceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* High Priority Opportunities */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold mb-4">High Priority Opportunities</h3>
                <div className="space-y-4">
                  {dashboardData.opportunities.highPriority.slice(0, 5).map((opportunity) => (
                    <div key={opportunity.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {opportunity.title}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskLevelColor(opportunity.riskLevel)}`}>
                          {opportunity.riskLevel.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Star className="h-3 w-3" />
                          <span>Score: {opportunity.opportunityScore}</span>
                        </span>
                        {opportunity.estimatedRoiMin && (
                          <span className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3" />
                            <span>ROI: {opportunity.estimatedRoiMin}-{opportunity.estimatedRoiMax}%</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{opportunity.timeSensitivity.replace('_', ' ')}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Market Intelligence News</h3>
            <div className="space-y-4">
              {dashboardData.marketNews.topStories.map((story) => (
                <div key={story.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-medium text-gray-900 hover:text-blue-600 cursor-pointer">
                      {story.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {getUrgencyIcon(story.urgencyLevel)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700`}>
                        {story.category}
                      </span>
                    </div>
                  </div>
                  {story.summary && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {story.summary}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{story.sourceName}</span>
                    <span>Impact: {story.impactScore}/10</span>
                    <span>Relevance: {(story.relevanceScore * 100).toFixed(0)}%</span>
                    <span>{new Date(story.publishedDate || story.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* Rising Trends */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-700">Rising Trends</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.trends.rising.map((trend) => (
                  <div key={trend.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-green-900">{trend.trendName}</h4>
                      {getTrendIcon(trend.trendDirection)}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Strength:</span>
                        <span className="font-medium">{trend.trendStrength}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Momentum:</span>
                        <span className="font-medium">{trend.momentumScore}%</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-green-600">
                        Driving factors: {trend.factorsDrivingTrend.slice(0, 2).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Falling Trends */}
            {dashboardData.trends.falling.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-700">Declining Trends</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.trends.falling.map((trend) => (
                    <div key={trend.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-red-900">{trend.trendName}</h4>
                        {getTrendIcon(trend.trendDirection)}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-red-700">Strength:</span>
                          <span className="font-medium">{trend.trendStrength}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-700">Momentum:</span>
                          <span className="font-medium">{trend.momentumScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Investment Opportunities</h3>
            <div className="space-y-4">
              {dashboardData.opportunities.highPriority.map((opportunity) => (
                <div key={opportunity.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-base font-medium text-gray-900">
                      {opportunity.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        opportunity.alertLevel === 'urgent' ? 'bg-red-100 text-red-700' :
                        opportunity.alertLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                        opportunity.alertLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {opportunity.alertLevel.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskLevelColor(opportunity.riskLevel)}`}>
                        {opportunity.riskLevel.replace('_', ' ').toUpperCase()} RISK
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Score:</span>
                      <div className="font-medium text-blue-600">{opportunity.opportunityScore}/100</div>
                    </div>
                    {opportunity.estimatedRoiMin && (
                      <div>
                        <span className="text-gray-500">Est. ROI:</span>
                        <div className="font-medium text-green-600">
                          {opportunity.estimatedRoiMin}-{opportunity.estimatedRoiMax}%
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Timing:</span>
                      <div className="font-medium capitalize">
                        {opportunity.timeSensitivity.replace('_', ' ')}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Risk:</span>
                      <div className="font-medium capitalize">
                        {opportunity.riskLevel.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitive Tab */}
        {activeTab === 'competitive' && (
          <div className="space-y-6">
            {/* Competitive Overview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Competitive Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {dashboardData.competitive.competitorCount}
                  </div>
                  <div className="text-sm text-gray-600">Competitors Tracked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {dashboardData.competitive.recommendations.length}
                  </div>
                  <div className="text-sm text-gray-600">Strategic Recommendations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {dashboardData.competitive.marketGaps.length}
                  </div>
                  <div className="text-sm text-gray-600">Market Gaps Identified</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Lightbulb className="h-5 w-5 text-yellow-500 mr-2" />
                Strategic Recommendations
              </h3>
              <div className="space-y-3">
                {dashboardData.competitive.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Gaps */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Target className="h-5 w-5 text-green-500 mr-2" />
                Market Opportunities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.competitive.marketGaps.map((gap, index) => (
                  <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800 font-medium">{gap}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenceDashboard;