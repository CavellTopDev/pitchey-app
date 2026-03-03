import React, { useEffect, useState, Suspense, lazy, startTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// React Query temporarily disabled to resolve JavaScript initialization errors
// Using Better Auth store instead of legacy authStore
import { useBetterAuthStore } from './store/betterAuthStore';
import { GlobalErrorBoundary } from '@shared/components/feedback/ConsoleErrorBoundary';
import ToastProvider from '@shared/components/feedback/ToastProvider';
import { NotificationToastProvider } from '@shared/components/feedback/NotificationToastContainer';
import LoadingSpinner from '@shared/components/feedback/LoadingSpinner';
// Import safe context provider (without legacy AuthProvider)
import { AppContextProviderSafe } from '@shared/contexts/AppContextProviderSafe';
import { configService } from './services/config.service';
import { config, API_URL } from './config';
import { AuthService } from './services/auth.service';
// Import enhanced route components
import { AllCreatorRoutes, AllInvestorRoutes, AllProductionRoutes } from './components/routing/AllEnhancedRoutes';
// Import new Portal Layout
import { PortalLayout } from '@shared/components/layout/PortalLayout';
import { ProfileGuard } from '@/features/auth/components/ProfileGuard';
import { PermissionRoute } from '@features/auth/components/PermissionGuard';
import { Permission } from '@features/auth/hooks/usePermissions';

// Log environment on app load (dev only)
if (import.meta.env.DEV) {
  console.info('Pitchey App Environment:', {
    MODE: import.meta.env.MODE,
    API_URL: API_URL,
  });
}

// Immediately needed components (not lazy loaded)
import Layout from './components/Layout';
import { NotificationInitializer } from '@features/notifications/components/NotificationInitializer';
// TestNotifications and TestSentry components removed

// Lazy load Homepage with prefetch
const Homepage = lazy(() => 
  import('./pages/Homepage' /* webpackPrefetch: true */)
)

// Lazy loaded pages with prefetch for critical paths
const Login = lazy(() => import('./pages/Login' /* webpackPrefetch: true */));
const Register = lazy(() => import('./pages/Register' /* webpackPrefetch: true */));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Onboarding Components (lazy-loaded to defer onboarding CSS)
const OnboardingSettings = lazy(() => import('./components/Onboarding/OnboardingSettings'));

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
const OnboardingPage = lazy(() => import('@portals/creator/pages/CreatorOnboardingPage'));

// Public Pages
const Marketplace = lazy(() => import('./pages/MarketplaceEnhanced'));
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
const CreatorPitchView = lazy(() => import('@portals/creator/pages/CreatorPitchView'));
const CreatorActivity = lazy(() => import('@portals/creator/pages/CreatorActivity'));
const CreatorStats = lazy(() => import('@portals/creator/pages/CreatorStats'));
const CreatorPitchesPublished = lazy(() => import('@portals/creator/pages/CreatorPitchesPublished'));
const CreatorPitchesDrafts = lazy(() => import('@portals/creator/pages/CreatorPitchesDrafts'));
const CreatorPitchesReview = lazy(() => import('@portals/creator/pages/CreatorPitchesReview'));
const CreatorPitchesAnalytics = lazy(() => import('@portals/creator/pages/CreatorPitchesAnalytics'));
const CreatorTeamMembers = lazy(() => import('@portals/creator/pages/CreatorTeamMembers'));
const CreatorTeamInvite = lazy(() => import('@portals/creator/pages/CreatorTeamInvite'));
const CreatorTeamRoles = lazy(() => import('@portals/creator/pages/CreatorTeamRoles'));
const CreatorCollaborations = lazy(() => import('@portals/creator/pages/CreatorCollaborations'));
const CreatorAnalyticsPage = lazy(() => import('./pages/CreatorAnalyticsPage'));
const ProductionAnalyticsPage = lazy(() => import('./pages/ProductionAnalyticsPage'));
// TeamManagementPage removed — consolidated into TeamManagement

// Production Pages
// ProductionPitchCreate removed - production companies cannot create pitches
const ProductionPitchDetail = lazy(() => import('./pages/ProductionPitchDetail'));
const ProductionPitchView = lazy(() => import('@portals/production/pages/ProductionPitchView'));

// Common Pages
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));

