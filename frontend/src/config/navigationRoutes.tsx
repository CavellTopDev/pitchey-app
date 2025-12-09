import { lazy } from 'react';

// Lazy load components for better performance
const ComingSoon = lazy(() => import('../pages/ComingSoon'));

// Creator Portal Pages
const CreatorActivity = lazy(() => import('../pages/creator/CreatorActivity'));
const CreatorStats = lazy(() => import('../pages/creator/CreatorStats'));
const CreatorPitchesPublished = lazy(() => import('../pages/creator/CreatorPitchesPublished'));
const CreatorPitchesDrafts = lazy(() => import('../pages/creator/CreatorPitchesDrafts'));
const CreatorPitchesReview = lazy(() => import('../pages/creator/CreatorPitchesReview'));
const CreatorPitchesAnalytics = lazy(() => import('../pages/creator/CreatorPitchesAnalytics'));
const CreatorTeamMembers = lazy(() => import('../pages/creator/CreatorTeamMembers'));
const CreatorTeamInvite = lazy(() => import('../pages/creator/CreatorTeamInvite'));
const CreatorTeamRoles = lazy(() => import('../pages/creator/CreatorTeamRoles'));
const CreatorCollaborations = lazy(() => import('../pages/creator/CreatorCollaborations'));

// Investor Portal Pages
const InvestorActivity = lazy(() => import('../pages/investor/InvestorActivity'));
const InvestorStats = lazy(() => import('../pages/investor/InvestorStats'));
const InvestorPortfolio = lazy(() => import('../pages/investor/InvestorPortfolio'));
const InvestorSaved = lazy(() => import('../pages/investor/InvestorSaved'));
const InvestorWatchlist = lazy(() => import('../pages/investor/InvestorWatchlist'));
const InvestorDeals = lazy(() => import('../pages/investor/InvestorDeals'));
const InvestorPerformance = lazy(() => import('../pages/investor/InvestorPerformance'));
const InvestorAnalytics = lazy(() => import('../pages/investor/InvestorAnalytics'));

// Production Portal Pages
const ProductionActivity = lazy(() => import('../pages/production/ProductionActivity'));
const ProductionStats = lazy(() => import('../pages/production/ProductionStats'));
const ProductionProjects = lazy(() => import('../pages/production/ProductionProjects'));
const ProductionProjectsDevelopment = lazy(() => import('../pages/production/ProductionProjectsDevelopment'));
const ProductionProjectsActive = lazy(() => import('../pages/production/ProductionProjectsActive'));
const ProductionProjectsPost = lazy(() => import('../pages/production/ProductionProjectsPost'));
const ProductionProjectsCompleted = lazy(() => import('../pages/production/ProductionProjectsCompleted'));
const ProductionPipeline = lazy(() => import('../pages/production/ProductionPipeline'));
const ProductionSubmissions = lazy(() => import('../pages/production/ProductionSubmissions'));
const ProductionSubmissionsNew = lazy(() => import('../pages/production/ProductionSubmissionsNew'));
const ProductionSubmissionsReview = lazy(() => import('../pages/production/ProductionSubmissionsReview'));
const ProductionSubmissionsShortlisted = lazy(() => import('../pages/production/ProductionSubmissionsShortlisted'));
const ProductionSubmissionsAccepted = lazy(() => import('../pages/production/ProductionSubmissionsAccepted'));
const ProductionSubmissionsRejected = lazy(() => import('../pages/production/ProductionSubmissionsRejected'));
const ProductionSubmissionsArchive = lazy(() => import('../pages/production/ProductionSubmissionsArchive'));
const ProductionTeamInvite = lazy(() => import('../pages/production/TeamInvite'));
const ProductionTeamRoles = lazy(() => import('../pages/production/TeamRoles'));
const ProductionCollaborations = lazy(() => import('../pages/production/ProductionCollaborations'));

// Team Pages
const TeamMembers = lazy(() => import('../pages/team/TeamMembers'));
const TeamOverview = lazy(() => import('../pages/team/TeamOverview'));
const TeamInvite = lazy(() => import('../pages/team/TeamInvite'));

// Browse Pages
const BrowseGenres = lazy(() => import('../pages/BrowseGenres'));
const BrowseTopRated = lazy(() => import('../pages/BrowseTopRated'));

// Search Pages
const SearchPage = lazy(() => import('../pages/SearchPage'));

