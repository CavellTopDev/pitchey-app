import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, PieChart, 
  Target, DollarSign, Users, Calendar, Download, 
  Filter, RefreshCw, ArrowUpRight, ArrowDownRight,
  Globe, Activity, Zap, Award, Eye, Clock,
  AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import DashboardHeader from '../../components/DashboardHeader';
import { useAuthStore } from '../../store/authStore';

interface AnalyticsMetric {
  id: string;
  title: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<any>;
  format: 'currency' | 'percentage' | 'number';
  description: string;
}

interface MarketTrend {
  sector: string;
  growth: number;
  opportunities: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface InvestmentFlow {
  month: string;
  invested: number;
  returned: number;
  netFlow: number;
}

interface CreatorInsight {
  name: string;
  genre: string;
  performance: number;
  riskScore: number;
  potentialROI: number;
  recommendationLevel: number; // 1-5 scale
}

export default function InvestorAnalytics() {
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('3m');
  const [filterType, setFilterType] = useState('all');
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetric[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  const [investmentFlows, setInvestmentFlows] = useState<InvestmentFlow[]>([]);
  const [creatorInsights, setCreatorInsights] = useState<CreatorInsight[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, filterType]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        // Mock analytics metrics
        setAnalyticsMetrics([
          {
            id: '1',
            title: 'Portfolio Growth Rate',
            value: 24.5,
            change: 4.2,
            changeType: 'increase',
            icon: TrendingUp,
            format: 'percentage',
            description: 'Average monthly growth'
          },
          {
            id: '2',
            title: 'Investment Velocity',
            value: 850000,
            change: 12.8,
            changeType: 'increase',
            icon: Zap,
            format: 'currency',
            description: 'Capital deployed this quarter'
          },
          {
            id: '3',
            title: 'Market Opportunities',
            value: 47,
            change: 8,
            changeType: 'increase',
            icon: Target,
            format: 'number',
            description: 'New investment targets identified'
          },
          {
            id: '4',
            title: 'Risk-Adjusted Return',
            value: 18.9,
            change: 2.1,
            changeType: 'increase',
            icon: Award,
            format: 'percentage',
            description: 'Sharpe ratio optimized returns'
          }
        ]);

        // Mock market trends
        setMarketTrends([
          {
            sector: 'Sci-Fi/Fantasy',
            growth: 35.2,
            opportunities: 12,
            riskLevel: 'medium',
            recommendation: 'Strong Buy - High streaming demand'
          },
          {
            sector: 'Horror/Thriller',
            growth: 28.7,
            opportunities: 8,
            riskLevel: 'low',
            recommendation: 'Buy - Consistent performance'
          },
          {
            sector: 'Drama',
            growth: 15.4,
            opportunities: 15,
            riskLevel: 'low',
            recommendation: 'Hold - Stable returns'
          },
          {
            sector: 'Comedy',
            growth: 12.1,
            opportunities: 6,
            riskLevel: 'medium',
            recommendation: 'Hold - Market saturation risk'
          },
          {
            sector: 'Documentary',
            growth: 22.8,
            opportunities: 4,
            riskLevel: 'high',
            recommendation: 'Cautious - Niche market'
          }
        ]);

        // Mock investment flows
        setInvestmentFlows([
          { month: 'Jul 2024', invested: 450000, returned: 320000, netFlow: -130000 },
          { month: 'Aug 2024', invested: 380000, returned: 420000, netFlow: 40000 },
          { month: 'Sep 2024', invested: 520000, returned: 380000, netFlow: -140000 },
          { month: 'Oct 2024', invested: 420000, returned: 550000, netFlow: 130000 },
          { month: 'Nov 2024', invested: 380000, returned: 480000, netFlow: 100000 },
          { month: 'Dec 2024', invested: 460000, returned: 620000, netFlow: 160000 }
        ]);

        // Mock creator insights
        setCreatorInsights([
          {
            name: 'Sarah Chen',
            genre: 'Sci-Fi',
            performance: 42.3,
            riskScore: 3.2,
            potentialROI: 380,
            recommendationLevel: 5
          },
          {
            name: 'Marcus Rodriguez',
            genre: 'Horror',
            performance: 38.7,
            riskScore: 2.8,
            potentialROI: 420,
            recommendationLevel: 4
          },
          {
            name: 'Elena Volkov',
            genre: 'Drama',
            performance: 22.1,
            riskScore: 2.1,
            potentialROI: 180,
            recommendationLevel: 3
          },
          {
            name: 'James Wright',
            genre: 'Thriller',
            performance: 31.5,
            riskScore: 3.5,
            potentialROI: 290,
            recommendationLevel: 4
          },
          {
            name: 'Anna Kowalski',
            genre: 'Comedy',
            performance: 18.9,
            riskScore: 2.9,
            potentialROI: 150,
            recommendationLevel: 3
          }
        ]);

        setLoading(false);
      }, 1200);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      setLoading(false);
    }
  };

  // Chart configurations
  const marketTrendData = {
    labels: marketTrends.map(trend => trend.sector),
    datasets: [
      {
        label: 'Growth Rate (%)',
        data: marketTrends.map(trend => trend.growth),
        backgroundColor: marketTrends.map(trend => {
          if (trend.growth > 30) return 'rgba(34, 197, 94, 0.8)';
          if (trend.growth > 20) return 'rgba(59, 130, 246, 0.8)';
          if (trend.growth > 15) return 'rgba(251, 146, 60, 0.8)';
          return 'rgba(239, 68, 68, 0.8)';
        }),
        borderColor: marketTrends.map(trend => {
          if (trend.growth > 30) return 'rgb(34, 197, 94)';
          if (trend.growth > 20) return 'rgb(59, 130, 246)';
          if (trend.growth > 15) return 'rgb(251, 146, 60)';
          return 'rgb(239, 68, 68)';
        }),
        borderWidth: 2
      }
    ]
  };

  const investmentFlowData = {
    labels: investmentFlows.map(flow => flow.month),
    datasets: [
      {
        label: 'Invested',
        data: investmentFlows.map(flow => flow.invested),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2
      },
      {
        label: 'Returned',
        data: investmentFlows.map(flow => flow.returned),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2
      }
    ]
  };

  const riskDistributionData = {
    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
    datasets: [
      {
        data: [45, 35, 20],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(251, 146, 60)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 2
      }
    ]
  };

  const performanceRadarData = {
    labels: ['ROI', 'Risk Management', 'Diversification', 'Market Timing', 'Creator Selection', 'Genre Strategy'],
    datasets: [
      {
        label: 'Your Performance',
        data: [85, 78, 92, 71, 88, 83],
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderColor: 'rgb(147, 51, 234)',
        pointBackgroundColor: 'rgb(147, 51, 234)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(147, 51, 234)'
      },
      {
        label: 'Industry Average',
        data: [65, 70, 75, 68, 72, 70],
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        borderColor: 'rgb(156, 163, 175)',
        pointBackgroundColor: 'rgb(156, 163, 175)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(156, 163, 175)'
      }
    ]
  };

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toFixed(0);
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRecommendationStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${i < level ? 'text-yellow-400' : 'text-gray-300'}`}
      >
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          userType="investor"
          title="Investment Analytics"
          onLogout={logout}
          useEnhancedNav={true}
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="investor"
        title="Investment Analytics"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Investment Analytics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Advanced insights and market intelligence for your investment strategy
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex gap-3">
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
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Sectors</option>
              <option value="drama">Drama</option>
              <option value="comedy">Comedy</option>
              <option value="thriller">Thriller</option>
              <option value="scifi">Sci-Fi</option>
              <option value="horror">Horror</option>
            </select>
            
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export Analytics
            </button>
            
            <button onClick={loadAnalyticsData} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Key Analytics Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {analyticsMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.changeType === 'increase' ? 
                      <ArrowUpRight className="w-4 h-4" /> : 
                      <ArrowDownRight className="w-4 h-4" />
                    }
                    {Math.abs(metric.change)}{metric.format === 'percentage' ? '%' : ''}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {formatValue(metric.value, metric.format)}
                  </h3>
                  <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
                  <p className="text-gray-500 text-xs mt-1">{metric.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Market Trends */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Market Growth by Sector</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              <Bar 
                data={marketTrendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value: any) {
                          return `${value}%`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Investment Flows */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Investment vs Returns Flow</h2>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              <Bar 
                data={investmentFlowData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value: any) {
                          return new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(value);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Performance Analysis and Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Performance Radar */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Performance Analysis</h2>
              <Target className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              <Radar 
                data={performanceRadarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const
                    }
                  },
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        stepSize: 20
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Portfolio Risk Distribution</h2>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              <Doughnut 
                data={riskDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Market Trends Table */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Sector Analysis & Recommendations</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sector
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Growth Rate
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opportunities
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {marketTrends.map((trend, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trend.sector}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-semibold text-green-600">
                        +{trend.growth.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{trend.opportunities}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskBadgeColor(trend.riskLevel)}`}>
                        {trend.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{trend.recommendation}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Creator Insights */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Top Creator Investment Insights</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Potential ROI
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {creatorInsights.map((creator, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-purple-200 flex items-center justify-center">
                            <span className="text-xs font-medium text-purple-800">
                              {creator.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                          <div className="text-sm text-gray-500">{creator.genre}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-semibold text-green-600">
                        +{creator.performance.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              creator.riskScore <= 2.5 ? 'bg-green-500' :
                              creator.riskScore <= 3.5 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${(creator.riskScore / 5) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{creator.riskScore.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {creator.potentialROI}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        {getRecommendationStars(creator.recommendationLevel)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}