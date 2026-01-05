import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Filter, SlidersHorizontal, Grid, List,
  Star, Clock, DollarSign, Calendar, Users,
  MapPin, Film, Award, Eye, Heart, ChevronDown,
  X, RefreshCw, Download, ArrowUpDown, User
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'react-hot-toast';

interface SearchFilters {
  query: string;
  type: 'all' | 'pitches' | 'creators' | 'production';
  genres: string[];
  budgetRange: {
    min: number;
    max: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  format: string[];
  status: string[];
  location: string;
  rating: number;
  sortBy: 'relevance' | 'date' | 'rating' | 'budget' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

interface SearchResult {
  id: string;
  type: 'pitch' | 'creator' | 'production';
  title: string;
  description: string;
  image?: string;
  rating?: number;
  genre?: string[];
  budget?: number;
  format?: string;
  status?: string;
  location?: string;
  createdAt: string;
  author?: string;
  views?: number;
  likes?: number;
}

export default function AdvancedSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    type: 'all',
    genres: [],
    budgetRange: { min: 0, max: 50000000 },
    dateRange: { start: '', end: '' },
    format: [],
    status: [],
    location: '',
    rating: 0,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 12;

  // Available filter options
  const genreOptions = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Documentary', 'Animation'
  ];

  const formatOptions = [
    'Feature Film', 'Short Film', 'TV Series', 'Limited Series', 
    'Documentary', 'Web Series', 'Commercial', 'Music Video'
  ];

  const statusOptions = [
    'Development', 'Pre-Production', 'Production', 'Post-Production',
    'Completed', 'Released', 'In Review', 'Greenlit'
  ];

  // Mock search results
  const mockResults: SearchResult[] = [
    {
      id: '1',
      type: 'pitch',
      title: 'The Last Symphony',
      description: 'A haunting tale of a composer who discovers that his music can manipulate time itself. Set in 1920s Vienna, this psychological thriller explores the dangerous intersection of art and power.',
      image: '/api/placeholder/300/200',
      rating: 4.7,
      genre: ['Drama', 'Thriller'],
      budget: 2500000,
      format: 'Feature Film',
      status: 'Development',
      location: 'New York, NY',
      createdAt: '2024-01-15T10:30:00Z',
      author: 'Sarah Chen',
      views: 1247,
      likes: 89
    },
    {
      id: '2',
      type: 'creator',
      title: 'Alex Rodriguez',
      description: 'Award-winning director with 15 years of experience in independent filmmaking. Specializes in character-driven narratives and innovative visual storytelling.',
      image: '/api/placeholder/150/150',
      rating: 4.9,
      genre: ['Drama', 'Comedy'],
      location: 'Los Angeles, CA',
      createdAt: '2023-08-20T14:22:00Z',
      views: 3421,
      likes: 234
    },
    {
      id: '3',
      type: 'pitch',
      title: 'Neon Dreams',
      description: 'A cyberpunk thriller set in 2087 where memories can be bought and sold. Follow a memory thief who discovers a conspiracy that threatens the fabric of reality.',
      image: '/api/placeholder/300/200',
      rating: 4.3,
      genre: ['Sci-Fi', 'Thriller'],
      budget: 8500000,
      format: 'Feature Film',
      status: 'Pre-Production',
      location: 'Vancouver, BC',
      createdAt: '2024-02-01T09:15:00Z',
      author: 'Marcus Thompson',
      views: 892,
      likes: 67
    },
    {
      id: '4',
      type: 'production',
      title: 'Moonrise Studios',
      description: 'Independent production company focused on innovative storytelling and emerging talent. Known for award-winning documentaries and feature films.',
      image: '/api/placeholder/200/150',
      rating: 4.6,
      location: 'Austin, TX',
      createdAt: '2022-11-10T11:45:00Z',
      views: 2156,
      likes: 145
    },
    {
      id: '5',
      type: 'pitch',
      title: 'The Lighthouse Keeper',
      description: 'An atmospheric horror film about a lighthouse keeper who begins to question reality when strange ships appear on the horizon every night at midnight.',
      image: '/api/placeholder/300/200',
      rating: 4.1,
      genre: ['Horror', 'Mystery'],
      budget: 1200000,
      format: 'Feature Film',
      status: 'In Review',
      location: 'Maine, USA',
      createdAt: '2024-01-28T16:20:00Z',
      author: 'Emily Foster',
      views: 756,
      likes: 42
    },
    {
      id: '6',
      type: 'creator',
      title: 'Jordan Kim',
      description: 'Cinematographer and director known for groundbreaking work in virtual reality filmmaking. Pioneer in immersive storytelling techniques.',
      image: '/api/placeholder/150/150',
      rating: 4.8,
      genre: ['Sci-Fi', 'Documentary'],
      location: 'San Francisco, CA',
      createdAt: '2023-12-05T13:30:00Z',
      views: 1876,
      likes: 198
    }
  ];

