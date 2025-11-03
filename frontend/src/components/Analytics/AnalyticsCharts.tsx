import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

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
  const chartData = {
    labels: data.map(point => {
      const date = new Date(point.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: title,
        data: data.map(point => point.value),
        borderColor: color,
        backgroundColor: fill ? `${color}20` : color,
        fill,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Line data={chartData} options={commonOptions} />
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
  const chartData = {
    labels: data.map(item => item.category),
    datasets: [
      {
        label: title,
        data: data.map(item => item.value),
        backgroundColor: data.map((_, index) => chartColors[index % chartColors.length]),
        borderColor: data.map((_, index) => chartColors[index % chartColors.length]),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    ...commonOptions,
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
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
  const labels = datasets[0]?.data.map(point => {
    const date = new Date(point.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }) || [];

  const chartData = {
    labels,
    datasets: datasets.map(dataset => ({
      label: dataset.label,
      data: dataset.data.map(point => point.value),
      borderColor: dataset.color,
      backgroundColor: `${dataset.color}20`,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  };

  return (
    <div style={{ height }}>
      <Line data={chartData} options={commonOptions} />
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
  const chartData = {
    labels: data.map(item => item.category),
    datasets: [
      {
        label: title,
        data: data.map(item => item.value),
        backgroundColor: data.map((_, index) => chartColors[index % chartColors.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const ChartComponent = type === 'doughnut' ? Doughnut : Pie;

  return (
    <div style={{ height }}>
      <ChartComponent data={chartData} options={pieOptions} />
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
    <LineChart
      data={data}
      title={title}
      color={color}
      fill={true}
      height={height}
    />
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
  const labels = data.map(item => item.category);
  const datasets = data[0]?.values.map((valueItem, index) => ({
    label: valueItem.label,
    data: data.map(item => item.values[index]?.value || 0),
    backgroundColor: chartColors[index % chartColors.length],
    borderColor: chartColors[index % chartColors.length],
    borderWidth: 1,
  })) || [];

  const chartData = {
    labels,
    datasets,
  };

  const options = {
    ...commonOptions,
    scales: {
      ...commonOptions.scales,
      x: {
        ...commonOptions.scales.x,
        stacked: true,
      },
      y: {
        ...commonOptions.scales.y,
        stacked: true,
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
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