import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, TrendingUp, Search, Play, Star, Eye, Heart, Calendar, ArrowRight, Sparkles, User, Building2, Wallet } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '../services/pitch.service';
import { getGenresSync, getFormatsSync } from '../constants/pitchConstants';
import FormatDisplay from '../components/FormatDisplay';


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
      // Fetch trending and new releases from dedicated endpoints
      const [trending, newReleases] = await Promise.all([
        pitchService.getTrendingPitches(4),
        pitchService.getNewReleases(4)
      ]);
      
      setTrendingPitches(trending);
      setNewReleases(newReleases);
    } catch (error) {
      console.error('Failed to fetch from dedicated endpoints, using fallback:', error);
      // Fallback to public endpoint if dedicated endpoints fail
      try {
        const { pitches } = await pitchService.getPublicPitches();
        
        // Sort by views for trending - top 4 most viewed
        const trending = [...pitches].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4);
        setTrendingPitches(trending);
        
        // Sort by creation date for new releases - 4 most recent
        const newOnes = [...pitches].sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        ).slice(0, 4);
        setNewReleases(newOnes);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setTrendingPitches([]);
        setNewReleases([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const genres = ['All', ...getGenresSync()];
  const formats = ['All', ...getFormatsSync()];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-purple-50 to-white">
      {/* Navigation Header */}
      <header className="bg-white backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <a href="/" className="text-2xl font-bold text-purple-600">Pitchey</a>
              <nav className="hidden md:flex items-center gap-6">
                <button 
                  onClick={() => navigate('/marketplace')}
                  className="text-nav-link hover:text-purple-600 transition"
                >
                  Browse Pitches
                </button>
                <button 
                  onClick={() => navigate('/how-it-works')}
                  className="text-nav-link hover:text-purple-600 transition"
                >
                  How It Works
                </button>
                <button 
                  onClick={() => navigate('/about')}
                  className="text-nav-link hover:text-purple-600 transition"
                >
                  About
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
                    className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/portals')}
                    className="text-button px-4 py-2 text-purple-600 hover:text-purple-700 transition"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/portals')}
                    className="text-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
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
      <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 text-white">
        {/* Enhanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-900/40 via-purple-800/30 to-fuchsia-900/40"></div>
        
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="1" fill="white" className="animate-pulse" />
                <circle cx="25" cy="25" r="0.5" fill="white" className="animate-pulse-slow" />
                <circle cx="75" cy="75" r="0.5" fill="white" className="animate-pulse-slow" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        {/* Film Reel Decorations */}
        <div className="absolute top-10 left-10 opacity-20 animate-float">
          <Film className="w-24 h-24 text-white" />
        </div>
        <div className="absolute bottom-10 right-10 opacity-20 animate-float-delayed">
          <Film className="w-32 h-32 text-white" />
        </div>
        <div className="absolute top-1/2 left-20 opacity-15 animate-float-slow">
          <Sparkles className="w-16 h-16 text-white" />
        </div>
        <div className="absolute top-1/3 right-20 opacity-15 animate-float-slow-delayed">
          <Star className="w-20 h-20 text-white" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg animate-fade-in">
              Where Stories
              <span className="bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300"> Find Life</span>
            </h1>
            <p className="text-xl md:text-2xl mb-12 max-w-3xl mx-auto opacity-90 drop-shadow animate-fade-in-delay">
              The premier marketplace where pitching meets opportunity. 
              Share your vision, discover original stories, and connect with producers and investors shaping the future of film, television, and new media.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <form className="flex bg-white rounded-lg shadow-lg overflow-hidden">
                <input
                  type="text"
                  placeholder="Search pitches by title, genre, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-6 py-4 text-gray-900 focus:outline-none"
                />
                <button 
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/marketplace?search=${searchQuery}`);
                  }}
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/portals')}
                className="text-button px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-xl hover:bg-white/20 transition transform hover:scale-105"
              >
                <Sparkles className="inline w-5 h-5 mr-2" />
                Start Your Journey
              </button>
              <button
                onClick={() => navigate('/marketplace')}
                className="text-button px-8 py-4 bg-white text-purple-600 rounded-xl hover:bg-gray-100 transition transform hover:scale-105 shadow-lg"
              >
                <Play className="inline w-5 h-5 mr-2" />
                Browse Pitches
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* Trending Pitches */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-section-title mb-2">
                <TrendingUp className="inline w-8 h-8 text-purple-600 mr-2" />
                Trending Now
              </h2>
              <p className="text-body">The hottest pitches gaining momentum</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-nav-link text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
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
                      <FormatDisplay 
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="subtype-only"
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-card-title mb-1 group-hover:text-purple-600 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-metadata text-purple-600 mb-2">{pitch.genre}</p>
                    <p className="text-metadata mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-metadata">
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
              <h2 className="text-section-title mb-2">
                <Sparkles className="inline w-8 h-8 text-yellow-600 mr-2" />
                New Releases
              </h2>
              <p className="text-body">Fresh content just added to the platform</p>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-nav-link text-purple-600 hover:text-purple-700 transition flex items-center gap-2"
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
                      <FormatDisplay 
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="subtype-only"
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-card-title text-black mb-1 group-hover:text-purple-600 transition">
                      {pitch.title}
                    </h3>
                    <p className="text-metadata text-gray-600 mb-2">{pitch.genre}</p>
                    <p className="text-metadata text-gray-700 mb-3 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-metadata text-gray-600">
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


      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-section-title mb-6">Ready For Your Close Up?</h2>
          <p className="text-body mb-8 mx-auto">
            Join thousands of creators, investors, and production companies shaping the future of entertainment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/portals')}
              className="text-button px-8 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
            >
              Create Your First Pitch
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-button px-8 py-4 bg-transparent border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 transition"
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
              <p className="text-metadata">
                Connecting stories with opportunities since 2025.
              </p>
            </div>
            <div>
              <h3 className="text-card-title mb-4">For Creators</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/portals')} className="text-metadata hover:text-purple-600 transition">Submit Pitch</button></li>
                <li><button className="text-metadata hover:text-purple-600 transition">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-card-title mb-4">Browse</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/marketplace')} className="text-metadata hover:text-purple-600 transition">Browse Pitches</button></li>
                <li><button className="text-metadata hover:text-purple-600 transition">Format</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-card-title mb-4">Company</h3>
              <ul className="space-y-2">
                <li><button onClick={() => navigate('/about')} className="text-metadata hover:text-purple-600 transition">About</button></li>
                <li><button onClick={() => navigate('/contact')} className="text-metadata hover:text-purple-600 transition">Contact</button></li>
                <li><button onClick={() => navigate('/terms')} className="text-metadata hover:text-purple-600 transition">Terms</button></li>
                <li><button onClick={() => navigate('/privacy')} className="text-metadata hover:text-purple-600 transition">Privacy</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <p className="text-metadata">© 2024 Pitchey. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}