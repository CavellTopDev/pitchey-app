import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockApiGet = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ creatorId: undefined }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = {
  id: 7,
  name: 'Alice Creator',
  email: 'alice@example.com',
  username: 'alicecreator',
  user_type: 'creator',
  firstName: 'Alice',
  lastName: 'Creator',
  createdAt: '2024-03-01T00:00:00Z',
}
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── api-client ──────────────────────────────────────────────────────
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}))

// ─── sessionCache ────────────────────────────────────────────────────
vi.mock('../../store/sessionCache', () => ({
  sessionCache: { getSession: vi.fn(), setSession: vi.fn(), clearSession: vi.fn() },
}))

// ─── session-manager ─────────────────────────────────────────────────
vi.mock('../../lib/session-manager', () => ({
  sessionManager: { getSession: vi.fn(), setSession: vi.fn(), clearSession: vi.fn() },
}))

// ─── config ──────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8787' },
  API_URL: 'http://localhost:8787',
}))

// ─── Mock portfolio data ──────────────────────────────────────────────
const mockPortfolioData = {
  pitches: [
    {
      id: 'pitch-1',
      title: 'The Great Escape',
      logline: 'A thrilling heist story',
      genre: 'Thriller',
      cover_image: '',
      view_count: 2500,
      like_count: 110,
      status: 'published',
      investment_total: 50000,
      created_at: '2025-01-15T00:00:00Z',
    },
    {
      id: 'pitch-2',
      title: 'Comedy Night',
      logline: 'A stand-up comedy gone wrong',
      genre: 'Comedy',
      cover_image: '',
      view_count: 980,
      like_count: 60,
      status: 'draft',
      investment_total: 0,
      created_at: '2025-06-01T00:00:00Z',
    },
  ],
  totalInvestment: 50000,
}

// ─── Component import ─────────────────────────────────────────────────
let CreatorPortfolio: React.ComponentType

beforeAll(async () => {
  const mod = await import('../CreatorPortfolio')
  CreatorPortfolio = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockApiGet.mockResolvedValue({ success: true, data: mockPortfolioData })
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('CreatorPortfolio', () => {
  it('shows loading spinner while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    expect(screen.getByText('Loading portfolio...')).toBeInTheDocument()
  })

  it('renders creator name after data loads', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Creator')).toBeInTheDocument()
    })
  })

  it('renders creator username', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('@alicecreator')).toBeInTheDocument()
    })
  })

  it('shows pitch stats (count, views, likes, invested)', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Pitches').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('Likes')).toBeInTheDocument()
    expect(screen.getByText('Invested')).toBeInTheDocument()
  })

  it('renders pitch cards for each pitch', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('The Great Escape')).toBeInTheDocument()
    })
    expect(screen.getByText('Comedy Night')).toBeInTheDocument()
  })

  it('renders genre badges on pitches', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Thriller')).toBeInTheDocument()
    })
    expect(screen.getByText('Comedy')).toBeInTheDocument()
  })

  it('renders pitch status badges', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('published')).toBeInTheDocument()
    })
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('shows Edit Profile button for own profile', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
  })

  it('shows New Pitch button for own profile', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('New Pitch')).toBeInTheDocument()
    })
  })

  it('shows Back to Dashboard button', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    })
  })

  it('shows empty state when no pitches', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { pitches: [], totalInvestment: 0 },
    })

    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No pitches yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Create Your First Pitch')).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockApiGet.mockResolvedValue({ success: false, error: { message: 'Server error' } })

    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('shows error state when API throws', async () => {
    mockApiGet.mockRejectedValue(new Error('Network failure'))

    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  it('calls /api/creator/portfolio when no creatorId param', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/creator/portfolio')
    })
  })

  it('renders Pitches section heading', async () => {
    render(
      <MemoryRouter>
        <CreatorPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Pitches').length).toBeGreaterThan(0)
    })
  })
})
