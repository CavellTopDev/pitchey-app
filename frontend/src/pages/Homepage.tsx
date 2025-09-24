import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, TrendingUp, Search, Play, Star, Eye, Heart, Calendar, ArrowRight, Sparkles, User, Building2, Wallet } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config/api.config';

interface Pitch {
  id: number;
  title: string;
  genre: string;
  format: string;
  logline: string;
  viewCount: number;
  likeCount: number;
  status: string;
  createdAt: string;
}

export default function Homepage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const userType = localStorage.getItem('userType');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [trendingPitches, setTrendingPitches] = useState<Pitch[]>([]);
  const [newReleases, setNewReleases] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPitches();
  }, []);

  const fetchPitches = async () => {
    try {
      // Fetch from public endpoint (no auth required)
      const response = await fetch(`${API_URL}/api/public/pitches`);
      if (response.ok) {
        const data = await response.json();
        const pitches = data.pitches || [];
        
        // Sort by views for trending - top 4 most viewed
        const trending = [...pitches].sort((a, b) => b.viewCount - a.viewCount).slice(0, 4);
        setTrendingPitches(trending);
        
        // Sort by creation date for new releases - 4 most recent
        const newOnes = [...pitches].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 4);
        setNewReleases(newOnes);
      }
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
    } finally {
      setLoading(false);
    }
  };

  const genres = ['All', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller', 'Horror', 'Romance'];
  const formats = ['All', 'Feature Film', 'TV Series', 'Short Film', 'Web Series', 'Documentary'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-purple-50 to-white">
      {/* Navigation Header */}
      <header className="bg-white backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <img src="/pitcheylogo.png" alt="Pitchey Logo" className="h-8 w-auto object-contain" />
                <span className="text-2xl font-bold text-gray-900">Pitchey</span>
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="text-gray-600 hover:text-purple-600 transition"
                >
                  Browse Pitches
                </button>
                <button 
                  onClick={() => navigate('/how-it-works')}
                  className="text-gray-600 hover:text-purple-600 transition"
                >
                  How It Works
                </button>
                <button className="text-gray-300 hover:text-white transition">
                  Success Stories
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  {/* User Status Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                    {userType === 'production' && (
                      <>
                        <Building2 className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-gray-700">Production</span>
                      </>
                    )}
                    {userType === 'investor' && (
                      <>
                        <Wallet className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-gray-700">Investor</span>
                      </>
                    )}
                    {userType === 'creator' && (
                      <>
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-700">Creator</span>
                      </>
                    )}
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-sm text-gray-900">{user.username}</span>
                  </div>
                  
                  {/* Dashboard Button */}
                  <button
                    onClick={() => navigate(`/${userType}/dashboard`)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/portals')}
                    className="px-4 py-2 text-purple-600 hover:text-purple-700 transition"
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

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 to-pink-100/30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6">
              Where Stories
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600"> Find Life</span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
              The premier marketplace connecting visionary creators with investors and production companies. 
              Pitch your next blockbuster, discover untold stories, or fund the future of entertainment.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search pitches by title, genre, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm"
                />
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/portals')}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:shadow-purple-500/30 transition transform hover:scale-105"
              >
                <Sparkles className="inline w-5 h-5 mr-2" />
                Start Your Journey
              </button>
              <button
                onClick={() => navigate('/marketplace')}
                className="px-8 py-4 bg-white border-2 border-purple-600 text-purple-600 text-lg font-semibold rounded-xl hover:bg-purple-50 transition"
              >
                <Play className="inline w-5 h-5 mr-2" />
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">500+</div>
              <div className="text-gray-600">Active Pitches</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-pink-600 mb-2">$2.5M</div>
              <div className="text-gray-600">Funded Projects</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">150+</div>
              <div className="text-gray-600">Production Companies</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">89%</div>
              <div className="text-gray-600">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Pitches */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                <TrendingUp className="inline w-8 h-8 text-purple-600 mr-2" />
                Trending Now
              </h2>
              <p className="text-gray-600">The hottest pitches gaining momentum</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingPitches.map((pitch) => (
                <div
                  key={pitch.id}
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-md transition cursor-pointer group"
                >
                  <div className="h-40 bg-gradient-to-br from-purple-100 to-pink-100 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-16 h-16 text-purple-200" />
                    </div>
                    <div className="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs text-white">
                      {pitch.format}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-sm text-purple-600 mb-2">{pitch.genre}</p>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {pitch.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {pitch.likeCount}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(pitch.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* New Releases */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                <Sparkles className="inline w-8 h-8 text-yellow-600 mr-2" />
                New Releases
              </h2>
              <p className="text-gray-600">Fresh content just added to the platform</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {newReleases.map((pitch) => (
                <div
                  key={pitch.id}
                  onClick={() => navigate(`/pitch/${pitch.id}`)}
                  className="bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-yellow-500/20 hover:border-yellow-500/40 transition cursor-pointer group"
                >
                  <div className="h-40 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-16 h-16 text-purple-200" />
                    </div>
                    <div className="absolute top-2 left-2 bg-yellow-500/80 backdrop-blur-md px-2 py-1 rounded text-xs text-white">
                      NEW
                    </div>
                    <div className="absolute top-2 right-2 bg-purple-600 px-2 py-1 rounded text-xs text-white">
                      {pitch.format}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1 group-hover:text-yellow-400 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-sm text-yellow-400 mb-2">{pitch.genre}</p>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {pitch.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {pitch.likeCount}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(pitch.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Explore by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {genres.slice(1).map((genre) => (
              <button
                key={genre}
                onClick={() => {
                  setSelectedGenre(genre);
                  navigate('/marketplace');
                }}
                className="p-6 bg-white rounded-xl border border-gray-200 hover:border-purple-400 hover:shadow-lg transition text-center group"
              >
                <div className="text-xl font-semibold text-gray-900 group-hover:text-purple-600 transition">
                  {genre}
                </div>
                <div className="text-sm text-gray-500 mt-1">24 pitches</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Ready to Make Your Mark?</h2>
          <p className="text-xl text-gray-700 mb-8">
            Join thousands of creators, investors, and production companies shaping the future of entertainment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/portals')}
              className="px-8 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition"
            >
              Create Your First Pitch
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-4 bg-transparent border-2 border-purple-600 text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition"
            >
              Browse Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Film className="w-6 h-6 text-purple-600" />
                <span className="text-xl font-bold text-gray-900">Pitchey</span>
              </div>
              <p className="text-gray-600 text-sm">
                Connecting stories with opportunities since 2024.
              </p>
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold mb-4">For Creators</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li><button onClick={() => navigate('/portals')} className="hover:text-purple-600 transition">Submit Pitch</button></li>
                <li><button className="hover:text-purple-600 transition">Success Stories</button></li>
                <li><button className="hover:text-purple-600 transition">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold mb-4">For Investors</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li><button onClick={() => navigate('/marketplace')} className="hover:text-purple-600 transition">Browse Pitches</button></li>
                <li><button className="hover:text-purple-600 transition">Investment Guide</button></li>
                <li><button className="hover:text-purple-600 transition">Portfolio</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-600 text-sm">
                <li><button className="hover:text-purple-600 transition">About</button></li>
                <li><button className="hover:text-purple-600 transition">Contact</button></li>
                <li><button className="hover:text-purple-600 transition">Terms & Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-600 text-sm">
            © 2024 Pitchey. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}