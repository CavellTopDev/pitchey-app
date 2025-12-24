import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, Calendar, TrendingUp, Star, Users, Eye, ChevronDown } from 'lucide-react';
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
}

interface FilterOptions {
  genres: string[];
  statuses: string[];
  budgetRanges: string[];
  themes: string[];
  visibilities: string[];
}

interface ActiveFilters {
  search: string;
  genre: string;
  status: string;
  budgetRange: string;
  themes: string[];
  visibility: string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  featured: boolean | null;
  hasInvestment: boolean | null;
  minRating: number | null;
}

type SortField = 'created_at' | 'updated_at' | 'view_count' | 'like_count' | 'investment_count' | 'title' | 'rating';
type SortDirection = 'asc' | 'desc';

export default function EnhancedBrowseView() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filter state
  const [filters, setFilters] = useState<ActiveFilters>({
    search: '',
    genre: '',
    status: '',
    budgetRange: '',
    themes: [],
    visibility: '',
    dateRange: 'all',
    featured: null,
    hasInvestment: null,
    minRating: null
  });
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    genres: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary', 'Animation'],
    statuses: ['draft', 'published', 'under_review', 'funded', 'in_production', 'completed'],
    budgetRanges: ['< $1M', '$1M - $5M', '$5M - $20M', '$20M - $50M', '> $50M'],
    themes: [],
    visibilities: ['public', 'private', 'team', 'nda', 'investors']
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load filter options from API
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load pitches when filters or sorting change
  useEffect(() => {
    loadPitches();
  }, [page, sortField, sortDirection, filters]);

  const loadFilterOptions = async () => {
    try {
      const response = await apiClient.get('/api/browse/filters');
      if (response.data.success) {
        setFilterOptions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const loadPitches = async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        sort: sortField,
        direction: sortDirection,
        ...buildFilterParams()
      });

      const response = await apiClient.get(`/api/browse/pitches?${params}`);
      
      if (response.data.success) {
        setPitches(response.data.data.items || []);
        setTotalPages(Math.ceil(response.data.data.total / 12));
        setTotalResults(response.data.data.total);
      }
    } catch (error) {
      console.error('Failed to load pitches:', error);
      // Use mock data as fallback
      setPitches(generateMockPitches());
      setTotalPages(5);
      setTotalResults(60);
    } finally {
      setLoading(false);
    }
  };

  const buildFilterParams = () => {
    const params: any = {};
    
    if (filters.search) params.search = filters.search;
    if (filters.genre) params.genre = filters.genre;
    if (filters.status) params.status = filters.status;
    if (filters.budgetRange) params.budget = filters.budgetRange;
    if (filters.themes.length > 0) params.themes = filters.themes.join(',');
    if (filters.visibility) params.visibility = filters.visibility;
    if (filters.dateRange !== 'all') params.dateRange = filters.dateRange;
    if (filters.featured !== null) params.featured = filters.featured;
    if (filters.hasInvestment !== null) params.hasInvestment = filters.hasInvestment;
    if (filters.minRating !== null) params.minRating = filters.minRating;
    
    return params;
  };

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((searchTerm: string) => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
      setPage(1);
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const handleFilterChange = (filterType: keyof ActiveFilters, value: any) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      genre: '',
      status: '',
      budgetRange: '',
      themes: [],
      visibility: '',
      dateRange: 'all',
      featured: null,
      hasInvestment: null,
      minRating: null
    });
    setPage(1);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.genre) count++;
    if (filters.status) count++;
    if (filters.budgetRange) count++;
    if (filters.themes.length > 0) count++;
    if (filters.visibility) count++;
    if (filters.dateRange !== 'all') count++;
    if (filters.featured !== null) count++;
    if (filters.hasInvestment !== null) count++;
    if (filters.minRating !== null) count++;
    return count;
  };

  // Generate mock pitches for testing
  const generateMockPitches = (): Pitch[] => {
    const mockPitches: Pitch[] = [];
    const genres = filterOptions.genres;
    const statuses = filterOptions.statuses;
    
    for (let i = 1; i <= 12; i++) {
      mockPitches.push({
        id: i + (page - 1) * 12,
        title: `${sortField === 'title' ? 'A' : ''}Amazing Pitch ${i + (page - 1) * 12}`,
        logline: `An incredible story that will captivate audiences worldwide with its unique premise and compelling characters.`,
        genre: genres[Math.floor(Math.random() * genres.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        creator_name: `Creator ${i}`,
        creator_id: i,
        view_count: Math.floor(Math.random() * 10000),
        like_count: Math.floor(Math.random() * 500),
        investment_count: Math.floor(Math.random() * 20),
        created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        themes: ['Adventure', 'Friendship', 'Redemption'].slice(0, Math.floor(Math.random() * 3) + 1),
        target_audience: 'PG-13',
        budget_range: filterOptions.budgetRanges[Math.floor(Math.random() * filterOptions.budgetRanges.length)],
        visibility: 'public',
        featured: Math.random() > 0.7,
        rating: Math.random() * 5
      });
    }
    
    // Apply sorting to mock data
    mockPitches.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return mockPitches;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Search and Controls */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search pitches by title, genre, or creator..."
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Control Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 ${
                  showFilters ? 'bg-blue-50 border-blue-500 text-blue-600' : ''
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>
              
              <div className="flex border rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                  title="Grid View"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                  title="List View"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Sorting Options */}
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm text-gray-600">Sort by:</span>
            <div className="flex gap-2">
              {[
                { field: 'created_at' as SortField, label: 'Date Created', icon: Calendar },
                { field: 'view_count' as SortField, label: 'Most Viewed', icon: Eye },
                { field: 'like_count' as SortField, label: 'Most Liked', icon: Star },
                { field: 'investment_count' as SortField, label: 'Most Invested', icon: TrendingUp },
                { field: 'title' as SortField, label: 'Title', icon: SortAsc }
              ].map(sort => (
                <button
                  key={sort.field}
                  onClick={() => handleSortChange(sort.field)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                    sortField === sort.field 
                      ? 'bg-blue-100 text-blue-600 font-medium' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <sort.icon className="w-3 h-3" />
                  {sort.label}
                  {sortField === sort.field && (
                    sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Genre Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Genre</label>
                <select
                  value={filters.genre}
                  onChange={(e) => handleFilterChange('genre', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Genres</option>
                  {filterOptions.genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map(status => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget Range Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Budget</label>
                <select
                  value={filters.budgetRange}
                  onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Budgets</option>
                  {filterOptions.budgetRanges.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>

              {/* Featured Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Featured</label>
                <select
                  value={filters.featured === null ? '' : filters.featured.toString()}
                  onChange={(e) => handleFilterChange('featured', e.target.value === '' ? null : e.target.value === 'true')}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="true">Featured Only</option>
                  <option value="false">Non-Featured</option>
                </select>
              </div>

              {/* Min Rating Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Min Rating</label>
                <select
                  value={filters.minRating || ''}
                  onChange={(e) => handleFilterChange('minRating', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-600">
                Showing {totalResults} results
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : pitches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No pitches found matching your criteria.</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters and try again
            </button>
          </div>
        ) : (
          <>
            {/* Grid/List View */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {pitches.map(pitch => (
                  <PitchCard key={pitch.id} pitch={pitch} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {pitches.map(pitch => (
                  <div key={pitch.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                    <div className="flex items-start gap-4">
                      {pitch.poster_url && (
                        <img
                          src={pitch.poster_url}
                          alt={pitch.title}
                          className="w-24 h-36 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold hover:text-blue-600 cursor-pointer">
                              {pitch.title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{pitch.logline}</p>
                          </div>
                          {pitch.featured && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              Featured
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {pitch.creator_name}
                          </span>
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {pitch.genre}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {pitch.view_count?.toLocaleString()} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            {pitch.like_count} likes
                          </span>
                          {pitch.investment_count > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <TrendingUp className="w-4 h-4" />
                              {pitch.investment_count} investments
                            </span>
                          )}
                        </div>
                        
                        {pitch.themes && pitch.themes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {pitch.themes.map(theme => (
                              <span key={theme} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 rounded-lg ${
                          page === pageNum 
                            ? 'bg-blue-500 text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="px-2 py-2">...</span>
                      <button
                        onClick={() => setPage(totalPages)}
                        className={`px-3 py-2 rounded-lg ${
                          page === totalPages 
                            ? 'bg-blue-500 text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}