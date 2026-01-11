import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  AlertTriangle,
  FileText,
  Eye,
  Zap,
  Target,
  Award,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { useToast } from '../Toast/ToastProvider';
import { ndaService } from '../../services/nda.service';

interface NDAAnalyticsProps {
  userId: number;
  userRole: 'creator' | 'investor' | 'production';
  timeframe?: '7d' | '30d' | '90d' | '1y';
}

interface AnalyticsData {
  overview: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    signed: number;
    expired: number;
    revoked: number;
    approvalRate: number;
    completionRate: number;
    avgResponseTime: number;
    trend: {
      total: number;
      approvalRate: number;
      responseTime: number;
    };
  };
  timeSeriesData: Array<{
    date: string;
    requests: number;
    approvals: number;
    rejections: number;
    signed: number;
    avgResponseTime: number;
  }>;
  pitchBreakdown: Array<{
    pitchTitle: string;
    totalRequests: number;
    approvals: number;
    rejections: number;
    approvalRate: number;
  }>;
  requesterTypes: Array<{
    type: string;
    count: number;
    approvalRate: number;
    avgResponseTime: number;
  }>;
  urgencyMetrics: {
    high: { count: number; avgResponseTime: number; approvalRate: number };
    medium: { count: number; avgResponseTime: number; approvalRate: number };
    low: { count: number; avgResponseTime: number; approvalRate: number };
  };
  geographicData: Array<{
    region: string;
    requests: number;
    approvalRate: number;
  }>;
}

const COLORS = {
  primary: '#8B5CF6',
  secondary: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#6B7280'
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.warning, COLORS.danger];

