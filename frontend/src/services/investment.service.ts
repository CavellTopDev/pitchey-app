import apiClient from '../lib/api-client';

export interface Investment {
  id: number;
  investorId: number;
  pitchId: number;
  amount: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  terms?: any;
  currentValue: number;
  documents?: any[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Extended fields for UI
  pitchTitle?: string;
  pitchGenre?: string;
  creatorName?: string;
  investmentDate?: Date;
  returnAmount?: number;
  returnPercentage?: number;
  daysInvested?: number;
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  returnPercentage: number;
  activeInvestments: number;
  completedInvestments: number;
  roi: number;
  monthlyGrowth?: number;
  quarterlyGrowth?: number;
  ytdGrowth?: number;
}

export interface FundingMetrics {
  totalRaised: number;
  fundingGoal?: number;
  activeInvestors: number;
  averageInvestment: number;
  fundingProgress: number;
  monthlyGrowth?: number;
  recentInvestments?: {
    id: number;
    amount: number;
    investorName: string;
    date: Date;
  }[];
  topInvestor?: {
    name: string;
    amount: number;
  };
}

export interface InvestmentOpportunity {
  id: number;
  title: string;
  logline: string;
  genre: string;
  estimatedBudget: number;
  seekingAmount?: number;
  productionStage: string;
  creator: {
    id: number;
    username: string;
    companyName?: string;
  };
  viewCount: number;
  likeCount: number;
  ratingAverage?: number;
  matchScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  expectedROI?: number;
  timeline?: string;
  publishedAt: Date;
}

export class InvestmentService {
  // Get investor's portfolio summary
  static async getInvestorPortfolio(investorId?: number): Promise<{
    success: boolean;
    data?: PortfolioMetrics;
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/investor/portfolio/summary');
      return response;
    } catch (error) {
      console.error('Error fetching investor portfolio:', error);
      return {
        success: false,
        error: 'Failed to fetch portfolio data'
      };
    }
  }

  // Get investor's investment history
  static async getInvestmentHistory(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data?: {
      investments: Investment[];
      total: number;
      totalPages: number;
      currentPage: number;
      summary?: {
        totalInvested: number;
        totalCurrentValue: number;
        activeCount: number;
        completedCount: number;
      };
    };
    error?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/investor/investments?${queryParams.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching investment history:', error);
      return {
        success: false,
        error: 'Failed to fetch investment history'
      };
    }
  }

  // Get investment opportunities for investor
  static async getInvestmentOpportunities(params?: {
    limit?: number;
    genre?: string;
    stage?: string;
    sortBy?: string;
  }): Promise<{
    success: boolean;
    data?: InvestmentOpportunity[];
    error?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.genre) queryParams.append('genre', params.genre);
      if (params?.stage) queryParams.append('stage', params.stage);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);

      const response = await apiClient.get(`/api/investment/recommendations?${queryParams.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching investment opportunities:', error);
      return {
        success: false,
        error: 'Failed to fetch investment opportunities'
      };
    }
  }

  // Get creator's funding overview
  static async getCreatorFunding(creatorId?: number): Promise<{
    success: boolean;
    data?: FundingMetrics;
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/creator/funding/overview');
      return response;
    } catch (error) {
      console.error('Error fetching creator funding:', error);
      return {
        success: false,
        error: 'Failed to fetch funding data'
      };
    }
  }

  // Get creator's investor relationships
  static async getCreatorInvestors(creatorId?: number): Promise<{
    success: boolean;
    data?: {
      investors: Array<{
        id: number;
        name: string;
        totalInvested: number;
        investments: Investment[];
        joinedDate: Date;
      }>;
      totalInvestors: number;
      totalRaised: number;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/creator/investors');
      return response;
    } catch (error) {
      console.error('Error fetching creator investors:', error);
      return {
        success: false,
        error: 'Failed to fetch investor data'
      };
    }
  }

  // Get production company investment metrics
  static async getProductionInvestments(): Promise<{
    success: boolean;
    data?: {
      totalInvestments: number;
      activeDeals: number;
      pipelineValue: number;
      monthlyGrowth: number;
      topOpportunities: InvestmentOpportunity[];
      recentActivity: Array<{
        type: 'investment' | 'opportunity' | 'partnership';
        title: string;
        amount?: number;
        date: Date;
      }>;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/production/investments/overview');
      return response;
    } catch (error) {
      console.error('Error fetching production investments:', error);
      return {
        success: false,
        error: 'Failed to fetch production investment data'
      };
    }
  }

  // Create a new investment
  static async createInvestment(data: {
    pitchId: number;
    amount: number;
    terms?: any;
  }): Promise<{
    success: boolean;
    data?: Investment;
    error?: string;
  }> {
    try {
      const response = await apiClient.post('/api/investments/create', data);
      return response;
    } catch (error) {
      console.error('Error creating investment:', error);
      return {
        success: false,
        error: 'Failed to create investment'
      };
    }
  }

  // Update investment status or details
  static async updateInvestment(investmentId: number, data: {
    status?: string;
    currentValue?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    data?: Investment;
    error?: string;
  }> {
    try {
      const response = await apiClient.post(`/api/investments/${investmentId}/update`, data);
      return response;
    } catch (error) {
      console.error('Error updating investment:', error);
      return {
        success: false,
        error: 'Failed to update investment'
      };
    }
  }

  // Get detailed investment information
  static async getInvestmentDetails(investmentId: number): Promise<{
    success: boolean;
    data?: Investment & {
      pitch: {
        title: string;
        genre: string;
        creator: { name: string; };
      };
      documents: Array<{
        id: number;
        name: string;
        url: string;
        uploadedAt: Date;
      }>;
      timeline: Array<{
        id: number;
        eventType: string;
        description: string;
        date: Date;
      }>;
      roi: number;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get(`/api/investments/${investmentId}/details`);
      return response;
    } catch (error) {
      console.error('Error fetching investment details:', error);
      return {
        success: false,
        error: 'Failed to fetch investment details'
      };
    }
  }

  // Calculate portfolio analytics
  static async getPortfolioAnalytics(investorId?: number): Promise<{
    success: boolean;
    data?: {
      totalROI: number;
      bestPerforming: Investment;
      worstPerforming: Investment;
      diversification: {
        byGenre: Record<string, number>;
        byStage: Record<string, number>;
      };
      monthlyPerformance: Array<{
        month: string;
        value: number;
        change: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/investor/portfolio/analytics');
      return response;
    } catch (error) {
      console.error('Error fetching portfolio analytics:', error);
      return {
        success: false,
        error: 'Failed to fetch portfolio analytics'
      };
    }
  }

  // Get investment preferences
  static async getInvestmentPreferences(): Promise<{
    success: boolean;
    data?: {
      investmentCriteria: {
        preferredGenres: string[];
        budgetRange: {
          min: number;
          max: number;
          label: string;
        };
        riskTolerance: 'Low' | 'Medium' | 'High';
        minROI: number;
      };
      investmentHistory: {
        totalInvestments: number;
        averageInvestment: number;
        successRate: number;
      };
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get('/api/investor/preferences');
      return response;
    } catch (error) {
      console.error('Error fetching investment preferences:', error);
      return {
        success: false,
        error: 'Failed to fetch investment preferences'
      };
    }
  }
}