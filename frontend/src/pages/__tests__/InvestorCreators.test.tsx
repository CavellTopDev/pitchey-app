import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import InvestorCreators from '../investor/InvestorCreators'

const mockGetCreators = vi.fn()

vi.mock('@/services/investor.service', () => ({
  investorApi: {
    getCreators: (...args: any[]) => mockGetCreators(...args),
  },
}))

const makeCreator = (overrides: Record<string, any> = {}) => ({
  id: 1,
  name: 'Maria Lopez',
  role: 'director',
  location: 'Los Angeles, CA',
  experience: 'established',
  follow_status: 'following',
  bio: 'Award-winning filmmaker specializing in drama',
  total_pitches: 15,
  active_pitches: 3,
  funded_projects: 8,
  success_rate: 72,
  total_raised: 2500000,
  view_count: 15000,
  follower_count: 450,
  genres: ['Drama', 'Thriller'],
  skills: ['Screenwriting', 'Directing'],
  current_projects: [
    {
      id: 101,
      title: 'Midnight Echo',
      stage: 'development',
      genre: 'Thriller',
      seeking_amount: 500000,
      percentage_funded: 35,
    },
  ],
  achievements: [
    { title: 'Best Director - Sundance', type: 'award', year: 2025 },
  ],
  verified: true,
  last_active: '1 hour ago',
  ...overrides,
})

describe('InvestorCreators', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCreators.mockResolvedValue({
      success: true,
      data: {
        creators: [
          makeCreator(),
          makeCreator({
            id: 2,
            name: 'James Wright',
            role: 'writer',
            experience: 'emerging',
            follow_status: 'not-following',
            bio: 'Emerging screenwriter with fresh perspectives',
            genres: ['Comedy', 'Romance'],
            verified: false,
            current_projects: [],
            achievements: [],
          }),
        ],
      },
    })
  })

  it('renders the page heading', async () => {
    render(<InvestorCreators />)

    await waitFor(() => {
      expect(screen.getByText('Connected Creators')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Discover and connect with talented filmmakers and content creators'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetCreators.mockReturnValue(new Promise(() => {}))
    render(<InvestorCreators />)

    expect(screen.getByText('Loading creators...')).toBeInTheDocument()
  })

  it('displays creator cards after data loads', async () => {
    render(<InvestorCreators />)

    await waitFor(() => {
      expect(screen.getByText('Maria Lopez')).toBeInTheDocument()
    })
    expect(screen.getByText('James Wright')).toBeInTheDocument()
    expect(
      screen.getByText('Award-winning filmmaker specializing in drama')
    ).toBeInTheDocument()
  })

  it('shows empty state when no creators found', async () => {
    mockGetCreators.mockResolvedValue({
      success: true,
      data: { creators: [] },
    })

    render(<InvestorCreators />)

    await waitFor(() => {
      expect(screen.getByText('No creators found')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Try adjusting your search or filter criteria')
    ).toBeInTheDocument()
  })

  it('filters creators by search query', async () => {
    render(<InvestorCreators />)

    await waitFor(() => {
      expect(screen.getByText('Maria Lopez')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(
      'Search creators, projects, or genres...'
    )
    fireEvent.change(searchInput, { target: { value: 'Maria' } })

    await waitFor(() => {
      expect(screen.getByText('Maria Lopez')).toBeInTheDocument()
      expect(screen.queryByText('James Wright')).not.toBeInTheDocument()
    })
  })

  it('displays creator stats and current projects', async () => {
    render(<InvestorCreators />)

    await waitFor(() => {
      expect(screen.getByText('Maria Lopez')).toBeInTheDocument()
    })

    // Quick stats cards (some labels may appear in both summary and per-card areas)
    expect(screen.getAllByText('Following').length).toBeGreaterThan(0)
    expect(screen.getByText('Active Pitches')).toBeInTheDocument()
    expect(screen.getByText('Total Creators')).toBeInTheDocument()

    // Creator genres
    expect(screen.getByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('Thriller')).toBeInTheDocument()

    // Current project
    expect(screen.getByText('Midnight Echo')).toBeInTheDocument()

    // Achievement
    expect(screen.getByText('Best Director - Sundance')).toBeInTheDocument()
  })
})
