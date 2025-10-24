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
  http.get(`${API_BASE}/api/notifications`, () => {
    return HttpResponse.json([
      {
        id: '1',
        type: 'nda_request',
        title: 'New NDA Request',
        message: 'You have a new NDA request for your pitch',
        read: false,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  http.put(`${API_BASE}/api/notifications/:id/read`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      read: true,
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