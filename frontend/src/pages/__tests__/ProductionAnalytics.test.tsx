import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mock functions
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockCheckSession = vi.fn()

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

vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8001' },
  API_URL: 'http://localhost:8001',
}))

vi.mock('@features/analytics/components/charts/RevenueChart', () => ({
  RevenueChart: ({ data }: any) => <div data-testid="revenue-chart">Revenue Chart</div>,
}))

vi.mock('@features/analytics/components/charts/ROIChart', () => ({
  ROIChart: ({ data }: any) => <div data-testid="roi-chart">ROI Chart</div>,
}))

const mockApiResponse = {
  success: true,
  data: {
    productionMetrics: {
      total_projects: 10,
      active_projects: 8,
      completed_projects: 2,
      total_budget: 1550000,
      avg_budget: 155000,
      avg_completion_rate: 20,
      total_spent: 1317500,
    },
    successMetrics: {
      total_revenue: 2500000,
      total_investors: 5,
    },
    monthlyTrends: [
      { month: 'Jan', revenue: 200000, costs: 150000 },
      { month: 'Feb', revenue: 250000, costs: 180000 },
    ],
    projectPerformance: [
      {
        id: '1',
        title: 'Midnight Sun',
        genre: 'Drama',
        roi: 180,
        revenue: 1500000,
        budget: 800000,
        status: 'completed',
        views: 25000,
      },
      {
        id: '2',
        title: 'Deep Waters',
        genre: 'Thriller',
        roi: 120,
        revenue: 900000,
        budget: 750000,
        status: 'production',
        views: 15000,
      },
    ],
    genrePerformance: [],
    timelineAdherence: [],
    crewUtilization: [],
    recentActivity: [],
    timeframe: '30d',
  },
}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

let Component: React.ComponentType

beforeAll(async () => {
  const mod = await import('@portals/production/pages/ProductionAnalytics')
  Component = mod.default
})

describe('ProductionAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    mockCheckSession.mockResolvedValue(undefined)
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading analytics data...')).toBeInTheDocument()
  })

  // ─── Layout ───────────────────────────────────────────────────────

  it('renders page title and description after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Analytics')).toBeInTheDocument()
    })
    expect(screen.getByText(/Comprehensive insights/)).toBeInTheDocument()
  })

  // ─── Data Rendering ──────────────────────────────────────────────

  it('renders key metrics cards', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Active Projects').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Completed Projects').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Avg Budget')).toBeInTheDocument()
  })

  it('renders project performance table', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Project Performance')).toBeInTheDocument()
    })
    expect(screen.getByText('Midnight Sun')).toBeInTheDocument()
    expect(screen.getByText('Deep Waters')).toBeInTheDocument()
  })

  it('renders charts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('revenue-chart')).toBeInTheDocument()
    })
    expect(screen.getByTestId('roi-chart')).toBeInTheDocument()
  })

  it('renders resource utilization cards', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Active Projects').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Completed Projects').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  // ─── Error State ──────────────────────────────────────────────────

  it('shows error alert when API returns error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('API Connection Issue')).toBeInTheDocument()
    })
    expect(screen.getByText(/Analytics API error: 500/)).toBeInTheDocument()
  })

  it('shows error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('API Connection Issue')).toBeInTheDocument()
    })
    expect(screen.getByText(/Network failure/)).toBeInTheDocument()
  })

  // ─── URL Assertion ────────────────────────────────────────────────

  it('fetches from correct API endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    const calledUrl: string = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('/api/production/analytics')
  })

  // ─── Time Range ──────────────────────────────────────────────────

  it('renders time range selector', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    })

    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Production Analytics')).toBeInTheDocument()
    })

    const selectEl = screen.getByDisplayValue('Last 30 days')
    expect(selectEl).toBeInTheDocument()
  })
})
