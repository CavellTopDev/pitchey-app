import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockFetch = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ userId: '10' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── Auth store (STABLE reference to prevent infinite loops) ────────
const mockUser = {
  id: 10,
  name: 'Sam Creator',
  email: 'sam@example.com',
  user_type: 'creator',
  userType: 'creator',
}
const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
}
vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── Portfolio sub-components ─────────────────────────────────────────
vi.mock('../../components/portfolio/ProfileHeader', () => ({
  default: ({ profile, isOwnProfile }: any) => (
    <div data-testid="profile-header">
      {profile?.name} {isOwnProfile ? '(own)' : ''}
    </div>
  ),
}))

vi.mock('../../components/portfolio/AchievementsSection', () => ({
  default: ({ achievements }: any) => (
    <div data-testid="achievements-section">
      Achievements: {achievements?.length || 0}
    </div>
  ),
}))

vi.mock('../../components/portfolio/WorksGrid', () => ({
  default: ({ works, userType }: any) => (
    <div data-testid="works-grid">
      Works: {works?.length || 0} ({userType})
    </div>
  ),
}))

vi.mock('../../components/portfolio/LoadingState', () => ({
  default: () => <div data-testid="loading-state">Loading...</div>,
}))

vi.mock('../../components/portfolio/ErrorState', () => ({
  default: ({ error, onRetry }: any) => (
    <div data-testid="error-state">
      <p>{error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}))

// ─── config ──────────────────────────────────────────────────────────
vi.mock('../../config', () => ({
  config: { API_URL: 'http://localhost:8787' },
  API_URL: 'http://localhost:8787',
}))

// ─── Fetch mock ──────────────────────────────────────────────────────
vi.stubGlobal('fetch', mockFetch)

// ─── Mock portfolio data ──────────────────────────────────────────────
const mockPortfolioResponse = {
  success: true,
  profile: {
    id: '10',
    name: 'Sam Creator',
    username: 'samcreator',
    avatar: '',
    bio: 'Indie filmmaker',
    location: 'New York',
    joinedDate: '2024-01-01T00:00:00Z',
    verified: true,
    userType: 'creator' as const,
    stats: {
      totalWorks: 5,
      totalViews: 12000,
      totalFollowers: 300,
      avgRating: 4.2,
    },
  },
  works: [
    {
      id: 'work-1',
      title: 'Neon Dreams',
      tagline: 'A cyberpunk odyssey',
      category: 'Sci-Fi',
      thumbnail: '',
      views: 5000,
      status: 'published',
      budget: '$500K',
      createdAt: '2025-01-01T00:00:00Z',
    },
  ],
  achievements: [
    { icon: '🏆', title: 'Best Director', event: 'Indie Film Fest', year: '2025' },
  ],
}

// ─── Component import ─────────────────────────────────────────────────
let UserPortfolio: React.ComponentType

beforeAll(async () => {
  const mod = await import('../UserPortfolio')
  UserPortfolio = mod.default
})

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/portfolio/10')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPortfolioResponse),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })
})

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
})

describe('UserPortfolio', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('renders ProfileHeader after data loads', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('profile-header')).toBeInTheDocument()
    })
  })

  it('renders creator name in ProfileHeader', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Sam Creator/)).toBeInTheDocument()
    })
  })

  it('renders AchievementsSection after data loads', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('achievements-section')).toBeInTheDocument()
    })
    expect(screen.getByText('Achievements: 1')).toBeInTheDocument()
  })

  it('renders WorksGrid after data loads', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('works-grid')).toBeInTheDocument()
    })
    expect(screen.getByText(/Works: 1/)).toBeInTheDocument()
  })

  it('passes correct userType to WorksGrid', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/creator/)).toBeInTheDocument()
    })
  })

  it('shows Back to Dashboard button', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
    })
  })

  it('shows error state when API returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })

    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })
  })

  it('shows error state when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('calls GET /api/portfolio/:userId', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/portfolio/10')
      )
    })
  })

  it('shows error when portfolio data success=false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false }),
    })

    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })
    expect(screen.getByText('Portfolio data indicates failure')).toBeInTheDocument()
  })

  it('ProfileHeader receives isOwnProfile=true when userId matches auth user', async () => {
    render(
      <MemoryRouter>
        <UserPortfolio />
      </MemoryRouter>
    )

    await waitFor(() => {
      // The mock ProfileHeader renders "(own)" when isOwnProfile is true
      expect(screen.getByText(/\(own\)/)).toBeInTheDocument()
    })
  })
})
