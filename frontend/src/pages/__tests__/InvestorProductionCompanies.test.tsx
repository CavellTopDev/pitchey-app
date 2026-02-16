import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import InvestorProductionCompanies from '../investor/InvestorProductionCompanies'

const mockGetProductionCompanies = vi.fn()

vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getProductionCompanies: (...args: any[]) =>
      mockGetProductionCompanies(...args),
  },
}))

const makeCompany = (overrides: Record<string, any> = {}) => ({
  id: 1,
  name: 'Stellar Productions',
  type: 'independent',
  location: 'Los Angeles, CA',
  founded: '2015',
  connection_status: 'partner',
  description: 'Independent studio focused on character-driven stories',
  total_productions: 28,
  active_projects: 4,
  avg_budget: 5000000,
  success_rate: 82,
  awards_won: 12,
  distribution_reach: 'Global',
  genres: ['Drama', 'Indie'],
  current_projects: [
    {
      id: 201,
      title: 'The Last Frontier',
      status: 'production',
      budget: 8000000,
      investment_needed: 2000000,
    },
  ],
  past_successes: [
    {
      title: 'Whispers in the Dark',
      year: 2024,
      box_office: 45000000,
      awards: ['Best Picture - Spirit Awards'],
    },
  ],
  total_raised: 25000000,
  investor_count: 45,
  avg_roi: 18,
  ...overrides,
})

describe('InvestorProductionCompanies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProductionCompanies.mockResolvedValue({
      success: true,
      data: {
        companies: [
          makeCompany(),
          makeCompany({
            id: 2,
            name: 'Nova Studios',
            type: 'streaming',
            connection_status: 'available',
            description: 'Digital-first content studio',
            genres: ['Sci-Fi', 'Fantasy'],
            current_projects: [],
            past_successes: [],
          }),
        ],
      },
    })
  })

  it('renders the page heading', async () => {
    render(<InvestorProductionCompanies />)

    await waitFor(() => {
      expect(screen.getByText('Production Companies')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Partner with leading production companies and studios'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetProductionCompanies.mockReturnValue(new Promise(() => {}))
    render(<InvestorProductionCompanies />)

    expect(
      screen.getByText('Loading production companies...')
    ).toBeInTheDocument()
  })

  it('displays production company cards after data loads', async () => {
    render(<InvestorProductionCompanies />)

    await waitFor(() => {
      expect(screen.getByText('Stellar Productions')).toBeInTheDocument()
    })
    expect(screen.getByText('Nova Studios')).toBeInTheDocument()
    expect(
      screen.getByText('Independent studio focused on character-driven stories')
    ).toBeInTheDocument()
  })

  it('shows empty state when no companies found', async () => {
    mockGetProductionCompanies.mockResolvedValue({
      success: true,
      data: { companies: [] },
    })

    render(<InvestorProductionCompanies />)

    await waitFor(() => {
      expect(
        screen.getByText('No production companies found')
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText('Try adjusting your search or filter criteria')
    ).toBeInTheDocument()
  })

  it('filters companies by search query', async () => {
    render(<InvestorProductionCompanies />)

    await waitFor(() => {
      expect(screen.getByText('Stellar Productions')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(
      'Search companies, projects, or genres...'
    )
    fireEvent.change(searchInput, { target: { value: 'Stellar' } })

    await waitFor(() => {
      expect(screen.getByText('Stellar Productions')).toBeInTheDocument()
      expect(screen.queryByText('Nova Studios')).not.toBeInTheDocument()
    })
  })

  it('displays company stats, projects, and past successes', async () => {
    render(<InvestorProductionCompanies />)

    await waitFor(() => {
      expect(screen.getByText('Stellar Productions')).toBeInTheDocument()
    })

    // Quick stats cards (some labels may appear in both summary and per-card areas)
    expect(screen.getAllByText('Partners').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active Projects').length).toBeGreaterThan(0)
    expect(screen.getByText('Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Total Awards')).toBeInTheDocument()

    // Company genres
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Indie')).toBeInTheDocument()

    // Current project
    expect(screen.getByText('The Last Frontier')).toBeInTheDocument()

    // Past success
    expect(screen.getByText(/Whispers in the Dark/)).toBeInTheDocument()

    // Connection status (Available also appears in the filter dropdown option)
    expect(screen.getByText('Partner')).toBeInTheDocument()
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
  })
})
