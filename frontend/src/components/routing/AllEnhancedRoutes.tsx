import React, { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';

// Import route configurations
import { CREATOR_ROUTES, INVESTOR_ROUTES, PRODUCTION_ROUTES } from '../../config/navigation.routes';

// Helper function to extract relative path from absolute path
const getRelativePath = (absolutePath: string, prefix: string): string => {
  if (absolutePath.startsWith(prefix + '/')) {
    return absolutePath.substring(prefix.length + 1);
  }
  return absolutePath;
};

// Lazy load all Creator pages
const CreatorActivity = lazy(() => import('../../pages/creator/CreatorActivity'));
const CreatorStats = lazy(() => import('../../pages/creator/CreatorStats'));
const CreatorPitchesPublished = lazy(() => import('../../pages/creator/CreatorPitchesPublished'));
const CreatorPitchesDrafts = lazy(() => import('../../pages/creator/CreatorPitchesDrafts'));
const CreatorPitchesReview = lazy(() => import('../../pages/creator/CreatorPitchesReview'));
const CreatorPitchesAnalytics = lazy(() => import('../../pages/creator/CreatorPitchesAnalytics'));
const CreatorTeamMembers = lazy(() => import('../../pages/creator/CreatorTeamMembers'));
const CreatorTeamInvite = lazy(() => import('../../pages/creator/CreatorTeamInvite'));
const CreatorTeamRoles = lazy(() => import('../../pages/creator/CreatorTeamRoles'));
const CreatorCollaborations = lazy(() => import('../../pages/creator/CreatorCollaborations'));

// Lazy load all Investor pages
const InvestorPortfolio = lazy(() => import('../../pages/investor/InvestorPortfolio'));
const InvestorDeals = lazy(() => import('../../pages/investor/InvestorDeals'));
const InvestorActivity = lazy(() => import('../../pages/investor/InvestorActivity'));
const InvestorAnalytics = lazy(() => import('../../pages/investor/InvestorAnalytics'));
const InvestorPerformance = lazy(() => import('../../pages/investor/InvestorPerformance'));
const InvestorSaved = lazy(() => import('../../pages/investor/InvestorSaved'));
const InvestorWatchlist = lazy(() => import('../../pages/investor/InvestorWatchlist'));
const InvestorNetwork = lazy(() => import('../../pages/investor/InvestorNetwork'));
const InvestorReports = lazy(() => import('../../pages/investor/InvestorReports'));
const InvestorStats = lazy(() => import('../../pages/investor/InvestorStats'));
const InvestorCoInvestors = lazy(() => import('../../pages/investor/InvestorCoInvestors'));
const InvestorCreators = lazy(() => import('../../pages/investor/InvestorCreators'));
const InvestorProductionCompanies = lazy(() => import('../../pages/investor/InvestorProductionCompanies'));
const PendingDeals = lazy(() => import('../../pages/investor/PendingDeals'));
const AllInvestments = lazy(() => import('../../pages/investor/AllInvestments'));
const CompletedProjects = lazy(() => import('../../pages/investor/CompletedProjects'));
const FinancialOverview = lazy(() => import('../../pages/investor/FinancialOverview'));
const TransactionHistory = lazy(() => import('../../pages/investor/TransactionHistory'));
const BudgetAllocation = lazy(() => import('../../pages/investor/BudgetAllocation'));
const ROIAnalysis = lazy(() => import('../../pages/investor/ROIAnalysis'));
const TaxDocuments = lazy(() => import('../../pages/investor/TaxDocuments'));
const MarketTrends = lazy(() => import('../../pages/investor/MarketTrends'));
const RiskAssessment = lazy(() => import('../../pages/investor/RiskAssessment'));
const InvestorWallet = lazy(() => import('../../pages/investor/InvestorWallet'));
const PaymentMethods = lazy(() => import('../../pages/investor/PaymentMethods'));
const InvestorSettings = lazy(() => import('../../pages/investor/InvestorSettings'));
const NDARequests = lazy(() => import('../../pages/investor/NDARequests'));

// Lazy load all Production pages
const ProductionActivity = lazy(() => import('../../pages/production/ProductionActivity'));
const ProductionAnalytics = lazy(() => import('../../pages/production/ProductionAnalytics'));
const ProductionStats = lazy(() => import('../../pages/production/ProductionStats'));
const ProductionProjects = lazy(() => import('../../pages/production/ProductionProjects'));
const ProductionProjectsActive = lazy(() => import('../../pages/production/ProductionProjectsActive'));
const ProductionProjectsDevelopment = lazy(() => import('../../pages/production/ProductionProjectsDevelopment'));
const ProductionProjectsPost = lazy(() => import('../../pages/production/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazy(() => import('../../pages/production/ProductionProjectsCompleted'));
const ProductionPipeline = lazy(() => import('../../pages/production/ProductionPipeline'));
const ProductionSubmissions = lazy(() => import('../../pages/production/ProductionSubmissions'));
const ProductionSubmissionsNew = lazy(() => import('../../pages/production/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazy(() => import('../../pages/production/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazy(() => import('../../pages/production/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazy(() => import('../../pages/production/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazy(() => import('../../pages/production/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazy(() => import('../../pages/production/ProductionSubmissionsArchive'));
const ProductionRevenue = lazy(() => import('../../pages/production/ProductionRevenue'));
const ProductionSaved = lazy(() => import('../../pages/production/ProductionSaved'));
const ProductionCollaborations = lazy(() => import('../../pages/production/ProductionCollaborations'));
const TeamInvite = lazy(() => import('../../pages/production/TeamInvite'));
const TeamRoles = lazy(() => import('../../pages/production/TeamRoles'));

interface RoutesProps {
  isAuthenticated: boolean;
  userType: string | null;
}

export function AllCreatorRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isCreator = isAuthenticated && userType === 'creator';
  
  return (
    <>
      {/* Activity & Stats */}
      <Route path="activity" element={
        isCreator ? <CreatorActivity /> : <Navigate to="/login/creator" />
      } />
      <Route path="stats" element={
        isCreator ? <CreatorStats /> : <Navigate to="/login/creator" />
      } />
      
      {/* Pitch Management */}
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesPublished, '/creator')} element={
        isCreator ? <CreatorPitchesPublished /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesDrafts, '/creator')} element={
        isCreator ? <CreatorPitchesDrafts /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesReview, '/creator')} element={
        isCreator ? <CreatorPitchesReview /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.pitchesAnalytics, '/creator')} element={
        isCreator ? <CreatorPitchesAnalytics /> : <Navigate to="/login/creator" />
      } />
      
      {/* Team Management */}
      <Route path={getRelativePath(CREATOR_ROUTES.teamMembers, '/creator')} element={
        isCreator ? <CreatorTeamMembers /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.teamInvite, '/creator')} element={
        isCreator ? <CreatorTeamInvite /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.teamRoles, '/creator')} element={
        isCreator ? <CreatorTeamRoles /> : <Navigate to="/login/creator" />
      } />
      <Route path={getRelativePath(CREATOR_ROUTES.collaborations, '/creator')} element={
        isCreator ? <CreatorCollaborations /> : <Navigate to="/login/creator" />
      } />
    </>
  );
}

export function AllInvestorRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isInvestor = isAuthenticated && userType === 'investor';
  
  return (
    <>
      {/* Dashboard & Analytics */}
      <Route path={getRelativePath(INVESTOR_ROUTES.portfolio, '/investor')} element={
        isInvestor ? <InvestorPortfolio /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.analytics, '/investor')} element={
        isInvestor ? <InvestorAnalytics /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.activity, '/investor')} element={
        isInvestor ? <InvestorActivity /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.performance, '/investor')} element={
        isInvestor ? <InvestorPerformance /> : <Navigate to="/login/investor" />
      } />
      
      {/* Deal Management */}
      <Route path={getRelativePath(INVESTOR_ROUTES.deals, '/investor')} element={
        isInvestor ? <InvestorDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.pendingDeals, '/investor')} element={
        isInvestor ? <PendingDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.allInvestments, '/investor')} element={
        isInvestor ? <AllInvestments /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.completedProjects, '/investor')} element={
        isInvestor ? <CompletedProjects /> : <Navigate to="/login/investor" />
      } />
      
      {/* Discovery */}
      <Route path={getRelativePath(INVESTOR_ROUTES.saved, '/investor')} element={
        isInvestor ? <InvestorSaved /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.watchlist, '/investor')} element={
        isInvestor ? <InvestorWatchlist /> : <Navigate to="/login/investor" />
      } />
      
      {/* Financial */}
      <Route path={getRelativePath(INVESTOR_ROUTES.financialOverview, '/investor')} element={
        isInvestor ? <FinancialOverview /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.transactionHistory, '/investor')} element={
        isInvestor ? <TransactionHistory /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.budgetAllocation, '/investor')} element={
        isInvestor ? <BudgetAllocation /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.roiAnalysis, '/investor')} element={
        isInvestor ? <ROIAnalysis /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.reports, '/investor')} element={
        isInvestor ? <InvestorReports /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.taxDocuments, '/investor')} element={
        isInvestor ? <TaxDocuments /> : <Navigate to="/login/investor" />
      } />
      
      {/* Market Analysis */}
      <Route path={getRelativePath(INVESTOR_ROUTES.marketTrends, '/investor')} element={
        isInvestor ? <MarketTrends /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.riskAssessment, '/investor')} element={
        isInvestor ? <RiskAssessment /> : <Navigate to="/login/investor" />
      } />
      
      {/* Network */}
      <Route path={getRelativePath(INVESTOR_ROUTES.network, '/investor')} element={
        isInvestor ? <InvestorNetwork /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.coInvestors, '/investor')} element={
        isInvestor ? <InvestorCoInvestors /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.creators, '/investor')} element={
        isInvestor ? <InvestorCreators /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.productionCompanies, '/investor')} element={
        isInvestor ? <InvestorProductionCompanies /> : <Navigate to="/login/investor" />
      } />
      
      {/* Account */}
      <Route path={getRelativePath(INVESTOR_ROUTES.wallet, '/investor')} element={
        isInvestor ? <InvestorWallet /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.paymentMethods, '/investor')} element={
        isInvestor ? <PaymentMethods /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.settings, '/investor')} element={
        isInvestor ? <InvestorSettings /> : <Navigate to="/login/investor" />
      } />
      <Route path={getRelativePath(INVESTOR_ROUTES.ndaRequests, '/investor')} element={
        isInvestor ? <NDARequests /> : <Navigate to="/login/investor" />
      } />
    </>
  );
}

