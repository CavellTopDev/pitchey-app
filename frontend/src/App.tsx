import { useEffect, useState, Suspense, lazy, startTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboardTest'));
const InvestorDashboard = lazy(() => import('./pages/InvestorDashboard'));
const InvestorDashboardDebug = lazy(() => import('./pages/InvestorDashboardDebug'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
const CreatorProfile = lazy(() => import('./pages/CreatorProfile'));

// Public Pages
const Marketplace = lazy(() => import('./pages/Marketplace'));
const MarketplaceEnhanced = lazy(() => import('./pages/MarketplaceEnhanced'));
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
const Transactions = lazy(() => import('./pages/Admin/Transactions'));
const SystemSettings = lazy(() => import('./pages/Admin/SystemSettings'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
      if (!isOnLoginPage) {
        AuthService.validateToken().then((res) => {
          if (!res.valid) {
            console.log('Token validation failed, clearing auth data');
            removeBoth('authToken');
            removeBoth('user');
            removeBoth('userType');
          }
        }).catch((error) => {
          console.log('Token validation error:', error);
          removeBoth('authToken');
          removeBoth('user');
          removeBoth('userType');
        });
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
      <QueryClientProvider client={queryClient}>
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
          <Route path="/marketplace" element={<MarketplaceEnhanced />} />
          <Route path="/marketplace-old" element={<Marketplace />} />
          <Route path="/test-marketplace" element={<TestMarketplace />} />
          
          {/* Info Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          
          {/* Portal Selection */}
          <Route path="/portals" element={<PortalSelect />} />
          
          {/* Multi-Portal Login Routes */}
          <Route path="/login/creator" element={
            !isAuthenticated ? <CreatorLogin /> : 
            userType === 'creator' ? <Navigate to="/creator/dashboard" /> :
            <Navigate to="/" />
          } />
          <Route path="/login/investor" element={
            !isAuthenticated ? <InvestorLogin /> : 
            userType === 'investor' ? <Navigate to="/investor/dashboard" /> :
            <Navigate to="/" />
          } />
          <Route path="/login/production" element={
            !isAuthenticated ? <ProductionLogin /> : 
            userType === 'production' ? <Navigate to="/production/dashboard" /> :
            <Navigate to="/" />
          } />
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
          
                {/* 404 - Must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Router>
            </ToastProvider>
          </NotificationToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;