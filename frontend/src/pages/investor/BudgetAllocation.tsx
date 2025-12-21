import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, DollarSign, Target, Settings, Plus,
  BarChart3, TrendingUp, Calculator
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

const BudgetAllocation = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const allocations = [
    { category: 'Action Films', allocated: 3000000, used: 2500000, percentage: 30 },
    { category: 'Drama', allocated: 2500000, used: 2200000, percentage: 25 },
    { category: 'Thriller', allocated: 2000000, used: 1800000, percentage: 20 },
    { category: 'Sci-Fi', allocated: 1500000, used: 1200000, percentage: 15 },
    { category: 'Comedy', allocated: 1000000, used: 800000, percentage: 10 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNavigation 
        user={user}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Budget Allocation</h1>
              <p className="text-gray-600 mt-2">Manage your investment budget across different categories</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Allocation
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">$10.0M</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Allocated</p>
                  <p className="text-2xl font-bold text-blue-600">$8.5M</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available</p>
                  <p className="text-2xl font-bold text-green-600">$1.5M</p>
                </div>
                <Calculator className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Category Allocations</CardTitle>
            <CardDescription>Budget distribution across different film categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-900">{item.category}</h3>
                    <span className="text-sm font-medium text-purple-600">{item.percentage}%</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Used: ${(item.used / 1000000).toFixed(1)}M</span>
                    <span>Allocated: ${(item.allocated / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${(item.used / item.allocated) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BudgetAllocation;