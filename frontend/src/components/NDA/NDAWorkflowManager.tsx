import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
  Download,
  Eye,
  PenTool,
  Bell,
  ChevronRight,
  User,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { useToast } from '../Toast/ToastProvider';
import { apiClient } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface NDA {
  id: number;
  pitch_id: number;
  pitch_title: string;
  requester_id: number;
  requester_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'signed';
  document_url?: string;
  custom_document?: boolean;
  signed_document_url?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  signed_at?: string;
  rejection_reason?: string;
  approved_by?: number;
  signature_data?: any;
  notes?: string;
}

interface NDAWorkflowManagerProps {
  userRole: 'creator' | 'investor' | 'production';
  userId: number;
  pitchId?: number;
  onStatusChange?: (nda: NDA) => void;
}

export default function NDAWorkflowManager({
  userRole,
  userId,
  pitchId,
  onStatusChange
}: NDAWorkflowManagerProps) {
  const [ndas, setNdas] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNda, setSelectedNda] = useState<NDA | null>(null);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [signature, setSignature] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'signed'>('all');
  const { success, error, info } = useToast();

  // Fetch NDAs
  const fetchNDAs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pitchId) params.append('pitch_id', pitchId.toString());
      if (filter !== 'all') params.append('status', filter);

      const response = await apiClient.get(`/api/ndas?${params}`);
      if (response.data.success) {
        setNdas(response.data.data.ndas || []);
      }
    } catch (err: any) {
      error('Failed to load NDAs', err.message);
    } finally {
      setLoading(false);
    }
  }, [pitchId, filter, error]);

  useEffect(() => {
    fetchNDAs();
  }, [fetchNDAs]);

  // Approve NDA
  const handleApprove = async (nda: NDA) => {
    setProcessing(true);
    try {
      const response = await apiClient.post(`/api/ndas/${nda.id}/approve`);
      if (response.data.success) {
        success('NDA Approved', 'The NDA request has been approved successfully');
        
        // Update local state
        const updatedNda = { ...nda, status: 'approved' as const, approved_at: new Date().toISOString() };
        setNdas(prev => prev.map(n => n.id === nda.id ? updatedNda : n));
        
        // Trigger callback
        onStatusChange?.(updatedNda);
        
        // Show notification
        sendNotification(nda.requester_id, 'NDA Approved', `Your NDA request for "${nda.pitch_title}" has been approved`);
      }
    } catch (err: any) {
      error('Approval Failed', err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Reject NDA
  const handleReject = async () => {
    if (!selectedNda || !rejectionReason.trim()) {
      error('Invalid Input', 'Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const response = await apiClient.post(`/api/ndas/${selectedNda.id}/reject`, {
        reason: rejectionReason
      });
      
      if (response.data.success) {
        success('NDA Rejected', 'The NDA request has been rejected');
        
        // Update local state
        const updatedNda = {
          ...selectedNda,
          status: 'rejected' as const,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        };
        setNdas(prev => prev.map(n => n.id === selectedNda.id ? updatedNda : n));
        
        // Trigger callback
        onStatusChange?.(updatedNda);
        
        // Send notification
        sendNotification(selectedNda.requester_id, 'NDA Rejected', `Your NDA request for "${selectedNda.pitch_title}" was rejected: ${rejectionReason}`);
        
        // Close modal
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedNda(null);
      }
    } catch (err: any) {
      error('Rejection Failed', err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Sign NDA
  const handleSign = async () => {
    if (!selectedNda || !signature.trim()) {
      error('Invalid Input', 'Please provide your signature');
      return;
    }

    setProcessing(true);
    try {
      const response = await apiClient.post(`/api/ndas/${selectedNda.id}/sign`, {
        signature,
        signatureData: {
          name: signature,
          timestamp: new Date().toISOString(),
          ip: window.location.hostname
        }
      });

      if (response.data.success) {
        success('NDA Signed', 'You have successfully signed the NDA');
        
        // Update local state
        const updatedNda = {
          ...selectedNda,
          status: 'signed' as const,
          signed_at: new Date().toISOString(),
          signature_data: { name: signature }
        };
        setNdas(prev => prev.map(n => n.id === selectedNda.id ? updatedNda : n));
        
        // Trigger callback
        onStatusChange?.(updatedNda);
        
        // Send notification to creator
        const creatorNotification = userRole === 'investor' || userRole === 'production';
        if (creatorNotification) {
          sendNotification(selectedNda.pitch_id, 'NDA Signed', `${signature} has signed the NDA for "${selectedNda.pitch_title}"`);
        }
        
        // Close modal
        setShowSigningModal(false);
        setSignature('');
        setSelectedNda(null);
      }
    } catch (err: any) {
      error('Signing Failed', err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Send notification (mock implementation)
  const sendNotification = (recipientId: number, title: string, message: string) => {
    // This would integrate with your notification system
    info('Notification Sent', message);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pending' },
      approved: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Approved' },
      rejected: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Rejected' },
      signed: { icon: PenTool, color: 'text-blue-600 bg-blue-50', label: 'Signed' }
    };
    
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  // Filter NDAs
  const filteredNdas = filter === 'all' ? ndas : ndas.filter(nda => nda.status === filter);

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">NDA Management</h2>
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm">
              {filteredNdas.length} {filter === 'all' ? 'Total' : filter}
            </span>
          </div>
          
          <button
            onClick={fetchNDAs}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected', 'signed'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* NDA List */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading NDAs...
          </div>
        ) : filteredNdas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No NDAs found
          </div>
        ) : (
          filteredNdas.map(nda => (
            <div key={nda.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{nda.pitch_title}</h3>
                        {getStatusBadge(nda.status)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {nda.requester_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(nda.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {nda.rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                          <p className="text-sm text-red-600">
                            <strong>Rejection Reason:</strong> {nda.rejection_reason}
                          </p>
                        </div>
                      )}
                      
                      {nda.signed_at && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                          <p className="text-sm text-green-600">
                            <strong>Signed by:</strong> {nda.signature_data?.name || 'Unknown'} on {new Date(nda.signed_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* View Document */}
                  {nda.document_url && (
                    <button
                      onClick={() => window.open(nda.document_url, '_blank')}
                      className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                      title="View NDA Document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* Creator Actions */}
                  {userRole === 'creator' && nda.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(nda)}
                        disabled={processing}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNda(nda);
                          setShowRejectModal(true);
                        }}
                        disabled={processing}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  
                  {/* Investor/Production Actions */}
                  {(userRole === 'investor' || userRole === 'production') && nda.status === 'approved' && !nda.signed_at && (
                    <button
                      onClick={() => {
                        setSelectedNda(nda);
                        setShowSigningModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                    >
                      <PenTool className="w-3 h-3" />
                      Sign NDA
                    </button>
                  )}
                  
                  {/* Download Signed Document */}
                  {nda.signed_document_url && (
                    <button
                      onClick={() => window.open(nda.signed_document_url, '_blank')}
                      className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && selectedNda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Reject NDA Request</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting the NDA request for "{selectedNda.pitch_title}"
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={4}
            />
            
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedNda(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Reject NDA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signing Modal */}
      {showSigningModal && selectedNda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <PenTool className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Sign NDA</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              By signing this NDA, you agree to the terms and conditions for accessing confidential information about "{selectedNda.pitch_title}"
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">NDA Summary</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• You agree to keep all information confidential</li>
                <li>• You will not share or disclose any materials</li>
                <li>• This agreement is legally binding</li>
                <li>• Violation may result in legal action</li>
              </ul>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Full Legal Name (Electronic Signature)
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSigningModal(false);
                  setSignature('');
                  setSelectedNda(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSign}
                disabled={processing || !signature.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Sign & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}