import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Briefcase, 
  PieChart, 
  Star, 
  Users,
  Target,
  BarChart3,
  TrendingDown,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';
import { analyticsService } from '../../services/analytics.service';
import type { TimeRange } from '../../services/analytics.service';
import { 
  LineChart, 
  BarChart, 
  PieChart as PieChartComponent, 
  ChartContainer,
  MultiLineChart,
  AreaChart,
  StackedBarChart
} from './AnalyticsCharts';

interface InvestorAnalyticsProps {
  portfolioPerformance?: {
    totalInvestments: number;
    totalInvested: number;
    activeDeals: number;
    averageReturn: number;
    returnChange: number;
    ndaSignedCount: number;
    recommendationMatchRate: number;
  };
}

interface InvestorAnalyticsData {
  kpis: {
    totalInvestments: number;
    totalInvested: number;
    portfolioValue: number;
    activeDeals: number;
    averageROI: number;
    successRate: number;
    monthlyDeals: number;
    ndasSigned: number;
    diversificationIndex: number;
    riskScore: number;
  };
  changes: {
    investmentsChange: number;
    investedChange: number;
    portfolioChange: number;
    dealsChange: number;
    roiChange: number;
    successChange: number;
    monthlyDealsChange: number;
    ndaChange: number;
    diversificationChange: number;
    riskChange: number;
  };
  charts: {
    portfolioGrowth: { date: string; value: number }[];
    investmentsByCategory: { category: string; amount: number; count: number }[];
    dealFlow: { date: string; value: number }[];
    roiTrends: { date: string; value: number }[];
    riskAssessment: { risk: string; count: number }[];
    monthlyPerformance: { month: string; invested: number; returns: number; deals: number }[];
    topInvestments: { title: string; amount: number; roi: number; status: string }[];
    marketSegments: { segment: string; allocation: number; performance: number }[];
  };
}

