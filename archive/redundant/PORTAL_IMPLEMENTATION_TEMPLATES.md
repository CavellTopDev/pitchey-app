# Portal Implementation Templates

## Production Portal Templates

### ProductionLogin.tsx Template
```typescript
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Film, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import { useLoadingState } from '../hooks/useLoadingState';
import { clearAuthenticationState } from '../utils/auth';

export default function ProductionLogin() {
  const navigate = useNavigate();
  const { loginProduction, error, loading: storeLoading } = useAuthStore();
  const { loading, setLoading, clearLoading, loadingMessage } = useLoadingState({
    timeout: 15000,
    onTimeout: () => {
      console.error('Login timeout - clearing state');
      clearAuthenticationState();
    }
  });
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Clean up loading state on unmount
  useEffect(() => {
    return () => {
      clearLoading();
    };
  }, [clearLoading]);

  // Sync store loading with local loading state
  useEffect(() => {
    if (!storeLoading) {
      clearLoading();
    }
  }, [storeLoading, clearLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('logging-in', 'Authenticating production company account...');
    
    try {
      await loginProduction(formData.email, formData.password);
      // Small delay for state propagation
      setTimeout(() => {
        clearLoading();
        navigate('/production/dashboard');
      }, 100);
    } catch (error) {
      console.error('Production login failed:', error);
      clearLoading();
    }
  };

  const setDemoCredentials = () => {
    setFormData({ 
      email: 'stellar.production@demo.com', 
      password: 'Demo123' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Rest of component following InvestorLogin pattern */}
      {/* Change colors to purple/indigo theme */}
      {/* Use Film icon instead of DollarSign */}
    </div>
  );
}
```

### production.service.ts Template
```typescript
import api from './api';
import { safeNumber } from '../utils/formatters';

export interface ProductionStats {
  activeProjects: number;
  totalBudget: number;
  inProduction: number;
  completedProjects: number;
  averageBudget: number;
  totalRevenue: number;
}

export interface Project {
  id: string;
  pitchId: string;
  title: string;
  status: 'pre-production' | 'production' | 'post-production' | 'completed';
  budget: number;
  startDate: string;
  endDate?: string;
  crew: CrewMember[];
  milestones: Milestone[];
}

export interface CrewRequest {
  id: string;
  projectId: string;
  role: string;
  requirements: string[];
  budget: number;
  status: 'open' | 'filled' | 'cancelled';
}

class ProductionService {
  private readonly API_PREFIX = '/api/production';

  async getStats() {
    try {
      const response = await api.get(`${this.API_PREFIX}/stats`);
      return {
        success: true,
        data: {
          activeProjects: safeNumber(response.data?.activeProjects, 0),
          totalBudget: safeNumber(response.data?.totalBudget, 0),
          inProduction: safeNumber(response.data?.inProduction, 0),
          completedProjects: safeNumber(response.data?.completedProjects, 0),
          averageBudget: safeNumber(response.data?.averageBudget, 0),
          totalRevenue: safeNumber(response.data?.totalRevenue, 0),
        }
      };
    } catch (error) {
      console.error('Failed to fetch production stats:', error);
      return { success: false, data: null, error: error.message };
    }
  }

  async getProjects() {
    try {
      const response = await api.get(`${this.API_PREFIX}/projects`);
      return { 
        success: true, 
        data: response.data || [] 
      };
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getProductionSchedule() {
    try {
      const response = await api.get(`${this.API_PREFIX}/schedule`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async getCrewRequests() {
    try {
      const response = await api.get(`${this.API_PREFIX}/crew-requests`);
      return { success: true, data: response.data || [] };
    } catch (error) {
      return { success: false, data: [], error: error.message };
    }
  }

  async getBudgetAnalytics() {
    try {
      const response = await api.get(`${this.API_PREFIX}/analytics/budget`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async getDistributionDeals() {
    try {
      const response = await api.get(`${this.API_PREFIX}/distribution`);
      return { success: true, data: response.data || [] };
    } catch (error) {
      return { success: false, data: [], error: error.message };
    }
  }

  async updateProjectStatus(projectId: string, status: string) {
    try {
      const response = await api.put(`${this.API_PREFIX}/projects/${projectId}/status`, { status });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }
}

export const productionService = new ProductionService();
```

