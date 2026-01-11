import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, Calendar, TrendingUp, Star, Users, Eye, ChevronDown, Clock, Flame } from 'lucide-react';
import apiClient from '../../services/api';
import { toast } from 'react-hot-toast';
import PitchCard from '../PitchCard';
import { debounce } from 'lodash';

interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  status: string;
  creator_name: string;
  creator_id: number;
  view_count: number;
  like_count: number;
  investment_count: number;
  created_at: string;
  updated_at: string;
  poster_url?: string;
  themes?: string[];
  target_audience?: string;
  budget_range?: string;
  visibility?: string;
  featured?: boolean;
  rating?: number;
  trending_score?: number;
}

interface TabState {
  pitches: Pitch[];
  page: number;
  totalPages: number;
  totalResults: number;
  loading: boolean;
  filters: any;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

type TabType = 'trending' | 'new' | 'featured' | 'topRated';

export default function BrowseTabsFixed() {
  // Active tab management
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  
  // Separate state for each tab to prevent mixing
  const [tabStates, setTabStates] = useState<Record<TabType, TabState>>({
    trending: {
      pitches: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
      loading: false,
      filters: { dateRange: 'week' },
      sortField: 'trending_score',
      sortDirection: 'desc'
    },
    new: {
      pitches: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
      loading: false,
      filters: { dateRange: 'today' },
      sortField: 'created_at',
      sortDirection: 'desc'
    },
    featured: {
      pitches: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
      loading: false,
      filters: { featured: true },
      sortField: 'updated_at',
      sortDirection: 'desc'
    },
    topRated: {
      pitches: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
      loading: false,
      filters: { minRating: 4.0 },
      sortField: 'rating',
      sortDirection: 'desc'
    }
  });

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [globalSearch, setGlobalSearch] = useState('');

  // Get current tab state
  const currentTabState = tabStates[activeTab];

  // Load data for active tab
  const loadTabData = useCallback(async (tab: TabType, forceRefresh = false) => {
    const state = tabStates[tab];
    
    // Skip if already loaded and not forcing refresh
    if (state.pitches.length > 0 && !forceRefresh && !state.loading) {
      return;
    }

    // Update loading state
    setTabStates(prev => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true }
    }));

