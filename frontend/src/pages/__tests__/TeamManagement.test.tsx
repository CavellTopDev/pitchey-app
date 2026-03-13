import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// ─── Hoisted mock functions ─────────────────────────────────────────
const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockGetTeams = vi.fn()
const mockGetTeamMembers = vi.fn()
const mockInviteToTeam = vi.fn()
const mockRemoveMember = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

// ─── react-router-dom ───────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── Auth store (STABLE reference) ──────────────────────────────────
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  userType: 'production',
}

const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  logout: mockLogout,
}

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockAuthState,
}))

// ─── TeamService ─────────────────────────────────────────────────────
vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeams: (...args: any[]) => mockGetTeams(...args),
    getTeamMembers: (...args: any[]) => mockGetTeamMembers(...args),
    inviteToTeam: (...args: any[]) => mockInviteToTeam(...args),
    removeMember: (...args: any[]) => mockRemoveMember(...args),
  },
}))

// ─── react-hot-toast ─────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
  toast: { success: mockToastSuccess, error: mockToastError, loading: vi.fn() },
}))

// ─── DashboardHeader ─────────────────────────────────────────────────
vi.mock('../../components/DashboardHeader', () => ({
  default: ({ title }: any) => <div data-testid="dashboard-header">{title}</div>,
}))

// ─── Mock data ───────────────────────────────────────────────────────
const mockTeams = [
  {
    id: 'team-1',
    name: 'Production Team Alpha',
    memberCount: 3,
    members: [
      {
        id: 'member-1',
        name: 'Alice Producer',
        email: 'alice@studio.com',
        role: 'producer',
        status: 'active' as const,
        joinedDate: '2025-01-15T00:00:00Z',
      },
      {
        id: 'member-2',
        name: 'Bob Director',
        email: 'bob@studio.com',
        role: 'director',
        status: 'active' as const,
        joinedDate: '2025-02-01T00:00:00Z',
      },
      {
        id: 'member-3',
        name: 'Charlie Pending',
        email: 'charlie@studio.com',
        role: 'collaborator',
        status: 'pending' as const,
        joinedDate: '2025-03-01T00:00:00Z',
      },
    ],
  },
]

// ─── Dynamic import ──────────────────────────────────────────────────
let TeamManagement: React.ComponentType
beforeAll(async () => {
  const mod = await import('../TeamManagement')
  TeamManagement = mod.default
})

const renderComponent = () =>
  render(
    <MemoryRouter>
      <TeamManagement />
    </MemoryRouter>
  )

