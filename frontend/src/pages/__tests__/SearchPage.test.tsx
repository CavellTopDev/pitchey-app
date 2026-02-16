import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import SearchPage from '../SearchPage'

// Mock config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
  config: { apiUrl: 'http://localhost:8001' },
}))

// Mock DashboardHeader to keep tests focused
vi.mock('../../components/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header">Header</div>,
}))

// Mock apiClient used by SearchPage
const mockApiGet = vi.fn()
vi.mock('../../lib/api-client', () => ({
  apiClient: { get: (...args: any[]) => mockApiGet(...args) },
  default: { get: (...args: any[]) => mockApiGet(...args) },
}))

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Initial Render ────────────────────────────────────────────────

  it('renders search input and search button', () => {
    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    expect(input).toBeInTheDocument()

    const searchButton = screen.getByRole('button', { name: /search/i })
    expect(searchButton).toBeInTheDocument()
  })

  it('renders filter type buttons', () => {
    render(<SearchPage />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Pitches')).toBeInTheDocument()
    expect(screen.getByText('Creators')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()
  })

  // ─── Loading State ────────────────────────────────────────────────

  it('shows loading spinner during search', async () => {
    // Never-resolving promise to keep loading state
    mockApiGet.mockReturnValue(new Promise(() => {}))

    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    fireEvent.change(input, { target: { value: 'action movie' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  // ─── Search Results ───────────────────────────────────────────────

  it('displays search results after successful search', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        pitches: [
          { id: 1, title: 'Action Movie', logline: 'An action-packed adventure', genre: 'Action', view_count: 500, like_count: 50 },
        ],
        users: [
          { id: 2, name: 'Jane Creator', user_type: 'creator', bio: 'Filmmaker' },
        ],
        companies: [],
      },
    })

    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    fireEvent.change(input, { target: { value: 'action' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Action Movie')).toBeInTheDocument()
    })
    expect(screen.getByText('Jane Creator')).toBeInTheDocument()
  })

  // ─── No Results ───────────────────────────────────────────────────

  it('shows no results message when search returns empty', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { pitches: [], users: [], companies: [] },
    })

    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    fireEvent.change(input, { target: { value: 'xyznonexistent' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/No results found for "xyznonexistent"/)).toBeInTheDocument()
    })
    expect(screen.getByText('Try adjusting your filters or search terms')).toBeInTheDocument()
  })

  // ─── API Error Handling ───────────────────────────────────────────

  it('handles API error gracefully and shows no results', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))

    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      // After error, loading should stop and no results shown
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).not.toBeInTheDocument()
    })
    expect(screen.getByText(/No results found for "test"/)).toBeInTheDocument()
  })

  // ─── Results Count ────────────────────────────────────────────────

  it('shows results count when results are returned', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        pitches: [
          { id: 1, title: 'Pitch One', genre: 'Drama', view_count: 10, like_count: 2 },
          { id: 2, title: 'Pitch Two', genre: 'Comedy', view_count: 20, like_count: 5 },
        ],
        users: [],
        companies: [],
      },
    })

    render(<SearchPage />)

    const input = screen.getByPlaceholderText('Search for pitches, creators, or companies...')
    fireEvent.change(input, { target: { value: 'pitch' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText(/results/)).toBeInTheDocument()
    })
  })
})
