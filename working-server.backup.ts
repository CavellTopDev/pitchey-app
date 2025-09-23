// Working multi-portal authentication server for Pitchey v0.2
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const port = Deno.env.get("PORT") || "8000";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-this-in-production";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// In-memory storage with comprehensive demo data
const mockPitchesData = [
  {
    id: 1,
    title: "The Last Frontier",
    logline: "A gripping sci-fi thriller about humanity's final stand on Mars.",
    genre: "Sci-Fi",
    format: "Feature Film",
    budget: "$5M-$10M",
    budgetAmount: 7500000,
    status: "In Development",
    stage: "pre-production",
    creator: {
      id: "creator-demo-id",
      username: "alex_filmmaker",
      name: "Alex Chen",
      userType: "creator",
      companyName: "Rodriguez Films",
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
    },
    creatorId: "creator-demo-id",
    views: 1250,
    likes: 89,
    thumbnail: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=300&fit=crop",
    description: "Set in 2087, humanity faces extinction as Earth becomes uninhabitable. The last colony on Mars holds the key to survival, but corporate greed and political corruption threaten the final evacuation mission. Commander Sarah Chen must navigate treacherous alliances and make impossible choices to save the human race.",
    targetAudience: "Sci-fi enthusiasts, thriller fans aged 18-54",
    timeline: "18 months",
    fundingGoal: 7500000,
    currentFunding: 2250000,
    fundingProgress: 30,
    investorCount: 12,
    team: [
      { name: "Alex Chen", role: "Director/Writer", experience: "15 years" },
      { name: "Maria Rodriguez", role: "Producer", experience: "20 years" },
      { name: "James Park", role: "Cinematographer", experience: "12 years" }
    ],
    attachments: [
      { type: "script", name: "The_Last_Frontier_Script.pdf", size: "2.4 MB" },
      { type: "pitch_deck", name: "Pitch_Deck_v3.pdf", size: "15.8 MB" },
      { type: "budget", name: "Production_Budget.xlsx", size: "890 KB" }
    ],
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 2,
    title: "Echoes of Tomorrow",
    logline: "A time-travel drama exploring the consequences of changing the past.",
    genre: "Drama",
    format: "Limited Series",
    budget: "$2M-$5M",
    budgetAmount: 3500000,
    status: "Pitching",
    stage: "development",
    creator: {
      id: "creator-2",
      username: "sarah_williams",
      name: "Sarah Williams",
      userType: "creator",
      companyName: "Williams Productions",
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
    },
    creatorId: "creator-2",
    views: 890,
    likes: 67,
    thumbnail: "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=400&h=300&fit=crop",
    description: "When Dr. Elena Vasquez discovers a way to send consciousness back in time, she attempts to prevent a global catastrophe. But each change creates ripple effects that threaten to unravel the fabric of reality itself. A 6-episode limited series exploring the butterfly effect and the weight of our choices.",
    targetAudience: "Drama lovers, sci-fi fans, streaming audiences 25-65",
    timeline: "12 months",
    fundingGoal: 3500000,
    currentFunding: 1400000,
    fundingProgress: 40,
    investorCount: 8,
    team: [
      { name: "Sarah Williams", role: "Creator/Showrunner", experience: "18 years" },
      { name: "David Kim", role: "Executive Producer", experience: "25 years" },
      { name: "Rebecca Jones", role: "Lead Writer", experience: "10 years" }
    ],
    attachments: [
      { type: "treatment", name: "Series_Treatment_v2.pdf", size: "3.2 MB" },
      { type: "pilot_script", name: "Episode_1_Script.pdf", size: "1.8 MB" },
      { type: "series_bible", name: "Series_Bible.pdf", size: "8.4 MB" }
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 3,
    title: "Urban Legends",
    logline: "A supernatural horror anthology series based on modern urban legends.",
    genre: "Horror",
    format: "Series",
    budget: "$1M-$3M",
    budgetAmount: 2000000,
    status: "Funded",
    stage: "production",
    creator: {
      id: "creator-3",
      username: "mike_horror",
      name: "Mike Horror",
      userType: "creator",
      companyName: "Horror Productions",
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike"
    },
    creatorId: "creator-3",
    views: 2150,
    likes: 134,
    thumbnail: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
    description: "Each episode brings a different urban legend to life with a modern twist. From the vanishing hitchhiker to the calls coming from inside the house, this anthology series explores our deepest fears through contemporary storytelling.",
    targetAudience: "Horror fans, young adults 18-35",
    timeline: "8 months",
    fundingGoal: 2000000,
    currentFunding: 2000000,
    fundingProgress: 100,
    investorCount: 15,
    team: [
      { name: "Mike Horror", role: "Creator/Director", experience: "12 years" },
      { name: "Lisa Chen", role: "Producer", experience: "16 years" },
      { name: "Tom Bradley", role: "Co-Writer", experience: "8 years" }
    ],
    attachments: [
      { type: "series_outline", name: "Series_Outline.pdf", size: "4.1 MB" },
      { type: "episode_scripts", name: "Episodes_1-3_Scripts.pdf", size: "6.2 MB" },
      { type: "visual_references", name: "Visual_Mood_Board.pdf", size: "12.3 MB" }
    ],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 4,
    title: "Digital Dreams",
    logline: "A cyberpunk thriller set in a world where dreams can be hacked and stolen.",
    genre: "Thriller",
    format: "Feature Film",
    budget: "$8M-$12M",
    budgetAmount: 10000000,
    status: "Pitching",
    stage: "development",
    creator: {
      id: "creator-4",
      username: "neo_vision",
      name: "Neo Vision",
      userType: "creator",
      companyName: "Vision Productions",
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=neo"
    },
    creatorId: "creator-4",
    views: 1876,
    likes: 156,
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop",
    description: "In 2045, dream extraction technology allows corporations to harvest and sell human dreams. When a young hacker discovers a conspiracy to control human consciousness, she must enter the most dangerous dreamscape ever created to expose the truth.",
    targetAudience: "Cyberpunk fans, thriller enthusiasts, tech-savvy audiences 16-45",
    timeline: "24 months",
    fundingGoal: 10000000,
    currentFunding: 3000000,
    fundingProgress: 30,
    investorCount: 18,
    team: [
      { name: "Neo Vision", role: "Director/Writer", experience: "14 years" },
      { name: "Alex Turner", role: "Producer", experience: "22 years" },
      { name: "Zoe Martinez", role: "VFX Supervisor", experience: "18 years" }
    ],
    attachments: [
      { type: "script", name: "Digital_Dreams_Final_Draft.pdf", size: "2.8 MB" },
      { type: "concept_art", name: "Concept_Art_Collection.pdf", size: "25.4 MB" },
      { type: "vfx_breakdown", name: "VFX_Breakdown.pdf", size: "4.7 MB" }
    ],
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 5,
    title: "The Art of Silence",
    logline: "A deaf artist discovers she can paint sounds, revealing hidden truths about her community.",
    genre: "Drama",
    format: "Feature Film",
    budget: "$500K-$2M",
    budgetAmount: 1250000,
    status: "Seeking Funding",
    stage: "pre-production",
    creator: {
      id: "creator-5",
      username: "lisa_storyteller",
      name: "Lisa Storyteller",
      userType: "creator",
      companyName: "Storyteller Studios",
      profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=lisa"
    },
    creatorId: "creator-5",
    views: 945,
    likes: 78,
    thumbnail: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop",
    description: "Maya, a talented deaf artist, begins experiencing synesthetic episodes where she can visually perceive sounds as colors and shapes. As she paints these visions, they reveal secrets about her small town that some would prefer to keep buried.",
    targetAudience: "Art film lovers, drama enthusiasts, accessibility advocates 25-55",
    timeline: "15 months",
    fundingGoal: 1250000,
    currentFunding: 312500,
    fundingProgress: 25,
    investorCount: 6,
    team: [
      { name: "Lisa Storyteller", role: "Director/Writer", experience: "11 years" },
      { name: "Carmen Rodriguez", role: "Producer", experience: "13 years" },
      { name: "Jordan Smith", role: "Cinematographer", experience: "9 years" }
    ],
    attachments: [
      { type: "script", name: "Art_of_Silence_Script.pdf", size: "2.1 MB" },
      { type: "lookbook", name: "Visual_Lookbook.pdf", size: "18.6 MB" },
      { type: "casting", name: "Casting_Notes.pdf", size: "1.4 MB" }
    ],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
];

// Demo data for investments and portfolio
const mockInvestmentsData = [
  {
    id: "inv-1",
    pitchId: 1,
    pitchTitle: "The Last Frontier",
    amount: 50000,
    percentage: 2.5,
    investmentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    currentValue: 55000,
    returns: 5000,
    returnPercentage: 10,
    expectedCompletion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "medium",
    genre: "Sci-Fi",
    creator: "Alex Chen"
  },
  {
    id: "inv-2",
    pitchId: 3,
    pitchTitle: "Urban Legends",
    amount: 25000,
    percentage: 1.25,
    investmentDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    currentValue: 37500,
    returns: 12500,
    returnPercentage: 50,
    expectedCompletion: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "low",
    genre: "Horror",
    creator: "Mike Horror"
  },
  {
    id: "inv-3",
    pitchId: 4,
    pitchTitle: "Digital Dreams",
    amount: 75000,
    percentage: 0.75,
    investmentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    currentValue: 78750,
    returns: 3750,
    returnPercentage: 5,
    expectedCompletion: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000).toISOString(),
    riskLevel: "high",
    genre: "Thriller",
    creator: "Neo Vision"
  }
];

// Demo data for production projects
const mockProductionProjects = [
  {
    id: "proj-1",
    title: "The Last Frontier",
    type: "Feature Film",
    status: "pre-production",
    budget: 7500000,
    currentSpend: 1200000,
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    expectedCompletion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    director: "Alex Chen",
    producer: "Maria Rodriguez",
    locations: ["Los Angeles", "New Mexico", "Iceland"],
    crewSize: 85,
    shootingDays: 52,
    genre: "Sci-Fi",
    distributionPlan: "Theatrical + Streaming",
    progress: 15
  },
  {
    id: "proj-2",
    title: "Urban Legends",
    type: "Series",
    status: "production",
    budget: 2000000,
    currentSpend: 1400000,
    startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    expectedCompletion: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    director: "Mike Horror",
    producer: "Lisa Chen",
    locations: ["Vancouver", "Toronto"],
    crewSize: 45,
    shootingDays: 35,
    genre: "Horror",
    distributionPlan: "Streaming Platform",
    progress: 70
  },
  {
    id: "proj-3",
    title: "Midnight in Tokyo",
    type: "Feature Film",
    status: "post-production",
    budget: 4500000,
    currentSpend: 4200000,
    startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    expectedCompletion: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    director: "Yuki Tanaka",
    producer: "John Smith",
    locations: ["Tokyo", "Kyoto"],
    crewSize: 65,
    shootingDays: 40,
    genre: "Drama",
    distributionPlan: "Film Festival Circuit",
    progress: 90
  }
];

// Demo data for crew management
const mockCrewData = [
  {
    id: "crew-1",
    name: "Alex Chen",
    role: "Director",
    department: "Direction",
    email: "alex.chen@stellar.com",
    phone: "+1-555-0101",
    availability: "available",
    currentProject: "The Last Frontier",
    experience: "15 years",
    rate: "$5000/day",
    skills: ["Direction", "Cinematography", "Editing"],
    certifications: ["DGA Member", "Safety Coordinator"]
  },
  {
    id: "crew-2",
    name: "Maria Rodriguez",
    role: "Producer",
    department: "Production",
    email: "maria.rodriguez@stellar.com",
    phone: "+1-555-0102",
    availability: "busy",
    currentProject: "The Last Frontier",
    experience: "20 years",
    rate: "$4000/day",
    skills: ["Production Management", "Budgeting", "Scheduling"],
    certifications: ["PGA Member", "Line Producer Certified"]
  },
  {
    id: "crew-3",
    name: "James Park",
    role: "Cinematographer",
    department: "Camera",
    email: "james.park@freelance.com",
    phone: "+1-555-0103",
    availability: "available",
    currentProject: null,
    experience: "12 years",
    rate: "$3500/day",
    skills: ["Cinematography", "Lighting", "Camera Operation"],
    certifications: ["ASC Associate", "Steadicam Operator"]
  },
  {
    id: "crew-4",
    name: "Sarah Kim",
    role: "Editor",
    department: "Post-Production",
    email: "sarah.kim@stellar.com",
    phone: "+1-555-0104",
    availability: "available",
    currentProject: "Urban Legends",
    experience: "10 years",
    rate: "$2500/day",
    skills: ["Editing", "Color Correction", "Sound Design"],
    certifications: ["Avid Certified", "Adobe Master"]
  }
];

async function generateToken(userId: string, email: string, role: string) {
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
      userId, 
      email, 
      role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    },
    key
  );
}

