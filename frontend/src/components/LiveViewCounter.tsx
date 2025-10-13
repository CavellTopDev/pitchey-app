import React, { useState, useEffect } from 'react';
import { usePitchViews } from '../contexts/WebSocketContext';

interface PitchViewData {
  pitchId: number;
  viewCount: number;
  uniqueViewers: number;
  recentViewers: Array<{
    userId: number;
    username: string;
    timestamp: Date;
  }>;
}

interface LiveViewCounterProps {
  pitchId: number;
  initialViewCount?: number;
  showUniqueViewers?: boolean;
  showRecentViewers?: boolean;
  maxRecentViewers?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

export function LiveViewCounter({ 
  pitchId,
  initialViewCount = 0,
  showUniqueViewers = false,
  showRecentViewers = false,
  maxRecentViewers = 5,
  size = 'md',
  className = "",
  animated = true
}: LiveViewCounterProps) {
  const { pitchData, trackView, subscribeToViews } = usePitchViews(pitchId);
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [uniqueViewers, setUniqueViewers] = useState(0);
  const [recentViewers, setRecentViewers] = useState<PitchViewData['recentViewers']>([]);
  const [isIncreasing, setIsIncreasing] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToViews((data: PitchViewData) => {
      const newViewCount = data.viewCount;
      
      // Trigger animation if view count increased
      if (newViewCount > viewCount && animated) {
        setIsIncreasing(true);
        setTimeout(() => setIsIncreasing(false), 600);
      }
      
      setViewCount(newViewCount);
      setUniqueViewers(data.uniqueViewers);
      setRecentViewers(data.recentViewers.slice(0, maxRecentViewers));
    });

    return unsubscribe;
  }, [subscribeToViews, viewCount, animated, maxRecentViewers]);

  // Initialize with pitch data if available
  useEffect(() => {
    if (pitchData) {
      setViewCount(pitchData.viewCount);
      setUniqueViewers(pitchData.uniqueViewers);
      setRecentViewers(pitchData.recentViewers.slice(0, maxRecentViewers));
    }
  }, [pitchData, maxRecentViewers]);

  // Track view when component mounts (only once)
  useEffect(() => {
    if (!hasTrackedView) {
      trackView();
      setHasTrackedView(true);
    }
  }, [trackView, hasTrackedView]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'text-sm',
          icon: 'w-4 h-4',
          count: 'text-sm font-medium',
          unique: 'text-xs',
        };
      case 'lg':
        return {
          container: 'text-lg',
          icon: 'w-6 h-6',
          count: 'text-lg font-semibold',
          unique: 'text-sm',
        };
      default:
        return {
          container: 'text-base',
          icon: 'w-5 h-5',
          count: 'text-base font-medium',
          unique: 'text-sm',
        };
    }
  };

  const formatViewCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-2 ${sizeClasses.container} ${className}`}>
      {/* Eye Icon */}
      <svg 
        className={`${sizeClasses.icon} text-gray-500`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
        />
      </svg>

      {/* View Count */}
      <span 
        className={`${sizeClasses.count} text-gray-700 transition-all duration-300 ${
          isIncreasing ? 'scale-110 text-blue-600' : 'scale-100'
        }`}
      >
        {formatViewCount(viewCount)}
      </span>

      {/* Unique Viewers */}
      {showUniqueViewers && uniqueViewers > 0 && (
        <span className={`${sizeClasses.unique} text-gray-500`}>
          ({uniqueViewers} unique)
        </span>
      )}

      {/* Recent Viewers */}
      {showRecentViewers && recentViewers.length > 0 && (
        <div className="flex items-center space-x-1 ml-2">
          <span className="text-xs text-gray-400">Recent:</span>
          <div className="flex -space-x-1">
            {recentViewers.slice(0, 3).map((viewer, index) => (
              <div
                key={viewer.userId}
                className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                style={{ zIndex: recentViewers.length - index }}
                title={`${viewer.username} - ${getTimeAgo(viewer.timestamp)}`}
              >
                {viewer.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {recentViewers.length > 3 && (
              <div className="w-6 h-6 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white">
                +{recentViewers.length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ViewerListProps {
  pitchId: number;
  maxViewers?: number;
  showTimestamps?: boolean;
  className?: string;
}

export function ViewerList({ 
  pitchId, 
  maxViewers = 10, 
  showTimestamps = true,
  className = "" 
}: ViewerListProps) {
  const { pitchData, subscribeToViews } = usePitchViews(pitchId);
  const [recentViewers, setRecentViewers] = useState<PitchViewData['recentViewers']>([]);

  useEffect(() => {
    const unsubscribe = subscribeToViews((data: PitchViewData) => {
      setRecentViewers(data.recentViewers.slice(0, maxViewers));
    });

    return unsubscribe;
  }, [subscribeToViews, maxViewers]);

  useEffect(() => {
    if (pitchData) {
      setRecentViewers(pitchData.recentViewers.slice(0, maxViewers));
    }
  }, [pitchData, maxViewers]);

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  if (recentViewers.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No recent viewers
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700">Recent Viewers</h4>
      <div className="space-y-1">
        {recentViewers.map((viewer) => (
          <div key={`${viewer.userId}-${viewer.timestamp.getTime()}`} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-medium text-white">
                {viewer.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-900">{viewer.username}</span>
            </div>
            {showTimestamps && (
              <span className="text-xs text-gray-500">
                {getTimeAgo(viewer.timestamp)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ViewAnalyticsProps {
  pitchId: number;
  className?: string;
}

export function ViewAnalytics({ pitchId, className = "" }: ViewAnalyticsProps) {
  const { pitchData, subscribeToViews } = usePitchViews(pitchId);
  const [analytics, setAnalytics] = useState({
    totalViews: 0,
    uniqueViewers: 0,
    viewsToday: 0,
    engagementRate: 0,
  });

  useEffect(() => {
    const unsubscribe = subscribeToViews((data: PitchViewData) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const viewsToday = data.recentViewers.filter(
        viewer => viewer.timestamp >= today
      ).length;
      
      const engagementRate = data.uniqueViewers > 0 
        ? Math.round((viewsToday / data.uniqueViewers) * 100) 
        : 0;
      
      setAnalytics({
        totalViews: data.viewCount,
        uniqueViewers: data.uniqueViewers,
        viewsToday,
        engagementRate,
      });
    });

    return unsubscribe;
  }, [subscribeToViews]);

  useEffect(() => {
    if (pitchData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const viewsToday = pitchData.recentViewers.filter(
        viewer => viewer.timestamp >= today
      ).length;
      
      const engagementRate = pitchData.uniqueViewers > 0 
        ? Math.round((viewsToday / pitchData.uniqueViewers) * 100) 
        : 0;
      
      setAnalytics({
        totalViews: pitchData.viewCount,
        uniqueViewers: pitchData.uniqueViewers,
        viewsToday,
        engagementRate,
      });
    }
  }, [pitchData]);

  const formatNumber = (num: number) => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  };

  return (
    <div className={`bg-white p-4 rounded-lg border border-gray-200 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">View Analytics</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(analytics.totalViews)}
          </div>
          <div className="text-sm text-gray-500">Total Views</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(analytics.uniqueViewers)}
          </div>
          <div className="text-sm text-gray-500">Unique Viewers</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {analytics.viewsToday}
          </div>
          <div className="text-sm text-gray-500">Today</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {analytics.engagementRate}%
          </div>
          <div className="text-sm text-gray-500">Engagement</div>
        </div>
      </div>
    </div>
  );
}

interface LiveViewBadgeProps {
  pitchId: number;
  showCount?: boolean;
  className?: string;
}

export function LiveViewBadge({ pitchId, showCount = true, className = "" }: LiveViewBadgeProps) {
  const { pitchData } = usePitchViews(pitchId);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (pitchData) {
      // Check if there were any views in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const hasRecentViews = pitchData.recentViewers.some(
        viewer => viewer.timestamp >= fiveMinutesAgo
      );
      setIsLive(hasRecentViews);
    }
  }, [pitchData]);

  if (!isLive) return null;

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium ${className}`}>
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      <span>LIVE</span>
      {showCount && pitchData && (
        <span>• {pitchData.viewCount} watching</span>
      )}
    </div>
  );
}

export default LiveViewCounter;