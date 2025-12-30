# Pitchey Portal Navigation System Documentation

## Overview

The Pitchey platform features a comprehensive multi-portal navigation system designed for three distinct user types: **Creators**, **Investors**, and **Production Companies**. Each portal provides specialized workflows, dashboards, and tools tailored to the specific needs of each user type.

## Production URLs

- **Frontend**: https://pitchey-5o8.pages.dev
- **Backend API**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **WebSocket**: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

## Architecture

### Technology Stack
- **Frontend Framework**: React 18 with TypeScript
- **Routing**: React Router v6 with lazy loading
- **State Management**: React Context API
- **UI Components**: Custom components with Lucide React icons
- **Charts**: Chart.js with React Chart.js 2
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages

### Key Design Patterns

#### 1. Lazy Loading Pattern
```typescript
const CreatorActivity = lazy(() => import('../pages/creator/CreatorActivity'));
```
All portal pages use React's lazy loading to optimize bundle size and initial load performance.

#### 2. Portal-Specific Navigation
The `EnhancedNavigation` component dynamically adjusts menu items based on the user's portal type:
```typescript
interface EnhancedNavigationProps {
  user: any;
  userType: 'creator' | 'investor' | 'production';
  onLogout: () => void;
}
```

#### 3. Route Configuration
Centralized route configuration in `/frontend/src/config/navigationRoutes.tsx`:
```typescript
export const navigationRoutes = {
  '/creator/activity': { component: CreatorActivity, title: 'Activity Feed' },
  // ... more routes
};
```

## Portal Structures

### 1. Creator Portal

#### Purpose
Enables content creators to manage their pitches, track performance, and collaborate with team members.

#### Navigation Structure
```
Dashboard
├── Overview (/creator/dashboard)
├── Activity Feed (/creator/activity)
├── Quick Stats (/creator/stats)
└── Analytics (/creator/analytics)

My Pitches
├── All Pitches (/creator/pitches)
├── Published (/creator/pitches/published)
├── Drafts (/creator/pitches/drafts)
├── Under Review (/creator/pitches/review)
├── Analytics (/creator/pitches/analytics)
└── Create New (/creator/pitch/new)

Team
├── Team Members (/creator/team)
├── Invite Members (/creator/team/invite)
├── Roles & Permissions (/creator/team/roles)
└── Collaborations (/creator/collaborations)
```

#### Key Features
- **Activity Tracking**: Real-time notifications for views, likes, comments, follows
- **Performance Analytics**: Views over time, engagement metrics, genre performance
- **Pitch Management**: Draft system with auto-save, version control
- **Team Collaboration**: Role-based access control, invitation system
- **Review System**: Professional feedback tracking with status updates

#### Component Files
- `/pages/creator/CreatorActivity.tsx` - Activity feed and notifications
- `/pages/creator/CreatorStats.tsx` - Performance metrics and charts
- `/pages/creator/CreatorPitchesPublished.tsx` - Published pitch management
- `/pages/creator/CreatorPitchesDrafts.tsx` - Draft management with progress tracking
- `/pages/creator/CreatorPitchesReview.tsx` - Review feedback and status
- `/pages/creator/CreatorPitchesAnalytics.tsx` - Detailed analytics dashboard
- `/pages/creator/CreatorTeamMembers.tsx` - Team roster management
- `/pages/creator/CreatorTeamInvite.tsx` - Invitation system
- `/pages/creator/CreatorTeamRoles.tsx` - Permission management
- `/pages/creator/CreatorCollaborations.tsx` - Partnership tracking

### 2. Investor Portal

#### Purpose
Provides investment professionals with tools to discover opportunities, manage portfolios, and track performance.

#### Navigation Structure
```
Dashboard
├── Overview (/investor/dashboard)
├── Activity Feed (/investor/activity)
├── Quick Stats (/investor/stats)
└── Analytics (/investor/analytics)

Portfolio
├── My Investments (/investor/portfolio)
├── Saved Pitches (/investor/saved)
├── Watchlist (/investor/watchlist)
├── Deal Flow (/investor/deals)
└── Performance (/investor/performance)

Browse
├── All Pitches (/marketplace)
├── Trending (/marketplace?tab=trending)
├── Featured (/marketplace?tab=featured)
└── By Genre (/browse/genres)
```

