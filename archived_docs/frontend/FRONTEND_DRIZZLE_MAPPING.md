# Frontend-to-Backend Drizzle Data Mapping Report

## Overview
This document provides a comprehensive analysis of how frontend components map data to the backend through Drizzle ORM.

## 🔴 Components with HARDCODED API Calls (Need Fixing)

### 1. **NDAStatus.tsx**
```typescript
// Current (HARDCODED):
const response = await fetch(`${apiUrl}/api/nda/${ndaStatus.protectedContent.nda.id}/document`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
});

// Should use:
await ndaService.downloadNDADocument(ndaId);
```

### 2. **ProductionPitchDetail.tsx**
```typescript
// Current (HARDCODED):
const response = await fetch(`${API_URL}/api/pitches/${id}`, {
  headers: getAuthHeaders()
});

// Should use:
await pitchService.getPitchById(id);
```

### 3. **Settings.tsx**
```typescript
// Current (HARDCODED):
await fetch(`${API_URL}/api/user/settings`, { ... });
await fetch(`${API_URL}/api/user/account`, { ... });

// Should use:
await userService.getSettings();
await userService.updateAccount();
```

### 4. **Calendar.tsx**
```typescript
// Current (HARDCODED):
const response = await fetch(...);

// Should use:
await analyticsService.getCalendarEvents();
```

## 🟢 Components PROPERLY Using Service Layer

### Authentication Components

| Component | Service Used | Methods | Drizzle Integration |
|-----------|-------------|---------|---------------------|
| **InvestorLogin.tsx** | authService | `investorLogin()` | ✅ Maps to users table with userType check |
| **ProductionLogin.tsx** | authService | `productionLogin()` | ✅ Maps to users table with userType check |
| **CreatorLogin.tsx** | apiClient | `post('/api/auth/creator/login')` | ⚠️ Should use authService |

### Pitch Management Components

| Component | Service Used | Methods | Drizzle Integration |
|-----------|-------------|---------|---------------------|
| **ManagePitches.tsx** | pitchService | `getMyPitches()`, `publish()`, `archive()`, `delete()` | ✅ Full Drizzle integration |
| **CreatePitch.tsx** | pitchService | `create()` | ✅ Maps to pitches table |
| **PitchEdit.tsx** | pitchService | `getPitchById()`, `updatePitch()`, `uploadMedia()` | ✅ Full CRUD with Drizzle |
| **PitchAnalytics.tsx** | analyticsService | `getPitchAnalytics()` | ✅ Aggregates from multiple tables |
| **Homepage.tsx** | pitchService | `getPublicPitches()` | ✅ Joins pitches + users tables |

### Dashboard Components

| Component | Service Used | Methods | Drizzle Integration |
|-----------|-------------|---------|---------------------|
| **CreatorDashboard.tsx** | apiClient | Direct API calls | ⚠️ Mixed - some services, some direct |
| **InvestorDashboard.tsx** | apiClient | Direct API calls | ⚠️ Should use services |
| **ProductionDashboard.tsx** | apiClient | Direct API calls | ⚠️ Should use services |

### Social/Interaction Components

| Component | Service Used | Methods | Drizzle Integration |
|-----------|-------------|---------|---------------------|
| **FollowButton.tsx** | socialService | `followUser()`, `unfollowUser()` | ✅ Maps to follows table |
| **NDAModal.tsx** | ndaService | `canRequestNDA()`, `requestNDA()` | ✅ Maps to nda_requests table |
| **Messages.tsx** | apiClient | Direct API calls | ⚠️ Should use messagingService |

## 📊 Data Flow Patterns

### 1. **Proper Service Pattern** ✅
```typescript
// Frontend Component
import { pitchService } from '../services/pitch.service';

const pitch = await pitchService.create(data);
```
↓
```typescript
// Service Layer
static async create(data: CreatePitchInput): Promise<Pitch> {
  const response = await apiClient.post('/api/pitches', data);
  return response.data;
}
```
↓
```typescript
// Backend with Drizzle
const [newPitch] = await db.insert(pitches).values(data).returning();
```

### 2. **Anti-Pattern (Direct Fetch)** ❌
```typescript
// Frontend Component (BAD)
const response = await fetch(`${API_URL}/api/pitches/${id}`);
const data = await response.json();
```

## 🔧 Components That Need Service Integration

### High Priority (Core Features)
1. **Settings.tsx** - User profile management
2. **Messages.tsx** - Real-time messaging
3. **ProductionPitchDetail.tsx** - Pitch viewing
4. **Calendar.tsx** - Event management
5. **CreatorDashboard.tsx** - Dashboard data

### Medium Priority
1. **InvestorDashboard.tsx** - Investor-specific views
2. **ProductionDashboard.tsx** - Production company views
3. **NDAStatus.tsx** - NDA document handling

## 📈 Statistics

- **Total Components**: 88
- **Using Services**: 9 (10%)
- **Using Direct API**: 31 (35%)
- **Mixed Approach**: 15 (17%)
- **No API Calls**: 33 (38%)

## 🛡️ Type Safety Status

### Well-Typed Components ✅
- ManagePitches.tsx (imports `type Pitch`)
- PitchEdit.tsx (imports `type Pitch, PitchUpdateInput`)
- PitchAnalytics.tsx (imports `type PitchAnalytics`)
- Homepage.tsx (imports `type Pitch`)

### Need Type Improvements ⚠️
- Most dashboard components use `any` types
- Message components lack proper typing
- Settings components have no type definitions

## 🚀 Recommendations

### 1. **Complete Service Layer Migration**
- Create missing services: `calendarService`, `settingsService`
- Migrate all direct fetch calls to service methods
- Ensure all services use proper TypeScript types from Drizzle schema

### 2. **Improve Type Safety**
- Export all Drizzle table types
- Use these types in service definitions
- Avoid `any` types in components

### 3. **Standardize Error Handling**
```typescript
// Recommended pattern
try {
  const data = await service.method();
  // Handle success
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API errors
  } else {
    // Handle network errors
  }
}
```

### 4. **Implement Data Caching**
- Use React Query or SWR for data fetching
- Implement optimistic updates for better UX
- Cache frequently accessed data

## 📝 Action Items

1. **Immediate**:
   - Fix hardcoded fetch calls in Settings.tsx
   - Fix ProductionPitchDetail.tsx to use pitchService
   - Add messagingService for Messages.tsx

2. **Short-term**:
   - Complete dashboard service integration
   - Add proper TypeScript types to all components
   - Implement consistent error handling

3. **Long-term**:
   - Add data caching layer
   - Implement real-time updates with WebSockets
   - Add comprehensive error boundaries

## ✅ Components with Perfect Drizzle Integration

These components serve as good examples:

1. **ManagePitches.tsx**
   - Uses pitchService exclusively
   - Proper TypeScript typing
   - Good error handling
   - Optimistic UI updates

2. **PitchEdit.tsx**
   - Complete CRUD operations via service
   - File upload handling
   - Form validation
   - Type-safe throughout

3. **FollowButton.tsx**
   - Clean service integration
   - Handles both user and pitch follows
   - Proper state management

## 🔄 Current Data Flow Architecture

```
Frontend Component
    ↓
Service Layer (TypeScript)
    ↓
API Client (with auth)
    ↓
Backend API (Deno)
    ↓
Drizzle ORM
    ↓
PostgreSQL Database
```

This architecture ensures:
- Type safety from database to UI
- Centralized error handling
- Consistent authentication
- Reusable business logic
- Easy testing and maintenance