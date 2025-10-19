// Info Request Service - Post-NDA communication with correct types
import { apiClient } from '../lib/api-client';
import type { 
  InfoRequest, 
  InfoRequestsResponse, 
  CreateInfoRequestInput, 
  RespondToInfoRequestInput,
  InfoRequestAttachment,
  ApiResponse 
} from '../types/api';

export class InfoRequestService {
  // Get all info requests (backend returns combined incoming/outgoing)
  static async getInfoRequests(filters?: {
    status?: 'pending' | 'responded' | 'closed';
    requestType?: string;
    pitchId?: number;
    limit?: number;
    offset?: number;
  }): Promise<InfoRequestsResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.requestType) params.append('requestType', filters.requestType);
    if (filters?.pitchId) params.append('pitchId', filters.pitchId.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<ApiResponse<InfoRequestsResponse>>(
      `/api/info-requests?${params}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch info requests');
    }

    // Backend returns { incoming: [], outgoing: [], total: number, ... }
    return response.data || {
      incoming: [],
      outgoing: [],
      total: 0,
      incomingCount: 0,
      outgoingCount: 0
    };
  }

  // Get incoming info requests (for creators)
  static async getIncomingRequests(filters?: {
    status?: string;
    requestType?: string;
    pitchId?: number;
  }): Promise<InfoRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.requestType) params.append('requestType', filters.requestType);
    if (filters?.pitchId) params.append('pitchId', filters.pitchId.toString());

    const response = await apiClient.get<ApiResponse<{ requests: InfoRequest[] }>>(
      `/api/info-requests/incoming?${params}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch incoming requests');
    }

    return response.data?.requests || [];
  }

  // Get outgoing info requests (for investors/production)
  static async getOutgoingRequests(filters?: {
    status?: string;
    requestType?: string;
    pitchId?: number;
  }): Promise<InfoRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.requestType) params.append('requestType', filters.requestType);
    if (filters?.pitchId) params.append('pitchId', filters.pitchId.toString());

    const response = await apiClient.get<ApiResponse<{ requests: InfoRequest[] }>>(
      `/api/info-requests/outgoing?${params}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch outgoing requests');
    }

    return response.data?.requests || [];
  }

  // Create a new info request
  static async createRequest(data: CreateInfoRequestInput): Promise<InfoRequest> {
    const response = await apiClient.post<ApiResponse<InfoRequest>>(
      '/api/info-requests',
      data
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create info request');
    }

    return response.data;
  }

  // Get a specific info request by ID
  static async getRequestById(requestId: number): Promise<InfoRequest> {
    const response = await apiClient.get<ApiResponse<{ request: InfoRequest }>>(
      `/api/info-requests/${requestId}`
    );

    if (!response.success || !response.data?.request) {
      throw new Error(response.error?.message || 'Info request not found');
    }

    return response.data.request;
  }

  // Respond to an info request (for creators)
  static async respondToRequest(data: RespondToInfoRequestInput): Promise<InfoRequest> {
    const response = await apiClient.post<ApiResponse<{ request: InfoRequest }>>(
      `/api/info-requests/${data.infoRequestId}/respond`,
      { response: data.response }
    );

    if (!response.success || !response.data?.request) {
      throw new Error(response.error?.message || 'Failed to respond to info request');
    }

    return response.data.request;
  }

  // Update info request status
  static async updateStatus(requestId: number, status: 'pending' | 'responded' | 'closed'): Promise<InfoRequest> {
    const response = await apiClient.put<ApiResponse<{ request: InfoRequest }>>(
      `/api/info-requests/${requestId}/status`,
      { status }
    );

    if (!response.success || !response.data?.request) {
      throw new Error(response.error?.message || 'Failed to update info request status');
    }

    return response.data.request;
  }

  // Upload attachment to info request
  static async uploadAttachment(
    requestId: number, 
    file: File, 
    description?: string
  ): Promise<InfoRequestAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const response = await apiClient.uploadFile<ApiResponse<{ attachment: InfoRequestAttachment }>>(
      `/api/info-requests/${requestId}/attachments`,
      formData
    );

    if (!response.success || !response.data?.attachment) {
      throw new Error(response.error?.message || 'Failed to upload attachment');
    }

    return response.data.attachment;
  }

  // Get attachments for an info request
  static async getAttachments(requestId: number): Promise<InfoRequestAttachment[]> {
    const response = await apiClient.get<ApiResponse<{ attachments: InfoRequestAttachment[] }>>(
      `/api/info-requests/${requestId}/attachments`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch attachments');
    }

    return response.data?.attachments || [];
  }

  // Delete an attachment
  static async deleteAttachment(requestId: number, attachmentId: number): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/info-requests/${requestId}/attachments/${attachmentId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete attachment');
    }
  }

  // Mark info request as read
  static async markAsRead(requestId: number): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(
      `/api/info-requests/${requestId}/read`,
      {}
    );

    if (!response.success) {
      // Don't throw error for read status, just log
      console.warn('Failed to mark info request as read:', response.error?.message);
    }
  }

  // Get info request statistics
  static async getStatistics(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    respondedRequests: number;
    closedRequests: number;
    requestsByType: Record<string, number>;
    avgResponseTime?: number;
  }> {
    const response = await apiClient.get<ApiResponse<any>>(
      '/api/info-requests/statistics'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch statistics');
    }

    return response.data || {
      totalRequests: 0,
      pendingRequests: 0,
      respondedRequests: 0,
      closedRequests: 0,
      requestsByType: {},
    };
  }
}

// Export singleton instance
export const infoRequestService = InfoRequestService;