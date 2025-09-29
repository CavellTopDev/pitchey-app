// Social Service - Follows, likes, and social interactions with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { User } from './user.service';
import type { Pitch } from './pitch.service';

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
  metadata?: any;
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

export class SocialService {
  // Follow a user
  static async followUser(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/follows/follow',
      { 
        creatorId: userId,   // Matches database column
        pitchId: null        // Explicitly null for user follows
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to follow user');
    }
  }

  // Unfollow a user
  static async unfollowUser(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/follows/unfollow',
      { 
        creatorId: userId,   // Matches database column
        pitchId: null        // Explicitly null for user unfollows
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unfollow user');
    }
  }

  // Follow a pitch
  static async followPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/follows/follow',
      { 
        pitchId: pitchId,    // Matches database column
        creatorId: null      // Explicitly null for pitch follows
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to follow pitch');
    }
  }

  // Unfollow a pitch
  static async unfollowPitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/follows/unfollow',
      { 
        pitchId: pitchId,    // Matches database column
        creatorId: null      // Explicitly null for pitch unfollows
      }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unfollow pitch');
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

    const response = await apiClient.get<{ success: boolean; isFollowing: boolean }>(
      `/api/follows/check?${params}`
    );

    if (!response.success) {
      return false;
    }

    return response.data?.isFollowing || false;
  }

  // Get followers
  static async getFollowers(userId?: number, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ followers: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      followers: Follow[]; 
      total: number 
    }>(`/api/follows/followers?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch followers');
    }

    return {
      followers: response.data?.followers || [],
      total: response.data?.total || 0
    };
  }

  // Get following
  static async getFollowing(userId?: number, options?: {
    type?: 'user' | 'pitch' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{ following: Follow[]; total: number }> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      following: Follow[]; 
      total: number 
    }>(`/api/follows/following?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch following');
    }

    return {
      following: response.data?.following || [],
      total: response.data?.total || 0
    };
  }

  // Get mutual followers
  static async getMutualFollowers(userId: number): Promise<User[]> {
    const response = await apiClient.get<{ success: boolean; users: User[] }>(
      `/api/follows/mutual/${userId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch mutual followers');
    }

    return response.data?.users || [];
  }

  // Get suggested users to follow
  static async getSuggestedUsers(limit: number = 5): Promise<User[]> {
    const response = await apiClient.get<{ success: boolean; users: User[] }>(
      `/api/follows/suggestions?limit=${limit}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch suggestions');
    }

    return response.data?.users || [];
  }

  // Get activity feed
  static async getActivityFeed(options?: {
    userId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ activities: Activity[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.userId) params.append('userId', options.userId.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      activities: Activity[]; 
      total: number 
    }>(`/api/activity/feed?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch activity feed');
    }

    return {
      activities: response.data?.activities || [],
      total: response.data?.total || 0
    };
  }

  // Get social stats
  static async getSocialStats(userId?: number): Promise<SocialStats> {
    const endpoint = userId ? `/api/social/stats/${userId}` : '/api/social/stats';
    const response = await apiClient.get<{ success: boolean; stats: SocialStats }>(endpoint);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch social stats');
    }

    return response.data?.stats || {
      followers: 0,
      following: 0,
      totalLikes: 0,
      totalViews: 0,
      engagement: 0
    };
  }

  // Like a pitch
  static async likePitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/pitches/${pitchId}/like`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to like pitch');
    }
  }

  // Unlike a pitch
  static async unlikePitch(pitchId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/pitches/${pitchId}/unlike`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unlike pitch');
    }
  }

  // Check if liked
  static async checkLikeStatus(pitchId: number): Promise<boolean> {
    const response = await apiClient.get<{ success: boolean; isLiked: boolean }>(
      `/api/pitches/${pitchId}/like-status`
    );

    if (!response.success) {
      return false;
    }

    return response.data?.isLiked || false;
  }

  // Get pitch likes
  static async getPitchLikes(pitchId: number): Promise<{ users: User[]; total: number }> {
    const response = await apiClient.get<{ 
      success: boolean; 
      users: User[]; 
      total: number 
    }>(`/api/pitches/${pitchId}/likes`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch pitch likes');
    }

    return {
      users: response.data?.users || [],
      total: response.data?.total || 0
    };
  }

  // Block user
  static async blockUser(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/users/${userId}/block`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to block user');
    }
  }

  // Unblock user
  static async unblockUser(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/users/${userId}/unblock`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unblock user');
    }
  }

  // Get blocked users
  static async getBlockedUsers(): Promise<User[]> {
    const response = await apiClient.get<{ success: boolean; users: User[] }>(
      '/api/users/blocked'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch blocked users');
    }

    return response.data?.users || [];
  }

  // Report content
  static async reportContent(data: {
    contentType: 'user' | 'pitch' | 'message';
    contentId: number;
    reason: string;
    details?: string;
  }): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/reports',
      data
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to submit report');
    }
  }
}

// Export singleton instance
export const socialService = SocialService;