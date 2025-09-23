// Multi-portal authentication server for Pitchey v0.2
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { AuthService } from "./src/services/auth.service.ts";
import { PitchService } from "./src/services/pitch.service.ts";
import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const port = Deno.env.get("PORT") || "8000";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-this-in-production";

// Track NDA signatures: Map<userId_pitchId, NDA info>
const signedNDAs = new Map();

// Shared mock data for consistency - this will be modified at runtime
let mockPitchesData = [
  {
    id: 1,
    title: "Quantum Leap",
    genre: "Sci-Fi",
    format: "Feature Film",
    logline: "A scientist discovers a way to travel through time but gets stuck jumping between different versions of his life.",
    shortSynopsis: "Dr. Marcus Chen, a brilliant quantum physicist, creates a revolutionary time-travel device that allows consciousness to jump between parallel versions of oneself. When a test goes wrong, Marcus becomes trapped in an endless loop of alternate realities, each showing him different paths his life could have taken. As he struggles to return to his original timeline, he must confront the choices that define who we truly are and discover that sometimes the greatest journey is not through time, but through understanding ourselves.",
    status: "published",
    viewCount: 456,
    likeCount: 89,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: "/scripts/quantum-leap-screenplay.pdf",
    trailerUrl: "https://vimeo.com/123456789",
    lookbookUrl: "/lookbooks/quantum-leap-visual-guide.pdf",
    pitchDeckUrl: "/decks/quantum-leap-pitch.pdf",
    budget: "$12,000,000",
    budgetBreakdown: {
      development: 800000,
      preProduction: 1200000,
      production: 6000000,
      postProduction: 2500000,
      marketing: 1000000,
      distribution: 500000,
      total: 12000000
    },
    targetAudience: "18-45 sci-fi enthusiasts and mainstream thriller audiences",
    comparableTitles: "Inception, Looper, Everything Everywhere All at Once",
    productionTimeline: "18 months from greenlight to delivery",
    attachedTalent: "Director: Christopher Nolan (in talks), Lead: Oscar Isaac (interested)",
    distributionStrategy: "Theatrical release followed by streaming on major platforms"
  },
  {
    id: 2,
    title: "Action Thriller",
    genre: "Action",
    format: "Feature Film",
    logline: "An undercover agent must stop a terrorist plot while questioning everything he believes about his mission.",
    shortSynopsis: "Agent Sarah Mitchell has spent three years deep undercover infiltrating a terrorist organization. When she uncovers a plot to attack multiple cities simultaneously, she races against time to stop it. But as the mission unfolds, Sarah begins to question whether her handlers are telling her the truth about the operation's real purpose. Caught between loyalty to her country and her growing doubts about the mission, Sarah must decide who to trust when everyone around her might be an enemy.",
    status: "published",
    viewCount: 234,
    likeCount: 45,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  },
  {
    id: 3,
    title: "Comedy Series",
    genre: "Comedy",
    format: "TV Series",
    logline: "A group of friends navigate life in a shared apartment while dealing with their quirky neighbors and romantic mishaps.",
    shortSynopsis: "Welcome to Apartment 4B, where five twenty-something roommates are trying to figure out adulthood one disaster at a time. From dating apps gone wrong to career changes and family drama, this group of friends supports each other through life's ups and downs. With an eccentric landlord, nosy neighbors, and a revolving door of romantic interests, every day brings new challenges and plenty of laughs. It's a heartwarming look at modern friendship and the family we choose for ourselves.",
    status: "published",
    viewCount: 189,
    likeCount: 32,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  },
  {
    id: 4,
    title: "The Last Canvas",
    genre: "Drama",
    format: "Feature Film",
    logline: "An aging artist races against time and dementia to complete his final masterpiece.",
    shortSynopsis: "Renowned painter Vincent Marlowe has been diagnosed with early-onset dementia. With his memories fading, he embarks on creating his final and most personal work - a massive mural that tells the story of his life.",
    status: "published",
    viewCount: 567,
    likeCount: 120,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  },
  {
    id: 5,
    title: "Midnight Heist",
    genre: "Thriller",
    format: "Limited Series",
    logline: "A team of hackers attempts to steal cryptocurrency worth billions in one night.",
    shortSynopsis: "When a group of elite hackers discovers a vulnerability in the world's largest cryptocurrency exchange, they have exactly 8 hours to execute the perfect digital heist.",
    status: "published",
    viewCount: 892,
    likeCount: 156,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  },
  {
    id: 6,
    title: "Love in Translation",
    genre: "Romance",
    format: "Feature Film",
    logline: "Two strangers who don't speak the same language fall in love through a translation app glitch.",
    shortSynopsis: "When a translation app malfunction connects Emma from New York and Hiroshi from Tokyo, their messages get hilariously misinterpreted.",
    status: "published",
    viewCount: 445,
    likeCount: 98,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  },
  {
    id: 7,
    title: "The Algorithm",
    genre: "Sci-Fi",
    format: "TV Series",
    logline: "In 2045, an AI designed to solve climate change decides humanity is the problem.",
    shortSynopsis: "Project Eden was supposed to save the world. The most advanced AI ever created was given one directive: solve climate change.",
    status: "published",
    viewCount: 1205,
    likeCount: 245,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    // Enhanced data for TV Series
    scriptUrl: "/scripts/the-algorithm-pilot.pdf",
    trailerUrl: "https://vimeo.com/987654321",
    lookbookUrl: "/lookbooks/algorithm-visual-bible.pdf",
    pitchDeckUrl: "/decks/algorithm-series-pitch.pdf",
    budget: "$3,500,000 per episode",
    budgetBreakdown: {
      development: 500000,
      preProduction: 400000,
      production: 2000000,
      postProduction: 400000,
      marketing: 150000,
      distribution: 50000,
      total: 3500000
    },
    targetAudience: "18-35 tech-savvy viewers, Black Mirror and Westworld fans",
    comparableTitles: "Black Mirror, Westworld, Upload, The Peripheral",
    productionTimeline: "Season 1 (8 episodes) - 12 months from greenlight",
    attachedTalent: "Showrunner: Alex Garland (in discussions), Lead: Anya Taylor-Joy (interested)",
    distributionStrategy: "Streaming-first release on Netflix/HBO Max with potential for international syndication"
  },
  {
    id: 8,
    title: "Street Kings",
    genre: "Action",
    format: "Feature Film",
    logline: "Former street racers must reunite for one last race to save their neighborhood.",
    shortSynopsis: "The old racing crew of Eastside hasn't spoken in five years since a race went tragically wrong.",
    status: "published",
    viewCount: 334,
    likeCount: 67,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    titleImage: null,
    scriptUrl: null,
    trailerUrl: null
  }
];

// Helper function to get pitch by ID
function getPitchById(id: number) {
  return mockPitchesData.find(pitch => pitch.id === id) || null;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  "Access-Control-Allow-Credentials": "false"
};

// Helper to create JWT token
async function createToken(userId: number, email: string, userType: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  return await create(
    { alg: "HS256", typ: "JWT" },
    { 
      sub: userId.toString(), 
      email, 
      userType,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    },
    key
  );
}

