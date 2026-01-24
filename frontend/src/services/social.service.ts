// Social Service - Follows, likes, and social interactions with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { User, Pitch } from '../types/api';

// Types matching Drizzle schema
export interface Follow {
  id: number;
  followerId: number;
  creatorId?: number;  // For following users
  pitchId?: number;    // For following pitches
  followedAt: string;  // Matches database column name
  follower?: User;
  creator?: User;      // When following a user
  pitch?: Pitch;       // When following a pitch
}

export interface Activity {
  id: number;
  userId: number;
  type: 'follow' | 'like' | 'pitch_created' | 'pitch_published' | 'nda_signed';
  entityType: 'user' | 'pitch';
  entityId: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: User;
  entity?: User | Pitch;
}

export interface SocialStats {
  followers: number;
  following: number;
  totalLikes: number;
  totalViews: number;
  engagement: number;
}

// API response types
interface FollowStatusResponseData {
  isFollowing: boolean;
}

interface FollowersResponseData {
  followers: Follow[];
  total: number;
}

interface FollowingResponseData {
  following: Follow[];
  total: number;
}

interface UsersResponseData {
  users: User[];
}

interface ActivityFeedResponseData {
  activities: Activity[];
  total: number;
}

interface SocialStatsResponseData {
  stats: SocialStats;
}

interface LikeStatusResponseData {
  isLiked: boolean;
}

interface PitchLikesResponseData {
  users: User[];
  total: number;
}

// Helper function to extract error message
function getErrorMessage(error: { message: string } | string | undefined, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    return error.message;
  }
  return error ?? fallback;
}

export class SocialService {
  // Follow a user
  static async followUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/follow',
      {
        creatorId: userId,   // Matches database column
        pitchId: null        // Explicitly null for user follows
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to follow user'));
    }
  }

  // Unfollow a user
  static async unfollowUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/unfollow',
      {
        creatorId: userId,   // Matches database column
        pitchId: null        // Explicitly null for user unfollows
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unfollow user'));
    }
  }

  // Follow a pitch
  static async followPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/follow',
      {
        pitchId: pitchId,    // Matches database column
        creatorId: null      // Explicitly null for pitch follows
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to follow pitch'));
    }
  }

  // Unfollow a pitch
  static async unfollowPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/follows/unfollow',
      {
        pitchId: pitchId,    // Matches database column
        creatorId: null      // Explicitly null for pitch unfollows
      }
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unfollow pitch'));
    }
  }

  // Check if following
  static async checkFollowStatus(targetId: number, type: 'user' | 'pitch'): Promise<boolean> {
    const params = new URLSearchParams();
    // Use the correct parameter name based on type
    if (type === 'user') {
      params.append('targetId', targetId.toString());  // Backend still expects targetId for check
      params.append('type', 'user');
    } else if (type === 'pitch') {
      params.append('targetId', targetId.toString());  // Backend still expects targetId for check
      params.append('type', 'pitch');
    }

    const response = await apiClient.get<FollowStatusResponseData>(
      `/api/follows/check?${params.toString()}`
    );

    if (response.success !== true) {
      return false;
    }

    return response.data?.isFollowing ?? false;
  }

  // Get followers
  static async getFollowers(userId?: number, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ followers: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId !== undefined && userId !== 0) params.append('userId', userId.toString());
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    const response = await apiClient.get<FollowersResponseData>(
      `/api/follows/followers?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch followers'));
    }

    return {
      followers: response.data?.followers ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get following
  static async getFollowing(userId?: number, options?: {
    type?: 'user' | 'pitch' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ following: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId !== undefined && userId !== 0) params.append('userId', userId.toString());
    if (options?.type !== undefined) params.append('type', options.type);
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    const response = await apiClient.get<FollowingResponseData>(
      `/api/follows/following?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch following'));
    }

    return {
      following: response.data?.following ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get mutual followers
  static async getMutualFollowers(userId: number): Promise<User[]> {
    const response = await apiClient.get<UsersResponseData>(
      `/api/follows/mutual/${userId.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch mutual followers'));
    }

    return response.data?.users ?? [];
  }

  // Get suggested users to follow
  static async getSuggestedUsers(limit: number = 5): Promise<User[]> {
    const response = await apiClient.get<UsersResponseData>(
      `/api/follows/suggestions?limit=${limit.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch suggestions'));
    }

    return response.data?.users ?? [];
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    userId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.userId !== undefined && options.userId !== 0) params.append('userId', options.userId.toString());
    if (options?.type !== undefined && options.type !== '') params.append('type', options.type);
    if (options?.limit !== undefined && options.limit !== 0) params.append('limit', options.limit.toString());
    if (options?.offset !== undefined && options.offset !== 0) params.append('offset', options.offset.toString());

    const response = await apiClient.get<ActivityFeedResponseData>(
      `/api/activity/feed?${params.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch activity feed'));
    }

    return {
      activities: response.data?.activities ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Get social stats
  static async getSocialStats(userId?: number): Promise<SocialStats> {
    const endpoint = userId !== undefined && userId !== 0 ? `/api/social/stats/${userId.toString()}` : '/api/social/stats';
    const response = await apiClient.get<SocialStatsResponseData>(endpoint);

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch social stats'));
    }

    return response.data?.stats ?? {
      followers: 0,
      following: 0,
      totalLikes: 0,
      totalViews: 0,
      engagement: 0
    };
  }

  // Like a pitch
  static async likePitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      `/api/pitches/${pitchId.toString()}/like`,
      {}
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to like pitch'));
    }
  }

  // Unlike a pitch
  static async unlikePitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      `/api/pitches/${pitchId.toString()}/unlike`,
      {}
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unlike pitch'));
    }
  }

  // Check if liked
  static async checkLikeStatus(pitchId: number): Promise<boolean> {
    const response = await apiClient.get<LikeStatusResponseData>(
      `/api/pitches/${pitchId.toString()}/like-status`
    );

    if (response.success !== true) {
      return false;
    }

    return response.data?.isLiked ?? false;
  }

  // Get pitch likes
  static async getPitchLikes(pitchId: number): Promise<{ users: User[]; total: number }> {
    const response = await apiClient.get<PitchLikesResponseData>(
      `/api/pitches/${pitchId.toString()}/likes`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch pitch likes'));
    }

    return {
      users: response.data?.users ?? [],
      total: response.data?.total ?? 0
    };
  }

  // Block user
  static async blockUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      `/api/users/${userId.toString()}/block`,
      {}
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to block user'));
    }
  }

  // Unblock user
  static async unblockUser(userId: number): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      `/api/users/${userId.toString()}/unblock`,
      {}
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to unblock user'));
    }
  }

  // Get blocked users
  static async getBlockedUsers(): Promise<User[]> {
    const response = await apiClient.get<UsersResponseData>(
      '/api/users/blocked'
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch blocked users'));
    }

    return response.data?.users ?? [];
  }

  // Report content
  static async reportContent(data: {
    contentType: 'user' | 'pitch' | 'message';
    contentId: number;
    reason: string;
    details?: string;
  }): Promise<void> {
    const response = await apiClient.post<Record<string, unknown>>(
      '/api/reports',
      data
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to submit report'));
    }
  }
}

// Export singleton instance
export const socialService = SocialService;
