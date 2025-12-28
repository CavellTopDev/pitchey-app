// Analytics Service - Complete analytics and reporting with Drizzle integration
import { apiClient } from '../lib/api-client';
import { config } from '../config';

// Types for analytics data
export interface TimeRange {
  start: string;
  end: string;
  preset?: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'all';
}

export interface PitchAnalytics {
  pitchId: number;
  title: string;
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  ndaRequests: number;
  ndaApproved: number;
  messages: number;
  avgViewDuration: number;
  bounceRate: number;
  conversionRate: number;
  engagementRate: number;
  viewsByDate: { date: string; count: number }[];
  viewsBySource: { source: string; count: number }[];
  viewsByLocation: { location: string; count: number }[];
  viewerDemographics: {
    userType: { type: string; count: number }[];
    industry: { industry: string; count: number }[];
  };
}

export interface UserAnalytics {
  userId: number;
  username: string;
  totalPitches: number;
  publishedPitches: number;
  totalViews: number;
  totalLikes: number;
  totalFollowers: number;
  totalNDAs: number;
  avgEngagement: number;
  topPitches: {
    id: number;
    title: string;
    views: number;
    engagement: number;
  }[];
  growthMetrics: {
    date: string;
    followers: number;
    views: number;
    engagement: number;
  }[];
  audienceInsights: {
    topLocations: { location: string; percentage: number }[];
    topUserTypes: { type: string; percentage: number }[];
    peakActivity: { hour: number; activity: number }[];
  };
}

export interface DashboardMetrics {
  overview: {
    totalViews: number;
    totalLikes: number;
    totalFollowers: number;
    totalPitches: number;
    viewsChange: number;
    likesChange: number;
    followersChange: number;
    pitchesChange: number;
  };
  performance: {
    topPitches: PitchAnalytics[];
    recentActivity: Activity[];
    engagementTrend: { date: string; rate: number }[];
  };
  revenue?: {
    total: number;
    subscriptions: number;
    transactions: number;
    growth: number;
  };
}

export interface Activity {
  id: number;
  type: 'view' | 'like' | 'follow' | 'nda' | 'message' | 'share';
  entityType: 'pitch' | 'user';
  entityId: number;
  entityName: string;
  userId?: number;
  username?: string;
  timestamp: string;
  metadata?: any;
}

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel';
  dateRange: TimeRange;
  metrics: string[];
  groupBy?: 'day' | 'week' | 'month';
  includeCharts?: boolean;
}

export interface ComparisonData {
  current: any;
  previous: any;
  change: number;
  changePercentage: number;
}

export class AnalyticsService {
  // Default fallback data to prevent infinite polling loops
  private static getDefaultPitchAnalytics(pitchId: number): PitchAnalytics {
    return {
      pitchId,
      title: 'Analytics Unavailable',
      views: 0,
      uniqueViews: 0,
      likes: 0,
      shares: 0,
      ndaRequests: 0,
      ndaApproved: 0,
      messages: 0,
      avgViewDuration: 0,
      bounceRate: 0,
      conversionRate: 0,
      engagementRate: 0,
      viewsByDate: [],
      viewsBySource: [],
      viewsByLocation: [],
      viewerDemographics: {
        userType: [],
        industry: [],
      }
    };
  }

  private static getDefaultUserAnalytics(userId: number): UserAnalytics {
    return {
      userId,
      username: 'Analytics Unavailable',
      totalPitches: 0,
      publishedPitches: 0,
      totalViews: 0,
      totalLikes: 0,
      totalFollowers: 0,
      totalNDAs: 0,
      avgEngagement: 0,
      topPitches: [],
      growthMetrics: [],
      audienceInsights: {
        topLocations: [],
        topUserTypes: [],
        peakActivity: [],
      }
    };
  }

  private static getDefaultDashboardMetrics(): DashboardMetrics {
    return {
      overview: {
        totalViews: 0,
        totalLikes: 0,
        totalFollowers: 0,
        totalPitches: 0,
        viewsChange: 0,
        likesChange: 0,
        followersChange: 0,
        pitchesChange: 0,
      },
      performance: {
        topPitches: [],
        recentActivity: [],
        engagementTrend: [],
      },
      revenue: {
        total: 0,
        subscriptions: 0,
        transactions: 0,
        growth: 0,
      }
    };
  }
  // Get pitch analytics
  static async getPitchAnalytics(
    pitchId: number, 
    timeRange?: TimeRange
  ): Promise<PitchAnalytics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const response = await apiClient.get<{ success: boolean; data: { analytics: any } }>(
        `/api/analytics/pitch/${pitchId}?${params}`
      );