describe('TeamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTeams.mockResolvedValue(mockTeams)
    mockGetTeamMembers.mockResolvedValue([])
    mockInviteToTeam.mockResolvedValue({ id: 'inv-new', createdAt: new Date().toISOString() })
    mockRemoveMember.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('Loading state', () => {
    it('shows loading spinner while fetching team data', () => {
      mockGetTeams.mockReturnValue(new Promise(() => {}))
      renderComponent()
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      mockGetTeams.mockRejectedValue(new Error('Network error'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows Retry button in error state', async () => {
      mockGetTeams.mockRejectedValue(new Error('Failed'))
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })
  })

  describe('Layout', () => {
    it('renders the dashboard header with "Team Management" title', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-header')).toHaveTextContent('Team Management')
      })
    })

    it('renders the page heading and description', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('Team Management').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getByText('Manage your production team, roles, and permissions')).toBeInTheDocument()
    })

    it('renders Invite Member button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })
    })

    it('renders Manage Roles button', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Manage Roles')).toBeInTheDocument()
      })
    })

    it('renders search input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search team members...')).toBeInTheDocument()
      })
    })
  })

  describe('Stats cards', () => {
    it('renders all stats cards', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Members')).toBeInTheDocument()
      })
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Teams')).toBeInTheDocument()
    })

    it('shows correct member count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Total Members')).toBeInTheDocument()
      })
      // 3 members total
      const totalEl = screen.getByText('Total Members').closest('div')?.parentElement
      expect(totalEl?.querySelector('.text-2xl')?.textContent).toBe('3')
    })

    it('shows correct active count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
      // 2 active members
      const activeEl = screen.getByText('Active').closest('div')?.parentElement
      expect(activeEl?.querySelector('.text-2xl')?.textContent).toBe('2')
    })

    it('shows correct pending count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })
      // 1 pending member
      const pendingEl = screen.getByText('Pending').closest('div')?.parentElement
      expect(pendingEl?.querySelector('.text-2xl')?.textContent).toBe('1')
    })

    it('shows correct teams count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Teams')).toBeInTheDocument()
      })
      const teamsEl = screen.getByText('Teams').closest('div')?.parentElement
      expect(teamsEl?.querySelector('.text-2xl')?.textContent).toBe('1')
    })
  })

  describe('Member cards', () => {
    it('renders member names', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
      expect(screen.getByText('Bob Director')).toBeInTheDocument()
      expect(screen.getByText('Charlie Pending')).toBeInTheDocument()
    })

    it('renders member emails', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('alice@studio.com')).toBeInTheDocument()
      })
      expect(screen.getByText('bob@studio.com')).toBeInTheDocument()
    })

    it('renders member roles', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('producer')).toBeInTheDocument()
      })
      expect(screen.getByText('director')).toBeInTheDocument()
      expect(screen.getByText('collaborator')).toBeInTheDocument()
    })

    it('renders status badges for members', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('active').length).toBeGreaterThanOrEqual(2)
      })
      expect(screen.getByText('pending')).toBeInTheDocument()
    })

    it('renders member initials in avatar', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('AP')).toBeInTheDocument()
      })
      expect(screen.getByText('BD')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no members found', async () => {
      mockGetTeams.mockResolvedValue([{ id: 'team-1', name: 'Empty Team', memberCount: 0, members: [] }])
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('No team members found')).toBeInTheDocument()
      })
    })

    it('shows message to create a team when no teams exist', async () => {
      mockGetTeams.mockResolvedValue([])
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('No team members found')).toBeInTheDocument()
      })
      expect(screen.getByText('Create a team first to start managing members')).toBeInTheDocument()
    })

    it('disables Invite Member button when no teams exist', async () => {
      mockGetTeams.mockResolvedValue([])
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })
      const inviteBtn = screen.getByText('Invite Member').closest('button')
      expect(inviteBtn).toBeDisabled()
    })
  })

  describe('Search filter', () => {
    it('filters members by name', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search team members...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('Search team members...'), 'Alice')

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })
      expect(screen.queryByText('Bob Director')).not.toBeInTheDocument()
    })

    it('filters members by email', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search team members...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('Search team members...'), 'bob@')

      await waitFor(() => {
        expect(screen.getByText('Bob Director')).toBeInTheDocument()
      })
      expect(screen.queryByText('Alice Producer')).not.toBeInTheDocument()
    })
  })

  describe('Invite modal', () => {
    it('opens invite modal when Invite Member is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument()
      })
      expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
    })

    it('renders role select in invite modal', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByDisplayValue('Member')).toBeInTheDocument()
      })
    })

    it('renders optional message field in invite modal', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByText('Message (Optional)')).toBeInTheDocument()
      })
    })

    it('closes invite modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument()
      })

      // Find the Cancel button inside the modal
      const cancelBtn = screen.getAllByText('Cancel').find(el => el.tagName === 'BUTTON')
      await user.click(cancelBtn!)

      await waitFor(() => {
        expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument()
      })
    })

    it('calls inviteToTeam when form is submitted with email', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('colleague@company.com'), 'newmember@studio.com')

      await user.click(screen.getByText('Send Invitation'))

      await waitFor(() => {
        expect(mockInviteToTeam).toHaveBeenCalledWith(
          'team-1',
          expect.objectContaining({
            email: 'newmember@studio.com',
            role: 'member',
          })
        )
      })
    })

    it('shows success toast after sending invitation', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('colleague@company.com'), 'newmember@studio.com')
      await user.click(screen.getByText('Send Invitation'))

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Invitation sent to newmember@studio.com')
      })
    })

    it('Send Invitation button is disabled when email is empty', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Invite Member')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Invite Member'))

      await waitFor(() => {
        expect(screen.getByText('Send Invitation')).toBeInTheDocument()
      })

      const sendBtn = screen.getByText('Send Invitation').closest('button')
      expect(sendBtn).toBeDisabled()
    })
  })

  describe('Remove member', () => {
    it('calls removeMember when trash icon is clicked and confirmed', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove member')
      await user.click(removeButtons[0])

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith('team-1', 'member-1')
      })
    })

    it('shows success toast after removing member', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove member')
      await user.click(removeButtons[0])

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Member removed')
      })
    })

    it('does not call removeMember when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Alice Producer')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove member')
      await user.click(removeButtons[0])

      expect(mockRemoveMember).not.toHaveBeenCalled()
    })
  })

  describe('Manage Roles navigation', () => {
    it('navigates to roles page when Manage Roles is clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Manage Roles')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Manage Roles'))

      expect(mockNavigate).toHaveBeenCalledWith('/production/team/roles')
    })
  })
})
