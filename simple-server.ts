// Simple server to demonstrate the Pitchey platform
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { AuthService } from "./src/services/auth.service.ts";
import { PitchService } from "./src/services/pitch.service.ts";
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

const port = 8000;

function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey - Where Ideas Meet Investment</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div class="min-h-screen bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <a href="/" class="text-2xl font-bold text-purple-600">Pitchey</a>
                        <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <a href="/pitches" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">Browse Pitches</a>
                            <a href="/how-it-works" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">How It Works</a>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/login" class="px-3 py-2 text-sm font-medium text-gray-700">Log In</a>
                        <a href="/register" class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">Sign Up</a>
                    </div>
                </div>
            </div>
        </nav>
        
        <!-- Hero Section -->
        <div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div class="text-center">
                    <h1 class="text-4xl md:text-6xl font-bold mb-6">
                        Where Great Ideas Meet Investment
                    </h1>
                    <p class="text-xl md:text-2xl mb-8">
                        Connect creators, production companies, and investors through secure pitch sharing
                    </p>
                    <div class="space-x-4">
                        <a href="/register" class="inline-block px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100">Get Started</a>
                        <a href="/how-it-works" class="inline-block px-8 py-3 bg-purple-700 text-white rounded-lg font-semibold hover:bg-purple-800">Learn More</a>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Features Section -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">Platform Features</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-xl font-semibold mb-2">🔒 Secure Pitches</h3>
                    <p class="text-gray-600">Upload and share your creative projects with built-in NDA protection.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-xl font-semibold mb-2">🤝 Connect Industry</h3>
                    <p class="text-gray-600">Reach production companies and investors looking for the next big project.</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-xl font-semibold mb-2">📊 Track Analytics</h3>
                    <p class="text-gray-600">Monitor views, engagement, and interest in your pitches.</p>
                </div>
            </div>
        </div>
        
        <!-- API Status -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 class="text-3xl font-bold text-gray-900 mb-8">API Endpoints Ready</h2>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold mb-4">✅ Available Endpoints:</h3>
                <ul class="space-y-2 text-gray-600">
                    <li><code class="bg-gray-100 px-2 py-1 rounded">POST /auth/register</code> - User registration</li>
                    <li><code class="bg-gray-100 px-2 py-1 rounded">POST /auth/login</code> - User login</li>
                    <li><code class="bg-gray-100 px-2 py-1 rounded">GET /api/pitches</code> - List all pitches</li>
                    <li><code class="bg-gray-100 px-2 py-1 rounded">POST /api/pitches</code> - Create new pitch</li>
                    <li><code class="bg-gray-100 px-2 py-1 rounded">GET /api/pitches/:id</code> - Get pitch details</li>
                    <li><code class="bg-gray-100 px-2 py-1 rounded">POST /api/pitches/:id/nda</code> - Sign NDA</li>
                </ul>
            </div>
        </div>
        
        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                <p>© 2025 Pitchey. All rights reserved.</p>
            </div>
        </footer>
    </div>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const method = req.method;
  
  // CORS headers for API endpoints
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  
  // Handle OPTIONS requests
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Simple routing
  if (url.pathname === "/") {
    return new Response(renderHomePage(), {
      headers: { "content-type": "text/html" },
    });
  }
  
  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      message: "Pitchey API is running",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  
  // Authentication endpoints
  if (url.pathname === "/auth/register" && method === "POST") {
    try {
      const body = await req.json();
      const result = await AuthService.register(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  if (url.pathname === "/auth/login" && method === "POST") {
    try {
      const body = await req.json();
      const result = await AuthService.login(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Pitch endpoints with search and filtering
  if (url.pathname === "/api/pitches" && method === "GET") {
    try {
      const params = new URLSearchParams(url.search);
      const page = parseInt(params.get("page") || "1");
      const limit = parseInt(params.get("limit") || "20");
      const genre = params.get("genre");
      const format = params.get("format");
      const search = params.get("search");
      
      if (search || genre || format) {
        // Use search method if filters provided
        const results = await PitchService.searchPitches({
          query: search,
          genre: genre as any,
          format: format as any,
          page,
          limit,
        });
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      } else {
        // Default to new pitches
        const pitches = await PitchService.getNewPitches(limit);
        return new Response(JSON.stringify(pitches), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Search endpoint
  if (url.pathname === "/api/search" && method === "GET") {
    try {
      const params = new URLSearchParams(url.search);
      const query = params.get("q");
      const genres = params.getAll("genre[]");
      const formats = params.getAll("format[]");
      const budgetMin = params.get("budgetMin");
      const budgetMax = params.get("budgetMax");
      const sortBy = params.get("sortBy") || "newest";
      const page = parseInt(params.get("page") || "1");
      const limit = parseInt(params.get("limit") || "20");
      
      const results = await PitchService.searchPitches({
        query,
        genre: genres[0] as any,
        format: formats[0] as any,
        page,
        limit,
      });
      
      return new Response(JSON.stringify({
        results,
        totalCount: results.length,
        page,
        totalPages: Math.ceil(results.length / limit)
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Trending pitches
  if (url.pathname === "/api/trending" && method === "GET") {
    try {
      const trending = await PitchService.getTopPitches(10);
      return new Response(JSON.stringify(trending), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  if (url.pathname === "/api/pitches" && method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      const token = authHeader.substring(7);
      const user = await AuthService.verifyToken(token);
      const body = await req.json();
      const pitch = await PitchService.create(user.id, body);
      
      return new Response(JSON.stringify(pitch), {
        status: 201,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Get pitch by ID
  const pitchMatch = url.pathname.match(/^\/api\/pitches\/(\d+)$/);
  if (pitchMatch && method === "GET") {
    try {
      const pitchId = parseInt(pitchMatch[1]);
      const authHeader = req.headers.get("Authorization");
      let viewerId = null;
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const user = await AuthService.verifyToken(token);
          viewerId = user.id;
        } catch {
          // Continue without viewer ID if token invalid
        }
      }
      
      const pitch = await PitchService.getPitch(pitchId, viewerId);
      
      if (!pitch) {
        return new Response(JSON.stringify({ error: "Pitch not found" }), {
          status: 404,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      // Record view if viewer is authenticated
      if (viewerId && viewerId !== pitch.userId) {
        await PitchService.recordView(pitchId, viewerId);
      }
      
      return new Response(JSON.stringify(pitch), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Record pitch view endpoint
  const viewMatch = url.pathname.match(/^\/api\/pitches\/(\d+)\/view$/);
  if (viewMatch && method === "POST") {
    try {
      const pitchId = parseInt(viewMatch[1]);
      const authHeader = req.headers.get("Authorization");
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const user = await AuthService.verifyToken(token);
        await PitchService.recordView(pitchId, user.id);
      }
      
      // Get updated view count
      const pitch = await PitchService.getPitch(pitchId);
      
      return new Response(JSON.stringify({
        message: "View recorded",
        viewCount: pitch?.viewCount || 0
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Get pitch analytics (owner only)
  const analyticsMatch = url.pathname.match(/^\/api\/pitches\/(\d+)\/analytics$/);
  if (analyticsMatch && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      const token = authHeader.substring(7);
      const user = await AuthService.verifyToken(token);
      const pitchId = parseInt(analyticsMatch[1]);
      
      // Check ownership
      const pitch = await PitchService.getPitch(pitchId);
      if (!pitch || pitch.userId !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      // Get analytics data (simplified version)
      const analytics = {
        totalViews: pitch.viewCount,
        uniqueViewers: Math.floor(pitch.viewCount * 0.6), // Simplified
        ndaSignatures: pitch.ndaCount,
        likes: pitch.likeCount,
        viewsByDay: [], // Would need separate analytics table
        viewerDemographics: {
          creators: Math.floor(pitch.viewCount * 0.3),
          producers: Math.floor(pitch.viewCount * 0.5),
          investors: Math.floor(pitch.viewCount * 0.2),
        }
      };
      
      return new Response(JSON.stringify(analytics), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // User Profile endpoints
  if (url.pathname === "/api/profile" && method === "GET") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      const token = authHeader.substring(7);
      const user = await AuthService.verifyToken(token);
      
      // Remove sensitive fields
      const { passwordHash, emailVerificationToken, ...profile } = user;
      
      return new Response(JSON.stringify(profile), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  if (url.pathname === "/api/profile" && method === "PUT") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      const token = authHeader.substring(7);
      const user = await AuthService.verifyToken(token);
      const body = await req.json();
      
      // Update user profile
      const [updatedUser] = await db.update(users)
        .set({
          firstName: body.firstName || user.firstName,
          lastName: body.lastName || user.lastName,
          bio: body.bio || user.bio,
          location: body.location || user.location,
          phone: body.phone || user.phone,
          companyWebsite: body.companyWebsite || user.companyWebsite,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      
      const { passwordHash, emailVerificationToken, ...profile } = updatedUser;
      
      return new Response(JSON.stringify({
        message: "Profile updated successfully",
        user: profile
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // Sign NDA endpoint
  const ndaMatch = url.pathname.match(/^\/api\/pitches\/(\d+)\/nda$/);
  if (ndaMatch && method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      
      const token = authHeader.substring(7);
      const user = await AuthService.verifyToken(token);
      const pitchId = parseInt(ndaMatch[1]);
      const body = await req.json();
      
      const nda = await PitchService.signNda(
        pitchId,
        user.id,
        body.ndaType || "basic"
      );
      
      return new Response(JSON.stringify(nda), {
        status: 201,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
  }
  
  // 404 page
  return new Response("Not Found", { status: 404 });
};

console.log(`🚀 Pitchey server running on http://localhost:${port}`);
await serve(handler, { port });