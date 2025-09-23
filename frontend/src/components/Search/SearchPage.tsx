import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, BarChart3, Bookmark, TrendingUp } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { AdvancedFilters } from './AdvancedFilters';
import { SearchResults } from './SearchResults';
import { SavedSearches } from './SavedSearches';
import { Pagination } from '../Pagination';
import { apiClient } from '../../lib/api-client';

interface SearchFilters {
  query?: string;
  genres?: string[];
  formats?: string[];
  budgetMin?: number;
  budgetMax?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  hasNDA?: boolean;
  isFollowing?: boolean;
  hasMedia?: string[];
  viewCountMin?: number;
  viewCountMax?: number;
  likeCountMin?: number;
  likeCountMax?: number;
  ndaCountMin?: number;
  ndaCountMax?: number;
  creatorType?: 'creator' | 'production' | 'any';
  verifiedOnly?: boolean;
  location?: string;
  fundingProgress?: {
    min?: number;
    max?: number;
  };
  ndaRequirement?: 'none' | 'basic' | 'enhanced' | 'any';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface SearchPageProps {
  initialQuery?: string;
  initialFilters?: SearchFilters;
  onResultClick?: (result: any) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery = '',
  initialFilters = {},
  onResultClick
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQuery,
    page: 1,
    limit: 20,
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...initialFilters
  });
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDuration, setSearchDuration] = useState<number | null>(null);
  const [searchHistoryId, setSearchHistoryId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [aggregations, setAggregations] = useState<any>({});
  const [availableOptions, setAvailableOptions] = useState<any>({});
  const [popularSearches, setPopularSearches] = useState<any[]>([]);
  
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'analytics' | 'saved'>('results');

  // Perform search
  const performSearch = useCallback(async (searchFilters: SearchFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.post('/api/search/advanced', searchFilters);
      
      if (response.success) {
        setResults(response.results);
        setPagination(response.pagination);
        setAggregations(response.aggregations);
        setAvailableOptions(response.filters?.available || {});
        setSearchDuration(response.searchDuration);
        setSearchHistoryId(response.searchHistoryId);
      } else {
        setError(response.error || 'Search failed');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load popular searches
  const loadPopularSearches = async () => {
    try {
      const response = await apiClient.get('/api/search/popular?limit=10');
      if (response.success) {
        setPopularSearches(response.popularSearches);
      }
    } catch (error) {
      console.error('Failed to load popular searches:', error);
    }
  };

  // Initial search and popular searches load
  useEffect(() => {
    if (filters.query || Object.keys(filters).some(key => 
      key !== 'query' && key !== 'page' && key !== 'limit' && key !== 'sortBy' && key !== 'sortOrder' &&
      filters[key as keyof SearchFilters] !== undefined
    )) {
      performSearch(filters);
    }
    loadPopularSearches();
  }, []);

  // Handle search query change
  const handleSearch = (query: string) => {
    const newFilters = { ...filters, query, page: 1 };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: SearchFilters) => {
    const updatedFilters = { ...newFilters, page: 1 };
    setFilters(updatedFilters);
    performSearch(updatedFilters);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  // Handle sort change
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc' = 'desc') => {
    const newFilters = { ...filters, sortBy, sortOrder, page: 1 };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  // Handle saved search load
  const handleLoadSavedSearch = (savedFilters: SearchFilters) => {
    const newFilters = { ...savedFilters, page: 1 };
    setFilters(newFilters);
    performSearch(newFilters);
    setShowSavedSearches(false);
  };

  // Reset filters
  const handleResetFilters = () => {
    const newFilters = {
      query: filters.query,
      page: 1,
      limit: 20,
      sortBy: 'relevance',
      sortOrder: 'desc' as const,
    };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  // Handle popular search click
  const handlePopularSearchClick = (query: string) => {
    handleSearch(query);
  };

  const hasResults = results.length > 0;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'query' || key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortOrder') return false;
    return value !== undefined && value !== null && 
           (Array.isArray(value) ? value.length > 0 : true);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Search Pitches</h1>
        
        {/* Search Bar */}
        <div className="max-w-2xl">
          <SearchBar
            value={filters.query || ''}
            onChange={(value) => setFilters(prev => ({ ...prev, query: value }))}
            onSearch={handleSearch}
            placeholder="Search for pitches, creators, genres..."
            size="lg"
          />
        </div>

        {/* Popular Searches */}
        {popularSearches.length > 0 && !filters.query && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Popular searches:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularSearches.slice(0, 6).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handlePopularSearchClick(search.query)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {search.query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('results')}
              className={`
                px-3 py-1 text-sm rounded-md transition-colors
                ${activeTab === 'results' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Search className="h-4 w-4 inline mr-1" />
              Results ({pagination.total})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`
                px-3 py-1 text-sm rounded-md transition-colors
                ${activeTab === 'analytics' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <BarChart3 className="h-4 w-4 inline mr-1" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`
                px-3 py-1 text-sm rounded-md transition-colors
                ${activeTab === 'saved' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              <Bookmark className="h-4 w-4 inline mr-1" />
              Saved
            </button>
          </div>

          {/* Search Stats */}
          {searchDuration && hasResults && (
            <div className="text-sm text-gray-500">
              Found {pagination.total.toLocaleString()} results in {searchDuration}ms
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          {hasResults && (
            <select
              value={`${filters.sortBy}_${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('_');
                handleSortChange(sortBy, sortOrder as 'asc' | 'desc');
              }}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="relevance_desc">Most Relevant</option>
              <option value="newest_desc">Newest First</option>
              <option value="oldest_asc">Oldest First</option>
              <option value="views_desc">Most Viewed</option>
              <option value="likes_desc">Most Liked</option>
              <option value="ndas_desc">Most NDAs</option>
              <option value="budget_high_desc">Highest Budget</option>
              <option value="budget_low_asc">Lowest Budget</option>
              <option value="alpha_asc">Alphabetical</option>
            </select>
          )}

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-3 py-1 text-sm border rounded-md transition-colors
              ${showFilters 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded-full">
                {Object.entries(filters).filter(([key, value]) => {
                  if (key === 'query' || key === 'page' || key === 'limit' || key === 'sortBy' || key === 'sortOrder') return false;
                  return value !== undefined && value !== null && 
                         (Array.isArray(value) ? value.length > 0 : true);
                }).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Advanced Filters */}
          {showFilters && (
            <AdvancedFilters
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleResetFilters}
              availableOptions={availableOptions}
            />
          )}

          {/* Aggregations */}
          {hasResults && Object.keys(aggregations).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Results Breakdown</h3>
              
              {aggregations.genreCounts && Object.keys(aggregations.genreCounts).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Genre</h4>
                  <div className="space-y-1">
                    {Object.entries(aggregations.genreCounts).map(([genre, count]) => (
                      <div key={genre} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{genre}</span>
                        <span className="text-gray-900">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aggregations.formatCounts && Object.keys(aggregations.formatCounts).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Format</h4>
                  <div className="space-y-1">
                    {Object.entries(aggregations.formatCounts).map(([format, count]) => (
                      <div key={format} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{format}</span>
                        <span className="text-gray-900">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aggregations.budgetRanges && Object.keys(aggregations.budgetRanges).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Budget</h4>
                  <div className="space-y-1">
                    {Object.entries(aggregations.budgetRanges).map(([range, count]) => (
                      <div key={range} className="flex justify-between text-sm">
                        <span className="text-gray-600">{range}</span>
                        <span className="text-gray-900">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'results' && (
            <>
              <SearchResults
                results={results}
                loading={loading}
                error={error}
                query={filters.query}
                searchHistoryId={searchHistoryId}
                onResultClick={onResultClick}
              />
              
              {hasResults && (
                <div className="mt-8">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                    showPageNumbers={true}
                    className="justify-center"
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Search Analytics</h3>
              <div className="text-gray-500 text-center py-8">
                Search analytics dashboard coming soon...
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <SavedSearches
              onLoadSearch={handleLoadSavedSearch}
              currentFilters={filters}
            />
          )}
        </div>
      </div>
    </div>
  );
};