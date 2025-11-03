import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  description?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  format?: 'number' | 'currency' | 'percentage';
}

export const AnalyticCard: React.FC<AnalyticCardProps> = ({
  title,
  value,
  change = 0,
  icon,
  description,
  variant = 'primary',
  format = 'number'
}) => {
  const formatValue = () => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          notation: 'compact'
        }).format(Number(value));
      case 'percentage':
        return `${Number(value).toFixed(1)}%`;
      default:
        return String(value);
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'secondary': return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'success': return 'bg-green-50 text-green-600 border-green-200';
      case 'warning': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
      case 'danger': return 'bg-red-50 text-red-600 border-red-200';
    }
  };

  return (
    <div className={`rounded-xl border p-6 shadow-sm ${getVariantClasses()}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="rounded-full p-3 bg-white shadow-sm">
          {icon}
        </div>
        <div className="flex items-center gap-1">
          {change !== 0 && (
            change > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )
          )}
          {change !== 0 && (
            <span className={`text-xs ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm text-gray-500 mb-1">{title}</h3>
        <p className="text-2xl font-bold">{formatValue()}</p>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
};