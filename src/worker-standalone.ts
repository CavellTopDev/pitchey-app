/**
 * Standalone Cloudflare Worker with full demo functionality
 * This version works independently without backend dependency
 */

export interface Env {
  // Storage  
  CACHE?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  
  // Database
  HYPERDRIVE?: Hyperdrive;
  
  // Real-time
  WEBSOCKET_ROOM?: DurableObjectNamespace;
  
  // Configuration
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ORIGIN_URL?: string; // Optional backend for future proxy
}

// Demo data store
const DEMO_DATA = {
  users: [
    { 
      id: 1004, 
      email: 'alex.creator@demo.com', 
      userType: 'creator',
      firstName: 'Alex',
      lastName: 'Creator',
      displayName: 'Alex Creator',
      companyName: 'Independent Films',
      bio: 'Passionate filmmaker with 10+ years of experience.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    },
    { 
      id: 1005, 
      email: 'sarah.investor@demo.com', 
      userType: 'investor',
      firstName: 'Sarah',
      lastName: 'Investor',
      displayName: 'Sarah Investor',
      companyName: 'Capital Ventures',
      bio: 'Angel investor focused on entertainment and media.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    },
    { 
      id: 1006, 
      email: 'stellar.production@demo.com', 
      userType: 'production',
      firstName: 'Stellar',
      lastName: 'Production',
      displayName: 'Stellar Production',
      companyName: 'Stellar Productions Inc',
      bio: 'Full-service production company.',
      isVerified: true,
      createdAt: '2024-01-15T10:00:00Z'
    }
  ],
  pitches: [
    {
      id: 1,
      title: 'The Last Stand',
      genre: 'Action',
      budget: 5000000,
      description: 'An action-packed thriller about survival against impossible odds.',
      creatorId: 1004,
      creatorName: 'Alex Creator',
      status: 'active',
      featured: true,
      views: 1250,
      createdAt: '2024-11-10T14:30:00Z',
      updatedAt: '2024-11-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Digital Dreams',
      genre: 'Sci-Fi',
      budget: 8000000,
      description: 'A futuristic story about virtual reality and human connection.',
      creatorId: 1004,
      creatorName: 'Alex Creator',
      status: 'active',
      featured: false,
      views: 890,
      createdAt: '2024-11-12T09:15:00Z',
      updatedAt: '2024-11-14T16:20:00Z'
    },
    {
      id: 3,
      title: 'Hidden Treasures',
      genre: 'Adventure',
      budget: 3500000,
      description: 'An archaeological adventure in search of ancient artifacts.',
      creatorId: 1004,
      creatorName: 'Alex Creator',
      status: 'draft',
      featured: false,
      views: 45,
      createdAt: '2024-11-14T11:45:00Z',
      updatedAt: '2024-11-15T08:30:00Z'
    }
  ],
  notifications: [
    {
      id: 1,
      userId: 1005,
      type: 'pitch_update',
      title: 'New pitch available',
      message: 'Alex Creator has published a new pitch: "The Last Stand"',
      read: false,
      createdAt: '2024-11-15T10:00:00Z'
    },
    {
      id: 2,
      userId: 1005,
      type: 'investment_update',
      title: 'Investment opportunity',
      message: 'Digital Dreams is seeking additional funding.',
      read: false,
      createdAt: '2024-11-14T15:30:00Z'
    }
  ]
};

// Demo auth tokens (for testing only)
const DEMO_TOKENS = {
  'demo-creator': { userId: 1004, userType: 'creator', email: 'alex.creator@demo.com' },
  'demo-investor': { userId: 1005, userType: 'investor', email: 'sarah.investor@demo.com' },
  'demo-production': { userId: 1006, userType: 'production', email: 'stellar.production@demo.com' }
};

function getCorsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowedOrigin = origin && (
    origin === env.FRONTEND_URL ||
    origin.includes('.pages.dev') ||
    origin.includes('localhost')
  ) ? origin : env.FRONTEND_URL || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

function extractAuth(request: Request): { user: any | null; token: string | null } {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, token: null };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  
  // Check demo tokens
  if (DEMO_TOKENS[token as keyof typeof DEMO_TOKENS]) {
    return { 
      user: DEMO_TOKENS[token as keyof typeof DEMO_TOKENS], 
      token 
    };
  }
  
  return { user: null, token };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin');
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, env)
      });
    }
    
    const corsHeaders = getCorsHeaders(origin, env);
    
    try {
      // Health check
      if (url.pathname === '/api/health' || url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          worker: 'pitchey-api-production',
          version: '1.0.0',
          mode: 'standalone-demo',
          environment: {
            frontendUrl: env.FRONTEND_URL,
            hasCache: !!env.CACHE,
            hasR2: !!env.R2_BUCKET,
            hasWebSocket: !!env.WEBSOCKET_ROOM
          }
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // Authentication endpoints
      if (url.pathname.startsWith('/api/auth/') && url.pathname.endsWith('/login') && method === 'POST') {
        try {
          const loginData = await request.json();
          const { email, password } = loginData;
          
          const user = DEMO_DATA.users.find(u => u.email === email);
          if (!user || password !== 'Demo123!') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid credentials'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Return demo token
          const demoTokenKey = `demo-${user.userType}`;
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              token: demoTokenKey,
              user: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                firstName: user.firstName,
                lastName: user.lastName,
                displayName: user.displayName,
                companyName: user.companyName,
                bio: user.bio,
                isVerified: user.isVerified
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Login failed',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // User profile endpoint
      if (url.pathname === '/api/user/profile' && method === 'GET') {
        const { user } = extractAuth(request);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userProfile = DEMO_DATA.users.find(u => u.id === user.userId);
        return new Response(JSON.stringify({
          success: true,
          data: userProfile
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Pitches endpoint
      if (url.pathname === '/api/pitches' && method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1);
        const featured = url.searchParams.get('featured') === 'true';
        
        let filteredPitches = DEMO_DATA.pitches.filter(p => p.status === 'active');
        if (featured) {
          filteredPitches = filteredPitches.filter(p => p.featured);
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            pitches: filteredPitches,
            pagination: {
              total: filteredPitches.length,
              totalPages: Math.ceil(filteredPitches.length / limit),
              currentPage: page,
              hasMore: false
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Trending pitches endpoint
      if (url.pathname === '/api/pitches/trending' && method === 'GET') {
        const trendingPitches = DEMO_DATA.pitches
          .filter(p => p.status === 'active')
          .sort((a, b) => b.views - a.views);
          
        return new Response(JSON.stringify({
          success: true,
          data: {
            pitches: trendingPitches,
            pagination: {
              total: trendingPitches.length,
              totalPages: 1,
              currentPage: 1,
              hasMore: false
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // User notifications
      if (url.pathname === '/api/user/notifications' && method === 'GET') {
        const { user } = extractAuth(request);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userNotifications = DEMO_DATA.notifications.filter(n => n.userId === user.userId);
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            notifications: userNotifications,
            pagination: {
              total: userNotifications.length,
              totalPages: 1,
              currentPage: 1,
              hasMore: false
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Creator dashboard
      if (url.pathname === '/api/creator/dashboard' && method === 'GET') {
        const { user } = extractAuth(request);
        if (!user || user.userType !== 'creator') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const userPitches = DEMO_DATA.pitches.filter(p => p.creatorId === user.userId);
        const totalViews = userPitches.reduce((sum, p) => sum + p.views, 0);
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            stats: {
              totalPitches: userPitches.length,
              activePitches: userPitches.filter(p => p.status === 'active').length,
              totalViews: totalViews,
              averageViews: Math.round(totalViews / userPitches.length) || 0
            },
            recentPitches: userPitches.slice(0, 5)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Investor dashboard
      if (url.pathname === '/api/investor/dashboard' && method === 'GET') {
        const { user } = extractAuth(request);
        if (!user || user.userType !== 'investor') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const activePitches = DEMO_DATA.pitches.filter(p => p.status === 'active');
        
        return new Response(JSON.stringify({
          success: true,
          data: {
            stats: {
              availablePitches: activePitches.length,
              featuredPitches: activePitches.filter(p => p.featured).length,
              totalInvestmentOpportunity: activePitches.reduce((sum, p) => sum + p.budget, 0)
            },
            featuredPitches: activePitches.filter(p => p.featured).slice(0, 3),
            recentPitches: activePitches.slice(0, 5)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Default response for unknown endpoints
      return new Response(JSON.stringify({
        message: 'Pitchey API Gateway - Demo Mode',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth/{creator|investor|production}/login',
          profile: '/api/user/profile',
          pitches: '/api/pitches',
          trending: '/api/pitches/trending',
          notifications: '/api/user/notifications',
          dashboards: {
            creator: '/api/creator/dashboard',
            investor: '/api/investor/dashboard'
          }
        },
        demo: {
          accounts: [
            { email: 'alex.creator@demo.com', password: 'Demo123!', type: 'creator' },
            { email: 'sarah.investor@demo.com', password: 'Demo123!', type: 'investor' },
            { email: 'stellar.production@demo.com', password: 'Demo123!', type: 'production' }
          ]
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Request error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Minimal WebSocket Room for completeness
export class WebSocketRoom {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      message: 'WebSocket rooms available in full backend mode',
      status: 'demo-mode'
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}