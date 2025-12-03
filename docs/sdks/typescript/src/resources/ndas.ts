import { PitcheyAPIClient } from '../client';
import { NDA, RequestNDAData, PaginatedResponse } from '../types';

export class NDAsResource {
  constructor(private client: PitcheyAPIClient) {}

  async request(data: RequestNDAData): Promise<{ message: string; nda: NDA }> {
    return this.client.post('/api/ndas/request', data);
  }

  async getSigned(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<NDA>> {
    return this.client.get('/api/ndas/signed', params);
  }

  async approve(ndaId: number): Promise<{ message: string; nda: NDA }> {
    return this.client.post(`/api/ndas/${ndaId}/approve`);
  }

  async reject(ndaId: number, reason?: string): Promise<{ message: string }> {
    return this.client.post(`/api/ndas/${ndaId}/reject`, { reason });
  }
}