import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Eye, MessageSquare, Upload, BarChart3, Calendar, Plus, Shield, CreditCard } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { paymentsAPI } from '../lib/apiServices';
import apiClient from '../lib/api-client';
import { NDANotificationBadge, NDANotificationPanel } from '../components/NDANotifications';
import { QuickNDAStatus } from '../components/NDA/NDADashboardIntegration';
import { getSubscriptionTier, SUBSCRIPTION_TIERS } from '../config/subscription-plans';
import { InvestmentService } from '../services/investment.service';
import FundingOverview from '../components/Investment/FundingOverview';
import { EnhancedCreatorAnalytics } from '../components/Analytics/EnhancedCreatorAnalytics';
// import { NotificationWidget } from '../components/Dashboard/NotificationWidget';
import { NotificationBell } from '../components/NotificationBell';
import { withPortalErrorBoundary } from '../components/ErrorBoundary/PortalErrorBoundary';
import { useSentryPortal } from '../hooks/useSentryPortal';
import {
  validateCreatorStats,
  safeArray,
  safeMap,
  safeAccess,
  safeNumber,
  safeString,
  safeReduce,
  safeExecute
} from '../utils/defensive';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
// EnhancedCreatorNav is now handled by PortalLayout
// import DashboardHeader from '../components/DashboardHeader';
// import * as Sentry from '@sentry/react';