// Investor Pages
const InvestorBrowse = lazy(() => import('./pages/InvestorBrowse'));
const InvestorPitchView = lazy(() => import('@portals/investor/pages/InvestorPitchView'));

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
const AdminDashboard = lazy(() => import('@portals/admin/pages/AdminDashboard'));
const UserManagement = lazy(() => import('@portals/admin/pages/UserManagement'));
const ContentModeration = lazy(() => import('@portals/admin/pages/ContentModeration'));

// Coming Soon Page for unimplemented routes
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const NDARequests = lazy(() => import('@portals/investor/pages/NDARequests'));

// New Investor Pages
const PerformanceTracking = lazy(() => import('@portals/investor/pages/PerformanceTracking'));
const PendingDeals = lazy(() => import('@portals/investor/pages/PendingDeals'));
const AllInvestments = lazy(() => import('@portals/investor/pages/AllInvestments'));
const CompletedProjects = lazy(() => import('@portals/investor/pages/CompletedProjects'));
const ROIAnalysis = lazy(() => import('@portals/investor/pages/ROIAnalysis'));
const MarketTrends = lazy(() => import('@portals/investor/pages/MarketTrends'));
const RiskAssessment = lazy(() => import('@portals/investor/pages/RiskAssessment'));
const FinancialOverview = lazy(() => import('@portals/investor/pages/FinancialOverview'));
const TransactionHistory = lazy(() => import('@portals/investor/pages/TransactionHistory'));
const BudgetAllocation = lazy(() => import('@portals/investor/pages/BudgetAllocation'));
const TaxDocuments = lazy(() => import('@portals/investor/pages/TaxDocuments'));
const InvestorSettings = lazy(() => import('@portals/investor/pages/InvestorSettings'));
const InvestorWallet = lazy(() => import('@portals/investor/pages/InvestorWallet'));
const PaymentMethods = lazy(() => import('@portals/investor/pages/PaymentMethods'));

