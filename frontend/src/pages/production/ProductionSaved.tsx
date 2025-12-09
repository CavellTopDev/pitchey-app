import React, { useState, useEffect } from 'react';
import DashboardHeader from '../../components/DashboardHeader';
import { 
  Star, Filter, Search, Calendar, Clock, 
  MoreVertical, Eye, MessageSquare, FileText,
  Bookmark, BookmarkCheck, TrendingUp, Film
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { pitchService } from '../../services/pitch.service';

interface SavedPitch {
  id: number;
  title: string;
  creator: string;
  genre: string;
  format: string;
  savedDate: string;
  pitchDate: string;
  status: string;
  thumbnail: string;
  views: number;
  rating: number;
  hasNDA: boolean;
  notes?: string;
}

export default function ProductionSaved() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenre, setFilterGenre] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedPitches();
  }, [filterGenre, sortBy]);

  const fetchSavedPitches = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockPitches: SavedPitch[] = [
        {
          id: 1,
          title: 'Cosmic Odyssey',
          creator: 'Alex Thompson',
          genre: 'Sci-Fi',
          format: 'Feature Film',
          savedDate: '2024-12-05',
          pitchDate: '2024-11-20',
          status: 'Under Review',
          thumbnail: 'https://picsum.photos/400/300?random=1',
          views: 1250,
          rating: 4.8,
          hasNDA: true,
          notes: 'High potential for Q2 2025 production slate'
        },
        {
          id: 2,
          title: 'Urban Legends',
          creator: 'Maria Garcia',
          genre: 'Horror',
          format: 'TV Series',
          savedDate: '2024-12-03',
          pitchDate: '2024-11-15',
          status: 'Shortlisted',
          thumbnail: 'https://picsum.photos/400/300?random=2',
          views: 980,
          rating: 4.6,
          hasNDA: false
        },
        {
          id: 3,
          title: 'The Last Signal',
          creator: 'James Chen',
          genre: 'Thriller',
          format: 'Limited Series',
          savedDate: '2024-12-01',
          pitchDate: '2024-11-10',
          status: 'Reviewing',
          thumbnail: 'https://picsum.photos/400/300?random=3',
          views: 750,
          rating: 4.5,
          hasNDA: true,
          notes: 'Strong script, needs budget review'
        },
        {
          id: 4,
          title: 'Quantum Dreams',
          creator: 'Sophie Laurent',
          genre: 'Sci-Fi',
          format: 'Feature Film',
          savedDate: '2024-11-28',
          pitchDate: '2024-11-01',
          status: 'Under Consideration',
          thumbnail: 'https://picsum.photos/400/300?random=4',
          views: 2100,
          rating: 4.9,
          hasNDA: true
        },
        {
          id: 5,
          title: 'Shadow Protocol',
          creator: 'David Kim',
          genre: 'Action',
          format: 'Feature Film',
          savedDate: '2024-11-25',
          pitchDate: '2024-10-20',
          status: 'Reviewing',
          thumbnail: 'https://picsum.photos/400/300?random=5',
          views: 1800,
          rating: 4.7,
          hasNDA: false
        }
      ];
      
      setSavedPitches(mockPitches);
    } catch (error) {
      console.error('Error fetching saved pitches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPitches = savedPitches.filter(pitch => {
    const matchesSearch = pitch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pitch.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = filterGenre === 'all' || pitch.genre === filterGenre;
    return matchesSearch && matchesGenre;
  });

  const handleRemoveSaved = async (pitchId: number) => {
    try {
      // API call to remove from saved
      setSavedPitches(prev => prev.filter(p => p.id !== pitchId));
    } catch (error) {
      console.error('Error removing saved pitch:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} userType="production" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Saved Pitches</h1>
            <p className="text-gray-600 mt-1">Your bookmarked pitches for future consideration</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {filteredPitches.length} saved pitches
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search saved pitches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={filterGenre}
            onChange={(e) => setFilterGenre(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="all">All Genres</option>
            <option value="Action">Action</option>
            <option value="Comedy">Comedy</option>
            <option value="Drama">Drama</option>
            <option value="Horror">Horror</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Thriller">Thriller</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white"
          >
            <option value="recent">Recently Saved</option>
            <option value="rating">Highest Rated</option>
            <option value="views">Most Viewed</option>
            <option value="newest">Newest Pitches</option>
          </select>
        </div>

        {/* Saved Pitches Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredPitches.length === 0 ? (
          <Card className="p-12 text-center">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved pitches</h3>
            <p className="text-gray-600 mb-6">Start browsing and save pitches you're interested in</p>
            <Button 
              onClick={() => navigate('/marketplace')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Browse Pitches
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <Card key={pitch.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                <div 
                  className="relative h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${pitch.thumbnail})` }}
                  onClick={() => navigate(`/production/pitch/${pitch.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-white/90 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSaved(pitch.id);
                      }}
                    >
                      <BookmarkCheck className="w-4 h-4 text-purple-600" />
                    </Button>
                  </div>
                  {pitch.hasNDA && (
                    <div className="absolute top-3 left-3 bg-purple-600 text-white px-2 py-1 rounded text-xs">
                      NDA Protected
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-lg mb-1">{pitch.title}</h3>
                    <p className="text-white/90 text-sm">by {pitch.creator}</p>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs mr-2">
                        {pitch.genre}
                      </span>
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {pitch.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-semibold">{pitch.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {pitch.views.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Saved {new Date(pitch.savedDate).toLocaleDateString()}
                    </span>
                  </div>

                  {pitch.notes && (
                    <div className="p-2 bg-yellow-50 rounded text-sm text-gray-700 mb-3">
                      <span className="font-medium">Note:</span> {pitch.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      pitch.status === 'Shortlisted' 
                        ? 'bg-green-100 text-green-700'
                        : pitch.status === 'Under Review'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {pitch.status}
                    </span>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/messages?pitch=${pitch.id}`);
                        }}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle more options
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Categories Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="w-5 h-5" />
              Saved by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">12</div>
                <div className="text-sm text-gray-600">Feature Films</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">8</div>
                <div className="text-sm text-gray-600">TV Series</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">5</div>
                <div className="text-sm text-gray-600">Web Series</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">3</div>
                <div className="text-sm text-gray-600">Documentaries</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}