export const EnhancedInvestorAnalytics: React.FC<InvestorAnalyticsProps> = ({ 
  portfolioPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<InvestorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh, fetchAnalyticsData]);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Map time range to preset
      const preset: TimeRange['preset'] = timeRange === '7d' ? 'week' : 
                                         timeRange === '30d' ? 'month' :
                                         timeRange === '90d' ? 'quarter' : 'year';
      
      const [dashboardMetrics] = await Promise.all([
        analyticsService.getDashboardMetrics({ preset })
      ]);

      // Transform the data (using mock data for investor-specific metrics)
      const transformedData: InvestorAnalyticsData = getMockData();
      setAnalyticsData(transformedData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData(getMockData());
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const getMockData = (): InvestorAnalyticsData => ({
    kpis: {
      totalInvestments: 15,
      totalInvested: 2500000,
      portfolioValue: 3200000,
      activeDeals: 8,
      averageROI: 22.5,
      successRate: 73,
      monthlyDeals: 3,
      ndasSigned: 45,
      diversificationIndex: 7.8,
      riskScore: 6.2,
    },
    changes: {
      investmentsChange: 25,
      investedChange: 18,
      portfolioChange: 28,
      dealsChange: 14,
      roiChange: 3.2,
      successChange: 5,
      monthlyDealsChange: 0,
      ndaChange: 15,
      diversificationChange: 0.5,
      riskChange: -0.3,
    },
    charts: {
      portfolioGrowth: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: 1500000 + i * 85000 + Math.floor(Math.random() * 50000),
      })),
      investmentsByCategory: [
        { category: 'Action', amount: 650000, count: 4 },
        { category: 'Drama', amount: 450000, count: 3 },
        { category: 'Comedy', amount: 350000, count: 2 },
        { category: 'Thriller', amount: 550000, count: 3 },
        { category: 'Sci-Fi', amount: 750000, count: 3 },
        { category: 'Documentary', amount: 245000, count: 2 },
      ],
      dealFlow: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: Math.floor(Math.random() * 5) + 1,
      })),
      roiTrends: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2024, i, 1).toISOString().split('T')[0],
        value: 15 + Math.floor(Math.random() * 15) + i * 0.5,
      })),
      riskAssessment: [
        { risk: 'Low Risk', count: 6 },
        { risk: 'Medium Risk', count: 7 },
        { risk: 'High Risk', count: 2 },
      ],
      monthlyPerformance: Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' }),
        invested: Math.floor(Math.random() * 200000) + 150000,
        returns: Math.floor(Math.random() * 50000) + 25000,
        deals: Math.floor(Math.random() * 3) + 1,
      })),
      topInvestments: [
        { title: 'Time Traveler\'s Dilemma', amount: 250000, roi: 28.5, status: 'Active' },
        { title: 'The Last Symphony', amount: 180000, roi: 35.2, status: 'Completed' },
        { title: 'Digital Rebellion', amount: 320000, roi: 22.8, status: 'Active' },
        { title: 'Ocean\'s Secret', amount: 150000, roi: 41.5, status: 'Completed' },
        { title: 'The Forgotten City', amount: 200000, roi: 18.9, status: 'Active' },
        { title: 'Midnight Protocol', amount: 275000, roi: 31.7, status: 'Active' },
      ],
      marketSegments: [
        { segment: 'Feature Films', allocation: 65, performance: 24.5 },
        { segment: 'Short Films', allocation: 20, performance: 18.2 },
        { segment: 'Documentaries', allocation: 10, performance: 15.8 },
        { segment: 'Web Series', allocation: 5, performance: 22.1 },
      ]
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load analytics data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Investment Portfolio Analytics</h2>
            <p className="text-gray-600">Monitor your investment performance and portfolio growth</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
            
            <TimeRangeFilter 
              onChange={(range) => setTimeRange(range)}
              defaultRange="30d"
            />
            
            <AnalyticsExport 
              data={analyticsData}
              title="Investor Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Investments"
          value={analyticsData.kpis.totalInvestments}
          change={analyticsData.changes.investmentsChange}
          icon={<Briefcase className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Portfolio Value"
          value={analyticsData.kpis.portfolioValue}
          change={analyticsData.changes.portfolioChange}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Average ROI"
          value={analyticsData.kpis.averageROI}
          change={analyticsData.changes.roiChange}
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="percentage"
        />
        <AnalyticCard 
          title="Active Deals"
          value={analyticsData.kpis.activeDeals}
          change={analyticsData.changes.dealsChange}
          icon={<Target className="w-5 h-5 text-orange-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Success Rate"
          value={analyticsData.kpis.successRate}
          change={analyticsData.changes.successChange}
          icon={<Star className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Invested"
          value={analyticsData.kpis.totalInvested}
          change={analyticsData.changes.investedChange}
          icon={<DollarSign className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
          format="currency"
        />
        <AnalyticCard 
          title="Monthly Deals"
          value={analyticsData.kpis.monthlyDeals}
          change={analyticsData.changes.monthlyDealsChange}
          icon={<BarChart3 className="w-5 h-5 text-teal-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="NDAs Signed"
          value={analyticsData.kpis.ndasSigned}
          change={analyticsData.changes.ndaChange}
          icon={<Users className="w-5 h-5 text-pink-500" />}
          variant="danger"
        />
        <AnalyticCard 
          title="Diversification Index"
          value={analyticsData.kpis.diversificationIndex.toFixed(1)}
          change={analyticsData.changes.diversificationChange}
          icon={<PieChart className="w-5 h-5 text-cyan-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="Risk Score"
          value={analyticsData.kpis.riskScore.toFixed(1)}
          change={analyticsData.changes.riskChange}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          variant="danger"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Growth */}
        <ChartContainer title="Portfolio Value Growth">
          <AreaChart
            data={analyticsData.charts.portfolioGrowth}
            title="Portfolio Value ($)"
            color="#10B981"
            height={300}
          />
        </ChartContainer>

        {/* ROI Trends */}
        <ChartContainer title="ROI Trends">
          <LineChart
            data={analyticsData.charts.roiTrends}
            title="ROI (%)"
            color="#8B5CF6"
            height={300}
          />
        </ChartContainer>

        {/* Investment by Category */}
        <ChartContainer title="Investments by Category">
          <BarChart
            data={analyticsData.charts.investmentsByCategory.map(item => ({
              category: item.category,
              value: item.amount
            }))}
            title="Investment Amount ($)"
            height={300}
          />
        </ChartContainer>

        {/* Risk Assessment */}
        <ChartContainer title="Portfolio Risk Distribution">
          <PieChartComponent
            data={analyticsData.charts.riskAssessment.map(item => ({
              category: item.risk,
              value: item.count
            }))}
            title="Investment Risk Levels"
            type="doughnut"
            height={300}
          />
        </ChartContainer>

        {/* Deal Flow */}
        <ChartContainer title="Monthly Deal Flow">
          <BarChart
            data={analyticsData.charts.dealFlow.map((item, index) => ({
              category: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
              value: item.value
            }))}
            title="Number of Deals"
            height={300}
          />
        </ChartContainer>

        {/* Market Segments Performance */}
        <ChartContainer title="Market Segment Performance">
          <MultiLineChart
            datasets={[
              {
                label: 'Allocation (%)',
                data: analyticsData.charts.marketSegments.map(item => ({
                  date: item.segment,
                  value: item.allocation
                })),
                color: '#3B82F6'
              },
              {
                label: 'Performance (%)',
                data: analyticsData.charts.marketSegments.map(item => ({
                  date: item.segment,
                  value: item.performance
                })),
                color: '#EF4444'
              }
            ]}
            height={300}
          />
        </ChartContainer>
      </div>

      {/* Monthly Performance Overview */}
      <ChartContainer title="Monthly Investment Performance">
        <StackedBarChart
          data={analyticsData.charts.monthlyPerformance.map(item => ({
            category: item.month,
            values: [
              { label: 'Invested', value: item.invested / 1000 },
              { label: 'Returns', value: item.returns / 1000 }
            ]
          }))}
          height={350}
        />
      </ChartContainer>

      {/* Top Investments */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Top Investment Opportunities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsData.charts.topInvestments.map((investment, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 truncate flex-1">{investment.title}</h4>
                <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                  investment.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {investment.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Investment</p>
                  <p className="font-semibold">${(investment.amount / 1000).toFixed(0)}k</p>
                </div>
                <div>
                  <p className="text-gray-600">ROI</p>
                  <p className={`font-semibold ${
                    investment.roi > 25 ? 'text-green-600' : 
                    investment.roi > 15 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {investment.roi.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Diversification</span>
              <span className="font-semibold text-green-600">Excellent</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Risk Level</span>
              <span className="font-semibold text-yellow-600">Moderate</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Liquidity</span>
              <span className="font-semibold text-blue-600">High</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Performance</span>
              <span className="font-semibold text-green-600">Above Market</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Insights</h3>
          <div className="space-y-3">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800">Action films showing 15% growth</p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">Comedy genre underperforming</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">Documentary market expanding</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            <div className="border-l-4 border-blue-500 pl-3">
              <p className="text-sm text-gray-700">Consider increasing Sci-Fi allocation</p>
            </div>
            <div className="border-l-4 border-green-500 pl-3">
              <p className="text-sm text-gray-700">Excellent ROI in current portfolio</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-3">
              <p className="text-sm text-gray-700">Monitor risk levels closely</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInvestorAnalytics;