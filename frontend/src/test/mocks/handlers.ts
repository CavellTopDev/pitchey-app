import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:8001'

// Mock data
const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'creator',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockPitch = {
  id: '1',
  title: 'Test Pitch',
  description: 'A test pitch description',
  genre: 'Drama',
  duration: 120,
  budget: 1000000,
  format: 'Feature Film',
  status: 'published',
  creator: mockUser,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isPublic: true,
  ndaRequired: false,
  themes: ['Action', 'Adventure'],
  characters: [],
  documents: [],
}

const mockDashboardStats = {
  totalPitches: 5,
  publishedPitches: 3,
  draftPitches: 2,
  totalViews: 150,
  totalInteractions: 25,
  ndaRequests: 3,
  activeNDAs: 2,
}

const mockNDARequest = {
  id: '1',
  pitchId: '1',
  investorId: '2',
  status: 'pending',
  requestedAt: '2024-01-01T00:00:00Z',
  investor: {
    id: '2',
    name: 'Test Investor',
    email: 'investor@example.com',
    company: 'Test Investment Co.',
  },
}

export const handlers = [
  // Authentication endpoints
  http.post(`${API_BASE}/api/auth/creator/login`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: mockUser,
    })
  }),

  http.post(`${API_BASE}/api/auth/investor/login`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { ...mockUser, role: 'investor' },
    })
  }),

  http.post(`${API_BASE}/api/auth/production/login`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { ...mockUser, role: 'production' },
    })
  }),

  http.post(`${API_BASE}/api/auth/register`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: mockUser,
    })
  }),

  http.post(`${API_BASE}/api/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  // Dashboard endpoints
  http.get(`${API_BASE}/api/creator/dashboard`, () => {
    return HttpResponse.json(mockDashboardStats)
  }),
  // Funding overview used by CreatorDashboard
  http.get(`${API_BASE}/api/creator/funding/overview`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        totalRaised: 50000,
        fundingGoal: 100000,
        activeInvestors: 3,
        averageInvestment: 16666.67,
        fundingProgress: 50,
        monthlyGrowth: 12,
        recentInvestments: [
          { id: 1, amount: 10000, investorName: 'Investor A', date: new Date() },
          { id: 2, amount: 20000, investorName: 'Investor B', date: new Date() },
        ],
        topInvestor: { name: 'Investor B', amount: 20000 },
      }
    })
  }),

  http.get(`${API_BASE}/api/investor/dashboard`, () => {
    return HttpResponse.json({
      ...mockDashboardStats,
      reviewedPitches: 8,
      savedPitches: 4,
      activeInvestments: 2,
    })
  }),

  http.get(`${API_BASE}/api/production/dashboard`, () => {
    return HttpResponse.json({
      ...mockDashboardStats,
      projectsInDevelopment: 3,
      completedProjects: 5,
    })
  }),

  // Pitch endpoints
  http.get(`${API_BASE}/api/pitches`, () => {
    return HttpResponse.json({
      pitches: [mockPitch],
      total: 1,
      page: 1,
      totalPages: 1,
    })
  }),

  http.get(`${API_BASE}/api/pitches/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockPitch,
      id: params.id,
    })
  }),

  http.post(`${API_BASE}/api/pitches`, () => {
    return HttpResponse.json({
      ...mockPitch,
      id: Date.now().toString(),
    })
  }),

  http.put(`${API_BASE}/api/pitches/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockPitch,
      id: params.id,
      updatedAt: new Date().toISOString(),
    })
  }),

  http.delete(`${API_BASE}/api/pitches/:id`, () => {
    return HttpResponse.json({ message: 'Pitch deleted successfully' })
  }),

  // NDA endpoints
  http.get(`${API_BASE}/api/nda/requests`, () => {
    return HttpResponse.json([mockNDARequest])
  }),

  // NDA stats endpoints used by dashboard components
  http.get(`${API_BASE}/api/ndas/stats`, () => {
    return HttpResponse.json({ success: true, data: { stats: {
      total: 4,
      pending: 1,
      approved: 2,
      rejected: 1,
      expired: 0,
      revoked: 0,
      avgResponseTime: 24,
      approvalRate: 0.66,
    } } })
  }),

  http.get(`${API_BASE}/api/ndas`, () => {
    return HttpResponse.json({ success: true, data: { ndas: [
      {
        id: 1,
        status: 'pending',
        pitch: { title: 'Test Pitch' },
        requester: { username: 'Investor A', userType: 'investor' },
        requestedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      }
    ], total: 1 } })
  }),

  http.post(`${API_BASE}/api/nda/request`, () => {
    return HttpResponse.json({
      ...mockNDARequest,
      id: Date.now().toString(),
    })
  }),

  http.put(`${API_BASE}/api/nda/requests/:id/approve`, ({ params }) => {
    return HttpResponse.json({
      ...mockNDARequest,
      id: params.id,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    })
  }),

  http.put(`${API_BASE}/api/nda/requests/:id/reject`, ({ params }) => {
    return HttpResponse.json({
      ...mockNDARequest,
      id: params.id,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
    })
  }),

  // Search endpoints
  http.get(`${API_BASE}/api/search/pitches`, () => {
    return HttpResponse.json({
      pitches: [mockPitch],
      total: 1,
      filters: {
        genres: ['Drama', 'Comedy', 'Action'],
        budgetRanges: ['0-100K', '100K-1M', '1M+'],
        formats: ['Feature Film', 'TV Series', 'Short Film'],
      },
    })
  }),

  // User profile endpoints
  http.get(`${API_BASE}/api/users/profile`, () => {
    return HttpResponse.json(mockUser)
  }),

  http.put(`${API_BASE}/api/users/profile`, () => {
    return HttpResponse.json({
      ...mockUser,
      updatedAt: new Date().toISOString(),
    })
  }),

  // File upload endpoints
  http.post(`${API_BASE}/api/upload`, () => {
    return HttpResponse.json({
      url: 'https://mock-upload-url.com/file.pdf',
      filename: 'test-document.pdf',
      size: 1024000,
    })
  }),

  // Analytics endpoints
  http.get(`${API_BASE}/api/analytics/pitch/:id`, ({ params }) => {
    return HttpResponse.json({
      pitchId: params.id,
      views: 50,
      interactions: 8,
      viewsByDate: [
        { date: '2024-01-01', views: 10 },
        { date: '2024-01-02', views: 15 },
        { date: '2024-01-03', views: 25 },
      ],
    })
  }),

  // Notifications endpoints
  http.get(`${API_BASE}/api/user/notifications`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        notifications: [
          {
            id: 1,
            userId: 1,
            type: 'nda_request',
            title: 'New NDA Request',
            message: 'You have a new NDA request for your pitch',
            isRead: false,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        message: 'ok'
      }
    })
  }),

  http.get(`${API_BASE}/api/notifications/unread`, () => {
    return HttpResponse.json({ success: true, data: [] })
  }),

  http.get(`${API_BASE}/api/notifications/:id/read`, ({ params }) => {
    return HttpResponse.json({ success: true, id: params.id })
  }),

  // Analytics endpoints used by EnhancedCreatorAnalytics
  http.get(`${API_BASE}/api/analytics/dashboard`, ({ request }) => {
    return HttpResponse.json({
      success: true,
      metrics: {
        overview: {
          totalViews: 1200,
          totalLikes: 340,
          totalFollowers: 220,
          totalPitches: 5,
          viewsChange: 15,
          likesChange: 8,
          followersChange: 12,
          pitchesChange: 1,
        },
        performance: {
          topPitches: [],
          recentActivity: [],
          engagementTrend: Array.from({ length: 12 }, (_, i) => ({
            date: new Date(2024, i, 1).toISOString().split('T')[0],
            rate: Math.floor(Math.random() * 30) + 40,
          })),
        },
        revenue: {
          total: 50000,
          subscriptions: 30000,
          transactions: 20000,
          growth: 12,
        },
      },
    })
  }),

  http.get(`${API_BASE}/api/analytics/user`, ({ request }) => {
    return HttpResponse.json({
      success: true,
      analytics: {
        userId: 1,
        username: 'testcreator',
        totalPitches: 5,
        publishedPitches: 3,
        totalViews: 1200,
        totalLikes: 340,
        totalFollowers: 220,
        totalNDAs: 10,
        avgEngagement: 65,
        topPitches: [
          { id: 1, title: 'Test Pitch 1', views: 400, engagement: 78 },
          { id: 2, title: 'Test Pitch 2', views: 300, engagement: 72 },
        ],
        growthMetrics: Array.from({ length: 6 }, (_, i) => ({
          date: new Date(2024, i * 2, 1).toISOString().split('T')[0],
          followers: 100 + i * 20,
          views: 200 + i * 50,
          engagement: 60 + i,
        })),
        audienceInsights: {
          topLocations: [
            { location: 'US', percentage: 40 },
            { location: 'UK', percentage: 20 },
          ],
          topUserTypes: [
            { type: 'Investors', percentage: 50 },
            { type: 'Producers', percentage: 30 },
          ],
          peakActivity: [
            { hour: 10, activity: 80 },
            { hour: 20, activity: 60 },
          ],
        },
      },
    })
  }),

  http.put(`${API_BASE}/api/notifications/:id/read`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      read: true,
    })
  }),

  // Follow system endpoints
  http.get(`${API_BASE}/api/follows/followers`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        followers: [
          {
            id: 2,
            username: 'investor1',
            name: 'Test Investor',
            userType: 'investor',
            followedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 3,
            username: 'producer1',
            name: 'Test Producer',
            userType: 'production',
            followedAt: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
      }
    })
  }),

  http.get(`${API_BASE}/api/follows/following`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        following: [
          {
            id: 4,
            username: 'creator2',
            name: 'Other Creator',
            userType: 'creator',
            followedAt: '2024-01-03T00:00:00Z',
          },
        ],
        total: 1,
      }
    })
  }),

  // Error handlers for testing error states
  http.get(`${API_BASE}/api/error/500`, () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }),

  http.get(`${API_BASE}/api/error/401`, () => {
    return HttpResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    )
  }),

  http.get(`${API_BASE}/api/error/404`, () => {
    return HttpResponse.json(
      { message: 'Not found' },
      { status: 404 }
    )
  }),
]