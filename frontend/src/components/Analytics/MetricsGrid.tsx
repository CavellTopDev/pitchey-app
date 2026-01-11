import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Eye, Users, DollarSign, Star, Heart,
  MessageSquare, FileText, Play, Clock, Target, Zap, Activity,
  BarChart3, PieChart, Globe, Monitor, Smartphone, Building,
  UserCheck, CreditCard, Wallet, ArrowUpRight, ArrowDownRight,
  Minus, AlertTriangle, CheckCircle, Info, Sparkles, Award,
  Calendar, RefreshCw, Filter, MoreHorizontal, ChevronUp,
  ChevronDown, TrendingUpIcon
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

// Metric card configuration types
interface MetricConfig {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'overview' | 'performance' | 'engagement' | 'revenue' | 'growth';
  dataPath: string;
  formatter: 'number' | 'currency' | 'percentage' | 'duration' | 'rating';
  trend?: {
    dataPath: string;
    threshold: { good: number; warning: number };
  };
  target?: number;
  priority: 'high' | 'medium' | 'low';
  realtime?: boolean;
  roles: ('creator' | 'investor' | 'production' | 'admin')[];
}

// Layout configurations
type LayoutType = 'compact' | 'detailed' | 'executive';

interface MetricsGridProps {
  data: any;
  config: {
    role: 'creator' | 'investor' | 'production' | 'admin';
    layout: LayoutType;
    timeRange: string;
  };
  role: string;
  layout: string;
}

