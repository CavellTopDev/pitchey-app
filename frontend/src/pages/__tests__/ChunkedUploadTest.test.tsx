import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  }
})

// ─── ChunkedUploadDemo ───────────────────────────────────────────────
vi.mock('@features/uploads/components/FileUpload/ChunkedUploadDemo', () => ({
  default: () => (
    <div data-testid="chunked-upload-demo">
      <h2>Chunked Upload Demo</h2>
      <p>Upload demo content here</p>
    </div>
  ),
}))

// ─── Component ──────────────────────────────────────────────────────
let ChunkedUploadTest: React.ComponentType
beforeAll(async () => {
  const mod = await import('../ChunkedUploadTest')
  ChunkedUploadTest = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <ChunkedUploadTest />
    </MemoryRouter>
  )
}

describe('ChunkedUploadTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderComponent()
    expect(screen.getByTestId('chunked-upload-demo')).toBeInTheDocument()
  })

  it('renders the ChunkedUploadDemo component', () => {
    renderComponent()
    expect(screen.getByText('Chunked Upload Demo')).toBeInTheDocument()
  })

  it('renders demo content from ChunkedUploadDemo', () => {
    renderComponent()
    expect(screen.getByText('Upload demo content here')).toBeInTheDocument()
  })

  it('wraps content in a max-width container', () => {
    const { container } = renderComponent()
    const wrapper = container.querySelector('.max-w-6xl')
    expect(wrapper).toBeInTheDocument()
  })

  it('has min-h-screen background', () => {
    const { container } = renderComponent()
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv.className).toContain('min-h-screen')
  })
})
