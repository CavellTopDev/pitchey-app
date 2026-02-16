import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { investorApi, InvestorService } from '../investor.service';

describe('investor.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── investorApi singleton methods ────────────────────────────────

  describe('investorApi.getFinancialSummary', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: { totalInvested: 100000 } });

      await investorApi.getFinancialSummary();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/financial/summary');
    });

    it('passes timeframe as query param when provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getFinancialSummary('30d');

      expect(mockGet).toHaveBeenCalledWith('/api/investor/financial/summary?timeframe=30d');
    });
  });

  describe('investorApi.getBudgetAllocations', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await investorApi.getBudgetAllocations();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/budget/allocations');
    });
  });

  describe('investorApi.getTransactions', () => {
    it('calls apiClient.get with query params', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { transactions: [], totalPages: 1 },
      });

      await investorApi.getTransactions({ page: 1, limit: 20 });

      expect(mockGet).toHaveBeenCalledTimes(1);
      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/investor/transactions');
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=20');
    });

    it('omits undefined params from query string', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { transactions: [], totalPages: 1 },
      });

      await investorApi.getTransactions({ page: 2, limit: 10, type: undefined, search: undefined });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).not.toContain('type=');
      expect(calledUrl).not.toContain('search=');
    });

    it('includes type and search when provided', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { transactions: [], totalPages: 1 },
      });

      await investorApi.getTransactions({ page: 1, limit: 10, type: 'investment', search: 'movie' });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('type=investment');
      expect(calledUrl).toContain('search=movie');
    });
  });

  describe('investorApi.getNetwork', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getNetwork();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/network');
    });
  });

  describe('investorApi.getCoInvestors', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getCoInvestors();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/co-investors');
    });
  });

  describe('investorApi.getCreators', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getCreators();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/creators');
    });
  });

  describe('investorApi.getProductionCompanies', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getProductionCompanies();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/production-companies');
    });
  });

  describe('investorApi.getPerformance', () => {
    it('calls apiClient.get with correct endpoint', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getPerformance();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/performance');
    });

    it('passes timeframe as query param when provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      await investorApi.getPerformance('1y');

      expect(mockGet).toHaveBeenCalledWith('/api/investor/performance?timeframe=1y');
    });
  });

  // ─── InvestorService class static methods ──────────────────────────

  describe('InvestorService.getDashboard', () => {
    it('calls apiClient.get with /api/investor/dashboard', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          dashboard: {
            stats: {
              totalInvestments: 5,
              activeInvestments: 3,
              totalInvested: 100000,
              portfolioValue: 120000,
              avgROI: 20,
              pitchesViewed: 50,
              pitchesLiked: 10,
              ndaSigned: 4,
            },
            recentOpportunities: [],
            portfolio: {
              totalValue: 120000,
              totalInvested: 100000,
              totalReturns: 20000,
              investments: [],
              performance: [],
              diversification: [],
            },
            watchlist: [],
            activities: [],
          },
        },
      });

      const result = await InvestorService.getDashboard();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/dashboard');
      expect(result.stats.totalInvestments).toBe(5);
      expect(result.stats.totalInvested).toBe(100000);
    });

    it('throws when API returns success: false', async () => {
      mockGet.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
      });

      await expect(InvestorService.getDashboard()).rejects.toThrow();
    });
  });

  describe('InvestorService.getPortfolio', () => {
    it('calls apiClient.get with portfolio endpoint', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          portfolio: {
            totalValue: 200000,
            totalInvested: 150000,
            totalReturns: 50000,
            investments: [],
            performance: [],
            diversification: [],
          },
        },
      });

      const result = await InvestorService.getPortfolio();

      expect(mockGet).toHaveBeenCalledTimes(1);
      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/investor/portfolio');
      expect(result.totalValue).toBe(200000);
    });

    it('returns default portfolio when API data is empty', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await InvestorService.getPortfolio();

      expect(result.totalValue).toBe(0);
      expect(result.investments).toEqual([]);
    });
  });

  describe('InvestorService.invest', () => {
    it('calls apiClient.post with investment data', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: {
          investment: {
            id: 1,
            pitchId: 10,
            amount: 50000,
            status: 'pending',
          },
        },
      });

      const result = await InvestorService.invest({
        pitchId: 10,
        amount: 50000,
        message: 'Interested in this project',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/investor/invest', {
        pitchId: 10,
        amount: 50000,
        message: 'Interested in this project',
      });
      expect(result.id).toBe(1);
    });

    it('throws when investment fails', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      });

      await expect(
        InvestorService.invest({ pitchId: 10, amount: 50000 })
      ).rejects.toThrow();
    });
  });
});