#### Key Features
- **Portfolio Management**: Track active investments, ROI, exit strategies
- **Deal Pipeline**: Stage-based deal tracking (Due Diligence → Negotiation → Closing)
- **Market Intelligence**: Sector analysis, trending opportunities, creator recommendations
- **Risk Analytics**: Portfolio diversification, risk scores, performance vs market
- **Watchlist System**: Monitor creators and projects with custom alerts
- **Investment Metrics**: IRR, cash multiples, holding periods

#### Component Files
- `/pages/investor/InvestorActivity.tsx` - Investment updates and portfolio activity
- `/pages/investor/InvestorStats.tsx` - Quick investment metrics
- `/pages/investor/InvestorAnalytics.tsx` - Advanced market intelligence
- `/pages/investor/InvestorPortfolio.tsx` - Active investment management
- `/pages/investor/InvestorSaved.tsx` - Bookmarked opportunities
- `/pages/investor/InvestorWatchlist.tsx` - Creator/project monitoring
- `/pages/investor/InvestorDeals.tsx` - Deal pipeline management
- `/pages/investor/InvestorPerformance.tsx` - Performance analytics

### 3. Production Portal

#### Purpose
Enables production companies to manage projects, review submissions, and track production pipelines.

#### Navigation Structure
```
Dashboard
├── Overview (/production/dashboard)
├── Activity Feed (/production/activity)
├── Quick Stats (/production/stats)
└── Analytics (/production/analytics)

Projects
├── Active Projects (/production/projects)
├── In Development (/production/projects/development)
├── In Production (/production/projects/production)
├── Post-Production (/production/projects/post)
├── Completed (/production/projects/completed)
└── Pipeline (/production/pipeline)

Submissions
├── New Submissions (/production/submissions/new)
├── Under Review (/production/submissions/review)
├── Shortlisted (/production/submissions/shortlisted)
├── Accepted (/production/submissions/accepted)
├── Rejected (/production/submissions/rejected)
└── Archive (/production/submissions/archive)

Team
├── Team Members (/production/team)
├── Invite Members (/production/team/invite)
├── Roles & Permissions (/production/team/roles)
└── Collaborations (/production/collaborations)
```

#### Key Features
- **Project Lifecycle Management**: Track projects from development to distribution
- **Submission Pipeline**: Review system with multi-stage approval workflow
- **Budget Tracking**: Cost variance analysis, budget utilization trends
- **Resource Management**: Crew utilization, equipment scheduling
- **Partnership Tracking**: Studio collaborations, co-production deals
- **Production Analytics**: Timeline performance, completion rates

#### Component Files
- `/pages/production/ProductionActivity.tsx` - Production updates
- `/pages/production/ProductionStats.tsx` - Quick production metrics
- `/pages/production/ProductionAnalytics.tsx` - Comprehensive analytics
- `/pages/production/ProductionProjects.tsx` - Project overview
- `/pages/production/ProductionProjectsDevelopment.tsx` - Development stage
- `/pages/production/ProductionProjectsActive.tsx` - Active productions
- `/pages/production/ProductionProjectsPost.tsx` - Post-production
- `/pages/production/ProductionProjectsCompleted.tsx` - Completed projects
- `/pages/production/ProductionPipeline.tsx` - Pipeline visualization
- `/pages/production/ProductionSubmissions*.tsx` - Submission management

## Common Components

### Shared UI Patterns

#### 1. Dashboard Cards
All portals use consistent card layouts for metrics:
```typescript
interface StatCard {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: LucideIcon;
  color: string;
}
```

#### 2. Activity Feeds
Unified activity item structure:
```typescript
interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: Date;
  user?: User;
  metadata?: any;
  read: boolean;
}
```

#### 3. Chart Components
Standardized chart configurations using Chart.js:
- Line charts for trends
- Bar charts for comparisons
- Pie/Doughnut charts for distributions
- Radar charts for multi-dimensional analysis

#### 4. Loading States
Consistent skeleton loaders across all portals:
```typescript
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
</div>
```

