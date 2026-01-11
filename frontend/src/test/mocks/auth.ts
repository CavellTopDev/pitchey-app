/**
 * Authentication Mock Data
 * Matches Better Auth production structure
 */

export const mockUser = {
  id: 'mock-user-uuid',
  email: 'test@example.com',
  name: 'Test User',
  portalType: 'creator', // Better Auth uses portalType, not portal
  company: 'Test Company',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  subscription_tier: 'basic',
  role: 'user'
};

export const mockSession = {
  id: 'mock-session-uuid',
  userId: mockUser.id,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  // No token - Better Auth uses HTTP-only cookies
};

export const mockAuthResponse = {
  user: mockUser,
  session: mockSession
};