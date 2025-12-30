// NDA Service - Complete NDA management with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { 
  NDA, 
  NDARequest, 
  User, 
  Pitch,
  ApiResponse 
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Export types from centralized types file
export type { NDA, NDARequest } from '../types/api';

export interface NDATemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
  variables?: string[];
  isDefault?: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface NDARequestInput {
  pitchId: number;
  message?: string;
  templateId?: number;
  expiryDays?: number;
}

export interface NDASignature {
  ndaId: number;
  signature: string;
  fullName: string;
  title?: string;
  company?: string;
  acceptTerms: boolean;
}

export interface NDAFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  pitchId?: number;
  requesterId?: number;
  creatorId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface NDAStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  revoked: number;
  avgResponseTime?: number;
  approvalRate?: number;
}

export class NDAService {
  // Request NDA for a pitch
  static async requestNDA(request: NDARequestInput): Promise<NDA> {
    const response = await apiClient.post<ApiResponse<NDA>>(
      '/api/ndas/request',
      request
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to request NDA');
    }

    // Return the request data as NDA object
    return response.data;
  }

  // Sign NDA
  static async signNDA(signature: NDASignature): Promise<NDA> {
    const response = await apiClient.post<ApiResponse<{ nda: NDA }>>(
      `/api/ndas/${signature.ndaId}/sign`,
      signature
    );

    if (!response.success || !response.data?.nda) {
      throw new Error(response.error?.message || 'Failed to sign NDA');
    }

    return response.data.nda;
  }

  // Approve NDA request (for creators)
  static async approveNDA(ndaId: number, notes?: string): Promise<NDA> {
    const response = await apiClient.post<ApiResponse<{ nda: NDA }>>(
      `/api/ndas/${ndaId}/approve`,
      { notes }
    );

    if (!response.success || !response.data?.nda) {
      throw new Error(response.error?.message || 'Failed to approve NDA');
    }

    return response.data.nda;
  }

  // Reject NDA request (for creators)
  static async rejectNDA(ndaId: number, reason: string): Promise<NDA> {
    const response = await apiClient.post<ApiResponse<{ nda: NDA }>>(
      `/api/ndas/${ndaId}/reject`,
      { reason }
    );

    if (!response.success || !response.data?.nda) {
      throw new Error(response.error?.message || 'Failed to reject NDA');
    }

    return response.data.nda;
  }

  // Revoke NDA (for creators)
  static async revokeNDA(ndaId: number, reason?: string): Promise<NDA> {
    const response = await apiClient.post<ApiResponse<{ nda: NDA }>>(
      `/api/ndas/${ndaId}/revoke`,
      { reason }
    );

    if (!response.success || !response.data?.nda) {
      throw new Error(response.error?.message || 'Failed to revoke NDA');
    }

    return response.data.nda;
  }

  // Get NDA by ID
  static async getNDAById(ndaId: number): Promise<NDA> {
    const response = await apiClient.get<ApiResponse<{ nda: NDA }>>(
      `/api/ndas/${ndaId}`
    );

    if (!response.success || !response.data?.nda) {
      throw new Error(response.error?.message || 'NDA not found');
    }

    return response.data.nda;
  }

