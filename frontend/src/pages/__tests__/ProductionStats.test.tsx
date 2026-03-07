import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockCheckSession = vi.fn()
const mockGetDashboard = vi.fn()
const mockGetAnalytics = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// Auth store - STABLE reference
const mockUser = { id: 1, name: 'Production User', email: 'production@test.com', user_type: 'production' }
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
  checkSession: mockCheckSession,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

vi.mock('@/portals/production/services/production.service', () => ({
  ProductionService: {
    getDashboard: (...args: any[]) => mockGetDashboard(...args),
    getAnalytics: (...args: any[]) => mockGetAnalytics(...args),
  },
}))

vi.mock('@features/analytics/components/charts/RevenueChart', () => ({
  RevenueChart: () => <div data-testid="revenue-chart">Revenue Chart</div>,
}))

vi.mock('@features/analytics/components/charts/ProjectStatusChart', () => ({
  ProjectStatusChart: () => <div data-testid="project-status-chart">Project Status Chart</div>,
}))

const mockDashboardData = {
  stats: {
    totalProjects: 12,
    activeProjects: 5,
    totalBudget: 8000000,
    pitchesReviewed: 45,
    pitchesContracted: 8,
    ndaSigned: 15,
  },
}

const mockAnalyticsData = {
  productionMetrics: {
    total_projects: 12,
    active_projects: 5,
    completed_projects: 3,
    total_budget: 8000000,
    avg_budget: 666667,
    avg_completion_rate: 25,
    total_spent: 6800000,
  },
  successMetrics: {
    total_revenue: 2500000,
    total_investors: 5,
  },
  monthlyTrends: [
    { month: 'Jan', projects_created: 2, views: 10, revenue: 200000, costs: 150000 },
    { month: 'Feb', projects_created: 1, views: 15, revenue: 300000, costs: 200000 },
  ],
  timelineAdherence: [
    { stage: 'Development', projects: 3, budget: 500000, on_time_percentage: 100 },
    { stage: 'Production', projects: 5, budget: 2000000, on_time_percentage: 100 },
    { stage: 'Distribution', projects: 3, budget: 1000000, on_time_percentage: 100 },
  ],
  projectPerformance: [],
  timeframe: '30d',
}

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('@portals/production/pages/ProductionStats')
  Component = mod.default
})

describe('ProductionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckSession.mockResolvedValue(undefined)
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {}))
    mockGetAnalytics.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading statistics...')).toBeInTheDocument()
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page title and description after loading', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    expect(screen.getByText(/Quick insights and key performance indicators/)).toBeInTheDocument()
  })

  // ─── Quick Stats ─────────────────────────────────────────────────

  it('renders quick stats cards from dashboard data', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Projects')).toBeInTheDocument()
    })
    expect(screen.getByText('Active Projects')).toBeInTheDocument()
    expect(screen.getByText('Total Budget')).toBeInTheDocument()
    expect(screen.getByText('Pitches Reviewed')).toBeInTheDocument()
    expect(screen.getByText('Deals Signed')).toBeInTheDocument()
    expect(screen.getByText('NDAs Signed')).toBeInTheDocument()
  })

  it('renders stat values correctly', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('$8.0M')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  // ─── KPI Summary ─────────────────────────────────────────────────

  it('renders recent trends section with analytics data', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Recent Trends')).toBeInTheDocument()
    })
    expect(screen.getByText('Deal Conversion')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    // Completion rate derived from productionMetrics.avg_completion_rate = 25
    // Appears in both Deal Conversion and Success Rate
    expect(screen.getAllByText('25%').length).toBeGreaterThanOrEqual(1)
  })

  // ─── Charts ──────────────────────────────────────────────────────

  it('renders revenue and project status charts', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('revenue-chart')).toBeInTheDocument()
    })
    expect(screen.getByTestId('project-status-chart')).toBeInTheDocument()
  })

  // ─── Empty / Error State ───────────────────────────────────────────

  it('renders dash values when analytics returns null', async () => {
    mockGetDashboard.mockResolvedValue(null)
    mockGetAnalytics.mockResolvedValue(null)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    // Recent Trends labels still render, but values show '—'
    expect(screen.getByText('Deal Conversion')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('renders without quick stats when dashboard returns no stats', async () => {
    mockGetDashboard.mockResolvedValue({})
    mockGetAnalytics.mockResolvedValue(null)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })
    // quickStats array stays empty - no stat cards
    expect(screen.queryByText('Total Projects')).not.toBeInTheDocument()
  })

  // ─── Time Range ──────────────────────────────────────────────────

  it('renders time range selector with correct options', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Overview')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Last 30 days')).toBeInTheDocument()
  })

  it('renders refresh button', async () => {
    mockGetDashboard.mockResolvedValue(mockDashboardData)
    mockGetAnalytics.mockResolvedValue(mockAnalyticsData)

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })
})
