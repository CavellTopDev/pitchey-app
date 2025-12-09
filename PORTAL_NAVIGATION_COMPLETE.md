# Portal Navigation System - Complete Implementation Guide

## Overview

The Pitchey platform features a comprehensive portal-based navigation system with three distinct user roles: Creator, Investor, and Production. Each portal provides specialized functionality and workflows tailored to the specific needs of each user type.

## Architecture

### Navigation Structure

```typescript
// Core navigation configuration at /frontend/src/config/navigationRoutes.tsx
const navigationGroups = {
  creator: CreatorNavigation,
  investor: InvestorNavigation,
  production: ProductionNavigation,
};
```

### Component Organization

```
frontend/src/
├── pages/
│   ├── creator/
│   │   ├── CreatorActivity.tsx      // Activity feed and notifications
│   │   ├── CreatorPitches.tsx       // Pitch management
│   │   ├── CreatorPitchesAnalytics.tsx
│   │   ├── CreatorPitchesArchive.tsx
│   │   ├── CreatorPitchesDraft.tsx
│   │   ├── CreatorPitchesPublished.tsx
│   │   ├── CreatorPitchesReview.tsx
│   │   ├── CreatorStats.tsx         // Dashboard with charts
│   │   └── CreatorTeam.tsx          // Team management
│   ├── investor/
│   │   ├── InvestorActivity.tsx     // Investment activity tracking
│   │   ├── InvestorAnalytics.tsx    // Investment analytics
│   │   ├── InvestorNDA.tsx          // NDA management
│   │   ├── InvestorPerformance.tsx  // Portfolio performance
│   │   ├── InvestorPortfolio.tsx    // Investment portfolio
│   │   ├── InvestorSaved.tsx        // Saved pitches
│   │   └── InvestorStats.tsx        // Dashboard overview
│   └── production/
│       ├── ProductionActivity.tsx    // Production activity feed
│       ├── ProductionAnalytics.tsx   // Production analytics
│       ├── ProductionPipeline.tsx    // Project pipeline
│       ├── ProductionProjects*.tsx   // Project management (8 files)
│       ├── ProductionStats.tsx       // Dashboard metrics
│       └── ProductionSubmissions*.tsx // Submission management (7 files)
```

## Portal Implementations

### Creator Portal

The Creator portal focuses on content creation and pitch management:

```typescript
// Navigation structure for creators
const CreatorNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/creator", icon: <HomeIcon /> },
      { title: "Activity", href: "/creator/activity", icon: <ActivityIcon /> },
      { title: "Analytics", href: "/creator/stats", icon: <ChartBarIcon /> },
    ],
  },
  {
    title: "Pitches",
    items: [
      { title: "Published", href: "/creator/pitches/published", icon: <CheckCircle /> },
      { title: "Drafts", href: "/creator/pitches/draft", icon: <FileText /> },
      { title: "In Review", href: "/creator/pitches/review", icon: <Clock /> },
      { title: "Analytics", href: "/creator/pitches/analytics", icon: <BarChart3 /> },
      { title: "Archive", href: "/creator/pitches/archive", icon: <Archive /> },
    ],
  },
];
```

#### Key Features:
- **Activity Feed**: Real-time notifications for views, likes, comments, and investments
- **Pitch Management**: Full lifecycle from draft to publication
- **Analytics Dashboard**: Comprehensive metrics using shadcn/ui charts
- **Team Collaboration**: Manage team members and permissions

### Investor Portal

The Investor portal emphasizes discovery and portfolio management:

```typescript
// Navigation structure for investors
const InvestorNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/investor", icon: <HomeIcon /> },
      { title: "Portfolio", href: "/investor/portfolio", icon: <Briefcase /> },
      { title: "Analytics", href: "/investor/analytics", icon: <TrendingUp /> },
    ],
  },
  {
    title: "Investments",
    items: [
      { title: "Active", href: "/investor/portfolio", icon: <DollarSign /> },
      { title: "Saved", href: "/investor/saved", icon: <Bookmark /> },
      { title: "NDAs", href: "/investor/nda", icon: <Shield /> },
      { title: "Performance", href: "/investor/performance", icon: <BarChart3 /> },
    ],
  },
];
```

#### Key Features:
- **Portfolio Overview**: Track all investments in one place
- **Performance Metrics**: ROI tracking and analytics
- **NDA Management**: Request and manage confidential information
- **Saved Pitches**: Watchlist functionality for interesting projects

### Production Portal

The Production portal handles project pipeline and team coordination:

```typescript
// Navigation structure for production companies
const ProductionNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/production", icon: <HomeIcon /> },
      { title: "Pipeline", href: "/production/pipeline", icon: <GitBranch /> },
      { title: "Analytics", href: "/production/analytics", icon: <BarChart3 /> },
    ],
  },
  {
    title: "Projects",
    items: [
      { title: "Active", href: "/production/projects/active", icon: <Play /> },
      { title: "Development", href: "/production/projects/development", icon: <Code /> },
      { title: "Post-Production", href: "/production/projects/post", icon: <Film /> },
      { title: "Completed", href: "/production/projects/completed", icon: <CheckCircle /> },
    ],
  },
  {
    title: "Submissions",
    items: [
      { title: "New", href: "/production/submissions/new", icon: <Inbox /> },
      { title: "Review", href: "/production/submissions/review", icon: <Eye /> },
      { title: "Shortlisted", href: "/production/submissions/shortlisted", icon: <Star /> },
      { title: "Accepted", href: "/production/submissions/accepted", icon: <Check /> },
      { title: "Rejected", href: "/production/submissions/rejected", icon: <X /> },
      { title: "Archive", href: "/production/submissions/archive", icon: <Archive /> },
    ],
  },
];
```

