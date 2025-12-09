import React, { useState, useEffect } from 'react';
import { DashboardHeader } from '../../components/DashboardHeader';
import { 
  DollarSign, TrendingUp, Calendar, Download, 
  Filter, ArrowUp, ArrowDown, FileText,
  PieChart, BarChart3, Activity, CreditCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../store/authStore';
import { pitchService } from '../../services/pitch.service';

export default function ProductionRevenue() {
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState('month');
  const [revenueData, setRevenueData] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
    growth: 0,
    transactions: [],
    chartData: []
  });

  useEffect(() => {
    // Fetch revenue data (mock for now)
    setRevenueData({
      totalRevenue: 2450000,
      monthlyRevenue: 185000,
      yearlyRevenue: 2450000,
      growth: 12.5,
      transactions: [
        { id: 1, project: 'Cosmic Odyssey', amount: 450000, date: '2024-12-01', status: 'completed' },
        { id: 2, project: 'Urban Legends', amount: 325000, date: '2024-11-15', status: 'completed' },
        { id: 3, project: 'The Last Signal', amount: 275000, date: '2024-11-01', status: 'pending' },
        { id: 4, project: 'Quantum Dreams', amount: 500000, date: '2024-10-20', status: 'completed' },
        { id: 5, project: 'Shadow Protocol', amount: 400000, date: '2024-10-05', status: 'completed' }
      ],
      chartData: [
        { month: 'Jul', revenue: 150000 },
        { month: 'Aug', revenue: 175000 },
        { month: 'Sep', revenue: 190000 },
        { month: 'Oct', revenue: 210000 },
        { month: 'Nov', revenue: 195000 },
        { month: 'Dec', revenue: 185000 }
      ]
    });
  }, [timeRange]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} userType="production" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Reports</h1>
            <p className="text-gray-600 mt-1">Track your production revenue and financial metrics</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
            <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4" />
              Generate Invoice
            </Button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant={timeRange === 'week' ? 'default' : 'outline'}
            onClick={() => setTimeRange('week')}
            size="sm"
          >
            Week
          </Button>
          <Button 
            variant={timeRange === 'month' ? 'default' : 'outline'}
            onClick={() => setTimeRange('month')}
            size="sm"
          >
            Month
          </Button>
          <Button 
            variant={timeRange === 'quarter' ? 'default' : 'outline'}
            onClick={() => setTimeRange('quarter')}
            size="sm"
          >
            Quarter
          </Button>
          <Button 
            variant={timeRange === 'year' ? 'default' : 'outline'}
            onClick={() => setTimeRange('year')}
            size="sm"
          >
            Year
          </Button>
        </div>

        {/* Revenue Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(revenueData.totalRevenue / 1000000).toFixed(2)}M</div>
              <p className="text-xs text-gray-500 mt-1">All time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Monthly Revenue
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(revenueData.monthlyRevenue / 1000).toFixed(0)}K</div>
              <p className="text-xs text-gray-500 mt-1">Current month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Growth Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <ArrowUp className="w-4 h-4 text-green-600" />
                {revenueData.growth}%
              </div>
              <p className="text-xs text-gray-500 mt-1">vs last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Deal Size
              </CardTitle>
              <Activity className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$375K</div>
              <p className="text-xs text-gray-500 mt-1">Per project</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-4">
              {revenueData.chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-600 mb-2">
                    ${(data.revenue / 1000).toFixed(0)}K
                  </div>
                  <div 
                    className="w-full bg-purple-600 rounded-t"
                    style={{ 
                      height: `${(data.revenue / 210000) * 200}px`,
                      minHeight: '20px'
                    }}
                  />
                  <div className="text-xs text-gray-600 mt-2">{data.month}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Recent Transactions
              </span>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{transaction.project}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          ${(transaction.amount / 1000).toFixed(0)}K
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          transaction.status === 'completed' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Revenue by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-purple-600 rounded-full" />
                    <span className="text-sm">Feature Films</span>
                  </div>
                  <span className="font-semibold">45%</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-600 rounded-full" />
                    <span className="text-sm">TV Series</span>
                  </div>
                  <span className="font-semibold">30%</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-600 rounded-full" />
                    <span className="text-sm">Web Series</span>
                  </div>
                  <span className="font-semibold">15%</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-600 rounded-full" />
                    <span className="text-sm">Documentaries</span>
                  </div>
                  <span className="font-semibold">10%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Wire Transfer</span>
                  <span className="font-semibold">65%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">ACH</span>
                  <span className="font-semibold">25%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Check</span>
                  <span className="font-semibold">10%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}