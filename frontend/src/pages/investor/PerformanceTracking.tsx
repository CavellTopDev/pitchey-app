import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, DollarSign, Target, Award,
  Calendar, BarChart3, PieChart, Download, RefreshCw,
  ArrowUp, ArrowDown, Activity, Globe, Users, Building,
  Clock, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number | string;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  color: string;
  description: string;
}

interface InvestmentPerformance {
  id: string;
  pitchTitle: string;
  company: string;
  investmentDate: string;
  investedAmount: number;
  currentValue: number;
  roi: number;
  status: 'performing' | 'underperforming' | 'on-track' | 'completed';
  milestones: {
    completed: number;
    total: number;
  };
  nextMilestone: string;
  risk: 'low' | 'medium' | 'high';
}

const PerformanceTracking = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1y');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [investments, setInvestments] = useState<InvestmentPerformance[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('all');

  useEffect(() => {
    loadPerformanceData();
  }, [timeRange]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMetrics([
          {
            id: '1',
            name: 'Portfolio Value',
            value: '$12.5M',
            change: 15.8,
            changeType: 'positive',
            icon: DollarSign,
            color: 'text-green-600',
            description: 'Total value of all investments'
          },
          {
            id: '2',
            name: 'Total ROI',
            value: '28.5%',
            change: 3.2,
            changeType: 'positive',
            icon: TrendingUp,
            color: 'text-blue-600',
            description: 'Return on investment across portfolio'
          },
          {
            id: '3',
            name: 'Active Projects',
            value: 18,
            change: 2,
            changeType: 'positive',
            icon: Activity,
            color: 'text-purple-600',
            description: 'Currently active investments'
          },
          {
            id: '4',
            name: 'Success Rate',
            value: '73%',
            change: -2.1,
            changeType: 'negative',
            icon: Target,
            color: 'text-orange-600',
            description: 'Percentage of profitable investments'
          },
          {
            id: '5',
            name: 'Avg. Hold Period',
            value: '2.3 years',
            change: 0.1,
            changeType: 'neutral',
            icon: Clock,
            color: 'text-gray-600',
            description: 'Average investment duration'
          },
          {
            id: '6',
            name: 'Risk Score',
            value: 'Moderate',
            change: 0,
            changeType: 'neutral',
            icon: AlertCircle,
            color: 'text-yellow-600',
            description: 'Overall portfolio risk assessment'
          }
        ]);

        setInvestments([
          {
            id: '1',
            pitchTitle: 'The Quantum Paradox',
            company: 'Quantum Films Ltd',
            investmentDate: '2024-01-15',
            investedAmount: 500000,
            currentValue: 725000,
            roi: 45,
            status: 'performing',
            milestones: { completed: 7, total: 10 },
            nextMilestone: 'Post-production completion',
            risk: 'low'
          },
          {
            id: '2',
            pitchTitle: 'Urban Legends',
            company: 'Dark Horse Productions',
            investmentDate: '2023-11-20',
            investedAmount: 750000,
            currentValue: 820000,
            roi: 9.3,
            status: 'on-track',
            milestones: { completed: 4, total: 8 },
            nextMilestone: 'Principal photography',
            risk: 'medium'
          },
          {
            id: '3',
            pitchTitle: 'Digital Dreams',
            company: 'Tech Cinema Co',
            investmentDate: '2023-08-10',
            investedAmount: 300000,
            currentValue: 280000,
            roi: -6.7,
            status: 'underperforming',
            milestones: { completed: 3, total: 9 },
            nextMilestone: 'Script revision',
            risk: 'high'
          },
          {
            id: '4',
            pitchTitle: 'Lost Paradise',
            company: 'Paradise Films',
            investmentDate: '2023-06-05',
            investedAmount: 1000000,
            currentValue: 1450000,
            roi: 45,
            status: 'completed',
            milestones: { completed: 10, total: 10 },
            nextMilestone: 'Distribution phase',
            risk: 'low'
          },
          {
            id: '5',
            pitchTitle: 'Midnight Chronicles',
            company: 'Moonlight Studios',
            investmentDate: '2024-02-20',
            investedAmount: 450000,
            currentValue: 495000,
            roi: 10,
            status: 'on-track',
            milestones: { completed: 5, total: 11 },
            nextMilestone: 'Cast finalization',
            risk: 'medium'
          }
        ]);
        
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load performance data:', error);
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
      case 'performing':
        return 'text-green-600 bg-green-100';
      case 'on-track':
        return 'text-blue-600 bg-blue-100';
      case 'underperforming':
        return 'text-red-600 bg-red-100';
      case 'completed':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
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
              <h1 className="text-3xl font-bold text-gray-900">Performance Tracking</h1>
              <p className="text-gray-600 mt-2">
                Monitor and analyze the performance of your investment portfolio
              </p>
            </div>
            <div className="flex gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="1m">Last Month</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last Year</option>
                <option value="all">All Time</option>
              </select>
              <Button variant="outline" size="icon" onClick={loadPerformanceData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-5 w-5 ${metric.color}`} />
                    {metric.changeType !== 'neutral' && (
                      <div className={`flex items-center text-sm ${
                        metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.changeType === 'positive' ? (
                          <ArrowUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDown className="h-3 w-3 mr-1" />
                        )}
                        {Math.abs(metric.change)}%
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                  <div className="text-xs text-gray-600 mt-1">{metric.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{metric.description}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Chart Placeholder */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Portfolio Performance Over Time</CardTitle>
            <CardDescription>Track your portfolio value and ROI trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>Performance chart would be displayed here</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Investment Performance Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Individual Investment Performance</CardTitle>
                <CardDescription>Detailed tracking of each investment in your portfolio</CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Investments</option>
                  <option value="performing">Performing</option>
                  <option value="on-track">On Track</option>
                  <option value="underperforming">Underperforming</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Investment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {investments.map((investment) => (
                    <tr key={investment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {investment.pitchTitle}
                          </div>
                          <div className="text-sm text-gray-500">
                            {investment.company}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatCurrency(investment.investedAmount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(investment.investmentDate).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(investment.currentValue)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className={`flex items-center text-sm font-medium ${
                          investment.roi > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {investment.roi > 0 ? (
                            <ArrowUp className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDown className="h-3 w-3 mr-1" />
                          )}
                          {Math.abs(investment.roi)}%
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {investment.milestones.completed}/{investment.milestones.total} milestones
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${(investment.milestones.completed / investment.milestones.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investment.status)}`}>
                          {investment.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getRiskColor(investment.risk)}`}>
                          {investment.risk}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PerformanceTracking;