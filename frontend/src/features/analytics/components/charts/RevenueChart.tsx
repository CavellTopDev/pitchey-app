import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface RevenueChartProps {
  data?: Array<{
    month: string;
    revenue: number;
    budget: number;
  }>;
  className?: string;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "#2563eb",
  },
  budget: {
    label: "Budget",
    color: "#60a5fa",
  },
} satisfies ChartConfig;

export const RevenueChart: React.FC<RevenueChartProps> = ({ data = [], className = "" }) => {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] w-full text-gray-400 text-sm ${className}`}>
        No revenue data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis 
          dataKey="month" 
          tickLine={false} 
          tickMargin={10} 
          axisLine={false} 
        />
        <YAxis
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip 
          content={
            <ChartTooltipContent 
              formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
            />
          } 
        />
        <Bar 
          dataKey="revenue" 
          fill="var(--color-revenue)" 
          radius={4}
        />
        <Bar 
          dataKey="budget" 
          fill="var(--color-budget)" 
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
};