export default function NDAAnalytics({ userId, userRole, timeframe = '30d' }: NDAAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'breakdowns' | 'performance'>('overview');
  const [exportLoading, setExportLoading] = useState(false);
  
  const { success, error } = useToast();

  useEffect(() => {
    loadAnalyticsData();
  }, [userId, selectedTimeframe]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch analytics data from the API
      const analyticsResponse = await ndaService.getNDAAnalytics(selectedTimeframe);
      
      // Generate mock time series and breakdown data for demo
      const demoData: AnalyticsData = {
        overview: {
          total: analyticsResponse.total || 15,
          pending: analyticsResponse.pending || 3,
          approved: analyticsResponse.approved || 7,
          rejected: analyticsResponse.rejected || 2,
          signed: analyticsResponse.signed || 3,
          expired: analyticsResponse.expired || 0,
          revoked: analyticsResponse.revoked || 0,
          approvalRate: analyticsResponse.approvalRate || 70,
          completionRate: analyticsResponse.completionRate || 43,
          avgResponseTime: 2.3,
          trend: {
            total: 15,
            approvalRate: 8,
            responseTime: -12
          }
        },
        timeSeriesData: generateTimeSeriesData(selectedTimeframe),
        pitchBreakdown: [
          { pitchTitle: 'Stellar Horizons', totalRequests: 8, approvals: 6, rejections: 2, approvalRate: 75 },
          { pitchTitle: 'Urban Legends', totalRequests: 5, approvals: 3, rejections: 1, approvalRate: 60 },
          { pitchTitle: 'Future Past', totalRequests: 3, approvals: 2, rejections: 1, approvalRate: 67 },
          { pitchTitle: 'Ocean Deep', totalRequests: 4, approvals: 3, rejections: 0, approvalRate: 75 },
          { pitchTitle: 'Mind Games', totalRequests: 2, approvals: 1, rejections: 1, approvalRate: 50 }
        ],
        requesterTypes: [
          { type: 'investor', count: 12, approvalRate: 75, avgResponseTime: 2.1 },
          { type: 'production', count: 8, approvalRate: 62, avgResponseTime: 3.2 },
          { type: 'distributor', count: 3, approvalRate: 100, avgResponseTime: 1.5 },
          { type: 'talent', count: 2, approvalRate: 50, avgResponseTime: 4.0 }
        ],
        urgencyMetrics: {
          high: { count: 4, avgResponseTime: 1.2, approvalRate: 100 },
          medium: { count: 8, avgResponseTime: 2.1, approvalRate: 75 },
          low: { count: 13, avgResponseTime: 3.8, approvalRate: 62 }
        },
        geographicData: [
          { region: 'North America', requests: 18, approvalRate: 72 },
          { region: 'Europe', requests: 5, approvalRate: 80 },
          { region: 'Asia Pacific', requests: 2, approvalRate: 50 }
        ]
      };
      
      setData(demoData);
      
    } catch (err) {
      console.error('Failed to load analytics:', err);
      error('Loading Failed', 'Unable to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSeriesData = (timeframe: string) => {
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        date: format(date, 'MMM dd'),
        requests: Math.floor(Math.random() * 5) + 1,
        approvals: Math.floor(Math.random() * 3) + 1,
        rejections: Math.floor(Math.random() * 2),
        signed: Math.floor(Math.random() * 2),
        avgResponseTime: Math.random() * 5 + 1
      });
    }
    
    return data;
  };

  const handleExportReport = async () => {
    try {
      setExportLoading(true);
      
      if (!data) return;
      
      const reportData = {
        generatedAt: new Date().toISOString(),
        timeframe: selectedTimeframe,
        overview: data.overview,
        breakdown: data.pitchBreakdown,
        requesterAnalysis: data.requesterTypes,
        trends: data.timeSeriesData
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA_Analytics_${selectedTimeframe}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      success('Report Exported', 'Analytics report has been downloaded successfully.');
    } catch (err) {
      error('Export Failed', 'Unable to export report. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color = 'blue',
    suffix = '',
    trend 
  }: { 
    title: string; 
    value: string | number; 
    change?: number; 
    icon: React.ComponentType<{ className?: string }>; 
    color?: string;
    suffix?: string;
    trend?: 'up' | 'down' | 'neutral';
  }) => {
    const getTrendIcon = () => {
      if (trend === 'up') return <ArrowUp className="w-3 h-3" />;
      if (trend === 'down') return <ArrowDown className="w-3 h-3" />;
      return <Minus className="w-3 h-3" />;
    };

    const getTrendColor = () => {
      if (trend === 'up') return 'text-green-600';
      if (trend === 'down') return 'text-red-600';
      return 'text-gray-600';
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}{suffix}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="text-sm font-medium">{Math.abs(change)}%</span>
                <span className="text-xs text-gray-500">vs prev period</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Analytics Data</h3>
        <p className="text-gray-500">Analytics data will appear here once you have NDA activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NDA Analytics</h1>
            <p className="text-gray-500">
              {userRole === 'creator' 
                ? 'Analyze your NDA request patterns and response metrics'
                : 'Track your NDA requests and approval success rates'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button
            onClick={handleExportReport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportLoading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'breakdowns', label: 'Breakdowns', icon: Target },
            { id: 'performance', label: 'Performance', icon: Award }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total NDAs"
              value={data.overview.total}
              change={data.overview.trend.total}
              trend={data.overview.trend.total > 0 ? 'up' : data.overview.trend.total < 0 ? 'down' : 'neutral'}
              icon={Shield}
              color="blue"
            />
            
            <MetricCard
              title="Approval Rate"
              value={data.overview.approvalRate}
              change={data.overview.trend.approvalRate}
              trend={data.overview.trend.approvalRate > 0 ? 'up' : 'down'}
              icon={CheckCircle}
              color="green"
              suffix="%"
            />
            
            <MetricCard
              title="Completion Rate"
              value={data.overview.completionRate}
              icon={Award}
              color="purple"
              suffix="%"
            />
            
            <MetricCard
              title="Avg Response Time"
              value={data.overview.avgResponseTime}
              change={data.overview.trend.responseTime}
              trend={data.overview.trend.responseTime < 0 ? 'up' : 'down'}
              icon={Clock}
              color="orange"
              suffix="d"
            />
          </div>

          {/* Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">NDA Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Approved', value: data.overview.approved, color: COLORS.success },
                        { name: 'Pending', value: data.overview.pending, color: COLORS.warning },
                        { name: 'Rejected', value: data.overview.rejected, color: COLORS.danger },
                        { name: 'Signed', value: data.overview.signed, color: COLORS.primary },
                        { name: 'Expired', value: data.overview.expired, color: COLORS.neutral }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {PIE_COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Pending Reviews</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{data.overview.pending}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900">Urgent Requests</span>
                  </div>
                  <span className="text-2xl font-bold text-yellow-600">{data.urgencyMetrics.high.count}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Success Rate</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">{data.overview.approvalRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">NDA Request Trends</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeSeriesData}>
                  <defs>
                    <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke={COLORS.primary}
                    fillOpacity={1}
                    fill="url(#requestsGradient)"
                    name="Total Requests"
                  />
                  <Area
                    type="monotone"
                    dataKey="approvals"
                    stroke={COLORS.success}
                    fill="none"
                    name="Approvals"
                  />
                  <Area
                    type="monotone"
                    dataKey="rejections"
                    stroke={COLORS.danger}
                    fill="none"
                    name="Rejections"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke={COLORS.warning}
                    strokeWidth={3}
                    name="Avg Response Time (days)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'breakdowns' && (
        <div className="space-y-6">
          {/* Pitch Performance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Pitch</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pitchBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pitchTitle" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalRequests" fill={COLORS.primary} name="Total Requests" />
                  <Bar dataKey="approvals" fill={COLORS.success} name="Approvals" />
                  <Bar dataKey="rejections" fill={COLORS.danger} name="Rejections" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Requester Type Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Requests by Type</h3>
              <div className="space-y-4">
                {data.requesterTypes.map((type, index) => (
                  <div key={type.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 capitalize">{type.type}</div>
                      <div className="text-sm text-gray-500">{type.count} requests</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{type.approvalRate}%</div>
                      <div className="text-sm text-gray-500">{type.avgResponseTime}d avg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Urgency Analysis</h3>
              <div className="space-y-4">
                {Object.entries(data.urgencyMetrics).map(([priority, metrics]) => (
                  <div key={priority} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 capitalize">{priority} Priority</div>
                      <div className="text-sm text-gray-500">{metrics.count} requests</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{metrics.approvalRate}%</div>
                      <div className="text-sm text-gray-500">{metrics.avgResponseTime}d avg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-3">Top Performing Pitch</h4>
              <div className="space-y-2">
                <div className="font-medium text-purple-600">{data.pitchBreakdown[0]?.pitchTitle}</div>
                <div className="text-2xl font-bold text-gray-900">{data.pitchBreakdown[0]?.approvalRate}%</div>
                <div className="text-sm text-gray-500">{data.pitchBreakdown[0]?.totalRequests} requests</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-3">Fastest Response</h4>
              <div className="space-y-2">
                <div className="font-medium text-green-600">High Priority</div>
                <div className="text-2xl font-bold text-gray-900">{data.urgencyMetrics.high.avgResponseTime}d</div>
                <div className="text-sm text-gray-500">Average response time</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-3">Best Approval Rate</h4>
              <div className="space-y-2">
                <div className="font-medium text-blue-600">Distributors</div>
                <div className="text-2xl font-bold text-gray-900">
                  {data.requesterTypes.find(r => r.type === 'distributor')?.approvalRate || 0}%
                </div>
                <div className="text-sm text-gray-500">Approval success rate</div>
              </div>
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Strengths</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>High priority requests processed quickly ({data.urgencyMetrics.high.avgResponseTime}d avg)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Strong overall approval rate ({data.overview.approvalRate}%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Consistent completion rate for approved NDAs</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Opportunities</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span>Reduce response time for medium priority requests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span>Improve approval rate for production company requests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span>Consider automated approval for recurring requesters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}