// Helper to verify JWT token
async function verifyToken(token: string) {
  try {
    if (!token || token.trim() === '') {
      console.log('Empty token provided');
      return null;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const payload = await verify(token, key);
    console.log('Token verified successfully:', { sub: payload.sub, userId: payload.userId, userType: payload.userType });
    return payload;
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return null;
  }
}

// NDA Data Management Functions
const NDA_DATA_FILE = './data/ndas.json';

interface NDARequest {
  id: number;
  pitchId: number;
  requesterId: number;
  ownerId: number;
  ndaType: 'basic' | 'enhanced' | 'custom';
  requestMessage?: string;
  companyInfo?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
  rejectionReason?: string;
  expiresAt: string;
}

interface SignedNDA {
  id: number;
  pitchId: number;
  signerId: number;
  ndaType: 'basic' | 'enhanced' | 'custom';
  signedAt: string;
  expiresAt: string;
  accessGranted: boolean;
}

interface NDAData {
  requests: NDARequest[];
  signedNDAs: SignedNDA[];
  nextRequestId: number;
  nextNDAId: number;
}

async function loadNDAData(): Promise<NDAData> {
  try {
    const data = await Deno.readTextFile(NDA_DATA_FILE);
    return JSON.parse(data);
  } catch (error) {
    console.log('Creating new NDA data file');
    const initialData: NDAData = {
      requests: [],
      signedNDAs: [],
      nextRequestId: 1,
      nextNDAId: 1
    };
    await saveNDAData(initialData);
    return initialData;
  }
}

async function saveNDAData(data: NDAData): Promise<void> {
  try {
    await Deno.writeTextFile(NDA_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save NDA data:', error);
    throw error;
  }
}

// Validation middleware for NDA endpoints
function validateNDARequest(body: any): { isValid: boolean; error?: string } {
  if (!body.pitchId || typeof body.pitchId !== 'number') {
    return { isValid: false, error: 'Valid pitchId is required' };
  }
  
  if (body.ndaType && !['basic', 'enhanced', 'custom'].includes(body.ndaType)) {
    return { isValid: false, error: 'Invalid NDA type' };
  }
  
  return { isValid: true };
}

// Follow Data Management Functions
const FOLLOWS_DATA_FILE = './data/follows.json';

interface Follow {
  id: number;
  userId: number;
  targetId: number;
  type: 'creator' | 'pitch';
  followedAt: string;
}

interface FollowsData {
  follows: Follow[];
  nextId: number;
}

async function loadFollowsData(): Promise<FollowsData> {
  try {
    const data = await Deno.readTextFile(FOLLOWS_DATA_FILE);
    return JSON.parse(data);
  } catch (error) {
    console.log('Creating new follows data file');
    const initialData: FollowsData = {
      follows: [],
      nextId: 1
    };
    await saveFollowsData(initialData);
    return initialData;
  }
}

async function saveFollowsData(data: FollowsData): Promise<void> {
  try {
    await Deno.writeTextFile(FOLLOWS_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save follows data:', error);
    throw error;
  }
}

// Helper functions for follow operations
async function addFollow(userId: number, targetId: number, type: 'creator' | 'pitch'): Promise<Follow> {
  const data = await loadFollowsData();
  
  // Check if already following
  const existingFollow = data.follows.find(f => 
    f.userId === userId && f.targetId === targetId && f.type === type
  );
  
  if (existingFollow) {
    return existingFollow;
  }
  
  const newFollow: Follow = {
    id: data.nextId++,
    userId,
    targetId,
    type,
    followedAt: new Date().toISOString()
  };
  
  data.follows.push(newFollow);
  await saveFollowsData(data);
  return newFollow;
}

async function removeFollow(userId: number, targetId: number, type: 'creator' | 'pitch'): Promise<boolean> {
  const data = await loadFollowsData();
  const initialLength = data.follows.length;
  
  data.follows = data.follows.filter(f => 
    !(f.userId === userId && f.targetId === targetId && f.type === type)
  );
  
  if (data.follows.length < initialLength) {
    await saveFollowsData(data);
    return true;
  }
  
  return false;
}

async function isFollowing(userId: number, targetId: number, type: 'creator' | 'pitch'): Promise<boolean> {
  const data = await loadFollowsData();
  return data.follows.some(f => 
    f.userId === userId && f.targetId === targetId && f.type === type
  );
}

async function getUserFollows(userId: number): Promise<{ creators: number[], pitches: number[] }> {
  const data = await loadFollowsData();
  const userFollows = data.follows.filter(f => f.userId === userId);
  
  return {
    creators: userFollows.filter(f => f.type === 'creator').map(f => f.targetId),
    pitches: userFollows.filter(f => f.type === 'pitch').map(f => f.targetId)
  };
}

// JSON Response Validation Middleware
function createJSONResponse(data: any, status: number = 200, additionalHeaders: Record<string, string> = {}): Response {
  try {
    // Ensure data is serializable
    const jsonString = JSON.stringify(data);
    
    // Validate that we can parse it back (safety check)
    JSON.parse(jsonString);
    
    return new Response(jsonString, {
      status,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        ...additionalHeaders,
      },
    });
  } catch (error) {
    console.error('JSON serialization error:', error);
    console.error('Problematic data:', data);
    
    // Fallback error response
    return new Response(JSON.stringify({
      error: "Internal server error - invalid response format",
      code: "SERIALIZATION_ERROR"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
    });
  }
}

function createErrorResponse(message: string, status: number = 500, code?: string): Response {
  return createJSONResponse({
    error: message,
    ...(code && { code })
  }, status);
}

// Demo accounts for testing
const demoAccounts = {
  creator: {
    email: "alex.filmmaker@demo.com",
    password: "Demo123456",
    userType: "creator",
    id: 1001,
    username: "alexfilmmaker",
    company: "Independent Films"
  },
  investor: {
    email: "sarah.investor@demo.com",
    password: "Demo123456",
    userType: "investor",
    id: 1002,
    username: "sarahinvestor",
    company: "Venture Capital Films"
  },
  production: {
    email: "stellar.productions@demo.com",
    password: "Demo123456",
    userType: "production",
    id: 1003,
    username: "stellarproductions",
    company: "Stellar Productions Inc."
  }
};

// Mock creators data for follows functionality
const mockCreators = [
  {
    id: 1001,
    name: "Alex Filmmaker",
    email: "alex.filmmaker@demo.com",
    bio: "Independent filmmaker with 10 years of experience",
    portfolio: "https://alexfilms.com",
    experience: "10 years",
    location: "Los Angeles, CA",
    genres: ["Drama", "Thriller", "Independent"]
  }
];

// Initialize demo accounts in database
async function initializeDemoAccounts() {
  try {
    console.log("🔧 Initializing demo accounts...");
    
    for (const [role, account] of Object.entries(demoAccounts)) {
      // Check if demo account already exists
      const existingUser = await db.select().from(users)
        .where(eq(users.email, account.email))
        .limit(1);

      if (existingUser.length === 0) {
        // Hash the password
        const hashedPassword = await hash(account.password);
        
        // Insert demo account
        await db.insert(users).values({
          email: account.email,
          username: account.username,
          passwordHash: hashedPassword,
          userType: account.userType as any,
          companyName: account.company,
          subscriptionTier: role === 'creator' ? 'creator' : role === 'investor' ? 'investor' : 'pro',
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`✅ Created demo ${role} account: ${account.email}`);
      } else {
        console.log(`ℹ️  Demo ${role} account already exists: ${account.email}`);
      }
    }
    
    console.log("🎉 Demo accounts initialized successfully!");
  } catch (error) {
    console.error("❌ Failed to initialize demo accounts:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const method = req.method;

  // Handle OPTIONS requests for CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Health check
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      message: "Multi-portal Pitchey API is running",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Public endpoint to fetch pitches (no auth required)
  if (url.pathname === "/api/public/pitches" && method === "GET") {
    console.log("Public pitches endpoint hit");
    
    try {
      // Only return published pitches for public viewing
      // Add varied creator types for demonstration
      const creatorTypes = [
        { id: 1001, username: "AlexFilmmaker", userType: "creator" },
        { id: 1002, username: "WarnerProd", userType: "production", companyName: "Warner Productions" },
        { id: 1003, username: "SilverScreen", userType: "investor", companyName: "Silver Screen Ventures" },
        { id: 1004, username: "JohnDoe", userType: "creator" },
        { id: 1005, username: "UniversalStudios", userType: "production", companyName: "Universal Studios" },
        { id: 1006, username: "CreativeVentures", userType: "investor", companyName: "Creative Capital" },
        { id: 1007, username: "IndieMaker", userType: "creator" },
        { id: 1008, username: "A24Films", userType: "production", companyName: "A24" }
      ];
      
      const publicPitches = mockPitchesData
        .filter(pitch => pitch.status === 'published')
        .map((pitch) => ({
          id: pitch.id,
          title: pitch.title,
          genre: pitch.genre,
          format: pitch.format,
          logline: pitch.logline,
          viewCount: pitch.viewCount,
          likeCount: pitch.likeCount,
          status: pitch.status,
          createdAt: pitch.createdAt,
          creator: creatorTypes[(pitch.id - 1) % creatorTypes.length],
          ndaCount: Math.floor(Math.random() * 20)
        }));

      return new Response(JSON.stringify({ pitches: publicPitches }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching public pitches:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch pitches" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Public endpoint to fetch a single pitch (no auth required)
  if (url.pathname.startsWith("/api/public/pitch/") && method === "GET") {
    const pitchId = url.pathname.split("/").pop();
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      const pitch = getPitchById(pitchIdInt);
      
      if (!pitch || pitch.status !== 'published') {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Increment view count for public viewing
      pitch.viewCount = (pitch.viewCount || 0) + 1;
      console.log(`Public view - Pitch ${pitchIdInt} view count: ${pitch.viewCount}`);

      return new Response(JSON.stringify({ pitch }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching public pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Creator-specific login endpoint
  if (url.pathname === "/api/auth/creator/login" && method === "POST") {
    try {
      const body = await req.json();
      const { email, password } = body;

      // Check demo account first
      if (email === demoAccounts.creator.email && password === demoAccounts.creator.password) {
        const token = await createToken(demoAccounts.creator.id, email, "creator");
        
        return new Response(JSON.stringify({
          token,
          user: {
            id: demoAccounts.creator.id,
            email: demoAccounts.creator.email,
            username: demoAccounts.creator.username,
            userType: "creator",
            company: demoAccounts.creator.company,
            credits: { view: 100, upload: 10, message: 50 },
            subscription: "basic"
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Check real database
      const [user] = await db.select().from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || user.userType !== "creator") {
        return new Response(JSON.stringify({ error: "Invalid creator credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        return new Response(JSON.stringify({ error: "Invalid creator credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const token = await createToken(user.id, user.email, user.userType);
      
      return new Response(JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
          company: user.companyName,
          credits: { view: 100, upload: 10, message: 50 },
          subscription: user.subscriptionTier || "free"
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Creator login error:", error);
      return new Response(JSON.stringify({ error: "Creator login failed" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Investor-specific login endpoint
  if (url.pathname === "/api/auth/investor/login" && method === "POST") {
    try {
      const body = await req.json();
      const { email, password } = body;

      // Check demo account first
      if (email === demoAccounts.investor.email && password === demoAccounts.investor.password) {
        const token = await createToken(demoAccounts.investor.id, email, "investor");
        
        return new Response(JSON.stringify({
          token,
          user: {
            id: demoAccounts.investor.id,
            email: demoAccounts.investor.email,
            username: demoAccounts.investor.username,
            userType: "investor",
            company: demoAccounts.investor.company,
            investmentCapacity: 500000,
            portfolioSize: 12,
            subscription: "pro"
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Check real database
      const [user] = await db.select().from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || user.userType !== "investor") {
        return new Response(JSON.stringify({ error: "Invalid investor credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        return new Response(JSON.stringify({ error: "Invalid investor credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const token = await createToken(user.id, user.email, user.userType);
      
      return new Response(JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
          company: user.companyName,
          investmentCapacity: user.investmentMin || 0,
          portfolioSize: 0,
          subscription: user.subscriptionTier || "free"
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Investor login error:", error);
      return new Response(JSON.stringify({ error: "Investor login failed" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Production company-specific login endpoint
  if (url.pathname === "/api/auth/production/login" && method === "POST") {
    try {
      const body = await req.json();
      const { email, password } = body;

      // Check demo account first
      if (email === demoAccounts.production.email && password === demoAccounts.production.password) {
        const token = await createToken(demoAccounts.production.id, email, "production");
        
        return new Response(JSON.stringify({
          token,
          user: {
            id: demoAccounts.production.id,
            email: demoAccounts.production.email,
            username: demoAccounts.production.username,
            userType: "production",
            company: demoAccounts.production.company,
            productionCapacity: "high",
            activeProjects: 5,
            subscription: "unlimited"
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Check real database
      const [user] = await db.select().from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || user.userType !== "production") {
        return new Response(JSON.stringify({ error: "Invalid production company credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        return new Response(JSON.stringify({ error: "Invalid production company credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const token = await createToken(user.id, user.email, user.userType);
      
      return new Response(JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
          company: user.companyName,
          productionCapacity: user.productionCapacity || "medium",
          activeProjects: 0,
          subscription: user.subscriptionTier || "free"
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Production login error:", error);
      return new Response(JSON.stringify({ error: "Production login failed" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Role-specific dashboard data endpoints
  if (url.pathname === "/api/creator/dashboard" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Handle both token formats and demo accounts
    const userId = payload.sub || payload.userId;
    let userType = payload.userType;
    
    // If userType not in token, check demo accounts first
    if (!userType) {
      const demoAccount = Object.values(demoAccounts).find(acc => acc.id.toString() === userId?.toString());
      if (demoAccount) {
        userType = demoAccount.userType;
      } else {
        // Look up user in database
        try {
          const userIdInt = parseInt(userId?.toString() || '');
          if (!isNaN(userIdInt)) {
            const [user] = await db.select().from(users)
              .where(eq(users.id, userIdInt))
              .limit(1);
            if (user) {
              userType = user.userType;
            }
          }
        } catch (error) {
          console.error('Error looking up user:', error);
        }
      }
    }
    
    if (userType !== "creator") {
      return new Response(JSON.stringify({ error: "Invalid creator access" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      dashboard: "creator",
      stats: {
        totalPitches: 12,
        activePitches: 8,
        totalViews: 1245,
        totalInterest: 23,
        avgRating: 4.5
      },
      recentActivity: [
        { type: "view", pitch: "Action Thriller", viewer: "Production Co", time: "2 hours ago" },
        { type: "interest", pitch: "Sci-Fi Drama", investor: "Venture Films", time: "5 hours ago" },
      ],
      credits: { view: 100, upload: 10, message: 50 }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (url.pathname === "/api/investor/dashboard" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Handle both token formats and demo accounts
    const userId = payload.sub || payload.userId;
    let userType = payload.userType;
    
    // If userType not in token, check demo accounts first
    if (!userType) {
      const demoAccount = Object.values(demoAccounts).find(acc => acc.id.toString() === userId?.toString());
      if (demoAccount) {
        userType = demoAccount.userType;
      } else {
        // Look up user in database
        try {
          const userIdInt = parseInt(userId?.toString() || '');
          if (!isNaN(userIdInt)) {
            const [user] = await db.select().from(users)
              .where(eq(users.id, userIdInt))
              .limit(1);
            if (user) {
              userType = user.userType;
            }
          }
        } catch (error) {
          console.error('Error looking up user:', error);
        }
      }
    }
    
    if (userType !== "investor") {
      return new Response(JSON.stringify({ error: "Invalid investor access" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      dashboard: "investor",
      portfolio: {
        totalInvestments: 15,
        activeDeals: 8,
        totalInvested: 2500000,
        averageReturn: 24.5,
        pendingOpportunities: 7
      },
      watchlist: [
        { title: "The Last Stand", genre: "Action", budget: 5000000, status: "Reviewing" },
        { title: "Quantum Leap", genre: "Sci-Fi", budget: 8000000, status: "Due Diligence" },
      ],
      recommendations: [
        { title: "Urban Legend", genre: "Horror", matchScore: 92 },
        { title: "Time Paradox", genre: "Thriller", matchScore: 88 },
      ]
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Production pitch creation endpoint
  if (url.pathname === "/api/production/pitches" && method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const formData = await req.formData();
      const userId = payload.sub || payload.userId;
      
      // Parse the form data
      const pitchData: any = {
        title: formData.get("title") as string,
        genre: formData.get("genre") as string,
        format: formData.get("format") as string,
        logline: formData.get("logline") as string,
        shortSynopsis: formData.get("shortSynopsis") as string,
        longSynopsis: formData.get("longSynopsis") as string,
        budgetBracket: formData.get("budgetBracket") as string,
        estimatedBudget: formData.get("estimatedBudget") ? parseFloat(formData.get("estimatedBudget") as string) : null,
        productionTimeline: formData.get("productionTimeline") as string,
        targetAudience: formData.get("targetAudience") as string,
        characters: JSON.parse(formData.get("characters") as string || "[]"),
        themes: JSON.parse(formData.get("themes") as string || "[]"),
        visibilitySettings: JSON.parse(formData.get("visibilitySettings") as string || "{}"),
        status: formData.get("status") as string || "draft",
        additionalMedia: []
      };

      // Handle file uploads (in production, these would be uploaded to S3)
      const titleImage = formData.get("titleImage") as File | null;
      if (titleImage) {
        // In production: upload to S3 and get URL
        pitchData.titleImage = `/uploads/${Date.now()}-${titleImage.name}`;
      }

      // Handle media files
      const mediaFiles = formData.getAll("mediaFiles") as File[];
      const mediaMetadata = formData.getAll("mediaMetadata").map(m => JSON.parse(m as string));
      
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        const metadata = mediaMetadata[i] || {};
        
        // In production: upload to S3 and get URL
        const fileUrl = `/uploads/${Date.now()}-${file.name}`;
        
        pitchData.additionalMedia.push({
          type: metadata.type,
          url: fileUrl,
          title: metadata.title || file.name,
          description: metadata.description,
          uploadedAt: new Date().toISOString()
        });
      }

      // Create the pitch
      const newPitch = await PitchService.create(parseInt(userId), pitchData);

      return new Response(JSON.stringify(newPitch), {
        status: 201,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating production pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to create pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  if (url.pathname === "/api/production/dashboard" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Handle both token formats and demo accounts
    const userId = payload.sub || payload.userId;
    let userType = payload.userType;
    
    // If userType not in token, check demo accounts first
    if (!userType) {
      const demoAccount = Object.values(demoAccounts).find(acc => acc.id.toString() === userId?.toString());
      if (demoAccount) {
        userType = demoAccount.userType;
      } else {
        // Look up user in database
        try {
          const userIdInt = parseInt(userId?.toString() || '');
          if (!isNaN(userIdInt)) {
            const [user] = await db.select().from(users)
              .where(eq(users.id, userIdInt))
              .limit(1);
            if (user) {
              userType = user.userType;
            }
          }
        } catch (error) {
          console.error('Error looking up user:', error);
        }
      }
    }
    
    if (userType !== "production") {
      return new Response(JSON.stringify({ error: "Invalid production company access" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      dashboard: "production",
      production: {
        activeProjects: 5,
        completedProjects: 28,
        inDevelopment: 3,
        totalRevenue: 45000000,
        teamSize: 125
      },
      pipeline: [
        { title: "Summer Blockbuster", phase: "Pre-Production", budget: 15000000 },
        { title: "Mystery Series", phase: "Development", budget: 8000000 },
        { title: "Documentary", phase: "Production", budget: 2000000 },
      ],
      scouting: [
        { title: "The Heist", creator: "John Doe", score: 8.5 },
        { title: "Space Opera", creator: "Jane Smith", score: 8.2 },
      ]
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Profile endpoint
  if (url.pathname === "/api/profile" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Extract user ID from token (handle both formats)
    const userId = payload.sub || payload.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Check if it's a demo account first
    const demoAccount = Object.values(demoAccounts).find(acc => acc.id.toString() === userId.toString());
    if (demoAccount) {
      return new Response(JSON.stringify({
        id: demoAccount.id,
        email: demoAccount.email,
        username: demoAccount.username,
        userType: demoAccount.userType,
        company: demoAccount.company,
        subscription: demoAccount.userType === 'creator' ? 'creator' : 
                     demoAccount.userType === 'investor' ? 'investor' : 'pro'
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Get user from database
    try {
      const userIdInt = parseInt(userId.toString());
      if (isNaN(userIdInt)) {
        return new Response(JSON.stringify({ error: "Invalid user ID format" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.id, userIdInt))
        .limit(1);

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        id: user.id,
        email: user.email,
        username: user.username,
        userType: user.userType,
        company: user.companyName,
        subscription: user.subscriptionTier
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch profile" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Creator Pitch Management Endpoints
  if (url.pathname === "/api/creator/pitches" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const userId = payload.sub || payload.userId;
    
    try {
      const userIdInt = parseInt(userId?.toString() || '');
      if (isNaN(userIdInt)) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Return shared mock data for consistency
      return new Response(JSON.stringify({
        pitches: mockPitchesData
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching pitches:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch pitches" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  if (url.pathname === "/api/creator/pitches" && method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const userId = payload.sub || payload.userId;
    
    try {
      const userIdInt = parseInt(userId?.toString() || '');
      if (isNaN(userIdInt)) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Handle form data (multipart/form-data)
      const formData = await req.formData();
      
      const title = formData.get("title")?.toString();
      const genre = formData.get("genre")?.toString();
      const format = formData.get("format")?.toString();
      const logline = formData.get("logline")?.toString();
      const shortSynopsis = formData.get("shortSynopsis")?.toString();
      
      if (!title || !genre || !format || !logline || !shortSynopsis) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // For demo purposes, create a mock pitch response
      const mockPitch = {
        id: Date.now(), // Use timestamp as mock ID
        title,
        genre,
        format,
        logline,
        shortSynopsis,
        status: "draft",
        viewCount: 0,
        likeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('Mock pitch created:', mockPitch);

      // Add the new pitch to the shared data array
      mockPitchesData.unshift(mockPitch); // Add to beginning of array

      return new Response(JSON.stringify({
        message: "Pitch created successfully",
        pitch: mockPitch
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to create pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Update pitch status (PATCH)
  if (url.pathname.startsWith("/api/creator/pitches/") && method === "PATCH") {
    const pitchId = url.pathname.split("/").pop();
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const userId = payload.sub || payload.userId;
    
    try {
      const userIdInt = parseInt(userId?.toString() || '');
      const pitchIdInt = parseInt(pitchId);
      
      const body = await req.json();
      const { status } = body;
      
      if (!status || !["draft", "published", "hidden"].includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid status" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      // Find and update the pitch in shared data
      const pitch = getPitchById(pitchIdInt);
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Update the pitch status in shared data
      pitch.status = status;
      pitch.publishedAt = status === "published" ? new Date().toISOString() : null;
      pitch.updatedAt = new Date().toISOString();

      const updatedPitch = {
        id: pitchIdInt,
        status: pitch.status,
        publishedAt: pitch.publishedAt,
        updatedAt: pitch.updatedAt
      };

      console.log(`Pitch ${pitchIdInt} status updated to: ${status}`);

      return new Response(JSON.stringify({
        message: "Pitch updated successfully",
        pitch: updatedPitch
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to update pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Delete pitch (DELETE)
  if (url.pathname.startsWith("/api/creator/pitches/") && method === "DELETE") {
    const pitchId = url.pathname.split("/").pop();
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      
      // Remove pitch from shared data array
      const pitchIndex = mockPitchesData.findIndex(p => p.id === pitchIdInt);
      if (pitchIndex !== -1) {
        mockPitchesData.splice(pitchIndex, 1);
        console.log(`Pitch ${pitchIdInt} deleted successfully`);
      } else {
        console.log(`Pitch ${pitchIdInt} not found for deletion`);
      }

      return new Response(JSON.stringify({
        message: "Pitch deleted successfully",
        pitchId: pitchIdInt
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error deleting pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to delete pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Get single pitch (GET) - with live view tracking
  if (url.pathname.startsWith("/api/creator/pitches/") && method === "GET" && !url.pathname.includes("/analytics")) {
    const pitchId = url.pathname.split("/").pop();
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      console.log(`Fetching pitch ${pitchIdInt} - incrementing view count`);

      // Get pitch from shared data
      const pitch = getPitchById(pitchIdInt);
      
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Increment view count for live tracking
      pitch.viewCount = (pitch.viewCount || 0) + 1;
      console.log(`Pitch ${pitchIdInt} view count updated to: ${pitch.viewCount}`);

      return new Response(JSON.stringify({ pitch }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Update pitch (PUT)
  if (url.pathname.startsWith("/api/creator/pitches/") && method === "PUT") {
    const pitchId = url.pathname.split("/").pop();
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      console.log(`Updating pitch ${pitchIdInt}`);

      // For demo purposes, return success
      const updatedPitch = {
        id: pitchIdInt,
        title: "Updated Pitch Title",
        updatedAt: new Date().toISOString()
      };

      return new Response(JSON.stringify({
        message: "Pitch updated successfully",
        pitch: updatedPitch
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to update pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Get pitch analytics (GET)
  if (url.pathname.startsWith("/api/creator/pitches/") && url.pathname.includes("/analytics") && method === "GET") {
    const pathParts = url.pathname.split("/");
    const pitchId = pathParts[pathParts.length - 2]; // Get pitch ID from before "/analytics"
    
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      console.log(`Fetching analytics for pitch ${pitchIdInt}`);

      // Get pitch from shared data for consistent title
      const pitch = getPitchById(pitchIdInt);
      
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Mock analytics data for demo with real pitch data
      const analytics = {
        pitchId: pitchIdInt,
        pitchTitle: pitch.title,
        totalViews: pitch.viewCount,
        totalLikes: pitch.likeCount,
        totalMessages: Math.floor(pitch.viewCount * 0.08), // 8% message rate
        totalShares: Math.floor(pitch.viewCount * 0.15), // 15% share rate
        viewsThisWeek: Math.floor(pitch.viewCount * 0.3),
        viewsThisMonth: Math.floor(pitch.viewCount * 0.8),
        viewsByDay: [
          { date: "2024-09-13", views: 23 },
          { date: "2024-09-14", views: 45 },
          { date: "2024-09-15", views: 67 },
          { date: "2024-09-16", views: 34 },
          { date: "2024-09-17", views: 89 },
          { date: "2024-09-18", views: 56 },
          { date: "2024-09-19", views: 78 }
        ],
        viewerTypes: [
          { type: "investors", count: 567 },
          { type: "production", count: 234 },
          { type: "creators", count: 123 },
          { type: "viewers", count: 321 }
        ],
        topReferrers: [
          { source: "Direct", views: 456 },
          { source: "Social Media", views: 234 },
          { source: "Search Engines", views: 123 },
          { source: "Email", views: 89 },
          { source: "Other", views: 343 }
        ],
        engagement: {
          averageViewTime: 145, // seconds
          clickThroughRate: 0.125,
          returnVisitors: 89
        }
      };

      return new Response(JSON.stringify({ analytics }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Creator Analytics endpoint with real data calculation
  if (url.pathname === "/api/creator/analytics" && method === "GET") {
    console.log("Analytics endpoint hit");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Analytics request missing or invalid auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const urlParams = new URLSearchParams(url.search);
      const timeRange = urlParams.get('timeRange') || '30d';
      console.log(`Analytics request for timeRange: ${timeRange}`);
      
      // Calculate days for time range
      let days = 30;
      switch (timeRange) {
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '90d': days = 90; break;
        case '1y': days = 365; break;
        default: days = 30;
      }

      // Calculate totals from actual pitch data (could be filtered by time in the future)
      const totalViews = mockPitchesData.reduce((sum, pitch) => sum + (pitch.viewCount || 0), 0);
      const totalLikes = mockPitchesData.reduce((sum, pitch) => sum + (pitch.likeCount || 0), 0);
      const totalPitches = mockPitchesData.length;
      const publishedPitches = mockPitchesData.filter(p => p.status === 'published').length;

      // Calculate monthly growth (simulate based on current data)
      const viewsThisMonth = Math.floor(totalViews * 0.3); // 30% of total views this month
      const likesThisMonth = Math.floor(totalLikes * 0.25); // 25% of total likes this month

      // Generate performance data for actual pitches with time-range filtering
      const pitchPerformance = mockPitchesData
        .map(pitch => {
          // Calculate what portion of total views/likes happened in the selected time range
          // Based on when the pitch was created relative to the time range
          const pitchAge = Math.floor((Date.now() - new Date(pitch.createdAt).getTime()) / (24 * 60 * 60 * 1000));
          
          let timeRangeViews, timeRangeLikes;
          
          if (pitchAge <= days) {
            // Pitch was created within the time range - show all its metrics
            timeRangeViews = pitch.viewCount || 0;
            timeRangeLikes = pitch.likeCount || 0;
          } else {
            // Pitch is older than time range - calculate proportional metrics
            // Simulate that newer time periods have more activity
            const activityRatio = days === 7 ? 0.25 : 
                                 days === 30 ? 0.5 : 
                                 days === 90 ? 0.75 : 0.9;
            
            timeRangeViews = Math.floor((pitch.viewCount || 0) * activityRatio);
            timeRangeLikes = Math.floor((pitch.likeCount || 0) * activityRatio);
          }
          
          // Add some variation based on pitch popularity
          if (days === 7) {
            // Last 7 days - more recent activity
            if (pitch.title === "Quantum Leap") {
              timeRangeViews = 125; // Most popular recently
              timeRangeLikes = 22;
            } else if (pitch.title === "Action Thriller") {
              timeRangeViews = 45; // Less recent activity
              timeRangeLikes = 8;
            } else if (pitch.title === "Comedy Series") {
              timeRangeViews = 89; // Moderate recent activity
              timeRangeLikes = 15;
            }
          } else if (days === 30) {
            // Last 30 days - moderate window
            if (pitch.title === "Quantum Leap") {
              timeRangeViews = 320;
              timeRangeLikes = 65;
            } else if (pitch.title === "Action Thriller") {
              timeRangeViews = 180;
              timeRangeLikes = 32;
            } else if (pitch.title === "Comedy Series") {
              timeRangeViews = 150;
              timeRangeLikes = 25;
            }
          } else if (days === 90) {
            // Last 3 months - most of the total
            if (pitch.title === "Quantum Leap") {
              timeRangeViews = 420;
              timeRangeLikes = 82;
            } else if (pitch.title === "Action Thriller") {
              timeRangeViews = 210;
              timeRangeLikes = 40;
            } else if (pitch.title === "Comedy Series") {
              timeRangeViews = 175;
              timeRangeLikes = 30;
            }
          }
          // For 1 year, use almost all metrics
          
          return {
            id: pitch.id,
            title: pitch.title,
            views: timeRangeViews,
            likes: timeRangeLikes,
            comments: Math.floor(timeRangeLikes * 0.2), // Simulate comments as 20% of likes
            conversionRate: parseFloat((timeRangeLikes / Math.max(1, timeRangeViews) * 100).toFixed(1))
          };
        })
        .sort((a, b) => b.views - a.views); // Sort by views descending

      // Generate views over time data
      const viewsOverTime = Array.from({ length: days }, (_, i) => {
        const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
        const dayIndex = i;
        
        // Create realistic variation in views/likes over time
        const baseViews = Math.floor(totalViews / days);
        const variation = Math.sin(dayIndex * 0.2) * 0.3 + Math.random() * 0.4; // Wave pattern + randomness
        const views = Math.max(1, Math.floor(baseViews * (1 + variation)));
        const likes = Math.max(0, Math.floor(views * 0.15 + Math.random() * 5)); // ~15% like rate
        
        return {
          date: date.toISOString(),
          views,
          likes
        };
      });

      // Calculate genre distribution based on time range performance
      const genrePerformance = {};
      pitchPerformance.forEach(pitch => {
        // Find the genre for this pitch
        const originalPitch = mockPitchesData.find(p => p.id === pitch.id);
        if (originalPitch) {
          if (!genrePerformance[originalPitch.genre]) {
            genrePerformance[originalPitch.genre] = { views: 0, count: 0 };
          }
          genrePerformance[originalPitch.genre].views += pitch.views;
          genrePerformance[originalPitch.genre].count += 1;
        }
      });

      // Calculate total views for the time period
      const timeRangeTotalViews = pitchPerformance.reduce((sum, p) => sum + p.views, 0);

      // Create genre distribution based on views in the time range
      const topGenres = Object.entries(genrePerformance)
        .map(([genre, data]) => ({
          genre,
          percentage: Math.round((data.views / Math.max(1, timeRangeTotalViews)) * 100)
        }))
        .sort((a, b) => b.percentage - a.percentage);

      // Adjust genre percentages based on time range to show different patterns
      if (days === 7) {
        // Last 7 days - Comedy might be trending
        topGenres.forEach(g => {
          if (g.genre === "Comedy") g.percentage = 35;
          else if (g.genre === "Sci-Fi") g.percentage = 45;
          else if (g.genre === "Action") g.percentage = 20;
        });
      } else if (days === 30) {
        // Last 30 days - more balanced
        topGenres.forEach(g => {
          if (g.genre === "Sci-Fi") g.percentage = 50;
          else if (g.genre === "Action") g.percentage = 28;
          else if (g.genre === "Comedy") g.percentage = 22;
        });
      } else if (days === 90) {
        // Last 3 months - Sci-Fi dominates
        topGenres.forEach(g => {
          if (g.genre === "Sci-Fi") g.percentage = 52;
          else if (g.genre === "Action") g.percentage = 25;
          else if (g.genre === "Comedy") g.percentage = 23;
        });
      }

      // Generate time-range specific user types
      const userTypeDistribution = days === 7 ? 
        { investor: 0.3, production: 0.4, creator: 0.2, general: 0.1 } : // More production interest recently
        days === 30 ? 
        { investor: 0.35, production: 0.35, creator: 0.2, general: 0.1 } : // Balanced
        days === 90 ?
        { investor: 0.4, production: 0.3, creator: 0.2, general: 0.1 } : // More investor interest over time
        { investor: 0.45, production: 0.25, creator: 0.2, general: 0.1 }; // Long-term investor dominated

      const userTypes = [
        { type: "investor", count: Math.floor(timeRangeTotalViews * userTypeDistribution.investor) },
        { type: "production", count: Math.floor(timeRangeTotalViews * userTypeDistribution.production) },
        { type: "creator", count: Math.floor(timeRangeTotalViews * userTypeDistribution.creator) },
        { type: "general", count: Math.floor(timeRangeTotalViews * userTypeDistribution.general) }
      ];

      // Generate time-range specific regional distribution
      const regionDistribution = days === 7 ?
        { us: 0.35, uk: 0.25, ca: 0.20, au: 0.10, de: 0.10 } : // More UK/Canada recently
        days === 30 ?
        { us: 0.40, uk: 0.22, ca: 0.18, au: 0.10, de: 0.10 } : // Moderate US dominance
        days === 90 ?
        { us: 0.45, uk: 0.20, ca: 0.15, au: 0.10, de: 0.10 } : // Growing US dominance
        { us: 0.50, uk: 0.18, ca: 0.12, au: 0.10, de: 0.10 }; // Long-term US dominated

      const topRegions = [
        { region: "United States", count: Math.floor(timeRangeTotalViews * regionDistribution.us) },
        { region: "United Kingdom", count: Math.floor(timeRangeTotalViews * regionDistribution.uk) },
        { region: "Canada", count: Math.floor(timeRangeTotalViews * regionDistribution.ca) },
        { region: "Australia", count: Math.floor(timeRangeTotalViews * regionDistribution.au) },
        { region: "Germany", count: Math.floor(timeRangeTotalViews * regionDistribution.de) }
      ];

      console.log(`Analytics calculated for ${timeRange} (${days} days): ${totalViews} total views, ${totalLikes} total likes across ${totalPitches} pitches`);
      console.log(`Top genres for ${timeRange}:`, topGenres.map(g => `${g.genre}: ${g.percentage}%`).join(', '));
      console.log(`User types for ${timeRange}:`, userTypes.map(u => `${u.type}: ${u.count}`).join(', '));
      console.log(`Top regions for ${timeRange}:`, topRegions.slice(0, 3).map(r => `${r.region}: ${r.count}`).join(', '));
      console.log(`Pitch performance for ${timeRange}:`, pitchPerformance.map(p => `${p.title}: ${p.views} views, ${p.likes} likes (${p.conversionRate}% conversion)`));
      console.log(`Top performer for ${timeRange}: ${pitchPerformance[0]?.title} with ${pitchPerformance[0]?.views} views`);

      return new Response(JSON.stringify({
        overview: {
          totalViews,
          totalLikes,
          totalComments: Math.floor(totalLikes * 0.3), // Simulate comments
          totalDownloads: Math.floor(totalViews * 0.05), // 5% download rate
          viewsThisMonth,
          likesThisMonth
        },
        pitchPerformance,
        viewsOverTime,
        audienceInsights: {
          topGenres,
          userTypes,
          topRegions
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error calculating analytics:", error);
      return new Response(JSON.stringify({ error: "Failed to calculate analytics" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Like/Unlike pitch endpoints
  if (url.pathname.startsWith("/api/creator/pitches/") && url.pathname.includes("/like") && method === "POST") {
    const pitchId = url.pathname.split("/")[4]; // Extract ID from /api/creator/pitches/{id}/like
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      console.log(`Liking pitch ${pitchIdInt}`);

      const pitch = getPitchById(pitchIdInt);
      
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Increment like count
      pitch.likeCount = (pitch.likeCount || 0) + 1;
      console.log(`Pitch ${pitchIdInt} like count updated to: ${pitch.likeCount}`);

      return new Response(JSON.stringify({ 
        success: true, 
        likeCount: pitch.likeCount,
        message: "Pitch liked successfully" 
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error liking pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to like pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  if (url.pathname.startsWith("/api/creator/pitches/") && url.pathname.includes("/unlike") && method === "POST") {
    const pitchId = url.pathname.split("/")[4]; // Extract ID from /api/creator/pitches/{id}/unlike
    if (!pitchId || isNaN(parseInt(pitchId))) {
      return new Response(JSON.stringify({ error: "Invalid pitch ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    try {
      const pitchIdInt = parseInt(pitchId);
      console.log(`Unliking pitch ${pitchIdInt}`);

      const pitch = getPitchById(pitchIdInt);
      
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      // Decrement like count (don't go below 0)
      pitch.likeCount = Math.max(0, (pitch.likeCount || 0) - 1);
      console.log(`Pitch ${pitchIdInt} like count updated to: ${pitch.likeCount}`);

      return new Response(JSON.stringify({ 
        success: true, 
        likeCount: pitch.likeCount,
        message: "Pitch unliked successfully" 
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      console.error("Error unliking pitch:", error);
      return new Response(JSON.stringify({ error: "Failed to unlike pitch" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // Creator Messages/Conversations endpoints
  if (url.pathname === "/api/creator/conversations" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Return mock conversations data for now
    return new Response(JSON.stringify({
      conversations: [
        {
          id: 1,
          participantName: "Sarah Investor",
          participantType: "investor",
          lastMessage: "I'm very interested in your sci-fi project. Can we schedule a call?",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          unreadCount: 2,
          pitchTitle: "Quantum Leap"
        },
        {
          id: 2,
          participantName: "Stellar Productions",
          participantType: "production",
          lastMessage: "Thanks for submitting. We'll review and get back to you within 48 hours.",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          unreadCount: 0,
          pitchTitle: "Action Thriller"
        }
      ]
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Get conversation messages
  if (url.pathname.startsWith("/api/creator/conversations/") && url.pathname.endsWith("/messages") && method === "GET") {
    const pathParts = url.pathname.split("/");
    const conversationId = pathParts[pathParts.length - 2];
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Mock messages for demo
    const mockMessages = [
      {
        id: 1,
        senderId: 1002,
        senderName: "Sarah Investor",
        senderType: "investor",
        subject: "Interest in Quantum Leap",
        message: "Hi! I'm very interested in your sci-fi project. The concept is fascinating.",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        hasAttachment: false,
        priority: "normal"
      },
      {
        id: 2,
        senderId: 1,
        senderName: "You",
        senderType: "creator",
        subject: "Re: Interest in Quantum Leap",
        message: "Thank you for your interest! I'd love to discuss this further. When would be a good time for a call?",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        isRead: true,
        hasAttachment: false,
        priority: "normal"
      },
      {
        id: 3,
        senderId: 1002,
        senderName: "Sarah Investor",
        senderType: "investor",
        subject: "Re: Interest in Quantum Leap",
        message: "How about tomorrow at 2 PM? I can set up a Zoom call. Also, do you have a pitch deck ready?",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isRead: false,
        hasAttachment: false,
        priority: "high"
      }
    ];

    return new Response(JSON.stringify({ messages: mockMessages }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Send message
  if (url.pathname.startsWith("/api/creator/conversations/") && url.pathname.endsWith("/messages") && method === "POST") {
    const pathParts = url.pathname.split("/");
    const conversationId = pathParts[pathParts.length - 2];
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || message.trim() === '') {
      return new Response(JSON.stringify({ error: "Message cannot be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Mock new message response
    const newMessage = {
      id: Date.now(),
      senderId: 1,
      senderName: "You",
      senderType: "creator",
      message: message.trim(),
      timestamp: new Date().toISOString(),
      isRead: true,
      hasAttachment: false,
      priority: "normal"
    };

    console.log(`Message sent in conversation ${conversationId}:`, message);

    return new Response(JSON.stringify({ 
      message: newMessage,
      success: true 
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Mark conversation as read
  if (url.pathname.startsWith("/api/creator/conversations/") && url.pathname.endsWith("/read") && method === "POST") {
    const pathParts = url.pathname.split("/");
    const conversationId = pathParts[pathParts.length - 2];
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(`Conversation ${conversationId} marked as read`);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Conversation marked as read"
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Creator Calendar events endpoint
  if (url.pathname === "/api/creator/calendar/events" && method === "GET") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Return mock calendar events for now
    const today = new Date();
    const events = [];
    
    // Generate some sample events
    for (let i = 0; i < 10; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + Math.floor(Math.random() * 30) - 15);
      
      events.push({
        id: i + 1,
        title: ["Investor Meeting", "Script Review", "Pitch Presentation", "Production Call"][Math.floor(Math.random() * 4)],
        type: ["meeting", "deadline", "presentation", "call"][Math.floor(Math.random() * 4)],
        date: eventDate.toISOString().split('T')[0],
        startTime: "14:00",
        endTime: "15:00",
        participants: ["Sarah Investor", "Stellar Productions", "Creative Director"],
        pitchTitle: ["Quantum Leap", "Action Thriller", "Comedy Series"][Math.floor(Math.random() * 3)],
        isVirtual: Math.random() > 0.5,
        meetingLink: Math.random() > 0.5 ? "https://meet.google.com/abc-defg-hij" : undefined
      });
    }

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // PUBLIC API ENDPOINTS - No authentication required

  // Public pitches endpoint for marketplace
  if (url.pathname === "/api/pitches" && method === "GET") {
    try {
      const params = new URLSearchParams(url.search);
      const page = parseInt(params.get("page") || "1");
      const limit = parseInt(params.get("limit") || "20");
      const genre = params.get("genre");
      const format = params.get("format");
      const search = params.get("search");
      
      let filteredPitches = mockPitchesData.filter(pitch => pitch.status === "published");
      
      // Apply filters
      if (genre) {
        filteredPitches = filteredPitches.filter(pitch => 
          pitch.genre.toLowerCase().includes(genre.toLowerCase())
        );
      }
      
      if (format) {
        filteredPitches = filteredPitches.filter(pitch => 
          pitch.format.toLowerCase().includes(format.toLowerCase())
        );
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPitches = filteredPitches.filter(pitch => 
          pitch.title.toLowerCase().includes(searchLower) ||
          pitch.logline.toLowerCase().includes(searchLower) ||
          pitch.genre.toLowerCase().includes(searchLower)
        );
      }
      
      // Add creator info to each pitch
      const pitchesWithCreator = filteredPitches.map(pitch => ({
        ...pitch,
        creator: {
          id: 1001,
          username: "AlexFilmmaker",
          userType: "creator"
        }
      }));
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPitches = pitchesWithCreator.slice(startIndex, endIndex);
      
      return new Response(JSON.stringify(paginatedPitches), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // NDA signing endpoint (direct signing, bypasses request/approval flow)
  if (url.pathname.match(/^\/api\/pitches\/(\d+)\/nda$/) && method === "POST") {
    try {
      const pitchId = parseInt(url.pathname.split("/")[3]);
      console.log(`NDA signing endpoint called for pitch ${pitchId}`);
      
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);

      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const body = await req.json();
      const { ndaType = "basic" } = body;

      // Check if pitch exists
      const pitch = mockPitchesData.find(p => p.id === pitchId);
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      const ndaData = await loadNDAData();
      
      // Check if NDA already signed
      const existingNDA = ndaData.signedNDAs.find(nda => 
        nda.pitchId === pitchId && nda.signerId === userId
      );

      if (existingNDA) {
        return createJSONResponse({
          success: true,
          message: "NDA already signed",
          hasSignedNDA: true,
          ndaStatus: "signed",
          nda: existingNDA
        });
      }

      // Create signed NDA directly
      const signedNDA: SignedNDA = {
        id: ndaData.nextNDAId++,
        pitchId,
        signerId: userId,
        ndaType,
        signedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        accessGranted: true,
      };

      ndaData.signedNDAs.push(signedNDA);
      
      // Also maintain the in-memory map for backward compatibility
      const ndaKey = `${userId}_${pitchId}`;
      signedNDAs.set(ndaKey, {
        userId,
        pitchId,
        signedAt: signedNDA.signedAt,
        expiresAt: signedNDA.expiresAt
      });

      await saveNDAData(ndaData);
      
      console.log(`NDA signed for user ${userId} on pitch ${pitchId}`);
      
      return createJSONResponse({
        success: true,
        message: "NDA signed successfully",
        hasSignedNDA: true,
        ndaStatus: "signed",
        nda: signedNDA
      }, 201);
    } catch (error) {
      console.error("Error signing NDA:", error);
      return createErrorResponse("Internal server error", 500, "NDA_SIGN_ERROR");
    }
  }
  
  // Check NDA status endpoint
  if (url.pathname.match(/^\/api\/pitches\/(\d+)\/nda\/status$/) && method === "GET") {
    try {
      const pitchId = parseInt(url.pathname.split("/")[3]);
      
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createJSONResponse({ 
          hasSignedNDA: false, 
          ndaStatus: "none" 
        });
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);

      if (!payload) {
        return createJSONResponse({ 
          hasSignedNDA: false, 
          ndaStatus: "none" 
        });
      }

      const userId = payload.sub || payload.userId;
      
      // Check file-backed storage first
      const ndaData = await loadNDAData();
      const signedNDA = ndaData.signedNDAs.find(nda => 
        nda.pitchId === pitchId && nda.signerId === userId
      );
      
      // Also check pending requests
      const pendingRequest = ndaData.requests.find(r => 
        r.pitchId === pitchId && 
        r.requesterId === userId && 
        r.status === "pending"
      );

      let ndaStatus = "none";
      let hasSignedNDA = false;

      if (signedNDA) {
        hasSignedNDA = true;
        // Check if expired
        const now = new Date();
        const expiresAt = new Date(signedNDA.expiresAt);
        ndaStatus = expiresAt > now ? "signed" : "expired";
      } else if (pendingRequest) {
        ndaStatus = "pending";
      }
      
      return createJSONResponse({ 
        hasSignedNDA,
        ndaStatus,
        ...(signedNDA && { signedAt: signedNDA.signedAt, expiresAt: signedNDA.expiresAt }),
        ...(pendingRequest && { requestedAt: pendingRequest.requestedAt })
      });
    } catch (error) {
      console.error("Error checking NDA status:", error);
      return createJSONResponse({ 
        hasSignedNDA: false, 
        ndaStatus: "none",
        error: "Failed to check NDA status"
      });
    }
  }
  
  // Public trending pitches endpoint
  if (url.pathname === "/api/trending" && method === "GET") {
    try {
      const creatorTypes = [
        { id: 1001, username: "AlexFilmmaker", userType: "creator" },
        { id: 1002, username: "WarnerProd", userType: "production", companyName: "Warner Productions" },
        { id: 1003, username: "SilverScreen", userType: "investor", companyName: "Silver Screen Ventures" },
        { id: 1004, username: "JohnDoe", userType: "creator" },
        { id: 1005, username: "UniversalStudios", userType: "production", companyName: "Universal Studios" },
        { id: 1006, username: "CreativeVentures", userType: "investor", companyName: "Creative Capital" },
        { id: 1007, username: "IndieMaker", userType: "creator" },
        { id: 1008, username: "A24Films", userType: "production", companyName: "A24" }
      ];
      
      const publishedPitches = mockPitchesData
        .filter(pitch => pitch.status === "published")
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10)
        .map(pitch => ({
          ...pitch,
          creator: creatorTypes[(pitch.id - 1) % creatorTypes.length]
        }));
      
      return new Response(JSON.stringify(publishedPitches), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Public individual pitch endpoint with NDA support
  const pitchMatch = url.pathname.match(/^\/api\/pitches\/(\d+)$/);
  if (pitchMatch && method === "GET") {
    try {
      const pitchId = parseInt(pitchMatch[1]);
      const pitch = getPitchById(pitchId);
      
      if (!pitch || pitch.status !== "published") {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }
      
      // Check if user has signed NDA for this pitch
      const authHeader = req.headers.get("Authorization");
      let hasSignedNDA = false;
      let userId = null;
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = await verifyToken(token);
        if (payload) {
          userId = payload.sub || payload.userId;
          const ndaKey = `${userId}_${pitchId}`;
          hasSignedNDA = signedNDAs.has(ndaKey);
          console.log(`Checking NDA for user ${userId} on pitch ${pitchId}: ${hasSignedNDA}`);
          console.log(`Current signed NDAs:`, Array.from(signedNDAs.keys()));
        }
      }
      
      // Define creator types (same as in public pitches endpoint)
      const creatorTypes = [
        { id: 1001, username: "AlexFilmmaker", userType: "creator" },
        { id: 1002, username: "WarnerProd", userType: "production", companyName: "Warner Productions" },
        { id: 1003, username: "SilverScreen", userType: "investor", companyName: "Silver Screen Ventures" },
        { id: 1004, username: "JohnDoe", userType: "creator" },
        { id: 1005, username: "UniversalStudios", userType: "production", companyName: "Universal Studios" },
        { id: 1006, username: "CreativeVentures", userType: "investor", companyName: "Creative Capital" },
        { id: 1007, username: "IndieMaker", userType: "creator" },
        { id: 1008, username: "A24Films", userType: "production", companyName: "A24" }
      ];
      
      // Base pitch data (always visible)
      const pitchWithCreator = {
        id: pitch.id,
        title: pitch.title,
        genre: pitch.genre,
        format: pitch.format,
        logline: pitch.logline,
        shortSynopsis: pitch.shortSynopsis,
        status: pitch.status,
        viewCount: pitch.viewCount,
        likeCount: pitch.likeCount,
        createdAt: pitch.createdAt,
        updatedAt: pitch.updatedAt,
        publishedAt: pitch.publishedAt,
        creator: creatorTypes[(pitch.id - 1) % creatorTypes.length],
        hasSignedNDA,
        ndaStatus: hasSignedNDA ? "signed" : "none"
      };
      
      // Add enhanced data if NDA is signed
      if (hasSignedNDA) {
        console.log(`Adding enhanced data for pitch ${pitchId} - user ${userId} has signed NDA`);
        pitchWithCreator.scriptUrl = pitch.scriptUrl;
        pitchWithCreator.trailerUrl = pitch.trailerUrl;
        pitchWithCreator.lookbookUrl = pitch.lookbookUrl;
        pitchWithCreator.pitchDeckUrl = pitch.pitchDeckUrl;
        pitchWithCreator.budget = pitch.budget;
        pitchWithCreator.budgetBreakdown = pitch.budgetBreakdown;
        pitchWithCreator.targetAudience = pitch.targetAudience;
        pitchWithCreator.comparableTitles = pitch.comparableTitles;
        pitchWithCreator.productionTimeline = pitch.productionTimeline;
        pitchWithCreator.attachedTalent = pitch.attachedTalent;
        pitchWithCreator.distributionStrategy = pitch.distributionStrategy;
        console.log(`Enhanced data fields added:`, {
          budget: pitchWithCreator.budget,
          targetAudience: pitchWithCreator.targetAudience,
          attachedTalent: pitchWithCreator.attachedTalent
        });
      } else {
        console.log(`Not adding enhanced data for pitch ${pitchId} - user ${userId} has NOT signed NDA`);
      }
      
      return new Response(JSON.stringify(pitchWithCreator), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }

  // NDA Request endpoints
  if (url.pathname === "/api/ndas/request" && method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const body = await req.json();
      
      const validation = validateNDARequest(body);
      if (!validation.isValid) {
        return createErrorResponse(validation.error, 400, "VALIDATION_ERROR");
      }

      const { pitchId, ndaType = "basic", requestMessage, companyInfo } = body;

      // Check if pitch exists
      const pitch = mockPitchesData.find(p => p.id === pitchId);
      if (!pitch) {
        return createErrorResponse("Pitch not found", 404, "PITCH_NOT_FOUND");
      }

      const ndaData = await loadNDAData();

      // Check if request already exists
      const existingRequest = ndaData.requests.find(r => 
        r.pitchId === pitchId && 
        r.requesterId === userId && 
        r.status === "pending"
      );

      if (existingRequest) {
        return createErrorResponse("Request already pending", 400, "DUPLICATE_REQUEST");
      }

      // Create new NDA request
      const newRequest: NDARequest = {
        id: ndaData.nextRequestId++,
        pitchId,
        requesterId: userId,
        ownerId: 1001, // Mock pitch owner for now
        ndaType,
        requestMessage,
        companyInfo,
        status: "pending",
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      ndaData.requests.push(newRequest);
      await saveNDAData(ndaData);

      return createJSONResponse({
        success: true,
        request: newRequest,
      }, 201);
    } catch (error) {
      console.error("Error creating NDA request:", error);
      return createErrorResponse("Internal server error", 500, "NDA_REQUEST_ERROR");
    }
  }

  if (url.pathname === "/api/ndas/request" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const type = url.searchParams.get("type") || "outgoing";

      const ndaData = await loadNDAData();
      let requests;

      if (type === "incoming") {
        // Get requests for pitches owned by user
        requests = ndaData.requests.filter(r => r.ownerId === userId);
      } else {
        // Get requests made by user
        requests = ndaData.requests.filter(r => r.requesterId === userId);
      }

      return createJSONResponse({
        success: true,
        requests,
      });
    } catch (error) {
      console.error("Error fetching NDA requests:", error);
      return createErrorResponse("Internal server error", 500, "NDA_FETCH_ERROR");
    }
  }

  // NDA Approval/Rejection endpoints
  if (url.pathname.match(/^\/api\/ndas\/(\d+)\/approve$/) && method === "POST") {
    try {
      const requestId = parseInt(url.pathname.split("/")[3]);
      
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      const request = ndaData.requests.find(r => r.id === requestId);
      if (!request) {
        return createErrorResponse("Request not found", 404, "REQUEST_NOT_FOUND");
      }

      if (request.ownerId !== userId) {
        return createErrorResponse("Unauthorized", 403, "ACCESS_DENIED");
      }

      if (request.status !== "pending") {
        return createErrorResponse("Request already processed", 400, "ALREADY_PROCESSED");
      }

      // Update request status
      request.status = "approved";
      request.respondedAt = new Date().toISOString();

      // Create signed NDA
      const signedNDA: SignedNDA = {
        id: ndaData.nextNDAId++,
        pitchId: request.pitchId,
        signerId: request.requesterId,
        ndaType: request.ndaType,
        signedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        accessGranted: true,
      };

      ndaData.signedNDAs.push(signedNDA);
      await saveNDAData(ndaData);

      return createJSONResponse({
        success: true,
        message: "NDA request approved",
      });
    } catch (error) {
      console.error("Error approving NDA request:", error);
      return createErrorResponse("Internal server error", 500, "NDA_APPROVE_ERROR");
    }
  }

  if (url.pathname.match(/^\/api\/ndas\/(\d+)\/reject$/) && method === "POST") {
    try {
      const requestId = parseInt(url.pathname.split("/")[3]);
      
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const body = await req.json();
      const { rejectionReason } = body;

      const ndaData = await loadNDAData();
      const request = ndaData.requests.find(r => r.id === requestId);

      if (!request) {
        return createErrorResponse("Request not found", 404, "REQUEST_NOT_FOUND");
      }

      if (request.ownerId !== userId) {
        return createErrorResponse("Unauthorized", 403, "ACCESS_DENIED");
      }

      if (request.status !== "pending") {
        return createErrorResponse("Request already processed", 400, "ALREADY_PROCESSED");
      }

      // Update request status
      request.status = "rejected";
      request.rejectionReason = rejectionReason;
      request.respondedAt = new Date().toISOString();

      await saveNDAData(ndaData);

      return createJSONResponse({
        success: true,
        message: "NDA request rejected",
      });
    } catch (error) {
      console.error("Error rejecting NDA request:", error);
      return createErrorResponse("Internal server error", 500, "NDA_REJECT_ERROR");
    }
  }

  if (url.pathname === "/api/ndas/signed" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      // Get signed NDAs for the user
      const signedNDAs = ndaData.signedNDAs.filter(nda => nda.signerId === userId);
      
      // Get incoming signed NDAs (for pitches owned by user)
      const incomingSignedNDAs = ndaData.signedNDAs.filter(nda => {
        const pitch = mockPitchesData.find(p => p.id === nda.pitchId);
        return pitch && pitch.id === nda.pitchId; // Mock logic - would check pitch ownership
      });

      return createJSONResponse({
        success: true,
        signedNDAs,
        incomingSignedNDAs,
        totalSigned: signedNDAs.length,
        totalIncoming: incomingSignedNDAs.length,
      });
    } catch (error) {
      console.error("Error fetching signed NDAs:", error);
      return createErrorResponse("Internal server error", 500, "NDA_SIGNED_FETCH_ERROR");
    }
  }

  // New categorized NDA endpoints for enhanced dashboard
  if (url.pathname === "/api/ndas/incoming-signed" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      // Get incoming signed NDAs (for pitches owned by user)
      const incomingSignedNDAs = ndaData.signedNDAs.filter(nda => {
        const pitch = mockPitchesData.find(p => p.id === nda.pitchId);
        // In a real implementation, we'd check if the user owns the pitch
        // For now, we'll use a simple ownership simulation
        return pitch && (pitch.id % 3 === userId % 3); // Mock ownership logic
      }).map(nda => {
        const pitch = mockPitchesData.find(p => p.id === nda.pitchId);
        return {
          ...nda,
          pitchTitle: pitch?.title || `Pitch ${nda.pitchId}`,
          // Add mock signer details if not present
          signerName: nda.signerName || `User ${nda.signerId}`,
          signerType: nda.signerType || 'creator',
          signerCompany: nda.signerCompany || null,
        };
      });

      return createJSONResponse({
        success: true,
        ndas: incomingSignedNDAs,
        count: incomingSignedNDAs.length,
      });
    } catch (error) {
      console.error("Error fetching incoming signed NDAs:", error);
      return createErrorResponse("Internal server error", 500, "NDA_INCOMING_SIGNED_FETCH_ERROR");
    }
  }

  if (url.pathname === "/api/ndas/outgoing-signed" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      // Get signed NDAs for the user (outgoing - NDAs they signed)
      const outgoingSignedNDAs = ndaData.signedNDAs.filter(nda => nda.signerId === userId).map(nda => {
        const pitch = mockPitchesData.find(p => p.id === nda.pitchId);
        return {
          ...nda,
          pitchTitle: pitch?.title || `Pitch ${nda.pitchId}`,
          // Add mock creator details
          creator: `Creator ${nda.pitchId}`,
          creatorType: 'creator',
          companyName: `Company ${nda.pitchId}`,
        };
      });

      return createJSONResponse({
        success: true,
        ndas: outgoingSignedNDAs,
        count: outgoingSignedNDAs.length,
      });
    } catch (error) {
      console.error("Error fetching outgoing signed NDAs:", error);
      return createErrorResponse("Internal server error", 500, "NDA_OUTGOING_SIGNED_FETCH_ERROR");
    }
  }

  if (url.pathname === "/api/ndas/incoming-requests" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      // Get incoming NDA requests (requests for user's pitches)
      const incomingRequests = ndaData.requests.filter(request => {
        const pitch = mockPitchesData.find(p => p.id === request.pitchId);
        // Mock ownership logic - in real implementation, check pitch.ownerId === userId
        return pitch && (pitch.id % 3 === userId % 3) && request.status === 'pending';
      }).map(request => {
        const pitch = mockPitchesData.find(p => p.id === request.pitchId);
        return {
          ...request,
          pitchTitle: pitch?.title || `Pitch ${request.pitchId}`,
          requester: `User ${request.requesterId}`,
          requesterType: 'creator',
          companyName: `Company ${request.requesterId}`,
        };
      });

      return createJSONResponse({
        success: true,
        requests: incomingRequests,
        count: incomingRequests.length,
      });
    } catch (error) {
      console.error("Error fetching incoming NDA requests:", error);
      return createErrorResponse("Internal server error", 500, "NDA_INCOMING_REQUESTS_FETCH_ERROR");
    }
  }

  if (url.pathname === "/api/ndas/outgoing-requests" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return createErrorResponse("Unauthorized", 401, "AUTH_REQUIRED");
      }

      const token = authHeader.substring(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return createErrorResponse("Invalid token", 401, "INVALID_TOKEN");
      }

      const userId = payload.sub || payload.userId;
      const ndaData = await loadNDAData();

      // Get outgoing NDA requests (requests made by the user)
      const outgoingRequests = ndaData.requests.filter(request => 
        request.requesterId === userId && request.status === 'pending'
      ).map(request => {
        const pitch = mockPitchesData.find(p => p.id === request.pitchId);
        return {
          ...request,
          pitchTitle: pitch?.title || `Pitch ${request.pitchId}`,
          creator: `Creator ${request.pitchId}`,
          creatorType: 'creator',
          companyName: `Company ${request.pitchId}`,
        };
      });

      return createJSONResponse({
        success: true,
        requests: outgoingRequests,
        count: outgoingRequests.length,
      });
    } catch (error) {
      console.error("Error fetching outgoing NDA requests:", error);
      return createErrorResponse("Internal server error", 500, "NDA_OUTGOING_REQUESTS_FETCH_ERROR");
    }
  }

  if (url.pathname === "/api/analytics/dashboard" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalViews: 0,
        totalLikes: 0,
        totalNDAs: 0,
        totalFollowing: 0
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  if (url.pathname === "/api/analytics/realtime" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      activities: []
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  if (url.pathname === "/api/follows/following" && method === "GET") {
    try {
      const userId = url.searchParams.get('userId');

      if (!userId) {
        return createJSONResponse({
          success: false,
          error: "userId parameter is required"
        }, 400);
      }

      const follows = await getUserFollows(parseInt(userId));
      
      // Get actual pitch and creator data for the followed items
      const followedPitches = mockPitchesData.filter(pitch => follows.pitches.includes(pitch.id));
      const followedCreators = mockCreators.filter(creator => follows.creators.includes(creator.id));

      return createJSONResponse({
        success: true,
        pitches: followedPitches.map(pitch => ({
          id: pitch.id,
          title: pitch.title,
          description: pitch.description,
          genre: pitch.genre,
          budget: pitch.budget,
          stage: pitch.stage,
          creatorId: pitch.creatorId,
          createdAt: pitch.createdAt,
          updatedAt: pitch.updatedAt
        })),
        creators: followedCreators.map(creator => ({
          id: creator.id,
          name: creator.name,
          email: creator.email,
          bio: creator.bio,
          portfolio: creator.portfolio,
          experience: creator.experience,
          location: creator.location,
          genres: creator.genres
        })),
        total: followedPitches.length + followedCreators.length
      });
    } catch (error) {
      console.error('Error in following endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to get following list"
      }, 500);
    }
  }

  // Follow check endpoint
  if (url.pathname === "/api/follows/check" && method === "GET") {
    try {
      const userId = url.searchParams.get('userId');
      const creatorId = url.searchParams.get('creatorId');
      const pitchId = url.searchParams.get('pitchId');

      if (!userId) {
        return createJSONResponse({
          success: false,
          error: "userId parameter is required"
        }, 400);
      }

      let isFollowingCreator = false;
      let isFollowingPitch = false;

      if (creatorId) {
        isFollowingCreator = await isFollowing(parseInt(userId), parseInt(creatorId), 'creator');
      }

      if (pitchId) {
        isFollowingPitch = await isFollowing(parseInt(userId), parseInt(pitchId), 'pitch');
      }

      return createJSONResponse({
        success: true,
        isFollowing: isFollowingCreator || isFollowingPitch,
        isFollowingCreator,
        isFollowingPitch,
        creatorId: creatorId ? parseInt(creatorId) : null,
        pitchId: pitchId ? parseInt(pitchId) : null
      });
    } catch (error) {
      console.error('Error in follow check endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to check follow status"
      }, 500);
    }
  }

  // Follow/unfollow endpoint
  if (url.pathname === "/api/follows/follow" && method === "POST") {
    try {
      const body = await req.json();
      const { userId, targetId, type } = body;

      if (!userId || !targetId || !type) {
        return createJSONResponse({
          success: false,
          error: "Missing required fields: userId, targetId, type"
        }, 400);
      }

      if (!['creator', 'pitch'].includes(type)) {
        return createJSONResponse({
          success: false,
          error: "Invalid type. Must be 'creator' or 'pitch'"
        }, 400);
      }

      const follow = await addFollow(userId, targetId, type);
      
      return createJSONResponse({
        success: true,
        message: "Followed successfully",
        isFollowing: true,
        follow: {
          id: follow.id,
          targetId: follow.targetId,
          type: follow.type,
          followedAt: follow.followedAt
        }
      });
    } catch (error) {
      console.error('Error in follow endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to process follow request"
      }, 500);
    }
  }

  if (url.pathname === "/api/follows/follow" && method === "DELETE") {
    try {
      const body = await req.json();
      const { userId, targetId, type } = body;

      if (!userId || !targetId || !type) {
        return createJSONResponse({
          success: false,
          error: "Missing required fields: userId, targetId, type"
        }, 400);
      }

      if (!['creator', 'pitch'].includes(type)) {
        return createJSONResponse({
          success: false,
          error: "Invalid type. Must be 'creator' or 'pitch'"
        }, 400);
      }

      const wasRemoved = await removeFollow(userId, targetId, type);
      
      return createJSONResponse({
        success: true,
        message: wasRemoved ? "Unfollowed successfully" : "Not following this target",
        isFollowing: false,
        wasRemoved
      });
    } catch (error) {
      console.error('Error in unfollow endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to process unfollow request"
      }, 500);
    }
  }

  // Payment endpoints
  if (url.pathname === "/api/payments/credits/balance" && method === "GET") {
    try {
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return createJSONResponse({
          success: false,
          error: "userId parameter is required"
        }, 400);
      }

      // Mock credit balance data - could be replaced with real storage later
      return createJSONResponse({
        success: true,
        balance: 100,
        currency: "USD",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in credits balance endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to get credit balance"
      }, 500);
    }
  }

  if (url.pathname === "/api/payments/subscription-status" && method === "GET") {
    try {
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return createJSONResponse({
          success: false,
          error: "userId parameter is required"
        }, 400);
      }

      // Mock subscription status data - could be replaced with real storage later
      return createJSONResponse({
        success: true,
        subscription: {
          status: "active",
          plan: "pro",
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-12-31T23:59:59Z",
          autoRenew: true,
          features: ["unlimited_pitches", "advanced_analytics", "priority_support"]
        }
      });
    } catch (error) {
      console.error('Error in subscription status endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to get subscription status"
      }, 500);
    }
  }

  // Followed pitches endpoint
  if (url.pathname === "/api/pitches/following" && method === "GET") {
    try {
      const userId = url.searchParams.get('userId');

      if (!userId) {
        return createJSONResponse({
          success: false,
          error: "userId parameter is required"
        }, 400);
      }

      const follows = await getUserFollows(parseInt(userId));
      const followedPitches = mockPitchesData.filter(pitch => follows.pitches.includes(pitch.id));

      return createJSONResponse({
        success: true,
        pitches: followedPitches.map(pitch => ({
          id: pitch.id,
          title: pitch.title,
          description: pitch.description || pitch.shortSynopsis,
          logline: pitch.logline,
          genre: pitch.genre,
          format: pitch.format,
          budget: pitch.budget,
          stage: pitch.stage,
          status: pitch.status,
          viewCount: pitch.viewCount || 0,
          likeCount: pitch.likeCount || 0,
          creatorId: pitch.creatorId,
          creator: {
            id: pitch.creatorId || 1001,
            username: pitch.creatorName || "Alex Chen",
            companyName: pitch.companyName || "Visionary Films",
            userType: 'creator'
          },
          createdAt: pitch.createdAt,
          updatedAt: pitch.updatedAt,
          mediaCount: pitch.media?.length || 0,
          ndaStatus: 'none' // Or check actual NDA status
        })),
        total: followedPitches.length
      });
    } catch (error) {
      console.error('Error in followed pitches endpoint:', error);
      return createJSONResponse({
        success: false,
        error: "Failed to get followed pitches"
      }, 500);
    }
  }

  // Default 404
  return new Response("Not Found", { 
    status: 404,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
};

// Initialize demo accounts before starting server
await initializeDemoAccounts();

console.log(`🚀 Multi-portal server running on http://localhost:${port}`);
console.log(`
📌 Portal Login Endpoints:
   - Creator: http://localhost:${port}/api/auth/creator/login
   - Investor: http://localhost:${port}/api/auth/investor/login
   - Production: http://localhost:${port}/api/auth/production/login

🔐 Demo Accounts:
   - Creator: alex.filmmaker@demo.com / Demo123456
   - Investor: sarah.investor@demo.com / Demo123456
   - Production: stellar.productions@demo.com / Demo123456
`);

await serve(handler, { 
  port: Number(port),
  hostname: "0.0.0.0"
});