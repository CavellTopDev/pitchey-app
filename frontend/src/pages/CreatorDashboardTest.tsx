import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp, Eye, Upload, BarChart3, LogOut, Plus, Coins, Shield, Bell, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { paymentsAPI } from '../lib/apiServices';
import apiClient from '../lib/api-client';
import { NotificationBell } from '../components/NotificationBell';
import { getSubscriptionTier } from '../config/subscription-plans';
import { EnhancedCreatorAnalytics } from '../components/Analytics/EnhancedCreatorAnalytics';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { WebSocketMessage } from '../types/websocket';

// CSS for animations (using Tailwind's arbitrary value syntax)
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }
`;

export default function CreatorDashboardTest() {
  const navigate = useNavigate();
  const { logout, user: authUser } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [credits, setCredits] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  // Additional UI-only state
  const [followers, setFollowers] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; title: string; description: string }>>([]);
  const [ndaStats, setNdaStats] = useState<{ pending: number; active: number }>({ pending: 0, active: 0 });
  
  // Animation states for real-time updates
  const [animatingViews, setAnimatingViews] = useState(false);
  const [animatingFollowers, setAnimatingFollowers] = useState(false);
  const [animatingNdas, setAnimatingNdas] = useState(false);
  
  // WebSocket integration
  const { 
    isConnected, 
    connectionStatus, 
    subscribeToMessages, 
    subscribeToDashboard,
    subscribeToNotifications
  } = useWebSocket();

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

  // Real-time dashboard message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    
    switch (message.type) {
      case 'view_update':
      case 'view-update':
        setAnimatingViews(true);
        setTotalViews((prev) => {
          const newViews = message.data?.totalViews ?? (prev + 1);
          return newViews;
        });
        setTimeout(() => setAnimatingViews(false), 1000);
        break;
        
      case 'new_follower':
      case 'new-follower':
        setAnimatingFollowers(true);
        setFollowers((prev) => {
          const newFollowers = message.data?.followerCount ?? (prev + 1);
          return newFollowers;
        });
        setTimeout(() => setAnimatingFollowers(false), 1000);
        break;
        
      case 'nda_request':
      case 'nda-request':
        setAnimatingNdas(true);
        setNdaStats((prev) => {
          const newStats = {
            ...prev,
            pending: message.data?.pendingCount ?? (prev.pending + 1)
          };
          return newStats;
        });
        setTimeout(() => setAnimatingNdas(false), 1000);
        break;
        
      case 'activity':
        if (message.data?.activity) {
          const newActivity = {
            id: message.data.activity.id || `activity_${Date.now()}`,
            title: message.data.activity.title || 'New Activity',
            description: message.data.activity.description || ''
          };
          setRecentActivity((prev) => [newActivity, ...prev].slice(0, 5));
        }
        break;
        
      case 'notification':
        // NotificationBell component will handle this via its own subscription
        break;
        
      case 'dashboard_update':
        if (message.data) {
          if (message.data.totalViews !== undefined) {
            setTotalViews(message.data.totalViews);
          }
          if (message.data.followersCount !== undefined) {
            setFollowers(message.data.followersCount);
          }
          if (message.data.ndaStats) {
            setNdaStats({
              pending: message.data.ndaStats.pending ?? 0,
              active: message.data.ndaStats.active ?? 0
            });
          }
        }
        break;
        
      default:
        // Only log unknown messages in development
        if (import.meta.env.DEV) {
        }
    }
  }, []);
  
  // Subscribe to WebSocket messages
  useEffect(() => {
    if (!isConnected) return;
    
    const unsubscribeMessages = subscribeToMessages(handleWebSocketMessage);
    const unsubscribeDashboard = subscribeToDashboard((metrics) => {
      if (metrics.pitchViews !== undefined) {
        setTotalViews(metrics.pitchViews);
      }
      // Add more metric updates as needed
    });
    
    return () => {
      unsubscribeMessages();
      unsubscribeDashboard();
    };
  }, [isConnected, subscribeToMessages, subscribeToDashboard, handleWebSocketMessage]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = authUser || (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
      const userId = currentUser?.id;

      const [dashboardResponse, creditsData, subscriptionData, followersResponse, pendingNDAs, activeNDAs] = await Promise.all([
        apiClient.get('/api/creator/dashboard'),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getSubscriptionStatus(),
        userId ? apiClient.get(`/api/follows/stats/${userId}`) : Promise.resolve({ success: true, data: { followersCount: 0, followingCount: 0 } }),
        apiClient.get('/api/nda/pending'),
        apiClient.get('/api/nda/active'),
      ]);
      
      if (dashboardResponse.success) {
        const data = dashboardResponse.data || {};
        const statsData = data.stats || {};
        setStats({
          totalPitches: statsData.totalPitches || 0,
          activePitches: statsData.activePitches || 0,
          totalViews: statsData.totalViews || 0,
        });
        setTotalViews(statsData.totalViews || 0);
        setAvgRating(Number((statsData.avgRating || 0).toFixed(1)));
        if (Array.isArray(data.recentActivity)) {
          setRecentActivity(data.recentActivity.map((a: any, idx: number) => ({
            id: (a.id ?? idx).toString(),
            title: a.title || 'Activity',
            description: a.description || ''
          })));
        }
        setFollowers(statsData.followersCount || followersResponse.data?.followersCount || 0);
      }

      setNdaStats({
        pending: pendingNDAs.data?.count ?? (pendingNDAs.data?.ndas?.length ?? 0),
        active: activeNDAs.data?.count ?? (activeNDAs.data?.ndas?.length ?? 0),
      });
      
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
      {/* Inject custom CSS for animations */}
      <style>{styles}</style>
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
              {/* WebSocket Connection Status */}
              <div 
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-all duration-200 ${
                  isConnected 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : connectionStatus.reconnecting
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
                title={`WebSocket: ${
                  isConnected 
                    ? 'Connected - Real-time updates active' 
                    : connectionStatus.reconnecting 
                    ? `Reconnecting... (attempt ${connectionStatus.reconnectAttempts})` 
                    : 'Disconnected - Live updates unavailable'
                }`}
              >
                {isConnected ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">
                  {isConnected 
                    ? 'Live' 
                    : connectionStatus.reconnecting 
                    ? 'Reconnecting' 
                    : 'Offline'
                  }
                </span>
                {isConnected && (
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              
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

              {/* Subscription Chip */}
              <button
                onClick={() => navigate('/creator/billing?tab=subscription')}
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                title="Manage subscription"
              >
                <span className="font-medium text-gray-700 truncate max-w-24">
                  {(() => {
                    const tier = getSubscriptionTier(subscription?.tier || '');
                    return tier?.name || 'The Watcher';
                  })()}
                </span>
                {subscription?.status === 'active' && (
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                )}
              </button>
              
              <button
                onClick={() => navigate('/creator/following')}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Following
              </button>

              <button
                onClick={() => navigate('/marketplace')}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition"
              >
                <Eye className="w-4 h-4" />
                Browse Marketplace
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
          
          <div className={`bg-white rounded-xl shadow-sm p-6 transition-all duration-300 ${
            animatingViews ? 'ring-2 ring-blue-400 ring-opacity-50 shadow-lg scale-105' : ''
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Total Views</span>
              <Eye className={`w-5 h-5 text-blue-500 transition-transform duration-300 ${
                animatingViews ? 'scale-110' : ''
              }`} />
            </div>
            <p className={`text-2xl font-bold text-gray-900 transition-all duration-300 ${
              animatingViews ? 'text-blue-600 scale-110' : ''
            }`}>
              {totalViews.toLocaleString()}
            </p>
            {animatingViews && (
              <div className="text-xs text-blue-600 mt-1 animate-fade-in">
                +1 view
              </div>
            )}
          </div>
        </div>

        {/* Extra Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Avg Rating</span>
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
          </div>
          
          <div className={`bg-white rounded-xl shadow-sm p-6 transition-all duration-300 ${
            animatingFollowers ? 'ring-2 ring-purple-400 ring-opacity-50 shadow-lg scale-105' : ''
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Followers</span>
              <svg className={`w-5 h-5 text-blue-500 transition-transform duration-300 ${
                animatingFollowers ? 'scale-110' : ''
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <p className={`text-2xl font-bold text-gray-900 transition-all duration-300 ${
              animatingFollowers ? 'text-purple-600 scale-110' : ''
            }`}>
              {followers.toLocaleString()}
            </p>
            {animatingFollowers && (
              <div className="text-xs text-purple-600 mt-1 animate-fade-in">
                +1 follower
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Engagement Rate</span>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">0%</p>
            <p className="text-xs text-purple-500 mt-1">Interest per pitch</p>
          </div>
        </div>

        {/* Enhanced Analytics Section (uses mock fallback if API not available) */}
        <div className="mb-8">
          <EnhancedCreatorAnalytics
            disableRemoteFetch={false}
            pitchPerformance={{
              totalViews: totalViews,
              viewsChange: 0,
              totalLikes: 0,
              likesChange: 0,
              totalShares: 0,
              sharesChange: 0,
              potentialInvestment: 0,
              investmentChange: 0,
            }}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button onClick={() => navigate('/creator/pitch/new')} className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition">
              <Upload className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Upload New Pitch</span>
            </button>
            <button onClick={() => navigate('/creator/pitches')} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Manage Pitches</span>
            </button>
            <button onClick={() => navigate('/creator/analytics')} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">View Analytics</span>
            </button>
            <button onClick={() => navigate('/creator/ndas')} className="flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium text-gray-900">NDA Management</span>
            </button>
            <button onClick={() => navigate('/creator/portfolio')} className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="text-sm font-medium text-gray-900">View My Portfolio</span>
            </button>
            <button onClick={() => navigate('/creator/following')} className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <span className="text-sm font-medium text-gray-900">Following</span>
            </button>
            <button onClick={() => navigate('/creator/messages')} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h6m-6 4h8l4-4V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12l4-4z" /></svg>
              <span className="text-sm font-medium text-gray-900">Messages</span>
            </button>
            <button onClick={() => navigate('/creator/calendar')} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-sm font-medium text-gray-900">Calendar</span>
            </button>
            <button onClick={() => navigate('/creator/billing')} className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 rounded-lg transition">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3v1H7a1 1 0 100 2h2v1a3 3 0 106 0v-1h2a1 1 0 100-2h-2v-1c0-1.657-1.343-3-3-3z" /></svg>
              <span className="text-sm font-medium text-blue-900">Billing & Payments</span>
            </button>
          </div>
        </div>

        {/* Recent Activity (UI-only) */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.slice(0,5).map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">•</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.description}</p>
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

        {/* Subscription Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-sm p-6 mt-6">
          {(() => {
            const tier = getSubscriptionTier(subscription?.tier || '');
            const tierName = tier?.name || 'The Watcher';
            const isActive = subscription?.status === 'active';
            const isUnlimited = tier?.credits === -1;
            const monthlyCredits = tier?.credits || 0;
            
            return (
              <>
                <h3 className="text-white font-semibold mb-2">Your Plan: {tierName}</h3>
                <div className="text-purple-100 text-sm mb-4">
                  {isActive ? (
                    <div>
                      <p>{isUnlimited ? 'Unlimited Credits' : `${monthlyCredits} Credits`} per month</p>
                      {subscription?.subscription?.currentPeriodEnd && (
                        <p>Next payment: {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                      )}
                    </div>
                  ) : (
                    <p>{tierName === 'The Watcher' ? 'Free tier - Create pitches but cannot upload files. Upgrade to start uploading!' : 'Choose a Creator plan to unlock uploads and advanced features'}</p>
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

        {/* Creator Milestones & Goals (UI-only, no API) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Milestones */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Creator Milestones</h2>
            <div className="space-y-4">
              {/* First Pitch */}
              <div className={`p-4 rounded-lg border-2 ${ (stats?.totalPitches || 0) > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50' }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">First Pitch</span>
                  {(stats?.totalPitches || 0) > 0 && (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <p className="text-xs text-gray-600">{(stats?.totalPitches || 0) > 0 ? 'Completed' : 'Upload your first pitch'}</p>
              </div>

              {/* 100 Views */}
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">100 Views</span>
                  <span className="text-xs text-blue-700">{Math.min(totalViews, 100)}/100</span>
                </div>
                <div className="w-full h-2 bg-blue-100 rounded">
                  <div className="h-2 bg-blue-600 rounded" style={{ width: `${Math.min((totalViews/100)*100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Tips & Links */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tips & Resources</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
              <li>Keep titles clear and compelling to improve views.</li>
              <li>Share your pitch link to reach early followers.</li>
              <li>Add a strong logline and visuals to increase engagement.</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <button onClick={() => navigate('/creator/analytics')} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border">View Analytics</button>
              <button onClick={() => navigate('/creator/portfolio')} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border">My Portfolio</button>
            </div>
          </div>
        </div>

        {/* Next Goals Progress (UI-only) */}
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Your Next Goals</h4>
          <div className="space-y-3">
            {/* Views to 1000 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min((totalViews / 1000) * 100, 100)}%` }} />
              </div>
              <span className="text-xs text-gray-600">{Math.min(totalViews, 1000)}/1000 views</span>
            </div>
            {/* Followers to 50 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min((followers / 50) * 100, 100)}%` }} />
              </div>
              <span className="text-xs text-gray-600">{Math.min(followers, 50)}/50 followers</span>
            </div>
            {/* Pitches to 5 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(((stats?.totalPitches || 0) / 5) * 100, 100)}%` }} />
              </div>
              <span className="text-xs text-gray-600">{stats?.totalPitches || 0}/5 pitches</span>
            </div>
          </div>
        </div>

        {/* Quick NDA Status (UI-only) */}
        <div className="mt-6 p-4 bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> NDA Quick Status
            </h3>
            <button onClick={() => navigate('/creator/ndas')} className="text-sm text-purple-600 hover:text-purple-700">Manage</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg bg-amber-50 border border-amber-200 transition-all duration-300 ${
              animatingNdas ? 'ring-2 ring-amber-400 ring-opacity-50 shadow-lg scale-105' : ''
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-700">Pending</span>
                <Bell className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${
                  animatingNdas ? 'scale-110' : ''
                }`} />
              </div>
              <p className={`text-2xl font-bold text-amber-700 mt-1 transition-all duration-300 ${
                animatingNdas ? 'text-amber-800 scale-110' : ''
              }`}>
                {ndaStats.pending}
              </p>
              {animatingNdas && (
                <div className="text-xs text-amber-700 mt-1 animate-fade-in">
                  New NDA request
                </div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Active</span>
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{ndaStats.active}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
