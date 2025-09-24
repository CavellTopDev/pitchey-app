import { Application, Router, Context, Status } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Import services - commented out for demo mode
// Database imports are disabled for demo deployment
// import { UserService } from "./src/services/userService.ts";
// import { PitchService } from "./src/services/pitch.service.ts";
// import { NDAService } from "./src/services/ndaService.ts";
// import { AuthService } from "./src/services/auth.service.ts";
// import { MessageService } from "./src/services/message.service.ts";
// import { AnalyticsService } from "./src/services/analytics.service.ts";
// import { StripeService } from "./src/services/stripe.service.ts";

// Demo mode - no database dependencies
const PitchService = { 
  createPitch: () => ({ id: Date.now(), title: "New Pitch", status: "draft" }),
  updatePitch: () => ({ id: 1, title: "Updated Pitch", status: "active" }),
  deletePitch: () => {},
  getAllPitches: () => [],
  getPitchesByUser: () => [],
  getPitch: () => null,
  getCreatorDashboard: () => ({ pitches: [], stats: {} })
};
const UserService = { getUserById: () => null };
const NDAService = { createNDA: () => {}, signNDA: () => {} };
const MessageService = { sendMessage: () => {} };
const AnalyticsService = { 
  trackEvent: () => {},
  getPitchAnalytics: () => ({}),
  getUserAnalytics: () => ({})
};
const StripeService = { 
  createPaymentIntent: () => {},
  getUserCredits: () => ({ credits: 100, tier: "free" }),
  getSubscriptionStatus: () => ({ status: "active", tier: "free", creditsRemaining: 100 })
};
const AuthService = {
  register: () => null,
  login: () => null,
  logout: () => {},
  verifySession: () => null,
  initiatePasswordReset: () => ({ success: true }),
  resetPassword: () => ({ success: true }),
  verifyEmail: () => ({ success: true })
};

const app = new Application();
const router = new Router();

const PORT = Number(Deno.env.get("PORT") || 8000);
const JWT_SECRET = Deno.env.get("JWT_SECRET") || 
  "super-secret-jwt-key-for-production-change-this-to-something-secure-at-least-32-chars";

// JWT key for verification
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

// Demo accounts
const demoAccounts = {
  creator: {
    id: 1001,
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    userType: "creator",
    companyName: "Independent Films"
  },
  investor: {
    id: 1002,
    email: "sarah.investor@demo.com",
    username: "sarahinvestor",
    password: "Demo123",
    userType: "investor",
    companyName: "Venture Capital Films"
  },
  production: {
    id: 1003,
    email: "stellar.production@demo.com",
    username: "stellarprod",
    password: "Demo123",
    userType: "production",
    companyName: "Stellar Productions"
  }
};

// Authentication middleware using session tokens (unified approach)
async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = Status.Unauthorized;
    ctx.response.body = { error: "No authorization header" };
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    // Direct JWT verification for demo mode
    const payload = await verify(token, key);
    const userId = payload.userId as number || payload.user_id as number || payload.id as number;
    
    // Check if it's a demo account
    if (userId >= 1001 && userId <= 1003) {
      const demoUser = Object.values(demoAccounts).find(u => u.id === userId);
      if (demoUser) {
        ctx.state.user = {
          id: demoUser.id,
          email: demoUser.email,
          username: demoUser.username,
          userType: demoUser.userType,
          companyName: demoUser.companyName
        };
        await next();
        return;
      }
    }
    
    // Try direct user lookup from DB
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (user) {
        ctx.state.user = user;
        await next();
        return;
      }
    } catch (error) {
      console.error("Database lookup error:", error);
    }
    
    ctx.response.status = Status.Unauthorized;
    ctx.response.body = { error: "User not found" };
    
  } catch (error) {
    console.error("Token verification error:", error);
    ctx.response.status = Status.Unauthorized;
    ctx.response.body = { error: "Invalid token" };
  }
}

// Optional auth middleware (allows anonymous access)
async function optionalAuthMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get("Authorization");
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    try {
      // Try session verification first
      const sessionResult = await AuthService.verifySession(token);
      
      if (sessionResult && sessionResult.user) {
        ctx.state.user = sessionResult.user;
      } else {
        // Fallback to JWT verification for demo accounts
        const payload = await verify(token, key);
        const userId = payload.userId as number || payload.user_id as number || payload.id as number;
        
        if (userId >= 1001 && userId <= 1003) {
          const demoUser = Object.values(demoAccounts).find(u => u.id === userId);
          if (demoUser) {
            ctx.state.user = {
              id: demoUser.id,
              email: demoUser.email,
              username: demoUser.username,
              userType: demoUser.userType,
              companyName: demoUser.companyName
            };
          }
        }
      }
    } catch (error) {
      // Continue without user context
      console.log("Optional auth failed, continuing without user context");
    }
  }
  
  await next();
}

// Generate JWT token (for demo accounts compatibility)
async function generateToken(userId: number, email: string, userType: string) {
  const token = await create({ alg: "HS256", typ: "JWT" }, {
    userId,
    email,
    role: userType, // Keep 'role' for compatibility
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  }, key);
  
  return token;
}

// ===== ROUTES =====

// Health check
router.get("/", (ctx) => {
  ctx.response.body = { 
    success: true, 
    message: "Pitchey API Server",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  };
});

router.get("/health", (ctx) => {
  ctx.response.body = { 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString()
  };
});

// ===== AUTHENTICATION ROUTES =====

// Registration endpoints
router.post("/api/auth/register", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const result = await AuthService.register(body);
    
    ctx.response.body = {
      success: true,
      message: "Registration successful. Please check your email for verification.",
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        userType: result.user.userType,
        emailVerified: result.user.emailVerified
      },
      token: result.session.token
    };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// Portal-specific login endpoints (existing)
