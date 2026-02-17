import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetMarketTrends = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => ({
    user: { id: 1, name: 'Test Investor', email: 'investor@test.com' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}))

vi.mock('../../services/investor.service', () => ({
  investorApi: {
    getMarketTrends: mockGetMarketTrends,
  },
}))

const mockTrendsResponse = (overrides: Record<string, any> = {}) => ({
  success: true,
  data: {
    marketGrowth: 22.5,
    totalInvestment: 500000000,
    activePitches: 2500,
    topGenres: [
      { genre: 'Action', count: 15 },
      { genre: 'Drama', count: 12 },
      { genre: 'Comedy', count: 8 },
    ],
    avgInvestmentByGenre: [
      { genre: 'Action', avg_investment: 75000, total_volume: 1125000 },
      { genre: 'Drama', avg_investment: 50000, total_volume: 600000 },
    ],
    ...overrides,
  },
})

let MarketTrends: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/MarketTrends')
  MarketTrends = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MarketTrends />
    </MemoryRouter>
  )
}

describe('MarketTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMarketTrends.mockResolvedValue(mockTrendsResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Loading State ---

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetMarketTrends.mockReturnValue(new Promise(() => {}))
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading after data loads', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Market Trends')).toBeInTheDocument()
      })
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeFalsy()
    })
  })

  // --- Success State ---

  describe('Success State', () => {
    it('renders the Market Trends heading', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Market Trends')).toBeInTheDocument()
        expect(screen.getByText('Industry trends and market analysis')).toBeInTheDocument()
      })
    })

    it('displays market metric cards with API data', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Market Growth')).toBeInTheDocument()
        expect(screen.getByText('+22.5%')).toBeInTheDocument()
        expect(screen.getByText('Total Investment')).toBeInTheDocument()
        expect(screen.getByText('Active Pitches')).toBeInTheDocument()
        expect(screen.getByText('2500')).toBeInTheDocument()
      })
    })

    it('calls investorApi.getMarketTrends on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetMarketTrends).toHaveBeenCalledTimes(1)
      })
    })

    it('renders top genres section when data is available', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Top Genres by Investment')).toBeInTheDocument()
        // Genre names may appear in multiple sections (top genres + avg investment table)
        expect(screen.getAllByText('Action').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Drama').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Comedy')).toBeInTheDocument()
      })
    })

    it('renders average investment by genre table', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Average Investment by Genre')).toBeInTheDocument()
      })
    })
  })

  // --- Error State ---

  describe('Error State', () => {
    it('shows warning banner when API fails', async () => {
      mockGetMarketTrends.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load market trends/)).toBeInTheDocument()
        expect(screen.getByText(/Data unavailable/)).toBeInTheDocument()
      })
    })

    it('displays N/A for metric values on error', async () => {
      mockGetMarketTrends.mockRejectedValue(new Error('err'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Market Growth')).toBeInTheDocument()
        // Metrics show N/A when data is null
        const growthCard = screen.getByText('Market Growth').closest('div')
        expect(growthCard?.parentElement?.textContent).toContain('N/A')
      })
    })

    it('shows warning when API returns success:false', async () => {
      mockGetMarketTrends.mockResolvedValue({ success: false, data: null })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load market trends/)).toBeInTheDocument()
      })
    })
  })

  // --- Empty Genre Data ---

  describe('Empty Genre Data', () => {
    it('shows fallback message when no genre-level data is available', async () => {
      mockGetMarketTrends.mockResolvedValue(mockTrendsResponse({
        topGenres: [],
        avgInvestmentByGenre: [],
      }))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/No genre-level data available yet/)).toBeInTheDocument()
      })
    })
  })
})
