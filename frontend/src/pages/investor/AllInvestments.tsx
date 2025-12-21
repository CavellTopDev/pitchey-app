import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, Filter,
  Search, Download, Eye, MoreVertical, ArrowUpDown,
  Building, Film, Users, Award, Clock, AlertCircle,
  CheckCircle, XCircle, PauseCircle, PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

interface Investment {
  id: string;
  pitchTitle: string;
  company: string;
  creator: string;
  genre: string;
  investmentDate: string;
  initialAmount: number;
  currentValue: number;
  roi: number;
  status: 'active' | 'completed' | 'on-hold' | 'exited' | 'written-off';
  stage: 'pre-production' | 'production' | 'post-production' | 'distribution' | 'released';
  ownership: number;
  lastValuation: string;
  distributions: number;
  totalReturn: number;
  exitDate?: string;
  performance: 'outperforming' | 'meeting-expectations' | 'underperforming';
  nextMilestone?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const AllInvestments = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'roi' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    loadInvestments();
  }, []);

  useEffect(() => {
    filterAndSortInvestments();
  }, [investments, selectedStatus, selectedStage, sortBy, sortOrder, searchQuery]);

  const loadInvestments = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setInvestments([
          {
            id: '1',
            pitchTitle: 'The Quantum Paradox',
            company: 'Quantum Films Ltd',
            creator: 'Alex Chen',
            genre: 'Sci-Fi',
            investmentDate: '2024-01-15',
            initialAmount: 500000,
            currentValue: 725000,
            roi: 45,
            status: 'active',
            stage: 'post-production',
            ownership: 5.5,
            lastValuation: '2024-12-15',
            distributions: 50000,
            totalReturn: 275000,
            performance: 'outperforming',
            nextMilestone: 'Festival premiere',
            riskLevel: 'low'
          },
          {
            id: '2',
            pitchTitle: 'Urban Legends',
            company: 'Dark Horse Productions',
            creator: 'Maria Rodriguez',
            genre: 'Horror',
            investmentDate: '2023-11-20',
            initialAmount: 750000,
            currentValue: 820000,
            roi: 9.3,
            status: 'active',
            stage: 'production',
            ownership: 7.2,
            lastValuation: '2024-12-01',
            distributions: 0,
            totalReturn: 70000,
            performance: 'meeting-expectations',
            nextMilestone: 'Wrap principal photography',
            riskLevel: 'medium'
          },
          {
            id: '3',
            pitchTitle: 'Digital Dreams',
            company: 'Tech Cinema Co',
            creator: 'James Wilson',
            genre: 'Thriller',
            investmentDate: '2023-08-10',
            initialAmount: 300000,
            currentValue: 280000,
            roi: -6.7,
            status: 'on-hold',
            stage: 'pre-production',
            ownership: 3.8,
            lastValuation: '2024-11-20',
            distributions: 0,
            totalReturn: -20000,
            performance: 'underperforming',
            nextMilestone: 'Secure additional funding',
            riskLevel: 'high'
          },
          {
            id: '4',
            pitchTitle: 'Lost Paradise',
            company: 'Paradise Films',
            creator: 'Emily Chang',
            genre: 'Drama',
            investmentDate: '2022-06-05',
            initialAmount: 1000000,
            currentValue: 1850000,
            roi: 85,
            status: 'completed',
            stage: 'released',
            ownership: 12.5,
            lastValuation: '2024-10-15',
            distributions: 350000,
            totalReturn: 1200000,
            exitDate: '2024-10-01',
            performance: 'outperforming',
            riskLevel: 'low'
          },
          {
            id: '5',
            pitchTitle: 'Midnight Chronicles',
            company: 'Moonlight Studios',
            creator: 'David Lee',
            genre: 'Mystery',
            investmentDate: '2024-02-20',
            initialAmount: 450000,
            currentValue: 495000,
            roi: 10,
            status: 'active',
            stage: 'production',
            ownership: 4.5,
            lastValuation: '2024-12-10',
            distributions: 0,
            totalReturn: 45000,
            performance: 'meeting-expectations',
            nextMilestone: 'Complete post-production',
            riskLevel: 'medium'
          },
          {
            id: '6',
            pitchTitle: 'Arctic Expedition',
            company: 'Northern Lights Pictures',
            creator: 'Sophie Anderson',
            genre: 'Documentary',
            investmentDate: '2023-03-15',
            initialAmount: 200000,
            currentValue: 380000,
            roi: 90,
            status: 'completed',
            stage: 'distribution',
            ownership: 8.0,
            lastValuation: '2024-11-25',
            distributions: 80000,
            totalReturn: 260000,
            exitDate: '2024-11-01',
            performance: 'outperforming',
            riskLevel: 'low'
          },
          {
            id: '7',
            pitchTitle: 'Comedy Central',
            company: 'Laugh Track Productions',
            creator: 'Mike Johnson',
            genre: 'Comedy',
            investmentDate: '2023-09-01',
            initialAmount: 150000,
            currentValue: 0,
            roi: -100,
            status: 'written-off',
            stage: 'production',
            ownership: 2.5,
            lastValuation: '2024-08-15',
            distributions: 0,
            totalReturn: -150000,
            exitDate: '2024-08-15',
            performance: 'underperforming',
            riskLevel: 'high'
          },
          {
            id: '8',
            pitchTitle: 'Space Odyssey 2099',
            company: 'Stellar Entertainment',
            creator: 'Robert Zhang',
            genre: 'Sci-Fi',
            investmentDate: '2024-03-10',
            initialAmount: 800000,
            currentValue: 920000,
            roi: 15,
            status: 'active',
            stage: 'pre-production',
            ownership: 6.0,
            lastValuation: '2024-12-18',
            distributions: 0,
            totalReturn: 120000,
            performance: 'meeting-expectations',
            nextMilestone: 'Begin principal photography',
            riskLevel: 'medium'
          }
        ]);
        
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load investments:', error);
      setLoading(false);
    }
  };

  const filterAndSortInvestments = () => {
    let filtered = [...investments];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedStatus);
    }

    // Filter by stage
    if (selectedStage !== 'all') {
      filtered = filtered.filter(inv => inv.stage === selectedStage);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.pitchTitle.toLowerCase().includes(query) ||
        inv.company.toLowerCase().includes(query) ||
        inv.creator.toLowerCase().includes(query) ||
        inv.genre.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.investmentDate).getTime() - new Date(b.investmentDate).getTime();
          break;
        case 'value':
          comparison = a.currentValue - b.currentValue;
          break;
        case 'roi':
          comparison = a.roi - b.roi;
          break;
        case 'name':
          comparison = a.pitchTitle.localeCompare(b.pitchTitle);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredInvestments(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'on-hold':
        return <PauseCircle className="h-4 w-4 text-yellow-600" />;
      case 'exited':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      case 'written-off':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'on-hold':
        return 'text-yellow-600 bg-yellow-100';
      case 'exited':
        return 'text-purple-600 bg-purple-100';
      case 'written-off':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'outperforming':
        return 'text-green-600';
      case 'meeting-expectations':
        return 'text-blue-600';
      case 'underperforming':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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

  // Calculate portfolio statistics
  const portfolioStats = {
    totalInvested: investments.reduce((sum, inv) => sum + inv.initialAmount, 0),
    currentValue: investments.reduce((sum, inv) => sum + inv.currentValue, 0),
    totalReturns: investments.reduce((sum, inv) => sum + inv.totalReturn, 0),
    activeCount: investments.filter(inv => inv.status === 'active').length,
    avgROI: investments.length > 0 
      ? investments.reduce((sum, inv) => sum + inv.roi, 0) / investments.length 
      : 0
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
          <h1 className="text-3xl font-bold text-gray-900">All Investments</h1>
          <p className="text-gray-600 mt-2">
            Complete overview of your investment portfolio
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invested</p>
                  <p className="text-xl font-bold">{formatCurrency(portfolioStats.totalInvested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Value</p>
                  <p className="text-xl font-bold">{formatCurrency(portfolioStats.currentValue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Returns</p>
                  <p className={`text-xl font-bold ${portfolioStats.totalReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(portfolioStats.totalReturns)}
                  </p>
                </div>
                <Award className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-xl font-bold">{portfolioStats.activeCount}</p>
                </div>
                <Film className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg ROI</p>
                  <p className={`text-xl font-bold ${portfolioStats.avgROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {portfolioStats.avgROI.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search investments..."
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
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
                <option value="exited">Exited</option>
                <option value="written-off">Written Off</option>
              </select>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Stages</option>
                <option value="pre-production">Pre-Production</option>
                <option value="production">Production</option>
                <option value="post-production">Post-Production</option>
                <option value="distribution">Distribution</option>
                <option value="released">Released</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="date">Sort by Date</option>
                <option value="value">Sort by Value</option>
                <option value="roi">Sort by ROI</option>
                <option value="name">Sort by Name</option>
              </select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Investments Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Investment Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvestments.map((investment) => (
                    <tr key={investment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {investment.pitchTitle}
                          </div>
                          <div className="text-sm text-gray-500">
                            {investment.company}
                          </div>
                          <div className="text-xs text-gray-400">
                            {investment.genre} • {investment.creator}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatCurrency(investment.initialAmount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(investment.investmentDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {investment.ownership}% ownership
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(investment.currentValue)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Last: {new Date(investment.lastValuation).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center text-sm font-medium ${
                          investment.roi >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {investment.roi >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {Math.abs(investment.roi)}%
                        </div>
                        <div className={`text-xs ${getPerformanceColor(investment.performance)}`}>
                          {investment.performance.replace('-', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(investment.status)}
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investment.status)}`}>
                            {investment.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {investment.stage.replace('-', ' ')}
                        </div>
                        {investment.nextMilestone && (
                          <div className="text-xs text-gray-500">
                            Next: {investment.nextMilestone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {filteredInvestments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Film className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No investments found</h3>
              <p className="text-gray-600">Try adjusting your filters or search criteria</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AllInvestments;