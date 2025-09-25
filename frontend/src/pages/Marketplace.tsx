import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import FollowButton from '../components/FollowButton';
import { PitchCardSkeleton } from '../components/Loading/Skeleton';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast/ToastProvider';
import Pagination from '../components/Pagination';
import { useSearch } from '../hooks/useSearch';
import { useResponsive } from '../hooks/useResponsive';
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [currentView, setCurrentView] = useState('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const genres = [
    'Drama', 'Comedy', 'Action', 'Thriller', 'Horror', 'Romance', 
    'Sci-Fi', 'Fantasy', 'Documentary', 'Animation', 'Mystery'
  ];

  const formats = [
    'Feature Film', 'Short Film', 'TV Series', 'Web Series'
  ];

  // Handle hash changes for different views
  useEffect(() => {
    const hash = location.hash.slice(1) || 'all';
    setCurrentView(hash);
  }, [location.hash]);
  
  // Apply filter whenever view, pitches, genre, format or search change
  useEffect(() => {
    applyFilters();
  }, [currentView, pitches, selectedGenre, selectedFormat, searchQuery]);

  useEffect(() => {
    loadPitches();
    loadTrendingPitches();
  }, []);

  const applyFilters = () => {
    let filtered = [...pitches];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.logline?.toLowerCase().includes(query) ||
        p.genre?.toLowerCase().includes(query) ||
        p.creator?.username?.toLowerCase().includes(query)
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
    
    // Apply view-specific sorting/filtering
    switch(currentView) {
      case 'trending':
        // Sort by view count (most viewed)
        filtered = filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case 'new':
        // Sort by creation date (newest first)
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'top-rated':
        // Sort by like count (most liked)
        filtered = filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      case 'featured':
        // Staff picks - filter for high quality (high like ratio)
        filtered = filtered.filter(p => {
          const ratio = (p.likeCount || 0) / Math.max(1, p.viewCount || 1);
          return ratio > 0.15; // 15% like rate or higher
        }).sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      case 'hot':
        // Most discussed - simulate by combining views and likes
        filtered = filtered.sort((a, b) => {
          const scoreA = (a.viewCount || 0) + (a.likeCount || 0) * 3;
          const scoreB = (b.viewCount || 0) + (b.likeCount || 0) * 3;
          return scoreB - scoreA;
        });
        break;
      case 'genres':
        // Just apply genre filter
        break;
      case 'formats':
        // Just apply format filter
        break;
      default:
        // Show all pitches
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    
    setFilteredPitches(filtered);
  };

  const loadPitches = async () => {
    try {
      setLoading(true);
      console.log('Loading pitches from API...');
      const data = await pitchAPI.getPublic();
      console.log('Loaded pitches:', data);
      
      setPitches(data || []);
    } catch (err) {
      console.error('Failed to load pitches:', err);
      // Don't show error toast, just log it
      // Use empty array as fallback
      setPitches([]);
      console.log('Using empty array as fallback');
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingPitches = async () => {
    try {
      const data = await pitchAPI.getPublic();
      
      // Sort by view count for trending
      const trending = [...data].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      setTrendingPitches(trending.slice(0, 5));
    } catch (err) {
      console.error('Failed to load trending pitches:', err);
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
    setCurrentPage(1);
  };

  // Get paginated pitches
  const getPaginatedPitches = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPitches.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredPitches.length / itemsPerPage);
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
                  href="#top-rated" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'top-rated' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  Top Rated
                </a>
                <a 
                  href="#featured" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'featured' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  Staff Picks
                </a>
                <a 
                  href="#hot" 
                  className={`flex items-center gap-1 font-medium transition ${
                    currentView === 'hot' ? 'text-purple-600' : 'text-gray-700 hover:text-purple-600'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Hot
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
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Discover Amazing Film Projects
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">
              Browse the latest pitches from talented creators worldwide
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex bg-white rounded-lg shadow-lg overflow-hidden">
                <input
                  type="text"
                  placeholder="Search for films, genres, creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-6 py-4 text-gray-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-700 transition-colors"
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {trendingPitches.map((pitch) => {
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
                      <span className="text-white font-bold text-lg">
                        {pitch.format}
                      </span>
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
                      {isProduction ? '🏢' : isInvestor ? '💰' : '👤'} 
                      {' '}
                      {pitch.creator?.companyName || pitch.creator?.username || 'Unknown'}
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

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
            {currentView === 'trending' && 'Trending Pitches'}
            {currentView === 'new' && 'New Releases'}
            {currentView === 'top-rated' && 'Top Rated'}
            {currentView === 'featured' && 'Staff Picks'}
            {currentView === 'hot' && 'Hot & Discussed'}
            {currentView === 'genres' && 'Browse by Genre'}
            {currentView === 'all' && 'All Pitches'}
            {searchQuery && ` - "${searchQuery}"`}
            {selectedGenre && ` - ${selectedGenre}`}
            {selectedFormat && ` - ${selectedFormat}`}
          </h2>
          
          <div className="flex flex-wrap items-center space-x-4">
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
            
            {(selectedGenre || selectedFormat || searchQuery) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Pitches Grid */}
        {loading ? (
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
                  <span className="z-10">{pitch.format}</span>
                  
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
                            <span 
                              className="hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/creator/${pitch.creator?.id}`);
                              }}
                            >
                              {pitch.creator?.companyName || pitch.creator?.username || 'Production'}
                            </span>
                          </>
                        ) : isInvestor ? (
                          <>
                            <Wallet className="w-3 h-3" />
                            <span 
                              className="hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/creator/${pitch.creator?.id}`);
                              }}
                            >
                              {pitch.creator?.companyName || pitch.creator?.username || 'Investor'}
                            </span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            <span 
                              className="hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/creator/${pitch.creator?.id}`);
                              }}
                            >
                              {pitch.creator?.username || 'Creator'}
                            </span>
                          </>
                        )}
                      </div>
                      {isAuthenticated && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <FollowButton 
                            creatorId={pitch.creator?.id || ''}
                            variant="small" 
                            className="text-xs px-2 py-1"
                            showFollowingText={false}
                          />
                        </div>
                      )}
                    </div>
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
                    {isAuthenticated && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <FollowButton 
                          pitchId={pitch.id}
                          creatorId={pitch.creator.id}
                          variant="small" 
                          className="flex-1 min-w-[80px]"
                        />
                      </div>
                    )}
                    
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
                            await pitchAPI.requestNDA(pitch.id, "Request for full pitch materials and production details");
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
        )}
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