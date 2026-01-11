import { getDashboardRoute } from '../utils/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { pitchService } from '../services/pitch.service';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../services/pitch.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import FollowButton from '../components/FollowButton';
import { PitchCardSkeleton } from '../components/Loading/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast/ToastProvider';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { configService } from '../services/config.service';
import FormatDisplay from '../components/FormatDisplay';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  Eye, 
  Heart, 
  Clock, 
  User,
  LogIn,
  UserPlus,
  Menu,
  Star,
  Sparkles,
  MessageCircle,
  Award,
  Film,
  Building2,
  Wallet,
  DollarSign,
  BookOpen,
  FileText,
  Video,
  Shield,
  Lock,
  Grid,
  List,
  ChevronDown,
  SlidersHorizontal,
  X,
  Calendar,
  BarChart3,
  Users,
  Zap,
  PlayCircle,
  Info
} from 'lucide-react';

// Enhanced filtering and sorting options
const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending Now', icon: TrendingUp },
  { value: 'newest', label: 'Newest First', icon: Clock },
  { value: 'popular', label: 'Most Popular', icon: Heart },
  { value: 'views', label: 'Most Viewed', icon: Eye },
  { value: 'budget_high', label: 'Highest Budget', icon: DollarSign },
  { value: 'budget_low', label: 'Lowest Budget', icon: Wallet },
  { value: 'alphabetical', label: 'A-Z', icon: BookOpen },
  { value: 'investment_ready', label: 'Investment Ready', icon: Zap }
];

