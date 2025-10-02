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
  // Get pitch analytics
  static async getPitchAnalytics(
    pitchId: number, 
    timeRange?: TimeRange
  ): Promise<PitchAnalytics> {
    const params = new URLSearchParams();
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);
    if (timeRange?.preset) params.append('preset', timeRange.preset);

    const response = await apiClient.get<{ success: boolean; analytics: PitchAnalytics }>(
      `/api/analytics/pitch/${pitchId}?${params}`
    );

    if (!response.success || !response.data?.analytics) {
      throw new Error(response.error?.message || 'Failed to fetch pitch analytics');
    }

    return response.data.analytics;
  }

  // Get user analytics
  static async getUserAnalytics(
    userId?: number,
    timeRange?: TimeRange
  ): Promise<UserAnalytics> {
    const params = new URLSearchParams();
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);
    if (timeRange?.preset) params.append('preset', timeRange.preset);

    const endpoint = userId ? `/api/analytics/user/${userId}` : '/api/analytics/user';
    const response = await apiClient.get<{ success: boolean; analytics: UserAnalytics }>(
      `${endpoint}?${params}`
    );

    if (!response.success || !response.data?.analytics) {
      throw new Error(response.error?.message || 'Failed to fetch user analytics');
    }

    return response.data.analytics;
  }

  // Get dashboard metrics
  static async getDashboardMetrics(timeRange?: TimeRange): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (timeRange?.start) params.append('start', timeRange.start);
    if (timeRange?.end) params.append('end', timeRange.end);
    if (timeRange?.preset) params.append('preset', timeRange.preset);

    const response = await apiClient.get<{ success: boolean; metrics: DashboardMetrics }>(
      `/api/analytics/dashboard?${params}`
    );

    if (!response.success || !response.data?.metrics) {
      throw new Error(response.error?.message || 'Failed to fetch dashboard metrics');
    }

    return response.data.metrics;
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    userId?: number;
    pitchId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.userId) params.append('userId', options.userId.toString());
    if (options?.pitchId) params.append('pitchId', options.pitchId.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      activities: Activity[]; 
      total: number 
    }>(`/api/analytics/activity?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch activity feed');
    }

    return {
      activities: response.data?.activities || [],
      total: response.data?.total || 0
    };
  }

  // Track event
  static async trackEvent(event: {
    type: string;
    entityType: string;
    entityId: number;
    metadata?: any;
  }): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/analytics/track',
      event
    );

    if (!response.success) {
      console.error('Failed to track event:', response.error?.message);
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
    const params = new URLSearchParams();
    if (options?.period) params.append('period', options.period);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.genre) params.append('genre', options.genre);

    const response = await apiClient.get<{ success: boolean; pitches: PitchAnalytics[] }>(
      `/api/analytics/trending?${params}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch trending pitches');
    }

    return response.data?.pitches || [];
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