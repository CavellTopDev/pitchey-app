import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Hoisted mocks
const mockNavigate = vi.fn()
const mockGetBudgetAllocations = vi.fn()

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
    getBudgetAllocations: mockGetBudgetAllocations,
  },
}))

const mockAllocationsResponse = (overrides: Record<string, any> = {}) => ({
  success: true,
  data: {
    allocations: [
      { category: 'Action', allocated_amount: 200000, used_amount: 120000, percentage: 40 },
      { category: 'Drama', allocated_amount: 150000, used_amount: 90000, percentage: 30 },
      { category: 'Comedy', allocated_amount: 100000, used_amount: 40000, percentage: 20 },
      { category: 'Horror', allocated_amount: 50000, used_amount: 25000, percentage: 10 },
    ],
    ...overrides,
  },
})

let BudgetAllocation: React.ComponentType
beforeAll(async () => {
  const mod = await import('../investor/BudgetAllocation')
  BudgetAllocation = mod.default
})

function renderPage() {
  return render(
    <MemoryRouter>
      <BudgetAllocation />
    </MemoryRouter>
  )
}

describe('BudgetAllocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBudgetAllocations.mockResolvedValue(mockAllocationsResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Loading State ---

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetBudgetAllocations.mockReturnValue(new Promise(() => {}))
      renderPage()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading after data loads', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Budget Allocation')).toBeInTheDocument()
      })
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeFalsy()
    })
  })

  // --- Success State ---

  describe('Success State', () => {
    it('renders the Budget Allocation heading', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Budget Allocation')).toBeInTheDocument()
        expect(screen.getByText('Manage your investment budget across different categories')).toBeInTheDocument()
      })
    })

    it('calls investorApi.getBudgetAllocations on mount', async () => {
      renderPage()
      await waitFor(() => {
        expect(mockGetBudgetAllocations).toHaveBeenCalledTimes(1)
      })
    })

    it('displays summary cards with computed totals', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Total Budget')).toBeInTheDocument()
        expect(screen.getByText('$500,000')).toBeInTheDocument()
        expect(screen.getByText('Used')).toBeInTheDocument()
        expect(screen.getByText('$275,000')).toBeInTheDocument()
        expect(screen.getByText('Utilization')).toBeInTheDocument()
        expect(screen.getByText('55.0%')).toBeInTheDocument()
      })
    })

    it('renders category allocation list', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Category Allocations')).toBeInTheDocument()
        expect(screen.getByText('Action')).toBeInTheDocument()
        expect(screen.getByText('Drama')).toBeInTheDocument()
        expect(screen.getByText('Comedy')).toBeInTheDocument()
        expect(screen.getByText('Horror')).toBeInTheDocument()
      })
    })

    it('renders New Allocation button', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('New Allocation')).toBeInTheDocument()
      })
    })
  })

  // --- Error State ---

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockGetBudgetAllocations.mockRejectedValue(new Error('Network error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Failed to load budget allocations')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetBudgetAllocations.mockRejectedValue(new Error('err'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('retries fetch when retry button is clicked', async () => {
      mockGetBudgetAllocations.mockRejectedValueOnce(new Error('err'))
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Failed to load budget allocations')).toBeInTheDocument()
      })

      // Make it succeed on retry
      mockGetBudgetAllocations.mockResolvedValue(mockAllocationsResponse())

      const user = userEvent.setup()
      await user.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(mockGetBudgetAllocations).toHaveBeenCalledTimes(2)
      })
    })

    it('shows error when API returns success:false', async () => {
      mockGetBudgetAllocations.mockResolvedValue({ success: false, data: null })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Failed to load budget allocations')).toBeInTheDocument()
      })
    })
  })

  // --- Empty State ---

  describe('Empty State', () => {
    it('renders with zero totals when no allocations exist', async () => {
      mockGetBudgetAllocations.mockResolvedValue({
        success: true,
        data: { allocations: [] },
      })
      renderPage()
      await waitFor(() => {
        expect(screen.getByText('Budget Allocation')).toBeInTheDocument()
        // Both Total Budget and Used show $0
        const zeroValues = screen.getAllByText('$0')
        expect(zeroValues.length).toBe(2)
        expect(screen.getByText('0.0%')).toBeInTheDocument()
      })
    })
  })
})
