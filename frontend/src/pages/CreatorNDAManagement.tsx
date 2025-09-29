import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Shield, ArrowLeft, Clock, CheckCircle, XCircle, 
  AlertCircle, FileText, Calendar, Building2, User,
  Mail, Phone, Globe, Download, Eye, Filter, Search
} from 'lucide-react';
import { ndaAPI, apiClient } from '../lib/apiServices';

interface NDARequest {
  id: number;
  pitchId: number;
  pitchTitle: string;
  requesterName: string;
  requesterCompany?: string;
  ndaType: 'basic' | 'enhanced' | 'custom';
  requestMessage?: string;
  companyInfo?: {
    companyName: string;
    position: string;
    intendedUse: string;
  };
  status: string;
  requestedAt: string;
}

interface SignedNDA {
  id: number;
  pitchId: number;
  pitchTitle: string;
  signerName: string;
  signerCompany?: string;
  signerType: string;
  ndaType: string;
  signedAt: string;
  expiresAt?: string;
  signedDate: string;
  expiresIn: string;
  isExpired?: boolean;
}

export default function CreatorNDAManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'incoming' | 'signed'>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<NDARequest[]>([]);
  const [signedNDAs, setSignedNDAs] = useState<SignedNDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<NDARequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalSigned: 0,
  });

  useEffect(() => {
    fetchNDAData();
  }, []);

  const fetchNDAData = async () => {
    try {
      setLoading(true);
      
      // Fetch incoming NDA requests using the new endpoint
      const incomingResponse = await apiClient.get('/api/creator/nda-requests');
      if (incomingResponse && incomingResponse.success && incomingResponse.data?.data) {
        const rawData = incomingResponse.data.data || [];
        
        // Transform the nested data structure to flat structure expected by UI
        const requests = rawData.map((item: any) => ({
          id: item.request?.id || item.id,
          pitchId: item.request?.pitchId || item.pitchId,
          pitchTitle: item.pitch?.title || item.pitchTitle || 'Unknown Pitch',
          ndaType: item.request?.ndaType || item.ndaType || 'basic',
          requesterName: item.requester?.firstName + ' ' + item.requester?.lastName || item.request?.requesterName || 'Unknown',
          requesterEmail: item.requester?.email || item.request?.requesterEmail || '',
          requesterCompany: item.requester?.companyName || item.request?.companyInfo?.companyName || '',
          companyInfo: item.request?.companyInfo || {},
          status: item.request?.status || item.status || 'pending',
          createdAt: item.request?.requestedAt || item.request?.createdAt || item.createdAt,
          requestMessage: item.request?.requestMessage || ''
        }));
        
        setIncomingRequests(requests);
        
        // Calculate stats
        const pending = requests.filter((r: any) => r.status === 'pending').length;
        const approved = requests.filter((r: any) => r.status === 'approved').length;
        const rejected = requests.filter((r: any) => r.status === 'rejected').length;
        
        setStats(prev => ({
          ...prev,
          pending,
          approved,
          rejected,
        }));
      } else {
        console.error('Failed to fetch incoming NDA requests:', incomingResponse?.error);
      }
      
      // Fetch NDA statistics
      const statsResponse = await apiClient.get('/api/nda/stats');
      if (statsResponse && statsResponse.success && statsResponse.data?.stats) {
        setStats(prev => ({
          ...prev,
          totalSigned: statsResponse.data.stats.totalSigned || 0,
        }));
      }
      
      // Fetch signed NDAs (where others signed for your pitches)
      const signedResponse = await apiClient.get('/api/nda/signed');
      if (signedResponse && signedResponse.success && signedResponse.data?.data) {
        setSignedNDAs(signedResponse.data.data || []);
      } else {
        console.error('Failed to fetch signed NDAs:', signedResponse?.error);
      }
    } catch (error) {
      console.error('Failed to fetch NDA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: NDARequest) => {
    try {
      const result = await apiClient.post(`/api/nda/${request.id}/approve`, {});
      if (result && result.success) {
        // Refresh data
        await fetchNDAData();
        setSelectedRequest(null);
        setShowDetailModal(false);
      } else {
        console.error('Failed to approve NDA:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to approve NDA:', error);
    }
  };

  const handleReject = async (request: NDARequest, reason?: string) => {
    try {
      const result = await apiClient.post(`/api/nda/${request.id}/reject`, {
        rejectionReason: reason || 'Request rejected'
      });
      if (result && result.success) {
        // Refresh data
        await fetchNDAData();
        setSelectedRequest(null);
        setShowDetailModal(false);
      } else {
        console.error('Failed to reject NDA:', result?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to reject NDA:', error);
    }
  };

  const filteredRequests = incomingRequests.filter(request => {
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        request.pitchTitle.toLowerCase().includes(query) ||
        request.requesterName.toLowerCase().includes(query) ||
        request.requesterCompany?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredSignedNDAs = signedNDAs.filter(nda => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        nda.pitchTitle.toLowerCase().includes(query) ||
        nda.signerName.toLowerCase().includes(query) ||
        nda.signerCompany?.toLowerCase().includes(query)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
                  <p className="text-sm text-gray-600">Manage access requests to your pitches</p>
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
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                <p className="text-xs text-gray-600">Approved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalSigned}</p>
                <p className="text-xs text-gray-600">Active NDAs</p>
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
                  onClick={() => setActiveTab('incoming')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === 'incoming'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Incoming Requests ({incomingRequests.length})
                </button>
                <button
                  onClick={() => setActiveTab('signed')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === 'signed'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Active NDAs ({signedNDAs.length})
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
                    className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {activeTab === 'incoming' && (
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading NDA data...</p>
              </div>
            ) : activeTab === 'incoming' ? (
              <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No NDA requests found</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(request.status)}
                            <h3 className="font-semibold text-gray-900">{request.pitchTitle}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNDATypeColor(request.ndaType || 'standard')}`}>
                              {(request.ndaType || 'standard').toUpperCase()} NDA
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              {request.requesterCompany ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              <span>{request.requesterCompany || request.requesterName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{request.requestedAt}</span>
                            </div>
                          </div>
                          {request.requestMessage && (
                            <p className="mt-2 text-sm text-gray-600 italic">"{request.requestMessage}"</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {request.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApprove(request)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              request.status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                    <p className="text-gray-600">No active NDAs found</p>
                  </div>
                ) : (
                  filteredSignedNDAs.map((nda) => (
                    <div key={nda.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{nda.pitchTitle}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNDATypeColor(nda.ndaType || 'standard')}`}>
                              {(nda.ndaType || 'standard').toUpperCase()} NDA
                            </span>
                            {nda.isExpired && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                EXPIRED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              {nda.signerCompany ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              <span>{nda.signerCompany || nda.signerName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Signed {nda.signedDate}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Expires in {nda.expiresIn}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/creator/pitches/${nda.pitchId}`)}
                            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                          >
                            View Pitch
                          </button>
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

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">NDA Request Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-600">Pitch</label>
                <p className="font-semibold text-gray-900">{selectedRequest.pitchTitle}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Requester</label>
                <p className="font-semibold text-gray-900">{selectedRequest.requesterName}</p>
                {selectedRequest.requesterCompany && (
                  <p className="text-sm text-gray-600">{selectedRequest.requesterCompany}</p>
                )}
              </div>
              
              {selectedRequest.companyInfo && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Company Information</label>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><span className="font-medium">Company:</span> {selectedRequest.companyInfo.companyName}</p>
                    <p><span className="font-medium">Position:</span> {selectedRequest.companyInfo.position}</p>
                    <p><span className="font-medium">Intended Use:</span> {selectedRequest.companyInfo.intendedUse}</p>
                  </div>
                </div>
              )}
              
              {selectedRequest.requestMessage && (
                <div>
                  <label className="text-sm text-gray-600">Message</label>
                  <p className="text-gray-900 bg-gray-50 rounded-lg p-4">{selectedRequest.requestMessage}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm text-gray-600">NDA Type</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getNDATypeColor(selectedRequest.ndaType)}`}>
                  {selectedRequest.ndaType.toUpperCase()} NDA
                </span>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Requested</label>
                <p className="text-gray-900">{selectedRequest.requestedAt}</p>
              </div>
            </div>
            
            {selectedRequest.status === 'pending' && (
              <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    handleReject(selectedRequest, 'Not interested at this time');
                  }}
                  className="px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                >
                  Reject Request
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Approve Access
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}