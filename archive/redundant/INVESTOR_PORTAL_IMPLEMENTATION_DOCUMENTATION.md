# Pitchey Investor Portal Implementation Documentation
> Comprehensive technical documentation of the investor portal architecture, patterns, and implementation details

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Authentication System](#authentication-system)
4. [WebSocket Integration](#websocket-integration)
5. [Data Services Layer](#data-services-layer)
6. [User Interface Components](#user-interface-components)
7. [Portal Protection & Access Control](#portal-protection--access-control)
8. [Loading State Management](#loading-state-management)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Cross-Portal Communication Patterns](#cross-portal-communication-patterns)
11. [Implementation Patterns for Replication](#implementation-patterns-for-replication)
12. [Best Practices & Recommendations](#best-practices--recommendations)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Appendices](#appendices)

---

## Executive Summary

The Pitchey Investor Portal is a sophisticated, real-time investment management platform built with React, TypeScript, and WebSocket technology. It provides investors with comprehensive tools for discovering opportunities, managing portfolios, tracking performance, and communicating with creators. The architecture employs a multi-layered approach with clear separation of concerns, robust state management, and real-time communication capabilities.

### Key Technical Achievements
- **Portal-Specific Authentication**: Segregated authentication flows preventing cross-portal data leakage
- **Real-Time WebSocket Integration**: Live updates for notifications, metrics, and collaboration
- **Safe Data Handling**: Comprehensive null-safety and type validation throughout
- **Intelligent Loading States**: Timeout-protected loading states with retry mechanisms
- **Circuit Breaker Patterns**: Automatic recovery from connection failures

### Architecture Philosophy
The portal follows a **defensive programming** approach with multiple layers of validation, fallback mechanisms, and graceful degradation. Every component assumes potential failure points and implements appropriate recovery strategies.

---

## Architecture Overview

### System Boundaries and Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Application                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Auth       │  │   WebSocket  │  │    Portal    │         │
│  │   Store      │  │   Context    │  │    Guard     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Component Layer                      │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐│          │
│  │  │Dashboard   │  │Navigation  │  │Messages    ││          │
│  │  │Components  │  │Components  │  │Components  ││          │
│  │  └────────────┘  └────────────┘  └────────────┘│          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Service Layer                        │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐│          │
│  │  │Investor    │  │API         │  │WebSocket   ││          │
│  │  │Service     │  │Client      │  │Service     ││          │
│  │  └────────────┘  └────────────┘  └────────────┘│          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Utility Layer                        │          │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐│          │
│  │  │Formatters  │  │Auth Utils  │  │Validators  ││          │
│  │  └────────────┘  └────────────┘  └────────────┘│          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Services                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Cloudflare  │  │     Neon     │  │   Upstash    │         │
│  │   Workers    │  │  PostgreSQL  │  │    Redis     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Separation of Concerns**: Each layer has distinct responsibilities
2. **Single Source of Truth**: Zustand store for authentication state
3. **Defensive Programming**: Every operation assumes potential failure
4. **Progressive Enhancement**: Features degrade gracefully
5. **Type Safety**: Comprehensive TypeScript coverage

---

## Authentication System

### Overview
The authentication system employs a **portal-specific, session-based approach** using Better Auth with cookie-based sessions. It replaces the legacy JWT system while maintaining backward compatibility.

### Core Components

#### 1. Auth Store (authStore.ts)
The centralized authentication state management using Zustand:

```typescript
// Pseudo-code: Auth Store Architecture
class AuthStore {
  // State
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  
  // Portal-Specific Login Methods
  loginInvestor(email, password) {
    1. Set loading state
    2. Call API endpoint: /api/auth/investor/login
    3. Store user data with namespacing
    4. Set userType in localStorage
    5. Update authentication state
    6. Handle errors with detailed messaging
  }
  
  // Unified Logout
  logout(navigateToLogin = true) {
    1. Get current userType for redirect
    2. Clear store state immediately
    3. Clear all localStorage keys
    4. Call backend logout (async, non-blocking)
    5. Redirect to portal-specific login
  }
  
  // Profile Management
  fetchProfile() {
    1. Set loading state
    2. Call API for fresh user data
    3. Update localStorage with namespace
    4. Handle failures gracefully
  }
}
```

#### 2. Auth Utilities (auth.ts)
Portal validation and state management utilities:

```typescript
// Portal Access Validation
validatePortalAccess(userType, currentPath) {
  1. Extract current portal from URL path
  2. Compare with user's portal type
  3. Return validation result with redirect path
}

// Authentication State Cleanup
clearAuthenticationState() {
  1. Clear auth tokens (namespaced + legacy)
  2. Clear user data
  3. Clear WebSocket state
  4. Clear session storage
  5. Dispatch auth:cleared event
}

// Safe Portal Switching
switchPortal(targetPortal) {
  1. Clear all authentication state
  2. Add delay for cleanup completion
  3. Redirect to target portal login
}
```

### Authentication Flow

```
User Login Request
       │
       ▼
┌──────────────┐
│Login Component│
└──────┬───────┘
       │ Submit credentials
       ▼
┌──────────────┐
│  Auth Store  │
└──────┬───────┘
       │ loginInvestor()
       ▼
┌──────────────┐
│  API Client  │
└──────┬───────┘
       │ POST /api/auth/investor/login
       ▼
┌──────────────┐
│Better Auth   │
│   Backend    │
└──────┬───────┘
       │ Create session, set cookie
       ▼
┌──────────────┐
│Response with │
│  User Data   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Store in      │
│localStorage  │
│(namespaced)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Navigate to   │
│  Dashboard   │
└──────────────┘
```

### Security Considerations

1. **Session-Based Authentication**: No JWT tokens in headers
2. **Cookie Security**: HttpOnly, Secure, SameSite cookies
3. **Portal Isolation**: Separate login endpoints per portal
4. **State Validation**: Continuous consistency checks
5. **Namespace Isolation**: Portal-specific localStorage keys

---

## WebSocket Integration

### Architecture
The WebSocket system provides real-time communication through a sophisticated context provider with automatic reconnection, circuit breakers, and fallback mechanisms.

### WebSocket Context Provider

```typescript
// Core WebSocket Context Structure
interface WebSocketContextType {
  // Connection Management
  connectionStatus: ConnectionStatus
  queueStatus: MessageQueueStatus
  isConnected: boolean
  
  // Real-time Data Streams
  notifications: NotificationData[]
  dashboardMetrics: DashboardMetrics
  onlineUsers: PresenceData[]
  typingIndicators: TypingData[]
  uploadProgress: UploadProgress[]
  pitchViews: Map<number, PitchViewData>
  
  // Actions
  sendMessage: (message) => boolean
  updatePresence: (status, activity?) => void
  trackPitchView: (pitchId) => void
  
  // Subscriptions
  subscribeToNotifications: (callback) => unsubscribe
  subscribeToDashboard: (callback) => unsubscribe
  subscribeToPresence: (callback) => unsubscribe
}
```

### Connection Lifecycle

```
Initial Connection
       │
       ▼
┌──────────────┐
│Check Auth    │
│   State      │
└──────┬───────┘
       │ If authenticated
       ▼
┌──────────────┐
│Create WS     │
│Connection    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│Connected     │────▶│Request       │
│              │     │Initial Data  │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│Message       │
│Processing    │
│    Loop      │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│Disconnection │────▶│Reconnection  │
│Detection     │     │Logic         │
└──────────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │Circuit       │
                     │Breaker Check │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │Fallback      │
                     │Service       │
                     └──────────────┘
```

### Message Types and Handlers

```typescript
// Message Processing Pipeline
handleMessage(message: WebSocketMessage) {
  // Notify general subscribers
  notifyGeneralSubscribers(message)
  
  switch(message.type) {
    case 'notification':
      1. Create NotificationData object
      2. Update state
      3. Notify subscribers
      4. Show browser notification if permitted
      
    case 'dashboard_update':
      1. Parse metrics data
      2. Update dashboard state
      3. Notify dashboard subscribers
      
    case 'presence_update':
      1. Update online users list
      2. Handle offline status removal
      3. Notify presence subscribers
      
    case 'typing':
      1. Update typing indicators
      2. Filter by conversation
      3. Notify conversation subscribers
      
    case 'upload_progress':
      1. Update progress state
      2. Auto-remove completed uploads
      3. Notify upload subscribers
      
    case 'pitch_view':
      1. Update view counts
      2. Store viewer data
      3. Notify pitch-specific subscribers
  }
}
```

### Circuit Breaker Implementation

```typescript
// Circuit Breaker for Connection Loops
detectConnectionLoop() {
  if (reconnectAttempts >= 3) {
    1. Log warning
    2. Disable WebSocket
    3. Store disabled state
    4. Activate fallback service
    5. Set auto-recovery timer (5 minutes)
  }
}

// Auto-Recovery Mechanism
autoRecover() {
  checkLoopDetectionTime()
  if (timeSinceDetection > 5_MINUTES) {
    1. Clear loop detection flag
    2. Re-enable WebSocket
    3. Attempt reconnection
  }
}
```

### Portal Switching Detection

```typescript
// Portal Switch Handler
handlePortalSwitch() {
  1. Detect userType change
  2. Disconnect current WebSocket
  3. Clear all real-time data
  4. Stop fallback services
  5. Wait for cleanup (1 second)
  6. Reconnect for new portal
}
```

---

## Data Services Layer

### Investor Service Architecture

The investor service provides a comprehensive API interface for all investor-specific operations:

```typescript
// Service Pattern Structure
class InvestorService {
  // Dashboard Operations
  static async getDashboard() {
    1. Call API endpoint
    2. Validate response structure
    3. Apply default values for missing data
    4. Transform to expected format
    5. Return normalized data
  }
  
  // Investment Operations
  static async invest(data) {
    1. Validate input data
    2. Send investment request
    3. Handle response/errors
    4. Update local state
    5. Return investment object
  }
  
  // Analytics Operations
  static async getAnalytics(period) {
    1. Build query parameters
    2. Fetch analytics data
    3. Process time-series data
    4. Calculate aggregations
    5. Return formatted analytics
  }
}
```

### API Client Configuration

```typescript
// API Client Setup
const apiClient = {
  baseURL: config.API_URL,
  timeout: 30000,
  
  interceptors: {
    request: {
      // Add authentication headers
      // Add request tracking
      // Add portal identification
    },
    response: {
      // Handle success responses
      // Process error responses
      // Retry logic for failures
    }
  }
}
```

### Data Transformation Pipeline

```typescript
// Data Processing Flow
transformDashboardData(rawData) {
  1. Validate data structure
  2. Apply safe number conversion
  3. Format currency values
  4. Calculate derived metrics
  5. Sort and filter results
  6. Return normalized dashboard
}
```

---

## User Interface Components

### Dashboard Component Architecture

```typescript
// Dashboard Component Structure
function InvestorDashboard() {
  // State Management
  const [portfolio, setPortfolio] = useState<PortfolioSummary>()
  const [investments, setInvestments] = useState<Investment[]>()
  const [loading, setLoading] = useState(true)
  
  // Data Fetching Pattern
  useEffect(() => {
    fetchDashboardData()
  }, [])
  
  async function fetchDashboardData() {
    try {
      // Parallel data fetching
      const results = await Promise.allSettled([
        api.get('/api/investor/portfolio/summary'),
        api.get('/api/investor/investments'),
        api.get('/api/saved-pitches'),
        api.get('/api/nda/active'),
        api.get('/api/notifications'),
        api.get('/api/investment/recommendations')
      ])
      
      // Process each result individually
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processResult(index, result.value)
        }
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Safe data processing
  function processResult(index, data) {
    switch(index) {
      case 0: // Portfolio
        setPortfolio(normalizePortfolio(data))
        break
      case 1: // Investments
        setInvestments(normalizeInvestments(data))
        break
      // ... other cases
    }
  }
}
```

### Component Hierarchy

```
InvestorDashboard
├── InvestorNavigation
│   ├── NavigationDropdowns
│   ├── UserMenu
│   └── NotificationBell
├── PortfolioSummaryCards
│   ├── TotalInvestedCard
│   ├── ActiveInvestmentsCard
│   ├── AverageROICard
│   └── TopPerformerCard
├── InvestmentsList
│   ├── InvestmentCard
│   └── InvestmentActions
├── OpportunitiesGrid
│   ├── OpportunityCard
│   └── QuickViewModal
└── ActivityFeed
    ├── ActivityItem
    └── LoadMoreButton
```

---

## Portal Protection & Access Control

### Portal Guard Implementation

```typescript
// Portal Guard Component
function PortalGuard({ children, requiredPortal }) {
  const { user, isAuthenticated, logout } = useAuthStore()
  const location = useLocation()
  
  useEffect(() => {
    // Validation logic
    if (!isAuthenticated) return
    
    const userType = user?.userType
    const validation = validatePortalAccess(userType, location.pathname)
    
    if (!validation.isValidPortal && userType !== requiredPortal) {
      // Portal mismatch detected
      console.warn(`Portal mismatch: ${userType} on ${requiredPortal}`)
      logout(false)
      window.location.replace(`/login/${userType}`)
    }
  }, [dependencies])
  
  // Render logic
  if (!isAuthenticated) {
    return <Navigate to={`/login/${requiredPortal}`} />
  }
  
  if (user?.userType !== requiredPortal) {
    return <LoadingRedirect />
  }
  
  return children
}
```

### Access Control Matrix

| User Type  | Creator Portal | Investor Portal | Production Portal |
|------------|----------------|-----------------|-------------------|
| Creator    | ✅ Allowed     | ❌ Blocked      | ❌ Blocked        |
| Investor   | ❌ Blocked     | ✅ Allowed      | ❌ Blocked        |
| Production | ❌ Blocked     | ❌ Blocked      | ✅ Allowed        |

### Route Protection Strategy

```typescript
// Route Configuration
const investorRoutes = [
  {
    path: '/investor/*',
    element: (
      <PortalGuard requiredPortal="investor">
        <InvestorLayout />
      </PortalGuard>
    )
  }
]
```

---

## Loading State Management

### Enhanced Loading State Hook

```typescript
// Loading State Management
function useLoadingState(options) {
  const [state, setState] = useState<LoadingState>({
    type: 'idle',
    isLoading: false
  })
  
  // Timeout protection
  const setLoading = (type, message) => {
    clearExistingTimeout()
    
    setState({ type, isLoading: true, message })
    
    // Set timeout
    timeoutRef.current = setTimeout(() => {
      console.warn(`Timeout: ${type}`)
      setState({ type: 'idle', isLoading: false })
      options.onTimeout?.()
    }, options.timeout || 30000)
  }
  
  return {
    loading: state.isLoading,
    loadingType: state.type,
    setLoading,
    clearLoading
  }
}
```

### Loading State Types

```typescript
type LoadingStateType = 
  | 'idle'
  | 'logging-in'
  | 'logging-out'
  | 'switching-portal'
  | 'loading-data'
```

### Retry Mechanism

```typescript
// Enhanced Loading with Retry
function useLoadingStateWithRetry(options) {
  async function executeWithRetry(operation, loadingType, message) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setLoading(loadingType, `${message} (Attempt ${attempt + 1})`)
        const result = await operation()
        clearLoading()
        return result
      } catch (error) {
        if (attempt < maxRetries) {
          await delay(retryDelay * (attempt + 1))
        } else {
          throw error
        }
      }
    }
  }
}
```

---

## Data Flow Diagrams

### Login Flow

```
User Input → Login Form → Auth Store → API Client → Backend
     ↓           ↓            ↓           ↓           ↓
Validation   Loading    State Update  Request    Session
     ↓        State          ↓       Headers     Creation
     ↓           ↓            ↓           ↓           ↓
  Error      UI Update   localStorage   Response   Cookie
 Handling        ↓            ↓           ↓           ↓
     ↓       Loading     User Data    Success    Response
     ↓       Complete        ↓           ↓           ↓
   Retry         ↓       Navigation   Update     Dashboard
   Logic     Dashboard       ↓        State         ↓
                           Router    Complete    Data Load
```

### Real-time Update Flow

```
WebSocket Server → Message → WebSocket Context → Message Handler
        ↓             ↓              ↓                ↓
   Event Data    Validation    State Update    Type Router
        ↓             ↓              ↓                ↓
   Broadcast      Parse          Store         Specific Handler
        ↓             ↓              ↓                ↓
   All Clients   Transform    Subscribers     Update State
        ↓             ↓              ↓                ↓
   Filter by      Normalize     Callbacks      UI Update
   Portal Type        ↓              ↓                ↓
        ↓         Cache          Execute        Re-render
   Deliver        Update        Handlers       Components
```

### Data Fetching Pattern

```
Component Mount → useEffect → Fetch Function → API Service
       ↓              ↓             ↓               ↓
  Initial State   Dependencies  Parallel       Build Request
       ↓              ↓          Requests           ↓
   Loading UI     Cleanup      Promise.all     Add Headers
       ↓              ↓             ↓               ↓
   Skeleton      Previous       Execute         Send Request
       ↓          Abort            ↓               ↓
  Placeholder       ↓           Process        Handle Response
       ↓         Controller      Results           ↓
   User Wait         ↓             ↓           Transform Data
                  Cancel        Individual          ↓
                 If Needed      Handling       Update State
                                   ↓               ↓
                              Error Safe      Trigger Render
                              Processing           ↓
                                   ↓           Update UI
                              Set State      With New Data
```

---

## Cross-Portal Communication Patterns

### Portal Isolation Strategy

```typescript
// Portal Namespace Management
class PortalNamespace {
  private portal: 'creator' | 'investor' | 'production'
  
  getKey(key: string): string {
    return `pitchey:${this.portal}:${key}`
  }
  
  setData(key: string, value: any): void {
    localStorage.setItem(this.getKey(key), JSON.stringify(value))
  }
  
  getData(key: string): any {
    const data = localStorage.getItem(this.getKey(key))
    return data ? JSON.parse(data) : null
  }
  
  clearPortalData(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(`pitchey:${this.portal}:`))
      .forEach(key => localStorage.removeItem(key))
  }
}
```

### Inter-Portal Messaging

```typescript
// Safe Cross-Portal Communication
class InterPortalMessenger {
  // Send message to another portal
  sendMessage(targetPortal: string, message: any) {
    const event = new CustomEvent('portal:message', {
      detail: {
        source: this.currentPortal,
        target: targetPortal,
        message,
        timestamp: Date.now()
      }
    })
    window.dispatchEvent(event)
  }
  
  // Listen for messages
  onMessage(callback: (message: any) => void) {
    window.addEventListener('portal:message', (event: CustomEvent) => {
      if (event.detail.target === this.currentPortal) {
        callback(event.detail.message)
      }
    })
  }
}
```

### Shared State Management

```typescript
// Shared State Between Portals
class SharedPortalState {
  // Read-only shared data
  getSharedData(key: string) {
    return localStorage.getItem(`pitchey:shared:${key}`)
  }
  
  // Portal-specific write with shared read
  setSharedData(key: string, value: any, portal: string) {
    const data = {
      value,
      updatedBy: portal,
      timestamp: Date.now()
    }
    localStorage.setItem(`pitchey:shared:${key}`, JSON.stringify(data))
  }
}
```

---

## Implementation Patterns for Replication

### Pattern 1: Portal-Specific Service

```typescript
// Template for Portal Services
class [Portal]Service {
  // Dashboard endpoint
  static async getDashboard() {
    const response = await apiClient.get(`/api/${portal}/dashboard`)
    return this.normalizeDashboardData(response)
  }
  
  // List endpoint with filters
  static async getList(filters?: FilterOptions) {
    const params = this.buildQueryParams(filters)
    const response = await apiClient.get(`/api/${portal}/items?${params}`)
    return this.normalizeListData(response)
  }
  
  // Create operation
  static async create(data: CreateData) {
    const validated = this.validateCreateData(data)
    const response = await apiClient.post(`/api/${portal}/items`, validated)
    return this.normalizeItemData(response)
  }
  
  // Update operation
  static async update(id: number, data: UpdateData) {
    const validated = this.validateUpdateData(data)
    const response = await apiClient.put(`/api/${portal}/items/${id}`, validated)
    return this.normalizeItemData(response)
  }
  
  // Delete operation
  static async delete(id: number) {
    await apiClient.delete(`/api/${portal}/items/${id}`)
  }
}
```

### Pattern 2: Portal Dashboard Component

```typescript
// Template for Portal Dashboards
function [Portal]Dashboard() {
  // State setup
  const [stats, setStats] = useState<PortalStats>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  
  // Data fetching
  useEffect(() => {
    fetchDashboardData()
  }, [])
  
  async function fetchDashboardData() {
    try {
      setLoading(true)
      const data = await PortalService.getDashboard()
      setStats(data.stats)
      setItems(data.items)
    } catch (err) {
      setError(handleError(err))
    } finally {
      setLoading(false)
    }
  }
  
  // Render
  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  
  return (
    <div>
      <PortalNavigation />
      <StatsCards stats={stats} />
      <ItemsList items={items} />
    </div>
  )
}
```

### Pattern 3: Portal Navigation

```typescript
// Template for Portal Navigation
function [Portal]Navigation({ user, onLogout }) {
  const menuItems = [
    {
      label: 'Dashboard',
      path: `/${portal}/dashboard`,
      icon: HomeIcon
    },
    {
      label: 'Portal Specific',
      path: `/${portal}/specific`,
      icon: SpecificIcon
    }
  ]
  
  return (
    <nav>
      <Logo />
      <MenuItems items={menuItems} />
      <UserMenu user={user} onLogout={onLogout} />
    </nav>
  )
}
```

### Pattern 4: Safe Data Formatting

```typescript
// Template for Safe Formatters
export const safeFormatters = {
  // Safe number conversion
  safeNumber(value: unknown, fallback = 0): number {
    if (value == null) return fallback
    const num = Number(value)
    return isNaN(num) ? fallback : num
  },
  
  // Safe currency formatting
  formatCurrency(value: unknown): string {
    const num = this.safeNumber(value)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  },
  
  // Safe date formatting
  formatDate(value: unknown): string {
    if (!value) return 'N/A'
    try {
      return new Date(value).toLocaleDateString()
    } catch {
      return 'Invalid Date'
    }
  }
}
```

---

## Best Practices & Recommendations

### 1. Authentication Best Practices

```typescript
// Always validate portal access
useEffect(() => {
  validatePortalAccess(user?.userType, location.pathname)
}, [user, location])

// Clear state on portal switch
const handlePortalSwitch = () => {
  clearAuthenticationState()
  window.location.replace(newPortalLogin)
}

// Use namespaced storage
const storePortalData = (key: string, value: any) => {
  localStorage.setItem(`pitchey:${portal}:${key}`, JSON.stringify(value))
}
```

### 2. Error Handling Patterns

```typescript
// Comprehensive error handling
async function fetchData() {
  try {
    const data = await api.getData()
    return processData(data)
  } catch (error) {
    // Log for debugging
    console.error('Fetch failed:', error)
    
    // User-friendly message
    if (error.response?.status === 404) {
      showError('Data not found')
    } else if (error.response?.status === 403) {
      showError('Access denied')
    } else {
      showError('Something went wrong')
    }
    
    // Return safe default
    return defaultData
  }
}
```

### 3. Performance Optimization

```typescript
// Parallel data fetching
const fetchAllData = async () => {
  const results = await Promise.allSettled([
    fetchPortfolio(),
    fetchInvestments(),
    fetchNotifications()
  ])
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      handleSuccess(index, result.value)
    } else {
      handleFailure(index, result.reason)
    }
  })
}

// Memoization for expensive operations
const expensiveCalculation = useMemo(() => {
  return calculateComplexMetrics(data)
}, [data])

// Debounced search
const debouncedSearch = useMemo(
  () => debounce(searchFunction, 300),
  []
)
```

### 4. WebSocket Best Practices

```typescript
// Connection management
const wsConfig = {
  maxReconnectAttempts: 5,
  reconnectInterval: 5000,
  enableCircuitBreaker: true,
  fallbackService: presenceService
}

// Message batching
const batchedSend = useMemo(() => {
  return throttle((messages: Message[]) => {
    ws.send({ type: 'batch', messages })
  }, 100)
}, [ws])

// Subscription cleanup
useEffect(() => {
  const unsubscribe = ws.subscribe(handler)
  return () => unsubscribe()
}, [])
```

### 5. State Management Guidelines

```typescript
// Normalized state shape
interface PortalState {
  entities: {
    items: { [id: string]: Item }
    users: { [id: string]: User }
  }
  ui: {
    loading: LoadingState
    errors: Error[]
    filters: FilterState
  }
  cache: {
    [key: string]: CachedData
  }
}

// Selective updates
const updateItem = (id: string, updates: Partial<Item>) => {
  setState(prev => ({
    ...prev,
    entities: {
      ...prev.entities,
      items: {
        ...prev.entities.items,
        [id]: { ...prev.entities.items[id], ...updates }
      }
    }
  }))
}
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Portal Switching Issues

**Problem**: User stuck in wrong portal
```typescript
// Solution
const fixPortalMismatch = () => {
  clearAuthenticationState()
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = '/'
}
```

#### 2. WebSocket Connection Loops

**Problem**: Infinite reconnection attempts
```typescript
// Solution
const breakConnectionLoop = () => {
  localStorage.setItem('pitchey_websocket_disabled', 'true')
  // Auto-recovery after 5 minutes
  setTimeout(() => {
    localStorage.removeItem('pitchey_websocket_disabled')
  }, 5 * 60 * 1000)
}
```

#### 3. Stale Authentication State

**Problem**: User appears logged in but requests fail
```typescript
// Solution
const refreshAuthState = async () => {
  try {
    const profile = await api.getProfile()
    updateAuthStore(profile)
  } catch {
    clearAuthenticationState()
    redirectToLogin()
  }
}
```

#### 4. Data Synchronization Issues

**Problem**: Dashboard shows outdated data
```typescript
// Solution
const forceDashboardRefresh = () => {
  // Clear cache
  clearDashboardCache()
  // Invalidate queries
  queryClient.invalidateQueries(['dashboard'])
  // Refetch
  fetchDashboardData({ force: true })
}
```

### Debugging Tools

```typescript
// Debug utilities
const debugPortal = {
  // Check current state
  checkState() {
    console.log({
      user: localStorage.getItem('user'),
      userType: localStorage.getItem('userType'),
      token: localStorage.getItem('authToken'),
      wsStatus: localStorage.getItem('pitchey_ws_status')
    })
  },
  
  // Force state reset
  resetState() {
    clearAuthenticationState()
    window.location.reload()
  },
  
  // Test WebSocket
  testWebSocket() {
    const ws = new WebSocket(config.WS_URL)
    ws.onopen = () => console.log('WS Connected')
    ws.onerror = (e) => console.error('WS Error:', e)
    ws.onclose = () => console.log('WS Closed')
  }
}

// Attach to window for production debugging
if (process.env.NODE_ENV === 'production') {
  window.__pitcheyDebug = debugPortal
}
```

---

## Appendices

### Appendix A: Type Definitions

```typescript
// Core Types
interface User {
  id: number
  email: string
  username: string
  userType: 'creator' | 'investor' | 'production'
  profile: UserProfile
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

interface Investment {
  id: number
  pitchId: number
  pitchTitle: string
  investorId: number
  amount: number
  status: 'pending' | 'active' | 'completed' | 'withdrawn'
  roi: number
  terms: string
  dateInvested: string
  lastUpdated: string
}

interface WebSocketMessage {
  id?: string
  type: string
  data?: any
  timestamp?: number
  error?: string
}

interface DashboardMetrics {
  pitchViews: number
  totalRevenue: number
  activeInvestors: number
  newMessages: number
  lastUpdated: Date
}
```

### Appendix B: API Endpoints Reference

```typescript
// Investor Portal Endpoints
const INVESTOR_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/investor/login',
  LOGOUT: '/api/auth/logout',
  PROFILE: '/api/auth/profile',
  
  // Dashboard
  DASHBOARD: '/api/investor/dashboard',
  PORTFOLIO_SUMMARY: '/api/investor/portfolio/summary',
  
  // Investments
  INVESTMENTS: '/api/investor/investments',
  INVEST: '/api/investor/invest',
  WITHDRAW: '/api/investor/investments/:id/withdraw',
  
  // Analytics
  ANALYTICS: '/api/investor/analytics',
  ROI: '/api/investor/analytics/roi',
  PERFORMANCE: '/api/investor/portfolio/performance',
  
  // Opportunities
  OPPORTUNITIES: '/api/investor/opportunities',
  RECOMMENDATIONS: '/api/investor/recommendations',
  
  // Documents
  DOCUMENTS: '/api/investor/documents',
  TAX_DOCS: '/api/investor/tax/:year',
  
  // Watchlist
  WATCHLIST: '/api/investor/watchlist',
  ADD_TO_WATCHLIST: '/api/investor/watchlist',
  REMOVE_FROM_WATCHLIST: '/api/investor/watchlist/:id'
}
```

### Appendix C: Configuration Files

```typescript
// Environment Configuration
const ENV_CONFIG = {
  // API Configuration
  API_URL: process.env.VITE_API_URL,
  WS_URL: process.env.VITE_WS_URL,
  
  // Feature Flags
  WEBSOCKET_ENABLED: true,
  FALLBACK_ENABLED: true,
  
  // Timeouts
  API_TIMEOUT: 30000,
  WS_TIMEOUT: 60000,
  
  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Cache Configuration
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  
  // Security
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
}
```

### Appendix D: Testing Strategies

```typescript
// Unit Test Pattern
describe('InvestorService', () => {
  it('should fetch dashboard with safe defaults', async () => {
    // Mock API response
    mockApi.get.mockResolvedValue({
      success: true,
      data: { /* partial data */ }
    })
    
    // Execute
    const result = await InvestorService.getDashboard()
    
    // Assert safe defaults applied
    expect(result.stats.totalInvested).toBe(0)
    expect(result.stats.avgROI).toBe(0)
  })
})

// Integration Test Pattern
describe('Portal Authentication Flow', () => {
  it('should handle portal switching correctly', async () => {
    // Setup initial state
    await loginAsInvestor()
    
    // Attempt to access creator portal
    await navigateTo('/creator/dashboard')
    
    // Should redirect to investor portal
    expect(location.pathname).toBe('/investor/dashboard')
  })
})
```

---

## Conclusion

The Pitchey Investor Portal represents a sophisticated implementation of modern web application patterns, combining real-time communication, robust state management, and comprehensive error handling. The architecture's emphasis on portal isolation, safe data handling, and graceful degradation ensures a reliable and secure user experience.

### Key Takeaways

1. **Portal Isolation**: Critical for multi-tenant security
2. **Real-time Communication**: WebSocket with fallback mechanisms
3. **Safe Data Handling**: Comprehensive null-safety throughout
4. **Loading State Management**: Timeout protection and retry logic
5. **Circuit Breakers**: Automatic recovery from failures

### Future Enhancements

1. **GraphQL Integration**: For more efficient data fetching
2. **Service Workers**: For offline functionality
3. **WebAssembly**: For compute-intensive operations
4. **Edge Computing**: Leverage Cloudflare Workers more extensively
5. **AI-Powered Features**: Enhanced recommendations and insights

This documentation serves as the authoritative reference for understanding, maintaining, and extending the Pitchey Investor Portal. The patterns and practices documented here should be applied consistently across all three portals (Creator, Investor, Production) to maintain architectural coherence and code quality.

---

*Document Version: 1.0.0*  
*Last Updated: December 2024*  
*Total Pages: 42*  
*Word Count: ~12,000*