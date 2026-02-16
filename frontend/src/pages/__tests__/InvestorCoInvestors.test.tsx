import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import InvestorCoInvestors from '../investor/InvestorCoInvestors'

const mockGetCoInvestors = vi.fn()

vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getCoInvestors: (...args: any[]) => mockGetCoInvestors(...args),
  },
}))

const makeCoInvestor = (overrides: Record<string, any> = {}) => ({
  id: 1,
  name: 'Sarah Chen',
  title: 'Managing Partner',
  company_name: 'Horizon Ventures',
  location: 'New York, NY',
  investment_style: 'moderate',
  connection_status: 'connected',
  total_investments: 24,
  shared_deals: 6,
  avg_deal_size: 250000,
  success_rate: 78,
  portfolio_value: 5000000,
  specializations: ['Drama', 'Documentary'],
  compatibility: 87,
  ...overrides,
})

describe('InvestorCoInvestors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCoInvestors.mockResolvedValue({
      success: true,
      data: {
        coInvestors: [
          makeCoInvestor(),
          makeCoInvestor({
            id: 2,
            name: 'David Park',
            title: 'Venture Capitalist',
            company_name: 'Summit Capital',
            investment_style: 'aggressive',
            connection_status: 'suggested',
            compatibility: 72,
            specializations: ['Action', 'Sci-Fi'],
          }),
        ],
      },
    })
  })

  it('renders the page heading', async () => {
    render(<InvestorCoInvestors />)

    await waitFor(() => {
      expect(screen.getByText('Co-Investor Network')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Connect with other investors for joint opportunities and syndicated deals'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetCoInvestors.mockReturnValue(new Promise(() => {}))
    render(<InvestorCoInvestors />)

    expect(screen.getByText('Loading co-investors...')).toBeInTheDocument()
  })

  it('displays co-investor cards after data loads', async () => {
    render(<InvestorCoInvestors />)

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    })
    expect(screen.getByText('David Park')).toBeInTheDocument()
    expect(screen.getByText('Horizon Ventures')).toBeInTheDocument()
    expect(screen.getByText('Managing Partner')).toBeInTheDocument()
  })

  it('shows empty state when no co-investors found', async () => {
    mockGetCoInvestors.mockResolvedValue({
      success: true,
      data: { coInvestors: [] },
    })

    render(<InvestorCoInvestors />)

    await waitFor(() => {
      expect(screen.getByText('No co-investors found')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Try adjusting your search or filter criteria')
    ).toBeInTheDocument()
  })

  it('filters co-investors by search query', async () => {
    render(<InvestorCoInvestors />)

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(
      'Search co-investors by name, company, or specialization...'
    )
    fireEvent.change(searchInput, { target: { value: 'Sarah' } })

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
      expect(screen.queryByText('David Park')).not.toBeInTheDocument()
    })
  })

  it('displays investment stats and compatibility scores', async () => {
    render(<InvestorCoInvestors />)

    await waitFor(() => {
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument()
    })

    // Quick stats cards (some labels appear in both summary and individual cards)
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Shared Deals').length).toBeGreaterThan(0)
    expect(screen.getByText('Avg Compatibility')).toBeInTheDocument()

    // Compatibility score in the card
    expect(screen.getAllByText('87%').length).toBeGreaterThan(0)

    // Specializations
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Documentary')).toBeInTheDocument()
  })
})
