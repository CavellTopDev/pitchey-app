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
  metrics: PortfolioMetrics;
  showGrowthMetrics?: boolean;
  className?: string;
}

export default function InvestmentPortfolioCard({ 
  metrics, 
  showGrowthMetrics = true,
  className = '' 
}: InvestmentPortfolioCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  };

  const isPositiveReturn = metrics.returnPercentage >= 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Portfolio Overview</h3>
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-gray-500">Live Data</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">Total Invested</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(metrics.totalInvested)}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Current Value</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(metrics.currentValue)}</p>
        </div>

        <div className={`${isPositiveReturn ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            {isPositiveReturn ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm text-gray-600">Total Return</span>
          </div>
          <p className={`text-xl font-bold ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(metrics.totalReturn)}
          </p>
          <p className={`text-sm ${isPositiveReturn ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(metrics.returnPercentage)}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">Active Deals</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{metrics.activeInvestments}</p>
          <p className="text-sm text-gray-500">{metrics.completedInvestments} completed</p>
        </div>
      </div>

      {/* Growth Metrics */}
      {showGrowthMetrics && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Performance Trends</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">This Month</p>
              <p className={`font-semibold ${(metrics.monthlyGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(metrics.monthlyGrowth || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">This Quarter</p>
              <p className={`font-semibold ${(metrics.quarterlyGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(metrics.quarterlyGrowth || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">YTD</p>
              <p className={`font-semibold ${(metrics.ytdGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(metrics.ytdGrowth || 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}