router.post("/api/auth/creator/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
  
  console.log(`Creator login attempt: ${email}`);
  
  // Try database first
  try {
    const result = await AuthService.login({ email, password });
    if (result?.user?.userType === 'creator') {
      ctx.response.body = {
        success: true,
        token: result.session.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim(),
          role: "creator",
          userType: "creator",
          companyName: result.user.companyName,
          createdAt: result.user.createdAt
        }
      };
      return;
    }
  } catch (error) {
    console.log("Database auth failed, trying demo account");
  }
  
  // Check demo account (accept case variations for demo)
  const validPasswords = ["Demo123", "demo123", "Demo@123", "demo@123"];
  if (email?.toLowerCase() === demoAccounts.creator.email && validPasswords.includes(password)) {
    const token = await generateToken(demoAccounts.creator.id, email, "creator");
    
    ctx.response.body = {
      success: true,
      token,
      user: {
        id: demoAccounts.creator.id.toString(),
        email,
        username: demoAccounts.creator.username,
        name: "Alex Filmmaker",
        role: "creator",
        userType: "creator",
        companyName: demoAccounts.creator.companyName,
        createdAt: new Date().toISOString()
      }
    };
    return;
  }
  
  ctx.response.status = Status.Unauthorized;
  ctx.response.body = { error: "Invalid credentials" };
});

router.post("/api/auth/investor/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
  
  // Try database first
  try {
    const result = await AuthService.login({ email, password });
    if (result?.user?.userType === 'investor') {
      ctx.response.body = {
        success: true,
        token: result.session.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim(),
          role: "investor",
          userType: "investor",
          companyName: result.user.companyName,
          createdAt: result.user.createdAt
        }
      };
      return;
    }
  } catch (error) {
    console.log("Database auth failed, trying demo account");
  }
  
  // Check demo account (accept case variations for demo)
  const validPasswords = ["Demo123", "demo123", "Demo@123", "demo@123"];
  if (email?.toLowerCase() === demoAccounts.investor.email && validPasswords.includes(password)) {
    const token = await generateToken(demoAccounts.investor.id, email, "investor");
    
    ctx.response.body = {
      success: true,
      token,
      user: {
        id: demoAccounts.investor.id.toString(),
        email,
        username: demoAccounts.investor.username,
        name: "Sarah Investor",
        role: "investor",
        userType: "investor",
        companyName: demoAccounts.investor.companyName,
        createdAt: new Date().toISOString()
      }
    };
    return;
  }
  
  ctx.response.status = Status.Unauthorized;
  ctx.response.body = { error: "Invalid credentials" };
});

router.post("/api/auth/production/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
  
  // Try database first
  try {
    const result = await AuthService.login({ email, password });
    if (result?.user?.userType === 'production') {
      ctx.response.body = {
        success: true,
        token: result.session.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim(),
          role: "production",
          userType: "production",
          companyName: result.user.companyName,
          createdAt: result.user.createdAt
        }
      };
      return;
    }
  } catch (error) {
    console.log("Database auth failed, trying demo account");
  }
  
  // Check demo account (accept case variations for demo)
  const validPasswords = ["Demo123", "demo123", "Demo@123", "demo@123"];
  if (email?.toLowerCase() === demoAccounts.production.email && validPasswords.includes(password)) {
    const token = await generateToken(demoAccounts.production.id, email, "production");
    
    ctx.response.body = {
      success: true,
      token,
      user: {
        id: demoAccounts.production.id.toString(),
        email,
        username: demoAccounts.production.username,
        name: "Stellar Productions",
        role: "production",
        userType: "production",
        companyName: demoAccounts.production.companyName,
        createdAt: new Date().toISOString()
      }
    };
    return;
  }
  
  ctx.response.status = Status.Unauthorized;
  ctx.response.body = { error: "Invalid credentials" };
});

// General login endpoint
router.post("/api/auth/login", async (ctx) => {
  const body = await ctx.request.body({ type: "json" }).value;
  const { email, password } = body;
  
  // Check demo accounts
  const validPasswords = ["Demo123", "demo123", "Demo@123", "demo@123"];
  const emailLower = email?.toLowerCase();
  
  let demoUser = null;
  if (emailLower === demoAccounts.creator.email && validPasswords.includes(password)) {
    demoUser = demoAccounts.creator;
  } else if (emailLower === demoAccounts.investor.email && validPasswords.includes(password)) {
    demoUser = demoAccounts.investor;
  } else if (emailLower === demoAccounts.production.email && validPasswords.includes(password)) {
    demoUser = demoAccounts.production;
  }
  
  if (demoUser) {
    const token = await generateToken(demoUser.id, email, demoUser.userType);
    ctx.response.body = {
      success: true,
      token,
      user: {
        id: demoUser.id.toString(),
        email,
        username: demoUser.username,
        name: demoUser.userType === 'creator' ? "Alex Filmmaker" :
              demoUser.userType === 'investor' ? "Sarah Chen" : "John Producer",
        role: demoUser.userType,
        userType: demoUser.userType,
        companyName: demoUser.companyName,
        createdAt: new Date().toISOString()
      }
    };
    return;
  }
  
  // Try database if available
  try {
    const result = await AuthService.login(body);
    if (result) {
      ctx.response.body = {
        success: true,
        token: result.session.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim(),
          role: result.user.userType,
          userType: result.user.userType,
          companyName: result.user.companyName,
          createdAt: result.user.createdAt
        }
      };
      return;
    }
  } catch (error) {
    console.log("Database login failed:", error);
  }
  
  ctx.response.status = Status.Unauthorized;
  ctx.response.body = { error: "Invalid credentials" };
});

// Logout endpoint
router.post("/api/auth/logout", authMiddleware, async (ctx) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    const token = authHeader?.substring(7);
    
    if (token) {
      await AuthService.logout(token);
    }
    
    ctx.response.body = { success: true, message: "Logged out successfully" };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Logout failed" };
  }
});

// Password reset endpoints
router.post("/api/auth/forgot-password", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const result = await AuthService.initiatePasswordReset(body.email);
    
    ctx.response.body = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent."
    };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.post("/api/auth/reset-password", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const result = await AuthService.resetPassword(body.token, body.password);
    
    ctx.response.body = {
      success: true,
      message: "Password reset successfully"
    };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// Email verification endpoint
router.post("/api/auth/verify-email", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const result = await AuthService.verifyEmail(body.token);
    
    ctx.response.body = {
      success: true,
      message: "Email verified successfully"
    };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// ===== PROFILE ROUTES =====

router.get("/api/profile", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  // Return user profile based on whether it's from DB or demo
  if (user.id >= 1001 && user.id <= 1003) {
    // Demo account
    ctx.response.body = {
      success: true,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        name: user.userType === "creator" ? "Alex Filmmaker" : 
              user.userType === "investor" ? "Sarah Investor" :
              "Stellar Productions",
        role: user.userType,
        userType: user.userType,
        companyName: user.companyName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
        bio: "Demo account user",
        createdAt: new Date().toISOString()
      }
    };
  } else {
    // Database user
    try {
      const userProfile = await UserService.getUserProfile(user.id);
      ctx.response.body = { success: true, user: userProfile };
    } catch (error) {
      ctx.response.status = Status.InternalServerError;
      ctx.response.body = { error: "Failed to fetch profile" };
    }
  }
});