// New Pages
const ProductionProjects = lazy(() => import('@portals/production/pages/ProductionProjects'));
const ProductionProjectsDevelopment = lazy(() => import('@portals/production/pages/ProductionProjectsDevelopment'));
const ProductionProjectsActive = lazy(() => import('@portals/production/pages/ProductionProjectsActive'));
const ProductionProjectsPost = lazy(() => import('@portals/production/pages/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazy(() => import('@portals/production/pages/ProductionProjectsCompleted'));
const ProductionPipeline = lazy(() => import('@portals/production/pages/ProductionPipeline'));
const ProductionSubmissions = lazy(() => import('@portals/production/pages/ProductionSubmissions'));
const ProductionSubmissionsNew = lazy(() => import('@portals/production/pages/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazy(() => import('@portals/production/pages/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazy(() => import('@portals/production/pages/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazy(() => import('@portals/production/pages/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazy(() => import('@portals/production/pages/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazy(() => import('@portals/production/pages/ProductionSubmissionsArchive'));
const ProductionAnalytics = lazy(() => import('@portals/production/pages/ProductionAnalytics'));
const ProductionActivity = lazy(() => import('@portals/production/pages/ProductionActivity'));
const ProductionStats = lazy(() => import('@portals/production/pages/ProductionStats'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const TeamMembers = lazy(() => import('./pages/team/TeamMembers'));
const TeamInvite = lazy(() => import('./pages/team/TeamInvite'));
const TeamRoles = lazy(() => import('@portals/production/pages/TeamRoles'));
const ProductionCollaborations = lazy(() => import('@portals/production/pages/ProductionCollaborations'));
const ProductionRevenue = lazy(() => import('@portals/production/pages/ProductionRevenue'));
const ProductionSaved = lazy(() => import('@portals/production/pages/ProductionSaved'));
const ProductionSettingsProfile = lazy(() => import('@portals/production/pages/ProductionSettingsProfile'));
const ProductionSettingsNotifications = lazy(() => import('@portals/production/pages/ProductionSettingsNotifications'));
const ProductionSettingsBilling = lazy(() => import('@portals/production/pages/ProductionSettingsBilling'));
const ProductionSettingsSecurity = lazy(() => import('@portals/production/pages/ProductionSettingsSecurity'));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SettingsProfile = lazy(() => import('./pages/settings/SettingsProfile'));
const NotificationSettings = lazy(() => import('./pages/settings/NotificationSettings'));
const PrivacySettings = lazy(() => import('./pages/settings/PrivacySettings'));
const InvestorPortfolio = lazy(() => import('@portals/investor/pages/InvestorPortfolio'));
const InvestorActivity = lazy(() => import('@portals/investor/pages/InvestorActivity'));
const InvestorAnalytics = lazy(() => import('@portals/investor/pages/InvestorAnalytics'));
const InvestorStats = lazy(() => import('@portals/investor/pages/InvestorStats'));
const InvestorSaved = lazy(() => import('@portals/investor/pages/InvestorSaved'));
const InvestorWatchlist = lazy(() => import('@portals/investor/pages/InvestorWatchlist'));
const InvestorDeals = lazy(() => import('@portals/investor/pages/InvestorDeals'));
const InvestorPerformance = lazy(() => import('@portals/investor/pages/InvestorPerformance'));
const InvestorDiscover = lazy(() => import('@portals/investor/pages/InvestorDiscover'));
const InvestorReports = lazy(() => import('@portals/investor/pages/InvestorReports'));
const InvestorNetwork = lazy(() => import('@portals/investor/pages/InvestorNetwork'));
const InvestorCoInvestors = lazy(() => import('@portals/investor/pages/InvestorCoInvestors'));
const InvestorProductionCompanies = lazy(() => import('@portals/investor/pages/InvestorProductionCompanies'));
const InvestorCreators = lazy(() => import('@portals/investor/pages/InvestorCreators'));
const Transactions = lazy(() => import('@portals/admin/pages/Transactions'));
const SystemSettings = lazy(() => import('@portals/admin/pages/SystemSettings'));

// Test Pages
const TestNavigation = lazy(() => import('./pages/TestNavigation'));

// Legal Pages
const LegalDocumentWizard = lazy(() => import('./components/Legal/LegalDocumentWizard'));
const LegalLibrary = lazy(() => import('./components/Legal/LegalLibrary'));
const DocumentComparisonTool = lazy(() => import('./components/Legal/DocumentComparisonTool'));
const TemplateEditor = lazy(() => import('./components/Legal/TemplateEditor'));
const LegalDocumentDashboard = lazy(() => import('./components/Legal/LegalDocumentDashboard'));

// Browse Pages
const BrowseTabsFixed = lazy(() => import('@features/browse/components/BrowseTabsFixed'));
const BrowseGenres = lazy(() => import('./pages/BrowseGenres'));
const BrowseTopRated = lazy(() => import('./pages/BrowseTopRated'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));

// Query client temporarily disabled to resolve JavaScript initialization errors

// Component to handle pitch routing - conditionally shows authenticated vs public view
function PitchRouter() {
  const { isAuthenticated } = useBetterAuthStore();
  
  // Show authenticated PitchDetail for logged in users, PublicPitchView for guests
  // This ensures authenticated users get access to protected content when they have signed NDAs
  if (isAuthenticated) {
    return <PitchDetail />;
  } else {
    return <PublicPitchView />;
  }
}

function LegalLayoutWrapper() {
  const { user } = useBetterAuthStore();
  const userType = (user?.userType as 'creator' | 'investor' | 'production') || 'creator';
  return <PortalLayout userType={userType} />;
}

function App() {
  const { isAuthenticated, user, loading, checkSession } = useBetterAuthStore();
  const [profileFetched, setProfileFetched] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Load configuration on app startup
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Use startTransition for non-urgent update
        startTransition(() => {
          configService.getConfiguration().then(() => {
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

  // Initialize app with proper session verification
  useEffect(() => {
    let mounted = true;
    
    const initApp = async () => {
      if (!sessionChecked && mounted) {
        try {
          // Check session to ensure authentication state is correct
          // The session manager handles rate limiting, so this is safe to call
          await checkSession();
          
          setSessionChecked(true);
          setProfileFetched(true);
          
          // Small delay to ensure state updates propagate
          setTimeout(() => {
            if (mounted) {
              setInitializing(false);
            }
          }, 100);
        } catch (error) {
          console.error('[App] Session check failed:', error);
          // Even if session check fails, mark as checked to prevent infinite loading
          // The user will just appear as not authenticated
          setSessionChecked(true);
          setProfileFetched(true);
          setTimeout(() => {
            if (mounted) {
              setInitializing(false);
            }
          }, 100);
        }
      }
    };
    
    // Initialize with proper session check
    initApp().catch(error => {
      console.error('[App] Initialization error:', error);
      // Even if init fails, mark as initialized to prevent infinite loading
      if (mounted) {
        setSessionChecked(true);
        setInitializing(false);
      }
    });
    
    return () => {
      mounted = false;
    };
  }, []); // Empty deps - only run once on mount

  // Removed redundant profile fetching - handled by session restoration above

  // Get userType from Better Auth user object, not localStorage
  const userType = user?.userType || null;

  // Show loading state while initializing to prevent flicker and navigation loops
  if (initializing || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
          <p className="mt-4 text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }


  return (
    <GlobalErrorBoundary>
      {/* Using safe context provider without problematic providers */}
      <AppContextProviderSafe>
        <NotificationToastProvider>
          <ToastProvider>
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
          {/* Homepage - Only render on exact path match */}
          <Route path="/" element={<Homepage />} />
          
          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace-old" element={<Marketplace />} />
          
          {/* Browse Route */}
          <Route path="/browse" element={<BrowseTabsFixed />} />
          
          {/* Info Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          
          {/* Test Pages — dev only */}
          {import.meta.env.DEV && <Route path="/test/navigation" element={<TestNavigation />} />}
          
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
          
          {/* Legacy /auth/* routes - redirect to /login/* */}
          <Route path="/auth/creator" element={<Navigate to="/login/creator" replace />} />
          <Route path="/auth/investor" element={<Navigate to="/login/investor" replace />} />
          <Route path="/auth/production" element={<Navigate to="/login/production" replace />} />
          <Route path="/login/admin" element={
            !isAuthenticated ? <Login /> : 
            userType === 'admin' ? <Navigate to="/admin/dashboard" /> :
            <Navigate to="/" />
          } />
          
          {/* Legacy routes (backwards compatibility) - redirect to appropriate dashboard */}
          <Route path="/login" element={
            !isAuthenticated ? <Login /> : 
            <Navigate to={userType ? `/${userType}/dashboard` : '/'} />
          } />
          <Route path="/register" element={
            !isAuthenticated ? <Register /> : 
            <Navigate to={userType ? `/${userType}/dashboard` : '/'} />
          } />
          
          {/* Creator Portal Routes - with profile guard + PortalLayout */}
          <Route path="/creator/*" element={
            isAuthenticated && userType === 'creator' ? <ProfileGuard userType="creator" /> :
            <Navigate to="/login/creator" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<CreatorDashboard />} />
            <Route path="pitch/new" element={<CreatePitch />} />
            <Route path="pitches" element={<ManagePitches />} />
            <Route path="analytics" element={<CreatorAnalyticsPage />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="pitch/:id" element={<CreatorPitchView />} />
            <Route path="pitches/:id" element={<PitchDetail />} />
            <Route path="pitch/:id/edit" element={<PitchEdit />} />
            <Route path="pitches/:id/edit" element={<PitchEdit />} />
            <Route path="pitches/:id/analytics" element={<PitchAnalytics />} />
            <Route path="pitches/:id/:slug/analytics" element={<PitchAnalytics />} />
            <Route path="ndas" element={<CreatorNDAManagement />} />
            <Route path="following" element={<Following />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="portfolio" element={<CreatorPortfolio />} />

            {/* Enhanced Creator Routes */}
            {AllCreatorRoutes({ isAuthenticated: true, userType: 'creator' })}
          </Route>
          {/* Investor Portal Routes - with profile guard + PortalLayout */}
          <Route path="/investor/*" element={
            isAuthenticated && userType === 'investor' ? <ProfileGuard userType="investor" /> :
            <Navigate to="/login/investor" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<InvestorDashboard />} />
            {import.meta.env.DEV && <Route path="dashboard/debug" element={<InvestorDashboardDebug />} />}
            <Route path="following" element={<Following />} />
            <Route path="browse" element={<InvestorBrowse />} />
            <Route path="pitch/:id" element={<InvestorPitchView />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />

            {/* Enhanced Investor Routes */}
            {AllInvestorRoutes({ isAuthenticated: true, userType: 'investor' })}
          </Route>
          {/* Production Portal Routes - with profile guard + PortalLayout */}
          <Route path="/production/*" element={
            isAuthenticated && userType === 'production' ? <ProfileGuard userType="production" /> :
            <Navigate to="/login/production" />
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="dashboard" element={<ProductionDashboard />} />
            <Route path="following" element={<Following />} />
            <Route path="pitch/:id" element={<ProductionPitchView />} />
            <Route path="profile" element={<Profile />} />
            <Route path="messages/*" element={<Messages />} />
            <Route path="calendar" element={<Calendar />} />

            {/* Enhanced Production Routes */}
            {AllProductionRoutes({ isAuthenticated: true, userType: 'production' })}
          </Route>
          
          {/* Admin Protected Routes — requires admin.access permission */}
          <Route path="/admin/dashboard" element={
            <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/portals">
              <AdminDashboard />
            </PermissionRoute>
          } />
          <Route path="/admin/users" element={
            <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/portals">
              <UserManagement />
            </PermissionRoute>
          } />
          <Route path="/admin/content" element={
            <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/portals">
              <ContentModeration />
            </PermissionRoute>
          } />
          <Route path="/admin/transactions" element={
            <PermissionRoute requires={Permission.ADMIN_ACCESS} redirectTo="/portals">
              <Transactions />
            </PermissionRoute>
          } />
          <Route path="/admin/settings" element={
            <PermissionRoute requiresAll={[Permission.ADMIN_ACCESS, Permission.ADMIN_SETTINGS]} redirectTo="/portals">
              <SystemSettings />
            </PermissionRoute>
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
          <Route path="/settings/onboarding" element={isAuthenticated ? <OnboardingSettings /> : <Navigate to="/portals" />} />
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
            <Route path="/dashboard" element={
              isAuthenticated && userType ? <Navigate to={`/${userType}/dashboard`} replace /> :
              isAuthenticated ? <Dashboard /> :
              <Navigate to="/portals" />
            } />
            <Route path="/pitch/new" element={
              <PermissionRoute requires={Permission.PITCH_CREATE} redirectTo="/portals">
                <CreatePitch />
              </PermissionRoute>
            } />
          </Route>
          
          {/* All enhanced navigation routes are now handled within the PortalLayout wrapper above */}
          
          
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
          
          {/* Legal Document Automation Routes - Available to all authenticated users, wrapped in PortalLayout */}
          <Route path="/legal" element={isAuthenticated ? <LegalLayoutWrapper /> : <Navigate to="/portals" />}>
            <Route index element={<LegalDocumentDashboard />} />
            <Route path="dashboard" element={<LegalDocumentDashboard />} />
            <Route path="wizard" element={<LegalDocumentWizard />} />
            <Route path="library" element={<LegalLibrary />} />
            <Route path="compare" element={<DocumentComparisonTool />} />
            <Route path="templates" element={<TemplateEditor />} />
            <Route path="templates/new" element={<TemplateEditor />} />
            <Route path="templates/:id" element={<TemplateEditor />} />
          </Route>
          
                {/* 404 - Must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
            </Suspense>
          </Router>
        </ToastProvider>
      </NotificationToastProvider>
      </AppContextProviderSafe>
    </GlobalErrorBoundary>
  );
}

export default App;