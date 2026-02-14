/**
 * Collaboration Service - API client for collaboration management
 * Integrates with /api/collaborations endpoints (when available)
 * Falls back to related endpoints for partial data
 */

import { apiClient } from '../lib/api-client';

// Types for collaboration data
export interface CollaborationPartner {
  id: string;
  name: string;
  type: 'creator' | 'investor' | 'production' | 'distributor' | 'talent';
  avatar?: string;
  company?: string;
  verified: boolean;
}

export interface CollaborationProject {
  id: string;
  title: string;
  genre: string;
}

export interface CollaborationTerms {
  budget?: number;
  equity?: number;
  timeline?: string;
  deliverables?: string[];
}

export interface Collaboration {
  id: string;
  title: string;
  type: 'co-creation' | 'investment' | 'production' | 'distribution' | 'talent';
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  partner: CollaborationPartner;
  project?: CollaborationProject;
  description: string;
  terms?: CollaborationTerms;
  proposedDate: string;
  startDate?: string;
  endDate?: string;
  lastUpdate: string;
  priority: 'low' | 'medium' | 'high';
  isPublic: boolean;
  metrics?: {
    rating?: number;
    reviews?: number;
    completionRate?: number;
  };
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string } | string;
}

export class CollaborationService {
  /**
   * Get all collaborations for the current user
   */
  static async getCollaborations(filters?: {
    type?: string;
    status?: string;
    partnerId?: string;
  }): Promise<Collaboration[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.partnerId) params.append('partnerId', filters.partnerId);

      const queryString = params.toString();
      const url = `/api/collaborations${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<{ collaborations: Collaboration[] }>(url);

      if (response.success && (response.data as any)?.collaborations) {
        return (response.data as any).collaborations;
      }

      // If no dedicated endpoint exists, return empty array
      // The component will handle empty state gracefully
      return [];
    } catch (error) {
      console.error('Failed to fetch collaborations:', error);
      return [];
    }
  }

  /**
   * Get a specific collaboration by ID
   */
  static async getCollaborationById(collaborationId: string): Promise<Collaboration | null> {
    try {
      const response = await apiClient.get<{ collaboration: Collaboration }>(
        `/api/collaborations/${collaborationId}`
      );

      if (response.success && (response.data as any)?.collaboration) {
        return (response.data as any).collaboration;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch collaboration:', error);
      return null;
    }
  }

  /**
   * Create a new collaboration proposal
   */
  static async createCollaboration(data: {
    title: string;
    type: Collaboration['type'];
    partnerId: string;
    projectId?: string;
    description: string;
    terms?: CollaborationTerms;
    priority?: Collaboration['priority'];
  }): Promise<Collaboration> {
    const response = await apiClient.post<{ collaboration: Collaboration }>(
      '/api/collaborations',
      data
    );

    if (!response.success || !(response.data as any)?.collaboration) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to create collaboration'
      );
    }

    return (response.data as any).collaboration;
  }

  /**
   * Update collaboration status
   */
  static async updateCollaborationStatus(
    collaborationId: string,
    status: Collaboration['status']
  ): Promise<void> {
    const response = await apiClient.put<ApiResponse<{ message: string }>>(
      `/api/collaborations/${collaborationId}/status`,
      { status }
    );

    if (!response.success) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to update collaboration status'
      );
    }
  }

  /**
   * Accept a collaboration proposal
   */
  static async acceptCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'active');
  }

  /**
   * Decline a collaboration proposal
   */
  static async declineCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'declined');
  }

  /**
   * Cancel a collaboration
   */
  static async cancelCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'cancelled');
  }

  /**
   * Mark collaboration as completed
   */
  static async completeCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'completed');
  }

  /**
   * Send a message within a collaboration
   */
  static async sendMessage(
    collaborationId: string,
    message: string
  ): Promise<void> {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      `/api/collaborations/${collaborationId}/messages`,
      { content: message }
    );

    if (!response.success) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to send message'
      );
    }
  }

  /**
   * Get collaboration statistics
   */
  static async getCollaborationStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    completed: number;
    totalValue: number;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{
        stats: {
          total: number;
          active: number;
          pending: number;
          completed: number;
          totalValue: number;
        };
      }>>('/api/collaborations/stats');

      if (response.success && (response.data as any)?.stats) {
        return (response.data as any).stats;
      }

      return {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
        totalValue: 0
      };
    } catch (error) {
      console.error('Failed to fetch collaboration stats:', error);
      return {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
        totalValue: 0
      };
    }
  }
}

export default CollaborationService;
