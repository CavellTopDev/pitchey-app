/**
 * Real-time Analytics Dashboard
 * Provides live metrics and insights for platform monitoring
 */

import { AdvancedAnalytics } from './advanced-analytics';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'list' | 'gauge' | 'heatmap';
  data: any;
  updateFrequency: number; // seconds
  lastUpdated: number;
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  refreshRate: number;
  theme: 'light' | 'dark';
  layout: 'grid' | 'flow';
}

export class RealTimeDashboard {
  private analytics: AdvancedAnalytics;
  private cache: any;

  constructor(analytics: AdvancedAnalytics, cache: any) {
    this.analytics = analytics;
    this.cache = cache;
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(userType: 'admin' | 'creator' | 'investor' | 'production' = 'admin'): Promise<DashboardConfig> {
    const cacheKey = `dashboard:${userType}`;
    
    return await this.cache.get(cacheKey, async () => {
      const widgets = await this.generateWidgets(userType);
      
      return {
        widgets,
        refreshRate: 30, // 30 seconds
        theme: 'light',
        layout: 'grid'
      };
    }, 'realtime');
  }

  /**
   * Generate widgets based on user type
   */
  private async generateWidgets(userType: string): Promise<DashboardWidget[]> {
    const baseWidgets = await this.getBaseWidgets();
    
    switch (userType) {
      case 'admin':
        return [...baseWidgets, ...await this.getAdminWidgets()];
      case 'creator':
        return [...baseWidgets, ...await this.getCreatorWidgets()];
      case 'investor':
        return [...baseWidgets, ...await this.getInvestorWidgets()];
      case 'production':
        return [...baseWidgets, ...await this.getProductionWidgets()];
      default:
        return baseWidgets;
    }
  }

  /**
   * Base widgets for all users
   */
  private async getBaseWidgets(): Promise<DashboardWidget[]> {
    const platformMetrics = await this.analytics.getRealTimeMetrics();
    const now = Date.now();

    return [
      {
        id: 'active-users',
        title: 'Active Users',
        type: 'metric',
        data: {
          current: platformMetrics.activeUsers.last24h,
          previous: platformMetrics.activeUsers.last7d,
          trend: this.calculateTrend(platformMetrics.activeUsers.last24h, platformMetrics.activeUsers.last7d),
          subtitle: '24h active users'
        },
        updateFrequency: 60,
        lastUpdated: now
      },
      {
        id: 'platform-performance',
        title: 'Platform Performance',
        type: 'gauge',
        data: {
          value: this.calculatePerformanceScore(platformMetrics.performanceMetrics),
          max: 100,
          unit: '%',
          color: this.getPerformanceColor(platformMetrics.performanceMetrics),
          subtitle: 'Overall health score'
        },
        updateFrequency: 30,
        lastUpdated: now
      },
      {
        id: 'response-time',
        title: 'Response Time',
        type: 'chart',
        data: {
          type: 'line',
          datasets: [{
            label: 'Response Time (ms)',
            data: await this.getResponseTimeHistory(),
            borderColor: '#3b82f6',
            tension: 0.1
          }],
          options: {
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Milliseconds' }
              }
            }
          }
        },
        updateFrequency: 30,
        lastUpdated: now
      }
    ];
  }

  /**
   * Admin-specific widgets
   */
  private async getAdminWidgets(): Promise<DashboardWidget[]> {
    const platformMetrics = await this.analytics.getRealTimeMetrics();
    const costAnalytics = await this.analytics.getCostOptimizationAnalytics();
    const now = Date.now();

    return [
      {
        id: 'revenue-metrics',
        title: 'Revenue Metrics',
        type: 'metric',
        data: {
          current: platformMetrics.investmentMetrics.totalInvestments,
          growth: '+12.5%',
          trend: 'up',
          subtitle: 'Total platform investments'
        },
        updateFrequency: 60,
        lastUpdated: now
      },
      {
        id: 'cost-savings',
        title: 'Cost Savings',
        type: 'metric',
        data: {
          current: `$${costAnalytics.projectedSavings.total.toLocaleString()}`,
          percentage: '82%',
          trend: 'up',
          subtitle: 'Monthly savings vs baseline'
        },
        updateFrequency: 300, // 5 minutes
        lastUpdated: now
      },
      {
        id: 'user-growth',
        title: 'User Growth',
        type: 'chart',
        data: {
          type: 'bar',
          datasets: [{
            label: 'New Users',
            data: await this.getUserGrowthData(),
            backgroundColor: '#10b981'
          }],
          options: {
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        },
        updateFrequency: 300,
        lastUpdated: now
      },
      {
        id: 'top-pitches',
        title: 'Top Performing Pitches',
        type: 'list',
        data: {
          items: platformMetrics.pitchMetrics.topPerforming.map((pitch, index) => ({
            rank: index + 1,
            title: pitch.title,
            views: pitch.views.toLocaleString(),
            trend: 'up'
          }))
        },
        updateFrequency: 120,
        lastUpdated: now
      },
      {
        id: 'system-health',
        title: 'System Health',
        type: 'heatmap',
        data: {
          metrics: [
            { name: 'Database', status: 'healthy', value: 98 },
            { name: 'Cache', status: 'healthy', value: 95 },
            { name: 'CDN', status: 'healthy', value: 99 },
            { name: 'Workers', status: 'healthy', value: 97 }
          ]
        },
        updateFrequency: 60,
        lastUpdated: now
      }
    ];
  }

  /**
   * Creator-specific widgets
   */
  private async getCreatorWidgets(): Promise<DashboardWidget[]> {
    const now = Date.now();

    return [
      {
        id: 'pitch-views',
        title: 'Pitch Views Today',
        type: 'metric',
        data: {
          current: 1247,
          previous: 1089,
          trend: 'up',
          subtitle: '+14.5% vs yesterday'
        },
        updateFrequency: 60,
        lastUpdated: now
      },
      {
        id: 'interest-rate',
        title: 'Interest Rate',
        type: 'gauge',
        data: {
          value: 8.5,
          max: 100,
          unit: '%',
          color: '#f59e0b',
          subtitle: 'View to interest conversion'
        },
        updateFrequency: 120,
        lastUpdated: now
      },
      {
        id: 'nda-requests',
        title: 'NDA Requests',
        type: 'chart',
        data: {
          type: 'doughnut',
          datasets: [{
            data: [12, 8, 3],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            labels: ['Pending', 'Approved', 'Declined']
          }]
        },
        updateFrequency: 300,
        lastUpdated: now
      }
    ];
  }

  /**
   * Investor-specific widgets
   */
  private async getInvestorWidgets(): Promise<DashboardWidget[]> {
    const now = Date.now();

    return [
      {
        id: 'portfolio-value',
        title: 'Portfolio Value',
        type: 'metric',
        data: {
          current: '$485,000',
          growth: '+8.2%',
          trend: 'up',
          subtitle: 'This month'
        },
        updateFrequency: 60,
        lastUpdated: now
      },
      {
        id: 'investment-opportunities',
        title: 'New Opportunities',
        type: 'metric',
        data: {
          current: 23,
          new: 5,
          trend: 'up',
          subtitle: 'Pitches matching your criteria'
        },
        updateFrequency: 120,
        lastUpdated: now
      },
      {
        id: 'sector-allocation',
        title: 'Sector Allocation',
        type: 'chart',
        data: {
          type: 'pie',
          datasets: [{
            data: [35, 25, 20, 15, 5],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
            labels: ['Drama', 'Action', 'Comedy', 'Thriller', 'Documentary']
          }]
        },
        updateFrequency: 300,
        lastUpdated: now
      }
    ];
  }

  /**
   * Production company widgets
   */
  private async getProductionWidgets(): Promise<DashboardWidget[]> {
    const now = Date.now();

    return [
      {
        id: 'projects-in-development',
        title: 'Projects in Development',
        type: 'metric',
        data: {
          current: 8,
          previous: 6,
          trend: 'up',
          subtitle: 'Active productions'
        },
        updateFrequency: 300,
        lastUpdated: now
      },
      {
        id: 'talent-pipeline',
        title: 'Talent Pipeline',
        type: 'list',
        data: {
          items: [
            { name: 'Sarah Johnson', role: 'Director', projects: 3, rating: 4.8 },
            { name: 'Mike Chen', role: 'Producer', projects: 5, rating: 4.9 },
            { name: 'Elena Rodriguez', role: 'Writer', projects: 2, rating: 4.7 }
          ]
        },
        updateFrequency: 600,
        lastUpdated: now
      }
    ];
  }

  /**
   * Helper methods for calculations
   */
  private calculateTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const change = (current - previous) / previous;
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private calculatePerformanceScore(metrics: any): number {
    // Calculate overall performance score from multiple metrics
    const responseTimeScore = Math.max(0, 100 - (metrics.averageResponseTime - 100) * 2);
    const errorRateScore = Math.max(0, 100 - metrics.errorRate * 100);
    const cacheScore = metrics.cacheHitRate * 100;
    
    return Math.round((responseTimeScore + errorRateScore + cacheScore) / 3);
  }

  private getPerformanceColor(metrics: any): string {
    const score = this.calculatePerformanceScore(metrics);
    if (score >= 90) return '#10b981'; // Green
    if (score >= 70) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  }

  private async getResponseTimeHistory(): Promise<number[]> {
    // Get last 24 hours of response time data
    const cacheKey = 'response-time-history';
    return await this.cache.get(cacheKey, async () => {
      // Generate sample data - replace with real data retrieval
      const hours = Array.from({length: 24}, (_, i) => i);
      return hours.map(() => Math.random() * 50 + 50); // 50-100ms range
    }, 'analytics');
  }

  private async getUserGrowthData(): Promise<number[]> {
    // Get user growth data for last 7 days
    const cacheKey = 'user-growth-data';
    return await this.cache.get(cacheKey, async () => {
      // Generate sample data - replace with real data retrieval
      return [120, 135, 145, 160, 155, 175, 190];
    }, 'analytics');
  }

  /**
   * Get widget update
   */
  async getWidgetUpdate(widgetId: string, userType: string): Promise<DashboardWidget | null> {
    const dashboard = await this.getDashboardData(userType as any);
    return dashboard.widgets.find(w => w.id === widgetId) || null;
  }

  /**
   * Create custom widget
   */
  async createCustomWidget(widget: Omit<DashboardWidget, 'lastUpdated'>): Promise<DashboardWidget> {
    const customWidget: DashboardWidget = {
      ...widget,
      lastUpdated: Date.now()
    };

    // Store custom widget configuration
    const customWidgetsKey = 'custom-widgets';
    await this.cache.set(customWidgetsKey, customWidget, 'analytics');

    return customWidget;
  }
}