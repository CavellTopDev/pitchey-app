// Navigation Routes Configuration
// This file centralizes all route definitions for the application

export const CREATOR_ROUTES = {
  // Main Dashboard
  dashboard: '/creator/dashboard',
  analytics: '/creator/analytics',
  activity: '/creator/activity',
  stats: '/creator/stats',
  
  // Pitch Management
  pitches: '/creator/pitches',
  pitchNew: '/creator/pitch/new',
  pitchesPublished: '/creator/pitches/published',
  pitchesDrafts: '/creator/pitches/drafts',
  pitchesReview: '/creator/pitches/review',
  pitchesAnalytics: '/creator/pitches/analytics',
  
  // Team Management
  teamMembers: '/creator/team/members',
  teamInvite: '/creator/team/invite',
  teamRoles: '/creator/team/roles',
  collaborations: '/creator/collaborations',
  
  // Other
  portfolio: '/creator/portfolio',
  ndas: '/creator/ndas',
  messages: '/creator/messages',
  calendar: '/creator/calendar',
  following: '/creator/following',
  profile: '/creator/profile',
  settings: '/creator/settings',
};

export const INVESTOR_ROUTES = {
  // Main Dashboard
  dashboard: '/investor/dashboard',
  portfolio: '/investor/portfolio',
  analytics: '/investor/analytics',
  activity: '/investor/activity',
  performance: '/investor/performance',
  
  // Deal Management
  deals: '/investor/deals',
  pendingDeals: '/investor/pending-deals',
  allInvestments: '/investor/all-investments',
  completedProjects: '/investor/completed-projects',
  
  // Discovery
  browse: '/investor/browse',
  discover: '/investor/discover',
  saved: '/investor/saved',
  watchlist: '/investor/watchlist',
  
  // Financial
  financialOverview: '/investor/financial-overview',
  transactionHistory: '/investor/transaction-history',
  budgetAllocation: '/investor/budget-allocation',
  roiAnalysis: '/investor/roi-analysis',
  reports: '/investor/reports',
  taxDocuments: '/investor/tax-documents',
  
  // Market Analysis
  marketTrends: '/investor/market-trends',
  riskAssessment: '/investor/risk-assessment',
  
  // Network
  network: '/investor/network',
  coInvestors: '/investor/co-investors',
  creators: '/investor/creators',
  productionCompanies: '/investor/production-companies',
  
  // Account
  wallet: '/investor/wallet',
  paymentMethods: '/investor/payment-methods',
  settings: '/investor/settings',
  following: '/investor/following',
  ndaRequests: '/investor/nda-requests',
};

export const PRODUCTION_ROUTES = {
  // Main Dashboard
  dashboard: '/production/dashboard',
  analytics: '/production/analytics',
  activity: '/production/activity',
  stats: '/production/stats',
  
  // Project Management
  projects: '/production/projects',
  projectsActive: '/production/projects/active',
  projectsDevelopment: '/production/projects/development',
  projectsPost: '/production/projects/post',
  projectsCompleted: '/production/projects/completed',
  pipeline: '/production/pipeline',
  
  // Submissions
  submissions: '/production/submissions',
  submissionsNew: '/production/submissions/new',
  submissionsReview: '/production/submissions/review',
  submissionsShortlisted: '/production/submissions/shortlisted',
  submissionsAccepted: '/production/submissions/accepted',
  submissionsRejected: '/production/submissions/rejected',
  submissionsArchive: '/production/submissions/archive',
  
  // Operations
  revenue: '/production/revenue',
  saved: '/production/saved',
  collaborations: '/production/collaborations',
  
  // Team
  teamInvite: '/production/team/invite',
  teamRoles: '/production/team/roles',
  
  // Other
  following: '/production/following',
  settings: '/production/settings',
};

export const PUBLIC_ROUTES = {
  home: '/',
  marketplace: '/marketplace',
  browse: '/browse',
  howItWorks: '/how-it-works',
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  portals: '/portals',
  
  // Login routes
  loginCreator: '/login/creator',
  loginInvestor: '/login/investor',
  loginProduction: '/login/production',
  
  // Public pitch view
  pitch: '/pitch/:id',
  userPortfolio: '/portfolio/:username',
};

export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  users: '/admin/users',
  content: '/admin/content',
  analytics: '/admin/analytics',
  settings: '/admin/settings',
};