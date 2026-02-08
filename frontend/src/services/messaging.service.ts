// Messaging Service - Complete messaging system with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { User } from './user.service';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

// Types matching Drizzle schema
export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  recipientId?: number;
  content: string;
  attachments?: {
    url: string;
    type: 'image' | 'document' | 'video';
    name: string;
    size: number;
  }[];
  readAt?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  sender?: User;
  recipient?: User;
}

export interface Conversation {
  id: number;
  participants: number[];
  pitchId?: number;
  lastMessageId?: number;
  lastMessage?: Message;
  unreadCount?: number;
  archived?: boolean;
  muted?: boolean;
  createdAt: string;
  updatedAt: string;
  participantDetails?: User[];
  pitch?: {
    id: number;
    title: string;
  };
}

export interface MessageInput {
  recipientId?: number;
  conversationId?: number;
  pitchId?: number;
  content: string;
  attachments?: File[];
}

export interface ConversationFilters {
  archived?: boolean;
  unread?: boolean;
  pitchId?: number;
  participantId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MessageFilters {
  conversationId: number;
  before?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

export interface TypingStatus {
  conversationId: number;
  userId: number;
  isTyping: boolean;
}

export class MessagingService {
  // WebSocket functionality has been moved to WebSocketContext
  // This service now only handles REST API calls for messaging

  // Get all conversations
  static async getConversations(filters?: ConversationFilters): Promise<{ 
    conversations: Conversation[]; 
    total: number 
  }> {
    const params = new URLSearchParams();
    if (filters?.archived !== undefined) params.append('archived', filters.archived.toString());
    if (filters?.unread !== undefined) params.append('unread', filters.unread.toString());
    if (filters?.pitchId) params.append('pitchId', filters.pitchId.toString());
    if (filters?.participantId) params.append('participantId', filters.participantId.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      conversations: Conversation[]; 
      total: number 
    }>(`/api/conversations?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch conversations');
    }

    return {
      conversations: response.data?.conversations || [],
      total: response.data?.total || 0
    };
  }

  // Get single conversation
  static async getConversation(conversationId: number): Promise<Conversation> {
    const response = await apiClient.get<{ success: boolean; conversation: Conversation }>(
      `/api/conversations/${conversationId}`
    );

    if (!response.success || !response.data?.conversation) {
      throw new Error(response.error?.message || 'Conversation not found');
    }

    return response.data.conversation;
  }

  // Create or get conversation
  static async createConversation(recipientId: number, pitchId?: number): Promise<Conversation> {
    const response = await apiClient.post<{ success: boolean; conversation: Conversation }>(
      '/api/conversations',
      { recipientId, pitchId }
    );

    if (!response.success || !response.data?.conversation) {
      throw new Error(response.error?.message || 'Failed to create conversation');
    }

    return response.data.conversation;
  }

  // Get messages in conversation
  static async getMessages(filters: MessageFilters): Promise<{ 
    messages: Message[]; 
    hasMore: boolean 
  }> {
    const params = new URLSearchParams();
    if (filters.before) params.append('before', filters.before);
    if (filters.after) params.append('after', filters.after);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      messages: Message[]; 
      hasMore: boolean 
    }>(`/api/conversations/${filters.conversationId}/messages?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch messages');
    }

    return {
      messages: response.data?.messages || [],
      hasMore: response.data?.hasMore || false
    };
  }

  // Send message
  static async sendMessage(input: MessageInput): Promise<Message> {
    // Handle file attachments if present
    let attachmentUrls: string[] = [];
    if (input.attachments && input.attachments.length > 0) {
      attachmentUrls = await this.uploadAttachments(input.attachments);
    }

    const payload = {
      ...input,
      attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined
    };

    const response = await apiClient.post<{ success: boolean; message: Message }>(
      '/api/messages',
      payload
    );

    if (!response.success || !response.data?.message) {
      throw new Error(response.error?.message || 'Failed to send message');
    }

    return response.data.message;
  }

  // Upload attachments
  static async uploadAttachments(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`attachment_${index}`, file);
    });

    const response = await fetch(
      `${API_BASE_URL}/api/messages/attachments`, {
        method: 'POST',
        headers: {
          },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload attachments');
    }

    const data = await response.json();
    return data.urls || [];
  }

  // Edit message
  static async editMessage(messageId: number, content: string): Promise<Message> {
    const response = await apiClient.put<{ success: boolean; message: Message }>(
      `/api/messages/${messageId}`,
      { content }
    );

    if (!response.success || !response.data?.message) {
      throw new Error(response.error?.message || 'Failed to edit message');
    }

    return response.data.message;
  }

  // Delete message
  static async deleteMessage(messageId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/messages/${messageId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete message');
    }
  }

  // Mark message as read
  static async markAsRead(messageId: number): Promise<void> {
    const response = await apiClient.put<{ success: boolean }>(
      `/api/messages/${messageId}/read`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark message as read');
    }
  }

  // Mark all messages in conversation as read
  static async markConversationAsRead(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/conversations/${conversationId}/read`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark conversation as read');
    }
  }

  // Archive conversation
  static async archiveConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/conversations/${conversationId}/archive`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to archive conversation');
    }
  }

  // Unarchive conversation
  static async unarchiveConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/conversations/${conversationId}/unarchive`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unarchive conversation');
    }
  }

  // Mute conversation
  static async muteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/conversations/${conversationId}/mute`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mute conversation');
    }
  }

  // Unmute conversation
  static async unmuteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/conversations/${conversationId}/unmute`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unmute conversation');
    }
  }

  // Delete conversation
  static async deleteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/conversations/${conversationId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete conversation');
    }
  }

  // Get unread count
  static async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ success: boolean; count: number }>(
      '/api/messages/unread-count'
    );

    if (!response.success) {
      return 0;
    }

    return response.data?.count || 0;
  }

  // Search messages
  static async searchMessages(query: string, options?: {
    conversationId?: number;
    limit?: number;
  }): Promise<{ messages: Message[]; total: number }> {
    const params = new URLSearchParams({ q: query });
    if (options?.conversationId) params.append('conversationId', options.conversationId.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      messages: Message[]; 
      total: number 
    }>(`/api/messages/search?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to search messages');
    }

    return {
      messages: response.data?.messages || [],
      total: response.data?.total || 0
    };
  }

  // WebSocket functionality removed - now handled by WebSocketContext
  // Use the WebSocketContext methods for real-time messaging features like:
  // - startTyping() / stopTyping()
  // - sendMessage() for real-time message sending
  // - subscribeToMessages() for receiving real-time updates

  // Block user from messaging
  static async blockUserMessaging(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/block/${userId}`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to block user');
    }
  }

  // Unblock user from messaging
  static async unblockUserMessaging(userId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/unblock/${userId}`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unblock user');
    }
  }

  // Get blocked users for messaging
  static async getBlockedUsers(): Promise<User[]> {
    const response = await apiClient.get<{ success: boolean; users: User[] }>(
      '/api/messages/blocked'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch blocked users');
    }

    return response.data?.users || [];
  }
}

// Export singleton instance
export const messagingService = MessagingService;
