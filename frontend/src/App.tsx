import React, { useEffect, useState, Suspense, lazy, startTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
// React Query temporarily disabled to resolve JavaScript initialization errors
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/Toast/ToastProvider';
import { NotificationToastProvider } from './components/Toast/NotificationToastContainer';
import LoadingSpinner from './components/Loading/LoadingSpinner';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { configService } from './services/config.service';
import { config } from './config';
import { AuthService } from './services/auth.service';

// Log environment on app load
console.log('🚀 Pitchey App Environment:', {
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
  MODE: import.meta.env.MODE,
  API_URL: config.API_URL,
  NODE_ENV: config.NODE_ENV
});

// Immediately needed components (not lazy loaded)
import Layout from './components/Layout';
import { NotificationInitializer } from './components/NotificationInitializer';
import { TestNotifications } from './components/TestNotifications';
// TestSentry component removed

// Lazy load Homepage with prefetch
const Homepage = lazy(() => 
  import('./pages/Homepage' /* webpackPrefetch: true */)
)

// Lazy loaded pages with prefetch for critical paths
const Login = lazy(() => import('./pages/Login' /* webpackPrefetch: true */));
const Register = lazy(() => import('./pages/Register' /* webpackPrefetch: true */));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Multi-Portal Pages
const PortalSelect = lazy(() => import('./pages/PortalSelect'));
const CreatorLogin = lazy(() => import('./pages/CreatorLogin'));
const InvestorLogin = lazy(() => import('./pages/InvestorLogin'));
const ProductionLogin = lazy(() => import('./pages/ProductionLogin'));
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const InvestorDashboard = lazy(() => import('./pages/InvestorDashboard'));
const InvestorDashboardDebug = lazy(() => import('./pages/InvestorDashboardDebug'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
const CreatorProfile = lazy(() => import('./pages/CreatorProfile'));

// Public Pages
const Marketplace = lazy(() => import('./pages/MarketplaceEnhanced'));
const TestMarketplace = lazy(() => import('./pages/TestMarketplace'));
const PublicPitchView = lazy(() => import('./pages/PublicPitchView'));

// Creator Pages
const CreatePitch = lazy(() => import('./pages/CreatePitch'));
const ManagePitches = lazy(() => import('./pages/ManagePitches'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Messages = lazy(() => import('./pages/Messages'));
const Calendar = lazy(() => import('./pages/Calendar'));
const PitchDetail = lazy(() => import('./pages/PitchDetail'));
const PitchEdit = lazy(() => import('./pages/PitchEdit'));
const PitchAnalytics = lazy(() => import('./pages/PitchAnalytics'));
const CreatorNDAManagement = lazy(() => import('./pages/CreatorNDAManagement'));
const CreatorPitchView = lazy(() => import('./pages/creator/CreatorPitchView'));

// Production Pages
// ProductionPitchCreate removed - production companies cannot create pitches
const ProductionPitchDetail = lazy(() => import('./pages/ProductionPitchDetail'));
const ProductionPitchView = lazy(() => import('./pages/production/ProductionPitchView'));

// Common Pages
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));

// Investor Pages
const InvestorBrowse = lazy(() => import('./pages/InvestorBrowse'));
const InvestorPitchView = lazy(() => import('./pages/investor/InvestorPitchView'));

// Billing Page
const Billing = lazy(() => import('./pages/Billing'));

// Following/Portfolio Pages
const Following = lazy(() => import('./pages/Following'));
const CreatorPortfolio = lazy(() => import('./pages/CreatorPortfolio'));
const UserPortfolio = lazy(() => import('./pages/UserPortfolio'));

// Info Pages
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/Admin/UserManagement'));
const ContentModeration = lazy(() => import('./pages/Admin/ContentModeration'));

// Coming Soon Page for unimplemented routes
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const NDARequests = lazy(() => import('./pages/investor/NDARequests'));

// New Investor Pages
const PerformanceTracking = lazy(() => import('./pages/investor/PerformanceTracking'));
const PendingDeals = lazy(() => import('./pages/investor/PendingDeals'));
const AllInvestments = lazy(() => import('./pages/investor/AllInvestments'));
const CompletedProjects = lazy(() => import('./pages/investor/CompletedProjects'));
const ROIAnalysis = lazy(() => import('./pages/investor/ROIAnalysis'));
const MarketTrends = lazy(() => import('./pages/investor/MarketTrends'));
const RiskAssessment = lazy(() => import('./pages/investor/RiskAssessment'));
const FinancialOverview = lazy(() => import('./pages/investor/FinancialOverview'));
const TransactionHistory = lazy(() => import('./pages/investor/TransactionHistory'));
const BudgetAllocation = lazy(() => import('./pages/investor/BudgetAllocation'));
const TaxDocuments = lazy(() => import('./pages/investor/TaxDocuments'));

// New Pages
const ProductionProjects = lazy(() => import('./pages/production/ProductionProjects'));
const ProductionProjectsDevelopment = lazy(() => import('./pages/production/ProductionProjectsDevelopment'));
const ProductionProjectsActive = lazy(() => import('./pages/production/ProductionProjectsActive'));
const ProductionProjectsPost = lazy(() => import('./pages/production/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazy(() => import('./pages/production/ProductionProjectsCompleted'));
const ProductionPipeline = lazy(() => import('./pages/production/ProductionPipeline'));
const ProductionSubmissions = lazy(() => import('./pages/production/ProductionSubmissions'));
const ProductionSubmissionsNew = lazy(() => import('./pages/production/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazy(() => import('./pages/production/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazy(() => import('./pages/production/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazy(() => import('./pages/production/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazy(() => import('./pages/production/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazy(() => import('./pages/production/ProductionSubmissionsArchive'));
const ProductionAnalytics = lazy(() => import('./pages/production/ProductionAnalytics'));
const ProductionActivity = lazy(() => import('./pages/production/ProductionActivity'));
const ProductionStats = lazy(() => import('./pages/production/ProductionStats'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const TeamMembers = lazy(() => import('./pages/team/TeamMembers'));
const TeamInvite = lazy(() => import('./pages/team/TeamInvite'));
const TeamRoles = lazy(() => import('./pages/production/TeamRoles'));
const ProductionCollaborations = lazy(() => import('./pages/production/ProductionCollaborations'));
const ProductionRevenue = lazy(() => import('./pages/production/ProductionRevenue'));
const ProductionSaved = lazy(() => import('./pages/production/ProductionSaved'));
const ProductionSettingsProfile = lazy(() => import('./pages/production/settings/ProductionSettingsProfile'));
const ProductionSettingsNotifications = lazy(() => import('./pages/production/settings/ProductionSettingsNotifications'));
const ProductionSettingsBilling = lazy(() => import('./pages/production/settings/ProductionSettingsBilling'));
const ProductionSettingsSecurity = lazy(() => import('./pages/production/settings/ProductionSettingsSecurity'));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SettingsProfile = lazy(() => import('./pages/settings/SettingsProfile'));
const NotificationSettings = lazy(() => import('./pages/settings/NotificationSettings'));
const PrivacySettings = lazy(() => import('./pages/settings/PrivacySettings'));
const InvestorPortfolio = lazy(() => import('./pages/investor/InvestorPortfolio'));
const InvestorActivity = lazy(() => import('./pages/investor/InvestorActivity'));
const InvestorAnalytics = lazy(() => import('./pages/investor/InvestorAnalytics'));
const InvestorStats = lazy(() => import('./pages/investor/InvestorStats'));
const InvestorSaved = lazy(() => import('./pages/investor/InvestorSaved'));
const InvestorWatchlist = lazy(() => import('./pages/investor/InvestorWatchlist'));
const InvestorDeals = lazy(() => import('./pages/investor/InvestorDeals'));
const InvestorPerformance = lazy(() => import('./pages/investor/InvestorPerformance'));
const InvestorDiscover = lazy(() => import('./pages/investor/InvestorDiscover'));
const InvestorReports = lazy(() => import('./pages/investor/InvestorReports'));
const InvestorNetwork = lazy(() => import('./pages/investor/InvestorNetwork'));
const InvestorCoInvestors = lazy(() => import('./pages/investor/InvestorCoInvestors'));
const InvestorProductionCompanies = lazy(() => import('./pages/investor/InvestorProductionCompanies'));
const InvestorCreators = lazy(() => import('./pages/investor/InvestorCreators'));
const Transactions = lazy(() => import('./pages/Admin/Transactions'));
const SystemSettings = lazy(() => import('./pages/Admin/SystemSettings'));

// Test Pages
const TestNavigation = lazy(() => import('./pages/TestNavigation'));

// Browse Pages
const BrowseGenres = lazy(() => import('./pages/BrowseGenres'));
const BrowseTopRated = lazy(() => import('./pages/BrowseTopRated'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));

// Query client temporarily disabled to resolve JavaScript initialization errors

// Component to handle pitch routing - now always shows public view
function PitchRouter() {
  // Always show the public pitch view when accessing /pitch/:id
  // Users can navigate to their portal-specific views if needed
  return <PublicPitchView />;
}

function App() {
  const { isAuthenticated, fetchProfile } = useAuthStore();
  const [profileFetched, setProfileFetched] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load configuration on app startup
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Use startTransition for non-urgent update
        startTransition(() => {
          configService.getConfiguration().then(() => {
            console.log('Configuration loaded successfully');
            setConfigLoaded(true);
          });
        });
      } catch (error) {
        console.warn('Failed to load configuration, using fallback:', error);
        setConfigLoaded(true);
      }
    };
    loadConfig();
  }, []);

  // On boot, if a token exists but is invalid for this backend, clear it to avoid loops
  useEffect(() => {
    const nsKey = (key: string) => {
      try {
        const host = new URL(config.API_URL).host;
        return `pitchey:${host}:${key}`;
      } catch {
        return `pitchey:${key}`;
      }
    };
    const removeBoth = (key: string) => {
      localStorage.removeItem(nsKey(key));
      localStorage.removeItem(key);
    };
    
    const token = AuthService.getToken();
    if (token) {
      // Only validate token if user is trying to access protected routes
      // Don't clear tokens on login pages to prevent clearing valid session data
      const isOnLoginPage = window.location.pathname.includes('/login');
      const isOnDashboardPage = window.location.pathname.includes('/dashboard');
      
      if (!isOnLoginPage) {
        // Add delay for dashboard routes to allow login process to complete
        const delay = isOnDashboardPage ? 1000 : 0;
        
        setTimeout(() => {
          AuthService.validateToken().then((res) => {
            if (!res.valid) {
              console.log('Token validation failed, clearing auth data');
              removeBoth('authToken');
              removeBoth('user');
              removeBoth('userType');
              // Only redirect if we're on a protected route
              if (isOnDashboardPage) {
                window.location.href = '/login/investor';
              }
            } else {
              console.log('Token validation successful for user:', res.user?.email);
            }
          }).catch((error) => {
            console.log('Token validation error:', error);
            // Only clear tokens if this is a real validation failure, not a network error
            if (error.response?.status === 401 || error.response?.status === 403) {
              removeBoth('authToken');
              removeBoth('user');
              removeBoth('userType');
              if (isOnDashboardPage) {
                window.location.href = '/login/investor';
              }
            } else {
              console.log('Network error during token validation, keeping token');
            }
          });
        }, delay);
      }
    }
  }, []);

  useEffect(() => {
    // Only fetch profile once when authenticated and not yet fetched
    if (isAuthenticated && !profileFetched) {
      startTransition(() => {
        fetchProfile().finally(() => setProfileFetched(true));
      });
    }
  }, [isAuthenticated, profileFetched, fetchProfile]);

  const userType = (() => {
    try {
      const host = new URL(config.API_URL).host;
      const ns = localStorage.getItem(`pitchey:${host}:userType`);
      return ns ?? localStorage.getItem('userType');
    } catch {
      return localStorage.getItem('userType');
    }
  })();

  return (
    <ErrorBoundary enableSentryReporting={true} showErrorDetails={!import.meta.env.PROD}>
        <WebSocketProvider>
          <NotificationToastProvider>
            <ToastProvider>
            {/* TestSentry component removed */}
            <NotificationInitializer />
            <TestNotifications />
            <Router>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                  <LoadingSpinner size="lg" text="Loading..." />
                  <p className="mt-4 text-gray-600">Optimizing your experience...</p>
                </div>
              </div>
            }>
              <Routes>
          {/* Homepage - Default route */}
          <Route path="/" element={<Homepage />} />
          
          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace-old" element={<Marketplace />} />
          
          {/* Browse Route */}
          <Route path="/browse" element={<Marketplace />} />
          <Route path="/test-marketplace" element={<TestMarketplace />} />
          
          {/* Info Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          
          {/* Test Pages */}
          <Route path="/test/navigation" element={<TestNavigation />} />
          
          {/* Portal Selection */}
          <Route path="/portals" element={<PortalSelect />} />
          
          {/* Multi-Portal Login Routes */}
          <Route path="/login/creator" element={<CreatorLogin />} />
          <Route path="/login/investor" element={<InvestorLogin />} />
          <Route path="/login/production" element={<ProductionLogin />} />
          
          {/* Portal-specific login redirects */}
          <Route path="/investor/login" element={<Navigate to="/login/investor" replace />} />
          <Route path="/creator/login" element={<Navigate to="/login/creator" replace />} />
          <Route path="/production/login" element={<Navigate to="/login/production" replace />} />
          <Route path="/login/admin" element={
            !isAuthenticated ? <Login /> : 
            userType === 'admin' ? <Navigate to="/admin/dashboard" /> :
            <Navigate to="/" />
          } />
          
          {/* Legacy routes (backwards compatibility) */}
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
          
          {/* Role-specific Protected Dashboards */}
          <Route path="/creator/dashboard" element={
            isAuthenticated && userType === 'creator' ? <CreatorDashboard /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitch/new" element={
            isAuthenticated && userType === 'creator' ? <CreatePitch /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitches" element={
            isAuthenticated && userType === 'creator' ? <ManagePitches /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/analytics" element={
            isAuthenticated && userType === 'creator' ? <Analytics /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/messages" element={
            isAuthenticated && userType === 'creator' ? <Messages /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/calendar" element={
            isAuthenticated && userType === 'creator' ? <Calendar /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitch/:id" element={
            isAuthenticated && userType === 'creator' ? <CreatorPitchView /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitches/:id" element={
            isAuthenticated && userType === 'creator' ? <PitchDetail /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitch/:id/edit" element={
            isAuthenticated && userType === 'creator' ? <PitchEdit /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitches/:id/edit" element={
            isAuthenticated && userType === 'creator' ? <PitchEdit /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitches/:id/analytics" element={
            isAuthenticated && userType === 'creator' ? <PitchAnalytics /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/pitches/:id/:slug/analytics" element={
            isAuthenticated && userType === 'creator' ? <PitchAnalytics /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/ndas" element={
            isAuthenticated && userType === 'creator' ? <CreatorNDAManagement /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/following" element={
            isAuthenticated && userType === 'creator' ? <Following /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/investor/dashboard" element={
            isAuthenticated && userType === 'investor' ? <InvestorDashboard /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/investor/dashboard/debug" element={
            isAuthenticated && userType === 'investor' ? <InvestorDashboardDebug /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/investor/following" element={
            isAuthenticated && userType === 'investor' ? <Following /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/investor/browse" element={
            isAuthenticated && userType === 'investor' ? <InvestorBrowse /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/investor/pitch/:id" element={
            isAuthenticated && userType === 'investor' ? <InvestorPitchView /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/production/dashboard" element={
            isAuthenticated && userType === 'production' ? <ProductionDashboard /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          <Route path="/production/following" element={
            isAuthenticated && userType === 'production' ? <Following /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          <Route path="/production/pitch/:id" element={
            isAuthenticated && userType === 'production' ? <ProductionPitchView /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          {/* Production companies cannot create or edit pitches - routes removed */}
          
          {/* Admin Protected Routes */}
          <Route path="/admin/dashboard" element={
            isAuthenticated && userType === 'admin' ? <AdminDashboard /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/admin" />
          } />
          <Route path="/admin/users" element={
            isAuthenticated && userType === 'admin' ? <UserManagement /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/admin" />
          } />
          <Route path="/admin/content" element={
            isAuthenticated && userType === 'admin' ? <ContentModeration /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/admin" />
          } />
          <Route path="/admin/transactions" element={
            isAuthenticated && userType === 'admin' ? <Transactions /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/admin" />
          } />
          <Route path="/admin/settings" element={
            isAuthenticated && userType === 'admin' ? <SystemSettings /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/admin" />
          } />
          
          {/* Creator Profile Route - accessible to all authenticated users */}
          <Route path="/creator/:creatorId" element={
            isAuthenticated ? <CreatorProfile /> : <Navigate to="/login/production" />
          } />
          <Route path="/pitch/:id/analytics" element={
            isAuthenticated && userType === 'production' ? <PitchAnalytics /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          
          {/* Public pitch detail route */}
          <Route path="/pitch/:id" element={<PitchRouter />} />
          
          {/* Legacy Portfolio Routes (for backward compatibility) */}
          <Route path="/creator/portfolio" element={<CreatorPortfolio />} />
          <Route path="/creator/portfolio-auth" element={
            isAuthenticated && userType === 'creator' ? <CreatorPortfolio /> : 
            <Navigate to="/login/creator" />
          } />
          <Route path="/creator/:creatorId" element={<CreatorPortfolio />} />
          
          {/* New Unified Portfolio Routes */}
          <Route path="/portfolio" element={<UserPortfolio />} />
          <Route path="/portfolio/:userId" element={<UserPortfolio />} />
          <Route path="/user/:userId" element={<UserPortfolio />} />
          
          {/* Common Protected Routes - Available to all user types */}
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/portals" />} />
          <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/portals" />} />
          <Route path="/notifications" element={isAuthenticated ? <NotificationCenter /> : <Navigate to="/portals" />} />
          
          {/* Billing Routes - Available to all authenticated users */}
          <Route path="/billing" element={isAuthenticated ? <Billing /> : <Navigate to="/portals" />} />
          <Route path="/creator/billing" element={
            isAuthenticated && userType === 'creator' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/investor/billing" element={
            isAuthenticated && userType === 'investor' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/investor" />
          } />
          <Route path="/production/billing" element={
            isAuthenticated && userType === 'production' ? <Billing /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          
          {/* Legacy Protected routes */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/portals" />} />
            <Route path="/pitch/new" element={
              isAuthenticated && userType === 'creator' ? <CreatePitch /> : 
              isAuthenticated ? <Navigate to={`/${userType}/dashboard`} /> :
              <Navigate to="/portals" />
            } />
          </Route>
          
          {/* Enhanced Navigation Routes - Using Functional Pages */}
          {/* Production Routes */}
          <Route path="/production/projects" element={isAuthenticated && userType === 'production' ? <ProductionProjects /> : <Navigate to="/login/production" />} />
          <Route path="/production/projects/development" element={isAuthenticated && userType === 'production' ? <ProductionProjectsDevelopment /> : <Navigate to="/login/production" />} />
          <Route path="/production/projects/production" element={isAuthenticated && userType === 'production' ? <ProductionProjectsActive /> : <Navigate to="/login/production" />} />
          <Route path="/production/projects/post" element={isAuthenticated && userType === 'production' ? <ProductionProjectsPost /> : <Navigate to="/login/production" />} />
          <Route path="/production/projects/completed" element={isAuthenticated && userType === 'production' ? <ProductionProjectsCompleted /> : <Navigate to="/login/production" />} />
          <Route path="/production/pipeline" element={isAuthenticated && userType === 'production' ? <ProductionPipeline /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions" element={isAuthenticated && userType === 'production' ? <ProductionSubmissions /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/new" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsNew /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/review" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsReview /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/shortlisted" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsShortlisted /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/accepted" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsAccepted /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/rejected" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsRejected /> : <Navigate to="/login/production" />} />
          <Route path="/production/submissions/archive" element={isAuthenticated && userType === 'production' ? <ProductionSubmissionsArchive /> : <Navigate to="/login/production" />} />
          <Route path="/production/team" element={isAuthenticated && userType === 'production' ? <TeamManagement /> : <Navigate to="/login/production" />} />
          <Route path="/production/team/members" element={isAuthenticated && userType === 'production' ? <TeamMembers /> : <Navigate to="/login/production" />} />
          <Route path="/production/team/invite" element={isAuthenticated && userType === 'production' ? <TeamInvite /> : <Navigate to="/login/production" />} />
          <Route path="/production/team/roles" element={isAuthenticated && userType === 'production' ? <TeamRoles /> : <Navigate to="/login/production" />} />
          <Route path="/production/collaborations" element={isAuthenticated && userType === 'production' ? <ProductionCollaborations /> : <Navigate to="/login/production" />} />
          <Route path="/production/analytics" element={isAuthenticated && userType === 'production' ? <ProductionAnalytics /> : <Navigate to="/login/production" />} />
          <Route path="/production/activity" element={isAuthenticated && userType === 'production' ? <ProductionActivity /> : <Navigate to="/login/production" />} />
          <Route path="/production/stats" element={isAuthenticated && userType === 'production' ? <ProductionStats /> : <Navigate to="/login/production" />} />
          <Route path="/production/revenue" element={isAuthenticated && userType === 'production' ? <ProductionRevenue /> : <Navigate to="/login/production" />} />
          <Route path="/production/saved" element={isAuthenticated && userType === 'production' ? <ProductionSaved /> : <Navigate to="/login/production" />} />
          <Route path="/production/settings/profile" element={isAuthenticated && userType === 'production' ? <ProductionSettingsProfile /> : <Navigate to="/login/production" />} />
          <Route path="/production/settings/notifications" element={isAuthenticated && userType === 'production' ? <ProductionSettingsNotifications /> : <Navigate to="/login/production" />} />
          <Route path="/production/settings/billing" element={isAuthenticated && userType === 'production' ? <ProductionSettingsBilling /> : <Navigate to="/login/production" />} />
          <Route path="/production/settings/security" element={isAuthenticated && userType === 'production' ? <ProductionSettingsSecurity /> : <Navigate to="/login/production" />} />
          
          {/* Creator Routes */}
          <Route path="/creator/activity" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/stats" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/pitches/published" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/pitches/drafts" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/pitches/review" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/pitches/analytics" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/team" element={isAuthenticated && userType === 'creator' ? <TeamManagement /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/team/members" element={isAuthenticated && userType === 'creator' ? <TeamMembers /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/team/invite" element={isAuthenticated && userType === 'creator' ? <TeamInvite /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/team/roles" element={isAuthenticated && userType === 'creator' ? <TeamManagement /> : <Navigate to="/login/creator" />} />
          <Route path="/creator/collaborations" element={isAuthenticated && userType === 'creator' ? <ComingSoon /> : <Navigate to="/login/creator" />} />
          
          {/* Investor Routes */}
          <Route path="/investor/notifications" element={isAuthenticated && userType === 'investor' ? <NotificationCenter /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/activity" element={isAuthenticated && userType === 'investor' ? <InvestorActivity /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/stats" element={isAuthenticated && userType === 'investor' ? <InvestorStats /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/portfolio" element={isAuthenticated && userType === 'investor' ? <InvestorPortfolio /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/portfolio/active" element={isAuthenticated && userType === 'investor' ? <InvestorPortfolio /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/portfolio/pending" element={isAuthenticated && userType === 'investor' ? <PendingDeals /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/investments" element={isAuthenticated && userType === 'investor' ? <Navigate to="/investor/portfolio" /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/discover" element={isAuthenticated && userType === 'investor' ? <InvestorDiscover /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/discover/genres" element={isAuthenticated && userType === 'investor' ? <InvestorDiscover /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/saved" element={isAuthenticated && userType === 'investor' ? <InvestorSaved /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/watchlist" element={isAuthenticated && userType === 'investor' ? <InvestorWatchlist /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/deals" element={isAuthenticated && userType === 'investor' ? <InvestorDeals /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/performance" element={isAuthenticated && userType === 'investor' ? <InvestorPerformance /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/ndas" element={isAuthenticated && userType === 'investor' ? <NDARequests /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/nda-requests" element={isAuthenticated && userType === 'investor' ? <NDARequests /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/nda-requests/:status" element={isAuthenticated && userType === 'investor' ? <NDARequests /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/analytics" element={isAuthenticated && userType === 'investor' ? <InvestorAnalytics /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/analytics/market" element={isAuthenticated && userType === 'investor' ? <MarketTrends /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/analytics/risk" element={isAuthenticated && userType === 'investor' ? <RiskAssessment /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/analytics/roi" element={isAuthenticated && userType === 'investor' ? <ROIAnalysis /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/reports" element={isAuthenticated && userType === 'investor' ? <InvestorReports /> : <Navigate to="/login/investor" />} />
          
          {/* New Investor Routes - with both legacy and consistent paths */}
          <Route path="/investor/performance-tracking" element={isAuthenticated && userType === 'investor' ? <PerformanceTracking /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/performance" element={isAuthenticated && userType === 'investor' ? <PerformanceTracking /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/pending-deals" element={isAuthenticated && userType === 'investor' ? <PendingDeals /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/pending" element={isAuthenticated && userType === 'investor' ? <PendingDeals /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/all-investments" element={isAuthenticated && userType === 'investor' ? <AllInvestments /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/completed-projects" element={isAuthenticated && userType === 'investor' ? <CompletedProjects /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/completed" element={isAuthenticated && userType === 'investor' ? <CompletedProjects /> : <Navigate to="/login/investor" />} />
          
          {/* Analytics Routes - with simplified aliases and preview support */}
          <Route path="/investor/roi-analysis" element={isAuthenticated && userType === 'investor' ? <ROIAnalysis /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/roi" element={isAuthenticated && userType === 'investor' ? <ROIAnalysis /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/market-trends" element={isAuthenticated && userType === 'investor' ? <MarketTrends /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/trends" element={isAuthenticated && userType === 'investor' ? <MarketTrends /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/risk-assessment" element={isAuthenticated && userType === 'investor' ? <RiskAssessment /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/risk" element={isAuthenticated && userType === 'investor' ? <RiskAssessment /> : <Navigate to="/login/investor" />} />
          
          {/* Financial Routes - with simplified aliases */}
          <Route path="/investor/financial-overview" element={isAuthenticated && userType === 'investor' ? <FinancialOverview /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/financials" element={isAuthenticated && userType === 'investor' ? <FinancialOverview /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/transaction-history" element={isAuthenticated && userType === 'investor' ? <TransactionHistory /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/transactions" element={isAuthenticated && userType === 'investor' ? <TransactionHistory /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/budget-allocation" element={isAuthenticated && userType === 'investor' ? <BudgetAllocation /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/budget" element={isAuthenticated && userType === 'investor' ? <BudgetAllocation /> : <Navigate to="/login/investor" />} />
          
          <Route path="/investor/tax-documents" element={isAuthenticated && userType === 'investor' ? <TaxDocuments /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/tax" element={isAuthenticated && userType === 'investor' ? <TaxDocuments /> : <Navigate to="/login/investor" />} />
          
          {/* Investor Network Routes */}
          <Route path="/investor/network" element={isAuthenticated && userType === 'investor' ? <InvestorNetwork /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/co-investors" element={isAuthenticated && userType === 'investor' ? <InvestorCoInvestors /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/production-companies" element={isAuthenticated && userType === 'investor' ? <InvestorProductionCompanies /> : <Navigate to="/login/investor" />} />
          <Route path="/investor/creators" element={isAuthenticated && userType === 'investor' ? <InvestorCreators /> : <Navigate to="/login/investor" />} />
          
          {/* Browse Routes - Public access */}
          <Route path="/browse/genres" element={<BrowseGenres />} />
          <Route path="/browse/top-rated" element={<BrowseTopRated />} />
          <Route path="/search" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/advanced" element={isAuthenticated ? <AdvancedSearch /> : <Navigate to="/portals" />} />
          <Route path="/search/genre" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/budget" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/creators" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/search/companies" element={isAuthenticated ? <SearchPage /> : <Navigate to="/portals" />} />
          <Route path="/settings/profile" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/settings/account" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/settings/privacy" element={isAuthenticated ? <PrivacySettings /> : <Navigate to="/portals" />} />
          <Route path="/settings/notifications" element={isAuthenticated ? <NotificationSettings /> : <Navigate to="/portals" />} />
          <Route path="/settings/billing" element={isAuthenticated ? <Billing /> : <Navigate to="/portals" />} />
          <Route path="/settings/api" element={isAuthenticated ? <SettingsProfile /> : <Navigate to="/portals" />} />
          <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/portals" />} />
          
          {/* Generic Team Routes - Available to all authenticated users */}
          <Route path="/team" element={isAuthenticated ? <TeamManagement /> : <Navigate to="/portals" />} />
          <Route path="/team/members" element={isAuthenticated ? <TeamMembers /> : <Navigate to="/portals" />} />
          <Route path="/team/invite" element={isAuthenticated ? <TeamInvite /> : <Navigate to="/portals" />} />
          
                {/* 404 - Must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Router>
            </ToastProvider>
          </NotificationToastProvider>
        </WebSocketProvider>
    </ErrorBoundary>
  );
}

export default App;