import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { pitchService } from '../services/pitch.service';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../services/pitch.service';
import { useAuthStore } from '../store/authStore';
import FollowButton from '../components/FollowButton';
import { PitchCardSkeleton } from '../components/Loading/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast/ToastProvider';
import Pagination from '../components/Pagination';
import { useSearch } from '../hooks/useSearch';
import { useResponsive } from '../hooks/useResponsive';
import { configService } from '../services/config.service';
import FormatDisplay from '../components/FormatDisplay';
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
  Lock
} from 'lucide-react';

export default function Marketplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const toast = useToast();
  const userType = localStorage.getItem('userType');
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [filteredPitches, setFilteredPitches] = useState<Pitch[]>([]);
  const [trendingPitches, setTrendingPitches] = useState<Pitch[]>([]);
  const [newPitches, setNewPitches] = useState<Pitch[]>([]);
  const [browsePitches, setBrowsePitches] = useState<Pitch[]>([]);
  const [browseMetadata, setBrowseMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<{
    related: Pitch[];
    trending: Pitch[];
    similarGenre: Pitch[];
    newReleases: Pitch[];
  }>({
    related: [],
    trending: [],
    similarGenre: [],
    newReleases: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'date' | 'budget' | 'views' | 'likes' | 'investment_status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentView, setCurrentView] = useState('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [config, setConfig] = useState<any>(null);

  // Use config values or fallback
  const genres = config?.genres || [
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
  ];

  const formats = config?.formats || [
    'Feature Film',
    'Short Film', 
    'TV Series',
    'Web Series'
  ];

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

  // Handle URL search parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const searchFromUrl = urlParams.get('search');
    const genreFromUrl = urlParams.get('genre');
    const formatFromUrl = urlParams.get('format');
    
    if (searchFromUrl) {
      setSearchQuery(searchFromUrl);
    }
    if (genreFromUrl) {
      setSelectedGenre(genreFromUrl);
    }
    if (formatFromUrl) {
      setSelectedFormat(formatFromUrl);
    }
  }, [location.search]);

  // Handle hash changes for different views
  useEffect(() => {
    const hash = location.hash.slice(1) || 'all';
    setCurrentView(hash);
    
    // Clear all filters when switching to trending or new views to ensure pure data
    if (hash === 'trending' || hash === 'new') {
      setSelectedGenre('');
      setSelectedFormat('');
      setSearchQuery('');
    }
  }, [location.hash]);
  
  // Apply filter whenever view, pitches, genre, format or search change
  useEffect(() => {
    applyFilters();
  }, [currentView, pitches, trendingPitches, newPitches, browsePitches, selectedGenre, selectedFormat, searchQuery]);

  useEffect(() => {
    loadPitches();
    loadTrendingPitches();
    loadNewPitches();
    loadBrowsePitches(); // Also load browse pitches initially for "all" view
  }, []);

  // Load browse pitches when browse view is active or filters change (skip for search - use client-side)
  useEffect(() => {
    // Only load from API if we're in browse view or have genre/format filters (not for search)
    if (currentView === 'browse' || (selectedGenre || selectedFormat)) {
      // Add a small delay to prevent rapid-fire requests and potential infinite loops
      const timeoutId = setTimeout(() => {
        loadBrowsePitches();
      }, 100);
      
      // Cleanup timeout on dependency change
      return () => clearTimeout(timeoutId);
    }
  }, [currentView, sortBy, sortOrder, selectedGenre, selectedFormat, currentPage]);

  // Load recommendations when search results change
  useEffect(() => {
    if (filteredPitches.length > 0 || searchQuery || selectedGenre || selectedFormat) {
      loadRecommendations();
    }
  }, [filteredPitches, searchQuery, selectedGenre, selectedFormat, pitches, trendingPitches, newPitches]);

  // Load trending and new data when those views become active
  useEffect(() => {
    if (currentView === 'trending' && trendingPitches.length === 0) {
      loadTrendingPitches();
    }
    if (currentView === 'new' && newPitches.length === 0) {
      loadNewPitches();
    }
  }, [currentView]);

  const applyFilters = () => {
    let filtered: Pitch[] = [];
    
    // Get the appropriate data source based on the current view
    switch(currentView) {
      case 'trending':
        // ONLY trending pitches - no mixing with other content
        filtered = [...trendingPitches];
        
        // Apply filters to trending data only
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(p => 
            p.title?.toLowerCase().includes(query) ||
            p.logline?.toLowerCase().includes(query) ||
            p.genre?.toLowerCase().includes(query)
          );
        }
        if (selectedGenre) {
          filtered = filtered.filter(p => 
            p.genre?.toLowerCase() === selectedGenre.toLowerCase()
          );
        }
        if (selectedFormat) {
          filtered = filtered.filter(p => 
            p.format?.toLowerCase() === selectedFormat.toLowerCase()
          );
        }
        break;
        
      case 'new':
        // ONLY new releases - sorted by creation date, no trending mixing
        filtered = [...newPitches];
        
        // Apply filters to new releases data only
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(p => 
            p.title?.toLowerCase().includes(query) ||
            p.logline?.toLowerCase().includes(query) ||
            p.genre?.toLowerCase().includes(query)
          );
        }
        if (selectedGenre) {
          filtered = filtered.filter(p => 
            p.genre?.toLowerCase() === selectedGenre.toLowerCase()
          );
        }
        if (selectedFormat) {
          filtered = filtered.filter(p => 
            p.format?.toLowerCase() === selectedFormat.toLowerCase()
          );
        }
        break;
        
      case 'browse':
        // Browse uses server-side sorting and pagination
        filtered = [...browsePitches];
        
        // Apply client-side search filter if backend search isn't working
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(p => 
            p.title?.toLowerCase().includes(query) ||
            p.logline?.toLowerCase().includes(query) ||
            p.genre?.toLowerCase().includes(query)
          );
        }
        break;
        
      case 'genres':
      case 'formats':
      case 'all':
      default:
        // General view uses browse pitches (or fallback to pitches array)
        filtered = browsePitches.length > 0 ? [...browsePitches] : [...pitches];
        
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(p => 
            p.title?.toLowerCase().includes(query) ||
            p.logline?.toLowerCase().includes(query) ||
            p.genre?.toLowerCase().includes(query)
          );
        }
        
        // Apply genre filter
        if (selectedGenre) {
          filtered = filtered.filter(p => 
            p.genre?.toLowerCase() === selectedGenre.toLowerCase()
          );
        }
        
        // Apply format filter
        if (selectedFormat) {
          filtered = filtered.filter(p => 
            p.format?.toLowerCase().replace(/\s+/g, '') === 
            selectedFormat.toLowerCase().replace(/\s+/g, '')
          );
        }
        
        // Sort by date (newest first) for consistency
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }
    
    setFilteredPitches(filtered);
  };

  const loadPitches = async () => {
    try {
      setLoading(true);
      const { pitches: pitchesData } = await pitchService.getPublicPitches();
      setPitches(Array.isArray(pitchesData) ? pitchesData : []);
    } catch (err) {
      console.error('Failed to load pitches:', err);
      // Don't show error toast, just log it
      // Use empty array as fallback
      setPitches([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingPitches = async () => {
    try {
      // Use the dedicated trending endpoint for proper trending data
      const trending = await pitchService.getTrendingPitches(20);
      setTrendingPitches(trending);
    } catch (err) {
      console.error('Failed to load trending pitches:', err);
      // Fallback: sort all pitches by view count for trending behavior
      try {
        const { pitches: pitchesData } = await pitchService.getPublicPitches();
        if (Array.isArray(pitchesData)) {
          // Sort by view count (descending) + like count as secondary
          const trending = [...pitchesData].sort((a, b) => {
            const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
            if (viewDiff === 0) {
              return (b.likeCount || 0) - (a.likeCount || 0);
            }
            return viewDiff;
          });
          setTrendingPitches(trending.slice(0, 20));
        }
      } catch (fallbackErr) {
        console.error('Trending fallback also failed:', fallbackErr);
        setTrendingPitches([]);
      }
    }
  };

  const loadNewPitches = async () => {
    try {
      // Use the dedicated new releases endpoint for proper chronological data
      const newReleases = await pitchService.getNewReleases(20);
      setNewPitches(newReleases);
    } catch (err) {
      console.error('Failed to load new pitches:', err);
      // Fallback: sort all pitches by creation date for new behavior
      try {
        const { pitches: pitchesData } = await pitchService.getPublicPitches();
        if (Array.isArray(pitchesData)) {
          // Sort by creation date (newest first) - purely chronological
          const newReleases = [...pitchesData].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setNewPitches(newReleases.slice(0, 20));
        }
      } catch (fallbackErr) {
        console.error('New pitches fallback also failed:', fallbackErr);
        setNewPitches([]);
      }
    }
  };

  const loadBrowsePitches = async () => {
    // Prevent multiple simultaneous requests
    if (browseLoading) {
      return;
    }
    
    try {
      setBrowseLoading(true);
      setLoading(true);
      const offset = (currentPage - 1) * itemsPerPage;
      
      
      const result = await pitchService.getGeneralBrowse({
        sort: sortBy,
        order: sortOrder,
        genre: selectedGenre || undefined,
        format: selectedFormat || undefined,
        search: searchQuery || undefined,
        limit: itemsPerPage,
        offset
      });
      
      
      // Store browse results directly (no search filtering here - done in applyFilters)
      setBrowsePitches(result.pitches);
      setBrowseMetadata(result);
    } catch (err) {
      console.error('Failed to load browse pitches:', err);
      setBrowsePitches([]);
      setBrowseMetadata(null);
    } finally {
      setBrowseLoading(false);
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const allPitches = [...pitches];
      
      // Get related pitches based on search query or selected filters
      let relatedPitches: Pitch[] = [];
      if (searchQuery || selectedGenre || selectedFormat) {
        relatedPitches = allPitches.filter(pitch => {
          // Exclude pitches that match the current search to avoid duplicates
          const matchesSearch = searchQuery && (
            pitch.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pitch.logline?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          const matchesGenre = selectedGenre && pitch.genre?.toLowerCase() === selectedGenre.toLowerCase();
          const matchesFormat = selectedFormat && pitch.format?.toLowerCase() === selectedFormat.toLowerCase();
          
          // Return pitches that are related but not exact matches
          if (searchQuery && !matchesSearch) {
            return pitch.genre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   pitch.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
          }
          return !matchesSearch && !matchesGenre && !matchesFormat &&
                 (selectedGenre ? pitch.genre?.toLowerCase() === selectedGenre.toLowerCase() : true) &&
                 (selectedFormat ? pitch.format?.toLowerCase() === selectedFormat.toLowerCase() : true);
        }).slice(0, 6);
      }
      
      // Get similar genre pitches
      let similarGenrePitches: Pitch[] = [];
      if (selectedGenre || filteredPitches.length > 0) {
        const targetGenre = selectedGenre || filteredPitches[0]?.genre;
        if (targetGenre) {
          similarGenrePitches = allPitches
            .filter(pitch => 
              pitch.genre?.toLowerCase() === targetGenre.toLowerCase() &&
              !filteredPitches.some(fp => fp.id === pitch.id)
            )
            .slice(0, 4);
        }
      }
      
      // Get trending recommendations
      const trendingRecommendations = trendingPitches
        .filter(pitch => !filteredPitches.some(fp => fp.id === pitch.id))
        .slice(0, 4);
      
      // Get new release recommendations  
      const newReleaseRecommendations = newPitches
        .filter(pitch => !filteredPitches.some(fp => fp.id === pitch.id))
        .slice(0, 4);
      
      setRecommendations({
        related: relatedPitches,
        trending: trendingRecommendations,
        similarGenre: similarGenrePitches,
        newReleases: newReleaseRecommendations
      });
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled automatically by the effect
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedFormat('');
    setSortBy('date');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Get paginated pitches - different logic for browse vs other views
  const getPaginatedPitches = () => {
    if (currentView === 'browse') {
      // Browse view uses backend pagination
      return browsePitches;
    } else {
      // Other views use frontend pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return filteredPitches.slice(startIndex, endIndex);
    }
  };

  const totalPages = currentView === 'browse' 
    ? (browseMetadata?.pagination?.totalPages || 1)
    : Math.ceil(filteredPitches.length / itemsPerPage);
  const paginatedPitches = getPaginatedPitches();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
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
              <div className="hidden md:flex items-center space-x-6">
                <a 
                  href="#trending" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'trending' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Trending
                </a>
                <a 
                  href="#new" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'new' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  New
                </a>
                <a 
                  href="#browse" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'browse' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  General Browse
                </a>
                <a 
                  href="#genres" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'genres' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  Genres
                </a>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <>
                  {/* User Status Badge */}
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
                  
                  {/* Dashboard Button */}
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

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 text-white overflow-hidden">
        {/* Enhanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-900/40 via-purple-800/30 to-fuchsia-900/40"></div>
        
        {/* Clean Background Decoration */}
        <div className="absolute inset-0 opacity-20">
          {/* Film reel decoration */}
          <div className="absolute top-10 left-10 w-32 h-32 opacity-30">
            <Film className="w-full h-full animate-spin-slow" />
          </div>
          <div className="absolute bottom-10 right-10 w-24 h-24 opacity-30">
            <Video className="w-full h-full animate-pulse" />
          </div>
          <div className="absolute top-1/2 left-1/4 w-20 h-20 opacity-20">
            <Sparkles className="w-full h-full animate-bounce" />
          </div>
        </div>
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg animate-fade-in">
              Discover Amazing Film Projects
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 drop-shadow animate-fade-in-delay">
              Browse the latest pitches from talented creators worldwide
            </p>
            
            {/* Search Bar - disabled for trending/new tabs */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex bg-white rounded-lg shadow-lg overflow-hidden">
                <input
                  type="text"
                  placeholder={
                    currentView === 'trending' ? "Search is disabled in Trending view" :
                    currentView === 'new' ? "Search is disabled in New Releases view" :
                    "Search for films, genres, creators..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    // Only allow search changes if not in trending/new views
                    if (currentView !== 'trending' && currentView !== 'new') {
                      setSearchQuery(e.target.value);
                    }
                  }}
                  disabled={currentView === 'trending' || currentView === 'new'}
                  className={`flex-1 px-6 py-4 text-gray-900 focus:outline-none ${
                    (currentView === 'trending' || currentView === 'new') ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
                <button
                  type="submit"
                  disabled={currentView === 'trending' || currentView === 'new'}
                  className={`px-6 py-4 transition-colors ${
                    (currentView === 'trending' || currentView === 'new') 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trending Section */}
        {trendingPitches.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center space-x-2 mb-6">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-gray-900">Trending Now</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingPitches.slice(0, 4).map((pitch) => {
                const isProduction = pitch.creator?.userType === 'production';
                const isInvestor = pitch.creator?.userType === 'investor';
                const borderColor = 
                  isProduction ? 'border-purple-500' :
                  isInvestor ? 'border-green-500' :
                  'border-blue-300';
                  
                return (
                <div
                  key={pitch.id}
                  className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border-2 ${borderColor}`}
                  style={{
                    boxShadow: isProduction ? '0 0 15px rgba(168, 85, 247, 0.25)' :
                               isInvestor ? '0 0 15px rgba(34, 197, 94, 0.25)' :
                               '0 0 15px rgba(59, 130, 246, 0.15)'
                  }}
                >
                  <div 
                    onClick={() => navigate(`/pitch/${pitch.id}`)}
                    className={`aspect-video bg-gradient-to-br ${
                      pitch.creator?.userType === 'production' ? 'from-purple-400 to-purple-600' :
                      pitch.creator?.userType === 'investor' ? 'from-green-400 to-green-600' :
                      'from-gray-400 to-gray-600'
                    } flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity`}>
                    <div className="text-center">
                      <Film className="w-12 h-12 text-white/80 mx-auto mb-2" />
                      <div className="text-white font-bold text-lg">
                        <FormatDisplay 
                          formatCategory={pitch.formatCategory}
                          formatSubtype={pitch.formatSubtype}
                          format={pitch.format}
                          variant="subtype-only"
                          className="text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 truncate">
                      {pitch.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      {pitch.genre}
                    </p>
                    <p className={`text-xs font-medium mb-2 ${
                      isProduction ? 'text-purple-600' :
                      isInvestor ? 'text-green-600' :
                      'text-blue-600'
                    }`}>
                      {isProduction ? '🏢 Production' : isInvestor ? '💰 Investor' : '👤 Creator'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{pitch.viewCount}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Heart className="w-3 h-3" />
                        <span>{pitch.likeCount}</span>
                      </span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Browse View - Car Shopping Layout */}
        {currentView === 'browse' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-6">
            {/* Left Sidebar - Filters */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters & Sorting</h3>
                
                {/* Sort By */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="date">Date</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="budget">Budget</option>
                    <option value="views">Views</option>
                    <option value="likes">Likes</option>
                    <option value="investment_status">Investment Status</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    {sortBy === 'alphabetical' ? (
                      <>
                        <option value="asc">A to Z</option>
                        <option value="desc">Z to A</option>
                      </>
                    ) : sortBy === 'date' ? (
                      <>
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </>
                    ) : sortBy === 'budget' ? (
                      <>
                        <option value="desc">High to Low</option>
                        <option value="asc">Low to High</option>
                      </>
                    ) : sortBy === 'investment_status' ? (
                      <>
                        <option value="desc">Funded First</option>
                        <option value="asc">Seeking Funding First</option>
                      </>
                    ) : (
                      <>
                        <option value="desc">Highest First</option>
                        <option value="asc">Lowest First</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Genre Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">All Genres</option>
                    {genres.map((genre) => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                </div>

                {/* Format Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">All Formats</option>
                    {formats.map((format) => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                {(selectedGenre || selectedFormat || sortBy !== 'date' || sortOrder !== 'desc') && (
                  <button
                    onClick={() => {
                      setSelectedGenre('');
                      setSelectedFormat('');
                      setSortBy('date');
                      setSortOrder('desc');
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    Clear All Filters
                  </button>
                )}

                {/* Results Summary */}
                {browseMetadata && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">
                        {browseMetadata.totalCount} results found
                      </p>
                      <p>
                        Page {browseMetadata.pagination.currentPage} of {browseMetadata.pagination.totalPages}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Content - Results */}
            <div className="lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  General Browse
                  {selectedGenre && ` - ${selectedGenre}`}
                  {selectedFormat && ` - ${selectedFormat}`}
                </h2>
                <div className="text-sm text-gray-500">
                  {browseMetadata && `${browseMetadata.totalCount} pitches`}
                </div>
              </div>
              
              {/* Browse Results Grid will be rendered below */}
            </div>
          </div>
        ) : (
          /* Standard Filters for other views */
          <div className="flex flex-wrap items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
              {currentView === 'trending' && 'Trending Pitches'}
              {currentView === 'new' && 'New Releases'}
              {currentView === 'genres' && 'Browse by Genre'}
              {currentView === 'all' && 'All Pitches'}
              {searchQuery && ` - "${searchQuery}"`}
              {selectedGenre && ` - ${selectedGenre}`}
              {selectedFormat && ` - ${selectedFormat}`}
            </h2>
            
            <div className="flex flex-wrap items-center space-x-4">
              {/* Only show filters for 'all' and 'genres' views, not for trending/new */}
              {currentView !== 'trending' && currentView !== 'new' && (
                <>
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">All Genres</option>
                    {genres.map((genre) => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">All Formats</option>
                    {formats.map((format) => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                  
                  {/* Show clear filters if any filters are active */}
                  {(selectedGenre || selectedFormat || searchQuery) && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Clear Filters
                    </button>
                  )}
                </>
              )}
              
              {/* Show info for trending/new views */}
              {(currentView === 'trending' || currentView === 'new') && (
                <div className="text-sm text-gray-500 italic">
                  {currentView === 'trending' && 'Sorted by views and engagement'}
                  {currentView === 'new' && 'Sorted by publication date'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pitches Grid */}
        {currentView === 'browse' && (
          /* Browse view continues in the right column */
          <div className="lg:col-span-3 -mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <PitchCardSkeleton key={index} />
                ))}
              </div>
            ) : paginatedPitches.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedPitches.map((pitch) => {
                    // Determine card styling based on user type
                    const isProduction = pitch.creator?.userType === 'production';
                    const isInvestor = pitch.creator?.userType === 'investor';
                    
                    const borderColor = 
                      isProduction ? 'border-purple-500 shadow-purple-300' :
                      isInvestor ? 'border-green-500 shadow-green-300' :
                      'border-blue-300 shadow-blue-200';
                    
                    const bgGradient = 
                      isProduction ? 'from-purple-400 to-purple-600' :
                      isInvestor ? 'from-green-400 to-green-600' :
                      'from-gray-400 to-gray-600';
                      
                    return (
                    <div
                      key={pitch.id}
                      className={`bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all cursor-pointer overflow-hidden border-2 ${borderColor} relative group`}
                      style={{
                        boxShadow: isProduction ? '0 0 20px rgba(168, 85, 247, 0.3)' :
                                   isInvestor ? '0 0 20px rgba(34, 197, 94, 0.3)' :
                                   '0 0 20px rgba(59, 130, 246, 0.2)'
                      }}
                    >
                      {/* Enhanced badge for production companies */}
                      {isProduction && (
                        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                          <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            Production
                          </span>
                          {pitch.budget && (
                            <span className="bg-black/70 text-white px-2 py-1 rounded text-xs">
                              {pitch.budget}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {isInvestor && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Investor
                          </span>
                        </div>
                      )}
                      
                      <div 
                        onClick={() => navigate(`/pitch/${pitch.id}`)}
                        className={`aspect-video bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white font-bold text-sm relative cursor-pointer hover:opacity-90 transition-opacity`}
                      >
                        <Film className="w-8 h-8 text-white/50 absolute" />
                        <div className="z-10 text-center">
                          <FormatDisplay 
                            formatCategory={pitch.formatCategory}
                            formatSubtype={pitch.formatSubtype}
                            format={pitch.format}
                            variant="subtype-only"
                            className="text-white"
                          />
                        </div>
                        
                        {/* Enhanced media indicators for production pitches */}
                        {isProduction && (
                          <div className="absolute bottom-2 right-2 flex gap-2">
                            {pitch.lookbookUrl && <BookOpen className="w-4 h-4 text-white/80" title="Lookbook Available" />}
                            {pitch.scriptUrl && <FileText className="w-4 h-4 text-white/80" title="Script Available" />}
                            {pitch.trailerUrl && <Video className="w-4 h-4 text-white/80" title="Trailer Available" />}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                            {pitch.title}
                          </h3>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {pitch.logline}
                        </p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                          <span className="px-2 py-1 bg-gray-100 rounded-full">
                            {pitch.genre}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 font-medium ${
                              isProduction ? 'text-purple-600' :
                              isInvestor ? 'text-green-600' :
                              'text-blue-600'
                            }`}>
                              {isProduction ? (
                                <>
                                  <Building2 className="w-3 h-3" />
                                  <span>Production</span>
                                </>
                              ) : isInvestor ? (
                                <>
                                  <Wallet className="w-3 h-3" />
                                  <span>Investor</span>
                                </>
                              ) : (
                                <>
                                  <User className="w-3 h-3" />
                                  <span>Creator</span>
                                </>
                              )}
                            </div>
                            {isAuthenticated && pitch.creator?.id && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <FollowButton 
                                  creatorId={pitch.creator.id}
                                  variant="small" 
                                  className="text-xs px-2 py-1"
                                  showFollowingText={false}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Creator name display */}
                        <div className="mb-3 text-sm">
                          <span className="text-gray-500">by </span>
                          <span className={`font-medium ${
                            isProduction ? 'text-purple-700' :
                            isInvestor ? 'text-green-700' :
                            'text-gray-700'
                          }`}>
                            {pitch.creator?.companyName || pitch.creator?.username || 'Anonymous'}
                          </span>
                        </div>
                        
                        {/* NDA indicator for production/investor pitches */}
                        {(isProduction || isInvestor) && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-amber-800">
                              <Shield className="w-3 h-3" />
                              <span className="font-medium">NDA Required for Full Access</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center space-x-3">
                            <span className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{pitch.viewCount}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Heart className="w-3 h-3" />
                              <span>{pitch.likeCount}</span>
                            </span>
                            {pitch.ndaCount > 0 && (
                              <span className="flex items-center space-x-1 text-purple-500">
                                <Shield className="w-3 h-3" />
                                <span>{pitch.ndaCount}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(pitch.createdAt)}</span>
                          </div>
                        </div>
                        
                        {/* Action buttons for all pitches */}
                        <div className="mt-4 pt-4 border-t flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pitch/${pitch.id}`);
                            }}
                            className="flex-1 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded hover:bg-purple-200 transition"
                          >
                            View Details
                          </button>
                          
                          {isProduction && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await pitchService.requestNDA(pitch.id, {
                              fullName: user?.username || "Anonymous User",
                              email: user?.email || "noemail@example.com", 
                              company: user?.companyName || "",
                              purpose: "Request for full pitch materials and production details"
                            });
                                  toast?.success("NDA request sent successfully!");
                                } catch (error) {
                                  console.error("Error requesting NDA:", error);
                                  toast?.error("Failed to send NDA request. Please try again.");
                                }
                              }}
                              className="flex-1 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition flex items-center justify-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              Request Full
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
                
                {/* Browse Pagination */}
                {browseMetadata && browseMetadata.pagination.totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={browseMetadata.pagination.currentPage}
                      totalPages={browseMetadata.pagination.totalPages}
                      onPageChange={handlePageChange}
                      showTotal={true}
                      totalItems={browseMetadata.totalCount}
                      itemsPerPage={browseMetadata.pagination.limit}
                      className="justify-center"
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={Search}
                title="No pitches found"
                description="Try adjusting your filters or search criteria."
                action={{
                  label: "Clear Filters",
                  onClick: () => {
                    setSelectedGenre('');
                    setSelectedFormat('');
                    setSortBy('date');
                    setSortOrder('desc');
                    setCurrentPage(1);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Standard layout for other views */}
        {currentView !== 'browse' && (loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <PitchCardSkeleton key={index} />
              ))}
            </div>
          ) : paginatedPitches.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedPitches.map((pitch) => {
                // Determine card styling based on user type
                const isProduction = pitch.creator?.userType === 'production';
                const isInvestor = pitch.creator?.userType === 'investor';
              
                const borderColor = 
                isProduction ? 'border-purple-500 shadow-purple-300' :
                isInvestor ? 'border-green-500 shadow-green-300' :
                'border-blue-300 shadow-blue-200';
              
              const bgGradient = 
                isProduction ? 'from-purple-400 to-purple-600' :
                isInvestor ? 'from-green-400 to-green-600' :
                'from-gray-400 to-gray-600';
                
              return (
              <div
                key={pitch.id}
                className={`bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all cursor-pointer overflow-hidden border-2 ${borderColor} relative group`}
                style={{
                  boxShadow: isProduction ? '0 0 20px rgba(168, 85, 247, 0.3)' :
                             isInvestor ? '0 0 20px rgba(34, 197, 94, 0.3)' :
                             '0 0 20px rgba(59, 130, 246, 0.2)'
                }}
              >
                {/* Enhanced badge for production companies */}
                {isProduction && (
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Production
                    </span>
                    {pitch.budget && (
                      <span className="bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {pitch.budget}
                      </span>
                    )}
                  </div>
                )}
                
                {isInvestor && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Investor
                    </span>
                  </div>
                )}
                
                <div 
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  className={`aspect-video bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white font-bold text-sm relative cursor-pointer hover:opacity-90 transition-opacity`}
                >
                  <Film className="w-8 h-8 text-white/50 absolute" />
                  <div className="z-10 text-center">
                    <FormatDisplay 
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="subtype-only"
                      className="text-white"
                    />
                  </div>
                  
                  {/* Enhanced media indicators for production pitches */}
                  {isProduction && (
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      {pitch.lookbookUrl && <BookOpen className="w-4 h-4 text-white/80" title="Lookbook Available" />}
                      {pitch.scriptUrl && <FileText className="w-4 h-4 text-white/80" title="Script Available" />}
                      {pitch.trailerUrl && <Video className="w-4 h-4 text-white/80" title="Trailer Available" />}
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                      {pitch.title}
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {pitch.logline}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <span className="px-2 py-1 bg-gray-100 rounded-full">
                      {pitch.genre}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 font-medium ${
                        isProduction ? 'text-purple-600' :
                        isInvestor ? 'text-green-600' :
                        'text-blue-600'
                      }`}>
                        {isProduction ? (
                          <>
                            <Building2 className="w-3 h-3" />
                            <span>Production</span>
                          </>
                        ) : isInvestor ? (
                          <>
                            <Wallet className="w-3 h-3" />
                            <span>Investor</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            <span>Creator</span>
                          </>
                        )}
                      </div>
                      {isAuthenticated && pitch.creator?.id && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <FollowButton 
                            creatorId={pitch.creator.id}
                            variant="small" 
                            className="text-xs px-2 py-1"
                            showFollowingText={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Creator name display */}
                  <div className="mb-3 text-sm">
                    <span className="text-gray-500">by </span>
                    <span className={`font-medium ${
                      isProduction ? 'text-purple-700' :
                      isInvestor ? 'text-green-700' :
                      'text-gray-700'
                    }`}>
                      {pitch.creator?.companyName || pitch.creator?.username || 'Anonymous'}
                    </span>
                  </div>
                  
                  {/* NDA indicator for production/investor pitches */}
                  {(isProduction || isInvestor) && (
                    <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-amber-800">
                        <Shield className="w-3 h-3" />
                        <span className="font-medium">NDA Required for Full Access</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{pitch.viewCount}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Heart className="w-3 h-3" />
                        <span>{pitch.likeCount}</span>
                      </span>
                      {pitch.ndaCount > 0 && (
                        <span className="flex items-center space-x-1 text-purple-500">
                          <Shield className="w-3 h-3" />
                          <span>{pitch.ndaCount}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(pitch.createdAt)}</span>
                    </div>
                  </div>
                  
                  {/* Action buttons for all pitches */}
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pitch/${pitch.id}`);
                      }}
                      className="flex-1 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded hover:bg-purple-200 transition"
                    >
                      View Details
                    </button>
                    
                    {isProduction && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await pitchService.requestNDA(pitch.id, {
                              fullName: user?.username || "Anonymous User",
                              email: user?.email || "noemail@example.com", 
                              company: user?.companyName || "",
                              purpose: "Request for full pitch materials and production details"
                            });
                            toast?.success("NDA request sent successfully!");
                          } catch (error) {
                            console.error("Error requesting NDA:", error);
                            toast?.error("Failed to send NDA request. Please try again.");
                          }
                        }}
                        className="flex-1 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        Request Full
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
            </div>
            
            {/* Recommendations Section */}
            {(searchQuery || selectedGenre || selectedFormat) && (
              <div className="mt-12 space-y-8">
                <div className="border-t pt-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {searchQuery ? 'Recommendations Based on Your Search' : 'You Might Also Like'}
                  </h2>
                  
                  {/* Related Pitches */}
                  {recommendations.related.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        Related to Your Search
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recommendations.related.map(pitch => (
                          <div
                            key={pitch.id}
                            onClick={() => navigate(`/pitch/${pitch.id}`)}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                          >
                            <div className="aspect-video bg-gradient-to-br from-purple-100 to-blue-100 relative overflow-hidden">
                              {pitch.thumbnailUrl ? (
                                <img
                                  src={pitch.thumbnailUrl}
                                  alt={pitch.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Video className="w-16 h-16 text-purple-300" />
                                </div>
                              )}
                              <div className="absolute top-3 left-3">
                                <span className="bg-white/90 text-xs font-medium px-2 py-1 rounded">
                                  {pitch.genre}
                                </span>
                              </div>
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">{pitch.title}</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{pitch.logline}</p>
                              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {pitch.viewCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  {pitch.likeCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Similar Genre */}
                  {recommendations.similarGenre.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Film className="w-5 h-5 text-blue-600" />
                        More in {selectedGenre || 'This Genre'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recommendations.similarGenre.map(pitch => (
                          <div
                            key={pitch.id}
                            onClick={() => navigate(`/pitch/${pitch.id}`)}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                          >
                            <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                              {pitch.thumbnailUrl ? (
                                <img
                                  src={pitch.thumbnailUrl}
                                  alt={pitch.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Video className="w-12 h-12 text-blue-300" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{pitch.title}</h4>
                              <p className="text-xs text-gray-600 line-clamp-2 mt-1">{pitch.logline}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Trending Recommendations */}
                  {recommendations.trending.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-red-600" />
                        Trending Now
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recommendations.trending.map(pitch => (
                          <div
                            key={pitch.id}
                            onClick={() => navigate(`/pitch/${pitch.id}`)}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                          >
                            <div className="aspect-video bg-gradient-to-br from-red-100 to-orange-100">
                              {pitch.thumbnailUrl ? (
                                <img
                                  src={pitch.thumbnailUrl}
                                  alt={pitch.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <TrendingUp className="w-12 h-12 text-red-300" />
                                </div>
                              )}
                            </div>
                            <div className="p-3">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{pitch.title}</h4>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-600">{pitch.genre}</span>
                                <span className="flex items-center gap-1 text-xs text-red-600">
                                  <TrendingUp className="w-3 h-3" />
                                  {pitch.viewCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* New Releases */}
                  {recommendations.newReleases.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5 text-green-600" />
                        Fresh Releases
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recommendations.newReleases.map(pitch => (
                          <div
                            key={pitch.id}
                            onClick={() => navigate(`/pitch/${pitch.id}`)}
                            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                          >
                            <div className="aspect-video bg-gradient-to-br from-green-100 to-teal-100">
                              {pitch.thumbnailUrl ? (
                                <img
                                  src={pitch.thumbnailUrl}
                                  alt={pitch.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <Star className="w-12 h-12 text-green-300" />
                                </div>
                              )}
                              <div className="absolute top-2 right-2">
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">New</span>
                              </div>
                            </div>
                            <div className="p-3">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{pitch.title}</h4>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-600">{pitch.format}</span>
                                <span className="text-xs text-green-600">
                                  {formatDate(pitch.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  showTotal={true}
                  totalItems={filteredPitches.length}
                  itemsPerPage={itemsPerPage}
                  className="justify-center"
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Search}
            title="No pitches found"
            description="Try adjusting your search criteria or browse all pitches."
            action={{
              label: "Show All Pitches",
              onClick: clearFilters
            }}
          />
        ))}
      </div>

      {/* Call to Action */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Share Your Story?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of creators, producers, and investors on Pitchey
          </p>
          <button
            onClick={() => navigate('/portals')}
            className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-lg font-semibold"
          >
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}