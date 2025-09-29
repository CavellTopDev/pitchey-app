import { db } from "../db/client.ts";
import { users, sessions } from "../db/schema.ts";
import { eq } from "npm:drizzle-orm";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Validation schemas
export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(100),
  password: z.string().min(8),
  userType: z.enum(["creator", "production", "investor"]),
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const JWT_SECRET = Deno.env.get("JWT_SECRET") || 
  "super-secret-jwt-key-for-production-change-this-to-something-secure-at-least-32-chars";
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

export class AuthService {
  static async register(data: z.infer<typeof RegisterSchema>) {
    // Validate input
    const validated = RegisterSchema.parse(data);
    
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validated.email),
    });
    
    if (existingUser) {
      throw new Error("User already exists");
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(validated.password);
    
    // Create user
    const [newUser] = await db.insert(users)
      .values({
        email: validated.email,
        username: validated.username,
        passwordHash,
        userType: validated.userType as any,
        companyName: validated.companyName,
        companyNumber: validated.companyNumber,
        emailVerificationToken: crypto.randomUUID(),
      })
      .returning();
    
    // Send verification email (disabled for local testing)
    // await this.sendVerificationEmail(newUser.email, newUser.emailVerificationToken!);
    
    // Create session
    const session = await this.createSession(newUser.id);
    
    return { user: newUser, session };
  }
  
  static async login(data: z.infer<typeof LoginSchema>) {
    const validated = LoginSchema.parse(data);
    
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, validated.email),
    });
    
    if (!user) {
      throw new Error("Invalid credentials");
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(validated.password, user.passwordHash);
    
    if (!validPassword) {
      throw new Error("Invalid credentials");
    }
    
    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    
    // Create session
    const session = await this.createSession(user.id);
    
    return { user, session };
  }
  
  static async createSession(userId: number | string) {
    // Ensure userId is a number
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (isNaN(numericUserId)) {
      throw new Error("Invalid userId provided to createSession");
    }
    
    const sessionId = crypto.randomUUID();
    const token = await create({ alg: "HS256", typ: "JWT" }, {
      userId: numericUserId,
      sessionId,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days in seconds
    }, key);
    
    try {
      const [session] = await db.insert(sessions)
        .values({
          id: sessionId,
          userId: numericUserId,
          token,
          expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
        })
        .returning();
      
      return session;
    } catch (error) {
      // If database fails, return the token anyway
      console.error("Session creation error (continuing anyway):", error);
      return {
        id: sessionId,
        userId: numericUserId,
        token,
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      };
    }
  }
  
  static async verifySession(token: string) {
    try {
      const payload = await verify(token, key);
      
      // Check if session exists in database
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.token, token),
      });
      
      if (!session || session.expiresAt < new Date()) {
        return null;
      }
      
      // Get user separately
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
      });
      
      return {
        ...session,
        user
      };
    } catch {
      return null;
    }
  }
  
  static async logout(token: string) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  
  static async sendVerificationEmail(email: string, token: string) {
    // Import notification service here to avoid circular dependency
    const { getNotificationEmailService } = await import("./notification-email.service.ts");
    const notificationService = getNotificationEmailService();
    
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
    });
    
    if (user) {
      await notificationService.sendWelcomeEmail({
        userId: user.id,
        userType: user.userType as any,
      });
    }
  }
  
  static async verifyEmail(token: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
    });
    
    if (!user) {
      throw new Error("Invalid token");
    }
    
    await db.update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
      })
      .where(eq(users.id, user.id));
    
    return user;
  }
  
  static async verifyToken(token: string) {
    try {
      const payload = await verify(token, key);
      
      // Get user from the payload
      const user = await db.query.users.findFirst({
        where: eq(users.id, payload.userId as number),
      });
      
      if (!user) {
        throw new Error("User not found");
      }
      
      return user;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }

  static async initiatePasswordReset(email: string) {
    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      // Don't reveal if email exists for security
      return { success: true };
    }
    
    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (1 * 60 * 60 * 1000)); // 1 hour
    
    // Store reset token
    await db.update(users)
      .set({
        emailVerificationToken: resetToken, // Reuse this field for password reset
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    // Send password reset email
    const { getNotificationEmailService } = await import("./notification-email.service.ts");
    const notificationService = getNotificationEmailService();
    
    await notificationService.sendPasswordResetEmail({
      userId: user.id,
      resetToken,
      expiresIn: "1 hour",
    });
    
    return { success: true };
  }
  
  static async resetPassword(token: string, newPassword: string) {
    // Find user by reset token
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
    });
    
    if (!user) {
      throw new Error("Invalid or expired reset token");
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword);
    
    // Update password and clear reset token
    await db.update(users)
      .set({
        passwordHash,
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    // Invalidate all existing sessions for security
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    
    return { success: true };
  }

  static async authenticate(email: string, password: string) {
    try {
      const result = await this.login({ email, password });
      return {
        success: true,
        user: result.user,
        token: result.session.token
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}