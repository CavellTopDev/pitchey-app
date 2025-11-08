import { db } from "../db/client.ts";
import { users, pitches, follows } from "../db/schema.ts";
import { eq, and, sql, desc } from "npm:drizzle-orm@0.35.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { AuthService } from "./auth.service.ts";
import { CacheService } from "./cache.service.ts";

export const UpdateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  profileImageUrl: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  companyAddress: z.string().optional(),
});

export class UserService {
  // Re-export auth methods for convenience
  static register = AuthService.register;
  static login = AuthService.login;
  static verifySession = AuthService.verifySession;
  static logout = AuthService.logout;
  static verifyToken = AuthService.verifyToken;
  
  static async getUserById(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        passwordHash: false, // Exclude password
        emailVerificationToken: false, // Exclude sensitive tokens
      },
    });
    
    return user;
  }
  
  static async getUserByEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      },
    });
    
    return user;
  }
  
  static async updateProfile(userId: number, data: z.infer<typeof UpdateProfileSchema>) {
    const validated = UpdateProfileSchema.parse(data);
    
    const [updatedUser] = await db.update(users)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        userType: users.userType,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        location: users.location,
        bio: users.bio,
        profileImageUrl: users.profileImageUrl,
        companyName: users.companyName,
        companyWebsite: users.companyWebsite,
        companyAddress: users.companyAddress,
        emailVerified: users.emailVerified,
        companyVerified: users.companyVerified,
        subscriptionTier: users.subscriptionTier,
        updatedAt: users.updatedAt,
      });
    
    // Invalidate user session cache after profile update
    try {
      await CacheService.invalidateUserSession(userId);
    } catch (error) {
      console.warn("Failed to invalidate user session cache:", error);
    }
    
    return updatedUser;
  }
  
  static async getUserProfile(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      },
    });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get additional stats based on user type
    let additionalData = {};
    
    if (user.userType === "creator") {
      // Get creator stats
      const pitchStats = await db
        .select({
          totalPitches: sql<number>`count(*)`,
          publishedPitches: sql<number>`count(*) filter (where status = 'published')`,
          totalViews: sql<number>`sum(view_count)`,
          totalLikes: sql<number>`sum(like_count)`,
          totalNDAs: sql<number>`sum(nda_count)`,
        })
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .groupBy(pitches.userId);
      
      additionalData = {
        stats: pitchStats[0] || {
          totalPitches: 0,
          publishedPitches: 0,
          totalViews: 0,
          totalLikes: 0,
          totalNDAs: 0,
        },
      };
    } else if (user.userType === "investor") {
      // Get investor stats (follows, investments, etc.)
      const followStats = await db
        .select({
          totalFollows: sql<number>`count(*)`,
        })
        .from(follows)
        .where(eq(follows.followerId, userId));
      
      additionalData = {
        stats: {
          totalFollows: followStats[0]?.totalFollows || 0,
        },
      };
    }
    
    return {
      ...user,
      ...additionalData,
    };
  }
  
  static async searchUsers(params: {
    query?: string;
    userType?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (params.userType) {
      conditions.push(eq(users.userType, params.userType as any));
    }
    
    // Basic search - would need full-text search for production
    let query = db.query.users.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit: params.limit || 20,
      offset: params.offset || 0,
      orderBy: [desc(users.createdAt)],
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      },
    });
    
    return await query;
  }
  
  static async getUserDashboardData(userId: number) {
    const user = await this.getUserProfile(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const dashboardData: any = {
      user,
      recentActivity: [],
    };
    
    if (user.userType === "creator") {
      // Get recent pitches
      const recentPitches = await db
        .select()
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .orderBy(desc(pitches.updatedAt))
        .limit(5);
      
      dashboardData.recentPitches = recentPitches;
    } else if (user.userType === "investor") {
      // Get followed pitches
      const followedPitches = await db
        .select({
          follow: follows,
          pitch: pitches,
          creator: {
            username: users.username,
            companyName: users.companyName,
          },
        })
        .from(follows)
        .leftJoin(pitches, eq(follows.pitchId, pitches.id))
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.followedAt))
        .limit(5);
      
      const formattedFollowedPitches = followedPitches.map(row => ({
        ...row.follow,
        pitch: {
          ...row.pitch,
          creator: row.creator,
        },
      }));
      
      dashboardData.followedPitches = formattedFollowedPitches;
    }
    
    return dashboardData;
  }
  
  static async followPitch(userId: number, pitchId: number) {
    const [follow] = await db.insert(follows)
      .values({
        followerId: userId,
        pitchId,
      })
      .onConflictDoNothing()
      .returning();
    
    return follow;
  }
  
  static async unfollowPitch(userId: number, pitchId: number) {
    await db.delete(follows)
      .where(and(
        eq(follows.followerId, userId),
        eq(follows.pitchId, pitchId)
      ));
  }
  
  static async getFollowedPitches(userId: number, limit = 20, offset = 0) {
    const results = await db
      .select({
        follow: follows,
        pitch: pitches,
        creator: {
          username: users.username,
          companyName: users.companyName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(follows)
      .leftJoin(pitches, eq(follows.pitchId, pitches.id))
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.followedAt))
      .limit(limit)
      .offset(offset);
    
    return results.map(row => ({
      ...row.follow,
      pitch: {
        ...row.pitch,
        creator: row.creator,
      },
    }));
  }
  
  static async deactivateAccount(userId: number) {
    const [deactivatedUser] = await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        isActive: users.isActive,
      });
    
    // Optionally set pitches to hidden
    await db.update(pitches)
      .set({
        status: "hidden",
        updatedAt: new Date(),
      })
      .where(eq(pitches.userId, userId));
    
    return deactivatedUser;
  }
  
  static async reactivateAccount(userId: number) {
    const [reactivatedUser] = await db.update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        isActive: users.isActive,
      });
    
    return reactivatedUser;
  }

  static async getUserCreditsBalance(userId: number) {
    // Mock credits system for demo - returns default values
    // In production, this would query a proper credits table
    return {
      userId,
      balance: 100, // Demo user starts with 100 credits
      totalPurchased: 100,
      totalUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static async createUser(data: any) {
    try {
      const result = await AuthService.register(data);
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}