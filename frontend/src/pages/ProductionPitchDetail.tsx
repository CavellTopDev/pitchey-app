import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Eye, Heart, Shield, Users, Film, 
  Calendar, DollarSign, Download, Play, Share2,
  Edit, BarChart3, FileText, BookOpen, Video,
  Clock, CheckCircle, X, Maximize2, Star, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import PitchMediaGallery from '../components/PitchMediaGallery';
import { API_URL } from '../config/api.config';

interface PitchDetails {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis: string;
  longSynopsis: string;
  budget: string;
  estimatedBudget?: number;
  productionTimeline?: string;
  targetReleaseDate?: string;
  targetAudience?: string;
  comparableTitles?: string;
  characters?: Array<{
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
  }>;
  themes?: string[];
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  followersCount: number;
  status: string;
  createdAt: string;
  publishedAt?: string;
  titleImage?: string;
  mediaFiles?: Array<{
    id: string;
    type: string;
    url: string;
    title: string;
    description?: string;
    uploadedAt: string;
    size?: string;
    requiresNDA?: boolean;
  }>;
  analytics?: {
    dailyViews: Array<{ date: string; views: number }>;
    topViewers: Array<{ name: string; company?: string; type: string }>;
    engagementRate: number;
  };
}

export default function ProductionPitchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [pitch, setPitch] = useState<PitchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'analytics' | 'engagement'>('overview');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchPitchDetails();
  }, [id]);

  const fetchPitchDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch from real API first
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/api/pitches/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPitch(data);
          return;
        }
      } catch (apiError) {
        console.error('Failed to fetch from API:', apiError);
      }
      
      // Fallback mock data for demonstration
      const mockPitch: PitchDetails = {
        id: parseInt(id || '1'),
        title: "The Last Horizon",
        logline: "A space exploration thriller about humanity's final mission to find a new home.",
        genre: "Sci-Fi",
        format: "Feature Film",
        shortSynopsis: "In 2157, Earth's resources are depleted. The starship Horizon carries humanity's last hope - a crew of scientists searching for a habitable planet. When they discover a world that seems perfect, they must confront an ancient alien presence that challenges everything they believe about survival and sacrifice.",
        longSynopsis: "The year is 2157. Earth is dying. Climate collapse, resource depletion, and endless wars have reduced humanity to scattered settlements struggling to survive. The United Earth Coalition pools its remaining resources for one final mission: The Horizon Project.\n\nCaptain Sarah Chen leads a crew of Earth's brightest minds on the starship Horizon, humanity's most advanced vessel. Their mission: find a new home before Earth becomes uninhabitable. After three years of searching, they discover Kepler-442b, a planet that seems perfect - breathable atmosphere, water, and no signs of intelligent life.\n\nBut as they begin establishing a colony, strange things occur. Equipment malfunctions in specific patterns. Crew members experience shared dreams. Ancient structures emerge from beneath the planet's surface. They realize they're not alone.\n\nThe planet is home to an ancient consciousness - not quite alive, not quite artificial intelligence. It has waited millennia for visitors, and now it presents humanity with a choice: merge with it to achieve a form of immortality, or remain human and eventually face extinction.\n\nAs the crew divides into factions, Captain Chen must make an impossible decision that will determine not just humanity's survival, but its very nature. The film explores themes of identity, sacrifice, and what it truly means to be human when survival demands evolution.",
        budget: "$45M",
        estimatedBudget: 45000000,
        productionTimeline: "Pre-production: 3 months, Principal Photography: 4 months, Post-production: 8 months, Total: 15 months",
        targetReleaseDate: "2025-12-25",
        targetAudience: "Primary: Sci-fi enthusiasts aged 18-45, Secondary: General thriller and action audiences. International appeal with focus on North America, Europe, and Asia-Pacific markets.",
        comparableTitles: "Interstellar ($677M worldwide), The Martian ($630M worldwide), Arrival ($203M worldwide), Ad Astra ($127M worldwide)",
        characters: [
          {
            name: "Captain Sarah Chen",
            description: "A brilliant astronaut and leader haunted by leaving her daughter on Earth. Must balance crew survival with humanity's future.",
            age: "42",
            gender: "Female",
            actor: "Consideration: Sandra Oh, Gemma Chan"
          },
          {
            name: "Dr. Marcus Williams",
            description: "Chief scientist who becomes obsessed with understanding the alien consciousness. His curiosity threatens the mission.",
            age: "38",
            gender: "Male",
            actor: "Consideration: John Boyega, Oscar Isaac"
          },
          {
            name: "The Consciousness",
            description: "An ancient entity that exists as pure information, manifesting through the planet's ecosystem. Neither benevolent nor malevolent.",
            age: "Unknown",
            gender: "Non-binary",
            actor: "Voice: Tilda Swinton (in talks)"
          }
        ],
        themes: ["Survival", "Identity", "Evolution", "Sacrifice", "Hope", "Isolation", "First Contact"],
        viewCount: 456,
        likeCount: 89,
        ndaCount: 12,
        followersCount: 234,
        status: "published",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        publishedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        titleImage: "https://via.placeholder.com/1920x1080/4F46E5/ffffff?text=The+Last+Horizon",
        mediaFiles: [
          {
            id: "1",
            type: "lookbook",
            url: "/lookbook-last-horizon.pdf",
            title: "Visual Style Guide & Concept Art",
            description: "120-page comprehensive visual guide including concept art, location designs, creature designs, and cinematography references",
            uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            size: "45.3 MB",
            requiresNDA: false
          },
          {
            id: "2",
            type: "script",
            url: "/script-last-horizon.pdf",
            title: "Full Screenplay - Draft 3.2",
            description: "Complete 118-page screenplay with director's notes and alternate ending",
            uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            size: "2.8 MB",
            requiresNDA: true
          },
          {
            id: "3",
            type: "trailer",
            url: "/trailers/last-horizon-trailer.mp4",
            title: "Concept Trailer / Sizzle Reel",
            description: "3-minute concept trailer with VFX previsualization and mood references",
            uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            size: "Video",
            requiresNDA: false
          },
          {
            id: "4",
            type: "pitch_deck",
            url: "/pitch-deck-last-horizon.pdf",
            title: "Investor Pitch Presentation",
            description: "35-slide comprehensive pitch deck with market analysis, financial projections, and distribution strategy",
            uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            size: "12.7 MB",
            requiresNDA: false
          },
          {
            id: "5",
            type: "budget_breakdown",
            url: "/budget-last-horizon.xlsx",
            title: "Detailed Budget Breakdown",
            description: "Complete line-item budget with contingencies, tax incentives, and financing structure",
            uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            size: "1.4 MB",
            requiresNDA: true
          },
          {
            id: "6",
            type: "production_timeline",
            url: "/timeline-last-horizon.pdf",
            title: "Production Schedule & Milestones",
            description: "Gantt chart with key milestones, department schedules, and delivery timeline",
            uploadedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            size: "3.2 MB",
            requiresNDA: true
          },
          {
            id: "7",
            type: "other",
            url: "/music-samples.zip",
            title: "Composer's Music Samples",
            description: "Sample tracks and themes from attached composer",
            uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            size: "28.5 MB",
            requiresNDA: false
          },
          {
            id: "8",
            type: "other",
            url: "/vfx-breakdown.pdf",
            title: "VFX Breakdown & Budget",
            description: "Detailed VFX shot list with complexity ratings and cost estimates",
            uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            size: "8.9 MB",
            requiresNDA: true
          }
        ],
        analytics: {
          dailyViews: [
            { date: '2024-01-15', views: 45 },
            { date: '2024-01-16', views: 67 },
            { date: '2024-01-17', views: 89 },
            { date: '2024-01-18', views: 72 },
            { date: '2024-01-19', views: 93 },
            { date: '2024-01-20', views: 58 },
            { date: '2024-01-21', views: 32 }
          ],
          topViewers: [
            { name: 'Netflix', company: 'Netflix Studios', type: 'production' },
            { name: 'Warner Bros', company: 'Warner Bros Pictures', type: 'production' },
            { name: 'A24', company: 'A24 Films', type: 'production' },
            { name: 'Silver Screen Ventures', company: 'SSV', type: 'investor' }
          ],
          engagementRate: 18.5
        }
      };
      
      setPitch(mockPitch);
    } catch (error) {
      console.error('Failed to fetch pitch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrailer = (url: string) => {
    setSelectedVideo(url);
    setShowVideoPlayer(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Pitch Not Found</h2>
          <p className="text-gray-600 mb-4">The pitch you're looking for doesn't exist.</p>
          <Link to="/production/dashboard" className="text-purple-600 hover:text-purple-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/production/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{pitch.title}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span>{pitch.genre}</span>
                  <span>•</span>
                  <span>{pitch.format}</span>
                  <span>•</span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {pitch.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                to={`/pitch/${pitch.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                Edit Pitch
              </Link>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.viewCount}</p>
                <p className="text-xs text-gray-600">Total Views</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.likeCount}</p>
                <p className="text-xs text-gray-600">Likes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.ndaCount}</p>
                <p className="text-xs text-gray-600">NDAs Signed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.followersCount}</p>
                <p className="text-xs text-gray-600">Followers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pitch.analytics?.engagementRate}%</p>
                <p className="text-xs text-gray-600">Engagement Rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'media'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Media & Documents ({pitch.mediaFiles?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('engagement')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'engagement'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Engagement
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title Image */}
              {pitch.titleImage && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden relative">
                  <img 
                    src={pitch.titleImage} 
                    alt={pitch.title}
                    className="w-full aspect-video object-cover"
                  />
                  {pitch.mediaFiles?.find(m => m.type === 'trailer') && (
                    <button
                      onClick={() => handlePlayTrailer(pitch.mediaFiles?.find(m => m.type === 'trailer')?.url || '')}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 group hover:bg-black/50 transition-colors"
                    >
                      <div className="p-4 bg-white/90 rounded-full group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-purple-600" />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Logline */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Logline</h2>
                <p className="text-gray-700 leading-relaxed">{pitch.logline}</p>
              </div>

              {/* Synopsis */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Synopsis</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Short Synopsis</h3>
                    <p className="text-gray-700 leading-relaxed">{pitch.shortSynopsis}</p>
                  </div>
                  {pitch.longSynopsis && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Full Synopsis</h3>
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {pitch.longSynopsis}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Characters */}
              {pitch.characters && pitch.characters.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Main Characters</h2>
                  <div className="space-y-4">
                    {pitch.characters.map((character, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{character.name}</h3>
                          {character.actor && (
                            <span className="text-sm text-purple-600 font-medium">{character.actor}</span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{character.description}</p>
                        <div className="flex gap-4 text-sm text-gray-600">
                          {character.age && <span>Age: {character.age}</span>}
                          {character.gender && <span>Gender: {character.gender}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Production Info */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-600">Budget</dt>
                    <dd className="font-semibold text-gray-900">{pitch.budget}</dd>
                  </div>
                  {pitch.productionTimeline && (
                    <div>
                      <dt className="text-sm text-gray-600">Production Timeline</dt>
                      <dd className="text-gray-900">{pitch.productionTimeline}</dd>
                    </div>
                  )}
                  {pitch.targetReleaseDate && (
                    <div>
                      <dt className="text-sm text-gray-600">Target Release</dt>
                      <dd className="text-gray-900">
                        {new Date(pitch.targetReleaseDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Market Info */}
              {(pitch.targetAudience || pitch.comparableTitles) && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Analysis</h2>
                  <div className="space-y-4">
                    {pitch.targetAudience && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Target Audience</h3>
                        <p className="text-gray-900 text-sm">{pitch.targetAudience}</p>
                      </div>
                    )}
                    {pitch.comparableTitles && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-600 mb-2">Comparable Titles</h3>
                        <p className="text-gray-900 text-sm">{pitch.comparableTitles}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Themes */}
              {pitch.themes && pitch.themes.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Themes</h2>
                  <div className="flex flex-wrap gap-2">
                    {pitch.themes.map(theme => (
                      <span
                        key={theme}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <button className="w-full py-2 px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-left flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download All Materials
                  </button>
                  <button className="w-full py-2 px-4 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-left flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Generate Share Link
                  </button>
                  <Link
                    to={`/pitch/${pitch.id}/analytics`}
                    className="w-full py-2 px-4 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-left flex items-center gap-2 block"
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Media Files & Documents</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Some files require NDA</span>
                </div>
              </div>
              
              {pitch.mediaFiles && (
                <PitchMediaGallery
                  mediaItems={pitch.mediaFiles.map(file => ({
                    ...file,
                    type: file.type as any
                  }))}
                  hasNDAAccess={true} // Since it's their own pitch
                  titleImage={pitch.titleImage}
                  showTitleImage={false}
                  onView={(item) => {
                    if (item.type === 'trailer') {
                      handlePlayTrailer(item.url);
                    } else {
                      window.open(item.url, '_blank');
                    }
                  }}
                  onDownload={(item) => {
                    // In production, this would trigger a download
                    console.log('Downloading:', item);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* View Trends */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">View Trends (Last 7 Days)</h2>
                <div className="h-64 flex items-end justify-between gap-2">
                  {pitch.analytics?.dailyViews.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-purple-500 rounded-t"
                        style={{ height: `${(day.views / 100) * 200}px` }}
                      />
                      <span className="text-xs text-gray-600 mt-2">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-xs font-semibold">{day.views}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Viewers */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Viewers</h2>
                <div className="space-y-3">
                  {pitch.analytics?.topViewers.map((viewer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{viewer.name}</p>
                        <p className="text-sm text-gray-600">{viewer.company}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        viewer.type === 'production' ? 'bg-purple-100 text-purple-700' :
                        viewer.type === 'investor' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {viewer.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Engagement Metrics */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h2>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-3xl font-bold text-purple-600">{pitch.analytics?.engagementRate}%</p>
                  <p className="text-sm text-gray-600 mt-1">Engagement Rate</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">3:45</p>
                  <p className="text-sm text-gray-600 mt-1">Avg. View Time</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">67%</p>
                  <p className="text-sm text-gray-600 mt-1">Complete Views</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">23</p>
                  <p className="text-sm text-gray-600 mt-1">Repeat Viewers</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Netflix Studios</span> signed an NDA
                    </p>
                    <p className="text-sm text-gray-600">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Heart className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Warner Bros</span> liked your pitch
                    </p>
                    <p className="text-sm text-gray-600">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">A24 Films</span> started following
                    </p>
                    <p className="text-sm text-gray-600">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">
                      <span className="font-medium">Silver Screen Ventures</span> viewed your pitch
                    </p>
                    <p className="text-sm text-gray-600">2 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVideoPlayer(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowVideoPlayer(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="bg-black rounded-lg overflow-hidden">
              {/* For demo purposes, showing a placeholder video message */}
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white p-8">
                  <Play className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                  <h3 className="text-xl font-semibold mb-2">Video Player</h3>
                  <p className="text-gray-400 mb-4">
                    In production, your trailer would play here.
                  </p>
                  <p className="text-sm text-gray-500">
                    Video URL: {selectedVideo}
                  </p>
                </div>
              </div>
              {/* Actual video element (uncomment when you have real video files) */}
              {/* <video 
                controls 
                autoPlay 
                className="w-full max-h-[80vh]"
                src={selectedVideo}
                onError={(e) => {
                  console.error('Video playback error:', e);
                  alert('Unable to play video. Please check the file format.');
                }}
              >
                Your browser does not support the video tag.
              </video> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}