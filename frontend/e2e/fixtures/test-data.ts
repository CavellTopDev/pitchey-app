// Test data for E2E tests
export const TEST_USERS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    name: 'Alex Creator',
    portal: 'creator'
  },
  investor: {
    email: 'sarah.investor@demo.com', 
    password: 'Demo123',
    name: 'Sarah Investor',
    portal: 'investor'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    name: 'Stellar Production',
    portal: 'production'
  }
};

export const TEST_PITCH = {
  title: 'E2E Test Movie Pitch',
  logline: 'A comprehensive test of the pitch creation system',
  synopsis: 'This is a test synopsis for our E2E testing suite. It should be detailed enough to validate the pitch creation workflow.',
  genre: 'Action',
  themes: 'Technology, Innovation, Testing',
  format: 'Feature Film',
  budget: '10000000',
  targetAudience: 'General Audiences',
  world: 'A digital testing environment where every interaction is validated'
};

export const TEST_CHARACTER = {
  name: 'Test Character',
  description: 'A character created for testing purposes',
  role: 'Protagonist',
  arc: 'Goes from untested to thoroughly validated'
};

export const URLS = {
  homepage: '/',
  portalSelect: '/portal-select',
  creatorLogin: '/creator/login',
  investorLogin: '/investor/login', 
  productionLogin: '/production/login',
  creatorDashboard: '/creator/dashboard',
  investorDashboard: '/investor/dashboard',
  productionDashboard: '/production/dashboard',
  createPitch: '/create-pitch',
  marketplace: '/marketplace',
  browse: '/browse'
};