function CreatorDashboard() {
  const navigate = useNavigate();
  const { logout, user: authUser, isAuthenticated, checkSession } = useBetterAuthStore();
  const { reportError, trackEvent, trackApiError } = useSentryPortal({
    portalType: 'creator',
    componentName: 'CreatorDashboard',
    trackPerformance: true
  });

  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pitches, setPitches] = useState<any[]>([]);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socialStats, setSocialStats] = useState<any>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [followers, setFollowers] = useState<number>(0);

  // Investment tracking state
  const [fundingMetrics, setFundingMetrics] = useState<any>(null);
  const [investmentLoading, setInvestmentLoading] = useState(true);

  // Check session on mount and redirect if not authenticated
  useEffect(() => {
    const validateSession = async () => {
      try {
        await checkSession();
        setSessionChecked(true);
      } catch {
        setSessionChecked(true);
      }
    };
    validateSession();
  }, [checkSession]);

  // Redirect to login if not authenticated after session check
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      navigate('/login/creator');
    }
  }, [sessionChecked, isAuthenticated, navigate]);

  useEffect(() => {
    // Only fetch data after session is verified
    if (!sessionChecked || !isAuthenticated) {
      return;
    }

    // Load user data immediately on mount
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    } else if (authUser) {
      // Fallback to auth store user if localStorage doesn't have it
      setUser(authUser);
    }

    fetchDashboardData();
    fetchFundingData(); // Fetch funding data in parallel
  }, [authUser, sessionChecked, isAuthenticated]);

  const fetchFundingData = async () => {
    try {
      setInvestmentLoading(true);
      
      // Fetch creator funding overview with safe data handling
      const fundingResponse = await InvestmentService.getCreatorFunding();
      if (safeAccess(fundingResponse, 'success', false)) {
        const fundingData = safeAccess(fundingResponse, 'data', {});
        const safeFunding = {
          totalFunding: safeNumber(safeAccess(fundingData, 'totalFunding', 0)),
          activeFunding: safeNumber(safeAccess(fundingData, 'activeFunding', 0)),
          pendingFunding: safeNumber(safeAccess(fundingData, 'pendingFunding', 0)),
          investors: safeArray(safeAccess(fundingData, 'investors', [])),
          recentInvestments: safeArray(safeAccess(fundingData, 'recentInvestments', []))
        };
        setFundingMetrics(safeFunding);
      }
      
    } catch (error) {
      console.error('Error fetching funding data:', error);
    } finally {
      setInvestmentLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Only fetch data if authenticated
      if (!isAuthenticated || !authUser?.id) {
        console.log('User not authenticated, skipping dashboard data fetch');
        setLoading(false);
        return;
      }
      
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
        const data = safeAccess(dashboardResponse, 'data', {});
        
        // Calculate actual stats from backend data with safe access
        const actualTotalViews = safeNumber(safeAccess(data, 'totalViews', 0));
        const actualTotalPitches = safeNumber(safeAccess(data, 'totalPitches', 0));
        const actualActivePitches = safeNumber(safeAccess(data, 'publishedPitches', 0));
        const actualTotalInterest = safeNumber(safeAccess(data, 'totalNDAs', 0));
        
        // Calculate average rating from pitches with safe array operations
        const pitchesArray = safeArray(safeAccess(data, 'pitches', []));
        const calculatedAvgRating = safeExecute(
          () => {
            if (pitchesArray.length === 0) return 0;
            
            const ratingsSum = safeReduce(
              pitchesArray,
              (sum: number, pitch: any) => sum + safeNumber(safeAccess(pitch, 'rating', 0)),
              0
            );
            
            return pitchesArray.length > 0 ? ratingsSum / pitchesArray.length : 0;
          },
          0,
          (error) => console.warn('Error calculating average rating:', error)
        );
        
        const validatedStats = validateCreatorStats({
          total_pitches: actualTotalPitches,
          active_pitches: actualActivePitches,
          views_count: actualTotalViews,
          interest_count: actualTotalInterest,
          funding_received: safeNumber(safeAccess(data, 'fundingReceived', 0)),
          success_rate: safeNumber(safeAccess(data, 'successRate', 0)),
          average_rating: calculatedAvgRating
        });
        
        setStats({
          totalPitches: validatedStats.total_pitches,
          activePitches: validatedStats.active_pitches,
          totalViews: validatedStats.views_count,
          totalInterest: validatedStats.interest_count,
          avgRating: validatedStats.average_rating,
          fundingReceived: validatedStats.funding_received,
          successRate: validatedStats.success_rate
        });
        
        setTotalViews(validatedStats.views_count);
        setAvgRating(validatedStats.average_rating);
        
        // Safe array operations for activity and pitches
        setRecentActivity(safeArray(safeAccess(data, 'recentActivity', [])));
        setPitches(safeArray(safeAccess(data, 'pitches', [])));
        
        // Safe followers count calculation
        const followersData = safeAccess(followersResponse, 'data.followers', []);
        const followingData = safeAccess(followingResponse, 'data.following', []);
        
        const followersCount = followersResponse.success ? safeArray(followersData).length : 0;
        const followingCount = followingResponse.success ? safeArray(followingData).length : 0;
        
        setFollowers(followersCount);
        setSocialStats({
          followers: followersCount,
          following: followingCount
        });
        
        // Safe credits handling
        const safeCredits = creditsData || safeAccess(data, 'credits', null);
        setCredits(safeCredits);
      } else {
        // Set default empty states with validation
        const errorMessage = safeAccess(dashboardResponse, 'error.message', 'Unknown error');
        console.error('Failed to fetch dashboard data:', errorMessage);
        
        const defaultStats = validateCreatorStats({});
        setStats({
          totalPitches: defaultStats.total_pitches,
          activePitches: defaultStats.active_pitches,
          totalViews: defaultStats.views_count,
          totalInterest: defaultStats.interest_count,
          avgRating: defaultStats.average_rating,
          fundingReceived: defaultStats.funding_received,
          successRate: defaultStats.success_rate
        });
        
        setSocialStats({ followers: 0, following: 0 });
        setRecentActivity([]);
        setTotalViews(0);
        setAvgRating(0);
        setFollowers(0);
      }
      
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
      
      // Set fallback empty states with validation
      const defaultStats = validateCreatorStats({});
      setStats({
        totalPitches: defaultStats.total_pitches,
        activePitches: defaultStats.active_pitches,
        totalViews: defaultStats.views_count,
        totalInterest: defaultStats.interest_count,
        avgRating: defaultStats.average_rating,
        fundingReceived: defaultStats.funding_received,
        successRate: defaultStats.success_rate
      });
      
      setSocialStats({ followers: 0, following: 0 });
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout(); // This will automatically clear storage and navigate to appropriate login page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Page Title - simplified since PortalLayout provides header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* ===== COMMAND CENTER HERO ZONE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left: Welcome + Key Metrics */}
        <div className="lg:col-span-3 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-1">
            Welcome back, {user?.name || user?.firstName || 'Creator'}
          </h2>
          <p className="text-purple-200 text-sm mb-6">Here's what's happening with your pitches</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => navigate('/creator/pitches')}
              className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg p-4 cursor-pointer transition"
            >
              <TrendingUp className="w-5 h-5 text-purple-200 mb-2" />
              <p className="text-2xl font-bold">{formatNumber(safeAccess(stats, 'activePitches', 0))}</p>
              <p className="text-purple-200 text-xs">Active Pitches</p>
            </div>

            <div
              onClick={() => navigate('/creator/analytics')}
              className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg p-4 cursor-pointer transition"
            >
              <Eye className="w-5 h-5 text-purple-200 mb-2" />
              <p className="text-2xl font-bold">{formatNumber(safeNumber(totalViews, 0))}</p>
              <p className="text-purple-200 text-xs">Total Views</p>
            </div>

            <div
              onClick={() => navigate('/creator/ndas')}
              className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg p-4 cursor-pointer transition relative"
            >
              <Shield className="w-5 h-5 text-purple-200 mb-2" />
              <p className="text-2xl font-bold">{formatNumber(safeAccess(stats, 'totalInterest', 0))}</p>
              <p className="text-purple-200 text-xs">Pending NDAs</p>
              {stats?.totalInterest > 0 && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Actions Grid */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/creator/pitch/new')}
              className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
            >
              <Plus className="w-6 h-6 text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Create Pitch</span>
            </button>
            <button
              onClick={() => navigate('/creator/pitches')}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            >
              <Upload className="w-6 h-6 text-gray-600" />
              <span className="text-xs font-medium text-gray-900">Manage Pitches</span>
            </button>
            <button
              onClick={() => navigate('/creator/ndas')}
              className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
            >
              <Shield className="w-6 h-6 text-amber-600" />
              <span className="text-xs font-medium text-amber-900">NDAs</span>
            </button>
            <button
              onClick={() => navigate('/creator/messages')}
              className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Messages</span>
            </button>
            <button
              onClick={() => navigate('/creator/analytics')}
              className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition"
            >
              <BarChart3 className="w-6 h-6 text-green-600" />
              <span className="text-xs font-medium text-green-900">Analytics</span>
            </button>
            <button
              onClick={() => navigate('/creator/billing')}
              className="flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 rounded-lg transition"
            >
              <CreditCard className="w-6 h-6 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Billing</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== MY PITCHES + NDA QUICK STATUS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* My Pitches — left 2/3 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Pitches</h2>
              <button
                onClick={() => navigate('/creator/pitches')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="p-6">
              {pitches?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pitches?.slice(0, 4)?.map((pitch) => (
                    <div key={pitch?.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">{pitch?.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          pitch?.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : pitch?.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {pitch?.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{pitch.views || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>{pitch.likes || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          <span>{pitch.ndaRequests || 0}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => navigate(`/creator/pitch/${pitch.id}/edit`)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => navigate(`/pitch/${pitch.id}`)}
                          className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">You haven't created any pitches yet</p>
                  <button
                    onClick={() => navigate('/creator/pitch/new')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                  >
                    Create Your First Pitch
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NDA Status + Subscription — right 1/3 */}
        <div className="space-y-6">
          <QuickNDAStatus userType="creator" />

          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-sm p-6">
            {(() => {
              const tier = getSubscriptionTier(subscription?.tier || '');
              const tierName = tier?.name || 'The Watcher';
              const isActive = subscription?.status === 'active';
              const isUnlimited = tier?.credits === -1;
              const monthlyCredits = tier?.credits || 0;

              return (
                <>
                  <h3 className="text-white font-semibold mb-2">
                    Your Plan: {tierName}
                  </h3>
                  <div className="text-purple-100 text-sm mb-4">
                    {isActive ? (
                      <div>
                        <p>
                          {isUnlimited ? 'Unlimited Credits' : `${monthlyCredits} Credits`} per month
                        </p>
                        {subscription.subscription?.currentPeriodEnd && (
                          <p>Next payment: {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {tierName === 'The Watcher' ? (
                          <>
                            <p className="font-medium mb-1">Free Plan Features:</p>
                            <ul className="text-xs space-y-0.5 mb-2">
                              <li>• Create and publish pitches</li>
                              <li>• Basic analytics dashboard</li>
                              <li>• Connect with investors</li>
                            </ul>
                            <p className="text-purple-200">Upgrade to upload documents, scripts & media files</p>
                          </>
                        ) : (
                          <p>Choose a Creator plan to unlock uploads and advanced features</p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/creator/billing?tab=subscription')}
                    className="w-full py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition"
                  >
                    {isActive ? 'Manage Subscription' : 'Choose Plan'}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ===== NDA NOTIFICATION PANEL ===== */}
      <NDANotificationPanel className="mb-8" />

      {/* ===== STATS GRID — 6 KPI Cards (pushed down) ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Total Pitches</span>
            <BarChart3 className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(safeAccess(stats, 'totalPitches', 0))}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Active Pitches</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(safeAccess(stats, 'activePitches', 0))}</p>
          <p className="text-xs text-green-500 mt-1">Currently live</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-sm">Total Views</span>
            <Eye className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(safeNumber(totalViews, 0))}</p>
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

      {/* ===== FUNDING OVERVIEW ===== */}
      {fundingMetrics && !investmentLoading && (
        <FundingOverview
          metrics={fundingMetrics}
          className="mb-8"
        />
      )}

      {/* ===== ENHANCED ANALYTICS ===== */}
      <div className="mb-8">
        <EnhancedCreatorAnalytics
          pitchPerformance={{
            totalViews: totalViews,
            viewsChange: 15,
            totalLikes: stats?.totalLikes || 0,
            likesChange: 12,
            totalShares: stats?.totalShares || 0,
            sharesChange: 8,
            potentialInvestment: fundingMetrics?.totalFunding || 0,
            investmentChange: fundingMetrics?.growth || 0
          }}
        />
      </div>

      {/* ===== CREATOR MILESTONES ===== */}
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
                <Upload className={`w-8 h-8 ${
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

      {/* ===== RECENT ACTIVITY (full-width) ===== */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          {recentActivity?.length > 0 ? (
            <div className="space-y-4">
              {recentActivity?.map((activity, index) => (
                <div key={activity?.id || index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity?.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                    activity?.color === 'green' ? 'bg-green-100 text-green-600' :
                    activity?.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                    activity?.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                    activity?.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {activity?.icon === 'eye' ? <Eye className="w-4 h-4" /> :
                     activity?.icon === 'dollar-sign' ? <CreditCard className="w-4 h-4" /> :
                     activity?.icon === 'message-circle' ? <MessageSquare className="w-4 h-4" /> :
                     activity?.icon === 'user-plus' ? <Plus className="w-4 h-4" /> :
                     <Calendar className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity?.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{activity?.description}</p>
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
  );
}

// Export with portal-specific error boundary
export default withPortalErrorBoundary(CreatorDashboard, 'creator');