import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileSignature, FileClock, FileCheck, FileX, FileSearch,
  FileText, Filter, Search, Calendar, Download, Eye,
  AlertCircle, CheckCircle, XCircle, Clock, ChevronRight,
  MoreVertical, Send, Archive, Trash2, RefreshCw, PenTool
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import apiClient from '../../lib/api-client';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface NDARequest {
  id: number;
  pitchTitle: string;
  creator: string;
  company: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'signed' | 'active';
  expiryDate?: string;
  documentUrl?: string;
  notes?: string;
  genre: string;
  budget: string;
  pitchId?: number;
}

export default function NDARequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTab, setSelectedTab] = useState(searchParams.get('tab') || 'all');
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated, checkSession } = useBetterAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Check session on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        await checkSession();
        setSessionChecked(true);
      } catch {
        setSessionChecked(true);
      }
    };
    validateSession();
  }, [checkSession]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      navigate('/login/investor');
    }
  }, [sessionChecked, isAuthenticated, navigate]);

  // Fetch NDA requests from API
  const fetchNDARequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/api/ndas');

      if (response.success && response.data) {
        // Transform API data to match component interface
        const ndas = response.data.ndas || response.data || [];
        const transformedNDAs: NDARequest[] = ndas.map((nda: any) => ({
          id: nda.id,
          pitchTitle: nda.pitchTitle || nda.pitch_title || 'Unknown Pitch',
          creator: nda.creatorName || nda.creator_name || nda.creator || 'Unknown Creator',
          company: nda.companyName || nda.company_name || nda.company || 'Independent',
          requestDate: nda.requestedAt || nda.requested_at || nda.createdAt || nda.created_at,
          status: nda.status || 'pending',
          expiryDate: nda.expiresAt || nda.expires_at,
          documentUrl: nda.documentUrl || nda.document_url,
          notes: nda.notes || nda.rejectionReason || nda.rejection_reason,
          genre: nda.genre || 'Unknown',
          budget: nda.budget || 'TBD',
          pitchId: nda.pitchId || nda.pitch_id
        }));
        setNdaRequests(transformedNDAs);
      } else {
        // If no data, show empty state (not an error)
        setNdaRequests([]);
      }
    } catch (err) {
      console.error('Failed to fetch NDA requests:', err);
      setError('Failed to load NDA requests. Please try again.');
      setNdaRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when session is confirmed
  useEffect(() => {
    if (sessionChecked && isAuthenticated) {
      fetchNDARequests();
    }
  }, [sessionChecked, isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login/investor');
  };

  const [signingId, setSigningId] = useState<number | null>(null);

  // Sign an approved NDA
  const handleSignNDA = async (ndaId: number) => {
    try {
      setSigningId(ndaId);
      setError(null);

      const response = await apiClient.post(`/api/ndas/${ndaId}/sign`, {
        acceptTerms: true,
        signedAt: new Date().toISOString()
      });

      if (response.success) {
        // Update local state to reflect signed status
        setNdaRequests(prev => prev.map(nda =>
          nda.id === ndaId ? { ...nda, status: 'signed' as const } : nda
        ));
      } else {
        setError(response.error?.message || 'Failed to sign NDA');
      }
    } catch (err) {
      console.error('Failed to sign NDA:', err);
      setError('Failed to sign NDA. Please try again.');
    } finally {
      setSigningId(null);
    }
  };

  const filteredRequests = ndaRequests.filter(request => {
    const matchesSearch = request.pitchTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedTab === 'all' || request.status === selectedTab;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <FileCheck className="w-4 h-4" />;
      case 'signed': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'signed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: ndaRequests.length,
    pending: ndaRequests.filter(r => r.status === 'pending').length,
    approved: ndaRequests.filter(r => r.status === 'approved').length,
    signed: ndaRequests.filter(r => r.status === 'signed').length,
    rejected: ndaRequests.filter(r => r.status === 'rejected').length,
    expired: ndaRequests.filter(r => r.status === 'expired').length,
  };

  useEffect(() => {
    if (searchParams.get('tab') !== selectedTab) {
      setSearchParams({ tab: selectedTab });
    }
  }, [selectedTab]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NDA Requests</h1>
            <p className="text-gray-600 mt-2">Manage your non-disclosure agreement requests and access protected content</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchNDARequests}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Signed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.signed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expired</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.expired}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by pitch title, creator, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-6 max-w-3xl">
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
            <TabsTrigger value="signed">Signed ({stats.signed})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({stats.expired})</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileSearch className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">
                      {ndaRequests.length === 0
                        ? "You haven't requested any NDAs yet"
                        : "No NDA requests match your search criteria"
                      }
                    </p>
                    {ndaRequests.length === 0 && (
                      <Button
                        onClick={() => navigate('/marketplace')}
                        variant="outline"
                        className="mt-2"
                      >
                        Browse Pitches
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                filteredRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <FileSignature className="w-6 h-6 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {request.pitchTitle}
                                </h3>
                                <Badge className={getStatusColor(request.status)}>
                                  <span className="flex items-center gap-1">
                                    {getStatusIcon(request.status)}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                <div>Creator: <span className="font-medium">{request.creator}</span></div>
                                <div>Company: <span className="font-medium">{request.company}</span></div>
                                <div>Genre: <span className="font-medium">{request.genre}</span></div>
                                <div>Budget: <span className="font-medium">{request.budget}</span></div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Requested: {new Date(request.requestDate).toLocaleDateString()}
                                </span>
                                {request.expiryDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {request.status === 'expired' ? 'Expired' : 'Expires'}: {new Date(request.expiryDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {request.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                                  Note: {request.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {request.status === 'approved' && (
                            <Button
                              variant="default"
                              size="sm"
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              onClick={() => handleSignNDA(request.id)}
                              disabled={signingId === request.id}
                            >
                              {signingId === request.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <PenTool className="w-4 h-4" />
                              )}
                              {signingId === request.id ? 'Signing...' : 'Sign NDA'}
                            </Button>
                          )}
                          {request.status === 'signed' && request.documentUrl && (
                            <>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                View NDA
                              </Button>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Download
                              </Button>
                            </>
                          )}
                          {request.status === 'pending' && (
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                              <Send className="w-4 h-4" />
                              Follow Up
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/investor/pitch/${request.id}`)}>
                                View Pitch Details
                              </DropdownMenuItem>
                              {request.status === 'approved' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleSignNDA(request.id)}>
                                    <PenTool className="w-4 h-4 mr-2" />
                                    Sign NDA
                                  </DropdownMenuItem>
                                </>
                              )}
                              {request.status === 'signed' && (
                                <DropdownMenuItem>
                                  Access Protected Content
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Archive className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              {request.status !== 'pending' && (
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}