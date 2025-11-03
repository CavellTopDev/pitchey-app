import React from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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
  const chartData = {
    labels: datasets[0].data.map(d => d.label),
    datasets: datasets.map(dataset => ({
      label: dataset.label,
      data: dataset.data.map(d => d.value),
      borderColor: dataset.color,
      backgroundColor: `${dataset.color}20`,
      tension: 0.4,
      fill: true
    }))
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return currency 
              ? new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: 'USD' 
                }).format(value)
              : `${value}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => currency 
            ? new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD',
                notation: 'compact'
              }).format(Number(value))
            : `${value}%`
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
};