### ProductionDashboard.tsx Template
```typescript
import React, { useState, useEffect } from 'react';
import { Film, DollarSign, Users, Calendar, TrendingUp, Clock } from 'lucide-react';
import { productionService } from '../services/production.service';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useLoadingState } from '../hooks/useLoadingState';

export default function ProductionDashboard() {
  const { loading, setLoading, clearLoading } = useLoadingState();
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalBudget: 0,
    inProduction: 0,
    completedProjects: 0,
    averageBudget: 0,
    totalRevenue: 0
  });
  const [projects, setProjects] = useState([]);
  const [crewRequests, setCrewRequests] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading('loading-data', 'Loading production dashboard...');
    
    try {
      const [statsRes, projectsRes, crewRes] = await Promise.all([
        productionService.getStats(),
        productionService.getProjects(),
        productionService.getCrewRequests()
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }
      
      if (projectsRes.success) {
        setProjects(projectsRes.data);
      }
      
      if (crewRes.success) {
        setCrewRequests(crewRes.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      clearLoading();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Production Dashboard</h1>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Active Projects */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.activeProjects)}
                </p>
              </div>
              <Film className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          {/* Total Budget */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalBudget)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          {/* In Production */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Production</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.inProduction)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Active Projects</h2>
          </div>
          <div className="divide-y">
            {projects.map(project => (
              <div key={project.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.title}</h3>
                    <p className="text-sm text-gray-500">Status: {project.status}</p>
                    <p className="text-sm text-gray-500">
                      Budget: {formatCurrency(project.budget)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    project.status === 'production' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Creator Portal Templates

### CreatorLogin.tsx Template
```typescript
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PenTool, LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';
import { useLoadingState } from '../hooks/useLoadingState';
import { clearAuthenticationState } from '../utils/auth';

export default function CreatorLogin() {
  const navigate = useNavigate();
  const { loginCreator, error, loading: storeLoading } = useAuthStore();
  const { loading, setLoading, clearLoading, loadingMessage } = useLoadingState({
    timeout: 15000,
    onTimeout: () => {
      console.error('Login timeout - clearing state');
      clearAuthenticationState();
    }
  });
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('logging-in', 'Authenticating creator account...');
    
    try {
      await loginCreator(formData.email, formData.password);
      setTimeout(() => {
        clearLoading();
        navigate('/creator/dashboard');
      }, 100);
    } catch (error) {
      console.error('Creator login failed:', error);
      clearLoading();
    }
  };

  const setDemoCredentials = () => {
    setFormData({ 
      email: 'alex.creator@demo.com', 
      password: 'Demo123' 
    });
  };

  // Component structure similar to InvestorLogin
  // Use blue/cyan color scheme
  // Use PenTool icon
}
```

### creator.service.ts Template
```typescript
import api from './api';
import { safeNumber } from '../utils/formatters';

export interface CreatorStats {
  totalPitches: number;
  publishedPitches: number;
  draftPitches: number;
  totalViews: number;
  savedByInvestors: number;
  activeNDAs: number;
  totalRevenue: number;
  averageRating: number;
}

export interface PitchAnalytics {
  pitchId: string;
  views: number;
  uniqueViewers: number;
  saves: number;
  ndaRequests: number;
  investments: number;
  viewsOverTime: { date: string; count: number }[];
  topReferrers: { source: string; count: number }[];
}

export interface NDARequest {
  id: string;
  pitchId: string;
  pitchTitle: string;
  requesterId: string;
  requesterName: string;
  requesterType: 'investor' | 'production';
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  message?: string;
}

class CreatorService {
  private readonly API_PREFIX = '/api/creator';

