// Production Service - Dashboard and production company-specific operations with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { Pitch } from '../types/api';
import type { User } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Types for production dashboard data
export interface ProductionStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  inDevelopment: number;
  totalBudget: number;
  pitchesReviewed: number;
  pitchesContracted: number;
  ndaSigned: number;
}

export interface ProductionProject {
  id: number;
  pitchId: number;
  title: string;
  status: 'development' | 'pre-production' | 'production' | 'post-production' | 'completed' | 'on-hold';
  budget: number;
  spentBudget: number;
  startDate: string;
  endDate?: string;
  estimatedEndDate?: string;
  team: {
    role: string;
    name: string;
    email?: string;
  }[];
  milestones: {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    completed: boolean;
    completedAt?: string;
  }[];
  pitch?: Pitch;
  creator?: User;
}

export interface ProductionDeal {
  id: number;
  pitchId: number;
  creatorId: number;
  status: 'negotiating' | 'signed' | 'active' | 'completed' | 'terminated';
  dealType: 'option' | 'purchase' | 'development' | 'production';
  amount: number;
  royaltyPercentage?: number;
  terms: string;
  contractUrl?: string;
  signedAt?: string;
  expiresAt?: string;
  pitch?: Pitch;
  creator?: User;
}

export interface TalentSearch {
  id: number;
  userId: number;
  name: string;
  role: 'director' | 'writer' | 'actor' | 'producer' | 'cinematographer' | 'other';
  experience: string;
  imdbProfile?: string;
  portfolio?: string;
  availability: 'available' | 'busy' | 'upcoming';
  rate?: string;
  user?: User;
}

export interface ProductionCalendarEvent {
  id: number;
  projectId?: number;
  title: string;
  type: 'meeting' | 'shoot' | 'deadline' | 'screening' | 'release' | 'other';
  startDate: string;
  endDate?: string;
  location?: string;
  attendees: string[];
  notes?: string;
  project?: ProductionProject;
}

export class ProductionService {
  // Get production dashboard
  static async getDashboard(): Promise<{
    stats: ProductionStats;
    activeProjects: ProductionProject[];
    recentDeals: ProductionDeal[];
    upcomingEvents: ProductionCalendarEvent[];
    recommendedPitches: Pitch[];
  }> {
    const response = await apiClient.get<{
      success: boolean;
      dashboard: any;
    }>('/api/production/dashboard');

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch dashboard');
    }

