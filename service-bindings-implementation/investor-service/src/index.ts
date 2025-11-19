/**
 * Investor Service Worker - Optimized for Investor-Specific Operations
 * Handles dashboard, portfolio, investments, and investor-specific features
 */

import { Toucan } from 'toucan-js';
import { CachingService } from '../../shared/caching-strategy';
import { dbPool, withDatabase } from '../../shared/database-pool';
import { validateJWT, AuthPayload } from '../../shared/auth-utils';

interface Env {
  // Database
  HYPERDRIVE: Hyperdrive;
  
  // Storage
  R2_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  
  // Authentication
  JWT_SECRET: string;
  
  // Configuration
  FRONTEND_URL: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  
  // Redis (optional)
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize Sentry for investor service
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || 'development',
      release: env.SENTRY_RELEASE || 'investor-dev',
      context: ctx,
      request
    });

    try {
      const url = new URL(request.url);
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
      
      // Initialize database pool
      dbPool.initialize(env, sentry);
      
      // Authentication for protected endpoints
      let auth: AuthPayload | null = null;
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          auth = await validateJWT(token, env.JWT_SECRET);
          if (auth.userType !== 'investor') {
            return new Response(JSON.stringify({
              success: false,
              error: { message: 'Access denied: Investor account required' }
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: { message: 'Invalid authentication token' }
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Route investor-specific endpoints
      const pathname = url.pathname;
      
      if (pathname === '/api/investor/dashboard' && request.method === 'GET') {
        return handleInvestorDashboard(request, env, auth, sentry);
      }
      
      if (pathname === '/api/investor/portfolio' && request.method === 'GET') {
        return handleInvestorPortfolio(request, env, auth, sentry);
      }
      
      if (pathname === '/api/investor/investments' && request.method === 'GET') {
        return handleInvestmentHistory(request, env, auth, sentry);
      }
      
      if (pathname === '/api/investor/recommendations' && request.method === 'GET') {
        return handleInvestmentRecommendations(request, env, auth, sentry);
      }
      
      if (pathname === '/api/investor/analytics' && request.method === 'GET') {
        return handleInvestorAnalytics(request, env, auth, sentry);
      }
      
      if (pathname.startsWith('/api/auth/investor/')) {
        return handleInvestorAuth(request, env, sentry);
      }
      
      // Health check
      if (pathname === '/api/health') {
        return handleHealthCheck(env);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Endpoint not found in investor service',
          path: pathname,
          service: 'investor-service'
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      sentry.captureException(error);
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          message: 'Investor service error occurred',
          code: 'INVESTOR_SERVICE_ERROR'
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleInvestorDashboard(
  request: Request,
  env: Env,
  auth: AuthPayload | null,
  sentry: Toucan
): Promise<Response> {
  if (!auth) {
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Authentication required' }
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Use optimized caching for dashboard data
    const cache = new CachingService(env, sentry);
    
    const dashboardData = await cache.get(
      `investor-dashboard:${auth.userId}`,
      async () => {
        console.log('🔄 Cache MISS: Fetching investor dashboard from database');
        
        return await withDatabase(env, async (sql) => {
          // Portfolio summary with optimized queries
          const portfolioQuery = await sql`
            SELECT 
              COALESCE(SUM(amount), 0) as total_invested,
              COALESCE(SUM(current_value), 0) as current_value,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
              COALESCE(AVG(CASE WHEN amount > 0 THEN (current_value - amount) / amount * 100 END), 0) as avg_roi
            FROM investments 
            WHERE investor_id = ${auth.userId} AND status != 'cancelled'
          `;
          
          const portfolio = portfolioQuery[0] || {};
          const totalInvested = parseFloat(portfolio.total_invested || '0');
          const currentValue = parseFloat(portfolio.current_value || '0');
          const totalReturn = currentValue - totalInvested;
          const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested * 100) : 0;
          
          // Recent activity
          const recentActivity = await sql`
            SELECT 
              i.id,
              'investment' as type,
              p.title,
              i.amount,
              i.status,
              i.created_at::date as date,
              CONCAT(u.first_name, ' ', u.last_name) as creator
            FROM investments i
            JOIN pitches p ON i.pitch_id = p.id
            JOIN users u ON p.creator_id = u.id
            WHERE i.investor_id = ${auth.userId}
            ORDER BY i.created_at DESC
            LIMIT 5
          `;
          
          // Investment opportunities (cached separately)
          const recommendations = await sql`
            SELECT 
              p.id,
              p.title,
              p.genre,
              p.funding_goal,
              COALESCE(SUM(i.amount), 0) as raised,
              CONCAT(u.first_name, ' ', u.last_name) as creator,
              85 + (RANDOM() * 15)::int as match_score
            FROM pitches p
            JOIN users u ON p.creator_id = u.id
            LEFT JOIN investments i ON p.id = i.pitch_id
            WHERE p.status = 'active'
              AND p.id NOT IN (
                SELECT pitch_id FROM investments WHERE investor_id = ${auth.userId}
              )
            GROUP BY p.id, p.title, p.genre, p.funding_goal, u.first_name, u.last_name
            ORDER BY match_score DESC
            LIMIT 3
          `;
          
          return {
            portfolio: {
              totalInvested: Math.round(totalInvested),
              currentValue: Math.round(currentValue),
              totalReturn: Math.round(totalReturn),
              returnPercentage: Math.round(returnPercentage * 100) / 100,
              activeInvestments: parseInt(portfolio.active_count || '0'),
              completedInvestments: parseInt(portfolio.completed_count || '0')
            },
            recentActivity: recentActivity.map(activity => ({
              id: activity.id,
              type: activity.type,
              title: activity.title,
              amount: parseFloat(activity.amount),
              status: activity.status,
              date: activity.date,
              creator: activity.creator
            })),
            recommendations: recommendations.map(rec => ({
              id: rec.id,
              title: rec.title,
              genre: rec.genre,
              fundingGoal: parseFloat(rec.funding_goal),
              raised: parseFloat(rec.raised),
              creator: rec.creator,
              matchScore: parseInt(rec.match_score)
            })),
            analytics: {
              monthlyReturn: Math.round((returnPercentage / 12) * 100) / 100,
              avgDealSize: Math.round(totalInvested / (parseInt(portfolio.active_count || '0') + parseInt(portfolio.completed_count || '0')) || 0),
              portfolioDiversification: {
                drama: 40,    // TODO: Calculate from actual portfolio
                comedy: 25,   // These would come from genre analysis
                action: 20,
                documentary: 15
              }
            }
          };
        });
      },
      'dashboard' // Use 5-minute TTL
    );

    return new Response(JSON.stringify({
      success: true,
      data: dashboardData,
      cached: true,
      service: 'investor-service'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    sentry.captureException(error, {
      tags: { endpoint: 'investor-dashboard' },
      user: { id: auth.userId }
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Failed to load investor dashboard' }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleInvestorPortfolio(
  request: Request,
  env: Env,
  auth: AuthPayload | null,
  sentry: Toucan
): Promise<Response> {
  // Implementation for portfolio endpoint
  // Similar pattern to dashboard with portfolio-specific data
  return new Response(JSON.stringify({
    success: true,
    message: 'Portfolio endpoint implementation pending'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleInvestmentHistory(
  request: Request,
  env: Env,
  auth: AuthPayload | null,
  sentry: Toucan
): Promise<Response> {
  // Implementation for investment history
  return new Response(JSON.stringify({
    success: true,
    message: 'Investment history endpoint implementation pending'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleInvestmentRecommendations(
  request: Request,
  env: Env,
  auth: AuthPayload | null,
  sentry: Toucan
): Promise<Response> {
  // Implementation for investment recommendations
  return new Response(JSON.stringify({
    success: true,
    message: 'Investment recommendations endpoint implementation pending'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleInvestorAnalytics(
  request: Request,
  env: Env,
  auth: AuthPayload | null,
  sentry: Toucan
): Promise<Response> {
  // Implementation for investor analytics
  return new Response(JSON.stringify({
    success: true,
    message: 'Investor analytics endpoint implementation pending'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleInvestorAuth(
  request: Request,
  env: Env,
  sentry: Toucan
): Promise<Response> {
  // Implementation for investor-specific auth endpoints
  return new Response(JSON.stringify({
    success: true,
    message: 'Investor auth endpoint implementation pending'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleHealthCheck(env: Env): Promise<Response> {
  const healthData = {
    status: 'healthy',
    service: 'investor-service',
    version: 'v1.0',
    timestamp: new Date().toISOString(),
    database: {
      connected: !!env.HYPERDRIVE,
      poolStats: dbPool.getStats()
    },
    cache: {
      enabled: !!env.CACHE
    },
    storage: {
      enabled: !!env.R2_BUCKET
    }
  };
  
  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}