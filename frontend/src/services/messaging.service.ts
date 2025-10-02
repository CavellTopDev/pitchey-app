// Messaging Service - Complete messaging system with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { User } from './user.service';
import { config } from '../config';

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
  private static ws: WebSocket | null = null;
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 5;
  private static reconnectDelay = 1000;

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
    }>(`/api/messages/conversations?${params}`);

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
      `/api/messages/conversations/${conversationId}`
    );

    if (!response.success || !response.data?.conversation) {
      throw new Error(response.error?.message || 'Conversation not found');
    }

    return response.data.conversation;
  }

  // Create or get conversation
  static async createConversation(recipientId: number, pitchId?: number): Promise<Conversation> {
    const response = await apiClient.post<{ success: boolean; conversation: Conversation }>(
      '/api/messages/conversations',
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
    }>(`/api/messages/conversations/${filters.conversationId}/messages?${params}`);

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
      `${config.API_URL}/api/messages/attachments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
    const response = await apiClient.post<{ success: boolean }>(
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
      `/api/messages/conversations/${conversationId}/read`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark conversation as read');
    }
  }

  // Archive conversation
  static async archiveConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/conversations/${conversationId}/archive`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to archive conversation');
    }
  }

  // Unarchive conversation
  static async unarchiveConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/conversations/${conversationId}/unarchive`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unarchive conversation');
    }
  }

  // Mute conversation
  static async muteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/conversations/${conversationId}/mute`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mute conversation');
    }
  }

  // Unmute conversation
  static async unmuteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/messages/conversations/${conversationId}/unmute`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unmute conversation');
    }
  }

  // Delete conversation
  static async deleteConversation(conversationId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/messages/conversations/${conversationId}`
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

  // WebSocket connection for real-time messaging
  static connectWebSocket(onMessage?: (message: Message) => void, onTyping?: (status: TypingStatus) => void): void {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token for WebSocket connection');
      return;
    }

    const wsUrl = `${config.WS_URL}/ws/messages?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message' && onMessage) {
          onMessage(data.message);
        } else if (data.type === 'typing' && onTyping) {
          onTyping(data.status);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect(onMessage, onTyping);
    };
  }

  // Reconnect WebSocket
  private static reconnect(onMessage?: (message: Message) => void, onTyping?: (status: TypingStatus) => void): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`Reconnecting WebSocket (attempt ${this.reconnectAttempts})...`);
      this.connectWebSocket(onMessage, onTyping);
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  // Disconnect WebSocket
  static disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Send typing status
  static sendTypingStatus(conversationId: number, isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        conversationId,
        isTyping
      }));
    }
  }

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