export function AllProductionRoutes({ isAuthenticated, userType }: RoutesProps) {
  const isProduction = isAuthenticated && userType === 'production';
  
  return (
    <>
      {/* Dashboard */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.analytics, '/production')} element={
        isProduction ? <ProductionAnalytics /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.activity, '/production')} element={
        isProduction ? <ProductionActivity /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.stats, '/production')} element={
        isProduction ? <ProductionStats /> : <Navigate to="/login/production" />
      } />
      
      {/* Projects */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.projects, '/production')} element={
        isProduction ? <ProductionProjects /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsActive, '/production')} element={
        isProduction ? <ProductionProjectsActive /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsDevelopment, '/production')} element={
        isProduction ? <ProductionProjectsDevelopment /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsPost, '/production')} element={
        isProduction ? <ProductionProjectsPost /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.projectsCompleted, '/production')} element={
        isProduction ? <ProductionProjectsCompleted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.pipeline, '/production')} element={
        isProduction ? <ProductionPipeline /> : <Navigate to="/login/production" />
      } />
      
      {/* Submissions */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissions, '/production')} element={
        isProduction ? <ProductionSubmissions /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsNew, '/production')} element={
        isProduction ? <ProductionSubmissionsNew /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsReview, '/production')} element={
        isProduction ? <ProductionSubmissionsReview /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsShortlisted, '/production')} element={
        isProduction ? <ProductionSubmissionsShortlisted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsAccepted, '/production')} element={
        isProduction ? <ProductionSubmissionsAccepted /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsRejected, '/production')} element={
        isProduction ? <ProductionSubmissionsRejected /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.submissionsArchive, '/production')} element={
        isProduction ? <ProductionSubmissionsArchive /> : <Navigate to="/login/production" />
      } />
      
      {/* Operations */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.revenue, '/production')} element={
        isProduction ? <ProductionRevenue /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.saved, '/production')} element={
        isProduction ? <ProductionSaved /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.collaborations, '/production')} element={
        isProduction ? <ProductionCollaborations /> : <Navigate to="/login/production" />
      } />
      
      {/* Team */}
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamInvite, '/production')} element={
        isProduction ? <TeamInvite /> : <Navigate to="/login/production" />
      } />
      <Route path={getRelativePath(PRODUCTION_ROUTES.teamRoles, '/production')} element={
        isProduction ? <TeamRoles /> : <Navigate to="/login/production" />
      } />
    </>
  );
}