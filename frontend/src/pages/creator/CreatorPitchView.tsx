import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Eye, Heart, Share2, Edit, Trash2, BarChart3, 
  Shield, MessageSquare, Clock, Calendar, User, Tag, 
  Film, DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Lock, Unlock
} from 'lucide-react';
import { pitchAPI } from '../../lib/api';

interface Pitch {
  id: string;
  userId: string;
  title: string;
  logline: string;
  genre: string;
  format: string;
  pages?: number;
  shortSynopsis: string;
  longSynopsis?: string;
  budget: string;
  estimatedBudget?: string;
  productionTimeline?: string;
  targetAudience?: string;
  comparableFilms?: string;
  status: 'draft' | 'published' | 'in_review' | 'optioned' | 'produced';
  visibility: 'public' | 'private' | 'nda_only';
  views: number;
  likes: number;
  createdAt: string;
  updatedAt: string;
  hasSignedNDA?: boolean;
  ndaCount?: number;
  thumbnail?: string;
  pitchDeck?: string;
  script?: string;
  trailer?: string;
}

interface Analytics {
  totalViews: number;
  uniqueViews: number;
  avgViewTime: string;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topReferrers: Array<{ source: string; count: number }>;
  viewsByDay: Array<{ date: string; views: number }>;
}

interface NDARequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterCompany?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  message?: string;
}

const CreatorPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'ndas' | 'feedback'>('overview');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPitchData();
      checkOwnership();
    }
  }, [id]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      // Fetch pitch details
      const response = await pitchAPI.getById(parseInt(id!));
      setPitch(response);
      
      // Fetch analytics if owner
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.id === response.userId) {
        const analyticsData = await pitchAPI.getAnalytics(parseInt(id!));
        setAnalytics(analyticsData);
        
        const ndaData = await pitchAPI.getNDARequests(parseInt(id!));
        setNdaRequests(ndaData);
      }
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch details');
    } finally {
      setLoading(false);
    }
  };

  const checkOwnership = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setIsOwner(pitch?.userId === user.id);
  };

  const handleEdit = () => {
    navigate(`/creator/pitches/${id}/edit`);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this pitch? This action cannot be undone.')) {
      try {
        await pitchAPI.delete(parseInt(id!));
        navigate('/creator/pitches');
      } catch (error) {
        console.error('Failed to delete pitch:', error);
      }
    }
  };

  const handleVisibilityToggle = async () => {
    if (!pitch) return;
    
    const newVisibility = pitch.visibility === 'public' ? 'private' : 'public';
    try {
      await pitchAPI.updateVisibility(parseInt(id!), newVisibility);
      setPitch({ ...pitch, visibility: newVisibility });
    } catch (error) {
      console.error('Failed to update visibility:', error);
    }
  };

  const handleNDAAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      await pitchAPI.handleNDARequest(parseInt(id!), requestId, action);
      setNdaRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, status: action === 'approve' ? 'approved' : 'rejected' }
            : req
        )
      );
    } catch (error) {
      console.error('Failed to handle NDA request:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
            <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
            <button
              onClick={() => navigate('/creator/pitches')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to My Pitches
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/creator/pitches')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to My Pitches
            </button>
            
            {isOwner && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleVisibilityToggle}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    pitch.visibility === 'public' 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pitch.visibility === 'public' ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  {pitch.visibility === 'public' ? 'Public' : 'Private'}
                </button>
                
                <button
                  onClick={handleEdit}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                
                <button
                  onClick={handleDelete}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pitch Details */}
          <div className="lg:col-span-2">
            {/* Tabs for Owner */}
            {isOwner && (
              <div className="bg-white rounded-xl shadow-lg mb-6">
                <div className="flex border-b">
                  {['overview', 'analytics', 'ndas', 'feedback'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                        activeTab === tab
                          ? 'text-purple-600 border-b-2 border-purple-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab === 'ndas' ? 'NDAs' : tab}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                {pitch.thumbnail && (
                  <img 
                    src={pitch.thumbnail} 
                    alt={pitch.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{pitch.title}</h1>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {pitch.format}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {pitch.status}
                  </span>
                </div>

                <p className="text-xl text-gray-700 mb-6 italic">"{pitch.logline}"</p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Synopsis</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>
                  
                  {pitch.longSynopsis && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Synopsis</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{pitch.longSynopsis}</p>
                    </div>
                  )}
                  
                  {pitch.comparableFilms && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Films</h3>
                      <p className="text-gray-700">{pitch.comparableFilms}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && isOwner && analytics && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h2>
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">{analytics.totalViews}</div>
                    <div className="text-sm text-gray-600">Total Views</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{analytics.uniqueViews}</div>
                    <div className="text-sm text-gray-600">Unique Views</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{analytics.avgViewTime}</div>
                    <div className="text-sm text-gray-600">Avg. View Time</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">{analytics.viewsToday}</div>
                    <div className="text-sm text-gray-600">Views Today</div>
                  </div>
                  <div className="bg-pink-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-pink-600">{analytics.viewsThisWeek}</div>
                    <div className="text-sm text-gray-600">This Week</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-indigo-600">{analytics.viewsThisMonth}</div>
                    <div className="text-sm text-gray-600">This Month</div>
                  </div>
                </div>

                {/* Top Referrers */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
                  <div className="space-y-2">
                    {analytics.topReferrers.map((referrer, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b">
                        <span className="text-gray-700">{referrer.source}</span>
                        <span className="text-gray-500">{referrer.count} views</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ndas' && isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">NDA Requests</h2>
                
                {ndaRequests.length > 0 ? (
                  <div className="space-y-4">
                    {ndaRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{request.requesterName}</h4>
                            {request.requesterCompany && (
                              <p className="text-sm text-gray-600">{request.requesterCompany}</p>
                            )}
                            {request.message && (
                              <p className="text-sm text-gray-700 mt-2">{request.message}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Requested {new Date(request.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                          
                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleNDAAction(request.id, 'approve')}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleNDAAction(request.id, 'reject')}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          
                          {request.status !== 'pending' && (
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              request.status === 'approved' 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {request.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No NDA requests yet</p>
                )}
              </div>
            )}

            {activeTab === 'feedback' && isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Feedback & Comments</h2>
                <p className="text-gray-500">Coming soon...</p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Eye className="h-4 w-4 mr-2" />
                    Views
                  </span>
                  <span className="font-semibold">{pitch.views}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Heart className="h-4 w-4 mr-2" />
                    Likes
                  </span>
                  <span className="font-semibold">{pitch.likes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Shield className="h-4 w-4 mr-2" />
                    NDAs
                  </span>
                  <span className="font-semibold">{pitch.ndaCount || 0}</span>
                </div>
              </div>
            </div>

            {/* Production Details */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 text-sm">Budget</span>
                  <p className="font-semibold">{pitch.budget}</p>
                </div>
                {pitch.productionTimeline && (
                  <div>
                    <span className="text-gray-600 text-sm">Timeline</span>
                    <p className="font-semibold">{pitch.productionTimeline}</p>
                  </div>
                )}
                {pitch.targetAudience && (
                  <div>
                    <span className="text-gray-600 text-sm">Target Audience</span>
                    <p className="font-semibold">{pitch.targetAudience}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            {(pitch.pitchDeck || pitch.script || pitch.trailer) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h3>
                <div className="space-y-2">
                  {pitch.pitchDeck && (
                    <a
                      href={pitch.pitchDeck}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Pitch Deck
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {pitch.script && (
                    <a
                      href={pitch.script}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Script
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {pitch.trailer && (
                    <a
                      href={pitch.trailer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <Film className="h-4 w-4 mr-2" />
                        Trailer
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Share Options */}
            {isOwner && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Share</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorPitchView;