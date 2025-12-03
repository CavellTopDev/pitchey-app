import { PitcheyAPIClient } from '../client';
import { Pitch, PaginatedResponse } from '../types';

export class WatchlistResource {
  constructor(private client: PitcheyAPIClient) {}

  async list(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.client.get('/api/watchlist', params);
  }

  async add(pitchId: number): Promise<{ message: string }> {
    return this.client.post('/api/watchlist', { pitchId });
  }

  async remove(pitchId: number): Promise<{ message: string }> {
    return this.client.delete(`/api/watchlist/${pitchId}`);
  }
}