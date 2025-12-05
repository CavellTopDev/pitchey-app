import React from 'react';

// Temporary placeholder component - chart functionality disabled to fix initialization errors

interface DataPoint {
  label: string;
  value: number;
}

interface PerformanceChartProps {
  title: string;
  datasets: {
    label: string;
    data: DataPoint[];
    color: string;
  }[];
  currency?: boolean;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ 
  title, 
  datasets,
  currency = false 
}) => {
  // Temporary placeholder - chart functionality disabled to resolve JavaScript initialization errors
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">Chart temporarily unavailable</p>
      <div className="space-y-2">
        {datasets.map((dataset, index) => (
          <div key={index} className="text-sm text-gray-600">
            <span className="font-medium">{dataset.label}:</span>{' '}
            {dataset.data.length} data points
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Chart functionality will be restored in a future update
      </p>
    </div>
  );
};