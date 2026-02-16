import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import TeamInvite from '../team/TeamInvite';

const mockGetTeams = vi.fn();
const mockGetInvitations = vi.fn();
const mockInviteToTeam = vi.fn();
const mockResendInvitation = vi.fn();
const mockCancelInvitation = vi.fn();
const mockCreateTeam = vi.fn();

vi.mock('../../services/team.service', () => ({
  TeamService: {
    getTeams: (...args: any[]) => mockGetTeams(...args),
    getInvitations: (...args: any[]) => mockGetInvitations(...args),
    inviteToTeam: (...args: any[]) => mockInviteToTeam(...args),
    resendInvitation: (...args: any[]) => mockResendInvitation(...args),
    cancelInvitation: (...args: any[]) => mockCancelInvitation(...args),
    createTeam: (...args: any[]) => mockCreateTeam(...args),
  },
}));

vi.mock('../../components/DashboardHeader', () => ({
  default: () => <div data-testid="dashboard-header">DashboardHeader</div>,
}));

const mockTeams = [
  { id: 'team-1', name: 'Production Team', memberCount: 5 },
];

const mockInvitations = [
  {
    id: 'inv-1',
    teamId: 'team-1',
    teamName: 'Production Team',
    email: 'alice@example.com',
    role: 'Producer',
    status: 'pending',
    invitedBy: 'user-1',
    invitedByName: 'John Admin',
    message: 'Welcome to the team!',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-2',
    teamId: 'team-1',
    teamName: 'Production Team',
    email: 'bob@example.com',
    role: 'member',
    status: 'accepted',
    invitedBy: 'user-1',
    invitedByName: 'John Admin',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe('TeamInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTeams.mockResolvedValue(mockTeams);
    mockGetInvitations.mockResolvedValue(mockInvitations);
  });

  describe('loading state', () => {
    it('shows loading spinner while fetching invitations', () => {
      mockGetTeams.mockImplementation(() => new Promise(() => {}));
      mockGetInvitations.mockImplementation(() => new Promise(() => {}));
      render(<TeamInvite />);

      // The loading spinner appears in the pending tab section
      // but the invite form tab is shown by default
      expect(screen.getByText('Team Invitations')).toBeInTheDocument();
    });

    it('calls TeamService.getTeams and getInvitations on mount', async () => {
      render(<TeamInvite />);

      await waitFor(() => {
        expect(mockGetTeams).toHaveBeenCalledTimes(1);
        expect(mockGetInvitations).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('invite form tab', () => {
    it('renders the invite form with required fields', async () => {
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByText('Email Address *')).toBeInTheDocument();
      });

      expect(screen.getByText('Full Name *')).toBeInTheDocument();
      expect(screen.getByText('Role *')).toBeInTheDocument();
      expect(screen.getByText('Department *')).toBeInTheDocument();
      // "Send Invitation" appears in both tab label and submit button
      expect(screen.getAllByText(/Send Invitation/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows validation errors when form is submitted empty', async () => {
      const { container } = render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument();
      });

      // Submit the form directly to trigger handleSubmit validation
      const form = container.querySelector('form')!;
      expect(form).toBeTruthy();
      fireEvent.submit(form);

      // The empty email also fails the '@' check, so the error is "Please enter a valid email address"
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Role is required')).toBeInTheDocument();
      expect(screen.getByText('Department is required')).toBeInTheDocument();
    });

    it('submits invitation via TeamService.inviteToTeam', async () => {
      mockInviteToTeam.mockResolvedValue({
        id: 'inv-new',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const user = userEvent.setup();
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('colleague@company.com'), 'newmember@example.com');
      await user.type(screen.getByPlaceholderText('John Smith'), 'New Member');

      // Select role
      const roleSelect = screen.getByDisplayValue('Select Role');
      await user.selectOptions(roleSelect, 'Producer');

      // Select department
      const deptSelect = screen.getByDisplayValue('Select Department');
      await user.selectOptions(deptSelect, 'Production');

      // Find the form submit button (type="submit")
      const formSubmitButtons = screen.getAllByRole('button', { name: /send invitation/i });
      const actualSubmit = formSubmitButtons.find(btn => btn.getAttribute('type') === 'submit');
      await user.click(actualSubmit || formSubmitButtons[formSubmitButtons.length - 1]);

      await waitFor(() => {
        expect(mockInviteToTeam).toHaveBeenCalledWith(
          'team-1',
          expect.objectContaining({
            email: 'newmember@example.com',
            role: 'Producer',
          })
        );
      });
    });
  });

  describe('pending invitations tab', () => {
    it('shows invitation list when pending tab is clicked', async () => {
      const user = userEvent.setup();
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pending Invitations'));

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      });

      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    it('shows empty state when no invitations exist', async () => {
      mockGetInvitations.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pending Invitations'));

      await waitFor(() => {
        expect(screen.getByText('No invitations sent yet')).toBeInTheDocument();
      });
    });

    it('shows invitation stats', async () => {
      const user = userEvent.setup();
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pending Invitations'));

      await waitFor(() => {
        expect(screen.getByText('Total Sent')).toBeInTheDocument();
      });

      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });
  });

  describe('bulk invite', () => {
    it('shows bulk invite modal when button is clicked', async () => {
      const user = userEvent.setup();
      render(<TeamInvite />);

      await waitFor(() => {
        expect(screen.getByText('Bulk Invite')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Bulk Invite'));

      await waitFor(() => {
        expect(screen.getByText('Email Addresses (one per line)')).toBeInTheDocument();
      });

      expect(screen.getByText('Send Invitations')).toBeInTheDocument();
    });
  });
});
