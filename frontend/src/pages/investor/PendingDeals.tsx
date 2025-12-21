import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, FileText, DollarSign, Calendar, AlertCircle,
  CheckCircle, XCircle, Info, ChevronRight, Filter,
  Search, Download, Eye, Send, MessageSquare,
  Briefcase, Users, Building, TrendingUp, Timer
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

interface PendingDeal {
  id: string;
  pitchTitle: string;
  company: string;
  creator: string;
  dealType: 'equity' | 'debt' | 'revenue-share' | 'hybrid';
  requestedAmount: number;
  minimumInvestment: number;
  proposedTerms: {
    equity?: number;
    interestRate?: number;
    duration?: string;
    revenueShare?: number;
  };
  status: 'under-review' | 'negotiating' | 'due-diligence' | 'awaiting-approval' | 'expiring-soon';
  submittedDate: string;
  deadline: string;
  documents: {
    name: string;
    type: string;
    uploadDate: string;
  }[];
  lastUpdate: string;
  priority: 'high' | 'medium' | 'low';
  notes: string;
  genre: string;
  projectedROI: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const PendingDeals = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<PendingDeal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<PendingDeal[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPendingDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [deals, selectedStatus, selectedPriority, searchQuery]);

  const loadPendingDeals = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setDeals([
          {
            id: '1',
            pitchTitle: 'The Quantum Paradox',
            company: 'Quantum Films Ltd',
            creator: 'Alex Chen',
            dealType: 'equity',
            requestedAmount: 2500000,
            minimumInvestment: 100000,
            proposedTerms: {
              equity: 15,
              duration: '3 years'
            },
            status: 'due-diligence',
            submittedDate: '2024-12-10',
            deadline: '2024-12-25',
            documents: [
              { name: 'Business Plan.pdf', type: 'pdf', uploadDate: '2024-12-10' },
              { name: 'Financial Projections.xlsx', type: 'excel', uploadDate: '2024-12-11' },
              { name: 'Script.pdf', type: 'pdf', uploadDate: '2024-12-10' }
            ],
            lastUpdate: '2024-12-18',
            priority: 'high',
            notes: 'Strong team, previous successful projects. Awaiting final financial audit.',
            genre: 'Sci-Fi',
            projectedROI: 35,
            riskLevel: 'medium'
          },
          {
            id: '2',
            pitchTitle: 'Urban Legends',
            company: 'Dark Horse Productions',
            creator: 'Maria Rodriguez',
            dealType: 'revenue-share',
            requestedAmount: 1500000,
            minimumInvestment: 50000,
            proposedTerms: {
              revenueShare: 25,
              duration: '5 years'
            },
            status: 'negotiating',
            submittedDate: '2024-12-05',
            deadline: '2024-12-30',
            documents: [
              { name: 'Pitch Deck.pdf', type: 'pdf', uploadDate: '2024-12-05' },
              { name: 'Distribution Strategy.pdf', type: 'pdf', uploadDate: '2024-12-06' }
            ],
            lastUpdate: '2024-12-17',
            priority: 'medium',
            notes: 'Negotiating revenue share percentage. Good distribution network.',
            genre: 'Horror',
            projectedROI: 28,
            riskLevel: 'medium'
          },
          {
            id: '3',
            pitchTitle: 'Digital Dreams',
            company: 'Tech Cinema Co',
            creator: 'James Wilson',
            dealType: 'hybrid',
            requestedAmount: 3000000,
            minimumInvestment: 150000,
            proposedTerms: {
              equity: 10,
              revenueShare: 15,
              duration: '4 years'
            },
            status: 'expiring-soon',
            submittedDate: '2024-11-28',
            deadline: '2024-12-22',
            documents: [
              { name: 'Investment Proposal.pdf', type: 'pdf', uploadDate: '2024-11-28' },
              { name: 'Market Analysis.pdf', type: 'pdf', uploadDate: '2024-11-29' },
              { name: 'Team Bios.pdf', type: 'pdf', uploadDate: '2024-11-28' }
            ],
            lastUpdate: '2024-12-19',
            priority: 'high',
            notes: 'URGENT: Decision needed by Dec 22. Strong market potential.',
            genre: 'Thriller',
            projectedROI: 42,
            riskLevel: 'high'
          },
          {
            id: '4',
            pitchTitle: 'Mountain Echoes',
            company: 'Independent Films Co',
            creator: 'Sarah Kim',
            dealType: 'debt',
            requestedAmount: 800000,
            minimumInvestment: 25000,
            proposedTerms: {
              interestRate: 8,
              duration: '2 years'
            },
            status: 'under-review',
            submittedDate: '2024-12-15',
            deadline: '2025-01-10',
            documents: [
              { name: 'Loan Agreement Draft.pdf', type: 'pdf', uploadDate: '2024-12-15' }
            ],
            lastUpdate: '2024-12-16',
            priority: 'low',
            notes: 'Initial review phase. Low budget production with experienced team.',
            genre: 'Drama',
            projectedROI: 18,
            riskLevel: 'low'
          },
          {
            id: '5',
            pitchTitle: 'Cyber Protocol',
            company: 'Future Vision Studios',
            creator: 'Michael Chen',
            dealType: 'equity',
            requestedAmount: 5000000,
            minimumInvestment: 250000,
            proposedTerms: {
              equity: 20,
              duration: '5 years'
            },
            status: 'awaiting-approval',
            submittedDate: '2024-12-01',
            deadline: '2024-12-28',
            documents: [
              { name: 'Full Package.pdf', type: 'pdf', uploadDate: '2024-12-01' },
              { name: 'Letters of Intent.pdf', type: 'pdf', uploadDate: '2024-12-08' },
              { name: 'Budget Breakdown.xlsx', type: 'excel', uploadDate: '2024-12-02' }
            ],
            lastUpdate: '2024-12-20',
            priority: 'high',
            notes: 'All due diligence complete. Awaiting final investment committee approval.',
            genre: 'Action',
            projectedROI: 55,
            riskLevel: 'medium'
          }
        ]);
        
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load pending deals:', error);
      setLoading(false);
    }
  };

  const filterDeals = () => {
    let filtered = [...deals];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(deal => deal.status === selectedStatus);
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(deal => deal.priority === selectedPriority);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(deal =>
        deal.pitchTitle.toLowerCase().includes(query) ||
        deal.company.toLowerCase().includes(query) ||
        deal.creator.toLowerCase().includes(query) ||
        deal.genre.toLowerCase().includes(query)
      );
    }

    // Sort by deadline (urgent first)
    filtered.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    setFilteredDeals(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under-review':
        return 'text-blue-600 bg-blue-100';
      case 'negotiating':
        return 'text-yellow-600 bg-yellow-100';
      case 'due-diligence':
        return 'text-purple-600 bg-purple-100';
      case 'awaiting-approval':
        return 'text-green-600 bg-green-100';
      case 'expiring-soon':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InvestorNavigation 
          user={user}
          onLogout={handleLogout}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  const stats = {
    total: deals.length,
    expiringSoon: deals.filter(d => getDaysUntilDeadline(d.deadline) <= 7).length,
    highPriority: deals.filter(d => d.priority === 'high').length,
    totalRequested: deals.reduce((sum, d) => sum + d.requestedAmount, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNavigation 
        user={user}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pending Deals</h1>
          <p className="text-gray-600 mt-2">
            Review and manage investment opportunities awaiting your decision
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pending</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Briefcase className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expiringSoon}</p>
                </div>
                <Timer className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.highPriority}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Requested</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalRequested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="under-review">Under Review</option>
                <option value="negotiating">Negotiating</option>
                <option value="due-diligence">Due Diligence</option>
                <option value="awaiting-approval">Awaiting Approval</option>
                <option value="expiring-soon">Expiring Soon</option>
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Deals List */}
        <div className="space-y-4">
          {filteredDeals.map((deal) => {
            const daysLeft = getDaysUntilDeadline(deal.deadline);
            const isUrgent = daysLeft <= 7;
            
            return (
              <Card key={deal.id} className={`${isUrgent ? 'border-red-500 border-2' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{deal.pitchTitle}</h3>
                          <p className="text-sm text-gray-600">{deal.company} • {deal.creator}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              {deal.genre}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(deal.status)}`}>
                              {deal.status.replace('-', ' ')}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(deal.riskLevel)}`}>
                              {deal.riskLevel} risk
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${getPriorityColor(deal.priority)}`}>
                            {deal.priority} priority
                          </div>
                          <div className={`text-sm ${isUrgent ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Deal Type</p>
                          <p className="text-sm font-medium text-gray-900">{deal.dealType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Requested Amount</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(deal.requestedAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Min. Investment</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(deal.minimumInvestment)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Projected ROI</p>
                          <p className="text-sm font-medium text-green-600">{deal.projectedROI}%</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Proposed Terms</p>
                        <div className="flex gap-4 text-sm">
                          {deal.proposedTerms.equity && (
                            <span>{deal.proposedTerms.equity}% equity</span>
                          )}
                          {deal.proposedTerms.revenueShare && (
                            <span>{deal.proposedTerms.revenueShare}% revenue share</span>
                          )}
                          {deal.proposedTerms.interestRate && (
                            <span>{deal.proposedTerms.interestRate}% interest</span>
                          )}
                          {deal.proposedTerms.duration && (
                            <span>{deal.proposedTerms.duration}</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Documents ({deal.documents.length})</p>
                        <div className="flex gap-2">
                          {deal.documents.map((doc, idx) => (
                            <Button key={idx} variant="outline" size="sm">
                              <FileText className="h-3 w-3 mr-1" />
                              {doc.name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Latest Notes</p>
                        <p className="text-sm text-gray-700">{deal.notes}</p>
                        <p className="text-xs text-gray-500 mt-1">Last updated: {new Date(deal.lastUpdate).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button className="w-full" variant="default">
                        <Eye className="h-4 w-4 mr-2" />
                        Review Deal
                      </Button>
                      <Button className="w-full" variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                      <Button className="w-full" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredDeals.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No pending deals found</h3>
              <p className="text-gray-600">Try adjusting your filters or check back later for new opportunities</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PendingDeals;