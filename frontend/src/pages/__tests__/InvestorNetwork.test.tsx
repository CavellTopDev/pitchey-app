import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import InvestorNetwork from '../investor/InvestorNetwork'

const mockGetNetwork = vi.fn()

vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getNetwork: (...args: any[]) => mockGetNetwork(...args),
  },
}))

const makeConnection = (overrides: Record<string, any> = {}) => ({
  id: 1,
  name: 'Alice Investor',
  user_type: 'investor',
  title: 'Angel Investor',
  company_name: 'Alpha Capital',
  location: 'Los Angeles, CA',
  connection_status: 'connected',
  bio: 'Focused on indie films',
  investments_count: 12,
  portfolio_count: 8,
  productions_count: 0,
  pitches_count: 0,
  success_rate: 85,
  interests: ['Drama', 'Thriller'],
  mutual_connections: 5,
  last_active: '2 hours ago',
  ...overrides,
})

describe('InvestorNetwork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNetwork.mockResolvedValue({
      success: true,
      data: {
        connections: [
          makeConnection(),
          makeConnection({
            id: 2,
            name: 'Bob Creator',
            user_type: 'creator',
            title: 'Director',
            company_name: 'Creative Studios',
            connection_status: 'suggested',
            interests: ['Comedy'],
          }),
        ],
      },
    })
  })

  it('renders the page heading', async () => {
    render(<InvestorNetwork />)

    await waitFor(() => {
      expect(screen.getByText('My Network')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Connect with investors, creators, and production companies')
    ).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetNetwork.mockReturnValue(new Promise(() => {}))
    render(<InvestorNetwork />)

    expect(screen.getByText('Loading network...')).toBeInTheDocument()
  })

  it('displays network members after data loads', async () => {
    render(<InvestorNetwork />)

    await waitFor(() => {
      expect(screen.getByText('Alice Investor')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob Creator')).toBeInTheDocument()
    expect(screen.getByText('Alpha Capital')).toBeInTheDocument()
    expect(screen.getByText('Angel Investor')).toBeInTheDocument()
  })

  it('shows empty state when no members match', async () => {
    mockGetNetwork.mockResolvedValue({
      success: true,
      data: { connections: [] },
    })

    render(<InvestorNetwork />)

    await waitFor(() => {
      expect(screen.getByText('No network members found')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Try adjusting your search or filter criteria')
    ).toBeInTheDocument()
  })

  it('filters members by search query', async () => {
    render(<InvestorNetwork />)

    await waitFor(() => {
      expect(screen.getByText('Alice Investor')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(
      'Search by name, company, or interests...'
    )
    fireEvent.change(searchInput, { target: { value: 'Alice' } })

    await waitFor(() => {
      expect(screen.getByText('Alice Investor')).toBeInTheDocument()
      expect(screen.queryByText('Bob Creator')).not.toBeInTheDocument()
    })
  })

  it('displays connection stats and status badges', async () => {
    render(<InvestorNetwork />)

    await waitFor(() => {
      expect(screen.getByText('Alice Investor')).toBeInTheDocument()
    })

    // Connection status badge
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Member stats
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Thriller')).toBeInTheDocument()

    // Network summary counts
    expect(screen.getByText('Connections')).toBeInTheDocument()
    expect(screen.getByText('Total Network')).toBeInTheDocument()
  })
})
