/**
 * User management resource methods
 */

import { PitcheyAPIClient } from '../client';
import { User, UserPreferences } from '../types';

export class UsersResource {
  constructor(private client: PitcheyAPIClient) {}

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    return this.client.get('/api/user/profile');
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: Partial<User>): Promise<{ message: string; user: User }> {
    return this.client.put('/api/user/profile', data);
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    return this.client.get('/api/user/preferences');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(data: Partial<UserPreferences>): Promise<{ message: string; preferences: UserPreferences }> {
    return this.client.put('/api/user/preferences', data);
  }

  /**
   * Get user by ID
   */
  async get(userId: number): Promise<User> {
    return this.client.get(`/api/users/${userId}`);
  }

  /**
   * Search users
   */
  async search(query: string, params?: { page?: number; limit?: number }): Promise<any> {
    return this.client.get('/api/search/users', { q: query, ...params });
  }

  /**
   * Follow a user
   */
  async follow(userId: number): Promise<{ message: string }> {
    return this.client.post(`/api/users/${userId}/follow`);
  }

  /**
   * Unfollow a user
   */
  async unfollow(userId: number): Promise<{ message: string }> {
    return this.client.delete(`/api/users/${userId}/follow`);
  }

  /**
   * Get user's followers
   */
  async getFollowers(userId?: number, params?: { page?: number; limit?: number }): Promise<any> {
    const endpoint = userId ? `/api/users/${userId}/followers` : '/api/user/followers';
    return this.client.get(endpoint, params);
  }

  /**
   * Get users that user is following
   */
  async getFollowing(userId?: number, params?: { page?: number; limit?: number }): Promise<any> {
    const endpoint = userId ? `/api/users/${userId}/following` : '/api/user/following';
    return this.client.get(endpoint, params);
  }
}