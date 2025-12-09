import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bookmark, Star, Clock, Calendar, Filter,
  Search, Eye, Share2, Trash2, FolderPlus,
  Tag, User, Film, DollarSign, Grid,
  List, MoreVertical, Plus, Check, X
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useAuthStore } from '../../store/authStore';

interface SavedPitch {
  id: string;
  title: string;
  logline: string;
  genre: string[];
  budget: number;
  creator: {
    id: string;
    name: string;
    avatar?: string;
    verified: boolean;
  };
  savedDate: string;
  lastViewed?: string;
  folder?: string;
  tags: string[];
  rating?: number;
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'saved' | 'under-review' | 'interested' | 'archived';
  thumbnail?: string;
  fundingStage: 'seed' | 'development' | 'production' | 'post-production';
  targetAudience: string;
  estimatedROI?: number;
}

interface SavedFilters {
  folder: 'all' | string;
  status: 'all' | 'saved' | 'under-review' | 'interested' | 'archived';
  priority: 'all' | 'low' | 'medium' | 'high';
  genre: 'all' | string;
  timeRange: '7d' | '30d' | '90d' | 'all';
}

export default function InvestorSaved() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [filteredPitches, setFilteredPitches] = useState<SavedPitch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPitches, setSelectedPitches] = useState<string[]>([]);
  const [filters, setFilters] = useState<SavedFilters>({
    folder: 'all',
    status: 'all',
    priority: 'all',
    genre: 'all',
    timeRange: 'all'
  });
  const [folders] = useState(['High Priority', 'Sci-Fi Projects', 'Low Budget', 'Indie Films']);

  useEffect(() => {
    loadSavedPitches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [savedPitches, filters, searchQuery]);

  const loadSavedPitches = async () => {
    try {
      // Simulate API call - replace with actual API
      setTimeout(() => {
        const mockPitches: SavedPitch[] = [
          {
            id: '1',
            title: 'The Quantum Paradox',
            logline: 'A scientist discovers that reality isn\'t what it seems when she accidentally opens a portal to parallel universes.',
            genre: ['Sci-Fi', 'Thriller'],
            budget: 2500000,
            creator: {
              id: 'c1',
              name: 'Alex Thompson',
              verified: true
            },
            savedDate: '2024-12-01T10:00:00Z',
            lastViewed: '2024-12-07T14:30:00Z',
            folder: 'High Priority',
            tags: ['parallel universes', 'time travel', 'quantum physics'],
            rating: 4.8,
            notes: 'Impressive concept with strong commercial potential. Creator has good track record.',
            priority: 'high',
            status: 'interested',
            fundingStage: 'development',
            targetAudience: 'Sci-fi enthusiasts, thriller fans',
            estimatedROI: 285
          },
          {
            id: '2',
            title: 'Midnight Café',
            logline: 'A 24-hour diner becomes the meeting ground for lost souls seeking redemption in this character-driven drama.',
            genre: ['Drama', 'Independent'],
            budget: 850000,
            creator: {
              id: 'c2',
              name: 'Sarah Mitchell',
              verified: false
            },
            savedDate: '2024-11-28T16:45:00Z',
            lastViewed: '2024-12-05T09:20:00Z',
            folder: 'Indie Films',
            tags: ['character study', 'ensemble cast', 'redemption'],
            rating: 4.2,
            priority: 'medium',
            status: 'under-review',
            fundingStage: 'production',
            targetAudience: 'Adult drama audiences, festival circuit',
            estimatedROI: 180
          },
          {
            id: '3',
            title: 'Digital Shadows',
            logline: 'In a cyberpunk future, a hacker discovers a conspiracy that threatens the boundary between virtual and reality.',
            genre: ['Sci-Fi', 'Action'],
            budget: 1200000,
            creator: {
              id: 'c3',
              name: 'Marcus Chen',
              verified: true
            },
            savedDate: '2024-11-15T11:30:00Z',
            folder: 'Sci-Fi Projects',
            tags: ['cyberpunk', 'hacking', 'virtual reality'],
            rating: 3.9,
            priority: 'medium',
            status: 'saved',
            fundingStage: 'seed',
            targetAudience: 'Young adults, gaming audiences',
            estimatedROI: 220
          },
          {
            id: '4',
            title: 'The Last Symphony',
            logline: 'A dying composer races against time to complete his masterpiece while battling Alzheimer\'s disease.',
            genre: ['Drama', 'Music'],
            budget: 950000,
            creator: {
              id: 'c4',
              name: 'Emma Rodriguez',
              verified: true
            },
            savedDate: '2024-10-20T14:15:00Z',
            lastViewed: '2024-11-30T16:40:00Z',
            tags: ['music', 'alzheimers', 'emotional'],
            rating: 4.6,
            priority: 'high',
            status: 'interested',
            fundingStage: 'development',
            targetAudience: 'Mature audiences, music lovers',
            estimatedROI: 195
          },
          {
            id: '5',
            title: 'Ocean\'s Heart',
            logline: 'A young marine biologist discovers an ancient underwater civilization that holds the key to saving the ocean.',
            genre: ['Adventure', 'Family'],
            budget: 1800000,
            creator: {
              id: 'c5',
              name: 'David Kim',
              verified: false
            },
            savedDate: '2024-10-05T12:00:00Z',
            tags: ['ocean', 'environmental', 'adventure'],
            rating: 3.7,
            priority: 'low',
            status: 'archived',
            fundingStage: 'production',
            targetAudience: 'Family audiences, environmental advocates'
          }
        ];
        setSavedPitches(mockPitches);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load saved pitches:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...savedPitches];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(pitch =>
        pitch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pitch.logline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pitch.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pitch.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pitch.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply folder filter
    if (filters.folder !== 'all') {
      filtered = filtered.filter(pitch => pitch.folder === filters.folder);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(pitch => pitch.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(pitch => pitch.priority === filters.priority);
    }

    // Apply genre filter
    if (filters.genre !== 'all') {
      filtered = filtered.filter(pitch => pitch.genre.includes(filters.genre));
    }

    // Apply time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(pitch => new Date(pitch.savedDate) > cutoff);
      }
    }

    setFilteredPitches(filtered);
  };

  const handleSelectPitch = (pitchId: string) => {
    setSelectedPitches(prev =>
      prev.includes(pitchId)
        ? prev.filter(id => id !== pitchId)
        : [...prev, pitchId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPitches.length === filteredPitches.length) {
      setSelectedPitches([]);
    } else {
      setSelectedPitches(filteredPitches.map(p => p.id));
    }
  };

  const handleBulkAction = async (action: 'remove' | 'folder' | 'status') => {
    if (selectedPitches.length > 0) {
      // Simulate API call
      console.log(`Performing ${action} on pitches:`, selectedPitches);
      setSelectedPitches([]);
    }
  };

  const handleRemovePitch = (pitchId: string) => {
    setSavedPitches(prev => prev.filter(pitch => pitch.id !== pitchId));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'saved': return 'bg-blue-100 text-blue-800';
      case 'under-review': return 'bg-yellow-100 text-yellow-800';
      case 'interested': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          userType="investor"
          title="Saved Pitches"
          onLogout={logout}
          useEnhancedNav={true}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="investor"
        title="Saved Pitches"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Pitches</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your bookmarked investment opportunities and projects of interest
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search saved pitches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={filters.folder}
                onChange={(e) => setFilters(prev => ({ ...prev, folder: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Folders</option>
                <option value="">No Folder</option>
                {folders.map(folder => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="saved">Saved</option>
                <option value="under-review">Under Review</option>
                <option value="interested">Interested</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={filters.genre}
                onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Genres</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Drama">Drama</option>
                <option value="Action">Action</option>
                <option value="Comedy">Comedy</option>
                <option value="Thriller">Thriller</option>
                <option value="Horror">Horror</option>
              </select>

              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Time</option>
                <option value="7d">Last Week</option>
                <option value="30d">Last Month</option>
                <option value="90d">Last Quarter</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedPitches.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-purple-50 rounded-md">
              <span className="text-sm text-purple-700">
                {selectedPitches.length} pitch{selectedPitches.length > 1 ? 'es' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('folder')}
                  className="text-sm px-3 py-1 text-purple-600 hover:text-purple-700"
                >
                  Move to Folder
                </button>
                <button
                  onClick={() => handleBulkAction('status')}
                  className="text-sm px-3 py-1 text-purple-600 hover:text-purple-700"
                >
                  Change Status
                </button>
                <button
                  onClick={() => handleBulkAction('remove')}
                  className="text-sm px-3 py-1 text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
                <button
                  onClick={() => setSelectedPitches([])}
                  className="text-sm px-3 py-1 text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredPitches.length} of {savedPitches.length} saved pitches
          </p>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={selectedPitches.length === filteredPitches.length && filteredPitches.length > 0}
              onChange={handleSelectAll}
              className="mr-2 rounded border-gray-300"
            />
            Select all
          </label>
        </div>

        {/* Pitches Display */}
        {filteredPitches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved pitches found</h3>
            <p className="text-gray-600 mb-6">
              {savedPitches.length === 0 
                ? "You haven't saved any pitches yet. Start exploring to find interesting projects."
                : "No pitches match your current filters."
              }
            </p>
            <button
              onClick={() => navigate('/browse')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Browse Pitches
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <div key={pitch.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedPitches.includes(pitch.id)}
                        onChange={() => handleSelectPitch(pitch.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-2">
                          {pitch.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {pitch.logline}
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Status and Priority */}
                  <div className="flex gap-2 mb-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pitch.status)}`}>
                      {pitch.status.replace('-', ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(pitch.priority)}`}>
                      {pitch.priority} priority
                    </span>
                  </div>

                  {/* Creator and Budget */}
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{pitch.creator.name}</span>
                      {pitch.creator.verified && (
                        <Check className="w-3 h-3 text-blue-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-medium">{formatCurrency(pitch.budget)}</span>
                    </div>
                  </div>

                  {/* Genres and Rating */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {pitch.genre.map((g, index) => (
                      <span key={index} className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        {g}
                      </span>
                    ))}
                  </div>

                  {pitch.rating && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{pitch.rating}/5</span>
                      </div>
                      {pitch.estimatedROI && (
                        <span className="text-sm text-green-600 font-medium">
                          Est. ROI: {pitch.estimatedROI}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-3 h-3" />
                      <span>Saved {formatDate(pitch.savedDate)}</span>
                    </div>
                    {pitch.folder && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3" />
                        <span>{pitch.folder}</span>
                      </div>
                    )}
                    {pitch.lastViewed && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Last viewed {formatDate(pitch.lastViewed)}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/pitch/${pitch.id}`)}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4 mr-1 inline" />
                      View
                    </button>
                    <button className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleRemovePitch(pitch.id)}
                      className="px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List view
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredPitches.map((pitch) => (
                <li key={pitch.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedPitches.includes(pitch.id)}
                      onChange={() => handleSelectPitch(pitch.id)}
                      className="rounded border-gray-300"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <p className="text-lg font-medium text-gray-900">{pitch.title}</p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pitch.status)}`}>
                            {pitch.status.replace('-', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(pitch.priority)}`}>
                            {pitch.priority}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{formatCurrency(pitch.budget)}</span>
                          <span>{formatDate(pitch.savedDate)}</span>
                        </div>
                      </div>
                      
                      <p className="mt-2 text-sm text-gray-600">{pitch.logline}</p>
                      
                      <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          <span>{pitch.creator.name}</span>
                        </div>
                        <div className="flex items-center">
                          <Film className="w-4 h-4 mr-1" />
                          <span>{pitch.genre.join(', ')}</span>
                        </div>
                        {pitch.rating && (
                          <div className="flex items-center">
                            <Star className="w-4 h-4 mr-1 text-yellow-400 fill-current" />
                            <span>{pitch.rating}/5</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/pitch/${pitch.id}`)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleRemovePitch(pitch.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}