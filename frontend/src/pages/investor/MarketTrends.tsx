import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Calendar,
  BarChart3, PieChart, Download, Filter, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '@/store/authStore';

const MarketTrends = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('3m');

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
          <h1 className="text-3xl font-bold text-gray-900">Market Trends</h1>
          <p className="text-gray-600 mt-2">Industry trends and market analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Market Growth</p>
                  <p className="text-2xl font-bold text-green-600">+15.8%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hot Genres</p>
                  <p className="text-2xl font-bold text-purple-600">Sci-Fi</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Global Markets</p>
                  <p className="text-2xl font-bold text-blue-600">42</p>
                </div>
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Market Analysis</CardTitle>
            <CardDescription>Comprehensive market trends and insights</CardDescription>
          </CardHeader>
          <CardContent className="h-96 flex items-center justify-center">
            <p className="text-gray-500">Market trends visualization coming soon</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MarketTrends;