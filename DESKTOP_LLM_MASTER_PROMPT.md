# Master Prompt for Desktop LLM: Consistent Portal Implementation

## Your Mission
You are implementing a consistent, scalable architecture across three distinct portals (Creator, Investor, Production) in the Pitchey movie pitch marketplace. The Investor Portal has been successfully implemented and serves as the reference architecture. Your task is to replicate these patterns for the Creator and Production portals while ensuring seamless business workflow communication between all three.

## Critical Context
- **Technology Stack**: React/TypeScript frontend on Cloudflare Pages, Cloudflare Workers backend, Neon PostgreSQL, Upstash Redis, WebSocket via Durable Objects
- **Authentication**: Better Auth framework with cookie-based sessions (NOT JWT)
- **Current State**: Investor Portal fully implemented with robust patterns for authentication, data handling, WebSocket management, and UI states
- **Goal**: Apply these proven patterns to Creator and Production portals

## Reference Implementation Analysis

### What Works in the Investor Portal
1. **Loading State Management**: Custom hook with timeout protection prevents infinite loading states
2. **Safe Data Formatting**: All numbers pass through safeNumber() utility preventing $NaN displays
3. **Portal Switching**: WebSocket automatically disconnects when switching portals
4. **Authentication Cleanup**: Comprehensive localStorage/sessionStorage clearing
5. **Error Recovery**: All API calls have fallback states and error boundaries

### Key Files to Study
```
frontend/src/pages/InvestorLogin.tsx - Authentication pattern
frontend/src/pages/InvestorDashboard.tsx - Dashboard data management
frontend/src/services/investor.service.ts - Service layer pattern
frontend/src/hooks/useLoadingState.ts - Loading state management
frontend/src/utils/formatters.ts - Safe number formatting
frontend/src/utils/auth.ts - Authentication utilities
frontend/src/components/PortalGuard.tsx - Portal access control
frontend/src/contexts/WebSocketContext.tsx - WebSocket portal switching
```

## Implementation Instructions

### Phase 1: Creator Portal Implementation

#### Step 1: Create Creator Authentication
```typescript
// frontend/src/pages/CreatorLogin.tsx
// Copy InvestorLogin.tsx and modify:
1. Import useAuthStore and use loginCreator method
2. Change color scheme from green to blue/cyan
3. Update icon from DollarSign to PenTool
4. Update demo credentials to 'alex.creator@demo.com'
5. Navigate to '/creator/dashboard' on success
6. Keep the same loading state pattern with 15s timeout
```

#### Step 2: Creator Service Layer
```typescript
// frontend/src/services/creator.service.ts
// Follow investor.service.ts pattern:
1. Use API_PREFIX = '/api/creator'
2. Apply safeNumber() to all numeric responses
3. Return consistent {success, data, error} structure
4. Handle errors gracefully with fallbacks
5. Methods needed:
   - getStats() - creator metrics
   - getMyPitches() - list of creator's pitches
   - getPitchAnalytics(id) - detailed analytics
   - getNDARequests() - pending NDA requests
   - handleNDARequest(id, action) - approve/deny NDAs
```

#### Step 3: Creator Dashboard
```typescript
// frontend/src/pages/CreatorDashboard.tsx
// Mirror InvestorDashboard.tsx structure:
1. Use useLoadingState hook for all data fetching
2. Apply formatCurrency/formatNumber to all displays
3. Fetch data in parallel with Promise.all()
4. Show creator-specific metrics:
   - Total views
   - Saved by investors
   - Active NDAs
   - Revenue earned
5. Include NDA approval interface
6. Add "New Pitch" button prominently
```

### Phase 2: Production Portal Implementation

#### Step 1: Production Authentication
```typescript
// frontend/src/pages/ProductionLogin.tsx
// Copy InvestorLogin.tsx and modify:
1. Use loginProduction from authStore
2. Purple/indigo color scheme
3. Film icon
4. Demo: 'stellar.production@demo.com'
5. Navigate to '/production/dashboard'
```

