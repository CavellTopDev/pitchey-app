import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetPortfolioRisk = vi.fn()

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
    getPortfolioRisk: mockGetPortfolioRisk,
  },
}))

const mockRiskResponse = (overrides: Record<string, any> = {}) => ({
  success: true,
  data: {
    overallRisk: 'Medium',
    riskScore: 5.8,
    diversification: 'Good',
    lowRisk: 50,
    mediumRisk: 30,
    highRisk: 20,
    byCategory: [
      { category: 'Action', riskLevel: 'medium', count: 5, exposure: 35 },
      { category: 'Drama', riskLevel: 'low', count: 8, exposure: 45 },
      { category: 'Horror', riskLevel: 'high', count: 2, exposure: 20 },
    ],
    ...overrides,
  },
})

let RiskAssessment: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/RiskAssessment')
  RiskAssessment = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <RiskAssessment />
    </MemoryRouter>
  )
}

describe('RiskAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPortfolioRisk.mockResolvedValue(mockRiskResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Loading State ---

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetPortfolioRisk.mockReturnValue(new Promise(() => {}))
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading after data loads', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
      })
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeFalsy()
    })
  })

  // --- Success State ---

  describe('Success State', () => {
    it('renders the Risk Assessment heading', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
        expect(screen.getByText('Portfolio risk analysis and mitigation strategies')).toBeInTheDocument()
      })
    })

    it('displays risk metric cards with API data', async () => {
      renderPage()
      await waitFor(() => {
        // "Risk Level" appears in both card label and table header, so use getAllByText
        expect(screen.getAllByText('Risk Level').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Medium')).toBeInTheDocument()
        expect(screen.getByText('Risk Score')).toBeInTheDocument()
        // "5.8" and "/10" render as separate text nodes; check parent element
        const riskScoreLabel = screen.getByText('Risk Score')
        expect(riskScoreLabel.closest('div')?.textContent).toContain('5.8')
        expect(riskScoreLabel.closest('div')?.textContent).toContain('/10')
        expect(screen.getByText('Diversification')).toBeInTheDocument()
        expect(screen.getByText('Good')).toBeInTheDocument()
      })
    })

    it('calls investorApi.getPortfolioRisk on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetPortfolioRisk).toHaveBeenCalledTimes(1)
      })
    })

    it('renders portfolio risk distribution section', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Portfolio Risk Distribution')).toBeInTheDocument()
        expect(screen.getByText('Low Risk')).toBeInTheDocument()
        expect(screen.getByText('Medium Risk')).toBeInTheDocument()
        expect(screen.getByText('High Risk')).toBeInTheDocument()
      })
    })

    it('displays risk percentages from API data', async () => {
      renderPage()
      await waitFor(() => {
        // Risk distribution percentages are rendered in .font-medium spans
        // The "Low Risk" / "Medium Risk" / "High Risk" labels confirm data loaded
        expect(screen.getByText('Portfolio Risk Distribution')).toBeInTheDocument()
        // Verify actual percentage values appear in the DOM
        const distribution = screen.getByText('Portfolio Risk Distribution').closest('.rounded-xl')!
        expect(distribution.textContent).toContain('50%')
        expect(distribution.textContent).toContain('30%')
        expect(distribution.textContent).toContain('20%')
      })
    })

    it('renders risk by category table when data is available', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Risk by Genre Category')).toBeInTheDocument()
        expect(screen.getByText('Action')).toBeInTheDocument()
        expect(screen.getByText('Drama')).toBeInTheDocument()
        expect(screen.getByText('Horror')).toBeInTheDocument()
      })
    })
  })

  // --- Error State ---

  describe('Error State', () => {
    it('shows error message and empty state when API fails', async () => {
      mockGetPortfolioRisk.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
        expect(screen.getByText(/Unable to load risk data/)).toBeInTheDocument()
        expect(screen.getByText('No risk data available.')).toBeInTheDocument()
      })
      // Risk metric cards should NOT be rendered when data is null
      expect(screen.queryByText('Risk Score')).not.toBeInTheDocument()
      expect(screen.queryByText('Portfolio Risk Distribution')).not.toBeInTheDocument()
    })

    it('does not display risk level card on error', async () => {
      mockGetPortfolioRisk.mockRejectedValue(new Error('err'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('No risk data available.')).toBeInTheDocument()
      })
      expect(screen.queryByText('Risk Level')).not.toBeInTheDocument()
    })

    it('shows empty state when API returns success:false', async () => {
      mockGetPortfolioRisk.mockResolvedValue({ success: false, data: null })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Unable to load risk data/)).toBeInTheDocument()
        expect(screen.getByText('No risk data available.')).toBeInTheDocument()
      })
      expect(screen.queryByText('Risk Score')).not.toBeInTheDocument()
      expect(screen.queryByText('Portfolio Risk Distribution')).not.toBeInTheDocument()
    })
  })

  // --- No Category Data ---

  describe('No Category Data', () => {
    it('does not render category table when byCategory is absent', async () => {
      mockGetPortfolioRisk.mockResolvedValue(mockRiskResponse({
        byCategory: undefined,
      }))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Risk Assessment')).toBeInTheDocument()
      })
      expect(screen.queryByText('Risk by Genre Category')).not.toBeInTheDocument()
    })
  })
})
