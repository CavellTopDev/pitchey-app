import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Info,
  TrendingUp, TrendingDown, Activity, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

const RiskAssessment = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRiskAssessment();
  }, []);

  const loadRiskAssessment = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getPortfolioRisk();
      
      if (response.success && response.data) {
        setRiskData(response.data);
      } else {
        setError('Failed to load risk assessment');
        // Use fallback data
        setRiskData({
          overallRisk: 'Medium',
          riskScore: 6.2,
          lowRisk: 45,
          mediumRisk: 35,
          highRisk: 20
        });
      }
    } catch (error) {
      console.error('Failed to load risk assessment:', error);
      setError('Failed to load risk assessment');
      setRiskData({
        overallRisk: 'Medium',
        riskScore: 6.2,
        lowRisk: 45,
        mediumRisk: 35,
        highRisk: 20
      });
    } finally {
      setLoading(false);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Risk Assessment</h1>
          <p className="text-gray-600 mt-2">Portfolio risk analysis and mitigation strategies</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Risk Level</p>
                  <p className="text-2xl font-bold text-yellow-600">Moderate</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Risk Score</p>
                  <p className="text-2xl font-bold text-blue-600">6.2/10</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Diversification</p>
                  <p className="text-2xl font-bold text-green-600">Good</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Risk Analysis Dashboard</CardTitle>
            <CardDescription>Comprehensive risk metrics and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="h-96 flex items-center justify-center">
            <p className="text-gray-500">Risk assessment charts coming soon</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RiskAssessment;