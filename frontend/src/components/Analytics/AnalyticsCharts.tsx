import React from 'react';

// Chart functionality temporarily disabled to resolve JavaScript initialization errors

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface CategoryData {
  category: string;
  value: number;
  count?: number;
}

// Common chart options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
      beginAtZero: true,
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
    },
  },
};

// Colors for charts
const colors = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
};

const chartColors = [
  colors.primary,
  colors.secondary,
  colors.accent,
  colors.purple,
  colors.pink,
  colors.indigo,
  colors.teal,
  colors.danger,
];

// Line Chart Component
interface LineChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  fill?: boolean;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title = 'Line Chart',
  color = colors.primary,
  fill = false,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-500 text-sm mb-2">Line Chart</p>
      <div className="text-xs text-gray-400 text-center">
        {data.length} data points available<br />
        Chart temporarily disabled
      </div>
    </div>
  );
};

// Bar Chart Component
interface BarChartProps {
  data: CategoryData[];
  title?: string;
  color?: string;
  horizontal?: boolean;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title = 'Bar Chart',
  color = colors.primary,
  horizontal = false,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-500 text-sm mb-2">Bar Chart ({horizontal ? 'Horizontal' : 'Vertical'})</p>
      <div className="text-xs text-gray-400 text-center">
        {data.length} categories available<br />
        Chart temporarily disabled
      </div>
    </div>
  );
};

// Multi-Line Chart Component
interface MultiLineChartProps {
  datasets: {
    label: string;
    data: ChartDataPoint[];
    color: string;
  }[];
  height?: number;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  datasets,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">Multi-Line Chart</h4>
      <p className="text-gray-500 text-sm mb-2">{datasets.length} datasets</p>
      <div className="text-xs text-gray-400 text-center">
        Chart temporarily disabled
      </div>
    </div>
  );
};

// Pie Chart Component
interface PieChartProps {
  data: CategoryData[];
  title?: string;
  type?: 'pie' | 'doughnut';
  height?: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title = 'Distribution',
  type = 'pie',
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-500 text-sm mb-2">{type.charAt(0).toUpperCase() + type.slice(1)} Chart</p>
      <div className="text-xs text-gray-400 text-center">
        {data.length} categories available<br />
        Chart temporarily disabled
      </div>
    </div>
  );
};

// Area Chart Component
interface AreaChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  height?: number;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  title = 'Area Chart',
  color = colors.primary,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-500 text-sm mb-2">Area Chart</p>
      <div className="text-xs text-gray-400 text-center">
        {data.length} data points available<br />
        Chart temporarily disabled
      </div>
    </div>
  );
};

// Stacked Bar Chart Component
interface StackedBarChartProps {
  data: {
    category: string;
    values: { label: string; value: number }[];
  }[];
  height?: number;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
      <h4 className="text-lg font-medium text-gray-900 mb-2">Stacked Bar Chart</h4>
      <p className="text-gray-500 text-sm mb-2">{data.length} categories</p>
      <div className="text-xs text-gray-400 text-center">
        Chart temporarily disabled<br />
        {data.reduce((total, item) => total + item.values.length, 0)} data series
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percentage';
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  format = 'number',
  icon,
  className = '',
}) => {
  const formatValue = (val: string | number) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(val));
    }
    if (format === 'percentage') {
      return `${val}%`;
    }
    if (typeof val === 'number' && val >= 1000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(val);
    }
    return val.toString();
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'increase':
        return '↗';
      case 'decrease':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          {change !== undefined && (
            <p className={`text-sm mt-1 ${getChangeColor()}`}>
              <span className="inline-flex items-center">
                {getChangeIcon()}
                <span className="ml-1">
                  {Math.abs(change)}% vs last period
                </span>
              </span>
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-2xl text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Chart Container Component
interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  children,
  actions,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {actions && <div className="flex space-x-2">{actions}</div>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default {
  LineChart,
  BarChart,
  MultiLineChart,
  PieChart,
  AreaChart,
  StackedBarChart,
  MetricCard,
  ChartContainer,
};