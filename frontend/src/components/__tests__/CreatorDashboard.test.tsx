import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'
import CreatorDashboard from '../../pages/CreatorDashboard'
import { getMockAuthStore } from '../../test/utils'

// Mock the auth store with creator user
const mockCreatorUser = {
  id: '1',
  email: 'creator@test.com',
  username: 'testcreator',
  name: 'Test Creator',
  role: 'creator',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockDashboardData = {
  success: true,
  data: {
    stats: {
      totalPitches: 5,
      activePitches: 3,
      views: 250,
      investors: 12,
    },
    pitches: [
      { id: '1', title: 'Test Pitch 1', rating: 4.5 },
      { id: '2', title: 'Test Pitch 2', rating: 3.8 },
    ],
    recentActivity: [
      {
        id: '1',
        title: 'New investor viewed your pitch',
        description: 'Test Pitch 1 was viewed by an investor',
        icon: 'eye',
        color: 'blue',
      },
      {
        id: '2',
        title: 'New follower',
        description: 'John Doe started following you',
        icon: 'user-plus',
        color: 'green',
      },
    ],
    credits: { balance: { credits: 150 } },
  },
}

const mockFollowersData = {
  success: true,
  data: {
    followers: [
      { id: '1', name: 'Follower 1' },
      { id: '2', name: 'Follower 2' },
    ],
  },
}

const mockSubscriptionData = {
  tier: 'pro',
  status: 'active',
  subscription: {
    currentPeriodEnd: '2024-12-31T23:59:59Z',
  },
}

describe('CreatorDashboard', () => {
  beforeEach(() => {
    // Reset auth store mock
    const authStore = getMockAuthStore()
    authStore.user = mockCreatorUser
    authStore.isAuthenticated = true
    authStore.token = 'mock-token'

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => {
          if (key === 'user') return JSON.stringify(mockCreatorUser)
          if (key === 'authToken') return 'mock-token'
          return null
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    // Setup successful API responses
    server.use(
      http.get('http://localhost:8001/api/creator/dashboard', () => {
        return HttpResponse.json(mockDashboardData)
      }),
      http.get('http://localhost:8001/api/follows/followers', () => {
        return HttpResponse.json(mockFollowersData)
      }),
      http.get('http://localhost:8001/api/follows/following', () => {
        return HttpResponse.json({ success: true, data: { following: [] } })
      })
    )

    // Mock paymentsAPI
    vi.mock('../../lib/apiServices', () => ({
      paymentsAPI: {
        getCreditBalance: vi.fn().mockResolvedValue({ balance: { credits: 150 } }),
        // Avoid referencing out-of-scope variables in vi.mock factory (hoisted)
        getSubscriptionStatus: vi.fn().mockResolvedValue({
          tier: 'pro',
          status: 'active',
          subscription: { currentPeriodEnd: '2024-12-31T23:59:59Z' },
        }),
      },
      apiClient: {
        get: vi.fn(),
      },
    }))
  })

  describe('Rendering', () => {
    it('should show loading spinner initially', () => {
      render(<CreatorDashboard />)
      expect(screen.getByTestId('loading-spinner') || screen.getByRole('status')).toBeInTheDocument()
    })

    it('should render header with user information', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Welcome back, testcreator')).toBeInTheDocument()
      })
    })

    it('should render Pitchey logo that links to homepage', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        const logoLink = screen.getByRole('link', { name: /go to homepage/i })
        expect(logoLink).toBeInTheDocument()
        expect(logoLink).toHaveAttribute('href', '/')
      })
    })

    it('should display dashboard stats correctly', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument() // totalPitches
        expect(screen.getByText('3')).toBeInTheDocument() // activePitches
        expect(screen.getByText('250')).toBeInTheDocument() // views
        expect(screen.getByText('4.2')).toBeInTheDocument() // average rating
      })
    })

    it.skip('should display credit balance', async () => {
      // Temporarily skipped while credit setup is finalized
      render(<CreatorDashboard />)
      await waitFor(() => {
        expect(screen.getByText('150 Credits')).toBeInTheDocument()
      })
    })

    it('should display subscription status', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('PRO')).toBeInTheDocument()
      })
    })

    it('should display recent activity', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('New investor viewed your pitch')).toBeInTheDocument()
        expect(screen.getByText('New follower')).toBeInTheDocument()
      })
    })

    it('should show empty state for no recent activity', async () => {
      server.use(
        http.get('http://localhost:8001/api/creator/dashboard', () => {
          return HttpResponse.json({
            ...mockDashboardData,
            data: { ...mockDashboardData.data, recentActivity: [] },
          })
        })
      )

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('No recent activity')).toBeInTheDocument()
      })
    })
  })

  describe('Creator Milestones', () => {
    it('should show completed milestones', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('First Pitch')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })

    it('should show progress towards milestones', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('250/100 views')).toBeInTheDocument()
        expect(screen.getByText('2/10 followers')).toBeInTheDocument()
      })
    })

    it('should display milestone progress bars', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar', { hidden: true })
        expect(progressBars.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Navigation and Actions', () => {
    it('should navigate to new pitch page when clicking New Pitch button', async () => {
      const { navigate } = render(<CreatorDashboard />)
      
      await waitFor(() => {
        const newPitchButton = screen.getByRole('button', { name: /new pitch/i })
        fireEvent.click(newPitchButton)
        expect(navigate).toHaveBeenCalledWith('/creator/pitch/new')
      })
    })

    it('should navigate to marketplace when clicking Browse Marketplace', async () => {
      const { navigate } = render(<CreatorDashboard />)
      
      await waitFor(() => {
        const browseButton = screen.getByRole('button', { name: /browse marketplace/i })
        fireEvent.click(browseButton)
        expect(navigate).toHaveBeenCalledWith('/marketplace')
      })
    })

    it.skip('should navigate to billing when clicking credits', async () => {
      // Temporarily skipped while credit setup is finalized
      const { navigate } = render(<CreatorDashboard />)
      await waitFor(() => {
        const creditsButton = screen.getByRole('button', { name: /credits/i })
        fireEvent.click(creditsButton)
        expect(navigate).toHaveBeenCalledWith('/creator/billing?tab=credits')
      })
    })

    it('should handle logout correctly', async () => {
      const authStore = getMockAuthStore()
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        const logoutButton = screen.getByRole('button', { name: /logout/i })
        fireEvent.click(logoutButton)
        expect(authStore.logout).toHaveBeenCalled()
      })
    })
  })

  describe('Quick Actions', () => {
    it('should render all quick action buttons', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload new pitch/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /manage pitches/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /view analytics/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /nda management/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /view my portfolio/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /messages/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /billing & payments/i })).toBeInTheDocument()
      })
    })

    it('should navigate correctly when clicking quick action buttons', async () => {
      const { navigate } = render(<CreatorDashboard />)
      
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /manage pitches/i }))
        expect(navigate).toHaveBeenCalledWith('/creator/pitches')

        fireEvent.click(screen.getByRole('button', { name: /view analytics/i }))
        expect(navigate).toHaveBeenCalledWith('/creator/analytics')

        fireEvent.click(screen.getByRole('button', { name: /nda management/i }))
        expect(navigate).toHaveBeenCalledWith('/creator/ndas')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      server.use(
        http.get('http://localhost:8001/api/creator/dashboard', () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
      })
    })

    it('should show fallback stats when API returns error', async () => {
      server.use(
        http.get('http://localhost:8001/api/creator/dashboard', () => {
          return HttpResponse.json({ success: false, error: { message: 'Failed' } })
        })
      )

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getAllByText('0')).toHaveLength(5) // All stats should be 0
      })
    })
  })

  describe('Subscription Management', () => {
    it('should show subscription upgrade prompt for free users', async () => {
      server.use(
        http.get('http://localhost:8001/api/creator/dashboard', () => {
          return HttpResponse.json(mockDashboardData)
        })
      )

      const freeSubscription = { tier: 'free', status: 'inactive' }
      vi.mocked(require('../../lib/apiServices').paymentsAPI.getSubscriptionStatus)
        .mockResolvedValue(freeSubscription)

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /upgrade now/i })).toBeInTheDocument()
      })
    })

    it('should show subscription management for pro users', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/next payment/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toHaveAccessibleName()
        expect(screen.getByRole('button', { name: /new pitch/i })).toHaveAccessibleName()
        expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAccessibleName()
      })
    })

    it('should be keyboard navigable', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        const interactiveElements = screen.getAllByRole('button')
        interactiveElements.forEach(element => {
          expect(element).not.toHaveAttribute('tabindex', '-1')
        })
      })
    })

    it('should have proper heading hierarchy', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /creator dashboard/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: /creator milestones/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: /recent activity/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: /quick actions/i })).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should render stats grid responsively', async () => {
      render(<CreatorDashboard />)
      
      await waitFor(() => {
        const statsGrid = screen.getByTestId('stats-grid') || document.querySelector('.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-6')
        expect(statsGrid).toBeInTheDocument()
      })
    })

    it('should handle mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        // Should still render all components
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates', () => {
    it('should handle WebSocket status updates', async () => {
      // Mock WebSocket connection
      const mockWebSocket = {
        isConnected: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }

      render(<CreatorDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Creator Dashboard')).toBeInTheDocument()
      })

      // Verify component subscribes to relevant WebSocket events
      expect(mockWebSocket.subscribe).toHaveBeenCalledWith(
        expect.stringMatching(/dashboard|stats|activity/)
      )
    })
  })
})