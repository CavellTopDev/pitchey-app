import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Eye, Upload, BarChart3, LogOut, Plus, Coins } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { paymentsAPI } from '../lib/apiServices';
import apiClient from '../lib/api-client';
import { NotificationBell } from '../components/NotificationBell';
import { getSubscriptionTier } from '../config/subscription-plans';
import { EnhancedCreatorAnalytics } from '../components/Analytics/EnhancedCreatorAnalytics';

export default function CreatorDashboardTest() {
  const navigate = useNavigate();
  const { logout, user: authUser } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (authUser) {
      setUser(authUser);
    }
    
    fetchDashboardData();
  }, [authUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, creditsData, subscriptionData] = await Promise.all([
        apiClient.get('/api/creator/dashboard'),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getSubscriptionStatus(),
      ]);
      
      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        setStats({
          totalPitches: data.totalPitches || 0,
          activePitches: data.publishedPitches || 0,
          totalViews: data.totalViews || 0,
        });
        setTotalViews(data.totalViews || 0);
      }
      
      setCredits(creditsData);
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-xl font-bold text-gray-900">Pitchey</Link>
              <div className="h-8 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Creator Dashboard</h1>
                <p className="text-xs text-gray-500">Welcome back, {user?.username || 'Creator'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Credits Display */}
              <button
                onClick={() => navigate('/creator/billing?tab=credits')}
                className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
              >
                <Coins className="w-4 h-4 text-purple-600" />
                <div className="text-xs">
                  <div className="font-semibold text-purple-900">
                    {credits?.balance?.credits || 0} Credits
                  </div>
                </div>
              </button>
              
              <NotificationBell size="sm" className="sm:size-md" />
              
              <button
                onClick={() => navigate('/creator/pitch/new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition"
              >
                <Plus className="w-4 h-4" />
                New Pitch
              </button>
              
              <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-gray-700 transition">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Pitches</span>
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalPitches || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Active Pitches</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.activePitches || 0}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Views</span>
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalViews}</p>
          </div>
        </div>

        {/* Enhanced Analytics Section (uses mock fallback if API not available) */}
        <div className="mb-8">
          <EnhancedCreatorAnalytics
            disableRemoteFetch={true}
            pitchPerformance={{
              totalViews: totalViews,
              viewsChange: 15,
              totalLikes: 0,
              likesChange: 12,
              totalShares: 0,
              sharesChange: 8,
              potentialInvestment: 0,
              investmentChange: 0,
            }}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/creator/pitch/new')}
              className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
            >
              <Upload className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Upload New Pitch</span>
            </button>
            
            <button
              onClick={() => navigate('/creator/pitches')}
              className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Manage Pitches</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
