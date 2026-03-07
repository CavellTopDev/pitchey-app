import React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface ProjectStatusChartProps {
  data?: Array<{
    status: string;
    count: number;
  }>;
  className?: string;
}

const chartConfig = {
  development: {
    label: "Development",
    color: "#eab308",
  },
  production: {
    label: "Production", 
    color: "#3b82f6",
  },
  completed: {
    label: "Completed",
    color: "#22c55e",
  },
  released: {
    label: "Released",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

const COLORS = ['#eab308', '#3b82f6', '#22c55e', '#8b5cf6'];

export const ProjectStatusChart: React.FC<ProjectStatusChartProps> = ({ data = [], className = "" }) => {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] w-full text-gray-400 text-sm ${className}`}>
        No project status data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent 
              formatter={(value, name) => [
                `${value} projects`,
                chartConfig[name as keyof typeof chartConfig]?.label || name
              ]}
            />
          }
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          label={({ status, percent }) => 
            `${chartConfig[status as keyof typeof chartConfig]?.label} ${(percent * 100).toFixed(0)}%`
          }
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={chartConfig[entry.status as keyof typeof chartConfig]?.color || COLORS[index % COLORS.length]} 
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};