  // Initialize from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('q') || '';
    if (query) {
      setFilters(prev => ({ ...prev, query }));
      performSearch();
    }
  }, [location.search]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.query || Object.values(filters).some(v => 
        Array.isArray(v) ? v.length > 0 : v !== '' && v !== 0 && v !== 'all' && v !== 'relevance' && v !== 'desc'
      )) {
        performSearch();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Filter and sort mock results
      const filteredResults = mockResults.filter(result => {
        if (filters.type !== 'all' && result.type !== filters.type) return false;
        if (filters.query && !result.title.toLowerCase().includes(filters.query.toLowerCase()) && 
            !result.description.toLowerCase().includes(filters.query.toLowerCase())) return false;
        if (filters.genres.length > 0 && result.genre && 
            !filters.genres.some(genre => result.genre!.includes(genre))) return false;
        if (filters.budget && result.budget && 
            (result.budget < filters.budgetRange.min || result.budget > filters.budgetRange.max)) return false;
        if (filters.rating > 0 && result.rating && result.rating < filters.rating) return false;
        if (filters.location && result.location && 
            !result.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
        return true;
      });

      // Sort results
      filteredResults.sort((a, b) => {
        let aVal: any, bVal: any;
        switch (filters.sortBy) {
          case 'date':
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
          case 'rating':
            aVal = a.rating || 0;
            bVal = b.rating || 0;
            break;
          case 'budget':
            aVal = a.budget || 0;
            bVal = b.budget || 0;
            break;
          case 'popularity':
            aVal = (a.views || 0) + (a.likes || 0);
            bVal = (b.views || 0) + (b.likes || 0);
            break;
          default:
            return 0;
        }
        
        return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });

      setResults(filteredResults);
      setTotalResults(filteredResults.length);
      setCurrentPage(1);
      
    } catch (error) {
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleArrayFilterToggle = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (prev[key] as string[]).includes(value)
        ? (prev[key] as string[]).filter(item => item !== value)
        : [...(prev[key] as string[]), value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      type: 'all',
      genres: [],
      budgetRange: { min: 0, max: 50000000 },
      dateRange: { start: '', end: '' },
      format: [],
      status: [],
      location: '',
      rating: 0,
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  const exportResults = () => {
    toast.success('Search results exported to CSV');
  };

  const formatBudget = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * resultsPerPage;
    return results.slice(start, start + resultsPerPage);
  }, [results, currentPage]);

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType={user?.userType || 'creator'}
        title="Advanced Search"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Advanced Search</h1>
          <p className="mt-2 text-gray-600">Find pitches, creators, and production companies with powerful filters</p>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-80 flex-shrink-0">
              <Card className="sticky top-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Filter className="w-5 h-5" />
                      Filters
                    </CardTitle>
                    <button
                      onClick={clearFilters}
                      className="text-sm text-purple-600 hover:text-purple-800"
                    >
                      Clear All
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Search Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="all">All Results</option>
                      <option value="pitches">Pitches Only</option>
                      <option value="creators">Creators Only</option>
                      <option value="production">Production Companies</option>
                    </select>
                  </div>

                  {/* Genres */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genres</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {genreOptions.map(genre => (
                        <label key={genre} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.genres.includes(genre)}
                            onChange={() => handleArrayFilterToggle('genres', genre)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Budget Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="50000000"
                        step="100000"
                        value={filters.budgetRange.max}
                        onChange={(e) => handleFilterChange('budgetRange', { 
                          ...filters.budgetRange, 
                          max: parseInt(e.target.value) 
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>$0</span>
                        <span>{formatBudget(filters.budgetRange.max)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={filters.dateRange.start}
                        onChange={(e) => handleFilterChange('dateRange', { 
                          ...filters.dateRange, 
                          start: e.target.value 
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="date"
                        value={filters.dateRange.end}
                        onChange={(e) => handleFilterChange('dateRange', { 
                          ...filters.dateRange, 
                          end: e.target.value 
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                    <div className="space-y-2">
                      {formatOptions.map(format => (
                        <label key={format} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.format.includes(format)}
                            onChange={() => handleArrayFilterToggle('format', format)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{format}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => handleFilterChange('rating', rating === filters.rating ? 0 : rating)}
                          className={`p-1 ${rating <= filters.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          <Star className="w-5 h-5 fill-current" />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-600">
                        {filters.rating > 0 ? `${filters.rating}+` : 'Any'}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) => handleFilterChange('location', e.target.value)}
                      placeholder="City, State or Country"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar and Controls */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={filters.query}
                      onChange={(e) => handleFilterChange('query', e.target.value)}
                      placeholder="Search for pitches, creators, or production companies..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-3 border border-gray-300 rounded-lg transition flex items-center gap-2 ${
                      showFilters ? 'bg-purple-50 border-purple-300 text-purple-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {loading ? 'Searching...' : `${totalResults} results found`}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Sort by:</label>
                      <select
                        value={filters.sortBy}
                        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="date">Date Created</option>
                        <option value="rating">Rating</option>
                        <option value="budget">Budget</option>
                        <option value="popularity">Popularity</option>
                      </select>
                      
                      <button
                        onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ArrowUpDown className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportResults}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                  <span className="text-gray-600">Searching...</span>
                </div>
              </div>
            )}

            {/* Results */}
            {!loading && (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {paginatedResults.map(result => (
                      <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <div className="aspect-video bg-gray-200 rounded-t-xl relative overflow-hidden">
                          {result.image ? (
                            <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                              {result.type === 'pitch' && <Film className="w-12 h-12 text-white" />}
                              {result.type === 'creator' && <User className="w-12 h-12 text-white" />}
                              {result.type === 'production' && <Award className="w-12 h-12 text-white" />}
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary">
                              {result.type}
                            </Badge>
                          </div>
                          {result.rating && (
                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-lg px-2 py-1 flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              <span className="text-sm font-medium">{result.rating}</span>
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-1">{result.title}</h3>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{result.description}</p>
                          
                          <div className="space-y-2">
                            {result.genre && (
                              <div className="flex flex-wrap gap-1">
                                {result.genre.slice(0, 2).map(genre => (
                                  <Badge key={genre} variant="outline" className="text-xs">
                                    {genre}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center gap-3">
                                {result.budget && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {formatBudget(result.budget)}
                                  </span>
                                )}
                                {result.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {result.location.split(',')[0]}
                                  </span>
                                )}
                              </div>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(result.createdAt)}
                              </span>
                            </div>

                            {(result.views || result.likes) && (
                              <div className="flex items-center gap-3 text-sm text-gray-500 pt-2 border-t">
                                {result.views && (
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {result.views.toLocaleString()}
                                  </span>
                                )}
                                {result.likes && (
                                  <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3" />
                                    {result.likes}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 mb-8">
                    {paginatedResults.map(result => (
                      <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6">
                          <div className="flex gap-4">
                            <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                              {result.image ? (
                                <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                  {result.type === 'pitch' && <Film className="w-8 h-8 text-white" />}
                                  {result.type === 'creator' && <User className="w-8 h-8 text-white" />}
                                  {result.type === 'production' && <Award className="w-8 h-8 text-white" />}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-lg">{result.title}</h3>
                                  <Badge variant="secondary">{result.type}</Badge>
                                  {result.rating && (
                                    <div className="flex items-center gap-1">
                                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                      <span className="text-sm font-medium">{result.rating}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">{formatDate(result.createdAt)}</span>
                              </div>
                              
                              <p className="text-gray-600 mb-3 line-clamp-2">{result.description}</p>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  {result.genre && (
                                    <div className="flex gap-1">
                                      {result.genre.slice(0, 3).map(genre => (
                                        <Badge key={genre} variant="outline" className="text-xs">
                                          {genre}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {result.budget && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      {formatBudget(result.budget)}
                                    </span>
                                  )}
                                  {result.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {result.location}
                                    </span>
                                  )}
                                </div>
                                
                                {(result.views || result.likes) && (
                                  <div className="flex items-center gap-3 text-sm text-gray-500">
                                    {result.views && (
                                      <span className="flex items-center gap-1">
                                        <Eye className="w-3 h-3" />
                                        {result.views.toLocaleString()}
                                      </span>
                                    )}
                                    {result.likes && (
                                      <span className="flex items-center gap-1">
                                        <Heart className="w-3 h-3" />
                                        {result.likes}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + Math.max(1, currentPage - 2);
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 border rounded-lg ${
                            page === currentPage
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* No Results */}
                {!loading && results.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-600 mb-4">
                      Try adjusting your search terms or filters to find what you're looking for.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}