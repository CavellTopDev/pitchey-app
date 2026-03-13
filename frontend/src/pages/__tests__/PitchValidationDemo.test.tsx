import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// ─── EnhancedPitchForm ───────────────────────────────────────────────
vi.mock('@features/pitches/components/PitchValidation', () => ({
  EnhancedPitchForm: ({ pitchId, initialData, onSave, onSubmit }: any) => (
    <div data-testid="enhanced-pitch-form" data-pitch-id={pitchId}>
      <p>Enhanced Pitch Form</p>
      <button onClick={() => onSave && onSave({ title: 'saved' })}>Save Form</button>
      <button onClick={() => onSubmit && onSubmit({ title: 'submitted' })}>Submit Form</button>
    </div>
  ),
  ValidationDashboard: ({ pitchId, onRecommendationClick, onAnalyzeClick }: any) => (
    <div data-testid="validation-dashboard" data-pitch-id={pitchId}>
      <p>Validation Dashboard</p>
      <button onClick={() => onRecommendationClick && onRecommendationClick({ id: 'rec1' })}>Click Recommendation</button>
      <button onClick={() => onAnalyzeClick && onAnalyzeClick()}>Analyze</button>
    </div>
  ),
  ValidationService: {
    analyzePlay: vi.fn(),
    getScore: vi.fn(),
    getRecommendations: vi.fn(),
    getDashboard: vi.fn(),
  },
  ValidationUtils: {
    getScoreLabel: (score: number) => {
      if (score >= 80) return 'Excellent'
      if (score >= 60) return 'Good'
      if (score >= 40) return 'Needs Work'
      return 'Requires Attention'
    },
    getScoreColor: (score: number) => score >= 80 ? 'green' : 'yellow',
  },
}))

// ─── Component ──────────────────────────────────────────────────────
let PitchValidationDemo: React.ComponentType
beforeAll(async () => {
  const mod = await import('../PitchValidationDemo')
  PitchValidationDemo = mod.default
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <PitchValidationDemo />
    </MemoryRouter>
  )
}

describe('PitchValidationDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    renderComponent()
    expect(screen.getByText('Pitch Validation System')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    renderComponent()
    expect(screen.getByText('AI-powered analysis and scoring for movie pitches')).toBeInTheDocument()
  })

  it('renders the Demo Active badge', () => {
    renderComponent()
    expect(screen.getByText('Demo Active')).toBeInTheDocument()
  })

  it('renders feature showcase cards on form tab', () => {
    renderComponent()
    expect(screen.getByText('Real-time AI Analysis')).toBeInTheDocument()
    expect(screen.getByText('Smart Recommendations')).toBeInTheDocument()
    expect(screen.getByText('Market Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Success Prediction')).toBeInTheDocument()
  })

  it('renders the tab navigation buttons', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /Smart Form/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Validation Dashboard/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Market Analytics/ })).toBeInTheDocument()
  })

  it('shows the form tab content by default', () => {
    renderComponent()
    expect(screen.getByTestId('enhanced-pitch-form')).toBeInTheDocument()
  })

  it('renders EnhancedPitchForm with correct pitchId', () => {
    renderComponent()
    const form = screen.getByTestId('enhanced-pitch-form')
    expect(form.getAttribute('data-pitch-id')).toBe('demo-pitch-123')
  })

  it('renders AI-Enhanced Pitch Creation heading in form tab', () => {
    renderComponent()
    expect(screen.getByText('AI-Enhanced Pitch Creation')).toBeInTheDocument()
  })

  it('switches to Validation Dashboard tab when clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Validation Dashboard/ }))
    expect(screen.getByTestId('validation-dashboard')).toBeInTheDocument()
  })

  it('renders ValidationDashboard with correct pitchId', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Validation Dashboard/ }))
    const dashboard = screen.getByTestId('validation-dashboard')
    expect(dashboard.getAttribute('data-pitch-id')).toBe('demo-pitch-123')
  })

  it('shows Comprehensive Validation Dashboard heading on dashboard tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Validation Dashboard/ }))
    expect(screen.getByText('Comprehensive Validation Dashboard')).toBeInTheDocument()
  })

  it('switches to Market Analytics tab when clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('Market Intelligence & Analytics')).toBeInTheDocument()
  })

  it('shows overall score on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('78/100')).toBeInTheDocument()
  })

  it('shows success probability on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('74%')).toBeInTheDocument()
  })

  it('shows score label from ValidationUtils on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    // score 78 -> 'Good'
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  it('shows category performance section on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('Category Performance vs. Industry')).toBeInTheDocument()
  })

  it('shows genre performance in market insights on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('Above Average')).toBeInTheDocument()
  })

  it('shows competition level on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('Moderate')).toBeInTheDocument()
  })

  it('shows recommendations on analytics tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.getByText('Strengthen Director Attachment')).toBeInTheDocument()
    expect(screen.getByText('Refine Target Audience')).toBeInTheDocument()
    expect(screen.getByText('Enhance Character Arc')).toBeInTheDocument()
  })

  it('renders demo footer with Get Started button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: 'Get Started Free' })).toBeInTheDocument()
  })

  it('renders footer tagline', () => {
    renderComponent()
    expect(screen.getByText('Ready to validate your pitch?')).toBeInTheDocument()
  })

  it('switching tabs hides feature cards when not on form tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    expect(screen.queryByText('Real-time AI Analysis')).not.toBeInTheDocument()
  })

  it('switching back to form tab shows feature cards again', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: /Market Analytics/ }))
    fireEvent.click(screen.getByRole('button', { name: /Smart Form/ }))
    expect(screen.getByText('Real-time AI Analysis')).toBeInTheDocument()
  })

  it('submitting form switches to dashboard tab', () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'Submit Form' }))
    expect(screen.getByTestId('validation-dashboard')).toBeInTheDocument()
  })
})