// Comprehensive metric definitions
const METRIC_DEFINITIONS: MetricConfig[] = [
  // Universal Overview Metrics
  {
    id: 'total_views',
    title: 'Total Views',
    description: 'Total content views across platform',
    icon: Eye,
    category: 'overview',
    dataPath: 'overview.totalViews',
    formatter: 'number',
    trend: {
      dataPath: 'overview.viewsChange',
      threshold: { good: 5, warning: -5 }
    },
    priority: 'high',
    realtime: true,
    roles: ['creator', 'investor', 'production', 'admin']
  },
  {
    id: 'active_users',
    title: 'Active Users',
    description: 'Currently active users on platform',
    icon: Users,
    category: 'overview',
    dataPath: 'overview.activeUsers',
    formatter: 'number',
    priority: 'high',
    realtime: true,
    roles: ['creator', 'investor', 'production', 'admin']
  },
  {
    id: 'total_revenue',
    title: 'Total Revenue',
    description: 'Total platform revenue',
    icon: DollarSign,
    category: 'revenue',
    dataPath: 'overview.totalRevenue',
    formatter: 'currency',
    trend: {
      dataPath: 'overview.revenueGrowth',
      threshold: { good: 10, warning: 0 }
    },
    priority: 'high',
    roles: ['investor', 'production', 'admin']
  },
  {
    id: 'conversion_rate',
    title: 'Conversion Rate',
    description: 'Overall platform conversion rate',
    icon: Target,
    category: 'performance',
    dataPath: 'overview.conversionRate',
    formatter: 'percentage',
    target: 0.05,
    priority: 'medium',
    roles: ['creator', 'investor', 'production', 'admin']
  },
  {
    id: 'engagement_rate',
    title: 'Engagement Rate',
    description: 'User engagement across content',
    icon: Heart,
    category: 'engagement',
    dataPath: 'overview.engagementRate',
    formatter: 'percentage',
    target: 0.25,
    priority: 'medium',
    realtime: true,
    roles: ['creator', 'investor', 'production', 'admin']
  },
  
  // Creator-Specific Metrics
  {
    id: 'creator_pitches',
    title: 'Total Pitches',
    description: 'Number of pitches created',
    icon: FileText,
    category: 'overview',
    dataPath: 'roleMetrics.creator.totalPitches',
    formatter: 'number',
    priority: 'high',
    roles: ['creator']
  },
  {
    id: 'creator_followers',
    title: 'Followers',
    description: 'Total followers across platform',
    icon: Users,
    category: 'growth',
    dataPath: 'roleMetrics.creator.totalFollowers',
    formatter: 'number',
    trend: {
      dataPath: 'roleMetrics.creator.followerGrowth',
      threshold: { good: 5, warning: 0 }
    },
    priority: 'high',
    realtime: true,
    roles: ['creator']
  },
  {
    id: 'creator_nda_requests',
    title: 'NDA Requests',
    description: 'Number of NDA requests received',
    icon: MessageSquare,
    category: 'engagement',
    dataPath: 'roleMetrics.creator.ndaRequests',
    formatter: 'number',
    priority: 'medium',
    roles: ['creator']
  },
  {
    id: 'creator_avg_rating',
    title: 'Average Rating',
    description: 'Average rating across all pitches',
    icon: Star,
    category: 'performance',
    dataPath: 'roleMetrics.creator.avgRating',
    formatter: 'rating',
    target: 4.0,
    priority: 'medium',
    roles: ['creator']
  },
  {
    id: 'creator_earnings',
    title: 'Monthly Earnings',
    description: 'Earnings from platform this month',
    icon: DollarSign,
    category: 'revenue',
    dataPath: 'roleMetrics.creator.earningsThisMonth',
    formatter: 'currency',
    priority: 'high',
    roles: ['creator']
  },
  
  // Investor-Specific Metrics
  {
    id: 'investor_portfolio_value',
    title: 'Portfolio Value',
    description: 'Total investment portfolio value',
    icon: Wallet,
    category: 'revenue',
    dataPath: 'roleMetrics.investor.portfolioValue',
    formatter: 'currency',
    priority: 'high',
    roles: ['investor']
  },
  {
    id: 'investor_roi',
    title: 'Return on Investment',
    description: 'Overall ROI across investments',
    icon: TrendingUp,
    category: 'performance',
    dataPath: 'roleMetrics.investor.roi',
    formatter: 'percentage',
    target: 0.15,
    priority: 'high',
    roles: ['investor']
  },
  {
    id: 'investor_active_investments',
    title: 'Active Investments',
    description: 'Number of active investments',
    icon: Activity,
    category: 'overview',
    dataPath: 'roleMetrics.investor.activeInvestments',
    formatter: 'number',
    priority: 'medium',
    roles: ['investor']
  },
  {
    id: 'investor_deals_pipeline',
    title: 'Deals Pipeline',
    description: 'Potential deals in pipeline',
    icon: TrendingUpIcon,
    category: 'growth',
    dataPath: 'roleMetrics.investor.dealsPipeline',
    formatter: 'number',
    priority: 'medium',
    roles: ['investor']
  },
  {
    id: 'investor_network_score',
    title: 'Network Score',
    description: 'Network strength and connections',
    icon: Users,
    category: 'performance',
    dataPath: 'roleMetrics.investor.networkScore',
    formatter: 'number',
    target: 85,
    priority: 'low',
    roles: ['investor']
  },
  
  // Production-Specific Metrics
  {
    id: 'production_active_projects',
    title: 'Active Projects',
    description: 'Number of active production projects',
    icon: Building,
    category: 'overview',
    dataPath: 'roleMetrics.production.activeProjects',
    formatter: 'number',
    priority: 'high',
    roles: ['production']
  },
  {
    id: 'production_budget_managed',
    title: 'Budget Managed',
    description: 'Total budget under management',
    icon: DollarSign,
    category: 'revenue',
    dataPath: 'roleMetrics.production.totalBudgetManaged',
    formatter: 'currency',
    priority: 'high',
    roles: ['production']
  },
  {
    id: 'production_success_rate',
    title: 'Success Rate',
    description: 'Project success rate percentage',
    icon: CheckCircle,
    category: 'performance',
    dataPath: 'roleMetrics.production.successRate',
    formatter: 'percentage',
    target: 0.8,
    priority: 'high',
    roles: ['production']
  },
  {
    id: 'production_talent_managed',
    title: 'Talent Managed',
    description: 'Number of talent under management',
    icon: UserCheck,
    category: 'overview',
    dataPath: 'roleMetrics.production.talentManaged',
    formatter: 'number',
    priority: 'medium',
    roles: ['production']
  },
  {
    id: 'production_budget_utilization',
    title: 'Budget Utilization',
    description: 'Percentage of budget utilized',
    icon: BarChart3,
    category: 'performance',
    dataPath: 'roleMetrics.production.budgetUtilization',
    formatter: 'percentage',
    target: 0.85,
    priority: 'medium',
    roles: ['production']
  }
];