#### 5. Empty States
User-friendly empty state messages with CTAs:
```typescript
<div className="text-center p-12">
  <Icon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
  <h3 className="text-xl font-semibold mb-2">{title}</h3>
  <p className="text-gray-600 mb-6">{description}</p>
  <Button onClick={action}>{actionText}</Button>
</div>
```

## Navigation Implementation

### Route Registration
All routes are registered in the main App component:
```typescript
import { navigationRoutes } from './config/navigationRoutes';

// In App.tsx
{Object.entries(navigationRoutes).map(([path, config]) => (
  <Route 
    key={path} 
    path={path} 
    element={
      <Suspense fallback={<LoadingSpinner />}>
        <config.component />
      </Suspense>
    } 
  />
))}
```

### Dynamic Menu Generation
The navigation menu dynamically generates based on user type:
```typescript
const navigationStructure = {
  dashboard: {
    label: 'Dashboard',
    icon: Home,
    dropdown: [
      { label: 'Overview', href: `/${userType}/dashboard`, icon: Home },
      { label: 'Analytics', href: `/${userType}/analytics`, icon: BarChart3 },
      // ... more items
    ]
  },
  // ... more sections
};
```

### Navigation Guards
Protected routes ensure users can only access their portal:
```typescript
const ProtectedRoute = ({ children, allowedUserTypes }) => {
  const { userType } = useAuth();
  
  if (!allowedUserTypes.includes(userType)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};
```

## State Management

### Portal Context
Each portal maintains its own context for state management:
```typescript
interface PortalContext {
  userType: 'creator' | 'investor' | 'production';
  user: User;
  notifications: Notification[];
  activities: Activity[];
  stats: Statistics;
}
```

### Data Flow
1. **API Calls**: Services fetch data from backend
2. **State Updates**: Context providers manage state
3. **Component Rendering**: Components consume context
4. **Real-time Updates**: WebSocket connections for live data

## Performance Optimizations

### 1. Code Splitting
- Route-based code splitting with React.lazy()
- Component-level splitting for heavy features
- Dynamic imports for optional features

### 2. Caching Strategy
- API response caching with 5-minute TTL
- Local storage for user preferences
- Session storage for temporary data

### 3. Optimization Techniques
- Virtual scrolling for long lists
- Debounced search inputs
- Memoized expensive calculations
- Optimistic UI updates

## Testing Approach

### Unit Testing
- Component testing with React Testing Library
- Service testing with Jest
- Utility function testing

### Integration Testing
- Route navigation testing
- API integration testing
- WebSocket connection testing

### E2E Testing
- User flow testing with Playwright
- Cross-portal navigation testing
- Performance testing

## Deployment

### Build Process
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy frontend/dist --project-name=pitchey
```

### Environment Variables
```env
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
```

### Monitoring
- Sentry for error tracking
- Analytics for user behavior
- Performance monitoring with Web Vitals

## Security Considerations

### Authentication
- JWT-based authentication
- Portal-specific login endpoints
- Role-based access control

### Data Protection
- NDA-protected content
- Encrypted sensitive data
- Secure WebSocket connections

### Best Practices
- Input validation
- XSS protection
- CORS configuration
- Rate limiting

## Future Enhancements

### Planned Features
1. **Advanced Search**: Multi-criteria filtering across all portals
2. **Mobile Apps**: Native iOS/Android applications
3. **AI Integration**: Smart recommendations and insights
4. **Video Conferencing**: Built-in pitch presentation tools
5. **Blockchain Integration**: Smart contracts for investments
6. **Advanced Analytics**: Predictive analytics and ML insights

### Scalability Considerations
- Microservices architecture migration
- GraphQL API implementation
- Real-time collaboration features
- Multi-language support

## Support and Maintenance

### Documentation
- Component documentation with TSDoc
- API documentation with OpenAPI
- User guides and tutorials

### Monitoring Tools
- Error tracking: Sentry
- Analytics: Google Analytics / Mixpanel
- Performance: Lighthouse CI
- Uptime: Pingdom / UptimeRobot

### Contact
- Technical Support: support@pitchey.com
- Documentation: docs.pitchey.com
- GitHub: github.com/pitchey/platform

---

*Last Updated: December 2024*
*Version: 1.0.0*