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
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend
} from 'recharts';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useBetterAuthStore } from '../../store/betterAuthStore';

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
  const { user, logout } = useBetterAuthStore();
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

  // Chart data for Recharts
  const marketTrendChartData = marketTrends.map(trend => ({
    sector: trend.sector,
    growth: trend.growth,
    fill: trend.growth > 30 ? '#22c55e' :
          trend.growth > 20 ? '#3b82f6' :
          trend.growth > 15 ? '#fb923c' :
          '#ef4444'
  }));

  const investmentFlowChartData = investmentFlows.map(flow => ({
    month: flow.month.replace(' 2024', ''),
    invested: flow.invested,
    returned: flow.returned,
    netFlow: flow.netFlow
  }));

  // Debug logging

  const riskDistributionData = [
    { name: 'Low Risk', value: 45, color: '#22c55e' },
    { name: 'Medium Risk', value: 35, color: '#fb923c' },
    { name: 'High Risk', value: 20, color: '#ef4444' }
  ];

  const performanceRadarData = [
    { label: 'ROI', value: 85, industry: 65 },
    { label: 'Risk Management', value: 78, industry: 70 },
    { label: 'Diversification', value: 92, industry: 75 },
    { label: 'Market Timing', value: 71, industry: 68 },
    { label: 'Creator Selection', value: 88, industry: 72 },
    { label: 'Genre Strategy', value: 83, industry: 70 }
  ];

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div>
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
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Loading chart data...
                </div>
              ) : marketTrendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={marketTrendChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sector" />
                    <YAxis 
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${value}%`, 'Growth Rate']}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px' }}
                    />
                    <Bar 
                      dataKey="growth" 
                      radius={[8, 8, 0, 0]}
                      fill="#9333ea"
                    >
                      {marketTrendChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Investment Flows */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Investment vs Returns Flow</h2>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Loading chart data...
                </div>
              ) : investmentFlowChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={investmentFlowChartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      tickFormatter={(value) => 
                        new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                          notation: 'compact'
                        }).format(value)
                      }
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }).format(value),
                        name
                      ]}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="invested" name="Invested" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returned" name="Returned" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
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
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={performanceRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="label" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <RechartsRadar 
                    name="Your Performance"
                    dataKey="value"
                    stroke="#9333ea"
                    fill="#9333ea"
                    fillOpacity={0.3}
                  />
                  <RechartsRadar 
                    name="Industry Average"
                    dataKey="industry"
                    stroke="#9ca3af"
                    fill="#9ca3af"
                    fillOpacity={0.2}
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Distribution */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Portfolio Risk Distribution</h2>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
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