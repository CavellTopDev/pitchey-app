import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, ArrowLeft, Clock, CheckCircle, XCircle, 
  AlertCircle, FileText, Calendar, Download, Eye, 
  Search, Filter, ExternalLink
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/authStore';

interface NDARequest {
  id: number;
  pitchId: number;
  pitchTitle: string;
  creatorName: string;
  creatorCompany?: string;
  ndaType: 'basic' | 'enhanced' | 'custom';
  status: string;
  requestedAt: string;
  respondedAt?: string;
  rejectionReason?: string;
}

interface SignedNDA {
  id: number;
  pitchId: number;
  pitchTitle: string;
  creatorName: string;
  creatorCompany?: string;
  ndaType: string;
  signedAt: string;
  expiresAt?: string;
  accessGranted: boolean;
  isExpired?: boolean;
}

export default function InvestorNDAHistory() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'requests' | 'signed'>('requests');
  const [requests, setRequests] = useState<NDARequest[]>([]);
  const [signedNDAs, setSignedNDAs] = useState<SignedNDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [stats, setStats] = useState({
    totalRequests: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    activeSigned: 0,
    expired: 0,
  });

  useEffect(() => {
    fetchNDAData();
  }, []);

  const fetchNDAData = async () => {
    try {
      setLoading(true);
      
      // Fetch user's NDA requests (outgoing)
      const requestsResponse = await apiClient.get('/api/ndas/request');
      if (requestsResponse && requestsResponse.success) {
        const requestData = requestsResponse.requests || [];
        setRequests(requestData);
        
        // Calculate stats
        const pending = requestData.filter((r: any) => r.status === 'pending').length;
        const approved = requestData.filter((r: any) => r.status === 'approved').length;
        const rejected = requestData.filter((r: any) => r.status === 'rejected').length;
        
        setStats(prev => ({
          ...prev,
          totalRequests: requestData.length,
          pending,
          approved,
          rejected,
        }));
      }
      
      // Fetch signed NDAs
      const signedResponse = await apiClient.get('/api/nda/signed');
      if (signedResponse && signedResponse.success) {
        const signedData = signedResponse.ndas || [];
        setSignedNDAs(signedData);
        
        const active = signedData.filter((nda: any) => nda.accessGranted && !nda.isExpired).length;
        const expired = signedData.filter((nda: any) => nda.isExpired).length;
        
        setStats(prev => ({
          ...prev,
          activeSigned: active,
          expired,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch NDA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadNDA = async (ndaId: number) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://pitchey-backend.deno.dev';
      const response = await fetch(`${apiUrl}/api/nda/${ndaId}/document`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NDA-${ndaId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download NDA:', error);
    }
  };

  const filteredRequests = requests.filter(request => {
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        request.pitchTitle.toLowerCase().includes(query) ||
        request.creatorName.toLowerCase().includes(query) ||
        request.creatorCompany?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredSignedNDAs = signedNDAs.filter(nda => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        nda.pitchTitle.toLowerCase().includes(query) ||
        nda.creatorName.toLowerCase().includes(query) ||
        nda.creatorCompany?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getNDATypeColor = (type: string) => {
    switch (type) {
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'enhanced': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDaysUntilExpiration = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
    return `${Math.ceil(diffDays / 365)} years`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/investor/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My NDAs</h1>
                  <p className="text-sm text-gray-600">Manage your NDA requests and signed agreements</p>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.activeSigned}</p>
                <p className="text-xs text-gray-600">Active</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                <p className="text-xs text-gray-600">Expired</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs and Filters */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b">
            <div className="flex items-center justify-between p-4">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === 'requests'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  My Requests ({requests.length})
                </button>
                <button
                  onClick={() => setActiveTab('signed')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === 'signed'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Signed NDAs ({signedNDAs.length})
                </button>
              </div>

              {/* Search and Filter */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {activeTab === 'requests' && (
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading NDA data...</p>
              </div>
            ) : activeTab === 'requests' ? (
              <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No NDA requests found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Request access to pitch information to get started
                    </p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(request.status)}
                            <h3 className="font-semibold text-gray-900">{request.pitchTitle}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNDATypeColor(request.ndaType)}`}>
                              {request.ndaType.toUpperCase()} NDA
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <span>Creator: {request.creatorCompany || request.creatorName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Requested: {formatDate(request.requestedAt)}</span>
                            </div>
                            {request.respondedAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>Responded: {formatDate(request.respondedAt)}</span>
                              </div>
                            )}
                          </div>
                          {request.rejectionReason && (
                            <p className="mt-2 text-sm text-red-600 italic">
                              Rejection reason: "{request.rejectionReason}"
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                          {request.status === 'approved' && (
                            <button
                              onClick={() => navigate(`/pitch/${request.pitchId}`)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                              title="View Pitch"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSignedNDAs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No signed NDAs found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      NDAs will appear here once approved by creators
                    </p>
                  </div>
                ) : (
                  filteredSignedNDAs.map((nda) => (
                    <div key={nda.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{nda.pitchTitle}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNDATypeColor(nda.ndaType)}`}>
                              {nda.ndaType.toUpperCase()} NDA
                            </span>
                            {nda.isExpired && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                EXPIRED
                              </span>
                            )}
                            {!nda.accessGranted && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                REVOKED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <span>Creator: {nda.creatorCompany || nda.creatorName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Signed: {formatDate(nda.signedAt)}</span>
                            </div>
                            {nda.expiresAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>Expires: {calculateDaysUntilExpiration(nda.expiresAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadNDA(nda.id)}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm flex items-center gap-1"
                            title="Download NDA Document"
                          >
                            <Download className="w-4 h-4" />
                            PDF
                          </button>
                          {nda.accessGranted && !nda.isExpired && (
                            <button
                              onClick={() => navigate(`/pitch/${nda.pitchId}`)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                            >
                              View Pitch
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}