// Define all navigation routes with their components
export const navigationRoutes = {
  // Creator Dashboard routes
  '/creator/activity': { component: CreatorActivity, title: 'Activity Feed' },
  '/creator/stats': { component: CreatorStats, title: 'Quick Stats' },
  
  // Creator Pitch routes
  '/creator/pitches/published': { component: CreatorPitchesPublished, title: 'Published Pitches' },
  '/creator/pitches/drafts': { component: CreatorPitchesDrafts, title: 'Draft Pitches' },
  '/creator/pitches/review': { component: CreatorPitchesReview, title: 'Pitches Under Review' },
  '/creator/pitches/analytics': { component: CreatorPitchesAnalytics, title: 'Pitch Analytics' },
  
  // Creator Team routes
  '/creator/team': { component: CreatorTeamMembers, title: 'Team Members' },
  '/creator/team/invite': { component: CreatorTeamInvite, title: 'Invite Team Members' },
  '/creator/team/roles': { component: CreatorTeamRoles, title: 'Roles & Permissions' },
  '/creator/collaborations': { component: CreatorCollaborations, title: 'Collaborations' },
  
  // Investor Dashboard routes
  '/investor/activity': { component: InvestorActivity, title: 'Activity Feed' },
  '/investor/stats': { component: InvestorStats, title: 'Quick Stats' },
  '/investor/analytics': { component: InvestorAnalytics, title: 'Investment Analytics' },
  
  // Investor Portfolio routes
  '/investor/portfolio': { component: InvestorPortfolio, title: 'My Investments' },
  '/investor/saved': { component: InvestorSaved, title: 'Saved Pitches' },
  '/investor/watchlist': { component: InvestorWatchlist, title: 'Investment Watchlist' },
  '/investor/deals': { component: InvestorDeals, title: 'Deal Flow' },
  '/investor/performance': { component: InvestorPerformance, title: 'Portfolio Performance' },
  
  // Production Dashboard routes
  '/production/activity': { component: ProductionActivity, title: 'Activity Feed' },
  '/production/stats': { component: ProductionStats, title: 'Quick Stats' },
  
  // Production Project routes
  '/production/projects': { component: ProductionProjects, title: 'All Projects' },
  '/production/projects/development': { component: ProductionProjectsDevelopment, title: 'Projects in Development' },
  '/production/projects/production': { component: ProductionProjectsActive, title: 'Projects in Production' },
  '/production/projects/post': { component: ProductionProjectsPost, title: 'Post-Production Projects' },
  '/production/projects/completed': { component: ProductionProjectsCompleted, title: 'Completed Projects' },
  '/production/pipeline': { component: ProductionPipeline, title: 'Production Pipeline' },
  
  // Production Submission routes
  '/production/submissions': { component: ProductionSubmissions, title: 'All Submissions' },
  '/production/submissions/new': { component: ProductionSubmissionsNew, title: 'New Submissions' },
  '/production/submissions/review': { component: ProductionSubmissionsReview, title: 'Submissions Under Review' },
  '/production/submissions/shortlisted': { component: ProductionSubmissionsShortlisted, title: 'Shortlisted Submissions' },
  '/production/submissions/accepted': { component: ProductionSubmissionsAccepted, title: 'Accepted Submissions' },
  '/production/submissions/rejected': { component: ProductionSubmissionsRejected, title: 'Rejected Submissions' },
  '/production/submissions/archive': { component: ProductionSubmissionsArchive, title: 'Submission Archive' },
  
  // Production Team routes
  '/production/team': { component: TeamMembers, title: 'Production Team' },
  '/production/team/invite': { component: ProductionTeamInvite, title: 'Invite Team Members' },
  '/production/team/roles': { component: ProductionTeamRoles, title: 'Team Roles & Permissions' },
  '/production/collaborations': { component: ProductionCollaborations, title: 'Production Collaborations' },
  
  // Browse routes
  '/browse/genres': { component: BrowseGenres, title: 'Browse by Genre' },
  '/browse/top-rated': { component: BrowseTopRated, title: 'Top Rated Pitches' },
  
  // Search routes
  '/search': { component: SearchPage, title: 'Search' },
  '/search/advanced': { component: ComingSoon, title: 'Advanced Search' },
  '/search/genre': { component: ComingSoon, title: 'Search by Genre' },
  '/search/budget': { component: ComingSoon, title: 'Search by Budget' },
  '/search/creators': { component: ComingSoon, title: 'Search Creators' },
  '/search/companies': { component: ComingSoon, title: 'Search Companies' },
  
  // Settings routes
  '/settings': { component: ComingSoon, title: 'Settings' },
  '/settings/profile': { component: ComingSoon, title: 'Profile Settings' },
  '/settings/account': { component: ComingSoon, title: 'Account Settings' },
  '/settings/privacy': { component: ComingSoon, title: 'Privacy & Security' },
  '/settings/notifications': { component: ComingSoon, title: 'Notification Preferences' },
  '/settings/billing': { component: ComingSoon, title: 'Billing & Payments' },
  '/settings/api': { component: ComingSoon, title: 'API & Integrations' },
  
  // Messages
  '/messages': { component: ComingSoon, title: 'Messages' },
};

// Helper function to get route config
export const getRouteConfig = (path: string) => {
  return navigationRoutes[path] || null;
};

// Helper function to check if route exists
export const isValidRoute = (path: string) => {
  return path in navigationRoutes;
};