import { PitcheyAPIClient } from '../client';
import { Message, Conversation, SendMessageData, PaginatedResponse } from '../types';

export class MessagesResource {
  constructor(private client: PitcheyAPIClient) {}

  async getConversations(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Conversation>> {
    return this.client.get('/api/messages/conversations', params);
  }

  async send(data: SendMessageData): Promise<{ message: string; messageData: Message }> {
    return this.client.post('/api/messages/send', data);
  }

  async markAsRead(messageId: number): Promise<{ message: string }> {
    return this.client.post(`/api/messages/${messageId}/read`);
  }
}