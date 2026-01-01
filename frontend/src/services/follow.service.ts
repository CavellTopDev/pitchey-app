import { config } from '../config';
import axios from 'axios';

const API_URL = config.API_URL;

export interface User {
  id: string;
  username: string;
  email: string;
  user_type: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  followed_at?: string;
  is_following: boolean;
  follower_count: number;
  following_count: number;
  pitch_count: number;
  mutual_connections?: number;
  common_genres?: number;
  relevance_score?: number;
}

export interface FollowStats {
  followers: number;
  following: number;
  mutual: number;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface FollowGrowth {
  date: string;
  new_followers: number;
  cumulative: number;
}

export interface FollowListResponse {
  users: User[];
  total: number;
  mutualFollows: Array<{
    id: string;
    username: string;
    avatar_url?: string;
  }>;
  hasMore: boolean;
}

export interface FollowStatsResponse {
  stats: FollowStats;
  recentFollowers: Array<{
    id: string;
    username: string;
    avatar_url?: string;
    user_type: string;
    followed_at: string;
  }>;
  growth: FollowGrowth[];
}

class FollowService {
  /**
   * Follow or unfollow a user
   */
  async toggleFollow(userId: string, action: 'follow' | 'unfollow'): Promise<{
    isFollowing: boolean;
    followerCount: number;
    followingCount: number;
  }> {
    try {
      const response = await axios.post(
        `${API_URL}/api/follows/action`,
        { userId, action },
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      throw error;
    }
  }

  /**
   * Follow a user
   */
  async follow(userId: string): Promise<any> {
    return this.toggleFollow(userId, 'follow');
  }

  /**
   * Unfollow a user
   */
  async unfollow(userId: string): Promise<any> {
    return this.toggleFollow(userId, 'unfollow');
  }

  /**
   * Get followers list
   */
  async getFollowers(userId?: string, limit = 50, offset = 0): Promise<FollowListResponse> {
    try {
      const params = new URLSearchParams({
        type: 'followers',
        limit: limit.toString(),
        offset: offset.toString()
      });
      if (userId) params.append('userId', userId);
      
      const response = await axios.get(
        `${API_URL}/api/follows/list?${params.toString()}`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get followers:', error);
      throw error;
    }
  }

  /**
   * Get following list
   */
  async getFollowing(userId?: string, limit = 50, offset = 0): Promise<FollowListResponse> {
    try {
      const params = new URLSearchParams({
        type: 'following',
        limit: limit.toString(),
        offset: offset.toString()
      });
      if (userId) params.append('userId', userId);
      
      const response = await axios.get(
        `${API_URL}/api/follows/list?${params.toString()}`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get following:', error);
      throw error;
    }
  }

  /**
   * Get follow statistics for a user
   */
  async getFollowStats(userId?: string): Promise<FollowStatsResponse> {
    try {
      const params = userId ? `?userId=${userId}` : '';
      const response = await axios.get(
        `${API_URL}/api/follows/stats${params}`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get follow stats:', error);
      throw error;
    }
  }

  /**
   * Get follow suggestions
   */
  async getFollowSuggestions(): Promise<User[]> {
    try {
      const response = await axios.get(
        `${API_URL}/api/follows/suggestions`,
        { withCredentials: true }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get follow suggestions:', error);
      throw error;
    }
  }

  /**
   * Check if following a user
   */
  async isFollowing(userId: string): Promise<boolean> {
    try {
      const stats = await this.getFollowStats(userId);
      return stats.stats.isFollowing;
    } catch (error) {
      console.error('Failed to check follow status:', error);
      return false;
    }
  }

  /**
   * Get mutual followers
   */
  async getMutualFollowers(userId: string): Promise<User[]> {
    try {
      const followers = await this.getFollowers(userId);
      const following = await this.getFollowing(userId);
      
      // Find users who appear in both lists
      const followerIds = new Set(followers.users.map(u => u.id));
      const mutual = following.users.filter(u => followerIds.has(u.id));
      
      return mutual;
    } catch (error) {
      console.error('Failed to get mutual followers:', error);
      return [];
    }
  }

  /**
   * Batch check follow status for multiple users
   */
  async checkFollowStatus(userIds: string[]): Promise<Map<string, boolean>> {
    try {
      const response = await axios.post(
        `${API_URL}/api/follows/check-status`,
        { userIds },
        { withCredentials: true }
      );
      return new Map(Object.entries(response.data.data));
    } catch (error) {
      console.error('Failed to check follow status:', error);
      return new Map();
    }
  }
}

export const followService = new FollowService();