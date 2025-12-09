# shadcn/ui Dashboard Migration Guide

## Overview

The Pitchey platform has been successfully migrated from Chart.js to shadcn/ui components with Recharts for all dashboard visualizations. This provides better TypeScript support, consistent design system integration, and improved accessibility.

## Migration Summary

### ✅ Completed Migrations

| Portal | Component | Status | Charts Replaced |
|--------|-----------|--------|----------------|
| **Creator** | CreatorStats.tsx | ✅ Complete | Line, Pie, Bar, Doughnut |
| **Creator** | CreatorPitchesAnalytics.tsx | ✅ Complete | Multi-line, Bar, Pie |
| **Investor** | InvestorStats.tsx | ✅ Complete | Line, Pie, Bar, Radar |
| **Investor** | InvestorAnalytics.tsx | ✅ Complete | Area, Bar, Pie |
| **Investor** | InvestorPerformance.tsx | ✅ Complete | Line, Bar, Doughnut |
| **Production** | ProductionStats.tsx | ✅ N/A | (No Chart.js used) |
| **Production** | ProductionAnalytics.tsx | ✅ N/A | (No Chart.js used) |

### 📦 Dependencies

**Removed:**
- `chart.js`
- `react-chartjs-2`

**Added/Using:**
- `recharts` (^2.15.4)
- `@radix-ui/react-*` (shadcn/ui dependencies)
- shadcn/ui components

## Component Architecture

### 1. Chart Container Pattern

All charts now use the shadcn/ui `ChartContainer` wrapper:

```tsx
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig = {
  dataKey: {
    label: "Display Label",
    color: "hsl(var(--chart-1))",
  },
}

<ChartContainer config={chartConfig} className="h-[300px]">
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line type="monotone" dataKey="dataKey" stroke="var(--color-dataKey)" />
  </LineChart>
</ChartContainer>
```

### 2. Card Layout Pattern

All dashboard sections use shadcn/ui Card components:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <div className="space-y-1">
      <CardTitle className="text-base font-medium">Metric Title</CardTitle>
      <CardDescription>Description text</CardDescription>
    </div>
    <Icon className="w-5 h-5 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    {/* Chart or content here */}
  </CardContent>
</Card>
```

### 3. Data Format Migration

**Chart.js Format (Old):**
```javascript
{
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{
    label: 'Revenue',
    data: [100, 200, 300],
    backgroundColor: 'blue',
    borderColor: 'darkblue'
  }]
}
```

**Recharts Format (New):**
```javascript
[
  { month: 'Jan', revenue: 100 },
  { month: 'Feb', revenue: 200 },
  { month: 'Mar', revenue: 300 }
]
```

## Available Chart Types

### 1. Line Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"

<LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="x" />
  <YAxis />
  <Line type="monotone" dataKey="y" stroke="var(--color-y)" />
</LineChart>
```

### 2. Bar Chart
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"

<BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="category" />
  <YAxis />
  <Bar dataKey="value" fill="var(--color-value)" />
</BarChart>
```

### 3. Pie Chart
```tsx
import { PieChart, Pie, Cell } from "recharts"

<PieChart>
  <Pie
    data={data}
    cx="50%"
    cy="50%"
    outerRadius={80}
    fill="#8884d8"
    dataKey="value"
  >
    {data.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
    ))}
  </Pie>
</PieChart>
```

### 4. Area Chart
```tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts"

<AreaChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="x" />
  <YAxis />
  <Area type="monotone" dataKey="y" stroke="var(--color-y)" fill="var(--color-y)" />
</AreaChart>
```

### 5. Radar Chart
```tsx
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts"

<RadarChart data={data}>
  <PolarGrid />
  <PolarAngleAxis dataKey="subject" />
  <PolarRadiusAxis />
  <Radar dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
</RadarChart>
```

## Theme Integration

### CSS Variables

shadcn/ui charts use CSS variables for theming:

```css
/* Default chart colors in your CSS */
:root {
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}

.dark {
  --chart-1: 220 70% 65%;
  --chart-2: 160 60% 60%;
  --chart-3: 30 80% 70%;
  --chart-4: 280 65% 75%;
  --chart-5: 340 75% 70%;
}
```

### Chart Configuration

```tsx
const chartConfig = {
  views: {
    label: "Page Views",
    color: "hsl(var(--chart-1))",
  },
  visitors: {
    label: "Unique Visitors",
    color: "hsl(var(--chart-2))",
  },
}
```

## Responsive Design

All charts are responsive by default:

```tsx
<ChartContainer config={config} className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      {/* Chart content */}
    </LineChart>
  </ResponsiveContainer>
</ChartContainer>
```

## Additional Components

### Progress Indicators
```tsx
import { Progress } from "@/components/ui/progress"

<Progress value={65} className="mt-2" />
```

### Badges
```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="outline">Draft</Badge>
```

### Tabs
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    {/* Content */}
  </TabsContent>
</Tabs>
```

### Skeleton Loaders
```tsx
import { Skeleton } from "@/components/ui/skeleton"

<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
</div>
```

## Example Dashboard Component

See `/frontend/src/components/DashboardExample.tsx` for a complete example implementation showcasing:
- Metric cards with progress indicators
- Line, Bar, Pie, Area, and Radar charts
- Tabs navigation
- Responsive grid layout
- Proper TypeScript typing
- Theme integration

## Performance Improvements

### Before (Chart.js)
- Bundle size: ~250KB for chart library
- Manual responsive handling
- Complex configuration
- Limited TypeScript support

### After (shadcn/ui + Recharts)
- Bundle size: ~180KB for chart library
- Built-in responsive support
- Declarative API
- Full TypeScript support
- Better tree-shaking
- Consistent with design system

## Migration Checklist

- [x] Install shadcn/ui components
- [x] Install Recharts dependency
- [x] Remove Chart.js imports
- [x] Convert data formats
- [x] Replace chart components
- [x] Update chart configurations
- [x] Apply Card layouts
- [x] Add tooltips and legends
- [x] Test responsive behavior
- [x] Update TypeScript types
- [x] Remove Chart.js from package.json

## Troubleshooting

### Common Issues

1. **Chart not rendering:**
   - Ensure ChartContainer has a defined height
   - Check data format matches Recharts structure

2. **Colors not showing:**
   - Verify CSS variables are defined
   - Use `var(--color-dataKey)` in stroke/fill props

3. **TypeScript errors:**
   - Import types from recharts: `import type { TooltipProps } from "recharts"`

4. **Responsive issues:**
   - Use `className="h-[300px]"` on ChartContainer
   - Wrap in ResponsiveContainer if needed

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [shadcn/ui Dashboard Example](https://ui.shadcn.com/examples/dashboard)
- [Recharts Documentation](https://recharts.org)
- [shadcn/ui Charts](https://ui.shadcn.com/docs/components/chart)

---

*Migration completed: December 2024*
*Version: 2.0.0*