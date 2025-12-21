import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, Trophy, Film, Calendar, DollarSign,
  Star, TrendingUp, Award, Download, Search,
  Filter, BarChart3, Users, Globe, Clock,
  Play, FileText, ExternalLink, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

interface CompletedProject {
  id: string;
  title: string;
  company: string;
  genre: string;
  completionDate: string;
  investmentAmount: number;
  finalReturn: number;
  roi: number;
  duration: string;
  distributionStatus: 'released' | 'in-distribution' | 'pending-release';
  revenue: {
    boxOffice?: number;
    streaming?: number;
    international?: number;
    merchandising?: number;
    total: number;
  };
  awards: string[];
  rating: number;
  synopsis: string;
  marketPerformance: 'exceeded' | 'met' | 'below' | 'pending';
}

const CompletedProjects = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<CompletedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'released' | 'in-distribution' | 'pending-release'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'roi' | 'revenue'>('recent');

  useEffect(() => {
    loadCompletedProjects();
  }, []);

  const loadCompletedProjects = async () => {
    try {
      setLoading(true);
      // Simulated data - replace with actual API call
      setTimeout(() => {
        setProjects([
          {
            id: '1',
            title: 'Lost Paradise',
            company: 'Paradise Films',
            genre: 'Adventure Drama',
            completionDate: '2024-08-15',
            investmentAmount: 1000000,
            finalReturn: 2850000,
            roi: 185,
            duration: '18 months',
            distributionStatus: 'released',
            revenue: {
              boxOffice: 15000000,
              streaming: 3500000,
              international: 8000000,
              merchandising: 500000,
              total: 27000000
            },
            awards: ['Cannes Film Festival - Best Cinematography', 'Toronto International - Audience Choice'],
            rating: 8.2,
            synopsis: 'An epic adventure about finding redemption in unexpected places.',
            marketPerformance: 'exceeded'
          },
          {
            id: '2',
            title: 'City of Shadows',
            company: 'Noir Productions',
            genre: 'Crime Thriller',
            completionDate: '2024-06-20',
            investmentAmount: 750000,
            finalReturn: 1200000,
            roi: 60,
            duration: '14 months',
            distributionStatus: 'in-distribution',
            revenue: {
              boxOffice: 8500000,
              streaming: 2000000,
              international: 4500000,
              total: 15000000
            },
            awards: ['Venice Film Festival - Silver Lion'],
            rating: 7.8,
            synopsis: 'A gripping thriller set in the underbelly of metropolitan crime.',
            marketPerformance: 'met'
          },
          {
            id: '3',
            title: 'The Last Symphony',
            company: 'Harmony Studios',
            genre: 'Musical Drama',
            completionDate: '2024-04-10',
            investmentAmount: 500000,
            finalReturn: 950000,
            roi: 90,
            duration: '20 months',
            distributionStatus: 'released',
            revenue: {
              boxOffice: 6000000,
              streaming: 1500000,
              international: 3000000,
              merchandising: 200000,
              total: 10700000
            },
            awards: ['Academy Award Nomination - Best Original Score'],
            rating: 8.5,
            synopsis: 'A touching story about music transcending generations.',
            marketPerformance: 'exceeded'
          },
          {
            id: '4',
            title: 'Digital Frontier',
            company: 'Tech Cinema',
            genre: 'Sci-Fi',
            completionDate: '2024-09-30',
            investmentAmount: 1500000,
            finalReturn: 1800000,
            roi: 20,
            duration: '24 months',
            distributionStatus: 'pending-release',
            revenue: {
              total: 0
            },
            awards: [],
            rating: 0,
            synopsis: 'A groundbreaking sci-fi epic exploring the boundaries of AI consciousness.',
            marketPerformance: 'pending'
          },
          {
            id: '5',
            title: 'Echoes of Time',
            company: 'Heritage Films',
            genre: 'Historical Drama',
            completionDate: '2024-03-05',
            investmentAmount: 2000000,
            finalReturn: 4500000,
            roi: 125,
            duration: '22 months',
            distributionStatus: 'released',
            revenue: {
              boxOffice: 25000000,
              streaming: 5000000,
              international: 15000000,
              merchandising: 1000000,
              total: 46000000
            },
            awards: ['Golden Globe - Best Picture', 'BAFTA - Best Director', 'Critics Choice Award'],
            rating: 8.7,
            synopsis: 'An epic historical drama spanning three generations.',
            marketPerformance: 'exceeded'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load completed projects:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released':
        return 'text-green-600 bg-green-100';
      case 'in-distribution':
        return 'text-blue-600 bg-blue-100';
      case 'pending-release':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'exceeded':
        return 'text-green-600';
      case 'met':
        return 'text-blue-600';
      case 'below':
        return 'text-red-600';
      case 'pending':
        return 'text-gray-600';
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

  const filteredProjects = projects
    .filter(project => {
      if (filterStatus !== 'all' && project.distributionStatus !== filterStatus) return false;
      if (searchQuery && !project.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !project.company.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !project.genre.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'roi':
          return b.roi - a.roi;
        case 'revenue':
          return b.revenue.total - a.revenue.total;
        case 'recent':
        default:
          return new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime();
      }
    });

  const totalInvested = projects.reduce((sum, p) => sum + p.investmentAmount, 0);
  const totalReturns = projects.reduce((sum, p) => sum + p.finalReturn, 0);
  const averageROI = projects.length > 0 ? projects.reduce((sum, p) => sum + p.roi, 0) / projects.length : 0;
  const successfulProjects = projects.filter(p => p.roi > 50).length;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNavigation 
        user={user}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Completed Projects</h1>
              <p className="text-gray-600 mt-2">
                Review your successful investments and their performance
              </p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Returns</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReturns)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average ROI</p>
                  <p className="text-2xl font-bold text-blue-600">{averageROI.toFixed(1)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {((successfulProjects / projects.length) * 100).toFixed(0)}%
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="released">Released</option>
                <option value="in-distribution">In Distribution</option>
                <option value="pending-release">Pending Release</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="recent">Most Recent</option>
                <option value="roi">Highest ROI</option>
                <option value="revenue">Highest Revenue</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <div className="space-y-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Project Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                        <p className="text-sm text-gray-600">{project.company} • {project.genre}</p>
                      </div>
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(project.distributionStatus)}`}>
                        {project.distributionStatus.replace('-', ' ')}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4">{project.synopsis}</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Completion Date</p>
                        <p className="text-sm font-medium">{new Date(project.completionDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-medium">{project.duration}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Market Performance</p>
                        <p className={`text-sm font-medium ${getPerformanceColor(project.marketPerformance)}`}>
                          {project.marketPerformance}
                        </p>
                      </div>
                      {project.rating > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Rating</p>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-500 mr-1" />
                            <span className="text-sm font-medium">{project.rating}/10</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Awards */}
                    {project.awards.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Awards & Recognition</p>
                        <div className="flex flex-wrap gap-2">
                          {project.awards.map((award, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                              <Award className="h-3 w-3 mr-1" />
                              {award}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial Performance */}
                  <div className="lg:w-80">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Financial Performance</h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Investment</span>
                          <span className="text-sm font-medium">{formatCurrency(project.investmentAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Returns</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(project.finalReturn)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                          <span className="text-sm font-semibold">ROI</span>
                          <span className={`text-lg font-bold ${project.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {project.roi > 0 ? '+' : ''}{project.roi}%
                          </span>
                        </div>
                      </div>

                      {project.revenue.total > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-semibold text-gray-900 mb-2">Revenue Breakdown</p>
                          <div className="space-y-2 text-xs">
                            {project.revenue.boxOffice && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Box Office</span>
                                <span>{formatCurrency(project.revenue.boxOffice)}</span>
                              </div>
                            )}
                            {project.revenue.streaming && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Streaming</span>
                                <span>{formatCurrency(project.revenue.streaming)}</span>
                              </div>
                            )}
                            {project.revenue.international && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">International</span>
                                <span>{formatCurrency(project.revenue.international)}</span>
                              </div>
                            )}
                            {project.revenue.merchandising && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Merchandising</span>
                                <span>{formatCurrency(project.revenue.merchandising)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold pt-2 border-t">
                              <span>Total Revenue</span>
                              <span>{formatCurrency(project.revenue.total)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <FileText className="h-3 w-3 mr-1" />
                          Report
                        </Button>
                        <Button size="sm" className="flex-1">
                          View Details
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No completed projects found</h3>
              <p className="text-gray-600">Try adjusting your filters or search criteria</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CompletedProjects;