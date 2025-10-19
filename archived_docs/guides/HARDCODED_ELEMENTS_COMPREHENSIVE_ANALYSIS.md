# Pitchey Frontend - Comprehensive Hardcoded Elements Analysis

This document provides a complete analysis of all hardcoded elements in the Pitchey frontend codebase at `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/`.

## 1. HARDCODED TEXT STRINGS

### Authentication & Portal Labels
**File:** `/frontend/src/pages/PortalSelect.tsx` (Lines 30-42)
- "Creator Portal"
- "Investor Portal" 
- "Production Portal"
- "Submit and manage your movie pitches"
- "Discover and invest in promising projects"
- "Find and develop exciting content"

**File:** `/frontend/src/pages/CreatorLogin.tsx` (Lines 42-49)
- "Creator Portal"
- "Sign in to manage your pitches"

**File:** `/frontend/src/pages/InvestorLogin.tsx`
- "Investor Portal"
- "Sign in to discover projects"

**File:** `/frontend/src/pages/ProductionLogin.tsx`
- "Production Portal"
- "Sign in to find content"

### Button Text & Actions
**Throughout multiple components:**
- "Login", "Sign In", "Sign Up", "Register"
- "Create Pitch", "Edit Pitch", "Delete Pitch"
- "Upload", "Submit", "Save", "Cancel"
- "View Details", "Learn More"
- "Try Demo", "Get Started"

### Navigation & Menu Items
**File:** `/frontend/src/components/Layout.tsx`
- "Dashboard", "Create", "Manage", "Analytics"
- "Messages", "Calendar", "Profile", "Settings"
- "Marketplace", "Browse", "Following"

## 2. HARDCODED DEMO DATA

### Demo Credentials
**File:** `/frontend/src/pages/CreatorLogin.tsx` (Lines 25-30)
```typescript
email: 'alex.creator@demo.com'
password: 'Demo123'
```

**File:** `/frontend/src/pages/InvestorLogin.tsx`
```typescript
email: 'sarah.investor@demo.com' 
password: 'Demo123'
```

**File:** `/frontend/src/pages/ProductionLogin.tsx`
```typescript
email: 'stellar.production@demo.com'
password: 'Demo123'
```

### Sample Data in Components
**File:** `/frontend/src/examples/WebSocketIntegrationExample.tsx`
- "Pitch Title {pitchId}" (Line 71)
- "Created 2 days ago" (Line 72)
- "User {userId}" (Line 164, 418)
- "Great pitch! Really impressed with the concept." (Line 167)
- "Message content here..." (Line 455)
- "2 hours ago" (Line 165, 456)

## 3. HARDCODED CONSTANTS & CONFIGURATIONS

### Message Constants
**File:** `/frontend/src/constants/messages.ts` (325 lines total)

#### Validation Messages:
- "Password must be at least 8 characters long"
- "Please enter a valid email address"
- "Passwords do not match"
- "Please enter a valid URL (e.g., https://example.com)"
- "File size must be less than {maxSizeMB}MB"

#### Success Messages:
- "Welcome back! You have been successfully logged in."
- "Pitch created successfully! Your pitch is now live."
- "NDA signed successfully. You now have access to full pitch content."

#### Loading States:
- "Loading pitches..."
- "Uploading file..."
- "Creating pitch..."
- "Signing in..."

#### Form Placeholders:
- "creator@example.com"
- "Enter your project title"
- "A one-sentence summary of your story (max 2-3 sentences)"
- "Warner Bros. Pictures"
- "+1 (555) 123-4567"

### Pitch Configuration Constants  
**File:** `/frontend/src/constants/pitchConstants.ts` (Lines 8-87)

#### Fallback Genres (62 items):
- 'Abstract / Non-Narrative'
- 'Action', 'Action-Comedy', 'Action-Thriller'
- 'Adventure', 'Animation', 'Avant-Garde'
- 'Biographical Documentary', 'Biographical Drama (Biopic)'
- 'Comedy', 'Coming-of-Age', 'Crime Drama'
- 'Dramedy', 'Documentary', 'Docudrama'
- 'Fantasy', 'Horror', 'Musical'
- 'Romance', 'Science Fiction (Sci-Fi)'
- 'Thriller', 'Western'
- (Full list of 62 genres)

#### Format Categories (Lines 64-69):
- 'Feature Film'
- 'Short Film' 
- 'TV Series'
- 'Web Series'

#### Budget Ranges (Lines 71-79):
- 'Under $1M'
- '$1M-$5M'
- '$5M-$15M' 
- '$15M-$30M'
- '$30M-$50M'
- '$50M-$100M'
- 'Over $100M'

#### Project Stages (Lines 81-87):
- 'Development'
- 'Pre-Production'
- 'Production'
- 'Post-Production'
- 'Distribution'

## 4. HARDCODED URLS & ENDPOINTS

### External URLs
**File:** `/frontend/src/components/PaymentHistory.tsx` (Line 431)
- `https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`

**File:** `/frontend/src/components/PaymentMethodCard.tsx` (Line 266)
- `https://billing.stripe.com`

**File:** `/frontend/src/components/SubscriptionCard.tsx` (Line 205)
- `https://billing.stripe.com`

### Demo Website URLs
**File:** `/frontend/src/constants/messages.ts` (Line 294)
- `https://www.yourcompany.com`

**File:** `/frontend/src/components/ProductionRegistration.tsx` (Line 335)
- Placeholder: `https://www.yourcompany.com`

### API Endpoint Fixes
**File:** `/frontend/src/lib/fix-all-apis.ts` (Lines 11-12)
```typescript
if (url.includes('http://localhost:8000')) {
  url = url.replace('http://localhost:8000', API_URL);
}
```

## 5. HARDCODED STYLES & CSS CLASSES

### Tailwind CSS Classes (Most Common)
**Found in 98+ files:**

#### Layout & Spacing:
- `"min-h-screen"`, `"max-w-7xl"`, `"mx-auto"`
- `"px-4"`, `"py-6"`, `"p-6"`, `"space-x-4"`, `"space-y-6"`
- `"flex"`, `"grid"`, `"grid-cols-1"`, `"lg:grid-cols-3"`

#### Colors & Backgrounds:
- `"bg-white"`, `"bg-gray-50"`, `"bg-blue-600"`, `"bg-purple-100"`
- `"text-gray-900"`, `"text-blue-600"`, `"text-red-800"`
- `"border-gray-200"`, `"border-red-500"`

#### Interactive States:
- `"hover:bg-blue-700"`, `"focus:ring-2"`, `"focus:ring-blue-500"`
- `"disabled:opacity-50"`, `"disabled:cursor-not-allowed"`

#### Component-specific:
- `"rounded-lg"`, `"shadow"`, `"shadow-xl"`
- `"font-bold"`, `"text-2xl"`, `"text-sm"`

### Hardcoded Dimensions & Measurements
**Files with pixel values:**
- `"h-8 w-8"`, `"h-4 w-4"` (icon sizes)
- `"w-1/3"`, `"lg:col-span-2"` (layout fractions)
- `"top-6 left-6"`, `"pt-6 px-6"` (positioning)

## 6. HARDCODED LIMITS & VALUES

### Character Limits
**File:** `/frontend/src/constants/messages.ts`
- Password minimum: 8 characters (Line 18)
- Default file size limit references (Line 91)

### Toast Configuration
**File:** `/frontend/src/constants/messages.ts` (Lines 180-197)
```typescript
SUCCESS: { duration: 5000, type: 'success' }
ERROR: { duration: 8000, type: 'error' }  
WARNING: { duration: 6000, type: 'warning' }
INFO: { duration: 4000, type: 'info' }
```

### WebSocket Configuration
**File:** `/frontend/src/types/websocket.ts` (Line 6)
- Priority levels: `'low' | 'normal' | 'high' | 'critical'`

## 7. HARDCODED CONFIGURATION VALUES

### Sentry Configuration
**File:** `/frontend/src/main.tsx` (Lines 21-26)
```typescript
tracesSampleRate: import.meta.env.VITE_NODE_ENV === 'production' ? 0.1 : 1.0,
release: "pitchey-frontend@1.0.0",
```

### Storage Keys
**File:** `/frontend/src/store/authStore.ts` (Line 27)
- `'authToken'` (localStorage key)

**File:** `/frontend/src/store/pitchStore.ts` (Line 177)
- `'pitch-storage'` (persist storage name)

## 8. ICON & ASSET REFERENCES

### Lucide React Icons (Hardcoded)
**Throughout components:**
- `Film`, `DollarSign`, `Building` (portal icons)
- `Mail`, `Lock`, `AlertCircle` (form icons)
- `ArrowLeft`, `LogIn` (navigation icons)
- `Search`, `Filter`, `Settings` (UI icons)

### SVG Inline Code
**File:** `/frontend/src/pages/Marketplace.tsx` (Line 359)
- Inline SVG pattern for background decoration

**File:** `/frontend/src/pages/Homepage.tsx` (Line 155)
- Inline SVG for decorative elements

## 9. COMPONENT ARCHITECTURE HARDCODED ELEMENTS

### Route Paths
**File:** `/frontend/src/App.tsx` (Lines throughout)
- `/creator/dashboard`, `/investor/dashboard`, `/production/dashboard`
- `/login/creator`, `/login/investor`, `/login/production`
- `/pitch/:id`, `/pitch/:id/edit`, `/pitch/:id/analytics`
- `/marketplace`, `/browse`, `/profile`, `/settings`

### Portal Type Definitions
**File:** `/frontend/src/pages/PortalSelect.tsx` (Line 4)
```typescript
type PortalType = 'creator' | 'investor' | 'production';
```

### User Type Storage
**File:** `/frontend/src/App.tsx` (Line 125)
```typescript
const userType = localStorage.getItem('userType');
```

## 10. ERROR & SUCCESS MESSAGES

### Network Error Messages
**File:** `/frontend/src/constants/messages.ts` (Lines 44-46)
- "Network error. Please check your connection and try again."
- "Server error. Please try again later."
- "Invalid credentials. Please check your email and password."

### Form Validation Messages
**File:** `/frontend/src/constants/messages.ts` (Lines 152-156)
- "Please correct the errors below and try again."
- "Please fill in all required fields."
- "Invalid file format. Please check the allowed file types."

## SUMMARY

The Pitchey frontend contains extensive hardcoded elements across multiple categories:

1. **Text Content**: 300+ hardcoded strings for UI labels, messages, and placeholders
2. **Demo Data**: 6+ demo email addresses and credentials 
3. **Configuration**: 62 movie genres, 4 format types, 7 budget ranges, 5 project stages
4. **Styling**: 98+ files with Tailwind CSS classes, consistent design system
5. **URLs**: 5+ external service URLs (Stripe, demo sites)
6. **Limits**: File sizes, timeouts, character counts
7. **Routes**: 20+ hardcoded navigation paths
8. **Icons**: 15+ Lucide React icon references

**Files Analyzed**: 100+ TypeScript/TSX files  
**Lines of Hardcoded Content**: 1000+ lines across constants, messages, and component text

All hardcoded elements follow consistent patterns and are well-organized in constant files, making them suitable for internationalization and configuration management if needed.