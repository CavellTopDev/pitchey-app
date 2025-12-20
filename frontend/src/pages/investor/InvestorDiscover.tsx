import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { TrendingUp, Star, Film, Search, Filter, Grid, List, ArrowLeft, Home } from 'lucide-react';
import DashboardHeader from '@/components/DashboardHeader';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';

const InvestorDiscover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // Get current tab from URL params or default to 'featured'
  const currentTab = searchParams.get('tab') || 'featured';
  
  // Check if we're on the genres page
  const isGenresPage = location.pathname.includes('/genres');

  const tabs = [
    { id: 'featured', label: 'Featured', icon: Star },
    { id: 'high-potential', label: 'High Potential', icon: TrendingUp },
    { id: 'genres', label: 'Browse by Genre', icon: Film },
  ];

  const genres = [
    'All Genres', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 
    'Thriller', 'Romance', 'Documentary', 'Animation'
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === 'genres') {
      navigate('/investor/discover/genres');
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  useEffect(() => {
    // If we're on the genres page, set tab to genres
    if (isGenresPage && currentTab !== 'genres') {
      setSearchParams({ tab: 'genres' });
    }
  }, [isGenresPage, currentTab, setSearchParams]);

  // Mock data for pitches
  const mockPitches = [
    {
      id: 1,
      title: 'The Last Horizon',
      genre: 'Sci-Fi',
      budget: '$15M',
      roi: '320%',
      status: 'Seeking Investment',
      thumbnail: 'https://via.placeholder.com/300x200',
      description: 'A groundbreaking sci-fi thriller about humanity\'s last stand.',
      rating: 4.8,
    },
    {
      id: 2,
      title: 'Echoes of Tomorrow',
      genre: 'Drama',
      budget: '$8M',
      roi: '250%',
      status: 'In Development',
      thumbnail: 'https://via.placeholder.com/300x200',
      description: 'An emotional journey through time and memory.',
      rating: 4.6,
    },
    {
      id: 3,
      title: 'Shadow Protocol',
      genre: 'Action',
      budget: '$25M',
      roi: '450%',
      status: 'Pre-Production',
      thumbnail: 'https://via.placeholder.com/300x200',
      description: 'High-octane action thriller with international stakes.',
      rating: 4.9,
    },
  ];

  const renderContent = () => {
    if (isGenresPage || currentTab === 'genres') {
      return (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Browse by Genre</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre.toLowerCase().replace(' ', '-'))}
                  className={`px-4 py-2 rounded-full border ${
                    selectedGenre === genre.toLowerCase().replace(' ', '-') || (selectedGenre === 'all' && genre === 'All Genres')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-600'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockPitches.map(pitch => (
              <PitchCard key={pitch.id} pitch={pitch} viewMode="grid" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {mockPitches.map(pitch => (
          <PitchCard key={pitch.id} pitch={pitch} viewMode={viewMode} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        user={user}
        userType="investor"
        title="Discover Opportunities"
        onLogout={handleLogout}
      />
      
      <div className="container mx-auto px-4 py-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/investor/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          
          <Link 
            to="/marketplace" 
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            All Pitches
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Discover Investment Opportunities</h1>
          <p className="text-gray-600">Find your next successful film investment</p>
        </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search pitches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!isGenresPage && (
        <div className="border-b mb-6">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    currentTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
};

const PitchCard = ({ pitch, viewMode }: { pitch: any; viewMode: 'grid' | 'list' }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex gap-4">
          <img
            src={pitch.thumbnail}
            alt={pitch.title}
            className="w-24 h-16 object-cover rounded"
          />
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{pitch.title}</h3>
                <p className="text-sm text-gray-600">{pitch.genre} • {pitch.budget}</p>
                <p className="text-sm text-gray-500 mt-1">{pitch.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">{pitch.roi}</div>
                <div className="text-sm text-gray-500">Est. ROI</div>
                <div className="mt-2">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {pitch.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <img
        src={pitch.thumbnail}
        alt={pitch.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{pitch.title}</h3>
            <p className="text-sm text-gray-600">{pitch.genre}</p>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm">{pitch.rating}</span>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{pitch.description}</p>
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-xs text-gray-500">Budget</div>
            <div className="font-semibold">{pitch.budget}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Est. ROI</div>
            <div className="font-semibold text-green-600">{pitch.roi}</div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
            {pitch.status}
          </span>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestorDiscover;