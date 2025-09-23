// Fixed authentication server with working login/registration for Pitchey v0.2
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const port = Deno.env.get("PORT") || "8000";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-this-in-production";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// In-memory user storage (replace with database in production)
const users = new Map();
const sessions = new Map();

// Initialize with demo users
async function initDemoUsers() {
  const demoPassword = await bcrypt.hash("Demo123!");
  
  users.set("alex.creator@demo.com", {
    id: "creator-demo-id",
    email: "alex.creator@demo.com",
    password: demoPassword,
    name: "Alex Chen",
    firstName: "Alex",
    lastName: "Chen",
    role: "creator",
    userType: "creator",
    companyName: "Rodriguez Films",
    bio: "Award-winning filmmaker with 15 years of experience",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  });

  users.set("sarah.investor@demo.com", {
    id: "investor-demo-id",
    email: "sarah.investor@demo.com",
    password: demoPassword,
    name: "Sarah Thompson",
    firstName: "Sarah",
    lastName: "Thompson",
    role: "investor",
    userType: "investor",
    companyName: "Thompson Ventures",
    investorType: "Angel Investor",
    bio: "Angel investor focusing on entertainment and media",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  users.set("stellar.production@demo.com", {
    id: "production-demo-id",
    email: "stellar.production@demo.com",
    password: demoPassword,
    name: "Stellar Productions",
    contactName: "Michael Roberts",
    role: "production",
    userType: "production",
    companyName: "Stellar Productions",
    bio: "Full-service production company with state-of-the-art facilities",
    location: "Los Angeles, CA",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=stellar",
    createdAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  });

  console.log("Demo users initialized");
}

// Generate JWT token
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
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    key
  );
}

// Verify JWT token
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
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

// Get user by ID (without password)
function getUserById(userId: string) {
  for (const [email, user] of users) {
    if (user.id === userId) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
  }
  return null;
}

// Main request handler
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (url.pathname === "/health" && method === "GET") {
    return new Response(JSON.stringify({ 
      status: "healthy",
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Creator registration
  if (url.pathname === "/api/auth/creator/register" && method === "POST") {
    try {
      const { email, password, firstName, lastName, companyName, bio } = await request.json();
      
      // Validation
      if (!email || !password || !firstName || !lastName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email exists
      if (users.has(email)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already registered" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password);
      const userId = `creator-${Date.now()}`;
      
      const newUser = {
        id: userId,
        email,
        password: hashedPassword,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        role: "creator",
        userType: "creator",
        companyName: companyName || null,
        bio: bio || null,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        createdAt: new Date().toISOString()
      };
      
      users.set(email, newUser);
      
      // Generate token
      const token = await generateToken(userId, email, "creator");
      sessions.set(token, userId);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
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
      
      // Validation
      if (!email || !password || !firstName || !lastName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email exists
      if (users.has(email)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already registered" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password);
      const userId = `investor-${Date.now()}`;
      
      const newUser = {
        id: userId,
        email,
        password: hashedPassword,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        role: "investor",
        userType: "investor",
        companyName: companyName || null,
        investorType: investorType || "Angel Investor",
        bio: bio || null,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        createdAt: new Date().toISOString()
      };
      
      users.set(email, newUser);
      
      // Generate token
      const token = await generateToken(userId, email, "investor");
      sessions.set(token, userId);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
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
      
      // Validation
      if (!email || !password || !companyName || !contactName) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required fields" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      // Check if email exists
      if (users.has(email)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email already registered" 
        }), {
          status: 409,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }
      
      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password);
      const userId = `production-${Date.now()}`;
      
      const newUser = {
        id: userId,
        email,
        password: hashedPassword,
        name: companyName,
        contactName,
        role: "production",
        userType: "production",
        companyName,
        bio: bio || null,
        location: location || null,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        createdAt: new Date().toISOString()
      };
      
      users.set(email, newUser);
      
      // Generate token
      const token = await generateToken(userId, email, "production");
      sessions.set(token, userId);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
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

  // Universal login endpoint
  if (url.pathname === "/api/auth/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      if (!email || !password) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Email and password are required" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const user = users.get(email);
      if (!user) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const token = await generateToken(user.id, user.email, user.role);
      sessions.set(token, user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Creator-specific login
  if (url.pathname === "/api/auth/creator/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      const user = users.get(email);
      if (!user || user.role !== "creator") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid creator credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const token = await generateToken(user.id, user.email, user.role);
      sessions.set(token, user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Creator login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Investor-specific login
  if (url.pathname === "/api/auth/investor/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      const user = users.get(email);
      if (!user || user.role !== "investor") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid investor credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const token = await generateToken(user.id, user.email, user.role);
      sessions.set(token, user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Investor login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Production-specific login
  if (url.pathname === "/api/auth/production/login" && method === "POST") {
    try {
      const { email, password } = await request.json();
      
      const user = users.get(email);
      if (!user || user.role !== "production") {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid production credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Invalid credentials" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" }
        });
      }

      const token = await generateToken(user.id, user.email, user.role);
      sessions.set(token, user.id);
      
      const { password: _, ...userWithoutPassword } = user;
      
      return new Response(JSON.stringify({
        success: true,
        token,
        user: userWithoutPassword
      }), {
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    } catch (error) {
      console.error("Production login error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Login failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" }
      });
    }
  }

  // Get current user
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

    const user = getUserById(payload.userId);
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

  // Logout endpoint
  if (url.pathname === "/api/auth/logout" && method === "POST") {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      sessions.delete(token);
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Logged out successfully"
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" }
    });
  }

  // Default 404
  return new Response(JSON.stringify({ 
    error: "Not found",
    path: url.pathname,
    method
  }), {
    status: 404,
    headers: { ...corsHeaders, "content-type": "application/json" }
  });
}

// Initialize demo users and start server
await initDemoUsers();

console.log(`Authentication server running on http://localhost:${port}`);

await serve(handleRequest, { port: parseInt(port) });