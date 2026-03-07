import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface ROIChartProps {
  data?: Array<{
    project: string;
    roi: number;
    revenue: number;
  }>;
  className?: string;
}

const chartConfig = {
  roi: {
    label: "ROI",
    color: "#16a34a",
  },
} satisfies ChartConfig;

export const ROIChart: React.FC<ROIChartProps> = ({ data = [], className = "" }) => {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] w-full text-gray-400 text-sm ${className}`}>
        No project ROI data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <BarChart accessibilityLayer data={data} layout="horizontal">
        <CartesianGrid horizontal={false} />
        <XAxis 
          type="number"
          tickFormatter={(value) => `${value}%`}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          type="category"
          dataKey="project" 
          tickLine={false} 
          tickMargin={10} 
          axisLine={false}
          width={80}
        />
        <ChartTooltip 
          content={
            <ChartTooltipContent 
              formatter={(value, name) => [
                name === 'roi' ? `${value}%` : `$${Number(value).toLocaleString()}`,
                name === 'roi' ? 'ROI' : 'Revenue'
              ]}
            />
          } 
        />
        <Bar 
          dataKey="roi" 
          fill="var(--color-roi)" 
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
};