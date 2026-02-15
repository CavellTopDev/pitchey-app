import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetInvestorPortfolio = vi.fn()
const mockGetInvestmentHistory = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../services/investment.service', () => ({
  InvestmentService: {
    getInvestorPortfolio: mockGetInvestorPortfolio,
    getInvestmentHistory: mockGetInvestmentHistory,
  },
}))

const makeInvestment = (overrides: Record<string, any> = {}) => ({
  id: 1,
  pitchTitle: 'Test Movie',
  creatorName: 'Jane Creator',
  amount: 50000,
  currentValue: 55000,
  status: 'active',
  createdAt: '2026-01-15T00:00:00Z',
  returnPercentage: 10,
  pitchGenre: 'Drama',
  ...overrides,
})

const mockPortfolioData = (overrides: Record<string, any> = {}) => ({
  success: true,
  data: {
    totalInvested: 1500000,
    currentValue: 2300000,
    totalReturn: 800000,
    returnPercentage: 15,
    activeInvestments: 3,
    completedInvestments: 2,
    ...overrides,
  },
})

const mockHistoryData = (investments: any[] = []) => ({
  success: true,
  data: {
    investments,
  },
})

let InvestorPortfolio: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/InvestorPortfolio')
  InvestorPortfolio = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <InvestorPortfolio />
    </MemoryRouter>
  )
}

describe('InvestorPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetInvestorPortfolio.mockResolvedValue(mockPortfolioData())
    mockGetInvestmentHistory.mockResolvedValue(mockHistoryData([
      makeInvestment({ id: 1, pitchTitle: 'Action Film', amount: 100000, currentValue: 120000 }),
      makeInvestment({ id: 2, pitchTitle: 'Comedy Show', amount: 50000, currentValue: 45000, status: 'completed' }),
    ]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Loading State ──────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows loading indicator initially', () => {
      mockGetInvestorPortfolio.mockReturnValue(new Promise(() => {}))
      mockGetInvestmentHistory.mockReturnValue(new Promise(() => {}))
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading after data loads', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Action Film')).toBeInTheDocument()
      })
    })
  })

  // ─── API Connectivity — Portfolio Summary ───────────────────────────

  describe('API Connectivity — Portfolio Summary', () => {
    it('calls InvestmentService.getInvestorPortfolio on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetInvestorPortfolio).toHaveBeenCalledTimes(1)
      })
    })

    it('calls InvestmentService.getInvestmentHistory on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetInvestmentHistory).toHaveBeenCalledWith({ limit: 50 })
      })
    })

    it('displays portfolio stats from API', async () => {
      renderPage()
      await waitFor(() => {
        // totalInvested = $1,500,000 → displayed as $1.5M
        expect(screen.getByText(/\$1\.5M/)).toBeInTheDocument()
        // currentValue = $2,300,000 → displayed as $2.3M
        expect(screen.getByText(/\$2\.3M/)).toBeInTheDocument()
      })
    })

    it('displays investment cards from history API', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Action Film')).toBeInTheDocument()
        expect(screen.getByText('Comedy Show')).toBeInTheDocument()
      })
    })
  })

  // ─── Error Handling ─────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('shows error when portfolio API fails', async () => {
      mockGetInvestorPortfolio.mockRejectedValue(new Error('Server down'))
      mockGetInvestmentHistory.mockRejectedValue(new Error('Server down'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Failed to load portfolio data/i)).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetInvestorPortfolio.mockRejectedValue(new Error('err'))
      mockGetInvestmentHistory.mockRejectedValue(new Error('err'))
      renderPage()
      await waitFor(() => {
        const retryButtons = screen.getAllByText(/Retry|Try Again/i)
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })

    it('retries fetch on retry button click', async () => {
      mockGetInvestorPortfolio.mockRejectedValueOnce(new Error('err'))
      mockGetInvestmentHistory.mockRejectedValueOnce(new Error('err'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/Failed to load portfolio data/i)).toBeInTheDocument()
      })

      // Now make it succeed on retry
      mockGetInvestorPortfolio.mockResolvedValue(mockPortfolioData())
      mockGetInvestmentHistory.mockResolvedValue(mockHistoryData([makeInvestment()]))

      const user = userEvent.setup()
      const retryBtn = screen.getAllByText(/Retry|Try Again/i)[0]
      await user.click(retryBtn)

      await waitFor(() => {
        expect(mockGetInvestorPortfolio).toHaveBeenCalledTimes(2)
      })
    })

    it('shows empty state when no investments', async () => {
      mockGetInvestorPortfolio.mockResolvedValue(mockPortfolioData({
        totalInvested: 0,
        currentValue: 0,
        totalReturn: 0,
        returnPercentage: 0,
        activeInvestments: 0,
        completedInvestments: 0,
      }))
      mockGetInvestmentHistory.mockResolvedValue(mockHistoryData([]))
      renderPage()
      await waitFor(() => {
        expect(mockGetInvestmentHistory).toHaveBeenCalled()
      })
      // Should render without crashing
      expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument()
    })
  })

  // ─── Search & Filter ────────────────────────────────────────────────

  describe('Search & Filter', () => {
    it('filters investments by search term', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Action Film')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Action')

      expect(screen.getByText('Action Film')).toBeInTheDocument()
      expect(screen.queryByText('Comedy Show')).not.toBeInTheDocument()
    })

    it('shows all investments when search is cleared', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Action Film')).toBeInTheDocument()
      })

      const user = userEvent.setup()
      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Action')
      expect(screen.queryByText('Comedy Show')).not.toBeInTheDocument()

      await user.clear(searchInput)
      expect(screen.getByText('Action Film')).toBeInTheDocument()
      expect(screen.getByText('Comedy Show')).toBeInTheDocument()
    })
  })
})
