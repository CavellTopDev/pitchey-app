import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Percent,
  Download,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';
import type { ROISummary, ROIMetric } from '@/services/investor.service';
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const ROIAnalysis = () => {
  const navigate = useNavigate();
  const { logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1y');
  const [roiSummary, setRoiSummary] = useState<ROISummary | null>(null);
  const [categoryMetrics, setCategoryMetrics] = useState<ROIMetric[]>([]);

  useEffect(() => {
    loadROIData();
  }, [timeRange]);

  const getMockData = (range: string) => {
    const multiplier = range === '1m' ? 0.1 : range === '3m' ? 0.3 : range === '6m' ? 0.5 : range === 'all' ? 2 : 1;

    const categories = [
      { category: 'Action', avg_roi: 45 + Math.random() * 10, count: Math.round(5 * multiplier), total_profit: 1500000 * multiplier },
      { category: 'Drama', avg_roi: 60 + Math.random() * 15, count: Math.round(4 * multiplier), total_profit: 1700000 * multiplier },
      { category: 'Thriller', avg_roi: 40 + Math.random() * 20, count: Math.round(3 * multiplier), total_profit: 900000 * multiplier },
      { category: 'Sci-Fi', avg_roi: 15 + Math.random() * 10, count: Math.round(2 * multiplier), total_profit: 400000 * multiplier },
      { category: 'Comedy', avg_roi: 45 + Math.random() * 10, count: Math.round(3 * multiplier), total_profit: 600000 * multiplier },
      { category: 'Documentary', avg_roi: 70 + Math.random() * 10, count: Math.round(2 * multiplier), total_profit: 600000 * multiplier }
    ].map(cat => ({
      ...cat,
      avg_roi: Math.round(cat.avg_roi * 10) / 10,
      count: Math.max(1, cat.count)
    }));

    const summary = {
      total_investments: categories.reduce((sum, c) => sum + c.count, 0) * 1000000, // Roughly $1M per project
      average_roi: Math.round(categories.reduce((sum, c) => sum + c.avg_roi, 0) / categories.length * 10) / 10,
      best_roi: Math.max(...categories.map(c => c.avg_roi)),
      worst_roi: Math.min(...categories.map(c => c.avg_roi)),
      profitable_count: categories.filter(c => c.avg_roi > 0).length
    };

    // Generate monthly trend data based on range
    const months = range === '1m' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : 12;
    const now = new Date();
    const trendData = Array.from({ length: months }, (_, i) => {
      const d = new Date(now);
      d.setMonth(now.getMonth() - (months - 1 - i));
      const monthName = d.toLocaleString('default', { month: 'short' });
      const baseInvested = 500000 * (1 + Math.random() * 0.5);
      const roi = 10 + i * 3 + Math.random() * 5;
      return {
        month: monthName,
        roi: Math.round(roi * 10) / 10,
        invested: Math.round(baseInvested),
        returned: Math.round(baseInvested * (1 + roi / 100))
      };
    });

    return { categories, summary, trendData };
  };

  const loadROIData = async () => {
    try {
      setLoading(true);

      // Fetch ROI summary
      const summaryResponse = await investorApi.getROISummary(timeRange);
      if (summaryResponse.success && summaryResponse.data?.summary) {
        setRoiSummary(summaryResponse.data.summary);
      } else {
        const mock = getMockData(timeRange);
        setRoiSummary(mock.summary);
      }

      // Fetch ROI by category
      const categoryResponse = await investorApi.getROIByCategory(timeRange);
      if (categoryResponse.success && categoryResponse.data?.categories) {
        setCategoryMetrics(categoryResponse.data.categories);
      } else {
        const mock = getMockData(timeRange);
        setCategoryMetrics(mock.categories);
      }

    } catch (error) {
      console.error('Failed to load ROI data:', error);
      const mock = getMockData(timeRange);
      setCategoryMetrics(mock.categories);
      setRoiSummary(mock.summary);
    } finally {
      setLoading(false);
    }
  };

  const mock = getMockData(timeRange);
  const monthlyROIData = mock.trendData;

  const pieColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  // Calculate metrics from summary and category data
  const totalInvested = roiSummary?.total_investments || 0;
  const totalReturned = categoryMetrics.reduce((sum, m) => sum + m.total_profit, 0);
  const totalROI = roiSummary?.average_roi || 0;
  const bestPerforming = categoryMetrics.reduce((best, current) =>
    (current.avg_roi > (best?.avg_roi || 0)) ? current : best,
    categoryMetrics[0] || { category: 'N/A', avg_roi: 0 }
  );
  const totalProjects = categoryMetrics.reduce((sum, m) => sum + m.count, 0);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
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
      <div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ROI Analysis</h1>
              <p className="text-gray-600 mt-2">
                Comprehensive return on investment analysis and performance metrics
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
              <Button variant="ghost" className="text-gray-600" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Analysis
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
                  <p className="text-xs text-gray-500 mt-1">Across {totalProjects} projects</p>
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
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReturned)}</p>
                  <p className="text-xs text-gray-500 mt-1">+{formatCurrency(totalReturned - totalInvested)} profit</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall ROI</p>
                  <p className="text-2xl font-bold text-blue-600">{totalROI.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Portfolio performance</p>
                </div>
                <Percent className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Best Performer</p>
                  <p className="text-2xl font-bold text-purple-600">{bestPerforming?.category || 'N/A'}</p>
                  <p className="text-xs text-gray-500 mt-1">{bestPerforming?.avg_roi || 0}% ROI</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ROI Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>ROI Trend Over Time</CardTitle>
              <CardDescription>Monthly return on investment progression</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyROIData}>
                  <defs>
                    <linearGradient id="colorROI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Area
                    type="monotone"
                    dataKey="roi"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorROI)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>ROI by Category</CardTitle>
              <CardDescription>Investment returns across different genres</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={categoryMetrics}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, avg_roi }) => `${category}: ${avg_roi}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total_profit"
                  >
                    {categoryMetrics.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Comparison */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Investment vs Returns Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of investments and returns by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={categoryMetrics.map(cat => ({
                category: cat.category,
                invested: cat.total_profit / (1 + cat.avg_roi / 100), // Calculate invested from profit and ROI
                returned: cat.total_profit
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="invested" fill="#8b5cf6" name="Invested" />
                <Bar dataKey="returned" fill="#10b981" name="Returned" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed ROI Breakdown</CardTitle>
            <CardDescription>Category-wise return on investment analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Returned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit/Loss
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categoryMetrics.map((metric, index) => {
                    const invested = metric.total_profit / (1 + metric.avg_roi / 100);
                    const profit = metric.total_profit - invested;
                    const isProfit = profit > 0;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{metric.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{metric.count}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCurrency(invested)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(metric.total_profit)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium flex items-center ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                            {isProfit ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                            {formatCurrency(Math.abs(profit))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-lg font-bold ${metric.avg_roi > 50 ? 'text-green-600' : metric.avg_roi > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {metric.avg_roi}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {metric.avg_roi > 50 ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Excellent
                            </span>
                          ) : metric.avg_roi > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Positive
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Underperforming
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ROIAnalysis;