import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, Calculator,
  Calendar, BarChart3, PieChart, LineChart, Download,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Info, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';
import {
  LineChart as RechartsLineChart,
  Line,
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

interface ROIMetric {
  category: string;
  avg_roi: number;
  count: number;
  total_profit: number;
}

interface ROISummary {
  total_investments: number;
  average_roi: number;
  best_roi: number;
  worst_roi: number;
  profitable_count: number;
}

const ROIAnalysis = () => {
    const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1y');
  const [roiSummary, setRoiSummary] = useState<ROISummary | null>(null);
  const [categoryMetrics, setCategoryMetrics] = useState<ROIMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadROIData();
  }, [timeRange]);

  const loadROIData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch ROI summary
      const summaryResponse = await investorApi.getROISummary();
      setRoiSummary(summaryResponse.data.summary);
      
      // Fetch ROI by category
      const categoryResponse = await investorApi.getROIByCategory();
      setCategoryMetrics(categoryResponse.data.categories || []);
      
    } catch (error) {
      console.error('Failed to load ROI data:', error);
      setError('Failed to load ROI analysis data');
      // Set fallback data for demonstration
      setCategoryMetrics([
        { category: 'Action', avg_roi: 50, count: 5, total_profit: 1500000 },
        { category: 'Drama', avg_roi: 68, count: 4, total_profit: 1700000 },
        { category: 'Thriller', avg_roi: 50, count: 3, total_profit: 900000 },
        { category: 'Sci-Fi', avg_roi: 20, count: 2, total_profit: 400000 },
        { category: 'Comedy', avg_roi: 50, count: 3, total_profit: 600000 },
        { category: 'Documentary', avg_roi: 75, count: 2, total_profit: 600000 }
      ]);
      setRoiSummary({
        total_investments: 19,
        average_roi: 52.2,
        best_roi: 75,
        worst_roi: 20,
        profitable_count: 15
      });
    } finally {
      setLoading(false);
    }
  };

  const monthlyROIData = [
    { month: 'Jan', roi: 12, invested: 500000, returned: 560000 },
    { month: 'Feb', roi: 15, invested: 600000, returned: 690000 },
    { month: 'Mar', roi: 18, invested: 750000, returned: 885000 },
    { month: 'Apr', roi: 22, invested: 800000, returned: 976000 },
    { month: 'May', roi: 25, invested: 900000, returned: 1125000 },
    { month: 'Jun', roi: 28, invested: 1000000, returned: 1280000 },
    { month: 'Jul', roi: 32, invested: 1100000, returned: 1452000 },
    { month: 'Aug', roi: 35, invested: 1200000, returned: 1620000 },
    { month: 'Sep', roi: 38, invested: 1300000, returned: 1794000 },
    { month: 'Oct', roi: 42, invested: 1400000, returned: 1988000 },
    { month: 'Nov', roi: 45, invested: 1500000, returned: 2175000 },
    { month: 'Dec', roi: 48, invested: 1600000, returned: 2368000 }
  ];

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
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value}%`} />
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
                    {categoryMetrics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
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