// Layout configurations
const LAYOUT_CONFIGS = {
  compact: {
    columns: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6',
    cardSize: 'p-4',
    showDescription: false,
    showTrend: true,
    maxMetrics: 8
  },
  detailed: {
    columns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    cardSize: 'p-6',
    showDescription: true,
    showTrend: true,
    maxMetrics: 12
  },
  executive: {
    columns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    cardSize: 'p-8',
    showDescription: true,
    showTrend: true,
    maxMetrics: 6
  }
};

export default function MetricsGrid({ data, config, role, layout }: MetricsGridProps) {
  const { socket, isConnected } = useWebSocketContext();
  const [realtimeUpdates, setRealtimeUpdates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'alphabetical' | 'category'>('priority');
  
  // Real-time metric updates via WebSocket
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('metric_update', (update: { metricId: string; value: any; timestamp: string }) => {
        setRealtimeUpdates(prev => ({
          ...prev,
          [update.metricId]: {
            value: update.value,
            timestamp: update.timestamp,
            isUpdate: true
          }
        }));
        
        // Clear update indicator after animation
        setTimeout(() => {
          setRealtimeUpdates(prev => ({
            ...prev,
            [update.metricId]: {
              ...prev[update.metricId],
              isUpdate: false
            }
          }));
        }, 2000);
      });
      
      return () => {
        socket.off('metric_update');
      };
    }
  }, [socket, isConnected]);
  
  // Filter metrics based on role and category
  const filteredMetrics = useMemo(() => {
    let metrics = METRIC_DEFINITIONS.filter(metric => {
      // Role filtering
      if (!metric.roles.includes(config.role as any)) return false;
      
      // Category filtering
      if (selectedCategory !== 'all' && metric.category !== selectedCategory) return false;
      
      return true;
    });
    
    // Sort metrics
    metrics.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });
    
    // Limit based on layout
    const layoutConfig = LAYOUT_CONFIGS[layout as LayoutType] || LAYOUT_CONFIGS.detailed;
    return metrics.slice(0, layoutConfig.maxMetrics);
  }, [config.role, selectedCategory, sortBy, layout]);
  
  // Get metric value from data
  const getMetricValue = (metric: MetricConfig): any => {
    // Check for real-time update first
    if (realtimeUpdates[metric.id]) {
      return realtimeUpdates[metric.id].value;
    }
    
    // Get value from main data
    const paths = metric.dataPath.split('.');
    let value = data;
    
    for (const path of paths) {
      value = value?.[path];
    }
    
    return value ?? 0;
  };
  
  // Get trend value from data
  const getTrendValue = (metric: MetricConfig): number | null => {
    if (!metric.trend) return null;
    
    const paths = metric.trend.dataPath.split('.');
    let value = data;
    
    for (const path of paths) {
      value = value?.[path];
    }
    
    return typeof value === 'number' ? value : null;
  };
  
  // Format metric value based on formatter type
  const formatValue = (value: any, formatter: string): string => {
    if (value == null) return 'N/A';
    
    switch (formatter) {
      case 'number':
        if (typeof value !== 'number') return 'N/A';
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toLocaleString();
        
      case 'currency':
        if (typeof value !== 'number') return 'N/A';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
        
      case 'percentage':
        if (typeof value !== 'number') return 'N/A';
        return `${(value * 100).toFixed(1)}%`;
        
      case 'duration':
        if (typeof value !== 'number') return 'N/A';
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        return `${minutes}m ${seconds}s`;
        
      case 'rating':
        if (typeof value !== 'number') return 'N/A';
        return `${value.toFixed(1)}/5.0`;
        
      default:
        return String(value);
    }
  };
  
  // Get trend indicator component
  const getTrendIndicator = (metric: MetricConfig, trendValue: number | null) => {
    if (trendValue === null || !metric.trend) return null;
    
    const { good, warning } = metric.trend.threshold;
    let color = 'text-gray-500';
    let icon = Minus;
    
    if (trendValue >= good) {
      color = 'text-green-600';
      icon = TrendingUp;
    } else if (trendValue >= warning) {
      color = 'text-yellow-600';
      icon = TrendingUp;
    } else {
      color = 'text-red-600';
      icon = TrendingDown;
    }
    
    const Icon = icon;
    
    return (
      <div className={`flex items-center space-x-1 ${color}`}>
        <Icon className="w-3 h-3" />
        <span className="text-xs font-medium">
          {Math.abs(trendValue).toFixed(1)}%
        </span>
      </div>
    );
  };
  
  // Get target progress indicator
  const getTargetProgress = (metric: MetricConfig, value: any) => {
    if (!metric.target || typeof value !== 'number') return null;
    
    const progress = (value / metric.target) * 100;
    const isGood = progress >= 90;
    const isWarning = progress >= 70;
    
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Target: {formatValue(metric.target, metric.formatter)}</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isGood ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    );
  };
  
  // Render individual metric card
  const renderMetricCard = (metric: MetricConfig) => {
    const value = getMetricValue(metric);
    const trendValue = getTrendValue(metric);
    const layoutConfig = LAYOUT_CONFIGS[layout as LayoutType] || LAYOUT_CONFIGS.detailed;
    const isUpdating = realtimeUpdates[metric.id]?.isUpdate;
    const lastUpdate = realtimeUpdates[metric.id]?.timestamp;
    
    const Icon = metric.icon;
    
    return (
      <div
        key={metric.id}
        className={`bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-all duration-300 ${layoutConfig.cardSize} ${
          isUpdating ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${
              metric.priority === 'high' ? 'bg-blue-100 text-blue-600' :
              metric.priority === 'medium' ? 'bg-green-100 text-green-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              <Icon className="w-4 h-4" />
            </div>
            {metric.realtime && isConnected && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">Live</span>
              </div>
            )}
          </div>
          
          {trendValue !== null && getTrendIndicator(metric, trendValue)}
        </div>
        
        {/* Main Value */}
        <div className="mb-2">
          <div className={`font-bold text-gray-900 ${
            layoutConfig === LAYOUT_CONFIGS.executive ? 'text-3xl' :
            layoutConfig === LAYOUT_CONFIGS.detailed ? 'text-2xl' :
            'text-xl'
          }`}>
            {formatValue(value, metric.formatter)}
          </div>
          <div className="text-sm font-medium text-gray-700">{metric.title}</div>
        </div>
        
        {/* Description */}
        {layoutConfig.showDescription && metric.description && (
          <p className="text-xs text-gray-600 mb-3">{metric.description}</p>
        )}
        
        {/* Target Progress */}
        {getTargetProgress(metric, value)}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span className="capitalize">{metric.category}</span>
          {lastUpdate && (
            <span title={format(new Date(lastUpdate), 'PPpp')}>
              {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    );
  };
  
  const layoutConfig = LAYOUT_CONFIGS[layout as LayoutType] || LAYOUT_CONFIGS.detailed;
  const categories = ['all', 'overview', 'performance', 'engagement', 'revenue', 'growth'];
  
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="priority">Priority</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 text-sm ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span>{isConnected ? 'Real-time Active' : 'Offline'}</span>
            </div>
            
            <span className="text-sm text-gray-500">
              {filteredMetrics.length} metrics displayed
            </span>
          </div>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className={`grid ${layoutConfig.columns} gap-4`}>
        {filteredMetrics.map(metric => renderMetricCard(metric))}
      </div>
      
      {/* Empty State */}
      {filteredMetrics.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Metrics Available</h3>
          <p className="text-gray-600">No metrics match your current filters. Try adjusting your selection.</p>
        </div>
      )}
      
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-900">Updating metrics...</span>
          </div>
        </div>
      )}
    </div>
  );
}