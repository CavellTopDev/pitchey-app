import React, { useState, useEffect } from 'react';
import { useDashboardMetrics } from '../contexts/WebSocketContext';

interface MetricCardProps {
  title: string;
  value: number | string;
  previousValue?: number;
  icon: React.ReactNode;
  format?: 'number' | 'currency' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  loading?: boolean;
}

function MetricCard({ 
  title, 
  value, 
  previousValue, 
  icon, 
  format = 'number', 
  trend, 
  subtitle, 
  loading = false 
}: MetricCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when value changes
  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [value, previousValue]);

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat().format(val);
    }
  };

  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    
    return trend === 'up' ? (
      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {getTrendIcon() && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
          </div>
        )}
      </div>
      
      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        ) : (
          <div className={`text-2xl font-bold ${getTrendColor()} transition-all duration-300 ${
            isAnimating ? 'scale-110' : 'scale-100'
          }`}>
            {formatValue(value)}
          </div>
        )}
        
        {previousValue !== undefined && previousValue !== value && (
          <div className="text-xs text-gray-500 mt-1">
            Previous: {formatValue(previousValue)}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdated?: Date;
}

function ConnectionStatus({ isConnected, lastUpdated }: ConnectionStatusProps) {
  return (
    <div className="flex items-center space-x-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${
        isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
      }`}></div>
      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
        {isConnected ? 'Live updates' : 'Disconnected'}
      </span>
      {lastUpdated && (
        <span className="text-gray-500">
          • Updated {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

interface LiveMetricsProps {
  className?: string;
  showConnectionStatus?: boolean;
  refreshInterval?: number;
}

export function LiveMetrics({ 
  className = '', 
  showConnectionStatus = true,
  refreshInterval = 30000 
}: LiveMetricsProps) {
  const { dashboardMetrics, subscribeToDashboard } = useDashboardMetrics();
  const [previousMetrics, setPreviousMetrics] = useState<typeof dashboardMetrics>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToDashboard((metrics) => {
      setPreviousMetrics(dashboardMetrics);
      setIsConnected(true);
      setLoading(false);
    });

    return unsubscribe;
  }, [subscribeToDashboard, dashboardMetrics]);

  // Monitor connection status
  useEffect(() => {
    if (dashboardMetrics) {
      setIsConnected(true);
      setLoading(false);
    }
  }, [dashboardMetrics]);

  // Auto-refresh fallback for when WebSocket is disconnected
  useEffect(() => {
    if (!isConnected && refreshInterval > 0) {
      const interval = setInterval(() => {
        // This would typically trigger a manual refresh of metrics
        console.log('Auto-refreshing metrics (WebSocket disconnected)');
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [isConnected, refreshInterval]);

  const getTrend = (current: number, previous: number | undefined): 'up' | 'down' | 'neutral' => {
    if (previous === undefined) return 'neutral';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  const metrics = [
    {
      title: 'Pitch Views',
      value: dashboardMetrics?.pitchViews || 0,
      previousValue: previousMetrics?.pitchViews,
      trend: getTrend(dashboardMetrics?.pitchViews || 0, previousMetrics?.pitchViews),
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      subtitle: 'Today',
      format: 'number' as const,
    },
    {
      title: 'Total Revenue',
      value: dashboardMetrics?.totalRevenue || 0,
      previousValue: previousMetrics?.totalRevenue,
      trend: getTrend(dashboardMetrics?.totalRevenue || 0, previousMetrics?.totalRevenue),
      icon: (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      subtitle: 'This month',
      format: 'currency' as const,
    },
    {
      title: 'Active Investors',
      value: dashboardMetrics?.activeInvestors || 0,
      previousValue: previousMetrics?.activeInvestors,
      trend: getTrend(dashboardMetrics?.activeInvestors || 0, previousMetrics?.activeInvestors),
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      subtitle: 'Online now',
      format: 'number' as const,
    },
    {
      title: 'New Messages',
      value: dashboardMetrics?.newMessages || 0,
      previousValue: previousMetrics?.newMessages,
      trend: getTrend(dashboardMetrics?.newMessages || 0, previousMetrics?.newMessages),
      icon: (
        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      subtitle: 'Unread',
      format: 'number' as const,
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Live Metrics</h2>
        {showConnectionStatus && (
          <ConnectionStatus 
            isConnected={isConnected} 
            lastUpdated={dashboardMetrics?.lastUpdated}
          />
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            previousValue={metric.previousValue}
            icon={metric.icon}
            format={metric.format}
            trend={metric.trend}
            subtitle={metric.subtitle}
            loading={loading}
          />
        ))}
      </div>

      {/* Real-time Activity Feed */}
      {!loading && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h3>
          <div className="space-y-2 text-sm text-gray-600">
            {dashboardMetrics?.lastUpdated && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Metrics updated at {dashboardMetrics.lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
            {isConnected ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Receiving live updates</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>Waiting for connection...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveMetrics;