import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, TrendingUp, Eye, MessageSquare, Upload, BarChart3, Calendar, LogOut, Plus, Shield, CreditCard, Coins } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { paymentsAPI, apiClient } from '../lib/apiServices';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialStats, setSocialStats] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      
      // Fetch dashboard data and billing info in parallel
      const [dashboardResponse, creditsData, subscriptionData] = await Promise.all([
        apiClient.get('/api/creator/dashboard'),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getSubscriptionStatus()
      ]);
      
      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        setStats(data.stats);
        setRecentActivity(data.recentActivity);
        setSocialStats(data.socialStats);
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
      }
      
      setSubscription(subscriptionData);
      
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
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
                    {credits?.balance || 0} Credits
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
                to="/following"
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
            <p className="text-2xl font-bold text-gray-900">{stats?.totalViews || 0}</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Interest Shown</span>
              <MessageSquare className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalInterest || 0}</p>
            <p className="text-xs text-orange-500 mt-1">+5 this week</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/creator/${user?.id}`)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Followers</span>
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{socialStats?.followers || 0}</p>
            <p className="text-xs text-blue-500 mt-1 hover:underline">View portfolio →</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/following')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Following</span>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197H9m3 0a3 3 0 01-3-3V9a5 5 0 1110 0v6.5a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{socialStats?.following || 0}</p>
            <p className="text-xs text-green-500 mt-1 hover:underline">Manage following →</p>
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
                    onClick={() => navigate(`/creator/${user?.id}`)}
                    className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">View My Portfolio</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/following')}
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