async function verifyToken(token: string) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    const payload = await verify(token, key);
    return payload;
  } catch {
    return null;
  }
}

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const method = request.method;
  
  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ 
      status: "healthy",
      message: "Multi-portal Pitchey API is running",
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Profile endpoint - returns user profile based on auth token
  if (url.pathname === "/api/profile" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Return user based on payload
    const users = {
      "creator-demo-id": {
        id: "creator-demo-id",
        email: "alex.creator@demo.com",
        name: "Alex Creator",
        role: "creator",
        userType: "creator",
        bio: "Passionate filmmaker and content creator",
        avatar: "/api/placeholder/150/150",
        createdAt: new Date().toISOString()
      },
      "investor-demo-id": {
        id: "investor-demo-id",
        email: "sarah.investor@demo.com",
        name: "Sarah Investor",
        role: "investor",
        userType: "investor",
        bio: "Strategic investor in entertainment projects",
        avatar: "/api/placeholder/150/150",
        createdAt: new Date().toISOString()
      },
      "production-demo-id": {
        id: "production-demo-id",
        email: "stellar.productions@demo.com",
        name: "Stellar Productions",
        role: "production",
        userType: "production",
        bio: "Leading production company",
        avatar: "/api/placeholder/150/150",
        createdAt: new Date().toISOString()
      }
    };

    const user = users[payload.userId];
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "User not found" 
      }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify(user), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Creator pitches endpoint - GET and POST
  if (url.pathname === "/api/creator/pitches" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Return pitches for the current creator
    const creatorPitches = mockPitchesData.filter(pitch => 
      pitch.creatorId === payload.userId || payload.userId === "creator-demo-id"
    );

    return new Response(JSON.stringify({
      success: true,
      pitches: creatorPitches,
      total: creatorPitches.length,
      stats: {
        totalPitches: creatorPitches.length,
        totalViews: creatorPitches.reduce((sum, p) => sum + p.views, 0),
        totalLikes: creatorPitches.reduce((sum, p) => sum + p.likes, 0),
        totalFunding: creatorPitches.reduce((sum, p) => sum + p.currentFunding, 0)
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Create new pitch
  if (url.pathname === "/api/creator/pitches" && method === "POST") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    try {
      const pitchData = await request.json();
      
      // Validate required fields
      const requiredFields = ['title', 'logline', 'genre', 'format', 'budget', 'description'];
      const missingFields = requiredFields.filter(field => !pitchData[field]);
      
      if (missingFields.length > 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Get creator info from existing users
      const creator = {
        id: payload.userId,
        username: payload.userId === "creator-demo-id" ? "alex_filmmaker" : `user_${payload.userId}`,
        name: payload.userId === "creator-demo-id" ? "Alex Chen" : "New Creator",
        userType: "creator",
        companyName: pitchData.companyName || "Independent",
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.userId}`
      };

      // Parse budget amount from budget string
      let budgetAmount = 0;
      if (pitchData.budget.includes('$')) {
        const budgetStr = pitchData.budget.replace(/[^\d.-]/g, '');
        budgetAmount = parseFloat(budgetStr) * (pitchData.budget.includes('M') ? 1000000 : pitchData.budget.includes('K') ? 1000 : 1);
      } else {
        budgetAmount = parseFloat(pitchData.budget) || 0;
      }

      // Create new pitch object
      const newPitch = {
        id: Date.now(), // Simple ID generation
        title: pitchData.title,
        logline: pitchData.logline,
        genre: pitchData.genre,
        format: pitchData.format,
        budget: pitchData.budget,
        budgetAmount: budgetAmount,
        status: pitchData.status || "In Development",
        stage: pitchData.stage || "development",
        creator: creator,
        creatorId: payload.userId,
        views: 0,
        likes: 0,
        thumbnail: pitchData.thumbnail || `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000000000)}?w=400&h=300&fit=crop`,
        description: pitchData.description,
        targetAudience: pitchData.targetAudience || "General audience",
        timeline: pitchData.timeline || "12 months",
        fundingGoal: budgetAmount,
        currentFunding: 0,
        fundingProgress: 0,
        investorCount: 0,
        team: pitchData.team || [
          { name: creator.name, role: "Creator/Director", experience: "10+ years" }
        ],
        attachments: pitchData.attachments || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to mock data (in a real app, this would be saved to database)
      mockPitchesData.push(newPitch);

      return new Response(JSON.stringify({
        success: true,
        pitch: newPitch,
        message: "Pitch created successfully"
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });

    } catch (error) {
      console.error("Pitch creation error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to create pitch" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Individual pitch management endpoints
  if (url.pathname.startsWith("/api/creator/pitches/") && url.pathname.split("/").length === 5) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const pitchId = parseInt(url.pathname.split("/").pop() || "0");
    const pitchIndex = mockPitchesData.findIndex(p => p.id === pitchId);
    const pitch = mockPitchesData[pitchIndex];

    // Check if pitch exists and belongs to creator
    if (!pitch || (pitch.creatorId !== payload.userId && payload.userId !== "creator-demo-id")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Pitch not found or access denied"
      }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // GET individual pitch
    if (method === "GET") {
      return new Response(JSON.stringify({
        success: true,
        pitch: pitch
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // UPDATE pitch
    if (method === "PUT") {
      try {
        const updateData = await request.json();
        
        // Update pitch properties
        const updatedPitch = {
          ...pitch,
          ...updateData,
          id: pitch.id, // Preserve ID
          creatorId: pitch.creatorId, // Preserve creator ID
          creator: pitch.creator, // Preserve creator info
          updatedAt: new Date().toISOString()
        };

        // Parse budget amount if budget is updated
        if (updateData.budget) {
          let budgetAmount = 0;
          if (updateData.budget.includes('$')) {
            const budgetStr = updateData.budget.replace(/[^\d.-]/g, '');
            budgetAmount = parseFloat(budgetStr) * (updateData.budget.includes('M') ? 1000000 : updateData.budget.includes('K') ? 1000 : 1);
          } else {
            budgetAmount = parseFloat(updateData.budget) || 0;
          }
          updatedPitch.budgetAmount = budgetAmount;
          updatedPitch.fundingGoal = budgetAmount;
        }

        // Update in mock data
        mockPitchesData[pitchIndex] = updatedPitch;

        return new Response(JSON.stringify({
          success: true,
          pitch: updatedPitch,
          message: "Pitch updated successfully"
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" }
        });

      } catch (error) {
        console.error("Pitch update error:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Failed to update pitch" 
        }), {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
    }

    // DELETE pitch
    if (method === "DELETE") {
      try {
        // Remove from mock data
        mockPitchesData.splice(pitchIndex, 1);

        return new Response(JSON.stringify({
          success: true,
          message: "Pitch deleted successfully"
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" }
        });

      } catch (error) {
        console.error("Pitch deletion error:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Failed to delete pitch" 
        }), {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
    }
  }

  // Creator analytics endpoint
  if (url.pathname === "/api/creator/analytics" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      analytics: {
        overview: {
          totalViews: 4523,
          totalLikes: 312,
          totalShares: 89,
          totalComments: 156,
          conversionRate: 12.5,
          avgViewDuration: "3:45"
        },
        viewsOverTime: [
          { date: "2025-09-14", views: 245 },
          { date: "2025-09-15", views: 389 },
          { date: "2025-09-16", views: 567 },
          { date: "2025-09-17", views: 423 },
          { date: "2025-09-18", views: 698 },
          { date: "2025-09-19", views: 834 },
          { date: "2025-09-20", views: 1067 },
          { date: "2025-09-21", views: 300 }
        ],
        demographicBreakdown: {
          ageGroups: [
            { range: "18-24", percentage: 15 },
            { range: "25-34", percentage: 35 },
            { range: "35-44", percentage: 28 },
            { range: "45-54", percentage: 15 },
            { range: "55+", percentage: 7 }
          ],
          geography: [
            { country: "United States", percentage: 45 },
            { country: "Canada", percentage: 12 },
            { country: "United Kingdom", percentage: 18 },
            { country: "Australia", percentage: 8 },
            { country: "Other", percentage: 17 }
          ]
        },
        pitchPerformance: [
          {
            id: 1,
            title: "The Last Frontier",
            views: 1250,
            likes: 89,
            conversionRate: 15.2,
            avgEngagement: "4:12"
          },
          {
            id: 2,
            title: "Echoes of Tomorrow",
            views: 890,
            likes: 67,
            conversionRate: 18.7,
            avgEngagement: "3:38"
          }
        ]
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Creator portfolio endpoint
  if (url.pathname === "/api/creator/portfolio" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      portfolio: {
        creator: {
          id: "creator-demo-id",
          name: "Alex Creator",
          bio: "Award-winning filmmaker with 15+ years of experience in sci-fi and drama productions.",
          location: "Los Angeles, CA",
          website: "https://alexchen.filmmaker.com",
          socialMedia: {
            twitter: "@alexchen_films",
            instagram: "@alexchenfilms",
            linkedin: "alex-chen-filmmaker"
          },
          experience: "15 years",
          specialties: ["Sci-Fi", "Drama", "Action"],
          awards: [
            "Sundance Film Festival - Best Director (2022)",
            "Toronto International Film Festival - People's Choice Award (2021)",
            "Independent Spirit Award - Best Feature (2020)"
          ]
        },
        summary: {
          totalPitches: 8,
          activePitches: 3,
          completedProjects: 5,
          totalFunding: 12750000,
          totalViews: 15234,
          totalFollowers: 1456,
          successRate: 62.5
        },
        pitches: [
          {
            id: 1,
            title: "The Last Frontier",
            status: "In Development",
            fundingProgress: 30,
            currentFunding: 2250000,
            targetFunding: 7500000,
            views: 1250,
            likes: 89,
            createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 6,
            title: "Quantum Paradox",
            status: "Pitching",
            fundingProgress: 15,
            currentFunding: 525000,
            targetFunding: 3500000,
            views: 432,
            likes: 34,
            createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 7,
            title: "Silent Revolution",
            status: "Completed",
            fundingProgress: 100,
            currentFunding: 2500000,
            targetFunding: 2500000,
            views: 3421,
            likes: 287,
            createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        recentActivity: [
          {
            id: "act-1",
            type: "pitch_update",
            title: "Updated The Last Frontier pitch deck",
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "act-2",
            type: "investment",
            title: "Received $50,000 investment",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "act-3",
            type: "milestone",
            title: "Reached 25% funding goal",
            date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        testimonials: [
          {
            id: "test-1",
            author: "Sarah Investor",
            role: "Film Investor",
            content: "Alex consistently delivers exceptional content with strong commercial appeal. His attention to detail and storytelling prowess make him a reliable investment.",
            rating: 5,
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "test-2",
            author: "Mike Producer",
            role: "Executive Producer",
            content: "Working with Alex on Silent Revolution was fantastic. Professional, creative, and delivered on time and under budget.",
            rating: 5,
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Investor portfolio endpoint
  if (url.pathname === "/api/investor/portfolio" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      portfolio: {
        summary: {
          totalInvested: 150000,
          currentValue: 171250,
          totalReturn: 21250,
          returnPercentage: 14.17,
          activeInvestments: 3,
          completedInvestments: 1
        },
        performanceOverTime: [
          { month: "2025-03", value: 150000 },
          { month: "2025-04", value: 152300 },
          { month: "2025-05", value: 158900 },
          { month: "2025-06", value: 162400 },
          { month: "2025-07", value: 165800 },
          { month: "2025-08", value: 168200 },
          { month: "2025-09", value: 171250 }
        ],
        diversification: {
          byGenre: [
            { genre: "Sci-Fi", percentage: 45, value: 77062.5 },
            { genre: "Horror", percentage: 25, value: 42812.5 },
            { genre: "Thriller", percentage: 30, value: 51375 }
          ],
          byStage: [
            { stage: "Development", percentage: 20, value: 34250 },
            { stage: "Pre-Production", percentage: 45, value: 77062.5 },
            { stage: "Production", percentage: 25, value: 42812.5 },
            { stage: "Completed", percentage: 10, value: 17125 }
          ],
          byRisk: [
            { level: "Low", percentage: 25, value: 42812.5 },
            { level: "Medium", percentage: 45, value: 77062.5 },
            { level: "High", percentage: 30, value: 51375 }
          ]
        },
        investments: mockInvestmentsData
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Investor investments endpoint
  if (url.pathname === "/api/investor/investments" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      investments: mockInvestmentsData,
      total: mockInvestmentsData.length,
      summary: {
        totalInvested: mockInvestmentsData.reduce((sum, inv) => sum + inv.amount, 0),
        totalReturns: mockInvestmentsData.reduce((sum, inv) => sum + inv.returns, 0),
        activeCount: mockInvestmentsData.filter(inv => inv.status === "active").length,
        completedCount: mockInvestmentsData.filter(inv => inv.status === "completed").length
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Production projects endpoint
  if (url.pathname === "/api/production/projects" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      projects: mockProductionProjects,
      total: mockProductionProjects.length,
      summary: {
        totalBudget: mockProductionProjects.reduce((sum, proj) => sum + proj.budget, 0),
        totalSpend: mockProductionProjects.reduce((sum, proj) => sum + proj.currentSpend, 0),
        activeProjects: mockProductionProjects.filter(proj => 
          proj.status === "production" || proj.status === "pre-production"
        ).length,
        completedProjects: mockProductionProjects.filter(proj => 
          proj.status === "completed"
        ).length,
        totalCrew: mockProductionProjects.reduce((sum, proj) => sum + proj.crewSize, 0)
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Production crew endpoint
  if (url.pathname === "/api/production/crew" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      crew: mockCrewData,
      total: mockCrewData.length,
      summary: {
        totalCrew: mockCrewData.length,
        available: mockCrewData.filter(member => member.availability === "available").length,
        busy: mockCrewData.filter(member => member.availability === "busy").length,
        departments: [
          { name: "Direction", count: 1 },
          { name: "Production", count: 1 },
          { name: "Camera", count: 1 },
          { name: "Post-Production", count: 1 }
        ]
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Individual pitch details endpoint
  if (url.pathname.startsWith("/api/pitches/") && method === "GET") {
    const pitchId = parseInt(url.pathname.split("/").pop() || "0");
    const pitch = mockPitchesData.find(p => p.id === pitchId);
    
    if (!pitch) {
      return new Response(JSON.stringify({
        success: false,
        error: "Pitch not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      pitch: {
        ...pitch,
        similarPitches: mockPitchesData
          .filter(p => p.id !== pitch.id && p.genre === pitch.genre)
          .slice(0, 3),
        updates: [
          {
            id: "update-1",
            title: "Production Update",
            content: "We've secured our lead cinematographer and are finalizing location permits.",
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            type: "production"
          },
          {
            id: "update-2",
            title: "Funding Milestone",
            content: "We've reached 30% of our funding goal! Thank you to all our early supporters.",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            type: "funding"
          }
        ],
        comments: [
          {
            id: "comment-1",
            author: "Sarah Investor",
            content: "This looks like a promising project. The concept art is stunning!",
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 5
          },
          {
            id: "comment-2",
            author: "Mike Producer",
            content: "Great team assembled. Looking forward to seeing this come to life.",
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 3
          }
        ]
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Messages endpoint
  if (url.pathname === "/api/messages" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      conversations: [
        {
          id: "conv-1",
          participant: {
            id: "user-2",
            name: "Sarah Investor",
            avatar: "/api/placeholder/40/40",
            role: "investor"
          },
          lastMessage: {
            content: "I'm interested in your latest project. Can we schedule a call?",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            isRead: false
          },
          unreadCount: 2
        },
        {
          id: "conv-2",
          participant: {
            id: "user-3",
            name: "Mike Producer",
            avatar: "/api/placeholder/40/40",
            role: "production"
          },
          lastMessage: {
            content: "The contracts have been sent for review.",
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            isRead: true
          },
          unreadCount: 0
        },
        {
          id: "conv-3",
          participant: {
            id: "user-4",
            name: "Emma Director",
            avatar: "/api/placeholder/40/40",
            role: "creator"
          },
          lastMessage: {
            content: "Love the concept! Would be great to collaborate.",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            isRead: true
          },
          unreadCount: 0
        }
      ],
      unreadTotal: 2
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Notifications endpoint
  if (url.pathname === "/api/notifications" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      notifications: [
        {
          id: "notif-1",
          type: "investment",
          title: "New Investment Received",
          message: "Sarah Investor has invested $50,000 in your project 'The Last Frontier'",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          isRead: false,
          actionUrl: "/pitches/1"
        },
        {
          id: "notif-2",
          type: "message",
          title: "New Message",
          message: "You have a new message from Mike Producer",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          isRead: false,
          actionUrl: "/messages"
        },
        {
          id: "notif-3",
          type: "milestone",
          title: "Funding Milestone Reached",
          message: "Your project 'Digital Dreams' has reached 30% funding",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          isRead: true,
          actionUrl: "/pitches/4"
        },
        {
          id: "notif-4",
          type: "follow",
          title: "New Follower",
          message: "Emma Director is now following you",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          isRead: true,
          actionUrl: "/profile/user-4"
        }
      ],
      unreadCount: 2
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Creator dashboard endpoint
  if (url.pathname === "/api/creator/dashboard" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Get creator's pitches
    const creatorPitches = mockPitchesData.filter(pitch => 
      pitch.creatorId === payload.userId || payload.userId === "creator-demo-id"
    );

    // Calculate comprehensive stats
    const stats = {
      totalPitches: creatorPitches.length,
      views: creatorPitches.reduce((sum, p) => sum + p.views, 0),
      likes: creatorPitches.reduce((sum, p) => sum + p.likes, 0),
      investors: creatorPitches.reduce((sum, p) => sum + (p.investorCount || 0), 0),
      totalFunding: creatorPitches.reduce((sum, p) => sum + p.currentFunding, 0),
      fundingGoal: creatorPitches.reduce((sum, p) => sum + p.fundingGoal, 0),
      avgFundingProgress: creatorPitches.length > 0 ? 
        Math.round(creatorPitches.reduce((sum, p) => sum + p.fundingProgress, 0) / creatorPitches.length) : 0,
      activePitches: creatorPitches.filter(p => p.status === "Pitching" || p.status === "Seeking Funding").length,
      completedPitches: creatorPitches.filter(p => p.status === "Funded" || p.status === "Completed").length
    };

    const recentActivity = [
      {
        id: "activity-1",
        type: "pitch_view",
        title: "Your pitch 'The Last Frontier' received 45 new views",
        description: "Increased engagement from sci-fi investors",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        icon: "eye",
        color: "blue"
      },
      {
        id: "activity-2",
        type: "investment",
        title: "New investment of $25,000 received",
        description: "From Sarah Investor for Digital Dreams project",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        icon: "dollar-sign",
        color: "green"
      },
      {
        id: "activity-3",
        type: "message",
        title: "3 new messages from investors",
        description: "Interest in your latest sci-fi projects",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        icon: "message-circle",
        color: "purple"
      },
      {
        id: "activity-4",
        type: "milestone",
        title: "Funding milestone reached",
        description: "The Last Frontier reached 30% funding goal",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        icon: "target",
        color: "orange"
      },
      {
        id: "activity-5",
        type: "follower",
        title: "5 new followers this week",
        description: "Your profile is gaining traction",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        icon: "user-plus",
        color: "indigo"
      }
    ];

    const topPerformingPitches = creatorPitches
      .sort((a, b) => {
        const scoreA = (a.views * 0.1) + (a.likes * 2) + (a.currentFunding * 0.0001);
        const scoreB = (b.views * 0.1) + (b.likes * 2) + (b.currentFunding * 0.0001);
        return scoreB - scoreA;
      })
      .slice(0, 3)
      .map(pitch => ({
        id: pitch.id,
        title: pitch.title,
        views: pitch.views,
        likes: pitch.likes,
        fundingProgress: pitch.fundingProgress,
        status: pitch.status,
        thumbnail: pitch.thumbnail
      }));

    const upcomingDeadlines = [
      {
        id: "deadline-1",
        type: "funding",
        title: "Funding deadline for 'The Last Frontier'",
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high"
      },
      {
        id: "deadline-2",
        type: "production",
        title: "Pre-production start for 'Digital Dreams'",
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "medium"
      },
      {
        id: "deadline-3",
        type: "meeting",
        title: "Investor meeting scheduled",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high"
      }
    ];

    const pendingTasks = [
      {
        id: "task-1",
        title: "Update pitch deck for 'Quantum Hearts'",
        priority: "high",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        category: "content"
      },
      {
        id: "task-2",
        title: "Respond to investor inquiries",
        priority: "medium",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        category: "communication"
      },
      {
        id: "task-3",
        title: "Schedule production meetings",
        priority: "low",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        category: "planning"
      }
    ];

    const analyticsOverview = {
      viewsLastWeek: 1234,
      viewsGrowth: 23.5,
      likesLastWeek: 89,
      likesGrowth: 18.2,
      followersGrowth: 12.8,
      engagementRate: 8.7,
      topGenres: [
        { genre: "Sci-Fi", percentage: 45 },
        { genre: "Drama", percentage: 30 },
        { genre: "Thriller", percentage: 25 }
      ]
    };

    return new Response(JSON.stringify({
      success: true,
      stats,
      recentActivity,
      pitches: topPerformingPitches,
      upcomingDeadlines,
      pendingTasks,
      analytics: analyticsOverview,
      notifications: {
        unread: 8,
        messages: 3,
        investments: 2,
        updates: 3
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Investor dashboard endpoint
  if (url.pathname === "/api/investor/dashboard" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Calculate comprehensive portfolio stats from mock investments
    const totalInvested = mockInvestmentsData.reduce((sum, inv) => sum + inv.amount, 0);
    const currentPortfolioValue = mockInvestmentsData.reduce((sum, inv) => sum + inv.currentValue, 0);
    const totalReturns = mockInvestmentsData.reduce((sum, inv) => sum + inv.returns, 0);
    const avgROI = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;

    const stats = {
      totalInvestments: mockInvestmentsData.length,
      portfolioValue: currentPortfolioValue,
      totalInvested: totalInvested,
      totalReturns: totalReturns,
      roi: Math.round(avgROI * 100) / 100,
      activeProjects: mockInvestmentsData.filter(inv => inv.status === "active").length,
      completedProjects: mockInvestmentsData.filter(inv => inv.status === "completed").length,
      avgInvestmentSize: Math.round(totalInvested / mockInvestmentsData.length),
      diversification: {
        byGenre: mockInvestmentsData.reduce((acc, inv) => {
          acc[inv.genre] = (acc[inv.genre] || 0) + inv.amount;
          return acc;
        }, {}),
        byRiskLevel: mockInvestmentsData.reduce((acc, inv) => {
          acc[inv.riskLevel] = (acc[inv.riskLevel] || 0) + inv.amount;
          return acc;
        }, {})
      }
    };

    const recentActivity = [
      {
        id: "activity-1",
        type: "investment",
        title: "Investment milestone reached",
        description: "Your investment in 'The Last Frontier' has grown by $5,000",
        amount: 5000,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        icon: "trending-up",
        color: "green",
        pitchId: 1
      },
      {
        id: "activity-2",
        type: "pitch_view",
        title: "New pitch recommendation",
        description: "AI recommended 'Quantum Hearts' based on your portfolio",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        icon: "eye",
        color: "blue",
        pitchId: 6
      },
      {
        id: "activity-3",
        type: "completed",
        title: "Investment completed successfully",
        description: "Urban Legends has reached production completion",
        amount: 12500,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        icon: "check-circle",
        color: "green",
        pitchId: 3
      },
      {
        id: "activity-4",
        type: "watchlist",
        title: "Watchlist update",
        description: "3 new pitches match your investment criteria",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        icon: "bookmark",
        color: "purple"
      },
      {
        id: "activity-5",
        type: "message",
        title: "Creator update received",
        description: "Alex Chen shared a production update",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        icon: "message-circle",
        color: "blue",
        pitchId: 1
      }
    ];

    const watchlist = [
      {
        id: "pitch-6",
        title: "Quantum Hearts",
        logline: "A romantic sci-fi about love in the age of AI",
        genre: "Sci-Fi Romance",
        budget: 4200000,
        budgetFormatted: "$4.2M",
        expectedReturn: "350%",
        creator: "Emma Rodriguez",
        creatorId: "creator-6",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop",
        addedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        fundingProgress: 25,
        investorCount: 8,
        riskLevel: "medium",
        matchScore: 94
      },
      {
        id: "pitch-7",
        title: "Silent Revolution",
        logline: "A political thriller about whistleblowers in the digital age",
        genre: "Thriller",
        budget: 6800000,
        budgetFormatted: "$6.8M",
        expectedReturn: "280%",
        creator: "David Kim",
        creatorId: "creator-7",
        thumbnail: "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=400&h=300&fit=crop",
        addedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        fundingProgress: 45,
        investorCount: 15,
        riskLevel: "high",
        matchScore: 87
      },
      {
        id: "pitch-8",
        title: "The Memory Thief",
        logline: "A psychological drama about a detective who can enter memories",
        genre: "Drama",
        budget: 2100000,
        budgetFormatted: "$2.1M",
        expectedReturn: "320%",
        creator: "Maria Santos",
        creatorId: "creator-8",
        thumbnail: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
        addedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        fundingProgress: 60,
        investorCount: 12,
        riskLevel: "low",
        matchScore: 91
      }
    ];

    const following = [
      {
        id: "creator-demo-id",
        name: "Alex Chen",
        username: "alex_filmmaker",
        type: "creator",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
        pitchCount: 3,
        followedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        latestPitch: "The Last Frontier",
        totalFunding: 2250000,
        successRate: 75
      },
      {
        id: "creator-2",
        name: "Sarah Williams",
        username: "sarah_williams",
        type: "creator", 
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
        pitchCount: 2,
        followedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        latestPitch: "Echoes of Tomorrow",
        totalFunding: 1400000,
        successRate: 60
      },
      {
        id: "creator-3",
        name: "Mike Horror",
        username: "mike_horror", 
        type: "creator",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
        pitchCount: 4,
        followedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        latestPitch: "Urban Legends",
        totalFunding: 2000000,
        successRate: 90
      }
    ];

    const recommendations = [
      {
        id: "rec-1",
        pitchId: 6,
        title: "Quantum Hearts", 
        logline: "A romantic sci-fi about love in the age of AI",
        genre: "Sci-Fi Romance",
        budget: 4200000,
        budgetFormatted: "$4.2M",
        expectedReturn: "350%",
        creator: "Emma Rodriguez",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop",
        matchScore: 94,
        reason: "Based on your interest in Sci-Fi projects and high-ROI investments",
        riskLevel: "medium",
        fundingProgress: 25,
        aiConfidence: 92
      },
      {
        id: "rec-2",
        pitchId: 8,
        title: "The Memory Thief",
        logline: "A psychological drama about a detective who can enter memories", 
        genre: "Drama",
        budget: 2100000,
        budgetFormatted: "$2.1M",
        expectedReturn: "320%",
        creator: "Maria Santos",
        thumbnail: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
        matchScore: 91,
        reason: "Low-risk investment similar to your successful completed projects",
        riskLevel: "low",
        fundingProgress: 60,
        aiConfidence: 88
      },
      {
        id: "rec-3",
        pitchId: 7,
        title: "Silent Revolution",
        logline: "A political thriller about whistleblowers in the digital age",
        genre: "Thriller", 
        budget: 6800000,
        budgetFormatted: "$6.8M",
        expectedReturn: "280%",
        creator: "David Kim",
        thumbnail: "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=400&h=300&fit=crop",
        matchScore: 87,
        reason: "High-budget thriller with strong market potential",
        riskLevel: "high",
        fundingProgress: 45,
        aiConfidence: 85
      }
    ];

    const portfolioOverview = {
      totalValue: currentPortfolioValue,
      totalInvested: totalInvested,
      totalReturn: totalReturns,
      returnPercentage: avgROI,
      performanceOverTime: [
        { month: "2025-03", value: totalInvested },
        { month: "2025-04", value: totalInvested + (totalReturns * 0.1) },
        { month: "2025-05", value: totalInvested + (totalReturns * 0.3) },
        { month: "2025-06", value: totalInvested + (totalReturns * 0.5) },
        { month: "2025-07", value: totalInvested + (totalReturns * 0.7) },
        { month: "2025-08", value: totalInvested + (totalReturns * 0.85) },
        { month: "2025-09", value: currentPortfolioValue }
      ],
      topPerformers: mockInvestmentsData
        .sort((a, b) => b.returnPercentage - a.returnPercentage)
        .slice(0, 3)
        .map(inv => ({
          id: inv.id,
          title: inv.pitchTitle,
          return: inv.returnPercentage,
          value: inv.currentValue,
          allocation: Math.round((inv.currentValue / currentPortfolioValue) * 100)
        }))
    };

    const upcomingOpportunities = [
      {
        id: "opp-1",
        title: "Early bird discount ending soon",
        description: "Get 15% bonus equity in 'Quantum Hearts' - ends in 48 hours",
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high",
        pitchId: 6
      },
      {
        id: "opp-2", 
        title: "Limited investor slots available",
        description: "Only 3 spots left for 'The Memory Thief' investment round",
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "medium",
        pitchId: 8
      },
      {
        id: "opp-3",
        title: "Pitch deck update available",
        description: "'Silent Revolution' creator shared updated financials",
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "low",
        pitchId: 7
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      stats,
      recentActivity,
      watchlist,
      following,
      investments: mockInvestmentsData,
      recommendations,
      portfolio: portfolioOverview,
      upcomingOpportunities,
      notifications: {
        unread: 12,
        investments: 4,
        recommendations: 3,
        updates: 5
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Investor Following endpoint
  if (url.pathname === "/api/investor/following" && method === "GET") {
    const params = new URL(request.url).searchParams;
    const tab = params.get("tab") || "activity";

    const followingData = {
      activity: [
        {
          id: 201,
          type: "new_pitch",
          title: "Quantum Hearts",
          logline: "In a world where love is quantified by algorithms, two hackers discover a way to break the system.",
          genre: "Sci-Fi Romance",
          format: "Feature Film",
          titleImage: "https://source.unsplash.com/800x450/?future,city",
          viewCount: 124,
          likeCount: 18,
          ndaCount: 3,
          status: "active",
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          timeAgo: "2 hours ago",
          creator: {
            id: 1,
            username: "alex_filmmaker",
            firstName: "Alex",
            lastName: "Rodriguez",
            userType: "creator",
            companyName: "Rodriguez Films",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
          }
        },
        {
          id: 202,
          type: "new_pitch",
          title: "The Inheritance Protocol",
          logline: "When a billionaire's will is encoded in blockchain, his heirs must compete in deadly challenges to claim their fortune.",
          genre: "Thriller",
          format: "Limited Series",
          titleImage: "https://source.unsplash.com/800x450/?mansion,luxury",
          viewCount: 89,
          likeCount: 12,
          ndaCount: 2,
          status: "active",
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          timeAgo: "Yesterday",
          creator: {
            id: 2,
            username: "sarahchen_productions",
            firstName: "Sarah",
            lastName: "Chen",
            userType: "production",
            companyName: "Chen Productions International",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
          }
        },
        {
          id: 203,
          type: "new_pitch",
          title: "Arctic Silence",
          logline: "An isolated research station in Antarctica loses contact with the world as something ancient awakens beneath the ice.",
          genre: "Horror",
          format: "Feature Film",
          titleImage: "https://source.unsplash.com/800x450/?antarctica,ice",
          viewCount: 267,
          likeCount: 45,
          ndaCount: 8,
          status: "active",
          publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          timeAgo: "3 days ago",
          creator: {
            id: 3,
            username: "nordic_noir",
            firstName: "Erik",
            lastName: "Lindqvist",
            userType: "creator",
            companyName: "Nordic Noir Productions",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=erik"
          }
        }
      ],
      creators: [
        {
          id: 1,
          type: "creator",
          username: "alex_filmmaker",
          firstName: "Alex",
          lastName: "Rodriguez",
          userType: "creator",
          companyName: "Rodriguez Films",
          bio: "Award-winning filmmaker specializing in sci-fi and psychological thrillers. BAFTA nominee 2023.",
          location: "Los Angeles, CA",
          followedAt: "2024-01-15T00:00:00Z",
          createdAt: "2023-06-01T00:00:00Z",
          pitchCount: 12,
          profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
        },
        {
          id: 2,
          type: "creator",
          username: "sarahchen_productions",
          firstName: "Sarah",
          lastName: "Chen",
          userType: "production",
          companyName: "Chen Productions International",
          bio: "Independent producer with 15+ years experience. Focus on diverse voices and untold stories.",
          location: "New York, NY",
          followedAt: "2024-02-20T00:00:00Z",
          createdAt: "2023-01-01T00:00:00Z",
          pitchCount: 8,
          profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
        },
        {
          id: 3,
          type: "creator",
          username: "nordic_noir",
          firstName: "Erik",
          lastName: "Lindqvist",
          userType: "creator",
          companyName: "Nordic Noir Productions",
          bio: "Creator of award-winning crime dramas. Specializing in dark, atmospheric storytelling.",
          location: "Stockholm, Sweden",
          followedAt: "2024-03-10T00:00:00Z",
          createdAt: "2023-09-15T00:00:00Z",
          pitchCount: 6,
          profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=erik"
        }
      ],
      pitches: [
        {
          id: 101,
          type: "pitch",
          title: "The Last Colony",
          logline: "When Earth's final colony ship arrives at its destination, the crew discovers the planet is already inhabited by descendants of a ship that never made it home.",
          genre: "Sci-Fi",
          format: "Feature Film",
          shortSynopsis: "A gripping tale of survival and identity in deep space.",
          titleImage: "https://source.unsplash.com/800x450/?spacecraft",
          viewCount: 3420,
          likeCount: 287,
          ndaCount: 45,
          status: "active",
          createdAt: "2024-01-01T00:00:00Z",
          publishedAt: "2024-01-05T00:00:00Z",
          followedAt: "2024-01-20T00:00:00Z",
          creator: {
            id: 1,
            username: "alex_filmmaker",
            userType: "creator",
            companyName: "Rodriguez Films",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
          }
        },
        {
          id: 102,
          type: "pitch",
          title: "Memory Lane",
          logline: "A detective who can enter crime scene memories must solve her own murder while trapped in the killer's mind.",
          genre: "Thriller",
          format: "Limited Series",
          shortSynopsis: "A mind-bending psychological thriller that questions the nature of memory and reality.",
          titleImage: "https://source.unsplash.com/800x450/?mystery",
          viewCount: 2890,
          likeCount: 412,
          ndaCount: 67,
          status: "active",
          createdAt: "2024-02-01T00:00:00Z",
          publishedAt: "2024-02-05T00:00:00Z",
          followedAt: "2024-02-15T00:00:00Z",
          creator: {
            id: 3,
            username: "nordic_noir",
            userType: "creator",
            companyName: "Nordic Noir Productions",
            profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=erik"
          }
        }
      ],
      summary: {
        newPitches: 3,
        activeCreators: 3,
        engagementRate: 89
      }
    };

    const responseData = tab === "creators" ? followingData.creators : 
                        tab === "pitches" ? followingData.pitches : 
                        followingData.activity;

    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      summary: followingData.summary,
      total: responseData.length
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Production dashboard endpoint
  if (url.pathname === "/api/production/dashboard" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Calculate comprehensive production stats
    const totalBudget = mockProductionProjects.reduce((sum, proj) => sum + proj.budget, 0);
    const totalSpend = mockProductionProjects.reduce((sum, proj) => sum + proj.currentSpend, 0);
    const totalCrew = mockProductionProjects.reduce((sum, proj) => sum + proj.crewSize, 0);

    const stats = {
      activeProjects: mockProductionProjects.filter(p => 
        p.status === "production" || p.status === "pre-production"
      ).length,
      completedProjects: mockProductionProjects.filter(p => 
        p.status === "completed" || p.status === "post-production"
      ).length,
      totalProjects: mockProductionProjects.length,
      totalBudget: totalBudget,
      totalSpend: totalSpend,
      budgetUtilization: Math.round((totalSpend / totalBudget) * 100),
      totalRevenue: 14750000, // Revenue from completed projects
      profitMargin: Math.round(((14750000 - totalSpend) / 14750000) * 100),
      totalCrew: totalCrew,
      availableCrew: mockCrewData.filter(c => c.availability === "available").length,
      busyCrew: mockCrewData.filter(c => c.availability === "busy").length,
      avgProjectDuration: 8.5, // months
      onTimeDelivery: 92, // percentage
      clientSatisfaction: 4.7 // out of 5
    };

    const recentActivity = [
      {
        id: "activity-1",
        type: "project_milestone",
        title: "Urban Legends reached 70% completion",
        description: "Production on track for Q4 2025 delivery",
        projectId: "proj-2",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        icon: "target",
        color: "green",
        priority: "medium"
      },
      {
        id: "activity-2",
        type: "budget_alert",
        title: "Budget variance detected",
        description: "The Last Frontier 15% over initial budget projections",
        projectId: "proj-1", 
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        icon: "alert-triangle",
        color: "orange",
        priority: "high"
      },
      {
        id: "activity-3",
        type: "crew_assignment",
        title: "New cinematographer assigned",
        description: "James Park assigned to Midnight in Tokyo",
        projectId: "proj-3",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        icon: "user-plus",
        color: "blue",
        priority: "low"
      },
      {
        id: "activity-4",
        type: "schedule_update",
        title: "Production schedule updated",
        description: "Digital Dreams filming moved to January 2026",
        projectId: "proj-4",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        icon: "calendar",
        color: "purple",
        priority: "medium"
      },
      {
        id: "activity-5",
        type: "contract_signed",
        title: "New project contract signed",
        description: "Quantum Hearts greenlit for production",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        icon: "file-text",
        color: "green",
        priority: "high"
      }
    ];

    const upcomingDeadlines = [
      {
        id: "deadline-1",
        type: "delivery",
        title: "Midnight in Tokyo - Final Cut Delivery",
        projectId: "proj-3",
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high",
        status: "on-track"
      },
      {
        id: "deadline-2",
        type: "milestone",
        title: "Urban Legends - Principal Photography Wrap",
        projectId: "proj-2",
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "high",
        status: "on-track"
      },
      {
        id: "deadline-3",
        type: "start",
        title: "The Last Frontier - Pre-production Start",
        projectId: "proj-1",
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "medium",
        status: "at-risk"
      },
      {
        id: "deadline-4",
        type: "review",
        title: "Quarterly Budget Review",
        date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        priority: "medium",
        status: "pending"
      }
    ];

    const resourceAllocation = {
      departments: [
        {
          name: "Direction",
          allocated: 4,
          available: 1,
          utilization: 80
        },
        {
          name: "Production", 
          allocated: 6,
          available: 2,
          utilization: 75
        },
        {
          name: "Camera",
          allocated: 8,
          available: 3,
          utilization: 73
        },
        {
          name: "Post-Production",
          allocated: 5,
          available: 2,
          utilization: 71
        },
        {
          name: "Art Department",
          allocated: 12,
          available: 4,
          utilization: 75
        }
      ],
      equipment: {
        cameras: { total: 25, available: 8, inUse: 17 },
        lighting: { total: 40, available: 12, inUse: 28 },
        sound: { total: 15, available: 5, inUse: 10 },
        postProduction: { total: 10, available: 3, inUse: 7 }
      },
      locations: {
        studios: { total: 6, available: 2, booked: 4 },
        external: { total: 20, available: 15, booked: 5 }
      }
    };

    const performanceMetrics = {
      projectDelivery: {
        onTime: 92,
        early: 8,
        delayed: 0
      },
      budgetPerformance: {
        underBudget: 35,
        onBudget: 45,
        overBudget: 20
      },
      clientRetention: 89,
      crewSatisfaction: 4.3,
      projectProfitability: [
        { month: "2025-03", profit: 425000 },
        { month: "2025-04", profit: 567000 },
        { month: "2025-05", profit: 634000 },
        { month: "2025-06", profit: 712000 },
        { month: "2025-07", profit: 589000 },
        { month: "2025-08", profit: 698000 },
        { month: "2025-09", profit: 745000 }
      ]
    };

    const projectPipeline = [
      {
        id: "pipeline-1",
        title: "Quantum Hearts",
        status: "development",
        priority: "high",
        budget: 4200000,
        expectedStart: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedDuration: 12,
        genre: "Sci-Fi Romance",
        client: "Emma Rodriguez"
      },
      {
        id: "pipeline-2", 
        title: "Silent Revolution",
        status: "pre-production",
        priority: "medium",
        budget: 6800000,
        expectedStart: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedDuration: 18,
        genre: "Political Thriller",
        client: "David Kim"
      },
      {
        id: "pipeline-3",
        title: "The Memory Thief",
        status: "development",
        priority: "medium",
        budget: 2100000,
        expectedStart: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
        estimatedDuration: 10,
        genre: "Psychological Drama",
        client: "Maria Santos"
      }
    ];

    const riskAlerts = [
      {
        id: "risk-1",
        type: "budget",
        severity: "high",
        title: "Budget Overrun Risk - The Last Frontier",
        description: "Project trending 15% over budget due to location changes",
        projectId: "proj-1",
        impact: "financial",
        mitigation: "Negotiate location discounts, optimize crew scheduling"
      },
      {
        id: "risk-2",
        type: "schedule",
        severity: "medium", 
        title: "Weather delays possible - Urban Legends",
        description: "Outdoor shoots scheduled during storm season",
        projectId: "proj-2",
        impact: "timeline",
        mitigation: "Prepare backup indoor locations, flexible scheduling"
      },
      {
        id: "risk-3",
        type: "resource",
        severity: "medium",
        title: "Key talent availability conflict",
        description: "Lead actor potential scheduling conflict in Q1 2026",
        projectId: "proj-4",
        impact: "schedule",
        mitigation: "Negotiate flexible shooting schedule, backup casting"
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      stats,
      recentActivity,
      projects: mockProductionProjects,
      upcomingDeadlines,
      resourceAllocation,
      performanceMetrics,
      projectPipeline,
      riskAlerts,
      crew: {
        total: mockCrewData.length,
        available: mockCrewData.filter(c => c.availability === "available").length,
        byDepartment: mockCrewData.reduce((acc, member) => {
          acc[member.department] = (acc[member.department] || 0) + 1;
          return acc;
        }, {})
      },
      notifications: {
        unread: 15,
        alerts: 6,
        approvals: 4,
        updates: 5
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Pitches following endpoint
  if (url.pathname === "/api/pitches/following" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      pitches: [
        {
          id: "pitch-5",
          title: "Beyond the Horizon",
          genre: "Adventure",
          creator: {
            id: "creator-1",
            name: "Alex Creator",
            avatar: "/api/placeholder/50/50"
          },
          budget: 4500000,
          status: "funding",
          progress: 65,
          investors: 12,
          thumbnail: "/api/placeholder/400/250",
          description: "An epic adventure across uncharted territories",
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "pitch-6",
          title: "Echoes of Tomorrow",
          genre: "Sci-Fi Drama",
          creator: {
            id: "creator-2",
            name: "Emma Producer",
            avatar: "/api/placeholder/50/50"
          },
          budget: 3200000,
          status: "funding",
          progress: 40,
          investors: 8,
          thumbnail: "/api/placeholder/400/250",
          description: "A thought-provoking journey through time",
          updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        }
      ]
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Follows endpoint
  if (url.pathname === "/api/follows/following" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      data: {
        following: []
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // AI recommendations endpoint
  if (url.pathname === "/api/ai/recommendations/investor" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      data: {
        recommendations: []
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Credits balance endpoint
  if (url.pathname.startsWith("/api/payments/credits/balance") && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      balance: 100,
      currency: "USD"
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Subscription status endpoint
  if (url.pathname.startsWith("/api/payments/subscription-status") && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      status: "active",
      plan: "premium",
      nextBillingDate: "2025-10-21"
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Creator login
  if (url.pathname === "/api/auth/creator/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      // Check demo credentials
      if (email === "alex.creator@demo.com" && password === "Demo123456") {
        const userId = "creator-demo-id";
        const token = await generateToken(userId, email, "creator");
        
        return new Response(JSON.stringify({
          success: true,
          token,
          user: {
            id: userId,
            email,
            name: "Alex Creator",
            role: "creator",
            userType: "creator", // Add userType field
            createdAt: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid credentials" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Creator login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Creator login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Investor login
  if (url.pathname === "/api/auth/investor/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      // Check demo credentials
      if (email === "sarah.investor@demo.com" && password === "Demo123456") {
        const userId = "investor-demo-id";
        const token = await generateToken(userId, email, "investor");
        
        return new Response(JSON.stringify({
          success: true,
          token,
          user: {
            id: userId,
            email,
            name: "Sarah Investor",
            role: "investor",
            userType: "investor", // Add userType field
            createdAt: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid credentials" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Investor login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Investor login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Production login
  if (url.pathname === "/api/auth/production/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      // Check demo credentials
      if (email === "stellar.productions@demo.com" && password === "Demo123456") {
        const userId = "production-demo-id";
        const token = await generateToken(userId, email, "production");
        
        return new Response(JSON.stringify({
          success: true,
          token,
          user: {
            id: userId,
            email,
            name: "Stellar Productions",
            role: "production",
            userType: "production", // Add userType field
            createdAt: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid credentials" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Production login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Production login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Creator registration
  if (url.pathname === "/api/auth/creator/register" && method === "POST") {
    try {
      const { email, password, firstName, lastName, companyName, bio } = await request.json();
      
      // Basic validation
      if (!email || !password || !firstName || !lastName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email already exists (mock check)
      if (email === "alex.creator@demo.com") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already exists" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Generate new user ID
      const userId = `creator-${Date.now()}`;
      const token = await generateToken(userId, email, "creator");
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          email,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          role: "creator",
          userType: "creator",
          companyName: companyName || null,
          bio: bio || null,
          createdAt: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Creator registration error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Registration failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Investor registration
  if (url.pathname === "/api/auth/investor/register" && method === "POST") {
    try {
      const { email, password, firstName, lastName, companyName, investorType, bio } = await request.json();
      
      // Basic validation
      if (!email || !password || !firstName || !lastName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email already exists (mock check)
      if (email === "sarah.investor@demo.com") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already exists" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Generate new user ID
      const userId = `investor-${Date.now()}`;
      const token = await generateToken(userId, email, "investor");
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          email,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          role: "investor",
          userType: "investor",
          companyName: companyName || null,
          investorType: investorType || "individual",
          bio: bio || null,
          createdAt: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Investor registration error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Registration failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Production registration
  if (url.pathname === "/api/auth/production/register" && method === "POST") {
    try {
      const { email, password, companyName, contactName, bio, location } = await request.json();
      
      // Basic validation
      if (!email || !password || !companyName || !contactName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email already exists (mock check)
      if (email === "stellar.productions@demo.com") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already exists" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Generate new user ID
      const userId = `production-${Date.now()}`;
      const token = await generateToken(userId, email, "production");
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: userId,
          email,
          name: companyName,
          role: "production",
          userType: "production",
          companyName,
          contactName,
          bio: bio || null,
          location: location || null,
          createdAt: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Production registration error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Registration failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Get user info
  if (url.pathname === "/api/auth/me" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    // Return user based on payload
    const users = {
      "creator-demo-id": {
        id: "creator-demo-id",
        email: "alex.creator@demo.com",
        name: "Alex Creator",
        role: "creator"
      },
      "investor-demo-id": {
        id: "investor-demo-id",
        email: "sarah.investor@demo.com",
        name: "Sarah Investor",
        role: "investor"
      },
      "production-demo-id": {
        id: "production-demo-id",
        email: "stellar.productions@demo.com",
        name: "Stellar Productions",
        role: "production"
      }
    };

    const user = users[payload.userId];
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "User not found" 
      }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Marketplace endpoint (enhanced)
  if (url.pathname === "/api/marketplace/pitches" && method === "GET") {
    const urlParams = new URLSearchParams(url.search);
    const genre = urlParams.get('genre');
    const status = urlParams.get('status');
    const budget = urlParams.get('budget');
    const search = urlParams.get('search');
    const page = parseInt(urlParams.get('page') || '1');
    const limit = parseInt(urlParams.get('limit') || '10');

    let filteredPitches = [...mockPitchesData];

    // Apply filters
    if (genre && genre !== 'all') {
      filteredPitches = filteredPitches.filter(pitch => 
        pitch.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    if (status && status !== 'all') {
      filteredPitches = filteredPitches.filter(pitch => 
        pitch.status.toLowerCase().includes(status.toLowerCase())
      );
    }

    if (budget && budget !== 'all') {
      const budgetRanges = {
        'under-1m': { min: 0, max: 1000000 },
        '1m-5m': { min: 1000000, max: 5000000 },
        '5m-10m': { min: 5000000, max: 10000000 },
        'over-10m': { min: 10000000, max: Infinity }
      };
      const range = budgetRanges[budget];
      if (range) {
        filteredPitches = filteredPitches.filter(pitch => 
          pitch.budgetAmount >= range.min && pitch.budgetAmount < range.max
        );
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredPitches = filteredPitches.filter(pitch => 
        pitch.title.toLowerCase().includes(searchLower) ||
        pitch.logline.toLowerCase().includes(searchLower) ||
        pitch.genre.toLowerCase().includes(searchLower) ||
        pitch.creator.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedPitches = filteredPitches.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(filteredPitches.length / limit);

    return new Response(JSON.stringify({
      success: true,
      pitches: paginatedPitches,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: filteredPitches.length,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filters: {
        genres: ['Sci-Fi', 'Drama', 'Horror', 'Thriller', 'Comedy', 'Action'],
        statuses: ['Pitching', 'Seeking Funding', 'In Development', 'Funded'],
        budgetRanges: [
          { value: 'under-1m', label: 'Under $1M' },
          { value: '1m-5m', label: '$1M - $5M' },
          { value: '5m-10m', label: '$5M - $10M' },
          { value: 'over-10m', label: 'Over $10M' }
        ]
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // These duplicate dashboard endpoints have been replaced by the enhanced versions above

  // NDA endpoints
  if (url.pathname === "/api/nda/requests" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      requests: [],
      count: 0
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  if (url.pathname === "/api/nda/signed" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      ndas: [],
      count: 0
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Enhanced analytics endpoint
  if (url.pathname === "/api/analytics/dashboard" && method === "GET") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalViews: 4523,
        totalLikes: 312,
        totalNDAs: 25,
        totalFollowing: 18,
        conversionRate: 12.5,
        avgEngagement: "3:45"
      },
      trends: {
        viewsGrowth: 23.5,
        likesGrowth: 18.2,
        followersGrowth: 31.8
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Search pitches endpoint
  if (url.pathname === "/api/search/pitches" && method === "GET") {
    const urlParams = new URLSearchParams(url.search);
    const query = urlParams.get('q') || '';
    const limit = parseInt(urlParams.get('limit') || '10');

    if (!query.trim()) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        total: 0
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const searchResults = mockPitchesData.filter(pitch => {
      const searchTerm = query.toLowerCase();
      return pitch.title.toLowerCase().includes(searchTerm) ||
             pitch.logline.toLowerCase().includes(searchTerm) ||
             pitch.genre.toLowerCase().includes(searchTerm) ||
             pitch.creator.toLowerCase().includes(searchTerm) ||
             pitch.description.toLowerCase().includes(searchTerm);
    }).slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      results: searchResults,
      total: searchResults.length,
      query
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // User search endpoint
  if (url.pathname === "/api/search/users" && method === "GET") {
    const urlParams = new URLSearchParams(url.search);
    const query = urlParams.get('q') || '';
    const limit = parseInt(urlParams.get('limit') || '10');

    const mockUsers = [
      { id: "creator-demo-id", name: "Alex Creator", role: "creator", avatar: "/api/placeholder/50/50" },
      { id: "investor-demo-id", name: "Sarah Investor", role: "investor", avatar: "/api/placeholder/50/50" },
      { id: "production-demo-id", name: "Stellar Productions", role: "production", avatar: "/api/placeholder/50/50" },
      { id: "creator-2", name: "Sarah Williams", role: "creator", avatar: "/api/placeholder/50/50" },
      { id: "creator-3", name: "Mike Horror", role: "creator", avatar: "/api/placeholder/50/50" },
      { id: "creator-4", name: "Neo Vision", role: "creator", avatar: "/api/placeholder/50/50" },
      { id: "creator-5", name: "Lisa Storyteller", role: "creator", avatar: "/api/placeholder/50/50" }
    ];

    if (!query.trim()) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        total: 0
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    const searchResults = mockUsers.filter(user => {
      const searchTerm = query.toLowerCase();
      return user.name.toLowerCase().includes(searchTerm) ||
             user.role.toLowerCase().includes(searchTerm);
    }).slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      results: searchResults,
      total: searchResults.length,
      query
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Trending pitches endpoint
  if (url.pathname === "/api/trending/pitches" && method === "GET") {
    const trendingPitches = [...mockPitchesData]
      .sort((a, b) => {
        // Sort by a combination of views, likes, and recent activity
        const scoreA = a.views * 0.1 + a.likes * 2 + (a.investorCount || 0) * 10;
        const scoreB = b.views * 0.1 + b.likes * 2 + (b.investorCount || 0) * 10;
        return scoreB - scoreA;
      })
      .slice(0, 6);

    return new Response(JSON.stringify({
      success: true,
      pitches: trendingPitches,
      total: trendingPitches.length
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Featured pitches endpoint
  if (url.pathname === "/api/featured/pitches" && method === "GET") {
    const featuredPitches = mockPitchesData
      .filter(pitch => pitch.status === "Funded" || pitch.fundingProgress > 50)
      .slice(0, 4);

    return new Response(JSON.stringify({
      success: true,
      pitches: featuredPitches,
      total: featuredPitches.length
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Stats endpoint for homepage
  if (url.pathname === "/api/stats/platform" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalPitches: mockPitchesData.length,
        totalFunding: mockPitchesData.reduce((sum, p) => sum + p.currentFunding, 0),
        activeInvestors: 156,
        successfulProjects: 24,
        totalUsers: 1250,
        averageROI: "18.5%"
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Default 404
  // Follow/Unfollow endpoints
  if (url.pathname === "/api/follow" && method === "POST") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    try {
      const body = await request.json();
      const { targetId, targetType } = body; // targetType: 'creator' or 'pitch'
      
      // Simulate successful follow
      return new Response(JSON.stringify({
        success: true,
        following: true,
        message: `Successfully followed ${targetType}`
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid request body"
      }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  if (url.pathname === "/api/follow" && method === "DELETE") {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Unauthorized" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }

    try {
      const body = await request.json();
      const { targetId, targetType } = body;
      
      // Simulate successful unfollow
      return new Response(JSON.stringify({
        success: true,
        following: false,
        message: `Successfully unfollowed ${targetType}`
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid request body"
      }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Check follow status
  if (url.pathname === "/api/follow/status" && method === "GET") {
    const urlParams = new URLSearchParams(url.search);
    const targetId = urlParams.get('targetId');
    const targetType = urlParams.get('targetType');
    
    // Return follow status (simulated)
    return new Response(JSON.stringify({
      success: true,
      following: false, // Default to not following
      targetId,
      targetType
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Public pitches endpoint - no auth required
  if (url.pathname === "/api/public/pitches" && method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      pitches: mockPitchesData
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Public trending pitches endpoint
  if (url.pathname === "/api/public/trending" && method === "GET") {
    // Sort by views and likes for trending
    const trendingPitches = [...mockPitchesData]
      .sort((a, b) => {
        const scoreA = (a.views || 0) + (a.likes || 0) * 3;
        const scoreB = (b.views || 0) + (b.likes || 0) * 3;
        return scoreB - scoreA;
      })
      .slice(0, 6);

    return new Response(JSON.stringify({
      success: true,
      pitches: trendingPitches
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Public pitch detail endpoint
  if (url.pathname.startsWith("/api/public/pitch/") && method === "GET") {
    const pitchId = url.pathname.split('/').pop();
    const pitch = mockPitchesData.find(p => p.id.toString() === pitchId);
    
    if (pitch) {
      return new Response(JSON.stringify({
        success: true,
        pitch
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: "Pitch not found"
    }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ 
    error: "Not found",
    path: url.pathname,
    method 
  }), {
    status: 404,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
};

console.log(`🚀 Working server running on http://0.0.0.0:${port}`);
console.log(`
📌 Portal Login Endpoints:
   - Creator: POST /api/auth/creator/login
   - Investor: POST /api/auth/investor/login  
   - Production: POST /api/auth/production/login

📌 Demo Accounts:
   - Creator: alex.creator@demo.com / Demo123456
   - Investor: sarah.investor@demo.com / Demo123456
   - Production: stellar.productions@demo.com / Demo123456
`);

await serve(handler, { 
  port: Number(port),
  hostname: "0.0.0.0"
});