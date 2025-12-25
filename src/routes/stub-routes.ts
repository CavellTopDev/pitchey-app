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
    const patterns = [
      { pattern: /^\/api\/investment\//, response: { data: [], totalCount: 0 } },
      { pattern: /^\/api\/ndas\//, response: { data: [], totalCount: 0 } },
      { pattern: /^\/api\/analytics\//, response: { data: {}, charts: [] } }
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
      metrics: {
        totalViews: 0,
        totalPitches: 0,
        totalUsers: 0,
        activeUsers: 0,
        conversion: 0,
        engagement: 0,
        growth: 0
      },
      charts: {
        views: this.generateEmptyChart(period),
        users: this.generateEmptyChart(period),
        revenue: this.generateEmptyChart(period)
      },
      topPerformers: [],
      recentActivity: [],
      period: period,
      lastUpdated: now.toISOString()
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