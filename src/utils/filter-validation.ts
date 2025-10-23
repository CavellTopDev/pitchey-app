// Filter validation and migration utilities
// Ensures saved filters remain compatible with interface changes

export interface FilterState {
  genres: string[];
  formats: string[];
  developmentStages: string[];
  searchQuery: string;
  creatorTypes: string[];
  hasNDA?: boolean;
  seekingInvestment?: boolean;
  budgetMin?: number;
  budgetMax?: number;
}

/**
 * Validates and migrates saved filter data to match current FilterState interface
 * This ensures backward compatibility when filter structure changes
 */
export function validateAndMigrateFilters(storedFilters: any): FilterState {
  // Ensure we have a valid object
  if (!storedFilters || typeof storedFilters !== 'object') {
    return getDefaultFilterState();
  }

  // Migrate and validate each field
  return {
    genres: Array.isArray(storedFilters.genres) ? storedFilters.genres : [],
    formats: Array.isArray(storedFilters.formats) ? storedFilters.formats : [],
    developmentStages: Array.isArray(storedFilters.developmentStages) 
      ? storedFilters.developmentStages 
      : [],
    searchQuery: typeof storedFilters.searchQuery === 'string' 
      ? storedFilters.searchQuery 
      : '',
    creatorTypes: Array.isArray(storedFilters.creatorTypes) 
      ? storedFilters.creatorTypes 
      : [],
    hasNDA: typeof storedFilters.hasNDA === 'boolean' 
      ? storedFilters.hasNDA 
      : undefined,
    seekingInvestment: typeof storedFilters.seekingInvestment === 'boolean' 
      ? storedFilters.seekingInvestment 
      : undefined,
    budgetMin: typeof storedFilters.budgetMin === 'number' && storedFilters.budgetMin >= 0
      ? storedFilters.budgetMin 
      : undefined,
    budgetMax: typeof storedFilters.budgetMax === 'number' && storedFilters.budgetMax > 0
      ? storedFilters.budgetMax 
      : undefined
  };
}

/**
 * Returns a default filter state
 */
export function getDefaultFilterState(): FilterState {
  return {
    genres: [],
    formats: [],
    developmentStages: [],
    searchQuery: '',
    creatorTypes: [],
    hasNDA: undefined,
    seekingInvestment: undefined,
    budgetMin: undefined,
    budgetMax: undefined
  };
}

/**
 * Validates if a filter state has any active filters
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.genres.length > 0 ||
    filters.formats.length > 0 ||
    filters.developmentStages.length > 0 ||
    filters.creatorTypes.length > 0 ||
    (filters.budgetMin !== undefined && filters.budgetMin > 0) ||
    (filters.budgetMax !== undefined && filters.budgetMax < 999999999) ||
    filters.searchQuery !== '' ||
    filters.hasNDA !== undefined ||
    filters.seekingInvestment !== undefined
  );
}

/**
 * Sanitizes filter values to prevent XSS and SQL injection
 */
export function sanitizeFilterValues(filters: FilterState): FilterState {
  const sanitizeString = (str: string): string => {
    return str.replace(/[<>'"]/g, '').trim();
  };

  const sanitizeArray = (arr: string[]): string[] => {
    return arr.map(sanitizeString).filter(s => s.length > 0);
  };

  return {
    genres: sanitizeArray(filters.genres),
    formats: sanitizeArray(filters.formats),
    developmentStages: sanitizeArray(filters.developmentStages),
    searchQuery: sanitizeString(filters.searchQuery),
    creatorTypes: sanitizeArray(filters.creatorTypes),
    hasNDA: filters.hasNDA,
    seekingInvestment: filters.seekingInvestment,
    budgetMin: filters.budgetMin,
    budgetMax: filters.budgetMax
  };
}

/**
 * Converts filter state to URL search params
 */
export function filtersToUrlParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  filters.genres.forEach(g => params.append('genre', g));
  filters.formats.forEach(f => params.append('format', f));
  filters.developmentStages.forEach(s => params.append('stage', s));
  filters.creatorTypes.forEach(c => params.append('creatorType', c));
  
  if (filters.searchQuery) params.set('q', filters.searchQuery);
  if (filters.hasNDA !== undefined) params.set('hasNDA', String(filters.hasNDA));
  if (filters.seekingInvestment !== undefined) params.set('seekingInvestment', String(filters.seekingInvestment));
  if (filters.budgetMin !== undefined) params.set('budgetMin', String(filters.budgetMin));
  if (filters.budgetMax !== undefined) params.set('budgetMax', String(filters.budgetMax));

  return params;
}

/**
 * Creates filter state from URL search params
 */
export function urlParamsToFilters(params: URLSearchParams): FilterState {
  return {
    genres: params.getAll('genre'),
    formats: params.getAll('format'),
    developmentStages: params.getAll('stage'),
    creatorTypes: params.getAll('creatorType'),
    searchQuery: params.get('q') || '',
    hasNDA: params.has('hasNDA') ? params.get('hasNDA') === 'true' : undefined,
    seekingInvestment: params.has('seekingInvestment') ? params.get('seekingInvestment') === 'true' : undefined,
    budgetMin: params.has('budgetMin') ? Number(params.get('budgetMin')) : undefined,
    budgetMax: params.has('budgetMax') ? Number(params.get('budgetMax')) : undefined
  };
}