    try {
      // Build query params based on tab type
      const params = new URLSearchParams({
        page: state.page.toString(),
        limit: '12',
        sort: state.sortField,
        direction: state.sortDirection
      });

      // Apply tab-specific filters
      if (tab === 'trending') {
        params.append('trending', 'true');
        params.append('dateRange', 'week');
      } else if (tab === 'new') {
        params.append('dateRange', 'today');
        params.append('sort', 'created_at');
      } else if (tab === 'featured') {
        params.append('featured', 'true');
      } else if (tab === 'topRated') {
        params.append('minRating', '4.0');
        params.append('sort', 'rating');
      }

      // Apply global search if exists
      if (globalSearch) {
        params.append('search', globalSearch);
      }

      // Apply any additional filters from state
      Object.entries(state.filters).forEach(([key, value]) => {
        if (value && !params.has(key)) {
          params.append(key, String(value));
        }
      });

      const response = await apiClient.get(`/api/browse/pitches?${params}`);
      
      if (response.data.success) {
        setTabStates(prev => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            pitches: response.data.data.items || [],
            totalPages: Math.ceil(response.data.data.total / 12),
            totalResults: response.data.data.total,
            loading: false
          }
        }));
      }
    } catch (error) {
      console.error(`Failed to load ${tab} pitches:`, error);
      toast.error(`Failed to load ${tab} content`);
      
      // Set loading to false on error
      setTabStates(prev => ({
        ...prev,
        [tab]: { ...prev[tab], loading: false }
      }));
    }
  }, [tabStates, globalSearch]);

  // Load data when tab changes
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Initial load of trending tab
  useEffect(() => {
    loadTabData('trending');
  }, []);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  // Handle page change for current tab
  const handlePageChange = (newPage: number) => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], page: newPage }
    }));
    
    // Trigger reload with new page
    setTimeout(() => loadTabData(activeTab, true), 0);
  };

  // Handle search with debounce
  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => {
      setGlobalSearch(searchTerm);
      // Refresh all tabs with new search
      Object.keys(tabStates).forEach(tab => {
        loadTabData(tab as TabType, true);
      });
    }, 500),
    [loadTabData, tabStates]
  );

  // Handle filter changes for current tab
  const handleFilterChange = (filterKey: string, value: any) => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        filters: {
          ...prev[activeTab].filters,
          [filterKey]: value
        },
        page: 1 // Reset to first page on filter change
      }
    }));
    
    // Trigger reload with new filters
    setTimeout(() => loadTabData(activeTab, true), 0);
  };

  // Handle sort change for current tab
  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        sortField: field,
        sortDirection: direction
      }
    }));
    
    // Trigger reload with new sort
    setTimeout(() => loadTabData(activeTab, true), 0);
  };

  // Refresh current tab
  const refreshCurrentTab = () => {
    loadTabData(activeTab, true);
  };

  return (
    <div className="browse-container max-w-7xl mx-auto px-4 py-6">
      {/* Header with Search */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Browse Pitches</h1>
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search pitches..."
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 border-b">
          <button
            onClick={() => handleTabChange('trending')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'trending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
            {currentTabState.loading && activeTab === 'trending' && (
              <div className="ml-2 h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('new')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'new'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="h-4 w-4" />
            New Releases
            {currentTabState.loading && activeTab === 'new' && (
              <div className="ml-2 h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('featured')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'featured'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Flame className="h-4 w-4" />
            Featured
            {currentTabState.loading && activeTab === 'featured' && (
              <div className="ml-2 h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('topRated')}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'topRated'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Star className="h-4 w-4" />
            Top Rated
            {currentTabState.loading && activeTab === 'topRated' && (
              <div className="ml-2 h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {currentTabState.pitches.length} of {currentTabState.totalResults} results
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          
          <button
            onClick={refreshCurrentTab}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
          
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="grid">Grid View</option>
            <option value="list">List View</option>
          </select>
        </div>
      </div>

      {/* Filters Panel (Collapsible) */}
      {showFilters && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <div className="grid grid-cols-4 gap-4">
            <select
              onChange={(e) => handleFilterChange('genre', e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Genres</option>
              <option value="action">Action</option>
              <option value="comedy">Comedy</option>
              <option value="drama">Drama</option>
              <option value="horror">Horror</option>
              <option value="sci-fi">Sci-Fi</option>
            </select>
            
            <select
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="funded">Funded</option>
              <option value="in_production">In Production</option>
            </select>
            
            <select
              onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">Any Budget</option>
              <option value="0-1M">Under $1M</option>
              <option value="1-5M">$1M - $5M</option>
              <option value="5-20M">$5M - $20M</option>
              <option value="20M+">Over $20M</option>
            </select>
            
            <select
              onChange={(e) => handleSortChange(e.target.value.split('-')[0], e.target.value.split('-')[1] as 'asc' | 'desc')}
              value={`${currentTabState.sortField}-${currentTabState.sortDirection}`}
              className="px-3 py-2 border rounded"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="view_count-desc">Most Viewed</option>
              <option value="like_count-desc">Most Liked</option>
              <option value="rating-desc">Highest Rated</option>
            </select>
          </div>
        </div>
      )}

      {/* Content Grid */}
      {currentTabState.loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : currentTabState.pitches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No pitches found in {activeTab} category</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'space-y-4'}>
          {currentTabState.pitches.map((pitch) => (
            <PitchCard key={`${activeTab}-${pitch.id}`} pitch={pitch} viewMode={viewMode} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {currentTabState.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => handlePageChange(currentTabState.page - 1)}
            disabled={currentTabState.page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          
          {[...Array(Math.min(5, currentTabState.totalPages))].map((_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-4 py-2 border rounded ${
                  currentTabState.page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentTabState.page + 1)}
            disabled={currentTabState.page === currentTabState.totalPages}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}