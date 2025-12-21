import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, Wallet, PiggyBank,
  CreditCard, Coins, BarChart3, Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

const FinancialOverview = () => {
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
              <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
              <p className="text-gray-600 mt-2">Complete financial summary and portfolio valuation</p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Statement
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Assets</p>
                  <p className="text-2xl font-bold text-gray-900">$12.5M</p>
                </div>
                <Wallet className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Funds</p>
                  <p className="text-2xl font-bold text-green-600">$3.2M</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Investments</p>
                  <p className="text-2xl font-bold text-blue-600">$8.3M</p>
                </div>
                <Coins className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">YTD Growth</p>
                  <p className="text-2xl font-bold text-purple-600">+28.5%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Financial Dashboard</CardTitle>
            <CardDescription>Detailed financial metrics and portfolio breakdown</CardDescription>
          </CardHeader>
          <CardContent className="h-96 flex items-center justify-center">
            <p className="text-gray-500">Financial charts and detailed breakdown coming soon</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FinancialOverview;