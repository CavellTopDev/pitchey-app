import { PitcheyAPIClient } from '../client';
import { Investment, TrackInvestmentData, PaginatedResponse } from '../types';

export class InvestmentsResource {
  constructor(private client: PitcheyAPIClient) {}

  async list(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<Investment> & { totalValue: number; totalGain: number }> {
    return this.client.get('/api/investments', params);
  }

  async track(data: TrackInvestmentData): Promise<{ message: string; investment: Investment }> {
    return this.client.post('/api/investments/track', data);
  }
}