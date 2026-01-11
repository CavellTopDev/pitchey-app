/**
 * Crawl4AI Integration Hook
 * Provides easy access to web scraping and enrichment features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import { toast } from 'react-hot-toast';

// Types
interface NewsItem {
  id: string | number;
  title: string;
  excerpt: string;
  source: string;
  link: string;
  date: string;
  relevance: number;
  image?: string;
}

interface NewsData {
  timestamp: string;
  items: NewsItem[];
  insights?: {
    hot_genres: Array<[string, number]>;
    trending_formats: Array<[string, number]>;
    active_buyers: Array<[string, number]>;
  };
}

interface ValidationResult {
  validation_score: number;
  uniqueness_score: number;
  market_viability: number;
  similar_projects: Array<{
    title: string;
    year: number;
    similarity: number;
    imdb_id: string;
  }>;
  comparables: Array<{
    title: string;
    box_office: string;
    budget: string;
    roi: number;
  }>;
  market_analysis: {
    genre_trend: string;
    competition_level: string;
    target_audience_size: string;
  };
  recommendations: string[];
  success_prediction: {
    score: number;
    factors: string[];
  };
}

interface EnrichmentResult {
  pitch_id: string;
  enriched_at: string;
  market_data: {
    genre_performance: any;
    comparable_films: any[];
    target_buyers: string[];
    trending_themes: string[];
  };
  financial_analysis: {
    estimated_budget_range: string;
    potential_revenue: string;
    roi_projection: number;
  };
  recommendations: {
    positioning: string[];
    target_platforms: string[];
    marketing_angles: string[];
  };
}

interface TrendsData {
  genre: string;
  date: string;
  top_performers: Array<{ title: string; gross: string }>;
  average_gross: string;
  trend: 'growing' | 'stable' | 'declining';
}

interface BoxOfficeData {
  timeframe: string;
  date: string;
  top_10: Array<{
    rank: number;
    title: string;
    gross: string;
    theaters: number;
  }>;
  total_gross: string;
}

// Custom hooks

/**
 * Hook to fetch industry news
 */
export function useIndustryNews(autoRefresh = true) {
  return useQuery<NewsData>({
    queryKey: ['industry-news'],
    queryFn: async () => {
      const response = await apiClient.get('/api/crawl/news/industry');
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch news');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to validate a pitch
 */
export function usePitchValidation() {
  const queryClient = useQueryClient();

  return useMutation<ValidationResult, Error, {
    title: string;
    genre: string;
    logline?: string;
    format?: string;
  }>({
    mutationFn: async (pitch) => {
      const response = await apiClient.post('/api/crawl/validate/pitch', pitch);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Validation failed');
    },
    onSuccess: (data, variables) => {
      // Cache the validation result
      queryClient.setQueryData(
        ['pitch-validation', variables.title],
        data
      );
      
      if (data.validation_score >= 8) {
        toast.success('Great pitch! High uniqueness and market viability.');
      } else if (data.validation_score >= 6) {
        toast.success('Good pitch with some similar projects in market.');
      } else {
        toast.warning('Consider reviewing recommendations for improvement.');
      }
    },
    onError: (error) => {
      toast.error('Failed to validate pitch. Please try again.');
      console.error('Validation error:', error);
    },
  });
}

/**
 * Hook to get cached validation result
 */
export function useCachedValidation(title: string) {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<ValidationResult>(['pitch-validation', title]);
}

/**
 * Hook to enrich a pitch with market data
 */
export function usePitchEnrichment() {
  const queryClient = useQueryClient();

  return useMutation<EnrichmentResult, Error, {
    pitchId: string;
    title: string;
    genre?: string;
    budget?: string;
    targetAudience?: string;
  }>({
    mutationFn: async (pitch) => {
      const response = await apiClient.post('/api/crawl/enrich/pitch', {
        pitch_id: pitch.pitchId,
        title: pitch.title,
        genre: pitch.genre,
        budget: pitch.budget,
        target_audience: pitch.targetAudience,
      });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Enrichment failed');
    },
    onSuccess: (data, variables) => {
      // Cache the enrichment result
      queryClient.setQueryData(
        ['pitch-enrichment', variables.pitchId],
        data
      );
      toast.success('Pitch enriched with market data!');
    },
    onError: (error) => {
      toast.error('Failed to enrich pitch. Please try again.');
      console.error('Enrichment error:', error);
    },
  });
}

/**
 * Hook to get market trends for a genre
 */
export function useGenreTrends(genre: string) {
  return useQuery<TrendsData>({
    queryKey: ['genre-trends', genre],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crawl/trends/${genre}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch trends');
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    enabled: !!genre,
  });
}

/**
 * Hook to get box office data
 */
export function useBoxOffice(timeframe: 'weekend' | 'daily' | 'yearly' = 'weekend') {
  return useQuery<BoxOfficeData>({
    queryKey: ['box-office', timeframe],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crawl/boxoffice/${timeframe}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch box office data');
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
}

/**
 * Hook to analyze competitors
 */
export function useCompetitorAnalysis() {
  return useMutation<any, Error, {
    title: string;
    genre?: string;
    keywords?: string[];
  }>({
    mutationFn: async (params) => {
      const response = await apiClient.post('/api/crawl/analyze/competitors', params);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Analysis failed');
    },
    onError: (error) => {
      toast.error('Failed to analyze competitors.');
      console.error('Analysis error:', error);
    },
  });
}

/**
 * Hook to get production company info
 */
export function useProductionCompany(name: string) {
  return useQuery({
    queryKey: ['company-info', name],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crawl/company/${encodeURIComponent(name)}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch company info');
    },
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    enabled: !!name,
  });
}

/**
 * Hook to clear cache
 */
export function useClearCache() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, {
    type: 'news' | 'validation' | 'enrichment' | 'trends' | 'all';
    key?: string;
  }>({
    mutationFn: async ({ type, key }) => {
      const url = key 
        ? `/api/crawl/cache/${type}/${key}`
        : `/api/crawl/cache/${type}`;
      
      const response = await apiClient.delete(url);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Clear React Query cache as well
      if (variables.type === 'all') {
        queryClient.clear();
      } else {
        const queryKeys: Record<string, string[]> = {
          news: ['industry-news'],
          validation: ['pitch-validation'],
          enrichment: ['pitch-enrichment'],
          trends: ['genre-trends'],
        };
        
        const keys = queryKeys[variables.type];
        if (keys) {
          keys.forEach(key => {
            queryClient.removeQueries({ queryKey: [key] });
          });
        }
      }
      
      toast.success('Cache cleared successfully');
    },
    onError: (error) => {
      toast.error('Failed to clear cache');
      console.error('Cache clear error:', error);
    },
  });
}

/**
 * Hook to check Crawl4AI health status
 */
export function useCrawl4AIHealth() {
  return useQuery({
    queryKey: ['crawl4ai-health'],
    queryFn: async () => {
      const response = await apiClient.get('/api/crawl/health');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  });
}

// Export all hooks
export default {
  useIndustryNews,
  usePitchValidation,
  useCachedValidation,
  usePitchEnrichment,
  useGenreTrends,
  useBoxOffice,
  useCompetitorAnalysis,
  useProductionCompany,
  useClearCache,
  useCrawl4AIHealth,
};