import { PitcheyAPIClient } from '../client';
import { HealthCheckResponse } from '../types';

export class SystemResource {
  constructor(private client: PitcheyAPIClient) {}

  async health(): Promise<HealthCheckResponse> {
    return this.client.get('/health');
  }
}