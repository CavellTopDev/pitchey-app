import { Application, Router, Context, Status } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Import services
import { UserService } from "./src/services/userService.ts";
import { PitchService } from "./src/services/pitch.service.ts";
import { NDAService } from "./src/services/ndaService.ts";
import { AuthService } from "./src/services/auth.service.ts";
import { MessageService } from "./src/services/message.service.ts";
import { AnalyticsService } from "./src/services/analytics.service.ts";
import { StripeService } from "./src/services/stripe.service.ts";
import { db } from "./src/db/client.ts";
import { 
  users, 
  pitches, 
  messages, 
  follows, 
  ndas, 
  ndaRequests, 
  conversations,
  notifications,
  sessions 
} from "./src/db/schema.ts";
import { eq, desc, sql, and, or, like, isNotNull } from "npm:drizzle-orm";

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
    // First try session verification (unified approach)
    const sessionResult = await AuthService.verifySession(token);
    
    if (sessionResult && sessionResult.user) {
      ctx.state.user = sessionResult.user;
      await next();
      return;
    }
    
    // Fallback to JWT verification for demo accounts
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
  
  // Check demo account
  if (email?.toLowerCase() === demoAccounts.creator.email && password === demoAccounts.creator.password) {
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
  
  // Check demo account
  if (email?.toLowerCase() === demoAccounts.investor.email && password === demoAccounts.investor.password) {
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
  
  // Check demo account
  if (email?.toLowerCase() === demoAccounts.production.email && password === demoAccounts.production.password) {
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
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    const result = await AuthService.login(body);
    
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
  } catch (error) {
    ctx.response.status = Status.Unauthorized;
    ctx.response.body = { error: error instanceof Error ? error.message : "An error occurred" };
  }
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
            message: "Sarah Investor viewed 'The Last Frontier'",
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 2,
            type: "nda",
            message: "Production House signed NDA for 'Urban Legends'",
            timestamp: new Date(Date.now() - 7200000).toISOString()
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
    const userFollows = await db.query.follows.findMany({
      where: eq(follows.followerId, user.id),
      with: {
        pitch: true,
        creator: true
      }
    });
    
    ctx.response.body = { success: true, follows: userFollows };
  } catch (error) {
    ctx.response.status = Status.InternalServerError;
    ctx.response.body = { error: "Failed to fetch follows" };
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

await app.listen({ port: PORT });