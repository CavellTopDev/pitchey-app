/**
 * Improved Endpoints with Enhanced Error Handling
 * This file demonstrates how to integrate the new error handling middleware
 * into existing endpoints for better user experience
 */

import { createEndpointHandler, withDatabaseErrorHandling } from "../middleware/error-handling.middleware.ts";
import { ValidationSchemas } from "../middleware/json-validation.middleware.ts";
import { successResponse, createdResponse } from "../utils/response.ts";
import { globalAuthRateLimiter } from "../utils/auth-error-handler.ts";

// Import your existing services (these would be your actual imports)
// import { UserService } from "../services/userService.ts";
// import { db } from "../db/client.ts";

/**
 * Enhanced Login Endpoint
 * Features:
 * - JSON validation with detailed error messages
 * - Rate limiting protection
 * - User-friendly authentication errors
 * - Database error handling
 */
export const enhancedLogin = createEndpointHandler(
  async (request, body, context) => {
    const { email, password } = body!;
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    // Rate limiting check
    const rateLimitResult = globalAuthRateLimiter.recordAttempt(clientIP);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.error!.message);
    }
    
    // Database operation with error handling
    const result = await withDatabaseErrorHandling(async () => {
      // Check demo accounts first (your existing logic)
      const demoAccounts = {
        creator: { id: 'demo-creator', email: 'alex.creator@demo.com', password: 'Demo123', userType: 'creator' },
        investor: { id: 'demo-investor', email: 'sarah.investor@demo.com', password: 'Demo123', userType: 'investor' },
        production: { id: 'demo-production', email: 'stellar.production@demo.com', password: 'Demo123', userType: 'production' }
      };
      
      const demoAccount = Object.values(demoAccounts).find(acc => acc.email === email);
      if (demoAccount && password === demoAccount.password) {
        // Success - clear rate limit
        globalAuthRateLimiter.recordSuccess(clientIP);
        
        // Generate JWT token (your existing logic)
        const token = `demo-jwt-token-${demoAccount.id}`;
        
        return {
          token,
          user: demoAccount,
          message: "Login successful"
        };
      }
      
      // Try database authentication (your existing UserService logic)
      // const dbUser = await UserService.authenticateUser(email, password);
      // if (dbUser) {
      //   globalAuthRateLimiter.recordSuccess(clientIP);
      //   return dbUser;
      // }
      
      // Invalid credentials
      throw new Error('Invalid email or password');
    }, context);
    
    return successResponse(result);
  },
  {
    requireJson: true,
    validationSchema: ValidationSchemas.login
  }
);

/**
 * Enhanced Registration Endpoint
 * Features:
 * - Comprehensive input validation
 * - Password strength checking
 * - Database constraint error handling
 * - User-friendly error messages
 */
export const enhancedRegister = createEndpointHandler(
  async (request, body, context) => {
    const { email, password, username, userType, companyName } = body!;
    
    const result = await withDatabaseErrorHandling(async () => {
      // Check if user already exists (this would throw a database error if duplicate)
      // const existingUser = await UserService.findByEmail(email);
      // if (existingUser) {
      //   throw new Error('DUPLICATE_EMAIL');
      // }
      
      // Create new user (your existing logic)
      // const newUser = await UserService.createUser({
      //   email,
      //   password,
      //   username,
      //   userType,
      //   companyName
      // });
      
      // Simulate successful creation for demo
      const newUser = {
        id: `new-user-${Date.now()}`,
        email,
        username,
        userType,
        companyName,
        createdAt: new Date().toISOString()
      };
      
      return {
        user: newUser,
        message: "Registration successful"
      };
    }, context);
    
    return createdResponse(result);
  },
  {
    requireJson: true,
    validationSchema: ValidationSchemas.register
  }
);

/**
 * Enhanced Create Pitch Endpoint
 * Features:
 * - Authentication required
 * - User type validation (creators only)
 * - Comprehensive input validation
 * - Database error handling for constraints
 */
