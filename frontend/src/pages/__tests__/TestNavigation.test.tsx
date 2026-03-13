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

// ─── EnhancedNavigation ─────────────────────────────────────────────
vi.mock('../../components/EnhancedNavigation', () => ({
  default: ({ user, userType }: any) => (
    <nav data-testid="enhanced-navigation" data-user-type={userType}>
      <span data-testid="nav-user-email">{user?.email}</span>
      <span data-testid="nav-user-type">{userType}</span>
    </nav>
  ),
}))

// ─── Component ──────────────────────────────────────────────────────
let TestNavigation: React.ComponentType
beforeAll(async () => {
  const mod = await import('../TestNavigation')
  TestNavigation = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <TestNavigation />
    </MemoryRouter>
  )
}

describe('TestNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    renderComponent()
    expect(screen.getByText('Navigation Test Page')).toBeInTheDocument()
  })

  it('renders the EnhancedNavigation component', () => {
    renderComponent()
    expect(screen.getByTestId('enhanced-navigation')).toBeInTheDocument()
  })

  it('passes production user type to navigation', () => {
    renderComponent()
    expect(screen.getByTestId('nav-user-type').textContent).toBe('production')
  })

  it('passes mock user email to navigation', () => {
    renderComponent()
    expect(screen.getByTestId('nav-user-email').textContent).toBe('test@example.com')
  })

  it('renders test instructions heading', () => {
    renderComponent()
    expect(screen.getByText('Test Instructions')).toBeInTheDocument()
  })

  it('renders all five instruction steps', () => {
    renderComponent()
    expect(screen.getByText(/Resize your browser/)).toBeInTheDocument()
    expect(screen.getByText(/Click the hamburger menu button/)).toBeInTheDocument()
    expect(screen.getByText(/Try clicking on dropdown items/)).toBeInTheDocument()
    expect(screen.getByText(/Check the browser console/)).toBeInTheDocument()
    expect(screen.getByText(/Verify that dropdown menus/)).toBeInTheDocument()
  })

  it('renders Desktop Navigation card', () => {
    renderComponent()
    expect(screen.getByText('Desktop Navigation')).toBeInTheDocument()
    expect(screen.getByText('Hover-based dropdowns in desktop view')).toBeInTheDocument()
  })

  it('renders Mobile Navigation card', () => {
    renderComponent()
    expect(screen.getByText('Mobile Navigation')).toBeInTheDocument()
    expect(screen.getByText('Click-based dropdowns with visual debug indicators')).toBeInTheDocument()
  })

  it('renders Debug Mode card', () => {
    renderComponent()
    expect(screen.getByText('Debug Mode')).toBeInTheDocument()
    expect(screen.getByText('Enhanced logging and visual feedback enabled')).toBeInTheDocument()
  })
})
