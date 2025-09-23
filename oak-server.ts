import { Application, Router, Context, Status } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Import services
import { UserService } from "./src/services/userService.ts";
import { PitchService } from "./src/services/pitch.service.ts";
import { NDAService } from "./src/services/ndaService.ts";
import { AuthService } from "./src/services/auth.service.ts";
import { StripeService } from "./src/services/stripe.service.ts";
import { db } from "./src/db/client.ts";
import { users, pitches, messages, follows } from "./src/db/schema.ts";
import { eq, desc, sql, and } from "npm:drizzle-orm";

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

// Authentication middleware
async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    ctx.response.status = Status.Unauthorized;
    ctx.response.body = { error: "No authorization header" };
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verify(token, key);
    
    // Get user from database or demo account
    const userId = payload.userId || payload.user_id || payload.id;
    
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
    
    // Get from database
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

// Generate JWT token (matching old format for compatibility)
async function generateToken(userId: number, email: string, userType: string) {
  const token = await create({ alg: "HS256", typ: "JWT" }, {
    userId,
    email,
    role: userType, // Keep 'role' for compatibility
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  }, key);
  
  return token;
}

// Routes

// Health check
router.get("/", (ctx) => {
  ctx.response.body = { 
    success: true, 
    message: "Pitchey API Server",
    timestamp: new Date().toISOString()
  };
});

router.get("/health", (ctx) => {
  ctx.response.body = { 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString()
  };
});

// Authentication routes
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
          name: `${result.user.firstName} ${result.user.lastName}`,
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
          name: `${result.user.firstName} ${result.user.lastName}`,
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
          name: `${result.user.firstName} ${result.user.lastName}`,
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

// Protected routes - Profile
router.get("/api/profile", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  // Return user profile based on whether it's from DB or demo
  if (user.id >= 1001 && user.id <= 1003) {
    // Demo account
    const demoUser = Object.values(demoAccounts).find(u => u.id === user.id);
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

// Dashboard endpoints
router.get("/api/creator/dashboard", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  
  if (user.userType !== "creator") {
    ctx.response.status = Status.Forbidden;
    ctx.response.body = { error: "Creator access required" };
    return;
  }
  
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

// Pitches endpoints
router.get("/api/pitches", async (ctx) => {
  try {
    const pitches = await PitchService.getAllPitches();
    ctx.response.body = { success: true, pitches };
  } catch (error) {
    ctx.response.body = { 
      success: true, 
      pitches: [] // Return empty array on error
    };
  }
});

router.get("/api/pitches/:id", async (ctx) => {
  const { id } = ctx.params;
  
  try {
    const pitch = await PitchService.getPitch(parseInt(id));
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

// Payment endpoints (stub for now)
router.get("/api/payments/credits/balance", authMiddleware, async (ctx) => {
  ctx.response.body = {
    success: true,
    balance: {
      credits: 100,
      tier: "free"
    }
  };
});

router.get("/api/payments/subscription-status", authMiddleware, async (ctx) => {
  ctx.response.body = {
    success: true,
    subscription: {
      status: "active",
      tier: "free",
      creditsRemaining: 100
    }
  };
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Server error:", err);
    ctx.response.status = err.status || Status.InternalServerError;
    ctx.response.body = {
      error: err.message || "Internal server error"
    };
  }
});

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

console.log(`🚀 Oak server running on http://localhost:${PORT}`);
console.log(`
📌 Portal Login Endpoints:
   - Creator: POST /api/auth/creator/login
   - Investor: POST /api/auth/investor/login  
   - Production: POST /api/auth/production/login

📌 Demo Accounts (password: Demo123):
   - Creator: alex.creator@demo.com
   - Investor: sarah.investor@demo.com
   - Production: stellar.production@demo.com
`);

await app.listen({ port: PORT });