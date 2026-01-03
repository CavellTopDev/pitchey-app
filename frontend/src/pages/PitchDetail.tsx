import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Eye, Calendar, User, Clock, Tag, Film, Heart, LogIn, FileText, Lock, Shield, Briefcase, DollarSign } from 'lucide-react';
import { pitchService } from '../services/pitch.service';
import type { Pitch } from '../services/pitch.service';
import { useAuthStore } from '../store/authStore';
import BackButton from '../components/BackButton';
import NDAWizard from '../components/NDAWizard';
import EnhancedNDARequest from '../components/NDA/EnhancedNDARequest';
import FormatDisplay from '../components/FormatDisplay';

export default function PitchDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showNDAWizard, setShowNDAWizard] = useState(false);
  const [showEnhancedNDARequest, setShowEnhancedNDARequest] = useState(false);
  const [hasSignedNDA, setHasSignedNDA] = useState(false);
  
  // Check if current user owns this pitch
  // First check the isOwner flag from backend, then fallback to comparing IDs
  // Handle both direct user object and nested user.data structure
  const getUserId = () => {
    if (!user) return null;
    // Check if user has an id directly
    if (user.id !== undefined) return user.id;
    // Check if user is nested in data
    if ((user as any).data?.id !== undefined) return (user as any).data.id;
    // Check if user has user property
    if ((user as any).user?.id !== undefined) return (user as any).user.id;
    return null;
  };
  
  const currentUserId = getUserId();
  
  // Secure owner check - only return true if IDs are valid and match
  const isOwner = (() => {
    // First check the backend-provided isOwner flag (most reliable)
    if (pitch?.isOwner === true) return true;
    
    // If no backend flag, validate IDs manually
    if (!currentUserId || !pitch) return false;
    
    // Check pitch.userId (ensure both IDs are valid numbers)
    if (pitch.userId) {
      const pitchUserId = Number(pitch.userId);
      const currentUserIdNum = Number(currentUserId);
      
      // Only return true if both are valid numbers and match
      if (!isNaN(pitchUserId) && !isNaN(currentUserIdNum) && pitchUserId === currentUserIdNum) {
        return true;
      }
    }
    
    // Check pitch.creator.id (ensure both IDs are valid numbers)
    if (pitch.creator?.id) {
      const creatorId = Number(pitch.creator.id);
      const currentUserIdNum = Number(currentUserId);
      
      // Only return true if both are valid numbers and match
      if (!isNaN(creatorId) && !isNaN(currentUserIdNum) && creatorId === currentUserIdNum) {
        return true;
      }
    }
    
    // Default to false for security
    return false;
  })();
  
  // Debug logging to see what's being compared
  useEffect(() => {
    if (pitch && user) {
    }
  }, [pitch, user, currentUserId, isOwner]);

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  const fetchPitch = async (pitchId: number) => {
    try {
      const pitch = await pitchService.getById(pitchId);
      setPitch(pitch);
      setHasSignedNDA(pitch.hasNDA || false);
      setIsLiked(pitch.isLiked || false);
      
      // Track view for analytics (only if not the owner)
      if (!pitch.isOwner) {
        await pitchService.trackView(pitchId);
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          setError(`Pitch #${pitchId} not found. It may have been removed or you may not have permission to view it.`);
        } else if (error.message.includes('403')) {
          setError('You do not have permission to view this pitch. Please log in or contact the owner.');
        } else if (error.message.includes('401')) {
          setError('Please log in to view this pitch.');
        } else {
          setError(`Failed to load pitch: ${error.message}`);
        }
      } else {
        setError('Pitch not found or failed to load');
      }
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
        await pitchService.unlikePitch(pitch.id);
      } else {
        setPitch(prev => prev ? { ...prev, likeCount: prev.likeCount + 1 } : null);
        setIsLiked(true);
        await pitchService.likePitch(pitch.id);
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
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">{pitch.title}</h1>
                  {pitch.seekingInvestment && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      💰 Seeking Investment
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>By</span>
                  <span 
                    className="hover:text-purple-600 cursor-pointer font-medium"
                    onClick={() => navigate(`/creator/${pitch.creator?.id}`)}
                  >
                    {pitch.creator?.name || pitch.creator?.username || 'Unknown Creator'}
                  </span>
                  <span>•</span>
                  <span>{pitch.genre}</span>
                  <span>•</span>
                  <FormatDisplay 
                    formatCategory={pitch.formatCategory}
                    formatSubtype={pitch.formatSubtype}
                    format={pitch.format}
                    variant="compact"
                  />
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
                  {!hasSignedNDA && !isOwner && (
                    <button
                      onClick={() => setShowEnhancedNDARequest(true)}
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
                      <FormatDisplay 
                        formatCategory={pitch.formatCategory}
                        formatSubtype={pitch.formatSubtype}
                        format={pitch.format}
                        variant="compact"
                      />
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
            {!hasSignedNDA && !isOwner ? (
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
                      onClick={() => setShowEnhancedNDARequest(true)}
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
                    <div className="text-gray-500">{pitch.creator?.name || pitch.creator?.username || 'Unknown'}</div>
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
                    {isOwner ? (
                      // Owner-specific actions
                      <>
                        <button
                          onClick={() => navigate(`/creator/pitches/${id}/edit`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                          Edit Pitch
                        </button>
                        <button
                          onClick={() => navigate(`/creator/pitches/${id}/analytics`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="20" x2="12" y2="10"/>
                            <line x1="18" y1="20" x2="18" y2="4"/>
                            <line x1="6" y1="20" x2="6" y2="16"/>
                          </svg>
                          View Analytics
                        </button>
                      </>
                    ) : (
                      // Viewer actions (non-owner)
                      <button
                        onClick={() => setShowEnhancedNDARequest(true)}
                        disabled={hasSignedNDA}
                        className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                          hasSignedNDA 
                            ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        {hasSignedNDA ? 'NDA Signed' : 'Request NDA Access'}
                      </button>
                    )}
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

      {/* Enhanced NDA Request Modal */}
      {pitch && (
        <EnhancedNDARequest
          isOpen={showEnhancedNDARequest}
          onClose={() => setShowEnhancedNDARequest(false)}
          pitchId={pitch.id}
          pitchTitle={pitch.title}
          creatorName={pitch.creator?.username || pitch.creator?.companyName || 'Creator'}
          creatorType={pitch.creator?.userType || 'creator'}
          onSuccess={handleNDASigned}
        />
      )}

      {/* Legacy NDA Wizard (backup) */}
      {pitch && (
        <NDAWizard
          isOpen={showNDAWizard}
          onClose={() => setShowNDAWizard(false)}
          pitchId={pitch.id}
          pitchTitle={pitch.title}
          creatorName={pitch.creator?.username || pitch.creator?.companyName || 'Creator'}
          onStatusChange={handleNDASigned}
        />
      )}
    </div>
  );
}