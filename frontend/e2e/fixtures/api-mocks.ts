import { Page, Route } from '@playwright/test';
import { TEST_USERS, TEST_PITCHES } from './test-data';

export interface MockAPIResponse {
  status?: number;
  body?: any;
  headers?: Record<string, string>;
  delay?: number;
}

export class APIMockManager {
  constructor(private page: Page) {}

  /**
   * Mock all critical API endpoints for offline testing
   */
  async mockAllEndpoints() {
    await Promise.all([
      this.mockAuthEndpoints(),
      this.mockDashboardEndpoints(),
      this.mockNDAEndpoints(),
      this.mockSavedPitchesEndpoints(),
      this.mockNotificationEndpoints(),
      this.mockPitchEndpoints(),
      this.mockUserEndpoints()
    ]);
  }

  /**
   * Mock authentication endpoints
   */
  async mockAuthEndpoints() {
    // Mock session check
    await this.page.route('**/api/auth/session', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          user: {
            id: 'test-user-id',
            email: TEST_USERS.investor.email,
            name: TEST_USERS.investor.name,
            portalType: 'investor',
            verified: true,
            createdAt: new Date().toISOString()
          },
          session: {
            id: 'test-session-id',
            userId: 'test-user-id',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });
    });

    // Mock sign in
    await this.page.route('**/api/auth/sign-in', route => {
      const method = route.request().method();
      if (method === 'POST') {
        this.handleRoute(route, {
          status: 200,
          body: { success: true, redirectTo: '/investor/dashboard' }
        });
      }
    });

    // Mock sign out
    await this.page.route('**/api/auth/sign-out', route => {
      this.handleRoute(route, {
        status: 200,
        body: { success: true }
      });
    });
  }

  /**
   * Mock dashboard statistics endpoints
   */
  async mockDashboardEndpoints() {
    // Creator dashboard stats
    await this.page.route('**/api/dashboard/creator/stats', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          totalPitches: 5,
          activeNDAs: 3,
          totalViews: 1247,
          pendingRequests: 2,
          recentActivity: [
            {
              id: '1',
              type: 'nda_signed',
              title: 'NDA signed for "Neon Nights"',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              icon: 'document-signature'
            },
            {
              id: '2',
              type: 'pitch_viewed',
              title: 'Your pitch "The Last Summer" was viewed',
              timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
              icon: 'eye'
            }
          ]
        }
      });
    });

    // Investor dashboard stats
    await this.page.route('**/api/dashboard/investor/stats', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          portfolioValue: 25750000,
          activeInvestments: 8,
          totalROI: 18.5,
          signedNDAs: 12,
          recentActivity: [
            {
              id: '1',
              type: 'investment_opportunity',
              title: 'New pitch matches your investment criteria',
              timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              icon: 'trending-up'
            },
            {
              id: '2',
              type: 'nda_approved',
              title: 'NDA approved for "Cyberpunk Thriller"',
              timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
              icon: 'check-circle'
            }
          ],
          portfolioOverview: [
            {
              id: '1',
              title: 'Action Thriller Portfolio',
              amount: 15000000,
              status: 'active',
              roi: 22.3,
              projects: 5
            },
            {
              id: '2',
              title: 'Drama Series Investment',
              amount: 8500000,
              status: 'development',
              roi: 0,
              projects: 2
            }
          ]
        }
      });
    });

    // Production dashboard stats
    await this.page.route('**/api/dashboard/production/stats', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          activeProjects: 4,
          monthlySubmissions: 23,
          projectsInDevelopment: 2,
          totalRevenue: 45000000,
          recentSubmissions: [
            {
              id: '1',
              title: 'Sci-Fi Epic Proposal',
              creator: 'Alex Creator',
              submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'review',
              budget: 25000000
            }
          ],
          projectPipeline: [
            {
              id: '1',
              title: 'Urban Legends',
              stage: 'pre-production',
              budget: 18000000,
              startDate: '2024-03-01',
              expectedCompletion: '2024-12-15'
            }
          ]
        }
      });
    });
  }

  /**
   * Mock NDA management endpoints
   */
  async mockNDAEndpoints() {
    // Active NDAs
    await this.page.route('**/api/ndas/active', route => {
      this.handleRoute(route, {
        status: 200,
        body: [
          {
            id: 'nda-1',
            pitchId: 'pitch-1',
            pitchTitle: 'Neon Nights',
            creatorName: 'Alex Creator',
            investorName: 'Sarah Investor',
            status: 'approved',
            signedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
            investmentInterest: 2500000
          }
        ]
      });
    });

    // Signed NDAs
    await this.page.route('**/api/ndas/signed', route => {
      this.handleRoute(route, {
        status: 200,
        body: [
          {
            id: 'nda-2',
            pitchId: 'pitch-2',
            pitchTitle: 'The Last Summer',
            creatorName: 'Emma Rodriguez',
            investorName: 'Sarah Investor',
            status: 'signed',
            signedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            investmentInterest: 750000,
            documentUrl: '/api/ndas/nda-2/document'
          }
        ]
      });
    });

    // Incoming NDA requests (for creators)
    await this.page.route('**/api/ndas/incoming-requests', route => {
      this.handleRoute(route, {
        status: 200,
        body: [
          {
            id: 'nda-req-1',
            pitchId: 'pitch-1',
            pitchTitle: 'Neon Nights',
            investorName: 'Sarah Investor',
            investorCompany: 'Pinnacle Investment Group',
            requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            investmentInterest: 2000000,
            timeline: '30_days',
            message: 'Very interested in this cyberpunk thriller project.',
            status: 'pending'
          }
        ]
      });
    });

    // Outgoing NDA requests (for investors)
    await this.page.route('**/api/ndas/outgoing-requests', route => {
      this.handleRoute(route, {
        status: 200,
        body: [
          {
            id: 'nda-req-2',
            pitchId: 'pitch-3',
            pitchTitle: 'The Whispering House',
            creatorName: 'Dr. Elena Vasquez',
            requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            investmentInterest: 1500000,
            timeline: '14_days',
            message: 'Interested in horror project with supernatural elements.',
            status: 'pending'
          }
        ]
      });
    });

    // NDA request submission
    await this.page.route('**/api/ndas/request', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 201,
          body: {
            id: 'new-nda-req',
            message: 'NDA request submitted successfully',
            estimatedResponse: '3-5 business days'
          }
        });
      }
    });

    // NDA approval/rejection
    await this.page.route('**/api/ndas/*/approve', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 200,
          body: {
            id: route.request().url().split('/')[5],
            status: 'approved',
            message: 'NDA approved successfully'
          }
        });
      }
    });

    await this.page.route('**/api/ndas/*/reject', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 200,
          body: {
            id: route.request().url().split('/')[5],
            status: 'rejected',
            message: 'NDA request rejected'
          }
        });
      }
    });
  }

  /**
   * Mock saved pitches endpoints
   */
  async mockSavedPitchesEndpoints() {
    // Get saved pitches
    await this.page.route('**/api/saved-pitches', route => {
      if (route.request().method() === 'GET') {
        this.handleRoute(route, {
          status: 200,
          body: [
            {
              id: 'saved-1',
              pitchId: 'pitch-1',
              pitch: {
                id: 'pitch-1',
                title: 'Neon Nights',
                logline: 'A cyberpunk thriller where a rogue AI hunter must stop an AI from taking over a megacity',
                genre: 'Action',
                budget: 18000000,
                creator: {
                  name: 'Alex Creator',
                  company: 'Creative Studios Inc'
                }
              },
              savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              id: 'saved-2',
              pitchId: 'pitch-2',
              pitch: {
                id: 'pitch-2',
                title: 'The Last Summer',
                logline: 'Three childhood friends reunite in their dying hometown one final summer',
                genre: 'Drama',
                budget: 3500000,
                creator: {
                  name: 'Emma Rodriguez',
                  company: 'Independent Films LLC'
                }
              },
              savedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          ]
        });
      }
    });

    // Save a pitch
    await this.page.route('**/api/saved-pitches', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 201,
          body: {
            id: 'new-saved-pitch',
            message: 'Pitch saved successfully'
          }
        });
      }
    });

    // Remove saved pitch
    await this.page.route('**/api/saved-pitches/*', route => {
      if (route.request().method() === 'DELETE') {
        this.handleRoute(route, {
          status: 200,
          body: {
            message: 'Pitch removed from saved list'
          }
        });
      }
    });
  }

  /**
   * Mock notifications endpoints
   */
  async mockNotificationEndpoints() {
    // Get unread notifications
    await this.page.route('**/api/notifications/unread', route => {
      this.handleRoute(route, {
        status: 200,
        body: [
          {
            id: 'notif-1',
            type: 'nda_request',
            title: 'New NDA Request',
            message: 'Sarah Investor has requested an NDA for your pitch "Neon Nights"',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            read: false,
            actionUrl: '/creator/nda-management'
          },
          {
            id: 'notif-2',
            type: 'pitch_viewed',
            title: 'Pitch Viewed',
            message: 'Your pitch "The Last Summer" was viewed by a potential investor',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            read: false,
            actionUrl: '/creator/analytics'
          }
        ]
      });
    });

    // Mark notification as read
    await this.page.route('**/api/notifications/*/read', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 200,
          body: { message: 'Notification marked as read' }
        });
      }
    });

    // Mark all notifications as read
    await this.page.route('**/api/notifications/mark-all-read', route => {
      if (route.request().method() === 'POST') {
        this.handleRoute(route, {
          status: 200,
          body: { message: 'All notifications marked as read' }
        });
      }
    });
  }

  /**
   * Mock pitch-related endpoints
   */
  async mockPitchEndpoints() {
    // Get marketplace pitches
    await this.page.route('**/api/pitches', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          pitches: [
            {
              id: 'pitch-1',
              ...TEST_PITCHES.actionThriller,
              createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              views: 245,
              saved: false,
              ndaRequired: true
            },
            {
              id: 'pitch-2',
              ...TEST_PITCHES.dramaComing,
              createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              views: 189,
              saved: false,
              ndaRequired: true
            },
            {
              id: 'pitch-3',
              ...TEST_PITCHES.horrorSupernatural,
              createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              views: 167,
              saved: true,
              ndaRequired: true
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 3,
            hasMore: false
          }
        }
      });
    });

    // Get pitch details
    await this.page.route('**/api/pitches/*', route => {
      if (route.request().method() === 'GET') {
        const pitchId = route.request().url().split('/').pop();
        this.handleRoute(route, {
          status: 200,
          body: {
            id: pitchId,
            ...TEST_PITCHES.actionThriller,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            views: 245,
            saved: false,
            ndaRequired: true,
            documents: [
              {
                id: 'doc-1',
                name: 'treatment.pdf',
                type: 'treatment',
                size: 2048576,
                uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                requiresNDA: true
              }
            ]
          }
        });
      }
    });
  }

  /**
   * Mock user-related endpoints
   */
  async mockUserEndpoints() {
    // Get user profile
    await this.page.route('**/api/users/profile', route => {
      this.handleRoute(route, {
        status: 200,
        body: {
          id: 'test-user-id',
          email: TEST_USERS.investor.email,
          name: TEST_USERS.investor.name,
          firstName: TEST_USERS.investor.firstName,
          lastName: TEST_USERS.investor.lastName,
          company: TEST_USERS.investor.company,
          portalType: 'investor',
          profileImage: null,
          verified: true,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    });
  }

  /**
   * Mock error scenarios for testing error handling
   */
  async mockErrorScenarios() {
    // Mock 500 error for dashboard stats
    await this.page.route('**/api/dashboard/*/stats', route => {
      this.handleRoute(route, {
        status: 500,
        body: { error: 'Internal Server Error', message: 'Failed to fetch dashboard statistics' }
      });
    });

    // Mock 404 error for non-existent resources
    await this.page.route('**/api/pitches/non-existent-pitch', route => {
      this.handleRoute(route, {
        status: 404,
        body: { error: 'Not Found', message: 'Pitch not found' }
      });
    });

    // Mock network timeout
    await this.page.route('**/api/slow-endpoint', route => {
      // Don't fulfill - simulates network timeout
      // route.abort('timeout');
    });
  }

  /**
   * Helper method to handle route responses with optional delay
   */
  private handleRoute(route: Route, response: MockAPIResponse) {
    const { status = 200, body, headers, delay = 0 } = response;

    if (delay > 0) {
      setTimeout(() => {
        route.fulfill({
          status,
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        });
      }, delay);
    } else {
      route.fulfill({
        status,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });
    }
  }

  /**
   * Reset all mocks
   */
  async resetMocks() {
    await this.page.unrouteAll();
  }

  /**
   * Enable specific endpoint mocking
   */
  async enableMocksFor(endpoints: string[]) {
    if (endpoints.includes('auth')) await this.mockAuthEndpoints();
    if (endpoints.includes('dashboard')) await this.mockDashboardEndpoints();
    if (endpoints.includes('ndas')) await this.mockNDAEndpoints();
    if (endpoints.includes('saved-pitches')) await this.mockSavedPitchesEndpoints();
    if (endpoints.includes('notifications')) await this.mockNotificationEndpoints();
    if (endpoints.includes('pitches')) await this.mockPitchEndpoints();
    if (endpoints.includes('users')) await this.mockUserEndpoints();
    if (endpoints.includes('errors')) await this.mockErrorScenarios();
  }
}

// Helper functions for quick mock setup
export async function setupBasicMocks(page: Page) {
  const mockManager = new APIMockManager(page);
  await mockManager.enableMocksFor(['auth', 'dashboard', 'notifications']);
  return mockManager;
}

export async function setupCompleteMocks(page: Page) {
  const mockManager = new APIMockManager(page);
  await mockManager.mockAllEndpoints();
  return mockManager;
}

export async function setupErrorMocks(page: Page) {
  const mockManager = new APIMockManager(page);
  await mockManager.mockErrorScenarios();
  return mockManager;
}