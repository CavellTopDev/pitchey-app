/**
 * Authentication Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { validateEnvironment } from "../utils/env-validation.ts";
import { getCorsHeaders, getSecurityHeaders } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

// Get JWT secret from environment
const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Auth helper functions
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

async function generateToken(user: any): Promise<string> {
  const payload = {
    userId: user.id,
    email: user.email,
    userType: user.user_type,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
  };

  return await create(
    { alg: "HS256", typ: "JWT" },
    payload,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
  );
}

// Route handlers
export const login: RouteHandler = async (request, url) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: "Email and password are required" 
      }), { 
        status: 400,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    // Find user
    const userResults = await db.select().from(users).where(eq(users.email, email));
    
    if (userResults.length === 0) {
      telemetry.logger.warn("Login attempt with invalid email", { email });
      return new Response(JSON.stringify({ 
        error: "Invalid credentials" 
      }), { 
        status: 401,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    const user = userResults[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      telemetry.logger.warn("Login attempt with invalid password", { email, userId: user.id });
      return new Response(JSON.stringify({ 
        error: "Invalid credentials" 
      }), { 
        status: 401,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    // Generate token
    const token = await generateToken(user);

    telemetry.logger.info("User logged in successfully", { userId: user.id, userType: user.user_type });

    return new Response(JSON.stringify({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.firstName,
        userType: user.user_type,
      }
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });

  } catch (error) {
    telemetry.logger.error("Login error", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), { 
      status: 500,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });
  }
};

export const register: RouteHandler = async (request, url) => {
  try {
    const { email, password, name, userType } = await request.json();

    if (!email || !password || !name || !userType) {
      return new Response(JSON.stringify({ 
        error: "All fields are required" 
      }), { 
        status: 400,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    // Check if user exists
    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    
    if (existingUsers.length > 0) {
      return new Response(JSON.stringify({ 
        error: "User already exists" 
      }), { 
        status: 409,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUsers = await db.insert(users).values({
      email,
      password: hashedPassword,
      passwordHash: hashedPassword,
      username: email, // Use email as username for now
      firstName: name,
      userType: userType,
    }).returning();

    const newUser = newUsers[0];

    // Generate token
    const token = await generateToken(newUser);

    telemetry.logger.info("User registered successfully", { userId: newUser.id, userType });

    return new Response(JSON.stringify({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.firstName,
        userType: newUser.user_type,
      }
    }), {
      status: 201,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });

  } catch (error) {
    telemetry.logger.error("Registration error", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), { 
      status: 500,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });
  }
};

export const validateToken: RouteHandler = async (request, url) => {
  try {
    const authHeader = request.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        error: "No token provided" 
      }), { 
        status: 401,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    const token = authHeader.slice(7);

    const payload = await verify(
      token,
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      )
    );

    return new Response(JSON.stringify({
      valid: true,
      user: {
        userId: payload.userId,
        email: payload.email,
        userType: payload.userType
      }
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      valid: false,
      error: "Invalid token" 
    }), { 
      status: 401,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });
  }
};

export const getProfile: RouteHandler = async (request, url) => {
  try {
    const authHeader = request.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ 
        error: "No token provided" 
      }), { 
        status: 401,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    const token = authHeader.slice(7);

    const payload = await verify(
      token,
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      )
    );

    const userResults = await db.select().from(users).where(eq(users.id, payload.userId));
    
    if (userResults.length === 0) {
      return new Response(JSON.stringify({ 
        error: "User not found" 
      }), { 
        status: 404,
        headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
      });
    }

    const user = userResults[0];

    return new Response(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.user_type,
      createdAt: user.created_at
    }), {
      status: 200,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });

  } catch (error) {
    telemetry.logger.error("Get profile error", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), { 
      status: 500,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });
  }
};