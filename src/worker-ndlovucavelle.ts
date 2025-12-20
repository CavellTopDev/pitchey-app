/**
 * Pitchey API Worker for ndlovucavelle account
 * Simple, working API with proper CORS support
 */

// WebSocket types for Cloudflare Workers
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

export interface Env {
  // Database
  DATABASE_URL?: string;
  
  // Cache
  KV?: KVNamespace;
  CACHE?: KVNamespace;
  
  // Storage
  R2_BUCKET?: R2Bucket;
  
  // Configuration
  FRONTEND_URL?: string;
  ENVIRONMENT?: 'development' | 'staging' | 'production';
  
  // Auth
  JWT_SECRET?: string;
}

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'https://pitchey-5o8.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000'
];

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const requestOrigin = origin;
  const isAllowed = requestOrigin && (
    ALLOWED_ORIGINS.some(allowed => requestOrigin === allowed) ||
    requestOrigin.endsWith('.pitchey.pages.dev') ||
    requestOrigin.endsWith('.pitchey-5o8.pages.dev')
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

class PitcheyAPIHandler {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check
    if (path === '/health') {
      return jsonResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: this.env.ENVIRONMENT || 'production',
        service: 'pitchey-api',
        version: '1.0.0'
      }, 200, corsHeaders);
    }

    // WebSocket endpoint - minimal implementation
    if (path === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader === 'websocket') {
        // Create a WebSocket pair for the connection
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        
        // Handle WebSocket messages
        server.accept();
        server.addEventListener('message', event => {
          // Echo back any message received (for testing)
          const data = JSON.parse(event.data as string);
          server.send(JSON.stringify({
            type: 'pong',
            data: data,
            timestamp: new Date().toISOString()
          }));
        });
        
        server.addEventListener('close', () => {
          console.log('WebSocket connection closed');
        });
        
        // Return the WebSocket response
        return new Response(null, {
          status: 101,
          webSocket: client
        });
      }
      
      return new Response('WebSocket endpoint requires upgrade header', {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain'
        }
      });
    }

    // API routes
    if (path.startsWith('/api/')) {
      
      // Auth endpoints - Support all portal-specific login endpoints
      if ((path === '/api/auth/login' || 
           path === '/api/auth/creator/login' || 
           path === '/api/auth/investor/login' || 
           path === '/api/auth/production/login') && method === 'POST') {
        const body = await request.json();
        
        // Determine user type from path
        let userType = 'creator';
        if (path.includes('/investor/')) {
          userType = 'investor';
        } else if (path.includes('/production/')) {
          userType = 'production';
        }
        
        // Demo accounts for testing
        const demoAccounts: Record<string, any> = {
          'alex.creator@demo.com': { id: '1', name: 'Alex Chen', userType: 'creator' },
          'sarah.investor@demo.com': { id: '2', name: 'Sarah Johnson', userType: 'investor' },
          'stellar.production@demo.com': { id: '3', name: 'Stellar Studios', userType: 'production' }
        };
        
        const user = demoAccounts[body.email] || {
          id: Date.now().toString(),
          email: body.email,
          name: body.email?.split('@')[0] || 'User',
          userType
        };
        
        return jsonResponse({
          success: true,
          data: {
            token: 'mock-jwt-' + Date.now(),
            user: {
              ...user,
              email: body.email
            }
          }
        }, 200, corsHeaders);
      }
      
      // Logout endpoint
      if ((path === '/api/auth/logout' || 
           path === '/api/auth/creator/logout' ||
           path === '/api/auth/investor/logout' ||
           path === '/api/auth/production/logout') && method === 'POST') {
        return jsonResponse({
          success: true,
          message: 'Logged out successfully'
        }, 200, corsHeaders);
      }
      
      // Register endpoints
      if ((path === '/api/auth/register' ||
           path === '/api/auth/creator/register' ||
           path === '/api/auth/investor/register' ||
           path === '/api/auth/production/register') && method === 'POST') {
        const body = await request.json();
        
        // Determine user type from path
        let userType = 'creator';
        if (path.includes('/investor/')) {
          userType = 'investor';
        } else if (path.includes('/production/')) {
          userType = 'production';
        }
        
        return jsonResponse({
          success: true,
          data: {
            token: 'mock-jwt-' + Date.now(),
            user: {
              id: Date.now().toString(),
              email: body.email,
              name: body.name || body.email?.split('@')[0] || 'User',
              userType
            }
          }
        }, 200, corsHeaders);
      }

      if (path === '/api/auth/session' && method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return jsonResponse({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'No auth token' }
          }, 401, corsHeaders);
        }
        
        return jsonResponse({
          success: true,
          data: {
            user: {
              id: '1',
              email: 'user@example.com',
              name: 'Test User',
              userType: 'creator'
            }
          }
        }, 200, corsHeaders);
      }

      // Validate token endpoint
      if (path === '/api/validate-token' && method === 'GET') {
        const authHeader = request.headers.get('Authorization');
        
        // If no auth header, check for token in localStorage pattern
        if (!authHeader) {
          // Return a valid but expired response to trigger re-login
          return jsonResponse({
            success: false,
            valid: false,
            error: { code: 'NO_TOKEN', message: 'No authentication token provided' }
          }, 200, corsHeaders); // Return 200 with valid:false instead of 401
        }
        
        if (!authHeader.startsWith('Bearer ')) {
          return jsonResponse({
            success: false,
            valid: false,
            error: { code: 'INVALID_TOKEN', message: 'Invalid token format' }
          }, 200, corsHeaders);
        }
        
        // Parse the mock token to determine user type
        const token = authHeader.replace('Bearer ', '');
        let user = {
          id: '2',
          email: 'sarah.investor@demo.com',
          name: 'Sarah Johnson',
          userType: 'investor' as const
        };
        
        // Check referrer to determine user context
        const referrer = request.headers.get('Referer') || '';
        if (referrer.includes('/creator/')) {
          user = {
            id: '1',
            email: 'alex.creator@demo.com',
            name: 'Alex Chen',
            userType: 'creator'
          };
        } else if (referrer.includes('/production/')) {
          user = {
            id: '3',
            email: 'stellar.production@demo.com',
            name: 'Stellar Studios',
            userType: 'production'
          };
        }
        
        return jsonResponse({
          success: true,
          data: {
            user,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Token expires in 24 hours
          }
        }, 200, corsHeaders);
      }

      // User profile
      if (path === '/api/users/profile' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            id: '1',
            email: 'user@example.com',
            name: 'Test User',
            userType: 'creator',
            profile: {
              bio: 'Creator profile',
              avatar: null,
              createdAt: new Date().toISOString()
            }
          }
        }, 200, corsHeaders);
      }
      
      // Dashboard endpoints for different user types
      if (path === '/api/dashboard/creator' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: 5,
              activePitches: 3,
              draftPitches: 2,
              totalViews: 1250,
              totalNDAs: 8,
              totalInvestments: 2
            },
            recentActivity: [
              { type: 'view', pitch: 'The Next Blockbuster', timestamp: new Date().toISOString() },
              { type: 'nda_request', pitch: 'Epic Adventure', timestamp: new Date(Date.now() - 3600000).toISOString() }
            ],
            trendingPitches: []
          }
        }, 200, corsHeaders);
      }
      
      if (path === '/api/dashboard/investor' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              savedPitches: 12,
              activeNDAs: 5,
              totalInvestments: 3,
              portfolioValue: 250000
            },
            recentActivity: [
              { type: 'saved', pitch: 'Trending Drama', timestamp: new Date().toISOString() },
              { type: 'nda_approved', pitch: 'The Next Blockbuster', timestamp: new Date(Date.now() - 7200000).toISOString() }
            ],
            savedPitches: []
          }
        }, 200, corsHeaders);
      }
      
      if (path === '/api/dashboard/production' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            stats: {
              activeProjects: 4,
              inProduction: 2,
              inDevelopment: 2,
              totalBudget: 45000000
            },
            recentActivity: [
              { type: 'project_update', project: 'Summer Blockbuster', timestamp: new Date().toISOString() },
              { type: 'script_review', project: 'Holiday Special', timestamp: new Date(Date.now() - 10800000).toISOString() }
            ],
            projects: []
          }
        }, 200, corsHeaders);
      }
      
      // Creator's pitches endpoint
      if (path === '/api/pitches/my' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              title: 'My Amazing Script',
              logline: 'A creators masterpiece in the making',
              genre: 'Drama',
              status: 'draft',
              visibility: 'private',
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              views: 0
            },
            {
              id: '2',
              title: 'The Next Big Thing',
              logline: 'Revolutionary story that will change cinema',
              genre: 'Sci-Fi',
              status: 'published',
              visibility: 'public',
              created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              views: 342
            }
          ]
        }, 200, corsHeaders);
      }

      // Public pitches
      if (path === '/api/pitches/public' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              title: 'The Last Algorithm',
              logline: 'An AI discovers the meaning of life',
              genre: 'Sci-Fi',
              status: 'published',
              visibility: 'public',
              creator_name: 'Alex Chen',
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: '2', 
              title: 'Midnight in Montana',
              logline: 'A thriller set in the wilderness',
              genre: 'Thriller',
              status: 'published',
              visibility: 'public',
              creator_name: 'Sarah Johnson',
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Trending pitches - FIXED ENDPOINT
      if (path === '/api/pitches/trending' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: 1,
              title: "The Next Blockbuster",
              genre: "Action",
              budget_range: "$10M - $50M",
              logline: "A trending action-packed adventure that captivates global audiences",
              creator_name: "John Director",
              creator_email: "john@example.com",
              status: "published",
              visibility: "public",
              views: 1250,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 2,
              title: "Trending Drama",
              genre: "Drama", 
              budget_range: "$5M - $20M",
              logline: "An emotional journey that captivates audiences worldwide",
              creator_name: "Sarah Writer",
              creator_email: "sarah@example.com",
              status: "published",
              visibility: "public",
              views: 980,
              created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 3,
              title: "Epic Adventure",
              genre: "Adventure",
              budget_range: "$15M - $75M",
              logline: "A thrilling quest that redefines modern cinema",
              creator_name: "Mike Adventure",
              creator_email: "mike@example.com",
              status: "published",
              visibility: "public",
              views: 750,
              created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // New pitches - FIXED ENDPOINT
      if (path === '/api/pitches/new' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: 4,
              title: "Fresh New Comedy",
              genre: "Comedy",
              budget_range: "$2M - $10M",
              logline: "A hilarious take on modern life that will have you laughing",
              creator_name: "Mike Funny",
              creator_email: "mike@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 5,
              title: "New Sci-Fi Thriller",
              genre: "Sci-Fi",
              budget_range: "$20M - $100M",
              logline: "The future is closer than we think - and more dangerous",
              creator_name: "Alex Future",
              creator_email: "alex@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 6,
              title: "Romantic Mystery",
              genre: "Romance",
              budget_range: "$8M - $25M",
              logline: "Love and mystery intertwine in unexpected ways",
              creator_name: "Emma Romance",
              creator_email: "emma@example.com",
              status: "published",
              visibility: "public",
              created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Analytics endpoints
      if (path === '/api/analytics/dashboard' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            totalViews: 1250,
            totalPitches: 12,
            totalInvestments: 3,
            recentActivity: [
              { type: 'view', pitch: 'The Next Blockbuster', timestamp: new Date().toISOString() },
              { type: 'like', pitch: 'Trending Drama', timestamp: new Date(Date.now() - 60000).toISOString() }
            ]
          }
        }, 200, corsHeaders);
      }

      // NDA stats
      if (path === '/api/ndas/stats' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            pending: 2,
            approved: 5,
            rejected: 1,
            total: 8
          }
        }, 200, corsHeaders);
      }

      // Creator dashboard endpoint
      if (path === '/api/creator/dashboard' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            pitches: {
              total: 5,
              published: 3,
              draft: 2
            },
            engagement: {
              totalViews: 1250,
              totalLikes: 48,
              totalShares: 12
            },
            ndas: {
              pending: 2,
              approved: 5,
              total: 7
            },
            revenue: {
              total: 25000,
              pending: 5000,
              paid: 20000
            }
          }
        }, 200, corsHeaders);
      }

      // Payments/Credits endpoints
      if (path === '/api/payments/credits/balance' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            balance: 100,
            currency: 'USD'
          }
        }, 200, corsHeaders);
      }

      if (path === '/api/payments/subscription-status' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            plan: 'free',
            status: 'active',
            expiresAt: null
          }
        }, 200, corsHeaders);
      }

      // Follows endpoints
      if (path.startsWith('/api/follows/followers') && method === 'GET') {
        const creatorId = url.searchParams.get('creatorId');
        return jsonResponse({
          success: true,
          data: {
            followers: [
              { id: '1', name: 'Sarah Investor', userType: 'investor', followedAt: new Date().toISOString() },
              { id: '2', name: 'Mike Producer', userType: 'production', followedAt: new Date().toISOString() }
            ],
            total: 2
          }
        }, 200, corsHeaders);
      }

      if (path === '/api/follows/following' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            following: [
              { id: '3', name: 'Top Creator', userType: 'creator', followedAt: new Date().toISOString() }
            ],
            total: 1
          }
        }, 200, corsHeaders);
      }

      // Creator funding overview
      if (path === '/api/creator/funding/overview' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            totalRaised: 50000,
            activeInvestors: 3,
            pendingRequests: 2,
            recentActivity: [
              { type: 'investment', amount: 10000, investor: 'Sarah Investor', date: new Date().toISOString() }
            ]
          }
        }, 200, corsHeaders);
      }

      // Analytics endpoint
      if (path.startsWith('/api/analytics/user') && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            views: {
              total: 1250,
              trend: '+12%',
              data: [100, 120, 150, 200, 180, 220, 280]
            },
            engagement: {
              likes: 48,
              shares: 12,
              comments: 23
            },
            topPerformers: [
              { title: 'The Next Blockbuster', views: 450 },
              { title: 'Epic Adventure', views: 320 }
            ]
          }
        }, 200, corsHeaders);
      }

      // NDA endpoints
      if (path.startsWith('/api/ndas') && method === 'GET') {
        const status = url.searchParams.get('status');
        const creatorId = url.searchParams.get('creatorId');
        
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              pitchId: '1',
              pitchTitle: 'The Next Blockbuster',
              requesterId: '2',
              requesterName: 'Sarah Investor',
              status: status || 'pending',
              requestedAt: new Date().toISOString()
            },
            {
              id: '2',
              pitchId: '2',
              pitchTitle: 'Epic Adventure',
              requesterId: '3',
              requesterName: 'Mike Producer',
              status: status || 'pending',
              requestedAt: new Date(Date.now() - 24*60*60*1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Profile endpoint - Support both /api/profile and /api/users/profile
      if ((path === '/api/profile' || path === '/api/users/profile') && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            id: '2',
            email: 'sarah.investor@demo.com',
            name: 'Sarah Johnson',
            userType: 'investor',
            profile: {
              bio: 'Experienced investor specializing in film and media projects',
              avatar: null,
              createdAt: new Date().toISOString()
            }
          }
        }, 200, corsHeaders);
      }

      // Investor portfolio summary
      if (path === '/api/investor/portfolio/summary' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            totalInvestments: 5,
            totalAmount: 250000,
            activeProjects: 3,
            completedProjects: 2,
            roi: 15.5,
            portfolioBreakdown: {
              drama: 40,
              action: 30,
              comedy: 20,
              other: 10
            }
          }
        }, 200, corsHeaders);
      }

      // Investor investments
      if (path === '/api/investor/investments' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              pitchId: '1',
              pitchTitle: 'The Next Blockbuster',
              amount: 50000,
              investedAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
              status: 'active',
              roi: 0
            },
            {
              id: '2',
              pitchId: '3',
              pitchTitle: 'Epic Adventure',
              amount: 75000,
              investedAt: new Date(Date.now() - 60*24*60*60*1000).toISOString(),
              status: 'active',
              roi: 8.5
            }
          ]
        }, 200, corsHeaders);
      }

      // Investment recommendations
      if (path === '/api/investment/recommendations' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              title: 'Sci-Fi Thriller',
              genre: 'Sci-Fi',
              budgetRange: '$5M - $20M',
              expectedROI: '25%',
              riskLevel: 'medium',
              matchScore: 85,
              reason: 'Matches your investment profile and genre preferences'
            },
            {
              id: '2',
              title: 'Drama Series',
              genre: 'Drama',
              budgetRange: '$2M - $10M',
              expectedROI: '18%',
              riskLevel: 'low',
              matchScore: 78,
              reason: 'Strong team with proven track record'
            }
          ]
        }, 200, corsHeaders);
      }

      // Active NDAs
      if (path === '/api/nda/active' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              pitchId: '1',
              pitchTitle: 'The Next Blockbuster',
              signedAt: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
              expiresAt: new Date(Date.now() + 83*24*60*60*1000).toISOString(),
              status: 'active'
            },
            {
              id: '2',
              pitchId: '3',
              pitchTitle: 'Epic Adventure',
              signedAt: new Date(Date.now() - 14*24*60*60*1000).toISOString(),
              expiresAt: new Date(Date.now() + 76*24*60*60*1000).toISOString(),
              status: 'active'
            }
          ]
        }, 200, corsHeaders);
      }

      // Saved pitches
      if (path === '/api/saved-pitches' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              pitchId: '2',
              title: 'Trending Drama',
              genre: 'Drama',
              logline: 'An emotional journey that captivates audiences',
              savedAt: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
              hasNDA: false
            },
            {
              id: '2',
              pitchId: '4',
              title: 'Fresh New Comedy',
              genre: 'Comedy',
              logline: 'A hilarious take on modern life',
              savedAt: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
              hasNDA: false
            },
            {
              id: '3',
              pitchId: '1',
              title: 'The Next Blockbuster',
              genre: 'Action',
              logline: 'An action-packed adventure',
              savedAt: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
              hasNDA: true
            }
          ]
        }, 200, corsHeaders);
      }

      // Notifications
      if (path === '/api/notifications' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: '1',
              type: 'nda_approved',
              title: 'NDA Approved',
              message: 'Your NDA request for "The Next Blockbuster" has been approved',
              read: false,
              createdAt: new Date(Date.now() - 2*60*60*1000).toISOString()
            },
            {
              id: '2',
              type: 'new_pitch',
              title: 'New Pitch Match',
              message: 'A new pitch matching your interests has been published',
              read: false,
              createdAt: new Date(Date.now() - 5*60*60*1000).toISOString()
            },
            {
              id: '3',
              type: 'investment_update',
              title: 'Investment Update',
              message: 'Your investment in "Epic Adventure" has reached a new milestone',
              read: true,
              createdAt: new Date(Date.now() - 24*60*60*1000).toISOString()
            }
          ]
        }, 200, corsHeaders);
      }

      // Unread notifications count
      if (path === '/api/notifications/unread' && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            count: 2 // Count of unread notifications
          }
        }, 200, corsHeaders);
      }

      // Default API response
      return jsonResponse({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${path} not implemented yet`
        }
      }, 404, corsHeaders);
    }

    return new Response('Not Found', { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const handler = new PitcheyAPIHandler(env);
      return await handler.handleRequest(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
};