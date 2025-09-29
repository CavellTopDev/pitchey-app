// Legacy constants - now fetched from API via configService
// These are kept as fallbacks and for type compatibility

import { configService } from '../services/config.service';
import type { Genre, Format, BudgetRange, Stage } from '../services/config.service';

// Fallback constants (used if API is unavailable)
export const FALLBACK_GENRES = [
  'Action',
  'Animation', 
  'Comedy',
  'Documentary',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller'
] as const;

export const FALLBACK_FORMATS = [
  'Feature Film',
  'Short Film', 
  'TV Series',
  'Web Series'
] as const;

export const FALLBACK_BUDGET_RANGES = [
  'Under $1M',
  '$1M-$5M',
  '$5M-$15M',
  '$15M-$30M',
  '$30M-$50M',
  '$50M-$100M',
  'Over $100M'
] as const;

export const FALLBACK_STAGES = [
  'Development',
  'Pre-Production',
  'Production',
  'Post-Production',
  'Distribution'
] as const;

// API-backed getters
export const getGenres = () => configService.getGenres();
export const getFormats = () => configService.getFormats();
export const getBudgetRanges = () => configService.getBudgetRanges();
export const getStages = () => configService.getStages();

// Synchronous getters (use cached or fallback)
export const getGenresSync = () => configService.getSyncConfig().genres || FALLBACK_GENRES;
export const getFormatsSync = () => configService.getSyncConfig().formats || FALLBACK_FORMATS;
export const getBudgetRangesSync = () => configService.getSyncConfig().budgetRanges || FALLBACK_BUDGET_RANGES;
export const getStagesSync = () => configService.getSyncConfig().stages || FALLBACK_STAGES;

// Legacy exports for backward compatibility
export const GENRES = FALLBACK_GENRES;
export const FORMATS = FALLBACK_FORMATS;

// Re-export types
export type { Genre, Format, BudgetRange, Stage };