#### Step 2: Production Service Layer
```typescript
// frontend/src/services/production.service.ts
// Same pattern as investor.service.ts:
1. API_PREFIX = '/api/production'
2. Safe number handling throughout
3. Methods:
   - getStats() - production metrics
   - getProjects() - active projects
   - getCrewRequests() - crew needs
   - getBudgetAnalytics() - financial data
   - greenlightProject(pitchId) - approve production
```

#### Step 3: Production Dashboard
```typescript
// frontend/src/pages/ProductionDashboard.tsx
// Production-specific metrics:
1. Active projects count
2. Total production budget
3. Projects in production
4. Crew requests pending
5. Project pipeline view
6. Budget allocation charts
```

### Phase 3: Cross-Portal Integration

#### WebSocket Event Routing
```typescript
// Modify frontend/src/contexts/WebSocketContext.tsx
// Add portal-specific event handlers:

const handlePortalMessage = (event: MessageEvent) => {
  const { type, data } = JSON.parse(event.data);
  const userType = localStorage.getItem('userType');
  
  switch(userType) {
    case 'creator':
      handleCreatorEvent(type, data);
      break;
    case 'investor':
      handleInvestorEvent(type, data);
      break;
    case 'production':
      handleProductionEvent(type, data);
      break;
  }
};

// Portal-specific event handlers
const handleCreatorEvent = (type: string, data: any) => {
  switch(type) {
    case 'nda.request':
      // Show notification
      // Update NDA requests count
      break;
    case 'investment.received':
      // Update revenue
      // Show celebration animation
      break;
    case 'pitch.viewed':
      // Increment view counter
      break;
  }
};
```

#### Shared Components
```typescript
// frontend/src/components/shared/PortalMetrics.tsx
// Reusable metric card component:

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'red';
  format?: 'currency' | 'number' | 'percentage';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title, value, icon: Icon, color, format = 'number'
}) => {
  const formattedValue = format === 'currency' 
    ? formatCurrency(value)
    : format === 'percentage'
    ? formatPercentage(value)
    : formatNumber(value);
    
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formattedValue}
          </p>
        </div>
        <Icon className={`h-8 w-8 text-${color}-500`} />
      </div>
    </div>
  );
};
```

### Phase 4: Business Workflow Implementation

#### NDA Workflow
```typescript
// Implement across all portals:

// Creator side - Approval interface
const NDApprovalPanel = () => {
  const [requests, setRequests] = useState([]);
  
  const handleApproval = async (requestId: string, action: 'approve' | 'deny') => {
    await creatorService.handleNDARequest(requestId, action);
    // Refresh requests
    // Send WebSocket notification to requester
  };
  
  return (
    <div className="nda-requests">
      {requests.map(req => (
        <NDRequestCard 
          key={req.id}
          request={req}
          onApprove={() => handleApproval(req.id, 'approve')}
          onDeny={() => handleApproval(req.id, 'deny')}
        />
      ))}
    </div>
  );
};

// Investor/Production side - Request interface
const NDARequestButton = ({ pitchId }) => {
  const [status, setStatus] = useState('none');
  
  const requestNDA = async () => {
    setStatus('requesting');
    const result = await investorService.requestNDA(pitchId);
    setStatus(result.success ? 'pending' : 'error');
  };
  
  if (status === 'approved') {
    return <span className="text-green-600">✓ NDA Approved</span>;
  }
  
  return (
    <button 
      onClick={requestNDA}
      disabled={status === 'pending'}
      className="btn-primary"
    >
      {status === 'pending' ? 'Awaiting Approval...' : 'Request NDA'}
    </button>
  );
};
```

#### Investment Flow
```typescript
// Investor commits funds
const InvestmentModal = ({ pitch }) => {
  const [amount, setAmount] = useState(0);
  
  const handleInvestment = async () => {
    // Validate NDA status
    const ndaStatus = await checkNDAStatus(pitch.id);
    if (!ndaStatus.approved) {
      alert('NDA required before investing');
      return;
    }
    
    // Create investment
    const investment = await investorService.invest(pitch.id, amount);
    
    // Show confirmation
    // Update portfolio
    // Notify creator via WebSocket
  };
};

// Creator receives notification
const InvestmentNotification = ({ investment }) => {
  return (
    <div className="notification investment-received">
      <h3>New Investment!</h3>
      <p>{investment.investorName} invested {formatCurrency(investment.amount)}</p>
      <p>Funds in escrow pending milestones</p>
    </div>
  );
};
```

