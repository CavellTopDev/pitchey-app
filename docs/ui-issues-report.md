# UI/UX Issues Report

Generated from browser testing on 2026-01-17

## Screenshots Captured

| Screenshot | Route | Description |
|------------|-------|-------------|
| [01-homepage.png](../audit-screenshots/01-homepage.png) | `/` | Homepage with trending/new pitches |
| [02-pitch-detail.png](../audit-screenshots/02-pitch-detail.png) | `/pitch/227` | Pitch detail page |
| [03-investor-dashboard.png](../audit-screenshots/03-investor-dashboard.png) | `/investor/dashboard` | Investor main dashboard |
| [04-investor-browse.png](../audit-screenshots/04-investor-browse.png) | `/investor/dashboard` (Browse tab) | Browse opportunities |
| [05-investor-due-diligence.png](../audit-screenshots/05-investor-due-diligence.png) | `/investor/dashboard` (Due Diligence tab) | NDA management |
| [06-creator-dashboard.png](../audit-screenshots/06-creator-dashboard.png) | `/creator/dashboard` | Creator main dashboard |
| [07-production-dashboard.png](../audit-screenshots/07-production-dashboard.png) | `/production/dashboard` | Production analytics |
| [08-production-ndas.png](../audit-screenshots/08-production-ndas.png) | `/production/dashboard` (NDAs tab) | Production NDA management |

---

## Critical Issues (P0)

### 1. Pitch Detail - "Invalid Date" Display
**Location:** `/pitch/:id`
**Issue:** Published date shows "Invalid Date"
**Impact:** Reduces trust, looks unprofessional
**Fix:** Check date parsing in `PitchDetail` component

### 2. Pitch Detail - "Unknown Creator"
**Location:** `/pitch/:id`
**Issue:** Creator name shows as "Unknown Creator" even for pitches with owners
**Impact:** Breaks trust and discoverability
**Fix:** Ensure creator info is loaded with pitch data

### 3. Creator Dashboard - Analytics Error
**Location:** `/creator/dashboard`
**Issue:** "Failed to load analytics data. Please try again."
**Impact:** Creator can't see performance metrics
**Fix:** Check `/api/creator/analytics` endpoint

---

## High Priority Issues (P1)

### 4. Pitch Detail - Missing Synopsis
**Location:** `/pitch/:id`
**Issue:** Synopsis section is empty despite having a logline
**Impact:** Investors don't get enough info to make decisions
**Fix:** Ensure synopsis field is populated or show placeholder

### 5. Investor Dashboard - Stats Show Fake Trend Data
**Location:** `/investor/dashboard`
**Issue:** Shows "+12.5% vs last month" when total invested is $0
**Impact:** Misleading/confusing to users
**Fix:** Hide trend indicators when no data exists

### 6. Investor Due Diligence - Inconsistent Pending Count
**Location:** `/investor/dashboard` (Due Diligence tab)
**Issue:** Shows "Pending: 2" but "No NDA requests yet" in list
**Impact:** Confusing state
**Fix:** Sync the count with actual data

### 7. Production Dashboard - Excessive Mock Data
**Location:** `/production/dashboard`
**Issue:** Shows detailed project data (8 active projects, $15M budget) that appears to be demo/mock data
**Impact:** Confusing for real users, unclear what's real vs demo
**Fix:** Clear distinction between real and demo data, or load real data

---

## Medium Priority Issues (P2)

### 8. Homepage - Search Button Disabled
**Location:** `/`
**Issue:** Search button is always disabled
**Impact:** Users can't search from homepage
**Fix:** Enable button when search input has content

### 9. Creator Dashboard - Free Tier Message
**Location:** `/creator/dashboard`
**Issue:** "Free tier - Create pitches but cannot upload files"
**Impact:** May confuse users about what they can actually do
**Fix:** More prominent upgrade CTA or clearer feature comparison

### 10. Pitch Card - Empty Views/Likes
**Location:** `/pitch/:id`
**Issue:** Performance section shows "Views" and "Likes" labels with no numbers
**Impact:** Missing engagement metrics
**Fix:** Show 0 if no data, or hide section

### 11. Investor Browse - Empty Saved Pitches
**Location:** `/investor/dashboard` (Browse tab)
**Issue:** Shows "No saved pitches yet" but no clear CTA to save
**Impact:** User doesn't know how to save pitches
**Fix:** Add tooltip or help text explaining save functionality

---

## Low Priority Issues (P3)

### 12. Navigation - "0 Credits" Display
**Location:** All portal headers
**Issue:** Shows "0 Credits" button without context
**Impact:** Minor confusion about credits system
**Fix:** Add tooltip explaining credits or hide if 0

### 13. Production Charts - Historical Dates
**Location:** `/production/dashboard`
**Issue:** Charts show 2024 dates in 2026
**Impact:** Dates look stale
**Fix:** Use relative or current year dates

### 14. Quick Actions - Inconsistent Behavior
**Location:** Various dashboards
**Issue:** Some quick action buttons navigate, others do nothing
**Impact:** Inconsistent UX
**Fix:** All quick actions should navigate or show modal

---

## Business Value Observations

### What's Working Well
1. **Login flow** - Demo account buttons work smoothly
2. **Portal navigation** - Clear separation between Creator/Investor/Production
3. **NDA Management UI** - Well-organized NDA center on Production portal
4. **Dashboard layout** - Good use of cards and quick actions
5. **Pitch cards** - Nice visual design with genre/format badges

### What Needs Improvement
1. **Data integrity** - Many "Unknown" or "Invalid" values showing
2. **Empty states** - Not guiding users on what to do next
3. **Error handling** - Generic error messages don't help users
4. **Trend indicators** - Showing fake/misleading growth percentages
5. **NDA collaboration** - Need to verify investor/production can actually request and sign NDAs

---

## Recommended Fix Priority

### Sprint 1 (Critical) - COMPLETED ✅
- [x] Fix "Invalid Date" on pitch pages (PitchDetail.tsx - added date validation)
- [x] Fix "Unknown Creator" display (Backend getPitch now returns creator object)
- [x] Fix analytics loading error (EnhancedCreatorAnalytics.tsx - switched to useBetterAuthStore, added fallback)

### Sprint 2 (High) - COMPLETED ✅
- [x] Add proper empty states (already good in most places)
- [x] Fix misleading trend indicators (InvestorDashboard.tsx - conditional rendering based on actual data)
- [x] Sync pending NDA counts (InvestorDashboard.tsx - now uses actual ndaRequests data)

### Sprint 3 (Medium)
- [ ] Enable homepage search
- [ ] Improve free tier messaging
- [ ] Add engagement metrics

### Sprint 4 (Polish)
- [ ] Credits tooltip
- [ ] Update chart dates
- [ ] Quick action consistency

---

## Files to Review

Based on the issues found, these files likely need attention:

```
frontend/src/pages/PitchDetail.tsx          - Invalid date, unknown creator
frontend/src/pages/creator/CreatorDashboard.tsx - Analytics error
frontend/src/pages/investor/InvestorDashboard.tsx - Fake trends
frontend/src/components/PitchCard.tsx       - Empty metrics
frontend/src/components/EmptyState.tsx      - Better guidance
```
