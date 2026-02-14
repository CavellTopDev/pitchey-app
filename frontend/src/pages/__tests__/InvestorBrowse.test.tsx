import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import InvestorBrowse from '../InvestorBrowse'

// Mock config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
}))

// Mock config service
vi.mock('../../services/config.service', () => ({
  configService: {
    getConfiguration: vi.fn().mockResolvedValue({
      genres: ['Action', 'Drama'],
      formats: ['Feature Film'],
    }),
  },
}))

// Mock pitch API
vi.mock('../../lib/api', () => ({
  pitchAPI: {
    requestNDA: vi.fn(),
  },
}))

// Mock useDebounce to return value immediately in tests
vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
  default: (value: any) => value,
}))

// Mock FormatDisplay to avoid complex rendering
vi.mock('../../components/FormatDisplay', () => ({
  default: () => <span>Format</span>,
}))

const makePitch = (tab: string, id = 1) => ({
  id,
  title: `${tab} Pitch ${id}`,
  logline: `A ${tab} logline`,
  genre: 'Drama',
  format: 'Feature Film',
  budget: '$10M',
  creator: { id: 1, username: 'testuser', userType: 'creator' as const },
  viewCount: 100,
  likeCount: 10,
  ndaCount: 5,
  createdAt: '2026-01-01',
  status: 'published' as const,
})

const mockFetchSuccess = (tab: string) => ({
  ok: true,
  json: async () => ({ success: true, items: [makePitch(tab)] }),
} as Response)

describe('InvestorBrowse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockResolvedValue(mockFetchSuccess('trending'))
  })

  describe('Rendering', () => {
    it('renders header and tab navigation', async () => {
      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('Browse Investment Opportunities')).toBeInTheDocument()
      })
      expect(screen.getByText('Trending')).toBeInTheDocument()
      expect(screen.getByText('New')).toBeInTheDocument()
      expect(screen.getByText('Popular')).toBeInTheDocument()
    })

    it('shows loading spinner initially', () => {
      vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
      render(<InvestorBrowse />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('displays pitches after fetch resolves', async () => {
      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
      })
    })

    it('shows empty state when no pitches returned', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, items: [] }),
      } as Response)

      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('No opportunities found')).toBeInTheDocument()
      })
    })
  })

  describe('Tab Switching', () => {
    it('fetches with correct tab parameter on switch', async () => {
      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
      })

      vi.mocked(global.fetch).mockResolvedValue(mockFetchSuccess('new'))
      fireEvent.click(screen.getByText('New'))

      await waitFor(() => {
        const calls = vi.mocked(global.fetch).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toContain('tab=new')
      })
    })

    it('displays data for the active tab only', async () => {
      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
      })

      vi.mocked(global.fetch).mockResolvedValue(mockFetchSuccess('popular'))
      fireEvent.click(screen.getByText('Popular'))

      await waitFor(() => {
        expect(screen.getByText('popular Pitch 1')).toBeInTheDocument()
      })

      // Trending data should no longer be displayed
      expect(screen.queryByText('trending Pitch 1')).not.toBeInTheDocument()
    })
  })

  describe('Race Condition Prevention', () => {
    it('per-tab state isolates data between tabs', async () => {
      const resolvers: Array<(value: Response) => void> = []

      vi.mocked(global.fetch).mockImplementation(() => {
        return new Promise<Response>((resolve) => {
          resolvers.push(resolve)
        })
      })

      render(<InvestorBrowse />)

      // Wait for initial trending fetch to be issued
      await waitFor(() => {
        expect(resolvers.length).toBeGreaterThanOrEqual(1)
      })

      // Resolve trending fetch
      resolvers[resolvers.length - 1](mockFetchSuccess('trending'))

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
      })

      // Switch to Popular — triggers new fetch
      fireEvent.click(screen.getByText('Popular'))

      await waitFor(() => {
        // A new fetch call should have been made
        expect(resolvers.length).toBeGreaterThanOrEqual(2)
      })

      // Resolve popular fetch
      resolvers[resolvers.length - 1](mockFetchSuccess('popular'))

      await waitFor(() => {
        expect(screen.getByText('popular Pitch 1')).toBeInTheDocument()
      })

      // Now switch back to trending — should still have its cached data
      // (new fetch also fires, but trending data was preserved in tabStates)
      fireEvent.click(screen.getByText('Trending'))

      // Even before the new trending fetch resolves, per-tab state
      // means popular data does NOT leak into the trending tab display
      expect(screen.queryByText('popular Pitch 1')).not.toBeInTheDocument()
    })

    it('switching back to a tab re-fetches fresh data', async () => {
      render(<InvestorBrowse />)

      // Wait for trending to load
      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
      })

      // Switch to Popular, resolve it
      vi.mocked(global.fetch).mockResolvedValue(mockFetchSuccess('popular'))
      fireEvent.click(screen.getByText('Popular'))

      await waitFor(() => {
        expect(screen.getByText('popular Pitch 1')).toBeInTheDocument()
      })

      // Switch back to Trending — should trigger a new fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, items: [makePitch('refreshed', 99)] }),
      } as Response)
      fireEvent.click(screen.getByText('Trending'))

      await waitFor(() => {
        expect(screen.getByText('refreshed Pitch 99')).toBeInTheDocument()
      })

      // Popular data should NOT leak into trending tab
      expect(screen.queryByText('popular Pitch 1')).not.toBeInTheDocument()
    })
  })

  describe('Search Filtering', () => {
    it('filters displayed pitches by search term', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          items: [
            makePitch('trending', 1),
            { ...makePitch('trending', 2), title: 'Unrelated Project', logline: 'Something else', genre: 'Comedy' },
          ],
        }),
      } as Response)

      render(<InvestorBrowse />)

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
        expect(screen.getByText('Unrelated Project')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by title, genre, or keywords...')
      fireEvent.change(searchInput, { target: { value: 'trending' } })

      await waitFor(() => {
        expect(screen.getByText('trending Pitch 1')).toBeInTheDocument()
        expect(screen.queryByText('Unrelated Project')).not.toBeInTheDocument()
      })
    })
  })
})
