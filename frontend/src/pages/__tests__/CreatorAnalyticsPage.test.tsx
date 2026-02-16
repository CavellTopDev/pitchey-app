import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import CreatorAnalyticsPage from '../CreatorAnalyticsPage'

// Mock analytics service
const mockGetDashboardMetrics = vi.fn()
const mockGetCreatorAnalytics = vi.fn()

vi.mock('../../services/analytics.service', () => ({
  AnalyticsService: { getDashboardMetrics: (...args: any[]) => mockGetDashboardMetrics(...args) },
  analyticsService: { getDashboardMetrics: (...args: any[]) => mockGetDashboardMetrics(...args) },
}))

vi.mock('../../services/creator.service', () => ({
  CreatorService: { getAnalytics: (...args: any[]) => mockGetCreatorAnalytics(...args) },
  creatorService: { getAnalytics: (...args: any[]) => mockGetCreatorAnalytics(...args) },
}))

// Mock sub-components to keep tests focused
vi.mock('../../components/Analytics/CreatorAnalytics', () => ({
  CreatorAnalytics: ({ pitchPerformance }: any) => (
    <div data-testid="creator-analytics">
      Views: {pitchPerformance?.totalViews || 0}
    </div>
  ),
}))

vi.mock('../creator/CreatorActivity', () => ({
  default: () => <div data-testid="creator-activity">Activity Tab</div>,
}))

vi.mock('../creator/CreatorStats', () => ({
  default: () => <div data-testid="creator-stats">Stats Tab</div>,
}))

const mockDashboardMetrics = {
  overview: {
    totalViews: 5000,
    totalLikes: 800,
    viewsChange: 12,
    likesChange: 5,
    totalFollowers: 200,
    totalPitches: 10,
    followersChange: 3,
    pitchesChange: 1,
  },
  revenue: {
    total: 50000,
    growth: 15,
  },
  performance: {
    topPitches: [],
    recentActivity: [],
    engagementTrend: [],
  },
}

const mockCreatorAnalytics = {
  viewsOverTime: [],
  likesOverTime: [],
  topPitches: [
    { id: 1, title: 'My Best Pitch', views: 2000, likes: 300 },
    { id: 2, title: 'Another Great Pitch', views: 1500, likes: 200 },
  ],
  audienceBreakdown: [
    { userType: 'investor', count: 150, percentage: 60 },
    { userType: 'production', count: 100, percentage: 40 },
  ],
}

describe('CreatorAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner initially', () => {
    mockGetDashboardMetrics.mockReturnValue(new Promise(() => {}))
    mockGetCreatorAnalytics.mockReturnValue(new Promise(() => {}))

    render(<CreatorAnalyticsPage />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  // ─── Graceful Degradation (both services fail) ────────────────────

  it('shows empty data placeholders when both services fail gracefully', async () => {
    // Individual .catch(() => null) in the component handles each failure,
    // so both return null and the UI renders with empty data
    mockGetDashboardMetrics.mockRejectedValue(new Error('Dashboard failed'))
    mockGetCreatorAnalytics.mockRejectedValue(new Error('Creator failed'))

    render(<CreatorAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics & Insights')).toBeInTheDocument()
    })
    expect(screen.getByText('No pitch data available yet')).toBeInTheDocument()
    expect(screen.getByText('No audience data available yet')).toBeInTheDocument()
  })

  // ─── Success State ────────────────────────────────────────────────

  it('renders heading, tabs, and overview content on success', async () => {
    mockGetDashboardMetrics.mockResolvedValue(mockDashboardMetrics)
    mockGetCreatorAnalytics.mockResolvedValue(mockCreatorAnalytics)

    render(<CreatorAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics & Insights')).toBeInTheDocument()
    })

    // Tab labels
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.getByText('Quick Stats')).toBeInTheDocument()

    // Overview content: top pitches and audience insights
    expect(screen.getByText('Top Performing Pitches')).toBeInTheDocument()
    expect(screen.getByText('My Best Pitch')).toBeInTheDocument()
    expect(screen.getByText('Audience Insights')).toBeInTheDocument()
  })

  it('shows audience breakdown percentages', async () => {
    mockGetDashboardMetrics.mockResolvedValue(mockDashboardMetrics)
    mockGetCreatorAnalytics.mockResolvedValue(mockCreatorAnalytics)

    render(<CreatorAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('60%')).toBeInTheDocument()
    })
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  // ─── Tab Switching ────────────────────────────────────────────────

  it('switches to Activity tab on click', async () => {
    mockGetDashboardMetrics.mockResolvedValue(mockDashboardMetrics)
    mockGetCreatorAnalytics.mockResolvedValue(mockCreatorAnalytics)

    render(<CreatorAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics & Insights')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Activity'))

    await waitFor(() => {
      expect(screen.getByTestId('creator-activity')).toBeInTheDocument()
    })
  })

  it('switches to Quick Stats tab on click', async () => {
    mockGetDashboardMetrics.mockResolvedValue(mockDashboardMetrics)
    mockGetCreatorAnalytics.mockResolvedValue(mockCreatorAnalytics)

    render(<CreatorAnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics & Insights')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Quick Stats'))

    await waitFor(() => {
      expect(screen.getByTestId('creator-stats')).toBeInTheDocument()
    })
  })
})