#### Key Features:
- **Pipeline Management**: Track projects through production stages
- **Submission Workflow**: Review and manage incoming pitches
- **Team Coordination**: Manage production teams and resources
- **Analytics Dashboard**: Production metrics and performance tracking

## shadcn/ui Integration

### Chart Migration

All dashboard components have been migrated from Chart.js to shadcn/ui with Recharts:

#### Before (Chart.js):
```javascript
import { Line } from 'react-chartjs-2';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{
    label: 'Revenue',
    data: [100, 200, 300],
    borderColor: 'rgb(75, 192, 192)',
  }]
};

<Line data={data} />
```

#### After (shadcn/ui + Recharts):
```typescript
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const data = [
  { month: 'Jan', revenue: 100 },
  { month: 'Feb', revenue: 200 },
  { month: 'Mar', revenue: 300 }
];

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
};

<ChartContainer config={chartConfig} className="h-[300px]">
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" />
  </LineChart>
</ChartContainer>
```

### Component Library

The migration includes these shadcn/ui components:
- **Card**: Container for dashboard sections
- **Tabs**: Navigation between different views
- **Badge**: Status indicators
- **Progress**: Visual progress bars
- **Button**: Interactive elements
- **Alert**: System notifications
- **Skeleton**: Loading states
- **ChartContainer**: Wrapper for all charts
- **ChartTooltip**: Interactive chart tooltips
- **ChartLegend**: Chart legends

## Responsive Design

All portal pages are fully responsive with mobile-first design:

```typescript
// Grid layouts adapt to screen size
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Metric cards */}
</div>

// Charts resize automatically
<ChartContainer className="h-[200px] md:h-[300px] lg:h-[400px]">
  {/* Chart content */}
</ChartContainer>
```

## Performance Optimizations

### Code Splitting

All portal pages use React lazy loading:

```typescript
const CreatorActivity = lazy(() => import('../pages/creator/CreatorActivity'));
const InvestorPortfolio = lazy(() => import('../pages/investor/InvestorPortfolio'));
const ProductionPipeline = lazy(() => import('../pages/production/ProductionPipeline'));
```

### Bundle Size Reduction

Migration from Chart.js to Recharts reduced bundle size:
- **Chart.js**: ~250KB
- **Recharts**: ~180KB
- **Savings**: ~70KB (28% reduction)

### Caching Strategy

Dashboard data is cached with appropriate TTLs:
- **Real-time metrics**: 1 minute
- **Analytics data**: 5 minutes  
- **Historical data**: 1 hour

## Testing

### Production URLs

All features have been tested on production:
- Frontend: https://pitchey.pages.dev
- API: https://pitchey-production.cavelltheleaddev.workers.dev

### Browser Compatibility

Tested and verified on:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

## API Integration

Each portal connects to specific API endpoints:

### Creator Endpoints
```
GET /api/creator/dashboard
GET /api/creator/pitches
GET /api/creator/analytics
POST /api/creator/pitches
PUT /api/creator/pitches/:id
DELETE /api/creator/pitches/:id
```

### Investor Endpoints
```
GET /api/investor/dashboard
GET /api/investor/portfolio
GET /api/investor/analytics
POST /api/investor/invest
POST /api/investor/nda/request
GET /api/investor/saved
```

### Production Endpoints
```
GET /api/production/dashboard
GET /api/production/projects
GET /api/production/submissions
POST /api/production/projects
PUT /api/production/projects/:id
POST /api/production/submissions/review
```

## Deployment

The application is deployed using Cloudflare infrastructure:
- **Frontend**: Cloudflare Pages
- **API**: Cloudflare Workers
- **Database**: Neon PostgreSQL with Hyperdrive
- **Cache**: Upstash Redis
- **WebSockets**: Cloudflare Durable Objects

## Future Enhancements

Planned improvements for the portal system:
1. **Advanced Analytics**: More detailed metrics and custom reports
2. **Collaboration Tools**: Real-time editing and comments
3. **Mobile Apps**: Native iOS and Android applications
4. **AI Integration**: Smart recommendations and content analysis
5. **Blockchain**: Smart contracts for investment tracking

## Troubleshooting

### Common Issues and Solutions

1. **Charts not rendering**
   - Ensure ChartContainer has a defined height
   - Check data format matches Recharts structure

2. **Navigation not updating**
   - Clear browser cache
   - Check user role permissions

3. **API errors**
   - Verify authentication token
   - Check CORS configuration

4. **Performance issues**
   - Enable Redis caching
   - Implement pagination for large datasets

## Documentation References

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Recharts Documentation](https://recharts.org)
- [React Router Documentation](https://reactrouter.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)

---

*Last Updated: December 2024*
*Version: 2.0.0*
*Status: Production Ready*