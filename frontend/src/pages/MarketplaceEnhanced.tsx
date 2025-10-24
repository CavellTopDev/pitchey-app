import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '../services/pitch.service';
import { useAuthStore } from '../store/authStore';
import { PitchCardSkeleton } from '../components/Loading/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast/ToastProvider';
import Pagination from '../components/Pagination';
import { configService } from '../services/config.service';
import FormatDisplay from '../components/FormatDisplay';
import FilterBar, { FilterState, SortOption } from '../components/FilterBar';
import { API_URL } from '../config';
import { 
  Eye, 
  Heart, 
  Clock, 
  User,
  LogIn,
  UserPlus,
  Menu,
  Film,
  Building2,
  Wallet,
  DollarSign,
  Shield,
  Calendar,
  TrendingUp,
  ChevronRight,
  MapPin,
  Award,
  Users,
  Star
} from 'lucide-react';

export default function MarketplaceEnhanced() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const toast = useToast();
  const userType = localStorage.getItem('userType');
  
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const itemsPerPage = 24;
  
  // Filter and Sort state
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    formats: [],
    developmentStages: [],
    searchQuery: '',
    creatorTypes: [],
    hasNDA: undefined,
    seekingInvestment: undefined
  });
  
  const [sortOption, setSortOption] = useState<SortOption>({
    field: 'date',
    order: 'desc'
  });

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await configService.getConfiguration();
        setConfig(configData);
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    loadConfig();
  }, []);

  // Fetch pitches with filters and sorting
  const fetchPitches = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      // Build query parameters
      const params = new URLSearchParams();
      params.set('sort', sortOption.field);
      params.set('order', sortOption.order);
      params.set('limit', itemsPerPage.toString());
      params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      // Add filters
      if (filters.genres.length > 0) {
        filters.genres.forEach(genre => params.append('genre', genre));
      }
      if (filters.formats.length > 0) {
        filters.formats.forEach(format => params.append('format', format));
      }
      if (filters.developmentStages.length > 0) {
        filters.developmentStages.forEach(stage => params.append('stage', stage));
      }
      if (filters.searchQuery) {
        params.set('q', filters.searchQuery);
      }
      if (filters.budgetMin !== undefined) {
        params.set('budgetMin', filters.budgetMin.toString());
      }
      if (filters.budgetMax !== undefined) {
        params.set('budgetMax', filters.budgetMax.toString());
      }
      if (filters.creatorTypes && filters.creatorTypes.length > 0) {
        filters.creatorTypes.forEach(type => params.append('creatorType', type));
      }
      if (filters.hasNDA !== undefined) {
        params.set('hasNDA', filters.hasNDA.toString());
      }
      if (filters.seekingInvestment !== undefined) {
        params.set('seekingInvestment', filters.seekingInvestment.toString());
      }
      
      // Try enhanced endpoint first with multi-select support
      const response = await fetch(`${API_URL}/api/pitches/browse/enhanced?${params.toString()}`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setPitches(data.pitches || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalResults(data.pagination?.total || data.pagination?.totalCount || data.totalCount || 0);
      } else {
        // Fallback to general browse endpoint
        const generalParams = new URLSearchParams();
        generalParams.set('sort', sortOption.field);
        generalParams.set('order', sortOption.order);
        generalParams.set('limit', itemsPerPage.toString());
        generalParams.set('offset', ((currentPage - 1) * itemsPerPage).toString());
        
        // For fallback, use only the first selected item for each filter
        if (filters.genres.length > 0) {
          generalParams.set('genre', filters.genres[0]);
        }
        if (filters.formats.length > 0) {
          generalParams.set('format', filters.formats[0]);
        }
        
        const fallbackResponse = await fetch(`${API_URL}/api/pitches/browse/general?${generalParams.toString()}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setPitches(fallbackData.pitches || []);
          setTotalPages(fallbackData.pagination?.totalPages || 1);
          setTotalResults(fallbackData.pagination?.totalCount || fallbackData.totalCount || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      toast.error('Failed to load pitches. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, sortOption, toast]);

  // Fetch pitches when dependencies change
  useEffect(() => {
    fetchPitches();
  }, [fetchPitches]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortOption]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortOption(newSort);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatBudget = (budget: any) => {
    if (!budget) return 'TBD';
    const value = typeof budget === 'string' ? parseInt(budget.replace(/[^\d]/g, '')) : budget;
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStageColor = (stage?: string) => {
    switch (stage?.toLowerCase()) {
      case 'concept': return 'bg-blue-100 text-blue-800';
      case 'script development': return 'bg-purple-100 text-purple-800';
      case 'pre-production': return 'bg-yellow-100 text-yellow-800';
      case 'financing': return 'bg-orange-100 text-orange-800';
      case 'production': return 'bg-green-100 text-green-800';
      case 'post-production': return 'bg-indigo-100 text-indigo-800';
      case 'distribution': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-2xl font-bold text-purple-600">
                Pitchey
              </a>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                    {userType === 'production' && (
                      <>
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Production</span>
                      </>
                    )}
                    {userType === 'investor' && (
                      <>
                        <Wallet className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">Investor</span>
                      </>
                    )}
                    {userType === 'creator' && (
                      <>
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Creator</span>
                      </>
                    )}
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-sm text-gray-700">{user.companyName || user.username}</span>
                  </div>
                  
                  <button
                    onClick={() => navigate(`/${userType}/dashboard`)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/portals')}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-purple-600 font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={() => navigate('/portals')}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Join Pitchey</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Filter Bar */}
      <FilterBar
        genres={config?.genres}
        formats={config?.formats}
        budgetRanges={config?.budgetRanges}
        developmentStages={config?.developmentStages}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
      />

      {/* Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {filters.searchQuery 
                ? `Search Results for "${filters.searchQuery}"`
                : 'All Pitches'}
            </h2>
            <p className="text-gray-600 mt-1">
              {totalResults} {totalResults === 1 ? 'pitch' : 'pitches'} found
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>Updated in real-time</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <PitchCardSkeleton key={i} />
            ))}
          </div>
        ) : pitches.length === 0 ? (
          <EmptyState
            title="No pitches found"
            description="Try adjusting your filters or search query"
            icon={Film}
            action={{
              label: "Clear Filters",
              onClick: () => {
                setFilters({
                  genres: [],
                  formats: [],
                  developmentStages: [],
                  searchQuery: ''
                });
              }
            }}
          />
        ) : (
          <>
            {/* Pitch Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pitches.map((pitch) => (
                <div
                  key={pitch.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                >
                  {/* Pitch Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-indigo-600 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-12 h-12 text-white opacity-50 group-hover:scale-110 transition-transform" />
                    </div>
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {pitch.productionStage && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(pitch.productionStage)}`}>
                          {pitch.productionStage}
                        </span>
                      )}
                      {pitch.hasNDA && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          <Shield className="w-3 h-3 inline mr-1" />
                          NDA
                        </span>
                      )}
                    </div>
                    
                    {/* Stats Overlay */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                        <Eye className="w-3 h-3" />
                        {pitch.viewCount || 0}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                        <Heart className="w-3 h-3" />
                        {pitch.likeCount || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pitch Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {pitch.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {pitch.logline}
                    </p>
                    
                    {/* Meta Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          {pitch.genre}
                        </span>
                        <FormatDisplay
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="compact"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatBudget(pitch.estimatedBudget || pitch.budget)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(pitch.createdAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-600 pt-2 border-t">
                        {pitch.creator?.userType === 'production' ? (
                          <>
                            <Building2 className="w-3 h-3 text-purple-600" />
                            <span className="font-medium">{pitch.creator?.companyName || pitch.creator?.username}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-blue-600" />
                            <span className="font-medium">@{pitch.creator?.username || 'unknown'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}