  async getStats() {
    try {
      const response = await api.get(`${this.API_PREFIX}/stats`);
      return {
        success: true,
        data: {
          totalPitches: safeNumber(response.data?.totalPitches, 0),
          publishedPitches: safeNumber(response.data?.publishedPitches, 0),
          draftPitches: safeNumber(response.data?.draftPitches, 0),
          totalViews: safeNumber(response.data?.totalViews, 0),
          savedByInvestors: safeNumber(response.data?.savedByInvestors, 0),
          activeNDAs: safeNumber(response.data?.activeNDAs, 0),
          totalRevenue: safeNumber(response.data?.totalRevenue, 0),
          averageRating: safeNumber(response.data?.averageRating, 0),
        }
      };
    } catch (error) {
      console.error('Failed to fetch creator stats:', error);
      return { success: false, data: null, error: error.message };
    }
  }

  async getMyPitches() {
    try {
      const response = await api.get(`${this.API_PREFIX}/pitches`);
      return { 
        success: true, 
        data: response.data || [] 
      };
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      return { success: false, data: [], error: error.message };
    }
  }

  async getPitchAnalytics(pitchId: string) {
    try {
      const response = await api.get(`${this.API_PREFIX}/pitches/${pitchId}/analytics`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async getNDARequests() {
    try {
      const response = await api.get(`${this.API_PREFIX}/nda-requests`);
      return { success: true, data: response.data || [] };
    } catch (error) {
      return { success: false, data: [], error: error.message };
    }
  }

  async handleNDARequest(requestId: string, action: 'approve' | 'deny') {
    try {
      const response = await api.post(`${this.API_PREFIX}/nda-requests/${requestId}`, { action });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async getRevenue() {
    try {
      const response = await api.get(`${this.API_PREFIX}/revenue`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async createPitch(pitchData: any) {
    try {
      const response = await api.post(`${this.API_PREFIX}/pitches`, pitchData);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async updatePitch(pitchId: string, updates: any) {
    try {
      const response = await api.put(`${this.API_PREFIX}/pitches/${pitchId}`, updates);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  }

  async deletePitch(pitchId: string) {
    try {
      await api.delete(`${this.API_PREFIX}/pitches/${pitchId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export const creatorService = new CreatorService();
```

### CreatorDashboard.tsx Template
```typescript
import React, { useState, useEffect } from 'react';
import { PenTool, Eye, Heart, Shield, TrendingUp, DollarSign } from 'lucide-react';
import { creatorService } from '../services/creator.service';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';
import { useLoadingState } from '../hooks/useLoadingState';
import { Link } from 'react-router-dom';

export default function CreatorDashboard() {
  const { loading, setLoading, clearLoading } = useLoadingState();
  const [stats, setStats] = useState({
    totalPitches: 0,
    publishedPitches: 0,
    draftPitches: 0,
    totalViews: 0,
    savedByInvestors: 0,
    activeNDAs: 0,
    totalRevenue: 0,
    averageRating: 0
  });
  const [pitches, setPitches] = useState([]);
  const [ndaRequests, setNdaRequests] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading('loading-data', 'Loading creator dashboard...');
    
    try {
      const [statsRes, pitchesRes, ndaRes] = await Promise.all([
        creatorService.getStats(),
        creatorService.getMyPitches(),
        creatorService.getNDARequests()
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }
      
      if (pitchesRes.success) {
        setPitches(pitchesRes.data);
      }
      
      if (ndaRes.success) {
        setNdaRequests(ndaRes.data.filter(nda => nda.status === 'pending'));
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      clearLoading();
    }
  };

  const handleNDAAction = async (requestId: string, action: 'approve' | 'deny') => {
    const result = await creatorService.handleNDARequest(requestId, action);
    if (result.success) {
      // Refresh NDA requests
      const ndaRes = await creatorService.getNDARequests();
      if (ndaRes.success) {
        setNdaRequests(ndaRes.data.filter(nda => nda.status === 'pending'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Creator Dashboard</h1>
            <Link
              to="/creator/pitch/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PenTool className="h-4 w-4" />
              New Pitch
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Views */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.totalViews)}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          {/* Saved by Investors */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saved by Investors</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.savedByInvestors)}
                </p>
              </div>
              <Heart className="h-8 w-8 text-red-500" />
            </div>
          </div>

          {/* Active NDAs */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active NDAs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.activeNDAs)}
                </p>
              </div>
              <Shield className="h-8 w-8 text-green-500" />
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Pitches */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">My Pitches</h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {pitches.map(pitch => (
                <div key={pitch.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{pitch.title}</h3>
                      <p className="text-sm text-gray-500">{pitch.genre} • {pitch.status}</p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatNumber(pitch.views)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {formatNumber(pitch.saves)}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/creator/pitch/${pitch.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending NDA Requests */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Pending NDA Requests
                {ndaRequests.length > 0 && (
                  <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full">
                    {ndaRequests.length}
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {ndaRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No pending NDA requests
                </div>
              ) : (
                ndaRequests.map(request => (
                  <div key={request.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{request.requesterName}</p>
                        <p className="text-sm text-gray-500">
                          For: {request.pitchTitle}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        request.requesterType === 'investor'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {request.requesterType}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleNDAAction(request.id, 'approve')}
                        className="flex-1 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleNDAAction(request.id, 'deny')}
                        className="flex-1 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Cross-Portal WebSocket Events Template

```typescript
// src/services/websocket/portal-events.ts

export const PORTAL_EVENTS = {
  // Creator Events
  creator: {
    // Incoming
    NEW_VIEW: 'pitch.view',
    NEW_SAVE: 'pitch.saved',
    NDA_REQUEST: 'nda.request',
    NDA_APPROVED: 'nda.approved',
    NDA_DENIED: 'nda.denied',
    INVESTMENT_RECEIVED: 'investment.received',
    PRODUCTION_INTEREST: 'production.interest',
    RATING_RECEIVED: 'pitch.rated',
    
    // Outgoing
    PITCH_CREATED: 'pitch.created',
    PITCH_UPDATED: 'pitch.updated',
    PITCH_DELETED: 'pitch.deleted',
    NDA_RESPONSE: 'nda.response'
  },

  // Investor Events
  investor: {
    // Incoming
    PITCH_CREATED: 'pitch.created',
    PITCH_UPDATED: 'pitch.updated',
    NDA_APPROVED: 'nda.approved',
    NDA_DENIED: 'nda.denied',
    INVESTMENT_UPDATE: 'investment.update',
    ROI_UPDATE: 'roi.update',
    NEW_MATCH: 'pitch.matched',
    
    // Outgoing
    REQUEST_NDA: 'nda.request',
    SAVE_PITCH: 'pitch.save',
    UNSAVE_PITCH: 'pitch.unsave',
    INVEST: 'investment.create',
    MESSAGE_CREATOR: 'message.send'
  },

  // Production Events
  production: {
    // Incoming
    PROJECT_FUNDED: 'project.funded',
    CREW_AVAILABLE: 'crew.available',
    PITCH_APPROVED: 'pitch.approved',
    BUDGET_APPROVED: 'budget.approved',
    DISTRIBUTION_OFFER: 'distribution.offer',
    
    // Outgoing
    EXPRESS_INTEREST: 'production.interest',
    REQUEST_CREW: 'crew.request',
    UPDATE_PROJECT: 'project.update',
    GREENLIGHT_PROJECT: 'project.greenlight'
  },

  // Shared Events (all portals)
  shared: {
    CONNECTION_ESTABLISHED: 'connection.established',
    CONNECTION_LOST: 'connection.lost',
    NOTIFICATION: 'notification.new',
    MESSAGE_RECEIVED: 'message.received',
    USER_ONLINE: 'user.online',
    USER_OFFLINE: 'user.offline'
  }
};

// WebSocket event router
export class PortalEventRouter {
  private userType: 'creator' | 'investor' | 'production';
  private handlers: Map<string, Function[]> = new Map();

  constructor(userType: string) {
    this.userType = userType as any;
  }

  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)?.push(handler);
  }

  emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  getPortalEvents() {
    return {
      ...PORTAL_EVENTS[this.userType],
      ...PORTAL_EVENTS.shared
    };
  }
}
```

This comprehensive template system provides everything needed to implement consistent portal patterns across the entire application.