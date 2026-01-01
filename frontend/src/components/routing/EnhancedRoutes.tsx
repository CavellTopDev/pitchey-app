import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// Import route configurations
import { CREATOR_ROUTES, INVESTOR_ROUTES, PRODUCTION_ROUTES } from '../../config/navigation.routes';

// Lazy load all the additional pages
// Investor Pages
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

// Production Pages
const ProductionActivity = lazy(() => import('../../pages/production/ProductionActivity'));
const ProductionStats = lazy(() => import('../../pages/production/ProductionStats'));
const ProductionRevenue = lazy(() => import('../../pages/production/ProductionRevenue'));
const TeamInvite = lazy(() => import('../../pages/production/TeamInvite'));
const TeamRoles = lazy(() => import('../../pages/production/TeamRoles'));

interface EnhancedRoutesProps {
  isAuthenticated: boolean;
  userType: string | null;
}

export function EnhancedCreatorRoutes({ isAuthenticated, userType }: EnhancedRoutesProps) {
  const isCreator = isAuthenticated && userType === 'creator';
  
  return (
    <>
      {/* Creator Activity & Stats */}
      <Route path={CREATOR_ROUTES.activity} element={
        isCreator ? <CreatorActivity /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.stats} element={
        isCreator ? <CreatorStats /> : <Navigate to="/login/creator" />
      } />
      
      {/* Pitch Management */}
      <Route path={CREATOR_ROUTES.pitchesPublished} element={
        isCreator ? <CreatorPitchesPublished /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.pitchesDrafts} element={
        isCreator ? <CreatorPitchesDrafts /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.pitchesReview} element={
        isCreator ? <CreatorPitchesReview /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.pitchesAnalytics} element={
        isCreator ? <CreatorPitchesAnalytics /> : <Navigate to="/login/creator" />
      } />
      
      {/* Team Management */}
      <Route path={CREATOR_ROUTES.teamMembers} element={
        isCreator ? <CreatorTeamMembers /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.teamInvite} element={
        isCreator ? <CreatorTeamInvite /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.teamRoles} element={
        isCreator ? <CreatorTeamRoles /> : <Navigate to="/login/creator" />
      } />
      <Route path={CREATOR_ROUTES.collaborations} element={
        isCreator ? <CreatorCollaborations /> : <Navigate to="/login/creator" />
      } />
    </>
  );
}

export function EnhancedInvestorRoutes({ isAuthenticated, userType }: EnhancedRoutesProps) {
  const isInvestor = isAuthenticated && userType === 'investor';
  
  return (
    <>
      {/* Main Dashboard Pages */}
      <Route path={INVESTOR_ROUTES.portfolio} element={
        isInvestor ? <InvestorPortfolio /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.analytics} element={
        isInvestor ? <InvestorAnalytics /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.activity} element={
        isInvestor ? <InvestorActivity /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.performance} element={
        isInvestor ? <InvestorPerformance /> : <Navigate to="/login/investor" />
      } />
      
      {/* Deal Management */}
      <Route path={INVESTOR_ROUTES.deals} element={
        isInvestor ? <InvestorDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.pendingDeals} element={
        isInvestor ? <PendingDeals /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.allInvestments} element={
        isInvestor ? <AllInvestments /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.completedProjects} element={
        isInvestor ? <CompletedProjects /> : <Navigate to="/login/investor" />
      } />
      
      {/* Discovery */}
      <Route path={INVESTOR_ROUTES.saved} element={
        isInvestor ? <InvestorSaved /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.watchlist} element={
        isInvestor ? <InvestorWatchlist /> : <Navigate to="/login/investor" />
      } />
      
      {/* Financial */}
      <Route path={INVESTOR_ROUTES.financialOverview} element={
        isInvestor ? <FinancialOverview /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.transactionHistory} element={
        isInvestor ? <TransactionHistory /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.budgetAllocation} element={
        isInvestor ? <BudgetAllocation /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.roiAnalysis} element={
        isInvestor ? <ROIAnalysis /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.reports} element={
        isInvestor ? <InvestorReports /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.taxDocuments} element={
        isInvestor ? <TaxDocuments /> : <Navigate to="/login/investor" />
      } />
      
      {/* Market Analysis */}
      <Route path={INVESTOR_ROUTES.marketTrends} element={
        isInvestor ? <MarketTrends /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.riskAssessment} element={
        isInvestor ? <RiskAssessment /> : <Navigate to="/login/investor" />
      } />
      
      {/* Network */}
      <Route path={INVESTOR_ROUTES.network} element={
        isInvestor ? <InvestorNetwork /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.coInvestors} element={
        isInvestor ? <InvestorCoInvestors /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.creators} element={
        isInvestor ? <InvestorCreators /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.productionCompanies} element={
        isInvestor ? <InvestorProductionCompanies /> : <Navigate to="/login/investor" />
      } />
      
      {/* Account */}
      <Route path={INVESTOR_ROUTES.wallet} element={
        isInvestor ? <InvestorWallet /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.paymentMethods} element={
        isInvestor ? <PaymentMethods /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.settings} element={
        isInvestor ? <InvestorSettings /> : <Navigate to="/login/investor" />
      } />
      <Route path={INVESTOR_ROUTES.ndaRequests} element={
        isInvestor ? <NDARequests /> : <Navigate to="/login/investor" />
      } />
    </>
  );
}

