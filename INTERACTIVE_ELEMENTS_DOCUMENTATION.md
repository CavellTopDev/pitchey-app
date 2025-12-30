# Pitchey Platform - Interactive Elements & Cross-Portal Communication Documentation

**Version**: 1.0  
**Date**: December 7, 2024  
**Author**: System Documentation via Context7 & Chrome DevTools Analysis

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Authentication & Portal Selection](#authentication--portal-selection)
3. [Creator Portal Interactive Elements](#creator-portal-interactive-elements)
4. [Investor Portal Interactive Elements](#investor-portal-interactive-elements)
5. [Production Portal Interactive Elements](#production-portal-interactive-elements)
6. [Shared Components & Cross-Portal Communication](#shared-components--cross-portal-communication)
7. [WebSocket & Real-Time Features](#websocket--real-time-features)
8. [API Endpoints Map](#api-endpoints-map)

---

## Architecture Overview

### Portal Structure
```
Pitchey Platform
├── Public Routes (Unauthenticated)
│   ├── Homepage (/)
│   ├── Browse (/browse)
│   ├── Portal Selection (/portals)
│   └── Login Pages (/login/creator, /login/investor, /login/production)
│
├── Creator Portal (Authenticated - userType: 'creator')
│   ├── Dashboard (/creator/dashboard)
│   ├── Create Pitch (/creator/create-pitch)
│   ├── Manage Pitches (/creator/pitches)
│   └── Analytics (/creator/analytics)
│
├── Investor Portal (Authenticated - userType: 'investor')
│   ├── Dashboard (/investor/dashboard)
│   ├── Portfolio (/investor/portfolio)
│   ├── Browse (/investor/browse)
│   └── NDAs (/investor/ndas)
│
└── Production Portal (Authenticated - userType: 'production')
    ├── Dashboard (/production/dashboard)
    ├── Saved Pitches (/production/saved)
    ├── Following (/production/following)
    └── NDAs (/production/ndas)
```

### Authentication Flow
```typescript
// React Router Implementation (from Context7 docs)
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      // Public routes
      { path: "/", element: <Homepage /> },
      { path: "/browse", element: <MarketplaceEnhanced /> },
      { path: "/portals", element: <PortalSelect /> },
      
      // Portal-specific routes with authentication guards
      {
        path: "/creator/*",
        element: <RoleProtectedRoute allowedRoles={['creator']} />,
        children: [/* Creator routes */]
      },
      {
        path: "/investor/*",
        element: <RoleProtectedRoute allowedRoles={['investor']} />,
        children: [/* Investor routes */]
      },
      {
        path: "/production/*",
        element: <RoleProtectedRoute allowedRoles={['production']} />,
        children: [/* Production routes */]
      }
    ]
  }
]);
```

---

## Authentication & Portal Selection

### Portal Selection Page (/portals)
**Interactive Elements:**
- **Creator Portal Button** → Navigates to `/login/creator`
- **Investor Portal Button** → Navigates to `/login/investor`
- **Production Portal Button** → Navigates to `/login/production`
- **Back Button** → Returns to homepage

### Login Pages
**Common Elements Across All Login Pages:**
```javascript
// Each login page has:
- Email Input Field (required)
- Password Input Field (required)
- Sign In Button → Triggers authentication
- Demo Account Button → Auto-fills demo credentials
- Forgot Password Link → `/forgot-password`
- Portal Switch Links → Navigate between login types
```

**Authentication Endpoints:**
- Creator: `POST /api/auth/creator/login`
- Investor: `POST /api/auth/investor/login`
- Production: `POST /api/auth/production/login`

**On Successful Login:**
```javascript
// Stores in localStorage:
localStorage.setItem('authToken', token);
localStorage.setItem('user', JSON.stringify(user));
localStorage.setItem('userType', userType);

// Redirects to appropriate dashboard:
navigate(`/${userType}/dashboard`);
```

---

## Creator Portal Interactive Elements

### Creator Dashboard (/creator/dashboard)

#### Header Navigation
```javascript
- Pitchey Logo → Homepage (/)
- Dashboard Indicator → Current location
- Credits Display → Shows subscription credits
- Subscription Badge → Opens subscription management
- Notifications Bell → Opens notification center
- New Pitch Button → Navigate to /creator/create-pitch
- Profile Menu → Dropdown with:
  - Profile → /creator/profile
  - Settings → /creator/settings
  - Logout → Clears auth & redirects to /login/creator
```

#### Quick Action Buttons
```javascript
- Upload New Pitch → /creator/create-pitch
- Manage Pitches → /creator/pitches
- View Analytics → /creator/analytics
- NDA Management → /creator/ndas
- View My Portfolio → /creator/portfolio
- Following → /creator/following
- Messages → /creator/messages
- Calendar → /creator/calendar
- Billing & Payments → /creator/billing
```

#### Analytics Controls
```javascript
- Auto Refresh Toggle → Enables real-time data updates
- Time Range Buttons:
  - 7 Days → Sets date filter
  - 30 Days → Sets date filter
  - 90 Days → Sets date filter
  - 1 Year → Sets date filter
- Export Button → Downloads CSV data
```

### Create Pitch Page (/creator/create-pitch)

#### Form Fields & Actions
```javascript
// Basic Information
- Title Input (required)
- Logline Textarea (required, 160 char limit)
- Genre Select → Dropdown with predefined genres
- Format Select → Film/Series/Limited Series/etc.

// Detailed Information
- Short Synopsis (500 chars)
- Long Synopsis (2000 chars)
- Budget Input → Number field
- Target Audience Textarea
- Comparable Titles Input

// Media Uploads
- Lookbook Upload → Accepts PDF/Image
- Script Upload → Accepts PDF/DOC
- Pitch Deck Upload → Accepts PDF/PPT
- Trailer Upload → Accepts Video files

// Action Buttons
- Save as Draft → POST /api/creator/pitches (status: 'draft')
- Publish → POST /api/creator/pitches (status: 'published')
- Cancel → Returns to dashboard
```

### Manage Pitches Page (/creator/pitches)

#### Pitch Card Actions
```javascript
// For each pitch:
- View Button → /pitch/{id}
- Edit Button → /creator/pitch/{id}/edit
- Analytics Button → /creator/pitch/{id}/analytics
- Delete Button → DELETE /api/pitches/{id}
- Status Toggle → PATCH /api/pitches/{id} (toggle published/draft)
```

---

## Investor Portal Interactive Elements

### Investor Dashboard (/investor/dashboard)

#### Header Navigation
```javascript
- Toggle Menu → Opens/closes sidebar
- Pitchey Logo → Homepage
- Portal Indicator → Shows "Investor Portal"
- Notifications Bell → /investor/notifications
- User Avatar → Profile menu
- Logout Button → Clears session
```

#### Navigation Tabs
```javascript
- Overview → /investor/dashboard (default)
- Portfolio → /investor/portfolio
- Saved → /investor/saved
- NDAs → /investor/ndas
- Analytics → /investor/analytics
```

#### Dashboard Metrics Cards
```javascript
// Each metric card is clickable:
- Total Invested → /investor/portfolio?filter=all
- Active Deals → /investor/portfolio?filter=active
- Average ROI → /investor/analytics?view=roi
- Top Performer → /pitch/{topPerformerId}
```

#### Quick Actions Grid
```javascript
- Browse Pitches → /browse
- Network → /investor/network
- Schedule → /investor/calendar
- Documents → /investor/documents
```

### Portfolio Page (/investor/portfolio)

#### Investment Actions
```javascript
// For each investment:
- View Details → /investor/investment/{id}
- Contact Creator → Opens message dialog
- Request Update → POST /api/investment/{id}/request-update
- View NDA → /investor/nda/{ndaId}
```

---

## Production Portal Interactive Elements

### Production Dashboard (/production/dashboard)

#### Header Elements
```javascript
- Toggle Menu → Sidebar navigation
- Pitchey Logo → Homepage
- Dashboard Title → "Production Dashboard"
- Company Display → Shows company name
- Notifications → /production/notifications
- User Menu → Profile dropdown
- Logout → Session termination
```

#### Navigation Menu
```javascript
- Overview → /production/dashboard
- Saved Pitches → /production/saved
- Following → /production/following
- NDAs → /production/ndas
```

#### Analytics Dashboard Controls
```javascript
// Same as Creator Portal:
- Auto Refresh Toggle
- Time Range Selectors (7/30/90/365 days)
- Export Button → CSV download
```

#### Project Pipeline Table
```javascript
// For each project row:
- Project Name → /production/project/{id}
- Status Badge → Clickable filter
- Edit Timeline → Opens modal
- View Details → Expanded view
```

### Following Page (/production/following)

#### Following Management
```javascript
// Tab Navigation:
- Followers Tab → GET /api/follows/followers
- Following Tab → GET /api/follows/following

// User Cards:
- Follow/Unfollow Button → POST/DELETE /api/follows/{userId}
- View Profile → /user/{userId}
- View Pitches → /browse?creator={userId}
- Send Message → Opens message dialog
```

---

## Shared Components & Cross-Portal Communication

### Browse/Marketplace Component
**Available to all user types with different features:**

```javascript
// Common Elements:
- Search Bar → GET /api/pitches/search?q={query}
- Filter Button → Opens filter panel
- Sort Dropdown → Changes result order

// Tab Navigation (FIXED):
- All Pitches → Shows all available pitches
- Trending → Shows only pitches with 100+ views
- Latest → Shows pitches from last 7 days

// Pitch Card Actions (Role-Based):
if (userType === 'creator') {
  // Cannot interact with own pitches
  - View Only → /pitch/{id}
}
if (userType === 'investor') {
  - View Details → /pitch/{id}
  - Save Pitch → POST /api/pitches/{id}/save
  - Request NDA → POST /api/pitches/{id}/request-nda
  - Contact Creator → Message dialog
}
if (userType === 'production') {
  - View Details → /pitch/{id}
  - Save for Review → POST /api/pitches/{id}/save
  - Request NDA → POST /api/pitches/{id}/request-nda
  - Follow Creator → POST /api/follows/{creatorId}
}
```

### Pitch Detail View
**Dynamic based on user role and NDA status:**

```javascript
// Public Information (All Users):
- Title, Logline, Genre, Format
- View Count, Created Date
- Creator Info (username, avatar)

// Enhanced Info (After NDA):
if (hasSignedNDA) {
  - Full Synopsis
  - Budget Details
  - Target Audience
  - Comparable Titles
  - Production Timeline
  - Attached Talent
  - Distribution Strategy
  - Download Materials Button
}

// Action Buttons (Role-Based):
switch(userType) {
  case 'creator':
    if (isOwner) {
      - Edit Pitch → /creator/pitch/{id}/edit
      - View Analytics → /creator/pitch/{id}/analytics
      - Manage NDAs → /creator/pitch/{id}/ndas
    }
    break;
  
  case 'investor':
    - Save/Unsave → Toggle saved status
    - Request NDA → Opens NDA workflow
    - Contact Creator → Message system
    - Track Investment → /investor/track/{pitchId}
    break;
    
  case 'production':
    - Save for Review → Adds to saved list
    - Request NDA → NDA workflow
    - Follow Creator → Toggle follow status
    - Schedule Meeting → Calendar integration
    break;
}
```

### NDA Workflow Component

```javascript
// NDA Request Flow:
1. Request NDA Button → Opens modal
2. Select NDA Type:
   - Basic (Free) → View enhanced info
   - Full ($50) → Access all materials
3. Review Terms → Display agreement
4. Sign Agreement → POST /api/nda/sign
5. Payment (if required) → Stripe checkout
6. Confirmation → Update UI permissions

// NDA Management (Creator):
- View Requests → GET /api/creator/nda/requests
- Approve/Reject → PATCH /api/nda/{id}/status
- Set Custom Terms → PUT /api/nda/{id}/terms
- Track Expiration → Automated notifications
```

---

## WebSocket & Real-Time Features

### WebSocket Connection
```javascript
// Connection establishment:
const ws = new WebSocket('wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws');

// Authentication:
ws.send(JSON.stringify({
  type: 'auth',
  token: localStorage.getItem('authToken')
}));
```

### Real-Time Events

#### Notification Events
```javascript
// Incoming notification:
{
  type: 'notification',
  data: {
    id: string,
    title: string,
    message: string,
    actionUrl?: string,
    priority: 'low' | 'medium' | 'high'
  }
}

// UI Update:
- Show toast notification
- Update notification badge count
- Add to notification center
```

#### Dashboard Updates
```javascript
// Analytics update:
{
  type: 'analytics_update',
  data: {
    metric: string,
    value: number,
    change: number
  }
}

// Following activity:
{
  type: 'following_activity',
  data: {
    creatorId: number,
    action: 'new_pitch' | 'pitch_update',
    pitchId: number
  }
}
```

#### Message System
```javascript
// New message:
{
  type: 'new_message',
  data: {
    from: userId,
    message: string,
    timestamp: Date
  }
}

// Typing indicator:
{
  type: 'typing',
  data: {
    userId: number,
    isTyping: boolean
  }
}
```

---

## API Endpoints Map

### Authentication Endpoints
```
POST /api/auth/creator/login     - Creator login
POST /api/auth/investor/login    - Investor login
POST /api/auth/production/login  - Production login
POST /api/auth/logout            - Universal logout
GET  /api/auth/verify            - Verify JWT token
POST /api/auth/refresh           - Refresh JWT token
```

### Pitch Management
```
GET  /api/pitches                - List all pitches
GET  /api/pitches/public         - Public pitches (no auth)
GET  /api/pitches/public/{id}    - Public pitch detail
GET  /api/pitches/{id}           - Auth pitch detail
POST /api/creator/pitches        - Create pitch
PUT  /api/pitches/{id}           - Update pitch
DELETE /api/pitches/{id}         - Delete pitch
POST /api/pitches/{id}/view      - Record view
POST /api/pitches/{id}/like      - Like pitch
DELETE /api/pitches/{id}/like    - Unlike pitch
POST /api/pitches/{id}/save      - Save pitch
DELETE /api/pitches/{id}/save    - Unsave pitch
```

### NDA Management
```
POST /api/pitches/{id}/request-nda  - Request NDA
POST /api/nda/{id}/sign             - Sign NDA
GET  /api/nda/my                    - My NDAs
GET  /api/nda/pending               - Pending NDAs
PATCH /api/nda/{id}/status         - Update NDA status
```

### Follow System
```
GET  /api/follows/followers      - Get followers
GET  /api/follows/following      - Get following
POST /api/follows/{userId}       - Follow user
DELETE /api/follows/{userId}     - Unfollow user
GET  /api/follows/stats          - Follow statistics
```

### Dashboard & Analytics
```
GET  /api/creator/dashboard      - Creator dashboard data
GET  /api/investor/dashboard     - Investor dashboard data
GET  /api/production/dashboard   - Production dashboard data
GET  /api/analytics/user         - User analytics
GET  /api/analytics/pitch/{id}   - Pitch analytics
```

### Search & Browse
```
GET  /api/pitches/browse/enhanced  - Enhanced browse with filters
GET  /api/pitches/browse/general   - Basic browse
GET  /api/search                   - Global search
GET  /api/search/users             - User search
GET  /api/pitches/trending         - Trending pitches
GET  /api/pitches/following        - Following activity
```

### Messaging
```
POST /api/messages/send          - Send message
GET  /api/messages/inbox         - Get inbox
GET  /api/messages/thread/{id}   - Get conversation
POST /api/messages/mark-read     - Mark as read
```

### Notifications
```
GET  /api/user/notifications     - Get notifications
POST /api/notifications/mark-read - Mark notification read
POST /api/notifications/settings  - Update preferences
```

---

## Cross-Portal Communication Patterns

### 1. Creator → Investor Flow
```
Creator publishes pitch
  → Appears in Browse/Marketplace
  → Investor discovers pitch
  → Investor requests NDA
  → Creator receives notification
  → Creator approves NDA
  → Investor gains enhanced access
  → Communication via messaging
  → Investment tracking begins
```

### 2. Production → Creator Flow
```
Production company browses
  → Finds interesting pitch
  → Follows creator
  → Requests NDA for review
  → Creator approves
  → Production saves pitch
  → Schedules meeting
  → Project development begins
```

### 3. Multi-Party Collaboration
```
Investor funds project
  → Production company produces
  → Creator maintains rights
  → All parties track via dashboard
  → Real-time updates via WebSocket
  → Shared document access
  → Milestone tracking
```

---

## Security & Permissions Matrix

| Feature | Creator (Own) | Creator (Other) | Investor | Production | Public |
|---------|--------------|-----------------|----------|------------|--------|
| View Basic Pitch | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Enhanced Info | ✓ | ✗ | NDA Required | NDA Required | ✗ |
| Edit Pitch | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete Pitch | ✓ | ✗ | ✗ | ✗ | ✗ |
| Request NDA | ✗ | ✓ | ✓ | ✓ | ✗ |
| Approve NDA | ✓ | ✗ | ✗ | ✗ | ✗ |
| Send Message | ✓ | ✓ | ✓ | ✓ | ✗ |
| Follow User | ✗ | ✓ | ✓ | ✓ | ✗ |
| View Analytics | ✓ | ✗ | Own Only | Own Only | ✗ |
| Make Investment | ✗ | ✗ | ✓ | ✗ | ✗ |

---

## Navigation State Management

### Using React Router Hooks (Context7 Reference)
```javascript
// Access current route params
const params = useParams();
// Example: /pitch/123 → params.pitchId = "123"

// Programmatic navigation
const navigate = useNavigate();
// Example: navigate('/creator/dashboard')

// Access location state
const location = useLocation();
// Example: location.state?.from (previous route)

// Get child routes
const outlet = useOutlet();
// Renders nested route components
```

### State Persistence
```javascript
// Authentication state (Zustand store)
const { user, isAuthenticated, userType } = useAuthStore();

// WebSocket state
const { connected, notifications } = useWebSocketStore();

// UI state (React Context)
const { theme, sidebarOpen, activeTab } = useUIContext();
```

---

## Testing from Browser Console

### Quick Login Scripts
```javascript
// Copy and paste these into browser console at https://pitchey-5o8.pages.dev

// Login as Creator
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alex.creator@demo.com', password: 'Demo123' })
})
.then(r => r.json())
.then(data => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'creator');
    console.log('✅ Logged in as Creator');
    window.location.href = '/creator/dashboard';
  }
});

// Login as Investor
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/investor/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'sarah.investor@demo.com', password: 'Demo123' })
})
.then(r => r.json())
.then(data => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'investor');
    console.log('✅ Logged in as Investor');
    window.location.href = '/investor/dashboard';
  }
});

// Login as Production
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/production/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'stellar.production@demo.com', password: 'Demo123' })
})
.then(r => r.json())
.then(data => {
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('userType', 'production');
    console.log('✅ Logged in as Production');
    window.location.href = '/production/dashboard';
  }
});
```

### Demo Account Credentials
```
Creator:
- Email: alex.creator@demo.com
- Password: Demo123

Investor:
- Email: sarah.investor@demo.com
- Password: Demo123

Production:
- Email: stellar.production@demo.com
- Password: Demo123
```

---

## Comprehensive Browser Testing Suite

### Complete Interactive Test Suite
```javascript
// Full test suite for browser console at https://pitchey-5o8.pages.dev
// This tests all interactive elements and cross-portal communication

const PitcheyTestSuite = {
  API_BASE: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  
  // Main test runner
  async runFullTest() {
    console.log('🎬 PITCHEY PLATFORM TEST SUITE');
    console.log('================================');
    
    // Test each portal
    await this.testCreatorPortal();
    await this.testInvestorPortal();
    await this.testProductionPortal();
    
    // Test cross-portal features
    await this.testCrossPortalCommunication();
    
    console.log('================================');
    console.log('✅ ALL TESTS COMPLETE!');
  },
  
  // Test Creator Portal
  async testCreatorPortal() {
    console.log('\n🎬 TESTING CREATOR PORTAL');
    console.log('----------------------------');
    
    // Login
    const login = await fetch(`${this.API_BASE}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (!login.token) {
      console.error('❌ Creator login failed');
      return;
    }
    
    localStorage.setItem('authToken', login.token);
    console.log('✅ Creator logged in');
    
    // Test dashboard
    const dashboard = await this.authFetch('/api/creator/dashboard');
    console.log(`📈 Dashboard: ${dashboard.stats?.totalPitches || 0} pitches, ${dashboard.stats?.totalViews || 0} views`);
    
    // Test pitch management
    const pitches = await this.authFetch('/api/creator/pitches');
    console.log(`🎬 My Pitches: ${pitches.data?.length || 0} found`);
    
    // Test analytics
    const analytics = await this.authFetch('/api/analytics/user');
    console.log(`📊 Analytics: ${analytics.data ? 'Available' : 'Not available'}`);
  },
  
  // Test Investor Portal
  async testInvestorPortal() {
    console.log('\n💰 TESTING INVESTOR PORTAL');
    console.log('----------------------------');
    
    // Login
    const login = await fetch(`${this.API_BASE}/api/auth/investor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sarah.investor@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (!login.token) {
      console.error('❌ Investor login failed');
      return;
    }
    
    localStorage.setItem('authToken', login.token);
    console.log('✅ Investor logged in');
    
    // Test dashboard
    const dashboard = await this.authFetch('/api/investor/dashboard');
    console.log(`📈 Dashboard: $${dashboard.stats?.totalInvested || 0} invested, ${dashboard.stats?.activeDeals || 0} active deals`);
    
    // Test portfolio
    const portfolio = await this.authFetch('/api/investor/portfolio');
    console.log(`💼 Portfolio: ${portfolio.data?.length || 0} investments`);
    
    // Test NDAs
    const ndas = await this.authFetch('/api/nda/my');
    console.log(`📄 NDAs: ${ndas.data?.length || 0} signed`);
  },
  
  // Test Production Portal
  async testProductionPortal() {
    console.log('\n🎥 TESTING PRODUCTION PORTAL');
    console.log('----------------------------');
    
    // Login
    const login = await fetch(`${this.API_BASE}/api/auth/production/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stellar.production@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (!login.token) {
      console.error('❌ Production login failed');
      return;
    }
    
    localStorage.setItem('authToken', login.token);
    console.log('✅ Production logged in');
    
    // Test dashboard
    const dashboard = await this.authFetch('/api/production/dashboard');
    console.log(`📈 Dashboard: ${dashboard.stats?.activeProjects || 0} projects, $${dashboard.stats?.totalBudget || 0} budget`);
    
    // Test following
    const following = await this.authFetch('/api/follows/following');
    console.log(`👥 Following: ${following.data?.length || 0} creators`);
    
    // Test saved pitches
    const saved = await this.authFetch('/api/production/saved');
    console.log(`💾 Saved: ${saved.data?.length || 0} pitches`);
  },
  
  // Test cross-portal communication
  async testCrossPortalCommunication() {
    console.log('\n🌐 TESTING CROSS-PORTAL FEATURES');
    console.log('----------------------------');
    
    // Test public browse
    const publicPitches = await fetch(`${this.API_BASE}/api/pitches/public?limit=3`)
      .then(r => r.json());
    console.log(`🌍 Public Pitches: ${publicPitches.data?.length || 0} available`);
    
    // Test search
    const search = await fetch(`${this.API_BASE}/api/pitches/browse/general?search=the`)
      .then(r => r.json());
    console.log(`🔍 Search Results: ${search.data?.length || 0} matches`);
    
    // Test WebSocket connection
    const ws = new WebSocket(`wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws`);
    ws.onopen = () => console.log('🔌 WebSocket: Connected');
    ws.onerror = () => console.log('❌ WebSocket: Error');
    setTimeout(() => ws.close(), 2000);
  },
  
  // Helper function for authenticated requests
  async authFetch(endpoint) {
    const token = localStorage.getItem('authToken');
    return fetch(`${this.API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());
  }
};

// Run the complete test
PitcheyTestSuite.runFullTest();
```

### Quick Element Testing
```javascript
// Test specific UI elements from console

// Check if login button exists
document.querySelector('button[type="submit"]') ? '✅ Login button found' : '❌ Login button missing';

// Check navigation menu
document.querySelectorAll('nav a').length + ' navigation links found';

// Check for error messages
document.querySelector('[role="alert"]') ? '⚠️ Error message present' : '✅ No errors';

// Test responsive menu toggle
const menuToggle = document.querySelector('[aria-label*="menu"]');
if (menuToggle) {
  menuToggle.click();
  console.log('🍔 Menu toggled');
}

// Check authentication state
if (localStorage.getItem('authToken')) {
  console.log('🔐 User is authenticated');
  console.log('User type:', localStorage.getItem('userType'));
} else {
  console.log('🔓 User is not authenticated');
}
```

## Conclusion

This documentation provides a comprehensive map of all interactive elements, their corresponding API endpoints, and the communication patterns between the three portal types. The platform uses a role-based architecture with JWT authentication, WebSocket for real-time features, and React Router for navigation management.

Key architectural decisions:
1. **Portal Separation**: Each user type has dedicated routes and components
2. **Role-Based Access**: Permissions enforced at both frontend and backend
3. **Real-Time Updates**: WebSocket integration for live notifications and updates
4. **Progressive Disclosure**: NDA system controls access to sensitive information
5. **Cross-Portal Communication**: Structured messaging and notification system

The platform successfully enables collaboration between creators, investors, and production companies while maintaining appropriate access controls and user experience tailored to each role's needs.

### Quick Test Reference Card
```javascript
// Essential commands for browser console testing at https://pitchey-5o8.pages.dev

// 1. Quick login (choose one)
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: 'alex.creator@demo.com', password: 'Demo123'})}).then(r => r.json()).then(d => {localStorage.setItem('authToken', d.token); console.log('Logged in as Creator');});

// 2. Check API health
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health').then(r => r.json()).then(console.log);

// 3. Get public pitches
fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public').then(r => r.json()).then(console.log);

// 4. Test WebSocket
new WebSocket('wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws').onopen = () => console.log('WebSocket connected');

// 5. Run full test suite
fetch('https://raw.githubusercontent.com/your-repo/tests.js').then(r => r.text()).then(eval);
```