      if (!response.success || !response.data?.data?.analytics) {
        console.warn('Pitch analytics not available:', response.error?.message);
        return this.getDefaultPitchAnalytics(pitchId);
      }

      // Transform the API response to match the expected interface
      const apiAnalytics = response.data.data.analytics;
      return {
        pitchId,
        title: apiAnalytics.title || 'Untitled Pitch',
        views: apiAnalytics.views || 0,
        uniqueViews: apiAnalytics.uniqueViews || 0,
        likes: apiAnalytics.likes || 0,
        shares: apiAnalytics.shares || 0,
        ndaRequests: apiAnalytics.ndaRequests || 0,
        ndaApproved: apiAnalytics.ndaApproved || 0,
        messages: apiAnalytics.messages || 0,
        avgViewDuration: apiAnalytics.avgViewDuration || 0,
        bounceRate: apiAnalytics.bounceRate || 0,
        conversionRate: apiAnalytics.conversionRate || 0,
        engagementRate: apiAnalytics.engagementRate || 0,
        viewsByDate: apiAnalytics.viewsByDate || [],
        viewsBySource: apiAnalytics.viewsBySource || [],
        viewsByLocation: apiAnalytics.viewsByLocation || [],
        viewerDemographics: {
          userType: apiAnalytics.viewerDemographics?.userType || [],
          industry: apiAnalytics.viewerDemographics?.industry || [],
        }
      };
    } catch (error) {
      console.error('Failed to fetch pitch analytics:', error);
      return this.getDefaultPitchAnalytics(pitchId);
    }
  }

  // Get user analytics
  static async getUserAnalytics(
    userId?: number,
    timeRange?: TimeRange
  ): Promise<UserAnalytics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const endpoint = userId ? `/api/analytics/user/${userId}` : '/api/analytics/user';
      const response = await apiClient.get<{ success: boolean; data: { analytics: any } }>(
        `${endpoint}?${params}`
      );

      if (!response.success || !response.data?.data?.analytics) {
        console.warn('User analytics not available:', response.error?.message);
        return this.getDefaultUserAnalytics(userId || 1);
      }

      // Transform the API response to match the expected interface
      const apiAnalytics = response.data.data.analytics;
      
      return {
        userId: userId || 1,
        username: apiAnalytics.username || 'User',
        totalPitches: apiAnalytics.totalPitches || 0,
        publishedPitches: apiAnalytics.publishedPitches || 0,
        totalViews: apiAnalytics.profileViews || apiAnalytics.pitchViews || 0,
        totalLikes: apiAnalytics.totalLikes || 0,
        totalFollowers: apiAnalytics.totalFollowers || 0,
        totalNDAs: apiAnalytics.totalNDAs || 0,
        avgEngagement: apiAnalytics.engagement || 0,
        topPitches: apiAnalytics.topPitches || [],
        growthMetrics: apiAnalytics.growthMetrics || [],
        audienceInsights: {
          topLocations: apiAnalytics.audienceInsights?.topLocations || [],
          topUserTypes: apiAnalytics.audienceInsights?.topUserTypes || [],
          peakActivity: apiAnalytics.audienceInsights?.peakActivity || [],
        }
      };
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
      return this.getDefaultUserAnalytics(userId || 1);
    }
  }

  // Get dashboard metrics
  static async getDashboardMetrics(timeRange?: TimeRange): Promise<DashboardMetrics> {
    try {
      const params = new URLSearchParams();
      if (timeRange?.start) params.append('start', timeRange.start);
      if (timeRange?.end) params.append('end', timeRange.end);
      if (timeRange?.preset) params.append('preset', timeRange.preset);

      const response = await apiClient.get<{ success: boolean; data: { metrics: any } }>(
        `/api/analytics/dashboard?${params}`
      );

      if (!response.success || !response.data?.data?.metrics) {
        console.warn('Dashboard metrics not available:', response.error?.message);
        return this.getDefaultDashboardMetrics();
      }

      // Transform the API response to match the expected interface
      const apiMetrics = response.data.data.metrics;
      
      return {
        overview: {
          totalViews: apiMetrics.totalViews || 0,
          totalLikes: apiMetrics.totalLikes || 0,
          totalFollowers: apiMetrics.totalFollowers || 0,
          totalPitches: apiMetrics.totalPitches || 0,
          viewsChange: apiMetrics.viewsChange || 0,
          likesChange: apiMetrics.likesChange || 0,
          followersChange: apiMetrics.followersChange || 0,
          pitchesChange: apiMetrics.pitchesChange || 0,
        },
        performance: {
          topPitches: apiMetrics.topPitches || [],
          recentActivity: apiMetrics.recentActivity || [],
          engagementTrend: apiMetrics.engagementTrend || [],
        },
        revenue: {
          total: apiMetrics.revenue || 0,
          subscriptions: apiMetrics.subscriptions || 0,
          transactions: apiMetrics.transactions || 0,
          growth: apiMetrics.growth || 0,
        }
      };
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      return this.getDefaultDashboardMetrics();
    }
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    userId?: number;
    pitchId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (options?.userId) params.append('userId', options.userId.toString());
      if (options?.pitchId) params.append('pitchId', options.pitchId.toString());
      if (options?.type) params.append('type', options.type);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await apiClient.get<{ 
        success: boolean; 
        data?: { activities: Activity[]; total: number };
        activities?: Activity[]; 
        total?: number 
      }>(`/api/analytics/activity?${params}`);

      if (!response.success) {
        console.warn('Activity feed not available:', response.error?.message);
        return { activities: [], total: 0 };
      }

      // Handle both nested and flat response structures
      const activities = response.data?.data?.activities || response.data?.activities || [];
      const total = response.data?.data?.total || response.data?.total || 0;

      return { activities, total };
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
      return { activities: [], total: 0 };
    }
  }

  // Track event
  static async trackEvent(event: {
    type: string;
    entityType: string;
    entityId: number;
    metadata?: any;
  }): Promise<void> {
    try {
      const response = await apiClient.post<{ success: boolean }>(
        '/api/analytics/track',
        event
      );

      if (!response.success) {
        console.warn('Failed to track event:', response.error?.message);
      }
    } catch (error) {
      // Silently fail for tracking events to prevent disrupting user experience
      console.warn('Event tracking failed:', error);
    }
  }

  // Track page view
  static async trackPageView(page: string, metadata?: any): Promise<void> {
    await this.trackEvent({
      type: 'page_view',
      entityType: 'page',
      entityId: 0,
      metadata: { page, ...metadata }
    });
  }

  // Export analytics data
  static async exportAnalytics(options: ExportOptions): Promise<Blob> {
    const response = await fetch(
      `${config.API_URL}/api/analytics/export`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export analytics');
    }

    return response.blob();
  }

  // Get comparison data
  static async getComparison(
    type: 'pitch' | 'user' | 'dashboard',
    id?: number,
    currentRange: TimeRange,
    previousRange: TimeRange
  ): Promise<ComparisonData> {
    const params = new URLSearchParams();
    params.append('currentStart', currentRange.start);
    params.append('currentEnd', currentRange.end);
    params.append('previousStart', previousRange.start);
    params.append('previousEnd', previousRange.end);

    const endpoint = id ? `/api/analytics/compare/${type}/${id}` : `/api/analytics/compare/${type}`;
    const response = await apiClient.get<{ success: boolean; comparison: ComparisonData }>(
      `${endpoint}?${params}`
    );

    if (!response.success || !response.data?.comparison) {
      throw new Error(response.error?.message || 'Failed to fetch comparison data');
    }

    return response.data.comparison;
  }

  // Get trending pitches
  static async getTrendingPitches(options?: {
    period?: 'day' | 'week' | 'month';
    limit?: number;
    genre?: string;
  }): Promise<PitchAnalytics[]> {
    try {
      const params = new URLSearchParams();
      if (options?.period) params.append('period', options.period);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.genre) params.append('genre', options.genre);

      const response = await apiClient.get<{ 
        success: boolean; 
        data?: { pitches: PitchAnalytics[] };
        pitches?: PitchAnalytics[] 
      }>(`/api/analytics/trending?${params}`);

      if (!response.success) {
        console.warn('Trending pitches not available:', response.error?.message);
        return [];
      }

      // Handle both nested and flat response structures
      return response.data?.data?.pitches || response.data?.pitches || [];
    } catch (error) {
      console.error('Failed to fetch trending pitches:', error);
      return [];
    }
  }

  // Get engagement metrics
  static async getEngagementMetrics(
    entityType: 'pitch' | 'user',
    entityId: number,
    timeRange?: TimeRange
  ): Promise<{
    engagementRate: number;
    averageTimeSpent: number;
    bounceRate: number;
    interactionRate: number;
    shareRate: number;
    conversionRate: number;
    trends: { date: string; rate: number }[];
  }> {
    const params = new URLSearchParams();
    params.append('entityType', entityType);
    params.append('entityId', entityId.toString());
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);

    const response = await apiClient.get<{ success: boolean; metrics: any }>(
      `/api/analytics/engagement?${params}`
    );

    if (!response.success || !response.data?.metrics) {
      throw new Error(response.error?.message || 'Failed to fetch engagement metrics');
    }

    return response.data.metrics;
  }

  // Get funnel analytics
  static async getFunnelAnalytics(pitchId: number): Promise<{
    views: number;
    detailViews: number;
    ndaRequests: number;
    ndaSigned: number;
    messages: number;
    conversions: number;
    dropoffRates: {
      viewToDetail: number;
      detailToNDA: number;
      ndaToMessage: number;
      messageToConversion: number;
    };
  }> {
    const response = await apiClient.get<{ success: boolean; funnel: any }>(
      `/api/analytics/funnel/${pitchId}`
    );

    if (!response.success || !response.data?.funnel) {
      throw new Error(response.error?.message || 'Failed to fetch funnel analytics');
    }

    return response.data.funnel;
  }

  // Get revenue analytics (for applicable accounts)
  static async getRevenueAnalytics(timeRange?: TimeRange): Promise<{
    totalRevenue: number;
    subscriptionRevenue: number;
    transactionRevenue: number;
    averageOrderValue: number;
    customerLifetimeValue: number;
    churnRate: number;
    growthRate: number;
    revenueByDate: { date: string; amount: number }[];
    revenueBySource: { source: string; amount: number }[];
  }> {
    const params = new URLSearchParams();
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);

    const response = await apiClient.get<{ success: boolean; revenue: any }>(
      `/api/analytics/revenue?${params}`
    );

    if (!response.success || !response.data?.revenue) {
      throw new Error(response.error?.message || 'Failed to fetch revenue analytics');
    }

    return response.data.revenue;
  }

  // Get real-time stats
  static async getRealTimeStats(): Promise<{
    activeUsers: number;
    currentViews: number;
    recentActivities: Activity[];
    trending: { type: string; items: any[] }[];
  }> {
    const response = await apiClient.get<{ success: boolean; stats: any }>(
      '/api/analytics/realtime'
    );

    if (!response.success || !response.data?.stats) {
      throw new Error(response.error?.message || 'Failed to fetch real-time stats');
    }

    return response.data.stats;
  }

  // Schedule report
  static async scheduleReport(config: {
    type: 'daily' | 'weekly' | 'monthly';
    metrics: string[];
    recipients: string[];
    format: 'pdf' | 'excel';
    timeOfDay?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  }): Promise<{ id: number; nextRun: string }> {
    const response = await apiClient.post<{ 
      success: boolean; 
      reportId: number; 
      nextRun: string 
    }>('/api/analytics/schedule-report', config);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to schedule report');
    }

    return {
      id: response.data?.reportId || 0,
      nextRun: response.data?.nextRun || ''
    };
  }

  // Get scheduled reports
  static async getScheduledReports(): Promise<any[]> {
    const response = await apiClient.get<{ success: boolean; reports: any[] }>(
      '/api/analytics/scheduled-reports'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch scheduled reports');
    }

    return response.data?.reports || [];
  }

  // Cancel scheduled report
  static async cancelScheduledReport(reportId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/analytics/scheduled-reports/${reportId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to cancel scheduled report');
    }
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService;