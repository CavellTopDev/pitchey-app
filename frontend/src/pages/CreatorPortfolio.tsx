import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

interface Creator {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  userType: string;
  companyName?: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  createdAt: string;
}

interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  characters?: any[];
  themes?: string[];
  budgetBracket?: string;
  titleImage?: string;
  lookbookUrl?: string;
  pitchDeckUrl?: string;
  trailerUrl?: string;
  additionalMedia?: any[];
  visibilitySettings: {
    showShortSynopsis: boolean;
    showCharacters: boolean;
    showBudget: boolean;
    showMedia: boolean;
  };
  status: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
}

interface PortfolioResponse {
  success: boolean;
  creator: Creator;
  pitches: Pitch[];
  stats: {
    totalPitches: number;
    totalDrafts: number;
    totalViews: number;
    totalLikes: number;
    totalNdas: number;
  };
  socialStats: {
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  isOwner: boolean;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  insights: {
    genreDistribution: Array<{ genre: string; count: number }>;
    recentActivity: Array<{ date: string; count: number }>;
  };
}

const CreatorPortfolio: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'published' | 'draft' | 'all'>('published');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (creatorId) {
      fetchPortfolio();
    }
  }, [creatorId, activeView]);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/follows/portfolio/${creatorId}?status=${activeView}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio');
      }

      const data: PortfolioResponse = await response.json();
      setPortfolio(data);
      setIsFollowing(data.isFollowing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }

    setFollowLoading(true);

    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const url = isFollowing 
        ? `/api/follows/follow?creatorId=${creatorId}`
        : '/api/follows/follow';
      
      const body = isFollowing ? undefined : JSON.stringify({ creatorId: parseInt(creatorId!) });

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }

      setIsFollowing(!isFollowing);
      
      // Update follower count in portfolio
      if (portfolio) {
        setPortfolio({
          ...portfolio,
          socialStats: {
            ...portfolio.socialStats,
            followers: portfolio.socialStats.followers + (isFollowing ? -1 : 1),
          },
        });
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const getDisplayName = (creator: Creator) => {
    if (creator.companyName) return creator.companyName;
    if (creator.firstName) {
      return `${creator.firstName} ${creator.lastName || ''}`.trim();
    }
    return creator.username;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-6xl mx-auto px-4">
            <div className="animate-pulse">
              <div className="bg-white rounded-lg p-8 mb-8">
                <div className="flex items-center space-x-6 mb-6">
                  <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !portfolio) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-6xl mx-auto px-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error || 'Portfolio not found'}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const { creator, pitches, stats, socialStats, isOwner, insights } = portfolio;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Creator Header */}
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex-shrink-0">
                  {creator.profileImage ? (
                    <img 
                      src={creator.profileImage} 
                      alt={getDisplayName(creator)}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-2xl">
                        {getDisplayName(creator).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {getDisplayName(creator)}
                    </h1>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                      {creator.userType}
                    </span>
                  </div>
                  
                  {creator.bio && (
                    <p className="text-gray-600 mb-4 max-w-2xl">
                      {creator.bio}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    {creator.location && (
                      <span className="flex items-center">
                        📍 {creator.location}
                      </span>
                    )}
                    <span>Joined {formatDate(creator.createdAt)}</span>
                  </div>
                </div>
              </div>

              {!isOwner && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-6 py-2 rounded-lg font-medium ${
                    isFollowing
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8 pt-6 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.totalPitches}</div>
                <div className="text-sm text-gray-600">Published Pitches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.totalViews)}</div>
                <div className="text-sm text-gray-600">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatNumber(stats.totalLikes)}</div>
                <div className="text-sm text-gray-600">Total Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{socialStats.followers}</div>
                <div className="text-sm text-gray-600">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{socialStats.following}</div>
                <div className="text-sm text-gray-600">Following</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* View Toggle */}
              {isOwner && (
                <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setActiveView('published')}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        activeView === 'published'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Published ({stats.totalPitches})
                    </button>
                    <button
                      onClick={() => setActiveView('draft')}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        activeView === 'draft'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Drafts ({stats.totalDrafts})
                    </button>
                    <button
                      onClick={() => setActiveView('all')}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        activeView === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>
              )}

              {/* Pitches Grid */}
              <div className="space-y-6">
                {pitches.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 mb-4">
                      {activeView === 'draft' 
                        ? 'No draft pitches yet'
                        : 'No published pitches yet'
                      }
                    </div>
                    {isOwner && (
                      <button 
                        onClick={() => navigate('/create-pitch')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Create Your First Pitch
                      </button>
                    )}
                  </div>
                ) : (
                  pitches.map((pitch) => (
                    <div key={pitch.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-6">
                        <div className="flex-shrink-0">
                          {pitch.titleImage ? (
                            <img 
                              src={pitch.titleImage} 
                              alt={pitch.title}
                              className="w-32 h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-32 h-24 bg-gray-300 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {pitch.title.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 
                              className="text-xl font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                              onClick={() => navigate(`/pitches/${pitch.id}`)}
                            >
                              {pitch.title}
                            </h3>
                            {pitch.status === 'draft' && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                Draft
                              </span>
                            )}
                          </div>

                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {pitch.logline}
                          </p>

                          <div className="flex items-center space-x-3 mb-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                              {pitch.genre}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                              {pitch.format}
                            </span>
                            {pitch.budgetBracket && (
                              <span className="px-2 py-1 bg-green-100 text-green-600 text-sm rounded-full">
                                {pitch.budgetBracket}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <span>{pitch.viewCount} views</span>
                            <span>{pitch.likeCount} likes</span>
                            <span>{pitch.ndaCount} NDAs</span>
                            <span>
                              {pitch.publishedAt 
                                ? `Published ${formatDate(pitch.publishedAt)}`
                                : `Created ${formatDate(pitch.createdAt)}`
                              }
                            </span>
                          </div>
                        </div>

                        {isOwner && (
                          <div className="flex-shrink-0">
                            <button 
                              onClick={() => navigate(`/pitches/${pitch.id}/edit`)}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Genre Distribution */}
              {insights.genreDistribution.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Genre Focus</h3>
                  <div className="space-y-3">
                    {insights.genreDistribution.map((genre, index) => (
                      <div key={genre.genre} className="flex items-center justify-between">
                        <span className="text-gray-600 capitalize">{genre.genre}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ 
                                width: `${(genre.count / insights.genreDistribution[0].count) * 100}%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500">{genre.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {insights.recentActivity.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-2">
                    {insights.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={activity.date} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{formatDate(activity.date)}</span>
                        <span className="text-gray-900 font-medium">{activity.count} pitches</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Card */}
              {!isOwner && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Get in Touch</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => navigate(`/messages?creator=${creator.id}`)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      Send Message
                    </button>
                    <button 
                      onClick={() => navigate(`/creator/${creator.id}/followers`)}
                      className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                    >
                      View Network
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreatorPortfolio;