import React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface PortfolioChartProps {
  data?: Array<{
    month: string;
    investments: number;
    returns: number;
    portfolio: number;
  }>;
  className?: string;
}

const chartConfig = {
  investments: {
    label: "Investments",
    color: "#2563eb",
  },
  returns: {
    label: "Returns",
    color: "#16a34a",
  },
  portfolio: {
    label: "Portfolio Value",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

export const PortfolioChart: React.FC<PortfolioChartProps> = ({ data = [], className = "" }) => {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] w-full text-gray-400 text-sm ${className}`}>
        No portfolio data available
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <AreaChart accessibilityLayer data={data}>
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
        <Area
          dataKey="portfolio"
          type="natural"
          fill="var(--color-portfolio)"
          fillOpacity={0.4}
          stroke="var(--color-portfolio)"
          stackId="a"
        />
        <Area
          dataKey="investments"
          type="natural"
          fill="var(--color-investments)"
          fillOpacity={0.4}
          stroke="var(--color-investments)"
          stackId="b"
        />
        <Area
          dataKey="returns"
          type="natural"
          fill="var(--color-returns)"
          fillOpacity={0.4}
          stroke="var(--color-returns)"
          stackId="c"
        />
      </AreaChart>
    </ChartContainer>
  );
};