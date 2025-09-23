import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, Film, Calendar, MapPin, Eye, Heart, Shield, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api.config';

interface Creator {
  id: number;
  type: 'creator';
  username: string;
  firstName?: string;
  lastName?: string;
  userType: string;
  companyName?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  followedAt: string;
  createdAt: string;
  pitchCount: number;
}

interface Pitch {
  id: number;
  type: 'pitch';
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  status: string;
  createdAt: string;
  publishedAt?: string;
  followedAt: string;
  creator: {
    id: number;
    username: string;
    userType: string;
    companyName?: string;
    profileImage?: string;
  };
}

interface ActivityUpdate {
  id: number;
  type: 'new_pitch';
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  status: string;
  publishedAt: string;
  createdAt: string;
  timeAgo: string;
  creator: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
    userType: string;
    companyName?: string;
    profileImage?: string;
  };
}

const Following: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'activity' | 'creators' | 'pitches'>('activity');
  const [data, setData] = useState<(Creator[] | Pitch[] | ActivityUpdate[])>([]);
  const [summary, setSummary] = useState({
    newPitches: 0,
    activeCreators: 0,
    engagementRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('7d');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFollowingData();
  }, [activeTab]);

  const fetchFollowingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/login/investor');
        return;
      }

      const response = await fetch(`${API_URL}/api/investor/following?tab=${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch following data');
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data || []);
        if (result.summary) {
          setSummary(result.summary);
        }
      } else {
        throw new Error(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error fetching following data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load following data');
      // Set empty data on error
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDisplayName = (creator: any) => {
    if (creator.companyName) return creator.companyName;
    if (creator.firstName) {
      return `${creator.firstName} ${creator.lastName || ''}`.trim();
    }
    return creator.username;
  };

  const renderActivityTab = () => {
    const activities = data as ActivityUpdate[];
    
    return (
      <div className="space-y-6">
        {/* Activity Summary */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Activity Summary</h3>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.newPitches}</div>
              <div className="text-sm text-gray-600">New Pitches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.activeCreators}</div>
              <div className="text-sm text-gray-600">Active Creators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.engagementRate}%</div>
              <div className="text-sm text-gray-600">Engagement Rate</div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No recent activity from followed creators</p>
              <button 
                onClick={() => navigate('/marketplace')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Browse Marketplace →
              </button>
            </div>
          ) : (
            activities.map((update) => (
              <div key={update.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {update.creator.profileImage ? (
                      <img 
                        src={update.creator.profileImage} 
                        alt={getDisplayName(update.creator)}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {getDisplayName(update.creator).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {getDisplayName(update.creator)}
                      </span>
                      <span className="text-gray-500">published a new pitch</span>
                      <span className="text-gray-400 text-sm">• {update.timeAgo}</span>
                    </div>

                    <div 
                      className="cursor-pointer group"
                      onClick={() => navigate(`/pitch/${update.id}`)}
                    >
                      <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                        {update.title}
                      </h4>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {update.logline}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="px-2 py-1 bg-gray-100 rounded-full">
                          {update.genre}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded-full">
                          {update.format}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {update.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {update.likeCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {update.titleImage && (
                    <div className="flex-shrink-0">
                      <img 
                        src={update.titleImage} 
                        alt={update.title}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderCreatorsTab = () => {
    const creators = data as Creator[];
    
    return (
      <div className="space-y-4">
        {creators.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You're not following any creators yet</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Discover Creators
            </button>
          </div>
        ) : (
          creators.map((creator) => (
            <div key={creator.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {creator.profileImage ? (
                    <img 
                      src={creator.profileImage} 
                      alt={getDisplayName(creator)}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-lg">
                        {getDisplayName(creator).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {getDisplayName(creator)}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {creator.userType}
                    </span>
                  </div>
                  
                  {creator.bio && (
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {creator.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {creator.pitchCount} pitches
                    </span>
                    {creator.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {creator.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Following since {formatDate(creator.followedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 space-x-2">
                  <button 
                    onClick={() => navigate(`/creator/${creator.id}`)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Portfolio
                  </button>
                  <button className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                    Unfollow
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderPitchesTab = () => {
    const pitches = data as Pitch[];
    
    return (
      <div className="space-y-4">
        {pitches.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <Film className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You're not following any pitches yet</p>
            <button 
              onClick={() => navigate('/marketplace')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Browse Pitches
            </button>
          </div>
        ) : (
          pitches.map((pitch) => (
            <div key={pitch.id} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {pitch.titleImage ? (
                    <img 
                      src={pitch.titleImage} 
                      alt={pitch.title}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-300 rounded-lg flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {pitch.title.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 
                      className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                      onClick={() => navigate(`/pitch/${pitch.id}`)}
                    >
                      {pitch.title}
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                    {pitch.logline}
                  </p>
                  
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {pitch.genre}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {pitch.format}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>by {getDisplayName(pitch.creator)}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {pitch.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {pitch.likeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {pitch.ndaCount} NDAs
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                    Unfollow
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/investor/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Following</h1>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">
                {summary.activeCreators} active creators
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'activity'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Activity Feed
              </div>
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'creators'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Creators
              </div>
            </button>
            <button
              onClick={() => setActiveTab('pitches')}
              className={`flex-1 py-4 px-6 text-center font-medium transition ${
                activeTab === 'pitches'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Film className="w-4 h-4" />
                Pitches
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'activity' && renderActivityTab()}
        {activeTab === 'creators' && renderCreatorsTab()}
        {activeTab === 'pitches' && renderPitchesTab()}
      </div>
    </div>
  );
};

export default Following;