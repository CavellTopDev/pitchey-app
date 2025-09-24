import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, TrendingUp, Eye, MessageSquare, Upload, BarChart3, Calendar, LogOut, Plus, Shield, CreditCard, Coins } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { paymentsAPI, apiClient } from '../lib/apiServices';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const { logout, user: authUser } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialStats, setSocialStats] = useState<any>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [followers, setFollowers] = useState<number>(0);

  useEffect(() => {
    // Load user data immediately on mount
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        console.log('User data loaded from localStorage:', parsedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (authUser) {
      // Fallback to auth store user if localStorage doesn't have it
      setUser(authUser);
      console.log('User data loaded from auth store:', authUser);
    } else {
      console.log('No user data found in localStorage or auth store');
    }
    
    fetchDashboardData();
  }, [authUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      const userId = user?.id || authUser?.id;
      
      // Fetch dashboard data, billing info and follows in parallel
      const [dashboardResponse, creditsData, subscriptionData, followersResponse, followingResponse] = await Promise.all([
        apiClient.get('/api/creator/dashboard'),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getSubscriptionStatus(),
        userId ? apiClient.get(`/api/follows/followers?creatorId=${userId}`) : Promise.resolve({ success: false }),
        userId ? apiClient.get('/api/follows/following') : Promise.resolve({ success: false })
      ]);
      
      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        
        // Calculate actual stats from backend data
        const actualTotalViews = data.stats?.views || 0;
        const actualTotalPitches = data.stats?.totalPitches || 0;
        const actualActivePitches = data.stats?.activePitches || 0;
        const actualTotalInterest = data.stats?.investors || 0;
        
        // Calculate average rating from pitches if available
        let calculatedAvgRating = 0;
        if (data.pitches && data.pitches.length > 0) {
          const ratingsSum = data.pitches.reduce((sum: number, pitch: any) => {
            return sum + (pitch.rating || 0);
          }, 0);
          calculatedAvgRating = data.pitches.length > 0 ? (ratingsSum / data.pitches.length) : 0;
        }
        
        setStats({
          totalPitches: actualTotalPitches,
          activePitches: actualActivePitches,
          totalViews: actualTotalViews,
          totalInterest: actualTotalInterest,
          avgRating: calculatedAvgRating
        });
        
        setTotalViews(actualTotalViews);
        setAvgRating(calculatedAvgRating);
        setRecentActivity(data.recentActivity || []);
        
        // Get actual followers count
        const followersCount = followersResponse.success ? 
          (followersResponse.data?.followers?.length || 0) : 0;
        const followingCount = followingResponse.success ? 
          (followingResponse.data?.following?.length || 0) : 0;
        
        setFollowers(followersCount);
        setSocialStats({
          followers: followersCount,
          following: followingCount
        });
        
        // Use billing API credits if available, otherwise use dashboard credits
        setCredits(creditsData || data.credits);
      } else {
        // Set default empty states
        console.error('Failed to fetch dashboard data:', dashboardResponse.error?.message);
        setStats({
          totalPitches: 0,
          activePitches: 0,
          totalViews: 0,
          totalInterest: 0,
          avgRating: 0
        });
        setSocialStats({
          followers: 0,
          following: 0
        });
        setRecentActivity([]);
        setTotalViews(0);
        setAvgRating(0);
        setFollowers(0);
      }
      
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
      // Set fallback empty states
      setStats({
        totalPitches: 0,
        activePitches: 0,
        totalViews: 0,
        totalInterest: 0,
        avgRating: 0
      });
      setSocialStats({
        followers: 0,
        following: 0
      });
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    logout();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              {/* Pitchey Logo - Links to Homepage */}
              <Link 
                to="/" 
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                title="Go to Homepage"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg flex items-center justify-center">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Pitchey</span>
              </Link>
              
              {/* Divider */}
              <div className="h-8 w-px bg-gray-300"></div>
              
              {/* Dashboard Info */}
              <div>
                <h1 className="text-xl font-bold text-gray-900">Creator Dashboard</h1>
                <p className="text-xs text-gray-500">Welcome back, {user?.username || 'Creator'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Credits Display */}
              <button
                onClick={() => navigate('/creator/billing?tab=credits')}
                className="flex items-center gap-3 px-4 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
              >
                <Coins className="w-5 h-5 text-purple-600" />
                <div className="text-sm">
                  <div className="font-semibold text-purple-900">
                    {credits?.balance?.credits || 0} Credits
                  </div>
                  <div className="text-xs text-purple-600 group-hover:text-purple-700">
                    Click to manage
                  </div>
                </div>
              </button>
              
              {/* Subscription Status */}
              <button
                onClick={() => navigate('/creator/billing?tab=subscription')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <span className="font-medium text-gray-700">
                  {subscription?.tier?.toUpperCase() || 'FREE'}
                </span>
                {subscription?.status === 'active' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </button>
              
              <Link
                to="/creator/following"
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Following
              </Link>
              
              <button
                onClick={() => navigate('/creator/pitch/new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition"
              >
                <Plus className="w-4 h-4" />
                New Pitch
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 transition"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Pitches</span>
              <Film className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalPitches || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Active Pitches</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.activePitches || 0}</p>
            <p className="text-xs text-green-500 mt-1">Currently live</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Views</span>
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalViews}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Avg Rating</span>
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">Out of 5.0</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/creator/portfolio')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Followers</span>
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{followers}</p>
            <p className="text-xs text-blue-500 mt-1 hover:underline">View portfolio →</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Engagement Rate</span>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.totalPitches > 0 ? 
                Math.round(((stats?.totalInterest || 0) / stats.totalPitches) * 100) : 0}%
            </p>
            <p className="text-xs text-purple-500 mt-1">Interest per pitch</p>
          </div>
        </div>

        {/* Creator Milestones Section */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Creator Milestones</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* First Pitch Milestone */}
              <div className={`p-4 rounded-lg border-2 ${
                stats?.totalPitches > 0 ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <Film className={`w-8 h-8 ${
                    stats?.totalPitches > 0 ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  {stats?.totalPitches > 0 && (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">First Pitch</h3>
                <p className="text-xs text-gray-600">
                  {stats?.totalPitches > 0 ? 'Completed' : 'Upload your first pitch'}
                </p>
              </div>
              
              {/* 100 Views Milestone */}
              <div className={`p-4 rounded-lg border-2 ${
                totalViews >= 100 ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <Eye className={`w-8 h-8 ${
                    totalViews >= 100 ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  {totalViews >= 100 && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">100 Views</h3>
                <p className="text-xs text-gray-600">
                  {totalViews >= 100 ? `${totalViews} views reached!` : `${totalViews}/100 views`}
                </p>
              </div>
              
              {/* 10 Followers Milestone */}
              <div className={`p-4 rounded-lg border-2 ${
                followers >= 10 ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <svg className={`w-8 h-8 ${
                    followers >= 10 ? 'text-purple-600' : 'text-gray-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {followers >= 10 && (
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">Community Builder</h3>
                <p className="text-xs text-gray-600">
                  {followers >= 10 ? `${followers} followers!` : `${followers}/10 followers`}
                </p>
              </div>
              
              {/* High Rating Milestone */}
              <div className={`p-4 rounded-lg border-2 ${
                avgRating >= 4.0 ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <svg className={`w-8 h-8 ${
                    avgRating >= 4.0 ? 'text-yellow-600' : 'text-gray-400'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {avgRating >= 4.0 && (
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">Top Rated</h3>
                <p className="text-xs text-gray-600">
                  {avgRating >= 4.0 ? `${avgRating.toFixed(1)} ★ rating!` : `${avgRating.toFixed(1)}/4.0 ★`}
                </p>
              </div>
            </div>
            
            {/* Progress to next milestone */}
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Your Next Goals</h4>
              <div className="space-y-2">
                {totalViews < 1000 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((totalViews / 1000) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{totalViews}/1000 views</span>
                  </div>
                )}
                {followers < 50 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((followers / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{followers}/50 followers</span>
                  </div>
                )}
                {stats?.totalPitches < 5 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((stats?.totalPitches / 5) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">{stats?.totalPitches}/5 pitches</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <div className="p-6">
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={activity.id || index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                          activity.color === 'green' ? 'bg-green-100 text-green-600' :
                          activity.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                          activity.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                          activity.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {activity.icon === 'eye' ? <Eye className="w-4 h-4" /> :
                           activity.icon === 'dollar-sign' ? <CreditCard className="w-4 h-4" /> :
                           activity.icon === 'message-circle' ? <MessageSquare className="w-4 h-4" /> :
                           activity.icon === 'user-plus' ? <Plus className="w-4 h-4" /> :
                           <Film className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{activity.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/creator/pitch/new')}
                    className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                  >
                    <Upload className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">Upload New Pitch</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/pitches')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Film className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Manage Pitches</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/analytics')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">View Analytics</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/ndas')}
                    className="w-full flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                  >
                    <Shield className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">NDA Management</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/portfolio')}
                    className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">View My Portfolio</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/following')}
                    className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition"
                  >
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-900">Following</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/messages')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <MessageSquare className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Messages</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/calendar')}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Calendar</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/creator/billing')}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 rounded-lg transition"
                  >
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Billing & Payments</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Subscription Info */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-sm p-6 mt-6">
              <h3 className="text-white font-semibold mb-2">
                Your Plan: {subscription?.tier?.toUpperCase() || 'FREE'}
              </h3>
              {subscription?.status === 'active' ? (
                <div>
                  <p className="text-purple-100 text-sm mb-4">
                    {subscription.subscription?.currentPeriodEnd && (
                      <>Next payment: {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}</>
                    )}
                  </p>
                  <button 
                    onClick={() => navigate('/creator/billing?tab=subscription')}
                    className="w-full py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition"
                  >
                    Manage Subscription
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-purple-100 text-sm mb-4">
                    Upgrade to PRO for unlimited uploads and advanced analytics
                  </p>
                  <button 
                    onClick={() => navigate('/creator/billing?tab=subscription')}
                    className="w-full py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition"
                  >
                    Upgrade Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}