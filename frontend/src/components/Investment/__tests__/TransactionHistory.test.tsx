import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/utils';
import TransactionHistory from '../TransactionHistory';

const mockGetTransactions = vi.fn();
vi.mock('../../../services/investor.service', () => ({
  investorApi: {
    getTransactions: (...args: any[]) => mockGetTransactions(...args),
  },
}));

const mockTransactions = [
  {
    id: 1,
    type: 'investment',
    amount: 50000,
    investment_id: 10,
    pitch_title: 'Action Movie Alpha',
    genre: 'Action',
    creator_name: 'Jane Creator',
    status: 'completed',
    created_at: '2026-01-15T00:00:00Z',
    description: 'Initial investment',
  },
  {
    id: 2,
    type: 'return',
    amount: 12000,
    investment_id: 10,
    pitch_title: 'Action Movie Alpha',
    genre: 'Action',
    creator_name: 'Jane Creator',
    status: 'completed',
    created_at: '2026-02-01T00:00:00Z',
    description: 'Q1 return',
  },
  {
    id: 3,
    type: 'fee',
    amount: -500,
    investment_id: 20,
    pitch_title: 'Drama Film Beta',
    genre: 'Drama',
    creator_name: 'Bob Director',
    status: 'pending',
    created_at: '2026-02-10T00:00:00Z',
    description: 'Platform fee',
  },
];

const makeSuccessResponse = (transactions: any[] = mockTransactions, totalPages = 1) => ({
  success: true,
  data: {
    transactions,
    totalPages,
    total: transactions.length,
  },
});

describe('TransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTransactions.mockResolvedValue(makeSuccessResponse());
  });

  describe('loading state', () => {
    it('shows loading skeleton initially', () => {
      mockGetTransactions.mockImplementation(() => new Promise(() => {}));
      render(<TransactionHistory userType="investor" />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('hides skeleton after data loads', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        const skeleton = document.querySelector('.animate-pulse');
        expect(skeleton).not.toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows "No transactions found" when empty', async () => {
      mockGetTransactions.mockResolvedValue(makeSuccessResponse([]));
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });

    it('shows default helper text when no filters active', async () => {
      mockGetTransactions.mockResolvedValue(makeSuccessResponse([]));
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('Transactions will appear here as you invest')).toBeInTheDocument();
      });
    });
  });

  describe('success with data', () => {
    it('renders transaction list with pitch titles and creator names', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        // "Action Movie Alpha" appears in two transactions (investment + return)
        expect(screen.getAllByText(/Action Movie Alpha/).length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getAllByText(/Jane Creator/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Drama Film Beta/)).toBeInTheDocument();
      expect(screen.getByText(/Bob Director/)).toBeInTheDocument();
    });

    it('renders transaction types', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('investment')).toBeInTheDocument();
      });

      expect(screen.getByText('return')).toBeInTheDocument();
      expect(screen.getByText('fee')).toBeInTheDocument();
    });

    it('renders transaction statuses', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getAllByText('completed')).toHaveLength(2);
      });

      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('renders descriptions', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('Initial investment')).toBeInTheDocument();
      });

      expect(screen.getByText('Q1 return')).toBeInTheDocument();
      expect(screen.getByText('Platform fee')).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('hides header controls when compact', async () => {
      render(<TransactionHistory userType="investor" compact />);

      await waitFor(() => {
        expect(screen.queryByText('Transaction History')).not.toBeInTheDocument();
      });

      expect(screen.queryByPlaceholderText('Search transactions...')).not.toBeInTheDocument();
      expect(screen.queryByText('Export')).not.toBeInTheDocument();
    });

    it('shows header controls when not compact', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('Transaction History')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  describe('API integration', () => {
    it('calls investorApi.getTransactions on mount', async () => {
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalledTimes(1);
      });

      expect(mockGetTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
        })
      );
    });

    it('handles API error gracefully', async () => {
      mockGetTransactions.mockRejectedValue(new Error('Network error'));
      render(<TransactionHistory userType="investor" />);

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });
  });
});
