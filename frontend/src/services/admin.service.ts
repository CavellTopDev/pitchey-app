import type { ApiResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Helper function to get auth headers
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }
  return response.json();
};

export interface DashboardStats {
  totalUsers: number;
  totalPitches: number;
  totalRevenue: number;
  pendingNDAs: number;
  activeUsers: number;
  recentSignups: number;
  approvedPitches: number;
  rejectedPitches: number;
}

export interface RecentActivity {
  id: string;
  type: 'user_signup' | 'pitch_created' | 'nda_signed' | 'payment_received';
  description: string;
  timestamp: string;
  user?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  userType: 'creator' | 'investor' | 'production' | 'admin';
  credits: number;
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  lastLogin: string | null;
  pitchCount: number;
  investmentCount: number;
}

export interface AdminPitch {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  budget: number;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  createdAt: string;
  moderationNotes?: string;
  flaggedReasons?: string[];
  documents?: Array<{
    id: string;
    filename: string;
    type: string;
  }>;
}

export interface AdminTransaction {
  id: string;
  type: 'payment' | 'refund' | 'credit_purchase' | 'subscription' | 'commission';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
  };
  description: string;
  paymentMethod?: string;
  stripeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  refundableAmount?: number;
  metadata?: {
    pitchId?: string;
    pitchTitle?: string;
    subscriptionPlan?: string;
  };
}

export interface SystemSettings {
  maintenance: {
    enabled: boolean;
    message: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  };
  features: {
    userRegistration: boolean;
    pitchSubmission: boolean;
    payments: boolean;
    messaging: boolean;
    ndaWorkflow: boolean;
    realTimeUpdates: boolean;
  };
  limits: {
    maxPitchesPerUser: number;
    maxFileUploadSize: number;
    maxDocumentsPerPitch: number;
    sessionTimeout: number;
  };
  pricing: {
    creditPrices: {
      single: number;
      pack5: number;
      pack10: number;
      pack25: number;
    };
    subscriptionPlans: {
      basic: { monthly: number; yearly: number };
      premium: { monthly: number; yearly: number };
      enterprise: { monthly: number; yearly: number };
    };
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    weeklyDigest: boolean;
  };
  security: {
    enforceStrongPasswords: boolean;
    twoFactorRequired: boolean;
    sessionSecurity: 'normal' | 'strict';
    apiRateLimit: number;
  };
}

export interface UserFilters {
  search?: string;
  userType?: string;
  status?: string;
  sortBy?: 'createdAt' | 'lastLogin' | 'name' | 'credits';
  sortOrder?: 'asc' | 'desc';
}

export interface PitchFilters {
  status?: string;
  genre?: string;
  sortBy?: 'createdAt' | 'title' | 'budget';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilters {
  type?: string;
  status?: string;
  userType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

class AdminService {
  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<DashboardStats>(response);
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<RecentActivity[]>(response);
  }

  // User Management
  async getUsers(filters: UserFilters = {}): Promise<AdminUser[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<AdminUser[]>(response);
  }

  async updateUser(userId: string, updates: Partial<AdminUser>): Promise<AdminUser> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<AdminUser>(response);
  }

  // Content Moderation
  async getPitches(filters: PitchFilters = {}): Promise<AdminPitch[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<AdminPitch[]>(response);
  }

  async approvePitch(pitchId: string, notes?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  async rejectPitch(pitchId: string, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  async flagPitch(pitchId: string, reasons: string[], notes: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reasons, notes }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  // Transaction Management
  async getTransactions(filters: TransactionFilters = {}): Promise<AdminTransaction[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<AdminTransaction[]>(response);
  }

  async processRefund(transactionId: string, amount: number, reason: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<SystemSettings>(response);
  }

  async updateSystemSettings(settings: SystemSettings): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  // Analytics
  async getAnalytics(timeframe: '24h' | '7d' | '30d' | '90d' = '30d'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<any>(response);
  }

  // System Health
  async getSystemHealth(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });
    return handleResponse<any>(response);
  }

  // Bulk Operations
  async bulkUpdateUsers(userIds: string[], updates: Partial<AdminUser>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, updates }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  async bulkModeratePitches(pitchIds: string[], action: 'approve' | 'reject' | 'flag', data?: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pitchIds, action, data }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    await handleResponse<void>(response);
  }

  // Export Data
  async exportUsers(filters: UserFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to export users');
    }

    return response.blob();
  }

  async exportTransactions(filters: TransactionFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value.toString());
    });

    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to export transactions');
    }

    return response.blob();
  }
}

export const adminService = new AdminService();
