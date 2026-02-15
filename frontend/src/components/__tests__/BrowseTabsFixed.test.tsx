import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import BrowseTabsFixed from '../BrowseTabsFixed'

// Hoisted mocks
const { mockPitchService, mockNavigate } = vi.hoisted(() => ({
  mockPitchService: {
    getPublicPitchesEnhanced: vi.fn(),
  },
  mockNavigate: vi.fn(),
}))

vi.mock('../../services/pitch.service', () => ({
  PitchService: mockPitchService,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('framer-motion', () => {
  const createMotionComponent = (tag: string) => {
    const Component = ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, variants, layout, ...rest } = props
      const Tag = tag as any
      return <Tag {...rest}>{children}</Tag>
    }
    Component.displayName = `motion.${tag}`
    return Component
  }
  return {
    motion: new Proxy({}, {
      get: (_target, prop: string) => createMotionComponent(prop),
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

vi.mock('../Loading/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}))

const createMockPitch = (id: number, overrides = {}) => ({
  id,
  title: `Test Pitch ${id}`,
  description: `Description for pitch ${id}`,
  genre: 'Drama',
  budget: '$1M',
  creator: { id: id * 10, name: `Creator ${id}`, username: `creator${id}` },
  viewCount: 100 * id,
  likes: 10 * id,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  featured: false,
  ...overrides,
})

describe('BrowseTabsFixed', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
      pitches: [createMockPitch(1), createMockPitch(2), createMockPitch(3)],
    })
  })

  // ─── Tab Rendering ─────────────────────────────────────────────────

  describe('Tab Rendering', () => {
    it('renders all four tab buttons', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      expect(screen.getByRole('button', { name: /trending/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /featured/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /top rated/i })).toBeInTheDocument()
    })

    it('trending tab is active by default', () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)
      const trendingBtn = screen.getByRole('button', { name: /trending/i })
      expect(trendingBtn.className).toMatch(/purple/)
    })

    it('fetches trending pitches on initial render', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledWith(
          expect.objectContaining({ tab: 'trending', page: 1, limit: 12 })
        )
      })
    })
  })

  // ─── Tab Switching ─────────────────────────────────────────────────

  describe('Tab Switching', () => {
    it('switches to New tab and fetches data', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      const newTab = screen.getByRole('button', { name: /^new/i })
      await user.click(newTab)

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledWith(
          expect.objectContaining({ tab: 'new' })
        )
      })
    })

    it('switches to Featured tab and fetches data', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /featured/i }))

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledWith(
          expect.objectContaining({ tab: 'featured' })
        )
      })
    })

    it('switches to Top Rated tab', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /top rated/i }))

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledWith(
          expect.objectContaining({ tab: 'topRated' })
        )
      })
    })
  })

  // ─── Per-Tab State Isolation ───────────────────────────────────────

  describe('Per-Tab State Isolation', () => {
    it('maintains separate data per tab', async () => {
      const trendingPitches = [createMockPitch(1, { title: 'Trending Pitch' })]
      const newPitches = [createMockPitch(2, { title: 'New Pitch' })]

      mockPitchService.getPublicPitchesEnhanced
        .mockResolvedValueOnce({ pitches: trendingPitches })
        .mockResolvedValueOnce({ pitches: newPitches })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Trending Pitch')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^new/i }))

      await waitFor(() => {
        expect(screen.getByText('New Pitch')).toBeInTheDocument()
      })
      expect(screen.queryByText('Trending Pitch')).not.toBeInTheDocument()
    })

    it('does not refetch when switching back to tab with data', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: /^new/i }))
      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(2)
      })

      // Switch back to trending - no new fetch
      await user.click(screen.getByRole('button', { name: /trending/i }))
      expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
    })
  })

  // ─── Search ────────────────────────────────────────────────────────

  describe('Search Functionality', () => {
    it('renders search input', () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)
      const input = screen.getByPlaceholderText(/search/i)
      expect(input).toBeInTheDocument()
    })

    it('updates search input value on typing', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)
      const input = screen.getByPlaceholderText(/search/i)
      await user.type(input, 'action')
      expect(input).toHaveValue('action')
    })
  })

  // ─── Genre Filter ──────────────────────────────────────────────────

  describe('Genre Filter', () => {
    it('toggles filter panel with Filters button', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)
      const filterBtn = screen.getByRole('button', { name: /filter/i })
      await user.click(filterBtn)

      const genreSelect = screen.getByDisplayValue(/all genres/i)
      expect(genreSelect).toBeInTheDocument()
    })

    it('fetches pitches with selected genre', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })

      const filterBtn = screen.getByRole('button', { name: /filter/i })
      await user.click(filterBtn)

      const genreSelect = screen.getByDisplayValue(/all genres/i)
      fireEvent.change(genreSelect, { target: { value: 'horror' } })

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledWith(
          expect.objectContaining({ genre: 'horror' })
        )
      })
    })
  })

  // ─── Loading States ────────────────────────────────────────────────

  describe('Loading States', () => {
    it('shows loading spinner while fetching', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockImplementation(
        () => new Promise(() => {})
      )
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      })
    })

    it('hides spinner after data loads', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  // ─── Error States ──────────────────────────────────────────────────

  describe('Error States', () => {
    it('shows error message when fetch fails', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockRejectedValue(new Error('Network error'))
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText(/failed to load trending pitches/i)).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockRejectedValue(new Error('err'))
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })
    })

    it('retries fetch when retry button is clicked', async () => {
      mockPitchService.getPublicPitchesEnhanced
        .mockRejectedValueOnce(new Error('err'))
        .mockResolvedValueOnce({ pitches: [createMockPitch(1)] })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /try again/i }))

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })
    })
  })

  // ─── Empty State ───────────────────────────────────────────────────

  describe('Empty State', () => {
    it('shows empty state when no pitches found', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({ pitches: [] })
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('No pitches found')).toBeInTheDocument()
      })
    })
  })

  // ─── Pagination / Load More ────────────────────────────────────────

  describe('Pagination', () => {
    it('shows Load More button when 12+ pitches returned', async () => {
      const pitches = Array.from({ length: 12 }, (_, i) => createMockPitch(i + 1))
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({ pitches })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })
    })

    it('does not show Load More when fewer than 12 pitches', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(1), createMockPitch(2)],
      })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })

    it('calls Load More handler when clicked', async () => {
      const pitches = Array.from({ length: 12 }, (_, i) => createMockPitch(i + 1))
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({ pitches })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
      })

      // Initial fetch is page 1
      expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: /load more/i }))

      // Load More triggers a second fetch
      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(2)
      })
    })
  })

  // ─── Pitch Card Rendering ──────────────────────────────────────────

  describe('Pitch Card Rendering', () => {
    it('renders pitch cards with titles', async () => {
      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 1')).toBeInTheDocument()
        expect(screen.getByText('Test Pitch 2')).toBeInTheDocument()
        expect(screen.getByText('Test Pitch 3')).toBeInTheDocument()
      })
    })

    it('displays pitch genre', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(1, { genre: 'Sci-Fi' })],
      })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
      })
    })

    it('displays creator name', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(1, { creator: { id: 10, name: 'Jane Director', username: 'jane' } })],
      })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Jane Director')).toBeInTheDocument()
      })
    })
  })

  // ─── Navigation ────────────────────────────────────────────────────

  describe('Navigation', () => {
    it('navigates to pitch detail when card is clicked', async () => {
      mockPitchService.getPublicPitchesEnhanced.mockResolvedValue({
        pitches: [createMockPitch(42)],
      })

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(screen.getByText('Test Pitch 42')).toBeInTheDocument()
      })

      // Click the title — event bubbles up to parent div with onClick
      await user.click(screen.getByText('Test Pitch 42'))

      expect(mockNavigate).toHaveBeenCalledWith('/pitch/42')
    })
  })

  // ─── Race Condition Guard ──────────────────────────────────────────

  describe('Race Condition Guard', () => {
    it('ignores stale responses from previous tab', async () => {
      let resolveFirst: (val: any) => void
      let resolveSecond: (val: any) => void

      const firstPromise = new Promise(r => { resolveFirst = r })
      const secondPromise = new Promise(r => { resolveSecond = r })

      mockPitchService.getPublicPitchesEnhanced
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      render(<BrowserRouter><BrowseTabsFixed /></BrowserRouter>)

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(1)
      })

      await user.click(screen.getByRole('button', { name: /^new/i }))

      await waitFor(() => {
        expect(mockPitchService.getPublicPitchesEnhanced).toHaveBeenCalledTimes(2)
      })

      // Resolve second response first
      resolveSecond!({ pitches: [createMockPitch(2, { title: 'Second Response' })] })

      await waitFor(() => {
        expect(screen.getByText('Second Response')).toBeInTheDocument()
      })

      // Resolve first response (stale)
      resolveFirst!({ pitches: [createMockPitch(1, { title: 'First Response' })] })

      await new Promise(r => setTimeout(r, 100))
      expect(screen.getByText('Second Response')).toBeInTheDocument()
    })
  })
})