  // Get NDAs with filters
  static async getNDAs(filters?: NDAFilters): Promise<{ ndas: NDA[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.pitchId) params.append('pitchId', filters.pitchId.toString());
    if (filters?.requesterId) params.append('requesterId', filters.requesterId.toString());
    if (filters?.creatorId) params.append('creatorId', filters.creatorId.toString());
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<ApiResponse<{ 
      ndas: NDA[]; 
      total: number 
    }>>(`/api/ndas?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch NDAs');
    }

    return {
      ndas: response.data?.ndas || [],
      total: response.data?.total || 0
    };
  }

  // Get NDA status for a pitch with enhanced error handling
  static async getNDAStatus(pitchId: number): Promise<{
    hasNDA: boolean;
    nda?: NDA;
    canAccess: boolean;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{ 
        hasNDA: boolean;
        nda?: NDA;
        canAccess: boolean;
      }>>(`/api/ndas/pitch/${pitchId}/status`);

      if (!response.success) {
        // Handle specific error cases
        const errorMessage = response.error?.message || 'Failed to fetch NDA status';
        
        // Don't throw for business rule violations, return them as part of response
        if (response.error?.status === 404 || errorMessage.includes('not found')) {
          return {
            hasNDA: false,
            canAccess: false,
            error: 'No NDA relationship found'
          };
        }
        
        if (response.error?.status === 403 || errorMessage.includes('forbidden')) {
          return {
            hasNDA: false,
            canAccess: false,
            error: 'Access denied'
          };
        }
        
        // For other errors, include error message but don't throw
        return {
          hasNDA: false,
          canAccess: false,
          error: errorMessage
        };
      }

      return {
        hasNDA: response.data?.hasNDA || false,
        nda: response.data?.nda,
        canAccess: response.data?.canAccess || false
      };
    } catch (error: any) {
      console.error('NDA status check failed:', error);
      
      // Return error in response instead of throwing
      return {
        hasNDA: false,
        canAccess: false,
        error: error.message || 'Network error while checking NDA status'
      };
    }
  }

  // Get NDA history for user
  static async getNDAHistory(userId?: number): Promise<NDA[]> {
    const endpoint = userId ? `/api/ndas/history/${userId}` : '/api/ndas/history';
    const response = await apiClient.get<ApiResponse<{ ndas: NDA[] }>>(endpoint);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch NDA history');
    }

    return response.data?.ndas || [];
  }

  // Download NDA document
  static async downloadNDA(ndaId: number, signed: boolean = false): Promise<Blob> {
    const endpoint = signed ? 
      `/api/ndas/${ndaId}/download-signed` : 
      `/api/ndas/${ndaId}/download`;

    const response = await fetch(
      `${API_BASE_URL}${endpoint}`, {
        headers: {
          }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download NDA document');
    }

    return response.blob();
  }

  // Generate NDA preview
  static async generatePreview(pitchId: number, templateId?: number): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ preview: string }>>(
      '/api/ndas/preview',
      { pitchId, templateId }
    );

    if (!response.success || !response.data?.preview) {
      throw new Error(response.error?.message || 'Failed to generate NDA preview');
    }

    return response.data.preview;
  }

  // Get NDA templates
  static async getTemplates(): Promise<NDATemplate[]> {
    const response = await apiClient.get<ApiResponse<{ templates: NDATemplate[] }>>(
      '/api/ndas/templates'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch NDA templates');
    }

    return response.data?.templates || [];
  }

  // Get NDA template by ID
  static async getTemplateById(templateId: number): Promise<NDATemplate> {
    const response = await apiClient.get<ApiResponse<{ template: NDATemplate }>>(
      `/api/ndas/templates/${templateId}`
    );

    if (!response.success || !response.data?.template) {
      throw new Error(response.error?.message || 'Template not found');
    }

    return response.data.template;
  }

  // Create NDA template (for admins/creators)
  static async createTemplate(template: Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<NDATemplate> {
    const response = await apiClient.post<ApiResponse<{ template: NDATemplate }>>(
      '/api/ndas/templates',
      template
    );

    if (!response.success || !response.data?.template) {
      throw new Error(response.error?.message || 'Failed to create NDA template');
    }

    return response.data.template;
  }

  // Update NDA template
  static async updateTemplate(
    templateId: number, 
    updates: Partial<Omit<NDATemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
  ): Promise<NDATemplate> {
    const response = await apiClient.put<ApiResponse<{ template: NDATemplate }>>(
      `/api/ndas/templates/${templateId}`,
      updates
    );

    if (!response.success || !response.data?.template) {
      throw new Error(response.error?.message || 'Failed to update NDA template');
    }

    return response.data.template;
  }

  // Delete NDA template
  static async deleteTemplate(templateId: number): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/ndas/templates/${templateId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete NDA template');
    }
  }

  // Get NDA statistics
  static async getNDAStats(pitchId?: number): Promise<NDAStats> {
    const endpoint = pitchId ? `/api/ndas/stats/${pitchId}` : '/api/ndas/stats';
    const response = await apiClient.get<ApiResponse<NDAStats>>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch NDA statistics');
    }

    // Handle both formats: data.stats (old) and direct data (new)
    return (response.data as any).stats || response.data;
  }

  // Check if user can request NDA for pitch with business rule validation
  static async canRequestNDA(pitchId: number): Promise<{
    canRequest: boolean;
    reason?: string;
    existingNDA?: NDA;
    error?: string;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{ 
        canRequest: boolean;
        reason?: string;
        existingNDA?: NDA;
      }>>(`/api/ndas/pitch/${pitchId}/can-request`);

      if (!response.success) {
        // Handle business rule violations gracefully
        const errorMessage = response.error?.message || 'Failed to check NDA request status';
        
        return {
          canRequest: false,
          reason: errorMessage,
          error: errorMessage
        };
      }

      return {
        canRequest: response.data?.canRequest || false,
        reason: response.data?.reason,
        existingNDA: response.data?.existingNDA
      };
    } catch (error: any) {
      console.error('NDA request check failed:', error);
      
      return {
        canRequest: false,
        reason: 'Unable to verify NDA request eligibility',
        error: error.message || 'Network error'
      };
    }
  }

  // Bulk approve NDAs (for creators)
  static async bulkApprove(ndaIds: number[]): Promise<{ 
    successful: number[]; 
    failed: { id: number; error: string }[] 
  }> {
    const response = await apiClient.post<ApiResponse<{ 
      successful: number[]; 
      failed: { id: number; error: string }[] 
    }>>('/api/ndas/bulk-approve', { ndaIds });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to bulk approve NDAs');
    }

    return {
      successful: response.data?.successful || [],
      failed: response.data?.failed || []
    };
  }

  // Bulk reject NDAs (for creators)
  static async bulkReject(ndaIds: number[], reason: string): Promise<{ 
    successful: number[]; 
    failed: { id: number; error: string }[] 
  }> {
    const response = await apiClient.post<ApiResponse<{ 
      successful: number[]; 
      failed: { id: number; error: string }[] 
    }>>('/api/ndas/bulk-reject', { ndaIds, reason });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to bulk reject NDAs');
    }

    return {
      successful: response.data?.successful || [],
      failed: response.data?.failed || []
    };
  }

  // Send NDA reminder
  static async sendReminder(ndaId: number): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(
      `/api/ndas/${ndaId}/remind`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to send NDA reminder');
    }
  }

  // Verify NDA signature
  static async verifySignature(ndaId: number): Promise<{
    valid: boolean;
    signedBy?: User;
    signedAt?: string;
  }> {
    const response = await apiClient.get<ApiResponse<{ 
      valid: boolean;
      signedBy?: User;
      signedAt?: string;
    }>>(`/api/ndas/${ndaId}/verify`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify NDA signature');
    }

    return {
      valid: response.data?.valid || false,
      signedBy: response.data?.signedBy,
      signedAt: response.data?.signedAt
    };
  }
}

// Export singleton instance
export const ndaService = NDAService;