router.put("/api/profile", authMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const updatedUser = await UserService.updateProfile(user.id, body);
    
    ctx.response.body = {
      success: true,
      user: updatedUser
    };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// Add /api/users/profile endpoint (alias for /api/profile for frontend compatibility)
router.get("/api/users/profile", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  // Return user profile based on whether it's from DB or demo
  if (user.id >= 1001 && user.id <= 1003) {
    // Demo account
    ctx.response.body = {
      success: true,
      user: {
        id: user.id.toString(),
        email: user.email,
        username: user.username,
        name: user.userType === "creator" ? "Alex Filmmaker" : 
              user.userType === "investor" ? "Sarah Investor" :
              "Stellar Productions",
        role: user.userType,
        userType: user.userType,
        companyName: user.companyName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
        bio: "Demo account user",
        createdAt: new Date().toISOString()
      }
    };
  } else {
    // Database user
    try {
      const userProfile = await UserService.getUserProfile(user.id);
      ctx.response.body = { success: true, user: userProfile };
    } catch (error) {
      ctx.response.status = Status.InternalServerError;
      ctx.response.body = { error: "Failed to fetch profile" };
    }
  }
});

// ===== PORTFOLIO ROUTES =====

// Get creator portfolio - public endpoint
router.get("/api/creator/portfolio/:creatorId", async (ctx) => {
  const creatorId = ctx.params.creatorId;
  
  // Mock portfolio data for demo
  const portfolioData = {
    success: true,
    creator: {
      id: creatorId,
      name: "Alex Filmmaker",
      username: "alexfilmmaker",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=alexfilmmaker`,
      bio: "Award-winning filmmaker specializing in sci-fi and drama. Creator of 'The Last Frontier' and 'Digital Dreams'.",
      location: "Los Angeles, CA",
      joinedDate: "January 2024",
      verified: true,
      stats: {
        totalPitches: 5,
        totalViews: 15420,
        totalFollowers: 892,
        avgRating: 4.7
      },
      socialLinks: {
        website: "https://alexfilmmaker.com",
        twitter: "@alexfilmmaker",
        linkedin: "alexfilmmaker"
      }
    },
    pitches: [
      {
        id: "1",
        title: "The Last Frontier",
        tagline: "In a world where Mars is humanity's last hope",
        genre: "Sci-Fi Drama",
        thumbnail: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400",
        views: 8234,
        rating: 4.8,
        status: "In Development",
        budget: "$5M",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: "A gripping tale of the first colony on Mars facing an existential threat that could end humanity's expansion into space."
      },
      {
        id: "2",
        title: "Digital Dreams",
        tagline: "When AI becomes too human",
        genre: "Psychological Thriller",
        thumbnail: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400",
        views: 6432,
        rating: 4.6,
        status: "Seeking Funding",
        budget: "$3M",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        description: "A psychological thriller exploring the blurred lines between human consciousness and artificial intelligence."
      },
      {
        id: "3",
        title: "City Lights",
        tagline: "Love in the time of neon",
        genre: "Neo-Noir Romance",
        thumbnail: "https://images.unsplash.com/photo-1514565131-fce0801e3485?w=400",
        views: 754,
        rating: 4.5,
        status: "Pre-Production",
        budget: "$2M",
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        description: "A neo-noir romance set in the underbelly of a cyberpunk metropolis."
      }
    ],
    achievements: [
      {
        icon: "🏆",
        title: "Best Director",
        event: "Sundance Film Festival 2023",
        year: "2023"
      },
      {
        icon: "🎬",
        title: "Audience Choice Award",
        event: "Cannes Film Festival",
        year: "2022"
      },
      {
        icon: "⭐",
        title: "Rising Star",
        event: "Hollywood Reporter",
        year: "2021"
      }
    ]
  };
  
  ctx.response.body = portfolioData;
});

// Get creator portfolio for authenticated user
router.get("/api/creator/portfolio", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  if (user.userType !== "creator") {
    ctx.response.status = Status.Forbidden;
    ctx.response.body = { error: "Only creators can access their portfolio" };
    return;
  }
  
  // Return portfolio for the authenticated creator
  const portfolioData = {
    success: true,
    creator: {
      id: user.id.toString(),
      name: user.name || "Alex Filmmaker",
      username: user.username,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
      bio: "Award-winning filmmaker specializing in sci-fi and drama.",
      location: "Los Angeles, CA",
      joinedDate: "January 2024",
      verified: true,
      stats: {
        totalPitches: 5,
        totalViews: 15420,
        totalFollowers: 892,
        avgRating: 4.7
      }
    },
    pitches: [
      {
        id: "1",
        title: "The Last Frontier",
        tagline: "In a world where Mars is humanity's last hope",
        genre: "Sci-Fi Drama",
        thumbnail: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400",
        views: 8234,
        rating: 4.8,
        status: "In Development",
        budget: "$5M",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "2", 
        title: "Digital Dreams",
        tagline: "When AI becomes too human",
        genre: "Psychological Thriller",
        thumbnail: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400",
        views: 6432,
        rating: 4.6,
        status: "Seeking Funding",
        budget: "$3M",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  };
  
  ctx.response.body = portfolioData;
});

// ===== DASHBOARD ROUTES =====

router.get("/api/creator/dashboard", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  if (user.userType !== "creator") {
    ctx.response.status = Status.Forbidden;
    ctx.response.body = { error: "Creator access required" };
    return;
  }
  
  try {
    // Get real dashboard data for non-demo users
    if (user.id < 1001 || user.id > 1003) {
      const dashboardData = await PitchService.getCreatorDashboard(user.id);
      ctx.response.body = { success: true, data: dashboardData };
      return;
    }
    
    // Demo data
    ctx.response.body = {
      success: true,
      data: {
        stats: {
          totalPitches: 3,
          totalViews: 1250,
          totalLikes: 89,
          activeNDAs: 5
        },
        recentActivity: [
          {
            id: 1,
            type: "view",
            title: "New Pitch View",
            description: "Sarah Investor viewed 'The Last Frontier'",
            icon: "eye",
            color: "blue",
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 2,
            type: "nda",
            title: "NDA Signed",
            description: "Production House signed NDA for 'Urban Legends'",
            icon: "shield",
            color: "green",
            timestamp: new Date(Date.now() - 7200000).toISOString()
          },
          {
            id: 3,
            type: "follow",
            title: "New Follower",
            description: "Michael Ross started following you",
            icon: "user-plus",
            color: "purple",
            timestamp: new Date(Date.now() - 10800000).toISOString()
          },
          {
            id: 4,
            type: "pitch",
            title: "Pitch Published",
            description: "Your pitch 'Quantum Hearts' is now live",
            icon: "film",
            color: "indigo",
            timestamp: new Date(Date.now() - 14400000).toISOString()
          }
        ],
        pitches: [],
        socialStats: {
          followers: 124,
          following: 89,
          connections: 42
        },
        credits: {
          remaining: 100,
          total: 100
        }
      }
    };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch dashboard data" };
  }
});

router.get("/api/investor/dashboard", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  if (user.userType !== "investor") {
    ctx.response.status = Status.Forbidden;
    ctx.response.body = { error: "Investor access required" };
    return;
  }
  
  ctx.response.body = {
    success: true,
    data: {
      stats: {
        pitchesViewed: 45,
        ndasSigned: 12,
        savedPitches: 8,
        messagesReceived: 23
      },
      recommendations: [],
      recentActivity: [],
      pitches: []
    }
  };
});

router.get("/api/production/dashboard", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  if (user.userType !== "production") {
    ctx.response.status = Status.Forbidden;
    ctx.response.body = { error: "Production access required" };
    return;
  }
  
  ctx.response.body = {
    success: true,
    data: {
      stats: {
        projectsInDevelopment: 5,
        pitchesUnderReview: 12,
        signedNDAs: 18,
        activeCollaborations: 3
      },
      projects: [],
      recentActivity: [],
      pitches: []
    }
  };
});

// ===== PITCH ROUTES =====

// Public endpoint for browsing pitches without authentication
router.get("/api/public/pitches", async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    // For now, return sample pitches
    const samplePitches = [
      {
        id: 1,
        title: "Quantum Hearts",
        logline: "A quantum physicist falls in love across parallel dimensions",
        genre: "Sci-Fi Romance",
        format: "Feature Film",
        budget: "$5M-$10M",
        thumbnail: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=300&fit=crop",
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexcreator",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
        },
        views: 1250,
        likes: 89,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        title: "The Last Comedian",
        logline: "In a world where humor is illegal, one comedian fights back",
        genre: "Dystopian Comedy",
        format: "TV Series",
        budget: "$2M-$5M",
        thumbnail: "https://images.unsplash.com/photo-1509909756405-be0199881695?w=400&h=300&fit=crop",
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexcreator",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
        },
        views: 856,
        likes: 67,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        title: "Echo Valley",
        logline: "A small town's dark secrets echo through generations",
        genre: "Mystery Thriller",
        format: "Limited Series",
        budget: "$10M-$20M",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop",
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexcreator",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
        },
        views: 2341,
        likes: 145,
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Paginate results
    const paginatedPitches = samplePitches.slice(offset, offset + limit);
    
    ctx.response.body = {
      success: true,
      pitches: paginatedPitches,
      total: samplePitches.length,
      limit,
      offset
    };
  } catch (error) {
    console.error("Error fetching public pitches:", error);
    ctx.response.body = {
      success: true,
      pitches: [],
      total: 0,
      limit: 20,
      offset: 0
    };
  }
});

router.get("/api/pitches", optionalAuthMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const searchParams = url.searchParams;
    
    // Parse query parameters
    const filters = {
      genre: searchParams.get("genre"),
      format: searchParams.get("format"),
      budget: searchParams.get("budget"),
      search: searchParams.get("search"),
      limit: parseInt(searchParams.get("limit") || "20"),
      offset: parseInt(searchParams.get("offset") || "0"),
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc"
    };
    
    const pitches = await PitchService.getAllPitches(filters, user?.id);
    ctx.response.body = { success: true, pitches };
  } catch (error) {
    console.error("Error fetching pitches:", error);
    ctx.response.body = { 
      success: true, 
      pitches: [] // Return empty array on error
    };
  }
});

router.get("/api/pitches/user/:userId", optionalAuthMiddleware, async (ctx) => {
  try {
    const { userId } = ctx.params;
    const pitches = await PitchService.getPitchesByUser(parseInt(userId));
    
    ctx.response.body = { success: true, pitches };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch user pitches" };
  }
});

router.get("/api/pitches/:id", optionalAuthMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const user = ctx.state.user;
  
  try {
    const pitch = await PitchService.getPitch(parseInt(id), user?.id);
    if (pitch) {
      ctx.response.body = { success: true, pitch };
    } else {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { error: "Pitch not found" };
    }
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch pitch" };
  }
});

router.post("/api/pitches", authMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    if (user.userType !== "creator") {
      ctx.response.status = Status.Forbidden;
      ctx.response.body = { error: "Only creators can create pitches" };
      return;
    }
    
    const pitch = await PitchService.createPitch({
      ...body,
      userId: user.id
    });
    
    ctx.response.status = Status.Created;
    ctx.response.body = { success: true, pitch };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.put("/api/pitches/:id", authMiddleware, async (ctx) => {
  try {
    const { id } = ctx.params;
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const pitch = await PitchService.updatePitch(parseInt(id), body, user.id);
    
    ctx.response.body = { success: true, pitch };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.delete("/api/pitches/:id", authMiddleware, async (ctx) => {
  try {
    const { id } = ctx.params;
    const user = ctx.state.user;
    
    await PitchService.deletePitch(parseInt(id), user.id);
    
    ctx.response.body = { success: true, message: "Pitch deleted successfully" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// Trending pitches endpoint
router.get("/api/trending", async (ctx) => {
  try {
    // Mock trending pitches data
    const trendingPitches = [
      {
        id: 1,
        title: "The Last Frontier",
        logline: "In a world where Mars is humanity's last hope",
        genre: "Sci-Fi",
        format: "feature",
        thumbnail: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400",
        views: 15234,
        likes: 892,
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexfilmmaker"
        },
        trending: true,
        trendingScore: 98
      },
      {
        id: 2,
        title: "Digital Dreams",
        logline: "When AI becomes too human",
        genre: "Thriller",
        format: "feature",
        thumbnail: "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400",
        views: 12456,
        likes: 743,
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexfilmmaker"
        },
        trending: true,
        trendingScore: 95
      },
      {
        id: 3,
        title: "City Lights",
        logline: "Love in the time of neon",
        genre: "Romance",
        format: "feature", 
        thumbnail: "https://images.unsplash.com/photo-1514565131-fce0801e3485?w=400",
        views: 9876,
        likes: 567,
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexfilmmaker"
        },
        trending: true,
        trendingScore: 89
      },
      {
        id: 4,
        title: "The Algorithm",
        logline: "Social media controls more than you think",
        genre: "Documentary",
        format: "feature",
        thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400",
        views: 8234,
        likes: 445,
        creator: {
          id: 1002,
          name: "Sarah Investor",
          username: "sarahinvestor"
        },
        trending: true,
        trendingScore: 85
      },
      {
        id: 5,
        title: "Quantum Paradox",
        logline: "Reality splits when the experiment goes wrong",
        genre: "Sci-Fi",
        format: "tv",
        thumbnail: "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=400",
        views: 7654,
        likes: 398,
        creator: {
          id: 1001,
          name: "Alex Filmmaker",
          username: "alexfilmmaker"
        },
        trending: true,
        trendingScore: 82
      }
    ];

    ctx.response.body = trendingPitches;
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "Failed to fetch trending pitches" 
    };
  }
});

// Public endpoint for browsing pitches (no auth required)
router.get("/api/public/pitches", async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const searchParams = url.searchParams;
    
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    // Sample public pitches for marketplace
    const samplePitches = [
      {
        id: 1,
        title: "Quantum Hearts",
        logline: "A quantum physicist falls in love across parallel dimensions, risking the fabric of reality for a chance at true love.",
        genre: "Sci-Fi Romance",
        budget: 5000000,
        stage: "Pre-Production",
        visibility: "public",
        created_at: "2024-01-15T10:00:00Z",
        creator: {
          id: 1,
          name: "Alex Rivera",
          company: "Quantum Films",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
        },
        stats: {
          views: 1250,
          likes: 89,
          nda_requests: 12
        }
      },
      {
        id: 2,
        title: "The Last Bookshop",
        logline: "In a digital future, the owner of Earth's last physical bookshop discovers books that predict the future.",
        genre: "Mystery Thriller",
        budget: 3000000,
        stage: "Script Development",
        visibility: "public",
        created_at: "2024-01-20T14:30:00Z",
        creator: {
          id: 2,
          name: "Morgan Chen",
          company: "Narrative Studios",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=morgan"
        },
        stats: {
          views: 890,
          likes: 67,
          nda_requests: 8
        }
      },
      {
        id: 3,
        title: "Echoes of Tomorrow",
        logline: "A sound engineer discovers they can hear conversations from the future through vintage recording equipment.",
        genre: "Supernatural Thriller",
        budget: 8000000,
        stage: "Funding",
        visibility: "public",
        created_at: "2024-01-22T09:15:00Z",
        creator: {
          id: 3,
          name: "Jamie Wilson",
          company: "Echo Productions",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jamie"
        },
        stats: {
          views: 2100,
          likes: 156,
          nda_requests: 23
        }
      }
    ];
    
    // Apply pagination
    const paginatedPitches = samplePitches.slice(offset, offset + limit);
    
    ctx.response.body = {
      success: true,
      pitches: paginatedPitches,
      total: samplePitches.length,
      page,
      limit
    };
  } catch (error) {
    console.error("Error fetching public pitches:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch pitches" };
  }
});

// ===== NDA ROUTES =====

router.get("/api/ndas", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const ndas = await NDAService.getUserNDAs(user.id);
    
    ctx.response.body = { success: true, ndas };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch NDAs" };
  }
});

router.post("/api/ndas/request", authMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const request = await NDAService.requestNDA({
      ...body,
      requesterId: user.id
    });
    
    ctx.response.status = Status.Created;
    ctx.response.body = { success: true, request };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.post("/api/ndas/approve/:requestId", authMiddleware, async (ctx) => {
  try {
    const { requestId } = ctx.params;
    const user = ctx.state.user;
    
    const nda = await NDAService.approveNDARequest(parseInt(requestId), user.id);
    
    ctx.response.body = { success: true, nda };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.post("/api/ndas/reject/:requestId", authMiddleware, async (ctx) => {
  try {
    const { requestId } = ctx.params;
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    await NDAService.rejectNDARequest(parseInt(requestId), user.id, body.reason);
    
    ctx.response.body = { success: true, message: "NDA request rejected" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.post("/api/ndas/sign/:ndaId", authMiddleware, async (ctx) => {
  try {
    const { ndaId } = ctx.params;
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const signedNDA = await NDAService.signNDA(parseInt(ndaId), user.id, body.signatureData);
    
    ctx.response.body = { success: true, nda: signedNDA };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// ===== MESSAGING ROUTES =====

router.get("/api/messages", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const conversationId = url.searchParams.get("conversationId");
    
    let messages;
    if (conversationId) {
      messages = await MessageService.getConversationMessages(parseInt(conversationId), user.id);
    } else {
      messages = await MessageService.getUserMessages(user.id);
    }
    
    ctx.response.body = { success: true, messages };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch messages" };
  }
});

router.get("/api/conversations", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const conversations = await MessageService.getUserConversations(user.id);
    
    ctx.response.body = { success: true, conversations };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch conversations" };
  }
});

router.post("/api/messages", authMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const message = await MessageService.sendMessage({
      ...body,
      senderId: user.id
    });
    
    ctx.response.status = Status.Created;
    ctx.response.body = { success: true, message };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.put("/api/messages/:id/read", authMiddleware, async (ctx) => {
  try {
    const { id } = ctx.params;
    const user = ctx.state.user;
    
    await MessageService.markMessageAsRead(parseInt(id), user.id);
    
    ctx.response.body = { success: true, message: "Message marked as read" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// ===== SOCIAL FEATURES ROUTES =====

router.post("/api/follow/:targetId", authMiddleware, async (ctx) => {
  try {
    const { targetId } = ctx.params;
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    // Follow pitch or creator
    const result = await db.insert(follows).values({
      followerId: user.id,
      pitchId: body.type === 'pitch' ? parseInt(targetId) : null,
      creatorId: body.type === 'creator' ? parseInt(targetId) : null,
    }).returning();
    
    ctx.response.body = { success: true, follow: result[0] };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.delete("/api/follow/:targetId", authMiddleware, async (ctx) => {
  try {
    const { targetId } = ctx.params;
    const url = new URL(ctx.request.url);
    const type = url.searchParams.get("type"); // 'pitch' or 'creator'
    const user = ctx.state.user;
    
    const whereClause = type === 'pitch' 
      ? and(eq(follows.followerId, user.id), eq(follows.pitchId, parseInt(targetId)))
      : and(eq(follows.followerId, user.id), eq(follows.creatorId, parseInt(targetId)));
    
    await db.delete(follows).where(whereClause);
    
    ctx.response.body = { success: true, message: "Unfollowed successfully" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.get("/api/follows", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    
    // Demo follows data
    const demoFollows = {
      followers: user.userType === 'creator' ? [
        {
          id: 2,
          name: "Sarah Chen",
          email: "sarah.investor@demo.com",
          type: "investor",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
          followedAt: "2024-01-20T10:00:00Z"
        },
        {
          id: 3,
          name: "Michael Ross",
          email: "michael.investor@demo.com",
          type: "investor",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
          followedAt: "2024-01-22T15:30:00Z"
        }
      ] : [],
      following: user.userType === 'investor' ? [
        {
          id: 1,
          name: "Alex Rivera",
          email: "alex.creator@demo.com",
          type: "creator",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
          followedAt: "2024-01-15T08:00:00Z"
        },
        {
          id: 4,
          name: "Jordan Taylor",
          email: "jordan.creator@demo.com",
          type: "creator",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jordan",
          followedAt: "2024-01-18T12:00:00Z"
        }
      ] : [],
      pitchesFollowing: user.userType === 'investor' ? [
        {
          id: 1,
          title: "Quantum Hearts",
          creator: "Alex Rivera",
          followedAt: "2024-01-16T09:00:00Z"
        },
        {
          id: 2,
          title: "The Last Bookshop",
          creator: "Morgan Chen",
          followedAt: "2024-01-21T14:00:00Z"
        }
      ] : []
    };
    
    ctx.response.body = { 
      success: true, 
      follows: demoFollows,
      stats: {
        totalFollowers: demoFollows.followers.length,
        totalFollowing: demoFollows.following.length,
        pitchesFollowing: demoFollows.pitchesFollowing.length
      }
    };
  } catch (error) {
    console.error("Error fetching follows:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch follows" };
  }
});

// Investor following endpoint
router.get("/api/investor/following", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const tab = url.searchParams.get("tab") || "all";
    
    // Demo following data for investors
    const followingData = {
      activity: tab === "activity" ? [
        {
          id: 1,
          type: "new_pitch",
          title: "Quantum Hearts",
          logline: "A quantum physicist falls in love across parallel dimensions, risking the fabric of reality for a chance at true love.",
          genre: "Sci-Fi Romance",
          format: "Feature Film",
          shortSynopsis: "When Dr. Sarah Chen discovers a way to communicate across parallel dimensions...",
          titleImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
          viewCount: 1250,
          likeCount: 89,
          ndaCount: 12,
          status: "active",
          publishedAt: "2024-01-25T10:00:00Z",
          createdAt: "2024-01-15T10:00:00Z",
          timeAgo: "2 hours ago",
          creator: {
            id: 1,
            username: "alexrivera",
            firstName: "Alex",
            lastName: "Rivera",
            userType: "creator",
            companyName: "Quantum Films",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
            bio: "Filmmaker focused on sci-fi narratives",
            location: "Los Angeles, CA"
          }
        },
        {
          id: 2,
          type: "new_pitch",
          title: "The Last Bookshop",
          logline: "In a digital future, the owner of Earth's last physical bookshop discovers books that predict the future.",
          genre: "Mystery Thriller",
          format: "Limited Series",
          shortSynopsis: "In 2075, physical books are relics of the past...",
          titleImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800",
          viewCount: 890,
          likeCount: 67,
          ndaCount: 8,
          status: "active",
          publishedAt: "2024-01-24T15:30:00Z",
          createdAt: "2024-01-20T14:30:00Z",
          timeAgo: "1 day ago",
          creator: {
            id: 2,
            username: "morganchen",
            firstName: "Morgan",
            lastName: "Chen",
            userType: "creator",
            companyName: "Narrative Studios",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=morgan",
            bio: "Mystery and thriller specialist",
            location: "New York, NY"
          }
        }
      ] : [],
      creators: user.userType === 'investor' ? [
        {
          id: 1,
          name: "Alex Rivera",
          email: "alex.creator@demo.com",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
          pitchCount: 3,
          followedAt: "2024-01-15T08:00:00Z"
        },
        {
          id: 4,
          name: "Jordan Taylor",
          email: "jordan.creator@demo.com",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jordan",
          pitchCount: 2,
          followedAt: "2024-01-18T12:00:00Z"
        }
      ] : [],
      pitches: user.userType === 'investor' ? [
        {
          id: 1,
          title: "Quantum Hearts",
          creator: "Alex Rivera",
          stage: "Pre-Production",
          followedAt: "2024-01-16T09:00:00Z"
        },
        {
          id: 2,
          title: "The Last Bookshop",
          creator: "Morgan Chen",
          stage: "Script Development",
          followedAt: "2024-01-21T14:00:00Z"
        }
      ] : []
    };
    
    // Return data based on tab
    let responseData = {};
    switch(tab) {
      case 'activity':
        responseData = followingData.activity;
        break;
      case 'creators':
        responseData = followingData.creators;
        break;
      case 'pitches':
        responseData = followingData.pitches;
        break;
      default:
        responseData = followingData.activity; // Default to activity
    }
    
    ctx.response.body = { 
      success: true, 
      data: responseData,
      summary: {
        newPitches: followingData.pitches.length,
        activeCreators: followingData.creators.length,
        engagementRate: 85
      },
      stats: {
        totalActivity: followingData.activity.length,
        totalCreators: followingData.creators.length,
        totalPitches: followingData.pitches.length
      }
    };
  } catch (error) {
    console.error("Error fetching investor following:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch following data" };
  }
});

// Creator following endpoint (followers)
router.get("/api/creator/following", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const tab = url.searchParams.get("tab") || "all";
    
    // Demo follower data for creators  
    const followersData = {
      followers: user.userType === 'creator' ? [
        {
          id: 2,
          name: "Sarah Chen",
          email: "sarah.investor@demo.com",
          type: "investor",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
          followedAt: "2024-01-20T10:00:00Z"
        },
        {
          id: 3,
          name: "Michael Ross",
          email: "michael.investor@demo.com",
          type: "investor", 
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
          followedAt: "2024-01-22T15:30:00Z"
        },
        {
          id: 5,
          name: "Stellar Productions",
          email: "stellar.production@demo.com",
          type: "production",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=stellar",
          followedAt: "2024-01-23T11:00:00Z"
        }
      ] : [],
      activity: [
        {
          id: 1,
          type: "new_pitch",
          title: "Dark Horizons",
          logline: "A detective with amnesia must solve their own murder before time runs out.",
          genre: "Mystery Thriller",
          format: "Limited Series",
          shortSynopsis: "When Detective Morgan wakes up with no memory...",
          titleImage: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=800",
          viewCount: 890,
          likeCount: 67,
          ndaCount: 8,
          status: "active",
          publishedAt: "2024-01-24T14:00:00Z",
          createdAt: "2024-01-20T10:00:00Z",
          timeAgo: "1 day ago",
          creator: {
            id: 2,
            username: "sarahchen",
            firstName: "Sarah",
            lastName: "Chen",
            userType: "creator",
            companyName: "Chen Productions",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
            bio: "Mystery and thriller specialist",
            location: "New York, NY"
          }
        },
        {
          id: 2,
          type: "new_pitch",
          title: "The Garden of Time",
          logline: "A botanical garden exists outside of time, offering second chances to those who find it.",
          genre: "Fantasy Drama",
          format: "Feature Film",
          shortSynopsis: "Hidden in the heart of London, a mysterious garden...",
          titleImage: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800",
          viewCount: 1120,
          likeCount: 95,
          ndaCount: 15,
          status: "active",
          publishedAt: "2024-01-23T10:00:00Z",
          createdAt: "2024-01-18T10:00:00Z",
          timeAgo: "2 days ago",
          creator: {
            id: 3,
            username: "michaelross",
            firstName: "Michael",
            lastName: "Ross",
            userType: "creator",
            companyName: "Ross Studios",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
            bio: "Fantasy and drama storyteller",
            location: "London, UK"
          }
        }
      ],
      creators: [
        {
          id: 2,
          username: "sarahchen",
          firstName: "Sarah",
          lastName: "Chen",
          userType: "creator",
          companyName: "Chen Productions",
          profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
          bio: "Mystery and thriller specialist",
          location: "New York, NY",
          followers: 1250,
          pitchCount: 8,
          isFollowing: true
        }
      ],
      pitches: []
    };
    
    // Return data based on tab
    let responseData = {};
    switch(tab) {
      case 'followers':
        responseData = followersData.followers;
        break;
      case 'activity':
        responseData = followersData.activity;
        break;
      case 'creators':
        responseData = followersData.creators;
        break;
      case 'pitches':
        responseData = followersData.pitches;
        break;
      default:
        responseData = followersData.activity; // Default to activity
    }
    
    ctx.response.body = { 
      success: true,
      data: responseData,
      summary: {
        newPitches: 2,
        activeCreators: 1,
        engagementRate: 75
      },
      stats: {
        totalFollowers: followersData.followers.length,
        totalActivity: followersData.activity.length,
        totalCreators: followersData.creators.length
      }
    };
  } catch (error) {
    console.error("Error fetching creator following:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch following data" };
  }
});

// Production following endpoint
router.get("/api/production/following", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const tab = url.searchParams.get("tab") || "activity";
    
    // Demo following data for production companies
    const followingData = {
      activity: [
        {
          id: 1,
          type: "new_pitch",
          title: "Echoes of Tomorrow",
          logline: "A time-traveling journalist must prevent their own story from becoming history.",
          genre: "Sci-Fi Thriller",
          format: "Feature Film",
          shortSynopsis: "When journalist Emma discovers she can travel through time...",
          titleImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800",
          viewCount: 2100,
          likeCount: 189,
          ndaCount: 25,
          status: "active",
          publishedAt: "2024-01-25T08:00:00Z",
          createdAt: "2024-01-20T10:00:00Z",
          timeAgo: "3 hours ago",
          creator: {
            id: 4,
            username: "emmawilson",
            firstName: "Emma",
            lastName: "Wilson",
            userType: "creator",
            companyName: "Tomorrow Films",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
            bio: "Sci-fi and time travel narratives",
            location: "San Francisco, CA"
          }
        }
      ],
      creators: [
        {
          id: 1,
          username: "alexrivera",
          firstName: "Alex",
          lastName: "Rivera",
          userType: "creator",
          companyName: "Quantum Films",
          profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
          bio: "Filmmaker focused on sci-fi narratives",
          location: "Los Angeles, CA",
          followers: 3450,
          pitchCount: 12,
          isFollowing: true
        }
      ],
      pitches: [
        {
          id: 1,
          title: "Quantum Hearts",
          logline: "A quantum physicist falls in love across parallel dimensions",
          genre: "Sci-Fi Romance",
          format: "Feature Film",
          thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
          creator: {
            id: 1,
            name: "Alex Rivera",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
          },
          stats: {
            views: 1250,
            likes: 89,
            ndas: 12
          },
          createdAt: "2024-01-15T10:00:00Z",
          isFollowing: true
        }
      ]
    };
    
    // Return data based on tab
    let responseData = {};
    switch(tab) {
      case 'activity':
        responseData = followingData.activity;
        break;
      case 'creators':
        responseData = followingData.creators;
        break;
      case 'pitches':
        responseData = followingData.pitches;
        break;
      default:
        responseData = followingData.activity;
    }
    
    ctx.response.body = { 
      success: true,
      data: responseData,
      summary: {
        newPitches: followingData.pitches.length,
        activeCreators: followingData.creators.length,
        engagementRate: 92
      },
      stats: {
        totalActivity: followingData.activity.length,
        totalCreators: followingData.creators.length,
        totalPitches: followingData.pitches.length
      }
    };
  } catch (error) {
    console.error("Error fetching production following:", error);
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch following data" };
  }
});

// ===== ANALYTICS ROUTES =====

router.get("/api/analytics/pitch/:pitchId", authMiddleware, async (ctx) => {
  try {
    const { pitchId } = ctx.params;
    const user = ctx.state.user;
    
    const analytics = await AnalyticsService.getPitchAnalytics(parseInt(pitchId), user.id);
    
    ctx.response.body = { success: true, analytics };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.get("/api/analytics/dashboard", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const analytics = await AnalyticsService.getUserAnalytics(user.id);
    
    ctx.response.body = { success: true, analytics };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch analytics" };
  }
});

// ===== PAYMENT ROUTES =====

router.get("/api/payments/credits/balance", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    // For demo accounts, return mock data
    if (user.id >= 1001 && user.id <= 1003) {
      ctx.response.body = {
        success: true,
        balance: {
          credits: 100,
          tier: "free"
        }
      };
      return;
    }
    
    // For real users, get from database
    const balance = await StripeService.getUserCredits(user.id);
    ctx.response.body = { success: true, balance };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch credits balance" };
  }
});

router.get("/api/payments/subscription-status", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    // For demo accounts, return mock data
    if (user.id >= 1001 && user.id <= 1003) {
      ctx.response.body = {
        success: true,
        subscription: {
          status: "active",
          tier: "free",
          creditsRemaining: 100
        }
      };
      return;
    }
    
    const subscription = await StripeService.getSubscriptionStatus(user.id);
    ctx.response.body = { success: true, subscription };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch subscription status" };
  }
});

router.post("/api/payments/create-payment-intent", authMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const user = ctx.state.user;
    
    const paymentIntent = await StripeService.createPaymentIntent({
      userId: user.id,
      amount: body.amount,
      currency: body.currency || 'USD',
      type: body.type
    });
    
    ctx.response.body = { success: true, paymentIntent };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// ===== NOTIFICATION ROUTES =====

router.get("/api/notifications", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    const url = new URL(ctx.request.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    
    const whereClause = unreadOnly 
      ? and(eq(notifications.userId, user.id), eq(notifications.isRead, false))
      : eq(notifications.userId, user.id);
    
    const userNotifications = await db.query.notifications.findMany({
      where: whereClause,
      orderBy: desc(notifications.createdAt),
      limit: 50
    });
    
    ctx.response.body = { success: true, notifications: userNotifications };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch notifications" };
  }
});

router.put("/api/notifications/:id/read", authMiddleware, async (ctx) => {
  try {
    const { id } = ctx.params;
    const user = ctx.state.user;
    
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, parseInt(id)),
        eq(notifications.userId, user.id)
      ));
    
    ctx.response.body = { success: true, message: "Notification marked as read" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

router.put("/api/notifications/read-all", authMiddleware, async (ctx) => {
  try {
    const user = ctx.state.user;
    
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.isRead, false)
      ));
    
    ctx.response.body = { success: true, message: "All notifications marked as read" };
  } catch (error) {
    ctx.response.status = Status.BadRequest;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
});

// ===== ERROR HANDLING =====

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Server error:", err);
    const error = err as any;
    ctx.response.status = error.status || Status.InternalServerError;
    ctx.response.body = {
      error: error.message || "Internal server error"
    };
  }
});

// ===== MIDDLEWARE SETUP =====

// CORS configuration
app.use(oakCors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} - ${ms}ms`);
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// 404 handler
app.use((ctx) => {
  ctx.response.status = Status.NotFound;
  ctx.response.body = { 
    error: "Not found",
    path: ctx.request.url.pathname,
    method: ctx.request.method
  };
});

console.log(`🚀 Comprehensive Oak server running on http://localhost:${PORT}`);
console.log(`
📌 Authentication Endpoints:
   - POST /api/auth/register (all user types)
   - POST /api/auth/login (general login)
   - POST /api/auth/creator/login
   - POST /api/auth/investor/login  
   - POST /api/auth/production/login
   - POST /api/auth/logout
   - POST /api/auth/forgot-password
   - POST /api/auth/reset-password
   - POST /api/auth/verify-email

📌 Profile Endpoints:
   - GET /api/profile
   - PUT /api/profile

📌 Dashboard Endpoints:
   - GET /api/creator/dashboard
   - GET /api/investor/dashboard
   - GET /api/production/dashboard

📌 Pitch Endpoints:
   - GET /api/pitches (with filters)
   - GET /api/pitches/user/:userId
   - GET /api/pitches/:id
   - POST /api/pitches
   - PUT /api/pitches/:id
   - DELETE /api/pitches/:id

📌 NDA Endpoints:
   - GET /api/ndas
   - POST /api/ndas/request
   - POST /api/ndas/approve/:requestId
   - POST /api/ndas/reject/:requestId
   - POST /api/ndas/sign/:ndaId

📌 Messaging Endpoints:
   - GET /api/messages
   - GET /api/conversations
   - POST /api/messages
   - PUT /api/messages/:id/read

📌 Social Features:
   - POST /api/follow/:targetId
   - DELETE /api/follow/:targetId
   - GET /api/follows

📌 Analytics Endpoints:
   - GET /api/analytics/pitch/:pitchId
   - GET /api/analytics/dashboard

📌 Payment Endpoints:
   - GET /api/payments/credits/balance
   - GET /api/payments/subscription-status
   - POST /api/payments/create-payment-intent

📌 Notification Endpoints:
   - GET /api/notifications
   - PUT /api/notifications/:id/read
   - PUT /api/notifications/read-all

📌 Demo Accounts (password: Demo123):
   - Creator: alex.creator@demo.com
   - Investor: sarah.investor@demo.com
   - Production: stellar.production@demo.com
`);

// Add CORS middleware
app.use(oakCors({
  origin: [
    "https://pitchey-frontend.deno.dev",
    "https://pitchey-frontend-x3j06s4d9e6f.deno.dev", 
    "https://pitchey-frontend-yk9c2smfw2zh.deno.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Add router middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Error:', err);
    ctx.response.status = err.status || 500;
    ctx.response.body = {
      error: err.message || 'Internal server error'
    };
  }
});

await app.listen({ port: PORT });