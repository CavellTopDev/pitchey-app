// Investor Service - Dashboard and investor-specific operations with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { Pitch } from './pitch.service';
import type { User } from './user.service';

// Types for investor dashboard data
export interface InvestorStats {
  totalInvestments: number;
  activeInvestments: number;
  totalInvested: number;
  portfolioValue: number;
  avgROI: number;
  pitchesViewed: number;
  pitchesLiked: number;
  ndaSigned: number;
}

export interface Investment {
  id: number;
  pitchId: number;
  amount: number;
  percentage: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  terms?: string;
  contractUrl?: string;
  investedAt: string;
  updatedAt: string;
  pitch?: Pitch;
  returns?: number;
  currentValue?: number;
}

export interface InvestmentOpportunity {
  id: number;
  pitch: Pitch;
  minInvestment: number;
  maxInvestment: number;
  targetAmount: number;
  raisedAmount: number;
  investors: number;
  deadline: string;
  terms: string;
  projectedROI?: number;
  riskLevel: 'low' | 'medium' | 'high';
  matchScore?: number; // AI-based matching score
}

export interface InvestorPortfolio {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  investments: Investment[];
  performance: {
    date: string;
    value: number;
  }[];
  diversification: {
    genre: string;
    amount: number;
    percentage: number;
  }[];
}

export interface WatchlistItem {
  id: number;
  pitchId: number;
  addedAt: string;
  notes?: string;
  alertsEnabled: boolean;
  pitch?: Pitch;
}

export class InvestorService {
  // Get investor dashboard
  static async getDashboard(): Promise<{
    stats: InvestorStats;
    recentOpportunities: InvestmentOpportunity[];
    portfolio: InvestorPortfolio;
    watchlist: WatchlistItem[];
    activities: any[];
  }> {
    const response = await apiClient.get<{
      success: boolean;
      dashboard: any;
    }>('/api/investor/dashboard');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch dashboard');
    }

    return response.data?.dashboard || {
      stats: {
        totalInvestments: 0,
        activeInvestments: 0,
        totalInvested: 0,
        portfolioValue: 0,
        avgROI: 0,
        pitchesViewed: 0,
        pitchesLiked: 0,
        ndaSigned: 0
      },
      recentOpportunities: [],
      portfolio: {
        totalValue: 0,
        totalInvested: 0,
        totalReturns: 0,
        investments: [],
        performance: [],
        diversification: []
      },
      watchlist: [],
      activities: []
    };
  }

  // Get investment opportunities
  static async getOpportunities(filters?: {
    genre?: string;
    minInvestment?: number;
    maxInvestment?: number;
    riskLevel?: string;
    sortBy?: 'matchScore' | 'deadline' | 'roi' | 'popularity';
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: InvestmentOpportunity[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.genre) params.append('genre', filters.genre);
    if (filters?.minInvestment) params.append('minInvestment', filters.minInvestment.toString());
    if (filters?.maxInvestment) params.append('maxInvestment', filters.maxInvestment.toString());
    if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{
      success: boolean;
      opportunities: InvestmentOpportunity[];
      total: number;
    }>(`/api/investor/opportunities?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch opportunities');
    }

    return {
      opportunities: response.data?.opportunities || [],
      total: response.data?.total || 0
    };
  }

  // Get portfolio summary with detailed metrics
  static async getPortfolioSummary(): Promise<{
    totalInvestments: number;
    activeDeals: number;
    totalInvested: number;
    currentValue: number;
    averageReturn: number;
    pendingOpportunities: number;
    monthlyGrowth: number;
    quarterlyGrowth: number;
    ytdGrowth: number;
  }> {
    const response = await apiClient.get<{
      success: boolean;
      data: any;
    }>('/api/investor/portfolio/summary');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch portfolio summary');
    }

    return response.data?.data || {
      totalInvestments: 0,
      activeDeals: 0,
      totalInvested: 0,
      currentValue: 0,
      averageReturn: 0,
      pendingOpportunities: 0,
      monthlyGrowth: 0,
      quarterlyGrowth: 0,
      ytdGrowth: 0
    };
  }

  // Get portfolio performance history
  static async getPortfolioPerformance(timeframe: string = '1y'): Promise<any[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: any;
    }>(`/api/investor/portfolio/performance?timeframe=${timeframe}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch portfolio performance');
    }

    return response.data?.performanceData || [];
  }

  // Get portfolio
  static async getPortfolio(options?: {
    status?: 'active' | 'completed' | 'all';
    sortBy?: 'value' | 'returns' | 'date';
  }): Promise<InvestorPortfolio> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.sortBy) params.append('sortBy', options.sortBy);

    const response = await apiClient.get<{
      success: boolean;
      portfolio: InvestorPortfolio;
    }>(`/api/investor/portfolio?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch portfolio');
    }

    return response.data?.portfolio || {
      totalValue: 0,
      totalInvested: 0,
      totalReturns: 0,
      investments: [],
      performance: [],
      diversification: []
    };
  }

  // Make investment
  static async invest(data: {
    pitchId: number;
    amount: number;
    terms?: string;
    message?: string;
  }): Promise<Investment> {
    const response = await apiClient.post<{
      success: boolean;
      investment: Investment;
    }>('/api/investor/invest', data);

    if (!response.success || !response.data?.investment) {
      throw new Error(response.error?.message || 'Failed to make investment');
    }

    return response.data.investment;
  }

  // Withdraw investment
  static async withdrawInvestment(investmentId: number, reason?: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/investor/investments/${investmentId}/withdraw`,
      { reason }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to withdraw investment');
    }
  }

  // Get watchlist
  static async getWatchlist(): Promise<WatchlistItem[]> {
    const response = await apiClient.get<{
      success: boolean;
      watchlist: WatchlistItem[];
    }>('/api/investor/watchlist');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch watchlist');
    }

    return response.data?.watchlist || [];
  }

  // Add to watchlist
  static async addToWatchlist(pitchId: number, notes?: string): Promise<WatchlistItem> {
    const response = await apiClient.post<{
      success: boolean;
      item: WatchlistItem;
    }>('/api/investor/watchlist', { pitchId, notes });

    if (!response.success || !response.data?.item) {
      throw new Error(response.error?.message || 'Failed to add to watchlist');
    }

    return response.data.item;
  }

  // Remove from watchlist
  static async removeFromWatchlist(pitchId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/investor/watchlist/${pitchId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to remove from watchlist');
    }
  }

  // Get investment analytics
  static async getAnalytics(period?: 'week' | 'month' | 'quarter' | 'year' | 'all'): Promise<{
    performance: {
      date: string;
      value: number;
      invested: number;
      returns: number;
    }[];
    topPerformers: Investment[];
    riskAnalysis: {
      lowRisk: number;
      mediumRisk: number;
      highRisk: number;
    };
    genrePerformance: {
      genre: string;
      investments: number;
      totalValue: number;
      avgROI: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<{
      success: boolean;
      analytics: any;
    }>(`/api/investor/analytics?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch analytics');
    }

    return response.data?.analytics || {
      performance: [],
      topPerformers: [],
      riskAnalysis: {
        lowRisk: 0,
        mediumRisk: 0,
        highRisk: 0
      },
      genrePerformance: []
    };
  }

  // Get recommended pitches (AI-powered)
  static async getRecommendations(options?: {
    limit?: number;
    minScore?: number;
  }): Promise<{
    pitch: Pitch;
    score: number;
    reasons: string[];
  }[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.minScore) params.append('minScore', options.minScore.toString());

    const response = await apiClient.get<{
      success: boolean;
      recommendations: any[];
    }>(`/api/investor/recommendations?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch recommendations');
    }

    return response.data?.recommendations || [];
  }

  // Get investment documents
  static async getDocuments(investmentId: number): Promise<{
    id: number;
    name: string;
    type: 'contract' | 'report' | 'statement' | 'other';
    url: string;
    uploadedAt: string;
  }[]> {
    const response = await apiClient.get<{
      success: boolean;
      documents: any[];
    }>(`/api/investor/investments/${investmentId}/documents`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch documents');
    }

    return response.data?.documents || [];
  }

  // Download investment report
  static async downloadReport(investmentId: number, format: 'pdf' | 'excel'): Promise<Blob> {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/investor/investments/${investmentId}/report?format=${format}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download report');
    }

    return response.blob();
  }

  // Set investment alerts
  static async setAlerts(pitchId: number, alerts: {
    onStatusChange?: boolean;
    onPriceChange?: boolean;
    onDeadlineApproaching?: boolean;
    customThreshold?: number;
  }): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/investor/alerts/${pitchId}`,
      alerts
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to set alerts');
    }
  }

  // Get tax documents
  static async getTaxDocuments(year: number): Promise<{
    documents: Array<{
      id: number;
      type: string;
      name: string;
      url: string;
      year: number;
    }>;
    summary: {
      totalInvested: number;
      totalReturns: number;
      netGainLoss: number;
      taxableAmount: number;
    };
  }> {
    const response = await apiClient.get<{
      success: boolean;
      taxInfo: any;
    }>(`/api/investor/tax/${year}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch tax documents');
    }

    return response.data?.taxInfo || {
      documents: [],
      summary: {
        totalInvested: 0,
        totalReturns: 0,
        netGainLoss: 0,
        taxableAmount: 0
      }
    };
  }
}

// Export singleton instance
export const investorService = InvestorService;