const VIEW_MODES = {
  grid: { icon: Grid, label: 'Grid View', cols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' },
  list: { icon: List, label: 'List View', cols: 'grid-cols-1' },
  compact: { icon: BarChart3, label: 'Compact View', cols: 'grid-cols-1 md:grid-cols-2' }
};

interface FilterState {
  genres: string[];
  formats: string[];
  budgetRange: { min: number; max: number };
  status: string[];
  hasNDA: boolean | null;
  hasInvestment: boolean | null;
  dateRange: { start: Date | null; end: Date | null };
}

export default function MarketplaceEnhanced() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useBetterAuthStore();
  const toast = useToast();
  const { isMobile, isTablet } = useResponsive();
  
  // State management
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [filteredPitches, setFilteredPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<keyof typeof VIEW_MODES>('grid');
  const [showFilters, setShowFilters] = useState(!isMobile);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'trending');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(16);
  
  // Enhanced filter state
  const [filters, setFilters] = useState<FilterState>({
    genres: searchParams.get('genres')?.split(',').filter(Boolean) || [],
    formats: searchParams.get('formats')?.split(',').filter(Boolean) || [],
    budgetRange: { 
      min: parseInt(searchParams.get('budgetMin') || '0'), 
      max: parseInt(searchParams.get('budgetMax') || '10000000') 
    },
    status: searchParams.get('status')?.split(',').filter(Boolean) || [],
    hasNDA: searchParams.get('hasNDA') === 'true' ? true : searchParams.get('hasNDA') === 'false' ? false : null,
    hasInvestment: searchParams.get('hasInvestment') === 'true' ? true : searchParams.get('hasInvestment') === 'false' ? false : null,
    dateRange: { start: null, end: null }
  });

  // Statistics
  const [stats, setStats] = useState({
    totalPitches: 0,
    totalInvestment: 0,
    avgBudget: 0,
    activeCreators: 0
  });

  // Config
  const [config, setConfig] = useState<any>(null);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load config
  useEffect(() => {
    configService.getConfiguration().then(setConfig).catch(console.error);
  }, []);

  // Load pitches
  useEffect(() => {
    fetchPitches();
  }, []);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'trending') params.set('sort', sortBy);
    if (filters.genres.length) params.set('genres', filters.genres.join(','));
    if (filters.formats.length) params.set('formats', filters.formats.join(','));
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.budgetRange.min > 0) params.set('budgetMin', filters.budgetRange.min.toString());
    if (filters.budgetRange.max < 10000000) params.set('budgetMax', filters.budgetRange.max.toString());
    if (filters.hasNDA !== null) params.set('hasNDA', filters.hasNDA.toString());
    if (filters.hasInvestment !== null) params.set('hasInvestment', filters.hasInvestment.toString());
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, sortBy, filters]);

  // Apply filters and sorting
  useEffect(() => {
    applyFiltersAndSort();
  }, [pitches, debouncedSearch, sortBy, filters]);

  const fetchPitches = async () => {
    try {
      setLoading(true);
      // Use the getAll method directly on pitchAPI (no browse object)
      // pitchAPI.getAll() already returns a plain array after parsing the response
      const pitchesData = await pitchAPI.getAll();
      
      console.log('MarketplaceEnhanced received pitches:', pitchesData.length);
      
      // Ensure we have an array
      const validPitches = Array.isArray(pitchesData) ? pitchesData : [];
      
      setPitches(validPitches);
      calculateStats(validPitches);
    } catch (error) {
      console.error('Error fetching pitches:', error);
      toast.error('Failed to load pitches');
      // Set empty array on error to prevent iteration issues
      setPitches([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (pitchData: Pitch[]) => {
    // Ensure pitchData is an array
    if (!Array.isArray(pitchData)) {
      console.warn('calculateStats received non-array data:', pitchData);
      setStats({
        totalPitches: 0,
        totalInvestment: 0,
        avgBudget: 0,
        activeCreators: 0
      });
      return;
    }
    
    const totalInvestment = pitchData.reduce((sum, p) => sum + (p.total_investment || 0), 0);
    const avgBudget = pitchData.reduce((sum, p) => sum + (p.budget || 0), 0) / (pitchData.length || 1);
    const activeCreators = new Set(pitchData.map(p => p.creator_id)).size;
    
    setStats({
      totalPitches: pitchData.length,
      totalInvestment,
      avgBudget,
      activeCreators
    });
  };

  const applyFiltersAndSort = useCallback(() => {
    // Ensure pitches is an array before spreading
    if (!Array.isArray(pitches)) {
      console.warn('pitches is not an array:', pitches);
      setFilteredPitches([]);
      return;
    }
    
    let filtered = [...pitches];

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(pitch => 
        pitch.title.toLowerCase().includes(query) ||
        pitch.logline?.toLowerCase().includes(query) ||
        pitch.genre?.toLowerCase().includes(query) ||
        pitch.creator_name?.toLowerCase().includes(query)
      );
    }

    // Genre filter
    if (filters.genres.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.genres.includes(pitch.genre || '')
      );
    }

    // Format filter
    if (filters.formats.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.formats.includes(pitch.format || '')
      );
    }

    // Budget range filter
    filtered = filtered.filter(pitch => {
      // Parse budget if it's a string like "5-8 million"
      let budgetValue = 0;
      if (typeof pitch.budget === 'string') {
        // Extract numeric value from strings like "5-8 million" or "15-25 million"
        const match = pitch.budget.match(/(\d+)/);
        if (match) {
          budgetValue = parseInt(match[1]) * 1000000; // Convert to actual number
        }
      } else if (typeof pitch.budget === 'number') {
        budgetValue = pitch.budget;
      }
      
      // If no budget specified, don't filter it out
      if (!pitch.budget) return true;
      
      return budgetValue >= filters.budgetRange.min && budgetValue <= filters.budgetRange.max;
    });

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(pitch => 
        filters.status.includes(pitch.status || 'active')
      );
    }

    // NDA filter
    if (filters.hasNDA !== null) {
      filtered = filtered.filter(pitch => 
        filters.hasNDA ? pitch.has_nda : !pitch.has_nda
      );
    }

    // Investment filter
    if (filters.hasInvestment !== null) {
      filtered = filtered.filter(pitch => 
        filters.hasInvestment ? (pitch.total_investment || 0) > 0 : (pitch.total_investment || 0) === 0
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return (b.view_count || 0) + (b.like_count || 0) - ((a.view_count || 0) + (a.like_count || 0));
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'popular':
          return (b.like_count || 0) - (a.like_count || 0);
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'budget_high':
          return (b.budget || 0) - (a.budget || 0);
        case 'budget_low':
          return (a.budget || 0) - (b.budget || 0);
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'investment_ready':
          return (b.investment_goal || 0) - (b.total_investment || 0) - ((a.investment_goal || 0) - (a.total_investment || 0));
        default:
          return 0;
      }
    });

    setFilteredPitches(filtered);
    setCurrentPage(1);
  }, [pitches, debouncedSearch, sortBy, filters]);

  // Pagination
  const paginatedPitches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPitches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPitches, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPitches.length / itemsPerPage);

  const handlePitchClick = (pitch: Pitch) => {
    const userType = localStorage.getItem('userType');
    if (!isAuthenticated) {
      navigate(`/pitch/${pitch.id}`);
    } else if (userType === 'investor') {
      navigate(`/investor/pitch/${pitch.id}`);
    } else if (userType === 'production') {
      navigate(`/production/pitch/${pitch.id}`);
    } else if (userType === 'creator' && pitch.creator_id === user?.id) {
      navigate(`/creator/pitch/${pitch.id}`);
    } else {
      navigate(`/pitch/${pitch.id}`);
    }
  };

  const clearFilters = () => {
    setFilters({
      genres: [],
      formats: [],
      budgetRange: { min: 0, max: 10000000 },
      status: [],
      hasNDA: null,
      hasInvestment: null,
      dateRange: { start: null, end: null }
    });
    setSearchQuery('');
    setSortBy('trending');
  };

  const hasActiveFilters = filters.genres.length > 0 || 
    filters.formats.length > 0 || 
    filters.status.length > 0 ||
    filters.budgetRange.min > 0 || 
    filters.budgetRange.max < 10000000 ||
    filters.hasNDA !== null ||
    filters.hasInvestment !== null ||
    searchQuery !== '';

  // Render pitch card based on view mode
  const renderPitchCard = (pitch: Pitch) => {
    if (viewMode === 'list') {
      return (
        <motion.div
          key={pitch.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          whileHover={{ x: 4 }}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 cursor-pointer"
          onClick={() => handlePitchClick(pitch)}
        >
          <div className="flex gap-4">
            {pitch.poster_url && (
              <img 
                src={pitch.poster_url} 
                alt={pitch.title}
                className="w-24 h-36 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold">{pitch.title}</h3>
                  <p className="text-sm text-gray-600">{pitch.creator_name}</p>
                </div>
                <div className="flex gap-2">
                  {pitch.genre && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {pitch.genre}
                    </span>
                  )}
                  {pitch.format && <FormatDisplay format={pitch.format} />}
                </div>
              </div>
              <p className="text-gray-700 mb-3 line-clamp-2">{pitch.logline}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {pitch.view_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {pitch.like_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {pitch.comment_count || 0}
                  </span>
                </div>
                {pitch.budget && (
                  <span className="text-sm font-medium text-green-600">
                    ${pitch.budget.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Default grid/compact view
    return (
      <motion.div
        key={pitch.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4 }}
        className="group bg-white rounded-lg shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer"
        onClick={() => handlePitchClick(pitch)}
      >
        <div className="aspect-[3/4] relative overflow-hidden bg-gray-100">
          {pitch.poster_url ? (
            <img 
              src={pitch.poster_url} 
              alt={pitch.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-12 h-12 text-gray-400" />
            </div>
          )}
          
          {/* Overlay with quick info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <p className="text-sm line-clamp-3 mb-2">{pitch.logline}</p>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {pitch.view_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {pitch.like_count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {pitch.has_nda && (
              <span className="bg-purple-600 text-white px-2 py-1 text-xs rounded flex items-center gap-1">
                <Shield className="w-3 h-3" />
                NDA
              </span>
            )}
            {pitch.is_featured && (
              <span className="bg-yellow-500 text-white px-2 py-1 text-xs rounded flex items-center gap-1">
                <Star className="w-3 h-3" />
                Featured
              </span>
            )}
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
            {pitch.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{pitch.creator_name}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {pitch.genre && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {pitch.genre}
                </span>
              )}
            </div>
            {pitch.budget && (
              <span className="text-sm font-medium text-green-600">
                ${(pitch.budget / 1000).toFixed(0)}K
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and main nav */}
            <div className="flex items-center gap-8">
              <a href="/" className="text-2xl font-bold text-purple-600">Pitchey</a>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="text-gray-700 hover:text-purple-600 transition font-medium"
                >
                  Browse Pitches
                </button>
                <button 
                  onClick={() => navigate('/how-it-works')}
                  className="text-gray-700 hover:text-purple-600 transition"
                >
                  How It Works
                </button>
                <button 
                  onClick={() => navigate('/about')}
                  className="text-gray-700 hover:text-purple-600 transition"
                >
                  About
                </button>
              </nav>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{user?.username || user?.email}</span>
                  </div>
                  
                  {/* Dashboard button */}
                  <button
                    onClick={() => {
                      const userType = localStorage.getItem('userType');
                      navigate(userType ? `/${userType}/dashboard` : '/dashboard');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/portals')}
                    className="px-4 py-2 text-purple-600 hover:text-purple-700 transition font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/portals')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Header with stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketplace Enhanced</h1>
              <p className="text-blue-100">Discover and invest in the next big hit</p>
            </div>
            
            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">{stats.totalPitches}</div>
                <div className="text-xs text-blue-100">Active Pitches</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">{stats.activeCreators}</div>
                <div className="text-xs text-blue-100">Creators</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">
                  ${(stats.totalInvestment / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-blue-100">Total Invested</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                <div className="text-2xl font-bold">
                  ${(stats.avgBudget / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-blue-100">Avg Budget</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and controls bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="marketplace-search"
                name="search"
                type="text"
                placeholder="Search pitches, creators, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Search pitches"
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {/* Sort dropdown */}
              <select
                id="marketplace-sort"
                name="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="Sort pitches by"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* View mode toggle */}
              <div className="flex border rounded-lg">
                {Object.entries(VIEW_MODES).map(([mode, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as keyof typeof VIEW_MODES)}
                      className={`p-2 ${viewMode === mode ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                      title={config.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilters ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                Filters
                {hasActiveFilters && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {filters.genres.length + filters.formats.length + filters.status.length + (searchQuery ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4">
              {searchQuery && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1">
                  Search: {searchQuery}
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.genres.map(genre => (
                <span key={genre} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-1">
                  {genre}
                  <button onClick={() => setFilters(f => ({ ...f, genres: f.genres.filter(g => g !== genre) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {filters.formats.map(format => (
                <span key={format} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1">
                  {format}
                  <button onClick={() => setFilters(f => ({ ...f, formats: f.formats.filter(fo => fo !== format) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters sidebar */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                className="w-64 shrink-0"
              >
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-20">
                  <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
                  
                  {/* Genre filter */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Genre</h4>
                    <div className="space-y-2">
                      {(config?.genres || ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller']).map((genre: string) => (
                        <label key={genre} className="flex items-center">
                          <input
                            id={`genre-filter-${genre.toLowerCase().replace(/\s+/g, '-')}`}
                            name={`genre-${genre.toLowerCase().replace(/\s+/g, '-')}`}
                            type="checkbox"
                            checked={filters.genres.includes(genre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({ ...f, genres: [...f.genres, genre] }));
                              } else {
                                setFilters(f => ({ ...f, genres: f.genres.filter(g => g !== genre) }));
                              }
                            }}
                            className="mr-2"
                            aria-label={`Filter by ${genre}`}
                          />
                          <span className="text-sm">{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Format filter */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Format</h4>
                    <div className="space-y-2">
                      {(config?.formats || ['Feature Film', 'Short Film', 'TV Series', 'Web Series']).map((format: string) => (
                        <label key={format} className="flex items-center">
                          <input
                            id={`format-filter-${format.toLowerCase().replace(/\s+/g, '-')}`}
                            name={`format-filter-${format.toLowerCase().replace(/\s+/g, '-')}`}
                            aria-label={`Filter by ${format} format`}
                            type="checkbox"
                            checked={filters.formats.includes(format)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(f => ({ ...f, formats: [...f.formats, format] }));
                              } else {
                                setFilters(f => ({ ...f, formats: f.formats.filter(fo => fo !== format) }));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{format}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Budget range */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Range</h4>
                    <div className="space-y-2">
                      <input
                        id="budget-range-slider"
                        name="budget-range-slider"
                        aria-label="Budget range slider"
                        type="range"
                        min="0"
                        max="10000000"
                        step="100000"
                        value={filters.budgetRange.max}
                        onChange={(e) => setFilters(f => ({ ...f, budgetRange: { ...f.budgetRange, max: parseInt(e.target.value) } }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>${(filters.budgetRange.min / 1000).toFixed(0)}K</span>
                        <span>${(filters.budgetRange.max / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </div>

                  {/* Special filters */}
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        id="filter-has-nda"
                        name="filter-has-nda"
                        aria-label="Filter pitches with NDA"
                        type="checkbox"
                        checked={filters.hasNDA === true}
                        onChange={(e) => setFilters(f => ({ ...f, hasNDA: e.target.checked ? true : null }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Has NDA</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        id="filter-has-investment"
                        name="filter-has-investment"
                        aria-label="Filter pitches with investment"
                        type="checkbox"
                        checked={filters.hasInvestment === true}
                        onChange={(e) => setFilters(f => ({ ...f, hasInvestment: e.target.checked ? true : null }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Has Investment</span>
                    </label>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main content */}
          <div className="flex-1">
            {/* Results info */}
            <div className="mb-4 flex justify-between items-center">
              <p className="text-gray-600">
                Showing {paginatedPitches.length} of {filteredPitches.length} pitches
              </p>
            </div>

            {/* Pitches grid */}
            {loading ? (
              <div className={`grid ${VIEW_MODES[viewMode].cols} gap-6`}>
                {[...Array(8)].map((_, i) => (
                  <PitchCardSkeleton key={i} />
                ))}
              </div>
            ) : paginatedPitches.length > 0 ? (
              <>
                <AnimatePresence mode="popLayout">
                  <div className={`grid ${VIEW_MODES[viewMode].cols} gap-6`}>
                    {paginatedPitches.map(pitch => renderPitchCard(pitch))}
                  </div>
                </AnimatePresence>
                
                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title="No pitches found"
                message="Try adjusting your filters or search query"
                action={{
                  label: 'Clear filters',
                  onClick: clearFilters
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}