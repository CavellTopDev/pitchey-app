import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, DollarSign, Target, Settings, Plus,
  BarChart3, TrendingUp, Calculator
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';
import { investorApi } from '@/services/investor.service';

const BudgetAllocation = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetAllocations();
  }, []);

  const loadBudgetAllocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getBudgetAllocations();
      
      if (response.success && response.data) {
        setAllocations(response.data.allocations || []);
      } else {
        setError('Failed to load budget allocations');
        // Keep mock data as fallback
        setAllocations([
          { category: 'Action Films', allocated_amount: 3000000, used_amount: 2500000, percentage: 30 },
          { category: 'Drama', allocated_amount: 2500000, used_amount: 2200000, percentage: 25 },
          { category: 'Thriller', allocated_amount: 2000000, used_amount: 1800000, percentage: 20 },
          { category: 'Sci-Fi', allocated_amount: 1500000, used_amount: 1200000, percentage: 15 },
          { category: 'Comedy', allocated_amount: 1000000, used_amount: 800000, percentage: 10 },
        ]);
      }
    } catch (error) {
      console.error('Failed to load budget allocations:', error);
      setError('Failed to load budget allocations');
      // Keep mock data as fallback
      setAllocations([
        { category: 'Action Films', allocated_amount: 3000000, used_amount: 2500000, percentage: 30 },
        { category: 'Drama', allocated_amount: 2500000, used_amount: 2200000, percentage: 25 },
        { category: 'Thriller', allocated_amount: 2000000, used_amount: 1800000, percentage: 20 },
        { category: 'Sci-Fi', allocated_amount: 1500000, used_amount: 1200000, percentage: 15 },
        { category: 'Comedy', allocated_amount: 1000000, used_amount: 800000, percentage: 10 },
      ]);
    } finally {
      setLoading(false);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const totalBudget = allocations.reduce((sum, allocation) => sum + (allocation.allocated_amount || allocation.allocated || 0), 0);
  const totalUsed = allocations.reduce((sum, allocation) => sum + (allocation.used_amount || allocation.used || 0), 0);
  const utilization = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

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

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            {error}. Showing sample data.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Used</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalUsed)}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Utilization</p>
                  <p className="text-2xl font-bold text-green-600">{utilization.toFixed(1)}%</p>
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
              {allocations.map((item, index) => {
                const allocated = item.allocated_amount || item.allocated || 0;
                const used = item.used_amount || item.used || 0;
                const percentage = item.percentage || (totalBudget > 0 ? (allocated / totalBudget) * 100 : 0);
                const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900">{item.category}</h3>
                      <span className="text-sm font-medium text-purple-600">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Used: {formatCurrency(used)}</span>
                      <span>Allocated: {formatCurrency(allocated)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BudgetAllocation;