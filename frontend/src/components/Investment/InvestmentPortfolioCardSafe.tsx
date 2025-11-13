import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Activity } from 'lucide-react';

interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  returnPercentage: number;
  activeInvestments: number;
  completedInvestments: number;
  roi: number;
  monthlyGrowth?: number;
  quarterlyGrowth?: number;
  ytdGrowth?: number;
}

interface InvestmentPortfolioCardProps {
  metrics?: PortfolioMetrics | null;
  showGrowthMetrics?: boolean;
  className?: string;
}

function InvestmentPortfolioCardSafe({ 
  metrics, 
  showGrowthMetrics = true,
  className = '' 
}: InvestmentPortfolioCardProps) {
  
  // Safe defaults when metrics is null/undefined
  const safeMetrics: PortfolioMetrics = metrics || {
    totalInvested: 0,
    currentValue: 0,
    totalReturn: 0,
    returnPercentage: 0,
    activeInvestments: 0,
    completedInvestments: 0,
    roi: 0,
    monthlyGrowth: 0,
    quarterlyGrowth: 0,
    ytdGrowth: 0
  };

  const formatCurrency = (amount: number | undefined | null) => {
    const safeAmount = amount || 0;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(safeAmount);
    } catch (error) {
      console.warn('Currency formatting error:', error);
      return `$${safeAmount.toLocaleString()}`;
    }
  };

  const formatPercentage = (percentage: number | undefined | null) => {
    const safePercentage = percentage || 0;
    try {
      return `${safePercentage >= 0 ? '+' : ''}${safePercentage.toFixed(1)}%`;
    } catch (error) {
      console.warn('Percentage formatting error:', error);
      return '0.0%';
    }
  };

  const getReturnColor = (value: number | undefined | null) => {
    const safeValue = value || 0;
    if (safeValue > 0) return 'text-green-600';
    if (safeValue < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getReturnIcon = (value: number | undefined | null) => {
    const safeValue = value || 0;
    if (safeValue > 0) return TrendingUp;
    if (safeValue < 0) return TrendingDown;
    return Activity;
  };

  const ReturnIcon = getReturnIcon(safeMetrics.returnPercentage);

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Investment Portfolio</h3>
          <p className="text-sm text-gray-500">Your investment overview</p>
        </div>
        <div className="p-3 bg-blue-100 rounded-lg">
          <PieChart className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Invested */}
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="w-5 h-5 text-gray-600 mr-1" />
            <span className="text-sm font-medium text-gray-600">Invested</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(safeMetrics.totalInvested)}
          </p>
        </div>

        {/* Current Value */}
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <Activity className="w-5 h-5 text-blue-600 mr-1" />
            <span className="text-sm font-medium text-blue-600">Current Value</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {formatCurrency(safeMetrics.currentValue)}
          </p>
        </div>

        {/* Total Return */}
        <div className={`text-center p-4 rounded-lg ${safeMetrics.totalReturn >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-center mb-2">
            <ReturnIcon className={`w-5 h-5 mr-1 ${getReturnColor(safeMetrics.totalReturn)}`} />
            <span className={`text-sm font-medium ${getReturnColor(safeMetrics.totalReturn)}`}>
              Total Return
            </span>
          </div>
          <div>
            <p className={`text-2xl font-bold ${getReturnColor(safeMetrics.totalReturn)}`}>
              {formatCurrency(safeMetrics.totalReturn)}
            </p>
            <p className={`text-sm ${getReturnColor(safeMetrics.returnPercentage)}`}>
              {formatPercentage(safeMetrics.returnPercentage)}
            </p>
          </div>
        </div>
      </div>

      {/* Investment Counts */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-indigo-50 rounded-lg">
          <p className="text-lg font-bold text-indigo-900">{safeMetrics.activeInvestments || 0}</p>
          <p className="text-sm text-indigo-600">Active Investments</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-lg font-bold text-purple-900">{safeMetrics.completedInvestments || 0}</p>
          <p className="text-sm text-purple-600">Completed</p>
        </div>
      </div>

      {/* Growth Metrics */}
      {showGrowthMetrics && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Growth Metrics</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={`text-sm font-medium ${getReturnColor(safeMetrics.monthlyGrowth)}`}>
                {formatPercentage(safeMetrics.monthlyGrowth)}
              </p>
              <p className="text-xs text-gray-500">Monthly</p>
            </div>
            <div>
              <p className={`text-sm font-medium ${getReturnColor(safeMetrics.quarterlyGrowth)}`}>
                {formatPercentage(safeMetrics.quarterlyGrowth)}
              </p>
              <p className="text-xs text-gray-500">Quarterly</p>
            </div>
            <div>
              <p className={`text-sm font-medium ${getReturnColor(safeMetrics.ytdGrowth)}`}>
                {formatPercentage(safeMetrics.ytdGrowth)}
              </p>
              <p className="text-xs text-gray-500">YTD</p>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!metrics && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            <span className="font-medium">Portfolio data loading...</span>
            <br />
            Showing default values until data is available.
          </p>
        </div>
      )}
    </div>
  );
}

export default InvestmentPortfolioCardSafe;