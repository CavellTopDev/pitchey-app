import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DollarSign, TrendingUp, PieChart, Eye, Star, Briefcase, LogOut, Search, Filter, Film, CreditCard, Coins, Users, Heart, Shield, Building2, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { paymentsAPI, pitchServicesAPI, apiClient } from '../lib/apiServices';
import FollowButton from '../components/FollowButton';

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [followingPitches, setFollowingPitches] = useState<any[]>([]);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      
      // Fetch dashboard data and billing info in parallel
      const [dashboardResponse, creditsData, subscriptionData, followingData] = await Promise.all([
        apiClient.get('/api/investor/dashboard'),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getSubscriptionStatus(),
        pitchServicesAPI.getFollowingPitches()
      ]);
      
      if (dashboardResponse.success) {
        const data = dashboardResponse.data;
        setPortfolio(data.portfolio);
        setWatchlist(data.watchlist);
        setRecommendations(data.recommendations);
      } else {
        // Try to fetch AI recommendations separately
        try {
          const recsResponse = await apiClient.get('/api/ai/recommendations/investor');
          if (recsResponse.success) {
            setRecommendations(recsResponse.data.recommendations || []);
          }
        } catch (recsError) {
          console.error('Failed to fetch AI recommendations:', recsError);
          setRecommendations([]);
        }
        
        // Set default empty states
        console.error('Failed to fetch dashboard data:', dashboardResponse.error?.message);
        setPortfolio({
          totalInvestments: 0,
          activeDeals: 0,
          totalInvested: 0,
          averageReturn: 0,
          pendingOpportunities: 0
        });
        setWatchlist([]);
      }
      
      setCredits(creditsData);
      setSubscription(subscriptionData);
      
      // Set following data with fallback handling
      if (followingData?.success) {
        setFollowingPitches(followingData.pitches || []);
      } else {
        // Fallback: try to fetch using the follows API if primary fails
        try {
          const fallbackResponse = await apiClient.get('/api/follows/following?type=pitches');
          
          if (fallbackResponse.success) {
            setFollowingPitches(fallbackResponse.data.following || []);
          } else {
            setFollowingPitches([]);
          }
        } catch (fallbackError) {
          console.error('Failed to fetch following data from fallback API:', fallbackError);
          setFollowingPitches([]);
        }
      }
      
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
      // Set fallback empty states
      setPortfolio({
        totalInvestments: 0,
        activeDeals: 0,
        totalInvested: 0,
        averageReturn: 0,
        pendingOpportunities: 0
      });
      setWatchlist([]);
      setRecommendations([]);
      setFollowingPitches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login/investor');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
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
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Investor Dashboard</h1>
                  <p className="text-xs text-gray-500">Welcome back, {user?.username || 'Investor'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Credits Display */}
              <button
                onClick={() => navigate('/investor/billing?tab=credits')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
              >
                <Coins className="w-4 h-4 text-blue-600" />
                <div className="text-sm">
                  <span className="font-medium text-blue-900">
                    {credits?.balance || 0} Credits
                  </span>
                </div>
              </button>
              
              {/* Subscription Status */}
              <button
                onClick={() => navigate('/investor/billing?tab=subscription')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <span className="font-medium text-gray-700">
                  {subscription?.tier?.toUpperCase() || 'FREE'}
                </span>
                {subscription?.status === 'active' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </button>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search opportunities..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
              
              <Link
                to="/investor/following"
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5" />
                Following
              </Link>
              
              <button
                onClick={() => navigate('/investor/browse')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition"
              >
                <Filter className="w-4 h-4" />
                Browse Deals
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

      {/* Portfolio Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Investments</span>
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{portfolio?.totalInvestments || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Active Deals</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{portfolio?.activeDeals || 0}</p>
            <p className="text-xs text-green-500 mt-1">In production</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Invested</span>
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(portfolio?.totalInvested || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Capital deployed</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Avg. Return</span>
              <PieChart className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{portfolio?.averageReturn || 0}%</p>
            <p className="text-xs text-orange-500 mt-1">Annual ROI</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Opportunities</span>
              <Eye className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{portfolio?.pendingOpportunities || 0}</p>
            <p className="text-xs text-yellow-500 mt-1">Pending review</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Investment Pipeline & Following */}
          <div className="lg:col-span-2 space-y-6">
            {/* Following Activity */}
            {followingPitches.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Following Activity</h2>
                  <Link 
                    to="/investor/following"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View All Following
                  </Link>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {followingPitches.slice(0, 3).map((pitch) => (
                      <div key={pitch.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            pitch.creator.userType === 'production' ? 'bg-purple-100 text-purple-600' :
                            pitch.creator.userType === 'investor' ? 'bg-green-100 text-green-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {pitch.creator.userType === 'production' ? <Building2 className="w-5 h-5" /> :
                             pitch.creator.userType === 'investor' ? <DollarSign className="w-5 h-5" /> :
                             <User className="w-5 h-5" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={`/creator/${pitch.creator.id}`}
                              className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                            >
                              {pitch.creator.companyName || pitch.creator.username}
                            </Link>
                            <span className="text-gray-500 text-sm">published a new pitch</span>
                            <span className="text-gray-400 text-sm">• 2 days ago</span>
                            <FollowButton 
                              creatorId={pitch.creator.id} 
                              variant="small"
                              className="ml-auto"
                            />
                          </div>
                          <div 
                            className="cursor-pointer group"
                            onClick={() => navigate(`/pitch/${pitch.id}`)}
                          >
                            <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                              {pitch.title}
                            </h4>
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                              {pitch.logline}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="px-2 py-1 bg-gray-100 rounded-full">
                                {pitch.genre}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {pitch.viewCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-4 h-4" />
                                {pitch.likeCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Investment Pipeline */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Investment Pipeline</h2>
                <button 
                  onClick={() => navigate('/investor/browse')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View All
                </button>
              </div>
              <div className="p-6">
                {watchlist.length > 0 ? (
                  <div className="space-y-4">
                    {watchlist.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-500">{item.genre} • Budget: {formatCurrency(item.budget)}</p>
                            {item.creator && (
                              <Link
                                to={`/creator/${item.creator.id}`}
                                className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                              >
                                by {item.creator.companyName || item.creator.username}
                              </Link>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.status === 'Reviewing' ? 'bg-yellow-100 text-yellow-700' :
                            item.status === 'Due Diligence' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <button 
                            onClick={() => navigate(`/pitch/${item.id || 1}`)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={() => alert('Coming Soon: Calendar integration for scheduling meetings with creators and production companies.')}
                            className="text-sm text-gray-600 hover:text-gray-700"
                          >
                            Schedule Meeting
                          </button>
                          <button 
                            onClick={() => alert('Coming Soon: Investment offer system. This will allow you to submit formal investment proposals with terms and conditions.')}
                            className="text-sm text-green-600 hover:text-green-700"
                          >
                            Make Offer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No items in your investment pipeline yet</p>
                    <button
                      onClick={() => navigate('/investor/browse')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Browse Investment Opportunities
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">AI Recommendations</h2>
              </div>
              <div className="p-6">
                {recommendations.length > 0 ? (
                  <div className="space-y-4">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="p-3 border rounded-lg hover:bg-gray-50 transition">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{rec.title}</h4>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-sm font-semibold">{rec.matchScore}%</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{rec.genre}</p>
                        <button 
                          onClick={() => navigate(`/pitch/${rec.id || 1}`)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          View Pitch
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center">No recommendations available</p>
                )}
              </div>
            </div>

            {/* Billing & Account */}
            <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Account Management</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/following')}
                  className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                >
                  <Users className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Following ({followingPitches.length})</span>
                </button>
                
                <button
                  onClick={() => navigate('/investor/billing')}
                  className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 rounded-lg transition"
                >
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Billing & Payments</span>
                </button>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Current Plan</span>
                    <span className="text-sm font-medium text-gray-900">
                      {subscription?.tier?.toUpperCase() || 'FREE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Credits</span>
                    <span className="text-sm font-medium text-blue-600">
                      {credits?.balance || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Investment Criteria */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-sm p-6 mt-6">
              <h3 className="text-white font-semibold mb-2">Investment Preferences</h3>
              <p className="text-blue-100 text-sm mb-4">
                Your profile is optimized for Action, Thriller, and Sci-Fi projects with budgets $5M-$20M
              </p>
              <button 
                onClick={() => alert('Coming Soon: Investment criteria customization. This will allow you to set your preferred genres, budget ranges, and investment parameters.')}
                className="w-full py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                Update Criteria
              </button>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-sm font-semibold text-green-600">+12.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Quarter</span>
                  <span className="text-sm font-semibold text-green-600">+28.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">YTD Returns</span>
                  <span className="text-sm font-semibold text-green-600">+45.7%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}