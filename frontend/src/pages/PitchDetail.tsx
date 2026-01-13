import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Eye, Calendar, User, Clock, Tag, Film, Heart, LogIn, FileText, Lock, Shield, Briefcase, DollarSign } from 'lucide-react';
import { pitchService } from '../services/pitch.service';
import { createDownloadClickHandler } from '../utils/fileDownloads';
import type { Pitch } from '../services/pitch.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import BackButton from '../components/BackButton';
import NDAWizard from '../components/NDAWizard';
import EnhancedNDARequest from '../components/NDA/EnhancedNDARequest';
import FormatDisplay from '../components/FormatDisplay';

export default function PitchDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useBetterAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showNDAWizard, setShowNDAWizard] = useState(false);
  const [showEnhancedNDARequest, setShowEnhancedNDARequest] = useState(false);
  const [hasSignedNDA, setHasSignedNDA] = useState(false);
  
  // Debug: Track renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  // Debug: Log all state changes
  useEffect(() => {
    console.log('🔄 [PitchDetail] Render #', renderCount.current);
    console.log('🔄 [PitchDetail] Current state:', {
      pitch: pitch?.id ? `${pitch.id}: ${pitch.title}` : null,
      hasSignedNDA,
      isAuthenticated,
      isOwner,
      hasProtectedContent: !!pitch?.protectedContent,
      protectedContentKeys: pitch?.protectedContent ? Object.keys(pitch.protectedContent) : []
    });
  });
  
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
  }, [id, isAuthenticated]);

  const hasValidSession = (): boolean => {
    // Check if the user is authenticated via Better Auth
    const validAuth = isAuthenticated && user && (user.id || user.data?.id || user.user?.id);
    
    console.log('🔐 [PitchDetail] Authentication check details:', {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id || user?.data?.id || user?.user?.id,
      validAuth
    });
    
    return !!validAuth;
  };

  const fetchPitch = async (pitchId: number) => {
    try {
      const validAuth = hasValidSession();
      console.log('📡 [PitchDetail] Calling endpoint with isAuthenticated:', isAuthenticated);
      console.log('📡 [PitchDetail] hasValidSession:', validAuth);
      console.log('📡 [PitchDetail] User object:', user);
      
      // Use authenticated endpoint if user has valid session, otherwise use public
      const endpoint = validAuth ? `/api/pitches/${pitchId}` : `/api/pitches/public/${pitchId}`;
      console.log('📡 [PitchDetail] Selected endpoint:', endpoint);
      
      const pitch = validAuth 
        ? await pitchService.getByIdAuthenticated(pitchId)
        : await pitchService.getById(pitchId);
      
      console.log('🔍 [PitchDetail] Raw API Response:', pitch);
      console.log('🔍 [PitchDetail] isAuthenticated:', isAuthenticated);
      console.log('🔍 [PitchDetail] hasSignedNDA from API:', pitch.hasSignedNDA);
      console.log('🔍 [PitchDetail] hasNDA from API:', pitch.hasNDA);
      console.log('🔍 [PitchDetail] protectedContent from API:', pitch.protectedContent);
      console.log('🔍 [PitchDetail] isOwner from API:', pitch.isOwner);
      
      // Check if protected content fields are present (indicates NDA access)
      const hasProtectedFields = !!(
        pitch.budget_breakdown ||
        pitch.attached_talent ||
        pitch.financial_projections ||
        pitch.distribution_plan ||
        pitch.marketing_strategy ||
        pitch.private_attachments ||
        pitch.contact_details ||
        pitch.revenue_model
      );
      
      console.log('🔍 [PitchDetail] Checking for protected content fields:');
      console.log('🔍 [PitchDetail] budget_breakdown:', !!pitch.budget_breakdown);
      console.log('🔍 [PitchDetail] attached_talent:', !!pitch.attached_talent);
      console.log('🔍 [PitchDetail] financial_projections:', !!pitch.financial_projections);
      console.log('🔍 [PitchDetail] distribution_plan:', !!pitch.distribution_plan);
      console.log('🔍 [PitchDetail] marketing_strategy:', !!pitch.marketing_strategy);
      console.log('🔍 [PitchDetail] private_attachments:', !!pitch.private_attachments);
      console.log('🔍 [PitchDetail] contact_details:', !!pitch.contact_details);
      console.log('🔍 [PitchDetail] revenue_model:', !!pitch.revenue_model);
      console.log('🔍 [PitchDetail] hasProtectedFields:', hasProtectedFields);
      
      // If protected fields are present, wrap them in protectedContent structure that frontend expects
      if (hasProtectedFields) {
        pitch.protectedContent = {
          budgetBreakdown: pitch.budget_breakdown,
          attachedTalent: pitch.attached_talent,
          financialProjections: pitch.financial_projections,
          distributionPlan: pitch.distribution_plan,
          marketingStrategy: pitch.marketing_strategy,
          privateAttachments: pitch.private_attachments,
          contactDetails: pitch.contact_details,
          revenueModel: pitch.revenue_model,
          productionTimeline: pitch.production_timeline
        };
        console.log('🎉 [PitchDetail] Created protectedContent wrapper:', pitch.protectedContent);
      }
      
      setPitch(pitch);
      const ndaStatus = pitch.hasSignedNDA || pitch.hasNDA || hasProtectedFields;
      console.log('🔍 [PitchDetail] Setting hasSignedNDA to:', ndaStatus);
      setHasSignedNDA(ndaStatus);
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
    console.log('✅ [PitchDetail] NDA signed callback triggered');
    
    // Immediately update state to trigger UI updates
    setHasSignedNDA(true);
    
    // Clear any existing error state
    setError(null);
    
    // Refresh pitch data to get enhanced information
    if (id) {
      console.log('🔄 [PitchDetail] Refreshing pitch data after NDA signing...');
      
      // Add a small delay to ensure the backend has processed the NDA
      setTimeout(() => {
        fetchPitch(parseInt(id));
      }, 500);
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
            ) : (hasSignedNDA || isOwner) && pitch?.protectedContent ? (
              (() => {
                console.log('🎉 [PitchDetail] RENDERING PROTECTED CONTENT!');
                console.log('🎉 [PitchDetail] hasSignedNDA:', hasSignedNDA);
                console.log('🎉 [PitchDetail] pitch.protectedContent:', pitch.protectedContent);
                return null;
              })(),
              <div key={`protected-${hasSignedNDA}-${pitch?.id}`} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Enhanced Information</h3>
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    <Shield className="w-3 h-3" />
                    NDA Protected
                  </span>
                </div>
                <div className="space-y-4">
                  {(() => {
                    console.log('🔍 [ProtectedContent] Debugging individual field conditions:');
                    console.log('🔍 [ProtectedContent] pitch.protectedContent:', pitch.protectedContent);
                    console.log('🔍 [ProtectedContent] budgetBreakdown exists:', !!pitch.protectedContent?.budgetBreakdown);
                    console.log('🔍 [ProtectedContent] productionTimeline exists:', !!pitch.protectedContent?.productionTimeline);
                    console.log('🔍 [ProtectedContent] attachedTalent exists:', !!pitch.protectedContent?.attachedTalent);
                    console.log('🔍 [ProtectedContent] financialProjections exists:', !!pitch.protectedContent?.financialProjections);
                    console.log('🔍 [ProtectedContent] distributionPlan exists:', !!pitch.protectedContent?.distributionPlan);
                    console.log('🔍 [ProtectedContent] marketingStrategy exists:', !!pitch.protectedContent?.marketingStrategy);
                    console.log('🔍 [ProtectedContent] revenueModel exists:', !!pitch.protectedContent?.revenueModel);
                    console.log('🔍 [ProtectedContent] privateAttachments exists:', !!pitch.protectedContent?.privateAttachments);
                    console.log('🔍 [ProtectedContent] contactDetails exists:', !!pitch.protectedContent?.contactDetails);
                    return null;
                  })()}
                  
                  {/* Budget Breakdown with improved null checks */}
                  {pitch.protectedContent?.budgetBreakdown && 
                   typeof pitch.protectedContent.budgetBreakdown === 'object' && 
                   pitch.protectedContent.budgetBreakdown !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Budget Breakdown</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.budgetBreakdown.total && (
                          <p className="text-sm font-semibold">
                            Total Budget: ${Number(pitch.protectedContent.budgetBreakdown.total).toLocaleString()}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {pitch.protectedContent.budgetBreakdown.production && (
                            <div className="text-sm text-gray-600">
                              Production: ${Number(pitch.protectedContent.budgetBreakdown.production).toLocaleString()}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.marketing && (
                            <div className="text-sm text-gray-600">
                              Marketing: ${Number(pitch.protectedContent.budgetBreakdown.marketing).toLocaleString()}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.distribution && (
                            <div className="text-sm text-gray-600">
                              Distribution: ${Number(pitch.protectedContent.budgetBreakdown.distribution).toLocaleString()}
                            </div>
                          )}
                          {pitch.protectedContent.budgetBreakdown.contingency && (
                            <div className="text-sm text-gray-600">
                              Contingency: ${Number(pitch.protectedContent.budgetBreakdown.contingency).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Production Timeline with improved null checks */}
                  {pitch.protectedContent?.productionTimeline && 
                   typeof pitch.protectedContent.productionTimeline === 'string' && 
                   pitch.protectedContent.productionTimeline.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Production Timeline</h4>
                      <p className="text-gray-700 whitespace-pre-line">{pitch.protectedContent.productionTimeline}</p>
                    </div>
                  )}
                  
                  {/* Attached Talent with improved null checks */}
                  {pitch.protectedContent?.attachedTalent && 
                   Array.isArray(pitch.protectedContent.attachedTalent) && 
                   pitch.protectedContent.attachedTalent.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Attached Talent</h4>
                      <div className="space-y-2">
                        {pitch.protectedContent.attachedTalent.map((talent, index) => (
                          <div key={index} className="bg-gray-50 p-2 rounded">
                            <p className="text-sm font-semibold">{talent?.role}: {talent?.name}</p>
                            {talent?.notable_works && Array.isArray(talent.notable_works) && (
                              <p className="text-xs text-gray-600">Notable: {talent.notable_works.join(', ')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Financial Projections with improved null checks */}
                  {pitch.protectedContent?.financialProjections && 
                   typeof pitch.protectedContent.financialProjections === 'object' && 
                   pitch.protectedContent.financialProjections !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Financial Projections</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.financialProjections.roi && (
                          <p className="text-sm font-semibold">ROI: {pitch.protectedContent.financialProjections.roi}%</p>
                        )}
                        {pitch.protectedContent.financialProjections.break_even_months && (
                          <p className="text-sm text-gray-600">
                            Break-even: {pitch.protectedContent.financialProjections.break_even_months} months
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Distribution Plan with improved null checks */}
                  {pitch.protectedContent?.distributionPlan && 
                   typeof pitch.protectedContent.distributionPlan === 'string' && 
                   pitch.protectedContent.distributionPlan.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Distribution Plan</h4>
                      <p className="text-gray-700">{pitch.protectedContent.distributionPlan}</p>
                    </div>
                  )}
                  
                  {/* Marketing Strategy with improved null checks */}
                  {pitch.protectedContent?.marketingStrategy && 
                   typeof pitch.protectedContent.marketingStrategy === 'string' && 
                   pitch.protectedContent.marketingStrategy.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Marketing Strategy</h4>
                      <p className="text-gray-700">{pitch.protectedContent.marketingStrategy}</p>
                    </div>
                  )}
                  
                  {/* Revenue Model with improved null checks */}
                  {pitch.protectedContent?.revenueModel && 
                   typeof pitch.protectedContent.revenueModel === 'string' && 
                   pitch.protectedContent.revenueModel.trim().length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Revenue Model</h4>
                      <p className="text-gray-700">{pitch.protectedContent.revenueModel}</p>
                    </div>
                  )}
                  
                  {/* Private Attachments with improved null checks */}
                  {pitch.protectedContent?.privateAttachments && 
                   Array.isArray(pitch.protectedContent.privateAttachments) && 
                   pitch.protectedContent.privateAttachments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Private Documents</h4>
                      <div className="space-y-2">
                        {pitch.protectedContent.privateAttachments.map((doc, index) => (
                          <button 
                            key={index} 
                            onClick={createDownloadClickHandler(doc?.url, doc?.name)}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm hover:underline cursor-pointer border-none bg-transparent p-0"
                          >
                            <FileText className="w-4 h-4" />
                            {doc?.name || `Document ${index + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Contact Details with improved null checks */}
                  {pitch.protectedContent?.contactDetails && 
                   typeof pitch.protectedContent.contactDetails === 'object' && 
                   pitch.protectedContent.contactDetails !== null && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Contact Information</h4>
                      <div className="bg-gray-50 p-3 rounded">
                        {pitch.protectedContent.contactDetails.producer && (
                          <div className="mb-2">
                            <p className="text-sm font-semibold">Producer</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.producer.name}</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.producer.email}</p>
                          </div>
                        )}
                        {pitch.protectedContent.contactDetails.agent && (
                          <div>
                            <p className="text-sm font-semibold">Agent</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.agent.name}</p>
                            <p className="text-sm text-gray-600">{pitch.protectedContent.contactDetails.agent.agency}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback message if no protected content is available */}
                  {Object.keys(pitch.protectedContent || {}).length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        No enhanced information is currently available for this pitch. 
                        The creator may not have added protected content yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Fallback: Show message if user has signed NDA but no protected content is available
              (hasSignedNDA || isOwner) && !pitch?.protectedContent ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-yellow-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                        Enhanced Information Unavailable
                      </h3>
                      <p className="text-yellow-700 text-sm">
                        This pitch doesn't have additional protected content available at this time.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null
            )}

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