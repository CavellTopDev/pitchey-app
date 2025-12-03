/**
 * GDPR Compliance Dashboard
 * Administrative dashboard for monitoring GDPR compliance and handling data subject requests
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, Download, Trash2, Edit, Users, FileText, 
  AlertTriangle, CheckCircle, Clock, BarChart3, 
  Calendar, Search, Filter, RefreshCw, Eye,
  UserX, Mail, Lock
} from 'lucide-react';

interface DataSubjectRequest {
  id: string;
  userId: string;
  userEmail: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestDate: Date;
  completionDate?: Date;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

interface ComplianceMetrics {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  averageResponseTime: number;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ConsentMetrics {
  totalUsers: number;
  consentRates: {
    functional: number;
    analytics: number;
    marketing: number;
  };
  withdrawalRates: {
    functional: number;
    analytics: number;
    marketing: number;
  };
}

const GDPRComplianceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'consents' | 'reports'>('overview');
  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [consentMetrics, setConsentMetrics] = useState<ConsentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load compliance metrics
      const metricsResponse = await fetch('/api/gdpr/metrics');
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Load data subject requests
      const requestsResponse = await fetch('/api/gdpr/requests');
      const requestsData = await requestsResponse.json();
      setRequests(requestsData);

      // Load consent metrics
      const consentResponse = await fetch('/api/gdpr/consent-metrics');
      const consentData = await consentResponse.json();
      setConsentMetrics(consentData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'pending': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'rejected': return <UserX className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'access': return <Eye className="h-4 w-4" />;
      case 'rectification': return <Edit className="h-4 w-4" />;
      case 'erasure': return <Trash2 className="h-4 w-4" />;
      case 'portability': return <Download className="h-4 w-4" />;
      case 'restriction': return <Lock className="h-4 w-4" />;
      case 'objection': return <UserX className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesType = typeFilter === 'all' || request.requestType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalRequests || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Requests</p>
              <p className="text-2xl font-bold text-yellow-600">{metrics?.pendingRequests || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
              <p className="text-2xl font-bold text-green-600">{metrics?.averageResponseTime || 0}h</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Compliance Score</p>
              <p className="text-2xl font-bold text-blue-600">{metrics?.complianceScore || 0}%</p>
            </div>
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Compliance Status */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Data Processing</span>
            </div>
            <p className="text-sm text-gray-600">All processing activities documented and lawful basis established</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Consent Management</span>
            </div>
            <p className="text-sm text-gray-600">Granular consent system with withdrawal mechanisms in place</p>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-gray-900">Data Retention</span>
            </div>
            <p className="text-sm text-gray-600">Review retention policies for old user accounts</p>
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Data Subject Requests</h3>
        
        <div className="space-y-3">
          {requests.slice(0, 5).map(request => (
            <div key={request.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
              <div className="flex items-center gap-3">
                {getRequestTypeIcon(request.requestType)}
                <div>
                  <p className="font-medium text-gray-900 capitalize">{request.requestType} Request</p>
                  <p className="text-sm text-gray-600">{request.userEmail}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(request.priority)}`}>
                  {request.priority}
                </span>
                {getStatusIcon(request.status)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="access">Access</option>
            <option value="rectification">Rectification</option>
            <option value="erasure">Erasure</option>
            <option value="portability">Portability</option>
            <option value="restriction">Restriction</option>
            <option value="objection">Objection</option>
          </select>
          
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map(request => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getRequestTypeIcon(request.requestType)}
                      <div>
                        <p className="font-medium text-gray-900 capitalize">{request.requestType}</p>
                        <p className="text-sm text-gray-500">{request.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{request.userEmail}</p>
                    <p className="text-sm text-gray-500">{request.userId}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.requestDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(request.status)}
                      <span className="text-sm text-gray-900 capitalize">{request.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:text-blue-900">View</button>
                      <button className="text-green-600 hover:text-green-900">Process</button>
                      <button className="text-red-600 hover:text-red-900">Close</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderConsents = () => (
    <div className="space-y-6">
      {/* Consent Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Consent Rates</h3>
          <div className="space-y-4">
            {consentMetrics && Object.entries(consentMetrics.consentRates).map(([type, rate]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12">{rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdrawal Rates</h3>
          <div className="space-y-4">
            {consentMetrics && Object.entries(consentMetrics.withdrawalRates).map(([type, rate]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12">{rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Total Users */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">User Consent Status</h3>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-gray-600">{consentMetrics?.totalUsers || 0} Total Users</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {Math.round((consentMetrics?.consentRates.functional || 0) * (consentMetrics?.totalUsers || 0) / 100)}
            </p>
            <p className="text-sm text-gray-600">Functional Consent</p>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">
              {Math.round((consentMetrics?.consentRates.analytics || 0) * (consentMetrics?.totalUsers || 0) / 100)}
            </p>
            <p className="text-sm text-gray-600">Analytics Consent</p>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">
              {Math.round((consentMetrics?.consentRates.marketing || 0) * (consentMetrics?.totalUsers || 0) / 100)}
            </p>
            <p className="text-sm text-gray-600">Marketing Consent</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Reports</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <button className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Monthly Compliance Report</h4>
                  <p className="text-sm text-gray-600">Data subject requests, response times, compliance metrics</p>
                </div>
                <Download className="h-5 w-5 text-gray-400" />
              </div>
            </button>
            
            <button className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Consent Analytics Report</h4>
                  <p className="text-sm text-gray-600">Consent rates, withdrawal patterns, compliance trends</p>
                </div>
                <Download className="h-5 w-5 text-gray-400" />
              </div>
            </button>
          </div>
          
          <div className="space-y-4">
            <button className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Data Processing Inventory</h4>
                  <p className="text-sm text-gray-600">Complete inventory of all data processing activities</p>
                </div>
                <Download className="h-5 w-5 text-gray-400" />
              </div>
            </button>
            
            <button className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Privacy Impact Assessment</h4>
                  <p className="text-sm text-gray-600">Risk assessment and mitigation measures</p>
                </div>
                <Download className="h-5 w-5 text-gray-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">GDPR Compliance Dashboard</h1>
        <p className="text-gray-600">Monitor data protection compliance and manage data subject requests</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'requests', label: 'Data Requests', icon: FileText },
            { key: 'consents', label: 'Consent Management', icon: Shield },
            { key: 'reports', label: 'Reports', icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'consents' && renderConsents()}
      {activeTab === 'reports' && renderReports()}
    </div>
  );
};

export default GDPRComplianceDashboard;