    return response.data?.dashboard || {
      stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        inDevelopment: 0,
        totalBudget: 0,
        pitchesReviewed: 0,
        pitchesContracted: 0,
        ndaSigned: 0
      },
      activeProjects: [],
      recentDeals: [],
      upcomingEvents: [],
      recommendedPitches: []
    };
  }

  // Get all projects
  static async getProjects(filters?: {
    status?: string;
    sortBy?: 'startDate' | 'budget' | 'title';
    limit?: number;
    offset?: number;
  }): Promise<{ projects: ProductionProject[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{
      success: boolean;
      projects: ProductionProject[];
      total: number;
    }>(`/api/production/projects?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch projects');
    }

    return {
      projects: response.data?.projects || [],
      total: response.data?.total || 0
    };
  }

  // Create new project from pitch
  static async createProject(data: {
    pitchId: number;
    budget: number;
    startDate: string;
    estimatedEndDate?: string;
    team?: Array<{ role: string; name: string; email?: string }>;
  }): Promise<ProductionProject> {
    const response = await apiClient.post<{
      success: boolean;
      project: ProductionProject;
    }>('/api/production/projects', data);

    if (!response.success || !response.data?.project) {
      throw new Error(response.error?.message || 'Failed to create project');
    }

    return response.data.project;
  }

  // Update project
  static async updateProject(projectId: number, updates: Partial<ProductionProject>): Promise<ProductionProject> {
    const response = await apiClient.put<{
      success: boolean;
      project: ProductionProject;
    }>(`/api/production/projects/${projectId}`, updates);

    if (!response.success || !response.data?.project) {
      throw new Error(response.error?.message || 'Failed to update project');
    }

    return response.data.project;
  }

  // Get deals
  static async getDeals(filters?: {
    status?: string;
    creatorId?: number;
    sortBy?: 'signedAt' | 'amount' | 'expiresAt';
  }): Promise<{ deals: ProductionDeal[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.creatorId) params.append('creatorId', filters.creatorId.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);

    const response = await apiClient.get<{
      success: boolean;
      deals: ProductionDeal[];
      total: number;
    }>(`/api/production/deals?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch deals');
    }

    return {
      deals: response.data?.deals || [],
      total: response.data?.total || 0
    };
  }

  // Propose deal
  static async proposeDeal(data: {
    pitchId: number;
    dealType: 'option' | 'purchase' | 'development' | 'production';
    amount: number;
    royaltyPercentage?: number;
    terms: string;
    expiresAt?: string;
  }): Promise<ProductionDeal> {
    const response = await apiClient.post<{
      success: boolean;
      deal: ProductionDeal;
    }>('/api/production/deals', data);

    if (!response.success || !response.data?.deal) {
      throw new Error(response.error?.message || 'Failed to propose deal');
    }

    return response.data.deal;
  }

  // Search for talent
  static async searchTalent(filters?: {
    role?: string;
    availability?: string;
    maxRate?: number;
    experience?: string;
    search?: string;
  }): Promise<{ talent: TalentSearch[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.availability) params.append('availability', filters.availability);
    if (filters?.maxRate) params.append('maxRate', filters.maxRate.toString());
    if (filters?.experience) params.append('experience', filters.experience);
    if (filters?.search) params.append('search', filters.search);

    const response = await apiClient.get<{
      success: boolean;
      talent: TalentSearch[];
      total: number;
    }>(`/api/production/talent?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to search talent');
    }

    return {
      talent: response.data?.talent || [],
      total: response.data?.total || 0
    };
  }

  // Get calendar events
  static async getCalendarEvents(options?: {
    startDate?: string;
    endDate?: string;
    projectId?: number;
    type?: string;
  }): Promise<ProductionCalendarEvent[]> {
    const params = new URLSearchParams();
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.projectId) params.append('projectId', options.projectId.toString());
    if (options?.type) params.append('type', options.type);

    const response = await apiClient.get<{
      success: boolean;
      events: ProductionCalendarEvent[];
    }>(`/api/production/calendar?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch calendar events');
    }

    return response.data?.events || [];
  }

  // Create calendar event
  static async createCalendarEvent(event: Omit<ProductionCalendarEvent, 'id'>): Promise<ProductionCalendarEvent> {
    const response = await apiClient.post<{
      success: boolean;
      event: ProductionCalendarEvent;
    }>('/api/production/calendar', event);

    if (!response.success || !response.data?.event) {
      throw new Error(response.error?.message || 'Failed to create event');
    }

    return response.data.event;
  }

  // Get budget breakdown
  static async getBudgetBreakdown(projectId: number): Promise<{
    total: number;
    spent: number;
    remaining: number;
    categories: Array<{
      category: string;
      allocated: number;
      spent: number;
      percentage: number;
    }>;
    timeline: Array<{
      date: string;
      amount: number;
      description: string;
    }>;
  }> {
    const response = await apiClient.get<{
      success: boolean;
      budget: any;
    }>(`/api/production/projects/${projectId}/budget`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch budget breakdown');
    }

    return response.data?.budget || {
      total: 0,
      spent: 0,
      remaining: 0,
      categories: [],
      timeline: []
    };
  }

  // Submit milestone update
  static async updateMilestone(projectId: number, milestoneId: number, data: {
    completed?: boolean;
    notes?: string;
  }): Promise<void> {
    const response = await apiClient.put<{ success: boolean }>(
      `/api/production/projects/${projectId}/milestones/${milestoneId}`,
      data
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update milestone');
    }
  }

  // Get production analytics
  static async getAnalytics(period?: 'month' | 'quarter' | 'year'): Promise<{
    projectPerformance: Array<{
      project: string;
      budget: number;
      spent: number;
      progress: number;
      onSchedule: boolean;
    }>;
    genreDistribution: Array<{
      genre: string;
      count: number;
      avgBudget: number;
      avgROI: number;
    }>;
    dealConversionRate: number;
    avgProductionTime: number;
    successRate: number;
  }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<{
      success: boolean;
      analytics: any;
    }>(`/api/production/analytics?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch analytics');
    }

    return response.data?.analytics || {
      projectPerformance: [],
      genreDistribution: [],
      dealConversionRate: 0,
      avgProductionTime: 0,
      successRate: 0
    };
  }

  // Generate contract
  static async generateContract(dealId: number, template?: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/production/deals/${dealId}/contract?template=${template || 'standard'}`, {
        headers: {
          }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate contract');
    }

    return response.blob();
  }

  // Get distribution channels
  static async getDistributionChannels(projectId: number): Promise<Array<{
    id: number;
    platform: string;
    status: 'negotiating' | 'signed' | 'live' | 'ended';
    terms: string;
    revenue: number;
    releaseDate?: string;
  }>> {
    const response = await apiClient.get<{
      success: boolean;
      channels: any[];
    }>(`/api/production/projects/${projectId}/distribution`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch distribution channels');
    }

    return response.data?.channels || [];
  }

  // Export project data
  static async exportProjectData(projectId: number, format: 'pdf' | 'excel'): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/production/projects/${projectId}/export?format=${format}`, {
        headers: {
          }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export project data');
    }

    return response.blob();
  }
}

// Export singleton instance
export const productionService = ProductionService;
