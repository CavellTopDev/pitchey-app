import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/Toast/ToastProvider';
import LoadingSpinner from './components/Loading/LoadingSpinner';

// Immediately needed components (not lazy loaded)
import Layout from './components/Layout';
import Homepage from './pages/Homepage';

// Lazy loaded pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Multi-Portal Pages
const PortalSelect = lazy(() => import('./pages/PortalSelect'));
const CreatorLogin = lazy(() => import('./pages/CreatorLogin'));
const InvestorLogin = lazy(() => import('./pages/InvestorLogin'));
const ProductionLogin = lazy(() => import('./pages/ProductionLogin'));
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const InvestorDashboard = lazy(() => import('./pages/InvestorDashboard'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
const CreatorProfile = lazy(() => import('./pages/CreatorProfile'));

// Public Pages
const Marketplace = lazy(() => import('./pages/Marketplace'));
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

// Production Pages
const ProductionPitchCreate = lazy(() => import('./pages/ProductionPitchCreate'));
const ProductionPitchDetail = lazy(() => import('./pages/ProductionPitchDetail'));

// Common Pages
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

// Investor Pages
const InvestorBrowse = lazy(() => import('./pages/InvestorBrowse'));

// Billing Page
const Billing = lazy(() => import('./pages/Billing'));

// Following/Portfolio Pages
const Following = lazy(() => import('./pages/Following'));
const CreatorPortfolio = lazy(() => import('./pages/CreatorPortfolio'));

// Info Pages
const HowItWorks = lazy(() => import('./pages/HowItWorks'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

function App() {
  const { isAuthenticated, fetchProfile } = useAuthStore();
  const [profileFetched, setProfileFetched] = useState(false);

  useEffect(() => {
    // Only fetch profile once when authenticated and not yet fetched
    if (isAuthenticated && !profileFetched) {
      fetchProfile().finally(() => setProfileFetched(true));
    }
  }, [isAuthenticated, profileFetched, fetchProfile]);

  const userType = localStorage.getItem('userType');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Router>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" text="Loading..." />
              </div>
            }>
              <Routes>
          {/* Homepage - Default route */}
          <Route path="/" element={<Homepage />} />
          
          {/* Marketplace */}
          <Route path="/marketplace" element={<Marketplace />} />
          
          {/* Info Pages */}
          <Route path="/how-it-works" element={<HowItWorks />} />
          
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
          <Route path="/creator/ndas" element={
            isAuthenticated && userType === 'creator' ? <CreatorNDAManagement /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/creator" />
          } />
          <Route path="/investor/dashboard" element={
            isAuthenticated && userType === 'investor' ? <InvestorDashboard /> : 
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
          <Route path="/production/dashboard" element={
            isAuthenticated && userType === 'production' ? <ProductionDashboard /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          <Route path="/production/pitch/:id" element={
            isAuthenticated && userType === 'production' ? <ProductionPitchDetail /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          <Route path="/pitch/new/production" element={
            isAuthenticated && userType === 'production' ? <ProductionPitchCreate /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
          } />
          <Route path="/pitch/:id/edit" element={
            isAuthenticated && userType === 'production' ? <PitchEdit /> : 
            isAuthenticated ? <Navigate to="/" /> :
            <Navigate to="/login/production" />
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
          <Route path="/pitch/:id" element={<PublicPitchView />} />
          
          {/* Following/Portfolio Routes - Available to all authenticated users */}
          <Route path="/following" element={isAuthenticated ? <Following /> : <Navigate to="/portals" />} />
          <Route path="/creator/:creatorId" element={<CreatorPortfolio />} />
          
          {/* Common Protected Routes - Available to all user types */}
          <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/portals" />} />
          <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/portals" />} />
          
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
            <Route path="/pitch/new" element={isAuthenticated ? <div>New Pitch</div> : <Navigate to="/portals" />} />
          </Route>
          
                {/* 404 - Must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;