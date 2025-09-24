import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Eye, Calendar, User, Clock, Tag, Film, Heart, LogIn, FileText, Lock, Shield, Briefcase, DollarSign } from 'lucide-react';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import BackButton from '../components/BackButton';
import NDAModal from '../components/NDAModal';

export default function PitchDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [hasSignedNDA, setHasSignedNDA] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  const fetchPitch = async (pitchId: number) => {
    try {
      const pitch = await pitchAPI.getById(pitchId);
      setPitch(pitch);
      setHasSignedNDA(pitch.hasSignedNDA || false);
      
      // Record view if authenticated
      if (isAuthenticated) {
        try {
          await pitchAPI.recordView(pitchId);
        } catch (error) {
          // Silently fail view recording
          console.log('Failed to record view:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Pitch not found or failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!pitch || isLiking || !isAuthenticated) return;
    
    setIsLiking(true);
    const originalLiked = isLiked;
    const originalCount = pitch.likeCount;
    
    try {
      // Toggle like state optimistically
      if (isLiked) {
        setPitch(prev => prev ? { ...prev, likeCount: prev.likeCount - 1 } : null);
        setIsLiked(false);
        await pitchAPI.unlike(pitch.id);
      } else {
        setPitch(prev => prev ? { ...prev, likeCount: prev.likeCount + 1 } : null);
        setIsLiked(true);
        await pitchAPI.like(pitch.id);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      setIsLiked(originalLiked);
      setPitch(prev => prev ? { 
        ...prev, 
        likeCount: originalCount 
      } : null);
    } finally {
      setIsLiking(false);
    }
  };

  const handleNDASigned = () => {
    setHasSignedNDA(true);
    // Refresh pitch data to get enhanced information
    if (id) {
      fetchPitch(parseInt(id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <BackButton />
              <h1 className="text-2xl font-bold text-gray-900">Pitch Not Found</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{pitch.title}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>By</span>
                  <span 
                    className="hover:text-purple-600 cursor-pointer font-medium"
                    onClick={() => navigate(`/creator/${pitch.creator?.id}`)}
                  >
                    {pitch.creator?.username || 'Unknown Creator'}
                  </span>
                  <span>•</span>
                  <span>{pitch.genre}</span>
                  <span>•</span>
                  <span>{pitch.format}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!isAuthenticated ? (
                <button
                  onClick={() => navigate('/portals')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Interact
                </button>
              ) : (
                <>
                  {!hasSignedNDA && user?.userType !== 'creator' && (
                    <button
                      onClick={() => setShowNDAModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Shield className="w-4 h-4" />
                      Request Enhanced Access
                    </button>
                  )}
                  {hasSignedNDA && (
                    <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                      <Shield className="w-4 h-4" />
                      NDA Signed
                    </span>
                  )}
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{pitch.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {pitch.genre}
                    </div>
                    <div className="flex items-center gap-1">
                      <Film className="w-4 h-4" />
                      {pitch.format}
                    </div>
                  </div>
                </div>
                {pitch.status === 'published' && (
                  <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700">
                    Published
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Logline</h3>
                  <p className="text-gray-700">{pitch.logline}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Synopsis</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                </div>
              </div>
            </div>

            {/* Enhanced Information - NDA Protected */}
            {!hasSignedNDA && user?.userType !== 'creator' ? (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-sm p-6 border-2 border-blue-200">
                <div className="flex items-start space-x-3">
                  <Lock className="w-6 h-6 text-blue-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Enhanced Information Available
                    </h3>
                    <p className="text-gray-700 mb-4">
                      {pitch.creator?.userType === 'production' 
                        ? "This production company has additional confidential information available including budget details, financing structure, and distribution plans."
                        : pitch.creator?.userType === 'investor'
                        ? "This investor has proprietary information about funding terms and investment structure."
                        : "Additional project details are available under NDA including full treatment, budget breakdown, and production timeline."}
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 mb-4">
                      <li className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        Budget & Financial Projections
                      </li>
                      <li className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        Production Timeline & Milestones
                      </li>
                      <li className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        Attached Talent & Key Crew
                      </li>
                      <li className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-400" />
                        Distribution Strategy & Comparables
                      </li>
                    </ul>
                    <button
                      onClick={() => setShowNDAModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Shield className="w-5 h-5" />
                      Request Access
                    </button>
                  </div>
                </div>
              </div>
            ) : hasSignedNDA ? (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Enhanced Information</h3>
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    <Shield className="w-3 h-3" />
                    NDA Protected
                  </span>
                </div>
                <div className="space-y-4">
                  {pitch.budget && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Budget</h4>
                      <p className="text-gray-700">{pitch.budget}</p>
                    </div>
                  )}
                  {pitch.targetAudience && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Target Audience</h4>
                      <p className="text-gray-700">{pitch.targetAudience}</p>
                    </div>
                  )}
                  {pitch.comparableTitles && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Comparable Titles</h4>
                      <p className="text-gray-700">{pitch.comparableTitles}</p>
                    </div>
                  )}
                  {pitch.productionTimeline && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Production Timeline</h4>
                      <p className="text-gray-700">{pitch.productionTimeline}</p>
                    </div>
                  )}
                  {pitch.attachedTalent && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Attached Talent</h4>
                      <p className="text-gray-700">{pitch.attachedTalent}</p>
                    </div>
                  )}
                  {pitch.distributionStrategy && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Distribution Strategy</h4>
                      <p className="text-gray-700">{pitch.distributionStrategy}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Media */}
            {(pitch.titleImage || pitch.scriptUrl || pitch.trailerUrl) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Media & Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pitch.titleImage && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Cover Image</h4>
                      <img 
                        src={pitch.titleImage} 
                        alt="Pitch cover" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {pitch.scriptUrl && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Script</h4>
                      <a 
                        href={pitch.scriptUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
                      >
                        <User className="w-4 h-4" />
                        View Script
                      </a>
                    </div>
                  )}
                  {pitch.trailerUrl && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Trailer</h4>
                      <a 
                        href={pitch.trailerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
                      >
                        <Film className="w-4 h-4" />
                        Watch Trailer
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Eye className="w-4 h-4" />
                    Views
                  </div>
                  <span className="font-semibold">{pitch.viewCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Heart className="w-4 h-4" />
                    Likes
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{pitch.likeCount}</span>
                    {isAuthenticated ? (
                      <button
                        onClick={handleLike}
                        disabled={isLiking}
                        className={`p-1 rounded-full transition ${
                          isLiked 
                            ? 'text-red-500 hover:text-red-600' 
                            : 'text-gray-400 hover:text-red-500'
                        } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Heart 
                          className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} 
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/portals')}
                        className="p-1 rounded-full text-gray-300 hover:text-purple-500 transition"
                        title="Sign in to like"
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Project Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Creator</div>
                    <div className="text-gray-500">{pitch.creator?.username || 'Unknown'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Published</div>
                    <div className="text-gray-500">{new Date(pitch.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {isAuthenticated ? (
                  <>
                    <button
                      onClick={() => setShowNDAModal(true)}
                      disabled={hasSignedNDA}
                      className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        hasSignedNDA 
                          ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      {hasSignedNDA ? 'NDA Signed' : 'Sign NDA'}
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <Share2 className="w-4 h-4" />
                      Share Pitch
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigate('/portals')}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In to Interact
                    </button>
                    <button className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      <Share2 className="w-4 h-4" />
                      Share Pitch
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NDA Modal */}
      {pitch && (
        <NDAModal
          isOpen={showNDAModal}
          onClose={() => setShowNDAModal(false)}
          pitchId={pitch.id}
          pitchTitle={pitch.title}
          creatorType={pitch.creator?.userType || 'creator'}
          onNDASigned={handleNDASigned}
        />
      )}
    </div>
  );
}