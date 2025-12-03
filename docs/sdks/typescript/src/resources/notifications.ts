import { PitcheyAPIClient } from '../client';
import { Notification, NotificationFilters, PaginatedResponse } from '../types';

export class NotificationsResource {
  constructor(private client: PitcheyAPIClient) {}

  async list(filters: NotificationFilters & { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Notification> & { unreadCount: number }> {
    return this.client.get('/api/notifications/list', filters);
  }

  async markAsRead(notificationId: number): Promise<{ message: string }> {
    return this.client.post(`/api/notifications/${notificationId}/read`);
  }
}