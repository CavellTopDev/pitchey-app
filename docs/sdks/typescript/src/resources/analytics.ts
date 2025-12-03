import { PitcheyAPIClient } from '../client';
import { TrackEventData } from '../types';

export class AnalyticsResource {
  constructor(private client: PitcheyAPIClient) {}

  async track(data: TrackEventData): Promise<{ message: string }> {
    return this.client.post('/api/analytics/track', data);
  }
}