export function EnhancedProductionRoutes({ isAuthenticated, userType }: EnhancedRoutesProps) {
  const isProduction = isAuthenticated && userType === 'production';
  
  return (
    <>
      {/* Main Dashboard */}
      <Route path={PRODUCTION_ROUTES.analytics} element={
        isProduction ? <ProductionAnalytics /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.activity} element={
        isProduction ? <ProductionActivity /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.stats} element={
        isProduction ? <ProductionStats /> : <Navigate to="/login/production" />
      } />
      
      {/* Project Management */}
      <Route path={PRODUCTION_ROUTES.projects} element={
        isProduction ? <ProductionProjects /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.projectsActive} element={
        isProduction ? <ProductionProjectsActive /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.projectsDevelopment} element={
        isProduction ? <ProductionProjectsDevelopment /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.projectsPost} element={
        isProduction ? <ProductionProjectsPost /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.projectsCompleted} element={
        isProduction ? <ProductionProjectsCompleted /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.pipeline} element={
        isProduction ? <ProductionPipeline /> : <Navigate to="/login/production" />
      } />
      
      {/* Submissions */}
      <Route path={PRODUCTION_ROUTES.submissions} element={
        isProduction ? <ProductionSubmissions /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsNew} element={
        isProduction ? <ProductionSubmissionsNew /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsReview} element={
        isProduction ? <ProductionSubmissionsReview /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsShortlisted} element={
        isProduction ? <ProductionSubmissionsShortlisted /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsAccepted} element={
        isProduction ? <ProductionSubmissionsAccepted /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsRejected} element={
        isProduction ? <ProductionSubmissionsRejected /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.submissionsArchive} element={
        isProduction ? <ProductionSubmissionsArchive /> : <Navigate to="/login/production" />
      } />
      
      {/* Operations */}
      <Route path={PRODUCTION_ROUTES.revenue} element={
        isProduction ? <ProductionRevenue /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.saved} element={
        isProduction ? <ProductionSaved /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.collaborations} element={
        isProduction ? <ProductionCollaborations /> : <Navigate to="/login/production" />
      } />
      
      {/* Team */}
      <Route path={PRODUCTION_ROUTES.teamInvite} element={
        isProduction ? <TeamInvite /> : <Navigate to="/login/production" />
      } />
      <Route path={PRODUCTION_ROUTES.teamRoles} element={
        isProduction ? <TeamRoles /> : <Navigate to="/login/production" />
      } />
    </>
  );
}