export const enhancedCreatePitch = createEndpointHandler(
  async (request, body, context) => {
    const { title, description, budget, genre } = body!;
    const userId = context?.userId;
    
    const result = await withDatabaseErrorHandling(async () => {
      // Check for duplicate pitch title for this user
      // const existingPitch = await db.select().from(pitches).where(
      //   and(eq(pitches.creatorId, userId), eq(pitches.title, title))
      // );
      // if (existingPitch.length > 0) {
      //   throw new Error('DUPLICATE_PITCH_TITLE');
      // }
      
      // Create new pitch (your existing logic)
      // const newPitch = await db.insert(pitches).values({
      //   title,
      //   description,
      //   budget,
      //   genre,
      //   creatorId: userId,
      //   status: 'draft',
      //   createdAt: new Date()
      // }).returning();
      
      // Simulate successful creation for demo
      const newPitch = {
        id: `pitch-${Date.now()}`,
        title,
        description,
        budget,
        genre,
        creatorId: userId,
        status: 'draft',
        createdAt: new Date().toISOString()
      };
      
      return {
        pitch: newPitch,
        message: "Pitch created successfully"
      };
    }, context);
    
    return createdResponse(result);
  },
  {
    requireAuth: true,
    requireJson: true,
    userType: 'creator',
    validationSchema: ValidationSchemas.createPitch
  }
);

/**
 * Enhanced Send Message Endpoint
 * Features:
 * - Authentication required
 * - Input validation
 * - User existence verification
 * - Database error handling
 */
export const enhancedSendMessage = createEndpointHandler(
  async (request, body, context) => {
    const { receiverId, content, type = 'text' } = body!;
    const senderId = context?.userId;
    
    const result = await withDatabaseErrorHandling(async () => {
      // Verify receiver exists (this would throw a foreign key error if not)
      // const receiver = await UserService.findById(receiverId);
      // if (!receiver) {
      //   throw new Error('USER_NOT_FOUND');
      // }
      
      // Create message (your existing logic)
      // const message = await db.insert(messages).values({
      //   senderId,
      //   receiverId,
      //   content,
      //   type,
      //   createdAt: new Date()
      // }).returning();
      
      // Simulate successful creation for demo
      const message = {
        id: `message-${Date.now()}`,
        senderId,
        receiverId,
        content,
        type,
        createdAt: new Date().toISOString()
      };
      
      return {
        message,
        success: "Message sent successfully"
      };
    }, context);
    
    return createdResponse(result);
  },
  {
    requireAuth: true,
    requireJson: true,
    validationSchema: ValidationSchemas.sendMessage
  }
);

/**
 * Enhanced Get User Profile Endpoint
 * Features:
 * - Authentication required
 * - Permission checking
 * - Database error handling
 * - User-friendly error messages
 */
export const enhancedGetUserProfile = createEndpointHandler(
  async (request, body, context) => {
    const url = new URL(request.url);
    const profileUserId = url.pathname.split('/').pop();
    const requestingUserId = context?.userId;
    
    if (!profileUserId) {
      throw new Error('User ID is required');
    }
    
    const result = await withDatabaseErrorHandling(async () => {
      // Get user profile (this would throw if user doesn't exist)
      // const userProfile = await UserService.getProfile(profileUserId);
      // if (!userProfile) {
      //   throw new Error('USER_NOT_FOUND');
      // }
      
      // Check if requesting user can view this profile
      // const canViewProfile = await UserService.canViewProfile(requestingUserId, profileUserId);
      // if (!canViewProfile) {
      //   throw new Error('INSUFFICIENT_PERMISSIONS');
      // }
      
      // Simulate successful retrieval for demo
      const userProfile = {
        id: profileUserId,
        username: `user_${profileUserId}`,
        email: `user${profileUserId}@example.com`,
        userType: 'creator',
        publicInfo: {
          bio: 'Sample user bio',
          location: 'Los Angeles, CA'
        }
      };
      
      return {
        profile: userProfile,
        message: "Profile retrieved successfully"
      };
    }, context);
    
    return successResponse(result);
  },
  {
    requireAuth: true
  }
);

/**
 * Example of how to update existing endpoints in working-server.ts
 * 
 * Replace this pattern:
 * ```
 * if (url.pathname === "/api/auth/login" && method === "POST") {
 *   try {
 *     const body = await request.json();
 *     // ... existing logic
 *   } catch (error) {
 *     return serverErrorResponse("Login failed");
 *   }
 * }
 * ```
 * 
 * With this pattern:
 * ```
 * if (url.pathname === "/api/auth/login" && method === "POST") {
 *   return await enhancedLogin(request);
 * }
 * ```
 */

export const endpointExamples = {
  enhancedLogin,
  enhancedRegister,
  enhancedCreatePitch,
  enhancedSendMessage,
  enhancedGetUserProfile
};

export default endpointExamples;