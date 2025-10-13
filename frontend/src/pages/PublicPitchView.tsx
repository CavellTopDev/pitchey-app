import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Heart, Share2, Tag, Film, Clock, Calendar, User, Shield, Lock, DollarSign, Briefcase, LogIn, Building2, Wallet } from 'lucide-react';
import { pitchAPI } from '../lib/api';
import type { Pitch } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { ndaAPI } from '../lib/apiServices';
import { ndaService } from '../services/nda.service';
import NDAModal from '../components/NDAModal';
import FormatDisplay from '../components/FormatDisplay';

export default function PublicPitchView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [hasSignedNDA, setHasSignedNDA] = useState(false);
  const [ndaRequestStatus, setNdaRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [isOwner, setIsOwner] = useState(false);
  const [canRequestNDA, setCanRequestNDA] = useState(false);
  const [ndaCheckError, setNdaCheckError] = useState<string | null>(null);
  const [ndaLoading, setNdaLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  // Separate effect for checking NDA status with business rules
  useEffect(() => {
    if (id && pitch && isAuthenticated && user) {
      checkOwnershipAndNDAStatus(parseInt(id));
    }
  }, [id, pitch, isAuthenticated, user]);

  const fetchPitch = async (pitchId: number) => {
    try {
      console.log('Fetching pitch with ID:', pitchId);
      const response = await pitchAPI.getPublicById(pitchId);
      console.log('Fetched pitch data:', response);
      
      // Handle both response formats (direct pitch or wrapped in success/pitch)
      const pitchData = response?.pitch || response;
      
      if (pitchData && pitchData.id) {
        setPitch(pitchData);
        setHasSignedNDA(pitchData.hasSignedNDA || false);
      } else {
        setError('Pitch not found');
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Pitch not found or failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Business rule validation for NDA access
  const validateNDAAccess = (pitch: Pitch, user: any): { canRequest: boolean; reason?: string } => {
    // Rule 1: Users cannot request NDAs for their own pitches
    if (pitch.creatorId === user.id || pitch.creator?.id === user.id) {
      return { canRequest: false, reason: 'Cannot request NDA for your own pitch' };
    }

    // Rule 2: Only investors and production companies can request NDAs
    if (user.userType === 'creator') {
      return { canRequest: false, reason: 'Creators cannot request NDA access to other pitches' };
    }

    // Rule 3: User must be authenticated
    if (!user || !user.id) {
      return { canRequest: false, reason: 'Must be authenticated to request NDA access' };
    }

    // Rule 4: User type must be investor or production
    if (!['investor', 'production'].includes(user.userType)) {
      return { canRequest: false, reason: 'Only investors and production companies can request NDA access' };
    }

    return { canRequest: true };
  };

  // Check ownership and conditionally check NDA status
  const checkOwnershipAndNDAStatus = async (pitchId: number) => {
    setNdaCheckError(null);
    setNdaLoading(true);
    
    try {
      // Check if user owns this pitch
      const userOwnsThisPitch = pitch && user && 
        (pitch.creatorId === user.id || pitch.creator?.id === user.id);
      
      setIsOwner(!!userOwnsThisPitch);

      if (userOwnsThisPitch) {
        console.log('User owns this pitch, skipping NDA status check');
        setHasSignedNDA(true); // Owner has full access
        setCanRequestNDA(false);
        return;
      }

      // Validate if user can request NDA based on business rules
      const validation = validateNDAAccess(pitch!, user!);
      setCanRequestNDA(validation.canRequest);

      if (!validation.canRequest) {
        console.log('User cannot request NDA:', validation.reason);
        return;
      }

      // Only check NDA status if user can potentially request NDAs
      await checkNDAStatus(pitchId);
      
    } catch (error) {
      console.error('Failed to check ownership and NDA status:', error);
      setNdaCheckError('Failed to check access permissions. Please refresh the page.');
    } finally {
      setNdaLoading(false);
    }
  };

  const checkNDAStatus = async (pitchId: number) => {
    console.log('Checking NDA status for pitch:', pitchId);
    const response = await ndaService.getNDAStatus(pitchId);
    
    if (response.error) {
      console.log('NDA status check returned error:', response.error);
      if (response.error.includes('not found') || response.error.includes('Network error')) {
        // Handle expected cases gracefully
        setNdaRequestStatus('none');
        if (response.error.includes('Network error')) {
          setNdaCheckError('Unable to check NDA status. Please try again later.');
        }
      } else {
        setNdaCheckError(response.error);
      }
      return;
    }
    
    if (response.hasNDA && response.nda) {
      console.log('NDA found with status:', response.nda.status);
      setNdaRequestStatus(response.nda.status);
      if (response.nda.status === 'approved') {
        setHasSignedNDA(true);
      }
    } else {
      console.log('No NDA found for this user-pitch combination');
      setNdaRequestStatus('none');
    }
  };

  const handleNDASigned = async () => {
    setNdaRequestStatus('pending');
    // Don't set hasSignedNDA immediately since NDA needs approval first
  };

  const handleNDARequest = async (pitchId: number, requestData: any) => {
    try {
      const response = await ndaAPI.requestNDA(pitchId, requestData);
      if (response && response.success) {
        console.log('NDA request submitted successfully');
        // You might want to show a success message to the user
        return { success: true };
      } else {
        console.error('Failed to submit NDA request:', response?.error);
        return { success: false, error: response?.error || 'Failed to submit request' };
      }
    } catch (error) {
      console.error('Error submitting NDA request:', error);
      return { success: false, error: 'Network error occurred' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !pitch || !pitch.creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error || 'Pitch not found or incomplete data'}</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const isProduction = pitch.creator?.userType === 'production';
  const isInvestor = pitch.creator?.userType === 'investor';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-2 text-gray-600 hover:text-purple-600"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Marketplace
          </button>
          
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                {/* User Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                  {user.userType === 'production' && (
                    <>
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Production Portal</span>
                    </>
                  )}
                  {user.userType === 'investor' && (
                    <>
                      <Wallet className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">Investor Portal</span>
                    </>
                  )}
                  {user.userType === 'creator' && (
                    <>
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Creator Portal</span>
                    </>
                  )}
                  {user.userType === 'production' && (
                    <>
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Production Portal</span>
                    </>
                  )}
                  {user.userType && <span className="text-xs text-gray-500">• {user.companyName || user.username}</span>}
                </div>

                {/* Dashboard Link */}
                <button
                  onClick={() => {
                    const userType = user?.userType || localStorage.getItem('userType');
                    if (userType) {
                      navigate(`/${userType}/dashboard`);
                    } else {
                      navigate('/portals');
                    }
                  }}
                  className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Go to Dashboard
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    logout();
                    localStorage.removeItem('userType');
                    window.location.href = '/portals';
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/portals')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign In for Full Access
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {isProduction && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                        PRODUCTION COMPANY
                      </span>
                    )}
                    {isInvestor && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        INVESTOR
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">{pitch.title}</h1>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
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
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Logline</h3>
                  <p className="text-gray-700">{pitch.logline}</p>
                </div>
                
                {pitch.shortSynopsis && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Synopsis</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Information Section */}
            {/* Show enhanced content if user owns the pitch or has signed NDA */}
            {(isOwner || (hasSignedNDA && isAuthenticated)) ? (
              // Show enhanced content if NDA is signed
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
                      {pitch.budgetBreakdown && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Development: ${pitch.budgetBreakdown.development?.toLocaleString()}</div>
                            <div>Production: ${pitch.budgetBreakdown.production?.toLocaleString()}</div>
                            <div>Post-Production: ${pitch.budgetBreakdown.postProduction?.toLocaleString()}</div>
                            <div>Marketing: ${pitch.budgetBreakdown.marketing?.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
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
                  
                  {/* Media Assets */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {pitch.scriptUrl && (
                      <a href={pitch.scriptUrl} target="_blank" rel="noopener noreferrer" 
                        className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                        <Briefcase className="w-4 h-4" />
                        View Script
                      </a>
                    )}
                    {pitch.lookbookUrl && (
                      <a href={pitch.lookbookUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100">
                        <Briefcase className="w-4 h-4" />
                        View Lookbook
                      </a>
                    )}
                    {pitch.pitchDeckUrl && (
                      <a href={pitch.pitchDeckUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                        <Briefcase className="w-4 h-4" />
                        View Pitch Deck
                      </a>
                    )}
                    {pitch.trailerUrl && (
                      <a href={pitch.trailerUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
                        <Film className="w-4 h-4" />
                        Watch Trailer
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Show NDA required message or access restrictions
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-sm p-6 border-2 border-purple-200">
                <div className="flex items-start space-x-3">
                  <Lock className="w-6 h-6 text-purple-600 mt-1" />
                  <div className="flex-1">
                    {/* Show different messages based on user status */}
                    {isOwner ? (
                      <div className="text-center text-gray-600">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          This is your pitch
                        </h3>
                        <p className="mb-4">You have full access to all information as the creator of this pitch.</p>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Enhanced Information Available
                        </h3>
                        
                        {/* Show loading state while checking NDA status */}
                        {ndaLoading && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              <p className="text-blue-700 text-sm">Checking access permissions...</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Show error message if NDA check failed */}
                        {ndaCheckError && !ndaLoading && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{ndaCheckError}</p>
                            <button 
                              onClick={() => {
                                if (id && pitch) {
                                  checkOwnershipAndNDAStatus(parseInt(id));
                                }
                              }}
                              className="mt-2 text-xs text-red-600 underline hover:text-red-800"
                            >
                              Try again
                            </button>
                          </div>
                        )}
                        
                        <p className="text-gray-700 mb-4">
                          {isProduction 
                            ? "This production company has additional confidential information available including budget details, financing structure, and distribution plans."
                            : isInvestor
                            ? "This investor has proprietary information about funding terms and investment structure."
                            : "Additional project details are available under NDA including full treatment, budget breakdown, and production timeline."}
                        </p>
                      </>
                    )}
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
                    
                    {!isOwner && (
                      <>
                        {isAuthenticated ? (
                          <div className="space-y-3">
                            {/* Show user's portal type and access capability */}
                            {!canRequestNDA ? (
                              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                                <User className="w-4 h-4" />
                                <span>
                                  {user?.userType === 'creator' 
                                    ? 'Creators cannot request NDA access to other pitches'
                                    : 'You cannot request NDA access for this pitch'}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                  {user?.userType === 'production' ? (
                                    <>
                                      <Building2 className="w-4 h-4" />
                                      <span>Signed in as Production Company - Can request access</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wallet className="w-4 h-4" />
                                      <span>Signed in as Investor - Can request access</span>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => setShowNDAModal(true)}
                                  disabled={hasSignedNDA || ndaRequestStatus === 'pending' || ndaRequestStatus === 'rejected' || !canRequestNDA || !!ndaCheckError || ndaLoading}
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                                    hasSignedNDA 
                                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                      : ndaRequestStatus === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                      : ndaRequestStatus === 'rejected'
                                      ? 'bg-red-100 text-red-700 cursor-not-allowed'
                                      : ndaCheckError || ndaLoading
                                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                  }`}
                                >
                                  {ndaLoading ? (
                                    <>
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                                      Checking Access...
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-5 h-5" />
                                      {hasSignedNDA 
                                        ? 'Access Granted - View Enhanced Info Above' 
                                        : ndaRequestStatus === 'pending'
                                        ? 'NDA Request Pending Review'
                                        : ndaRequestStatus === 'rejected'
                                        ? 'NDA Request Rejected'
                                        : ndaCheckError
                                        ? 'Unable to Request Access'
                                        : 'Request NDA Access'}
                                    </>
                                  )}
                                </button>
                                
                                {/* Additional status messages */}
                                {ndaRequestStatus === 'pending' && (
                                  <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded-lg">
                                    Your NDA request is being reviewed by the creator. You'll be notified once approved.
                                  </div>
                                )}
                                {ndaRequestStatus === 'rejected' && (
                                  <div className="mt-2 text-sm text-red-700 bg-red-50 p-2 rounded-lg">
                                    Your NDA request was not approved. You may contact the creator for more information.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate('/portals')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          >
                            <LogIn className="w-5 h-5" />
                            Sign In to Request Access
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Eye className="w-4 h-4" />
                    Views
                  </div>
                  <span className="font-semibold">{pitch.viewCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Heart className="w-4 h-4" />
                    Likes
                  </div>
                  <span className="font-semibold">{pitch.likeCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="w-4 h-4" />
                    NDAs Signed
                  </div>
                  <span className="font-semibold">{pitch.ndaCount || 0}</span>
                </div>
                
                {/* Show access status */}
                {isAuthenticated && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Shield className="w-4 h-4" />
                        Your Access
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isOwner 
                          ? 'bg-blue-100 text-blue-700'
                          : hasSignedNDA
                          ? 'bg-green-100 text-green-700'
                          : ndaRequestStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : ndaRequestStatus === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : canRequestNDA
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {isOwner
                          ? 'Owner'
                          : hasSignedNDA
                          ? 'Full Access'
                          : ndaRequestStatus === 'pending'
                          ? 'Pending'
                          : ndaRequestStatus === 'rejected'
                          ? 'Rejected'
                          : canRequestNDA
                          ? 'Can Request'
                          : 'Limited'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Creator Info */}
            <div className={`rounded-xl shadow-sm p-6 ${
              isProduction ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300' :
              isInvestor ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300' :
              isOwner ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300' :
              'bg-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${
                  isProduction ? 'text-purple-900' :
                  isInvestor ? 'text-green-900' :
                  isOwner ? 'text-blue-900' :
                  'text-gray-900'
                }`}>
                  {isProduction ? 'Production Company' : isInvestor ? 'Investor' : 'Creator'}
                </h3>
                {isOwner && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Your Pitch
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isProduction ? 'bg-purple-200' :
                    isInvestor ? 'bg-green-200' :
                    'bg-gray-100'
                  }`}>
                    {isProduction ? (
                      <Building2 className="w-6 h-6 text-purple-700" />
                    ) : isInvestor ? (
                      <Wallet className="w-6 h-6 text-green-700" />
                    ) : (
                      <User className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className={`font-medium ${
                      isProduction ? 'text-purple-900' :
                      isInvestor ? 'text-green-900' :
                      'text-gray-900'
                    }`}>
                      {pitch.creator?.companyName || pitch.creator?.username || 'Unknown Creator'}
                    </div>
                    <div className="text-sm text-gray-500">@{pitch.creator?.username || 'unknown'}</div>
                    {isProduction && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-purple-600 text-white rounded-full">Production</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full">Verified</span>
                      </div>
                    )}
                    {isInvestor && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">Investor</span>
                        <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Accredited</span>
                      </div>
                    )}
                    {isOwner && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">Creator</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">You</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Listed {new Date(pitch.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {isOwner && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <User className="w-4 h-4" />
                      <span className="font-medium">Your Pitch</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      You have full access to all information and can manage NDA requests.
                    </p>
                  </div>
                )}
                {!isOwner && isProduction && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 mb-3">
                    <div className="flex items-center gap-2 text-sm text-purple-700">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">Production Company Pitch</span>
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      This pitch is from a verified production company looking for financing partners.
                    </p>
                  </div>
                )}
                
                <button 
                  className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <Share2 className="w-4 h-4" />
                  Share Pitch
                </button>
                
                {!isAuthenticated && (
                  <button
                    onClick={() => navigate('/portals')}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Sign In to Request Access
                  </button>
                )}
                
                {isOwner && (
                  <button
                    onClick={() => {
                      const userType = user?.userType || localStorage.getItem('userType');
                      if (userType) {
                        navigate(`/${userType}/dashboard`);
                      } else {
                        navigate('/portals');
                      }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                  >
                    Manage This Pitch
                  </button>
                )}
                
                {!isOwner && isAuthenticated && user?.userType === 'production' && (
                  <button
                    onClick={() => navigate('/production/dashboard')}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                  >
                    Go to Dashboard
                  </button>
                )}
                
                {!isOwner && isAuthenticated && user?.userType === 'investor' && (
                  <button
                    onClick={() => navigate('/investor/dashboard')}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NDA Modal - Only show if user can request NDAs */}
      {pitch && canRequestNDA && !isOwner && (
        <NDAModal
          isOpen={showNDAModal}
          onClose={() => setShowNDAModal(false)}
          pitchId={pitch.id}
          pitchTitle={pitch.title}
          creatorType={pitch.creator?.userType || 'creator'}
          onNDASigned={handleNDASigned}
          onNDARequest={handleNDARequest}
        />
      )}
    </div>
  );
}