import { PitcheyAPIClient } from '../client';
import { SearchResults, AdvancedSearchParams } from '../types';

export class SearchResource {
  constructor(private client: PitcheyAPIClient) {}

  async search(query: string, params?: any): Promise<SearchResults> {
    return this.client.get('/api/pitches/search', { q: query, ...params });
  }

  async advanced(params: AdvancedSearchParams): Promise<SearchResults> {
    return this.client.get('/api/search/advanced', params);
  }
}