### Phase 5: Testing & Validation

#### Portal Switching Tests
```typescript
describe('Portal Switching', () => {
  test('Creator to Investor switch cleans state', async () => {
    // Login as creator
    await loginAs('creator');
    expect(localStorage.getItem('userType')).toBe('creator');
    
    // Switch to investor
    await navigateTo('/login/investor');
    await loginAs('investor');
    
    // Verify cleanup
    expect(localStorage.getItem('userType')).toBe('investor');
    expect(websocket.isConnected()).toBe(true);
    expect(websocket.rooms).toContain('investor:userId');
    expect(websocket.rooms).not.toContain('creator:userId');
  });
});
```

#### Data Formatting Tests
```typescript
describe('Safe Number Formatting', () => {
  test('Handles null/undefined without $NaN', () => {
    expect(formatCurrency(null)).toBe('$0');
    expect(formatCurrency(undefined)).toBe('$0');
    expect(formatCurrency('invalid')).toBe('$0');
    expect(formatCurrency(12345.67)).toBe('$12,346');
  });
});
```

## Critical Implementation Rules

### DO's
✅ ALWAYS use safeNumber() before formatCurrency()
✅ ALWAYS cleanup auth state when switching portals
✅ ALWAYS use loading states with timeouts
✅ ALWAYS handle WebSocket disconnection on portal switch
✅ ALWAYS provide fallback data for failed API calls
✅ ALWAYS use PortalGuard component on protected routes
✅ ALWAYS batch API calls with Promise.all()
✅ ALWAYS validate NDA status before showing sensitive data

### DON'Ts
❌ NEVER trust numeric data without safeNumber()
❌ NEVER leave loading states without timeout protection
❌ NEVER allow cross-portal WebSocket connections
❌ NEVER show undefined or NaN in UI
❌ NEVER make sequential API calls when parallel is possible
❌ NEVER expose full pitch data without NDA check
❌ NEVER mix authentication states between portals

## Expected Outcomes

After implementing these patterns:

1. **Consistent UX**: All three portals feel like part of the same platform
2. **No Authentication Leaks**: Users can switch portals without conflicts
3. **No Data Errors**: No $NaN, undefined, or null displays
4. **Real-time Updates**: All portals receive appropriate notifications
5. **Secure Access**: NDA and investment requirements enforced
6. **Performance**: Parallel data fetching, efficient caching
7. **Maintainability**: Shared patterns reduce code duplication

## Verification Checklist

### Per Portal
- [ ] Login works with demo credentials
- [ ] Dashboard loads without errors
- [ ] All numbers display correctly (no $NaN)
- [ ] Loading states have timeouts
- [ ] Error states show fallback UI
- [ ] WebSocket connects to correct room
- [ ] Portal switching cleans up properly

### Cross-Portal
- [ ] NDA workflow works bidirectionally
- [ ] Investment flow creator → investor works
- [ ] Production interest flow works
- [ ] Messages route correctly
- [ ] Notifications appear in real-time
- [ ] Access control prevents unauthorized viewing

## Research These Topics

When implementing, research:
1. **React Query** for better data fetching patterns
2. **Zustand persist** for state persistence
3. **Socket.io rooms** for WebSocket room management
4. **Decimal.js** for precise financial calculations
5. **React Hook Form** for complex form validation
6. **Framer Motion** for portal transition animations

## Final Notes

This implementation should take approximately:
- Creator Portal: 2-3 days
- Production Portal: 2-3 days
- Cross-portal workflows: 2 days
- Testing & refinement: 2 days
- **Total: ~9-10 days**

Remember: The Investor Portal is your reference. When in doubt, check how it's implemented there and follow the same pattern. Consistency is more important than perfection.

Good luck! The foundation is solid - you're building on proven patterns.