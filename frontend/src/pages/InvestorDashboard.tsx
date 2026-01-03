import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  DollarSign, 
  LogOut, 
  TrendingUp, 
  FileText, 
  Bell, 
  Search,
  Star,
  Clock,
  Shield,
  BarChart3,
  Briefcase,
  Plus,
  ChevronRight,
  Eye,
  Users,
  Calendar,
  Filter,
  Download,
  Activity,
  Award,
  HandshakeIcon,
  Building,
  MessageSquare,
  Wallet,
  PieChart,
  TrendingDown,
  History
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
// Using the enhanced Investor-specific navigation
// EnhancedInvestorNav is now handled by PortalLayout
import { formatCurrency, formatPercentage, safeNumber } from '../utils/formatters';

interface PortfolioSummary {
  totalInvested: number;
  activeInvestments: number;
  averageROI: number;
  topPerformer: string;
}

interface Investment {
  id: number;
  pitchTitle: string;
  amount: number;
  status: string;
  roi: number;
  dateInvested: string;
  pitchId?: number;
}

interface SavedPitch {
  id: number;
  title: string;
  creator: string;
  genre: string;
  budget: string;
  status: string;
  savedAt: string;
}

interface NDARequest {
  id: number;
  pitchTitle: string;
  status: string;
  requestedAt: string;
  signedAt?: string;
}

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data states
  const [portfolio, setPortfolio] = useState<PortfolioSummary>({
    totalInvested: 0,
    activeInvestments: 0,
    averageROI: 0,
    topPerformer: 'None yet'
  });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all dashboard data in parallel
      const [
        portfolioRes,
        investmentsRes,
        savedRes,
        ndaRes,
        notificationsRes,
        recommendationsRes
      ] = await Promise.allSettled([
        api.get('/api/investor/portfolio/summary'),
        api.get('/api/investor/investments'),
        api.get('/api/saved-pitches'),
        api.get('/api/nda/active'),
        api.get('/api/notifications'),
        api.get('/api/investment/recommendations')
      ]);

      // Handle portfolio summary with safe data parsing
      if (portfolioRes.status === 'fulfilled' && portfolioRes.value.data.success) {
        const portfolioData = portfolioRes.value.data.data || {};
        setPortfolio({
          totalInvested: safeNumber(portfolioData.totalInvested, 0),
          activeInvestments: safeNumber(portfolioData.activeInvestments, 0),
          averageROI: safeNumber(portfolioData.averageROI, 0),
          topPerformer: portfolioData.topPerformer || 'None yet'
        });
      }

      // Handle investments with safe data parsing
      if (investmentsRes.status === 'fulfilled' && investmentsRes.value.data.success) {
        const investmentData = (investmentsRes.value.data.data || []).map((investment: any) => ({
          ...investment,
          amount: safeNumber(investment.amount, 0),
          roi: safeNumber(investment.roi, 0),
          id: investment.id || Math.random(),
          pitchTitle: investment.pitchTitle || 'Unknown Project',
          status: investment.status || 'unknown',
          dateInvested: investment.dateInvested || new Date().toISOString()
        }));
        setInvestments(investmentData);
      }

      // Handle saved pitches
      if (savedRes.status === 'fulfilled') {
        setSavedPitches(savedRes.value.data.data || []);
      }

      // Handle NDAs
      if (ndaRes.status === 'fulfilled') {
        setNdaRequests(ndaRes.value.data.data || []);
      }

      // Handle notifications
      if (notificationsRes.status === 'fulfilled') {
        setNotifications(notificationsRes.value.data.data || []);
      }

      // Handle recommendations
      if (recommendationsRes.status === 'fulfilled') {
        setRecommendations(recommendationsRes.value.data.data || []);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  // formatCurrency function moved to utils/formatters.ts for safe number handling

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Main content - removed the flex wrapper and EnhancedInvestorNav since it's handled by PortalLayout */}
      <div className="w-full">
        {/* Top header bar */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Investor Dashboard</h1>
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-500 hover:text-gray-700">
                <Bell className="w-5 h-5" />
              </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{user?.name || user?.email}</span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(portfolio.totalInvested)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+12.5%</span>
              <span className="text-gray-500 ml-1">vs last month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Deals</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {portfolio.activeInvestments}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Plus className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-gray-600">2 new this month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average ROI</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatPercentage(portfolio.averageROI, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <Activity className="w-4 h-4 text-purple-500 mr-1" />
              <span className="text-gray-600">Industry avg: 12.3%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Performer</p>
                <p className="text-lg font-bold text-gray-900 mt-2 truncate">
                  {portfolio.topPerformer}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+45% ROI</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Now visible on all screen sizes with complete navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border-b border-gray-200">
          <nav className="flex flex-wrap gap-x-1 sm:gap-x-6 px-4 sm:px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'browse'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setActiveTab('investments')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'investments'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Investments
            </button>
            <button
              onClick={() => setActiveTab('due-diligence')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'due-diligence'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Due Diligence
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'network'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Network
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === 'financials'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Financials
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-sm">
          <div className="p-6">
            {/* Dashboard Tab (formerly Overview) */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Investment Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recommended Opportunities
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendations.slice(0, 3).map((pitch: any) => (
                      <div key={pitch.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-gray-900">{pitch.title}</h4>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            {pitch.genre}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{pitch.tagline}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{pitch.budget}</span>
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">New pitch saved: "The Last Echo"</p>
                        <p className="text-xs text-gray-500">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">NDA signed for "Digital Dreams"</p>
                        <p className="text-xs text-gray-500">1 day ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Investment completed: $50,000</p>
                        <p className="text-xs text-gray-500">3 days ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Investments Tab (formerly Portfolio) */}
            {activeTab === 'investments' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Investments</h3>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4 inline mr-2" />
                    New Investment
                  </button>
                </div>
                
                {investments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Project
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ROI
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {investments.map((investment) => (
                          <tr key={investment.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {investment.pitchTitle}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatCurrency(investment.amount)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                investment.status === 'active' 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {investment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${
                                safeNumber(investment.roi) > 0 ? 'text-green-600' : 'text-gray-900'
                              }`}>
                                {safeNumber(investment.roi) > 0 ? '+' : ''}{formatPercentage(investment.roi, 0)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(investment.dateInvested).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button className="text-blue-600 hover:text-blue-900">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No investments yet</p>
                    <button 
                      onClick={() => navigate('/marketplace')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Browse Opportunities
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Browse Tab - New */}
            {activeTab === 'browse' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Browse Opportunities</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate('/investor/discover')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Filter className="w-4 h-4 inline mr-1" />
                      Advanced Search
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <button 
                    onClick={() => navigate('/investor/discover?tab=trending')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Trending Projects</h4>
                    <p className="text-sm text-gray-500 mt-1">Hot opportunities gaining traction</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/discover?tab=new')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Star className="w-6 h-6 text-yellow-600 mb-2" />
                    <h4 className="font-medium text-gray-900">New Submissions</h4>
                    <p className="text-sm text-gray-500 mt-1">Fresh pitches just added</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/discover?tab=featured')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Award className="w-6 h-6 text-purple-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Featured Deals</h4>
                    <p className="text-sm text-gray-500 mt-1">Handpicked quality projects</p>
                  </button>
                </div>

                {/* Saved Pitches Section */}
                <div className="mt-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Your Saved Pitches</h4>
                  {savedPitches.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedPitches.slice(0, 4).map((pitch) => (
                        <div key={pitch.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-gray-900">{pitch.title}</h4>
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          </div>
                          <p className="text-sm text-gray-600 mt-1">by {pitch.creator}</p>
                          <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {pitch.genre}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {pitch.budget}
                            </span>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              Saved {new Date(pitch.savedAt).toLocaleDateString()}
                            </span>
                            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                              View →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No saved pitches yet</p>
                      <button 
                        onClick={() => navigate('/marketplace')}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Discover Pitches
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Due Diligence Tab - combines NDAs and evaluations */}
            {activeTab === 'due-diligence' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Due Diligence & NDAs</h3>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm">
                      Pending: 2
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
                      Active: {ndaRequests.length}
                    </span>
                  </div>
                </div>
                
                {/* NDA Management Section */}
                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Active NDAs</h4>
                  {ndaRequests.length > 0 ? (
                    <div className="space-y-3">
                      {ndaRequests.slice(0, 5).map((nda) => (
                        <div key={nda.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{nda.pitchTitle}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Requested: {new Date(nda.requestedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                nda.status === 'signed' 
                                  ? 'bg-green-100 text-green-700'
                                  : nda.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {nda.status}
                              </span>
                              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No NDA requests yet</p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => navigate('/investor/ndas')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Shield className="w-5 h-5 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">All NDAs</p>
                    <p className="text-sm text-gray-500">Manage agreements</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/evaluations')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <FileText className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">Evaluations</p>
                    <p className="text-sm text-gray-500">Project assessments</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/risk-assessment')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Activity className="w-5 h-5 text-red-600 mb-2" />
                    <p className="font-medium text-gray-900">Risk Analysis</p>
                    <p className="text-sm text-gray-500">Investment risks</p>
                  </button>
                </div>
              </div>
            )}

            {/* Network Tab */}
            {activeTab === 'network' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Investment Network</h3>
                  <button 
                    onClick={() => navigate('/investor/network')}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    View All Connections
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <button 
                    onClick={() => navigate('/investor/creators')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Users className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">Creators</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                    <p className="text-xs text-gray-500">Connected creators</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/co-investors')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <HandshakeIcon className="w-6 h-6 text-green-600 mb-2" />
                    <p className="font-medium text-gray-900">Co-Investors</p>
                    <p className="text-2xl font-bold text-gray-900">8</p>
                    <p className="text-xs text-gray-500">Partner investors</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/production-companies')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Building className="w-6 h-6 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">Companies</p>
                    <p className="text-2xl font-bold text-gray-900">5</p>
                    <p className="text-xs text-gray-500">Production partners</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/messages')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <MessageSquare className="w-6 h-6 text-orange-600 mb-2" />
                    <p className="font-medium text-gray-900">Messages</p>
                    <p className="text-2xl font-bold text-gray-900">3</p>
                    <p className="text-xs text-gray-500">Unread messages</p>
                  </button>
                </div>

                {/* Recent Network Activity */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Network Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">New connection: Alex Chen (Creator)</p>
                        <p className="text-xs text-gray-500">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <HandshakeIcon className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Co-investor invitation from Sarah Mills</p>
                        <p className="text-xs text-gray-500">1 day ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">New partnership: Stellar Studios</p>
                        <p className="text-xs text-gray-500">3 days ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Investment Analytics</h3>
                  <button className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    Export Report
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ROI Chart Placeholder */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">ROI Over Time</h4>
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                  </div>
                  
                  {/* Investment Distribution */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Portfolio Distribution</h4>
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      <Activity className="w-8 h-8" />
                    </div>
                  </div>
                </div>
                
                {/* Key Metrics */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Returns</p>
                    <p className="text-2xl font-bold text-gray-900">$67,500</p>
                    <p className="text-xs text-green-600 mt-1">+15% YTD</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">73%</p>
                    <p className="text-xs text-gray-500 mt-1">11 of 15 profitable</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Avg. Deal Size</p>
                    <p className="text-2xl font-bold text-gray-900">$75,000</p>
                    <p className="text-xs text-gray-500 mt-1">Last 6 months</p>
                  </div>
                </div>
              </div>
            )}

            {/* Financials Tab */}
            {activeTab === 'financials' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Overview</h3>
                  <button className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 inline mr-1" />
                    Export Statement
                  </button>
                </div>
                
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Available Funds</p>
                      <Wallet className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$250,000</p>
                    <p className="text-xs text-gray-500 mt-1">Ready to invest</p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Allocated</p>
                      <DollarSign className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(portfolio.totalInvested)}</p>
                    <p className="text-xs text-gray-500 mt-1">In active investments</p>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Total Returns</p>
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$67,500</p>
                    <p className="text-xs text-green-600 mt-1">+15% YTD</p>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Pending</p>
                      <Clock className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">$45,000</p>
                    <p className="text-xs text-gray-500 mt-1">In negotiation</p>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Transactions</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 15, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Investment: "Digital Dreams"
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Investment
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            -$50,000
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 10, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Return: "The Last Echo"
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Return
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            +$12,500
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Received
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Dec 5, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Deposit: Wire Transfer
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Deposit
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            +$100,000
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Cleared
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => navigate('/investor/transactions')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <History className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="font-medium text-gray-900">All Transactions</p>
                    <p className="text-sm text-gray-500">View complete history</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/wallet')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <Wallet className="w-5 h-5 text-green-600 mb-2" />
                    <p className="font-medium text-gray-900">Manage Wallet</p>
                    <p className="text-sm text-gray-500">Add funds & banking</p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/investor/tax')}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow text-left"
                  >
                    <FileText className="w-5 h-5 text-purple-600 mb-2" />
                    <p className="font-medium text-gray-900">Tax Documents</p>
                    <p className="text-sm text-gray-500">Download statements</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/marketplace')}
            className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left"
          >
            <Search className="w-5 h-5 text-blue-600 mb-2" />
            <p className="font-medium text-gray-900">Browse Pitches</p>
            <p className="text-sm text-gray-500">Discover new opportunities</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <Users className="w-5 h-5 text-green-600 mb-2" />
            <p className="font-medium text-gray-900">Network</p>
            <p className="text-sm text-gray-500">Connect with creators</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <Calendar className="w-5 h-5 text-purple-600 mb-2" />
            <p className="font-medium text-gray-900">Schedule</p>
            <p className="text-sm text-gray-500">Manage meetings</p>
          </button>
          
          <button className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow text-left">
            <FileText className="w-5 h-5 text-orange-600 mb-2" />
            <p className="font-medium text-gray-900">Documents</p>
            <p className="text-sm text-gray-500">View contracts & NDAs</p>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}