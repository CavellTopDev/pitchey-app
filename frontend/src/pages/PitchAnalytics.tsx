import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Heart, MessageSquare, Share2, TrendingUp, Calendar, Users, Download } from 'lucide-react';
import { API_URL } from '../config/api.config';

interface AnalyticsData {
  pitchId: number;
  pitchTitle: string;
  totalViews: number;
  totalLikes: number;
  totalMessages: number;
  totalShares: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  viewsByDay: Array<{ date: string; views: number }>;
  viewerTypes: Array<{ type: string; count: number }>;
  topReferrers: Array<{ source: string; views: number }>;
  engagement: {
    averageViewTime: number;
    clickThroughRate: number;
    returnVisitors: number;
  };
}

export default function PitchAnalytics() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (id) {
      fetchAnalytics(parseInt(id));
    }
  }, [id, timeRange]);

  const fetchAnalytics = async (pitchId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creator/pitches/${pitchId}/analytics?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      } else {
        setError('Analytics not found');
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/pitches')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Not Found</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/creator/pitches')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Pitches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/creator/pitches/${id}`)}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-500">{analytics.pitchTitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalViews)}</p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  +{analytics.viewsThisWeek} this week
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Likes</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalLikes)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {((analytics.totalLikes / analytics.totalViews) * 100).toFixed(1)}% of views
                </p>
              </div>
              <div className="p-3 bg-pink-100 rounded-lg">
                <Heart className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalMessages)}</p>
                <p className="text-sm text-gray-500 mt-1">Investor inquiries</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Shares</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics.totalShares)}</p>
                <p className="text-sm text-gray-500 mt-1">External shares</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Share2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Views Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Views Over Time</h3>
            <div className="space-y-3">
              {analytics.viewsByDay.slice(-7).map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${Math.max(5, (day.views / Math.max(...analytics.viewsByDay.map(d => d.views))) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 min-w-[40px] text-right">{day.views}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Viewer Types */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Viewer Types</h3>
            <div className="space-y-4">
              {analytics.viewerTypes.map((viewer, index) => (
                <div key={viewer.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-purple-600' : 
                      index === 1 ? 'bg-blue-600' : 
                      index === 2 ? 'bg-green-600' : 'bg-gray-600'
                    }`}></div>
                    <span className="text-sm text-gray-700 capitalize">{viewer.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{viewer.count}</span>
                    <span className="text-xs text-gray-500">
                      ({((viewer.count / analytics.totalViews) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Average View Time</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTime(analytics.engagement.averageViewTime)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Click-through Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {(analytics.engagement.clickThroughRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Return Visitors</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics.engagement.returnVisitors}
                </span>
              </div>
            </div>
          </div>

          {/* Top Referrers */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
            <div className="space-y-3">
              {analytics.topReferrers.map((referrer, index) => (
                <div key={referrer.source} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">#{index + 1}</span>
                    <span className="text-sm text-gray-700">{referrer.source}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{referrer.views} views</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {analytics.viewsThisMonth > analytics.viewsThisWeek * 4 ? 'Strong' : 'Growing'}
              </div>
              <div className="text-sm text-gray-600">Monthly Performance</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {analytics.engagement.clickThroughRate > 0.1 ? 'High' : 'Moderate'}
              </div>
              <div className="text-sm text-gray-600">Engagement Level</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {(analytics.totalMessages / analytics.totalViews * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Conversion Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}