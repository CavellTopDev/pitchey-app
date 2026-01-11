import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Calendar,
  BarChart3, PieChart, Download, Filter, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

const MarketTrends = () => {
    const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('3m');
  const [trendsData, setTrendsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMarketTrends();
  }, []);

  const loadMarketTrends = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getMarketTrends();
      
      if (response.success && response.data) {
        setTrendsData(response.data);
      } else {
        setError('Failed to load market trends');
        // Use fallback data
        setTrendsData({
          marketGrowth: 15.8,
          totalInvestment: 245000000,
          activePitches: 1247
        });
      }
    } catch (error) {
      console.error('Failed to load market trends:', error);
      setError('Failed to load market trends');
      setTrendsData({
        marketGrowth: 15.8,
        totalInvestment: 245000000,
        activePitches: 1247
      });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Market Trends</h1>
          <p className="text-gray-600 mt-2">Industry trends and market analysis</p>
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
                  <p className="text-sm font-medium text-gray-600">Market Growth</p>
                  <p className="text-2xl font-bold text-green-600">+{trendsData?.marketGrowth || 15.8}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Investment</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(trendsData?.totalInvestment || 245000000)}</p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Pitches</p>
                  <p className="text-2xl font-bold text-blue-600">{trendsData?.activePitches || 1247}</p>
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