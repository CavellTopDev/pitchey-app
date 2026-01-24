/**
 * Stub routes for missing/unimplemented endpoints
 * These return empty but valid responses to prevent 404/500 errors
 */

import { getCorsHeaders } from '../utils/response';

export class StubRoutes {
  /**
   * Register stub routes that return empty data
   */
  static getStubEndpoints(): Map<string, any> {
    const stubs = new Map();
    
    // Investment endpoints
    stubs.set('/api/production/investments/overview', {
      data: {
        totalInvested: 0,
        activeProjects: 0,
        roi: 0,
        investments: []
      }
    });
    
    stubs.set('/api/investment/recommendations', {
      recommendations: [],
      totalCount: 0
    });
    
    // NDA endpoints
    stubs.set('/api/ndas/incoming-requests', {
      requests: [],
      totalCount: 0
    });
    
    stubs.set('/api/ndas/outgoing-requests', {
      requests: [],
      totalCount: 0
    });
    
    stubs.set('/api/ndas/incoming-signed', {
      ndas: [],
      totalCount: 0
    });
    
    stubs.set('/api/ndas/outgoing-signed', {
      ndas: [],
      totalCount: 0
    });
    
    // Analytics dashboard - return minimal data
    stubs.set('/api/analytics/dashboard', {
      metrics: {
        totalViews: 0,
        totalPitches: 0,
        totalUsers: 0,
        activeUsers: 0,
        conversion: 0,
        engagement: 0
      },
      charts: {
        daily: [],
        weekly: [],
        monthly: []
      },
      period: 'month'
    });
    
    return stubs;
  }
  
  /**
   * Handle stub request
   */
  static handleStubRequest(pathname: string, request: Request): Response | null {
    // Normalize pathname - remove query params
    const cleanPath = pathname.split('?')[0];
    
    // Check exact match first
    const stubs = this.getStubEndpoints();
    if (stubs.has(cleanPath)) {
      return new Response(JSON.stringify(stubs.get(cleanPath)), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });
    }
    
    // Check pattern matches
    // NOTE: Analytics routes are handled by the main router, don't stub them
    const patterns = [
      { pattern: /^\/api\/investment\//, response: { data: [], totalCount: 0 } },
      { pattern: /^\/api\/ndas\//, response: { data: [], totalCount: 0 } }
      // Removed: { pattern: /^\/api\/analytics\//, response: { data: {}, charts: [] } }
      // Analytics routes should go through the registered handlers, not stubs
    ];
    
    for (const { pattern, response } of patterns) {
      if (pattern.test(cleanPath)) {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        });
      }
    }
    
    return null;
  }
  
  /**
   * Create fallback profile response
   */
  static getFallbackProfile(userId: string, email: string): any {
    return {
      id: userId,
      email: email,
      name: 'User',
      role: 'user',
      user_type: 'standard',
      bio: '',
      avatar: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  
  /**
   * Create fallback analytics response
   */
  static getFallbackAnalytics(preset?: string): any {
    const now = new Date();
    const period = preset || 'month';

    return {
      overview: {
        totalViews: 0,
        uniqueVisitors: 0,
        totalPitches: 0,
        totalInvestments: 0,
        totalRevenue: 0,
        averageRating: 0,
        conversionRate: 0,
        activeUsers: 0
      },
      trends: {
        viewsOverTime: { labels: [], datasets: [] },
        investmentsOverTime: { labels: [], datasets: [] },
        userGrowth: { labels: [], datasets: [] },
        revenueGrowth: { labels: [], datasets: [] }
      },
      demographics: {
        usersByRole: { labels: [], datasets: [] },
        pitchesByGenre: { labels: [], datasets: [] },
        pitchesByStatus: { labels: [], datasets: [] },
        investmentsByRange: { labels: [], datasets: [] }
      },
      performance: {
        topPitches: [],
        topCreators: [],
        topInvestors: []
      },
      engagement: {
        averageSessionDuration: 0,
        bounceRate: 0,
        pageViewsPerSession: 0,
        mostViewedPages: []
      }
    };
  }
  
  /**
   * Generate empty chart data
   */
  private static generateEmptyChart(period: string): any[] {
    const points = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const data = [];
    
    for (let i = 0; i < points; i++) {
      data.push({
        label: `Point ${i + 1}`,
        value: 0
      });
    }
    
    return data;
  }
}