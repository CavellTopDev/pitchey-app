# NDA Button States - Manual Test Guide

## Overview
The NDA button on pitch pages now shows different states based on the actual backend data. This guide will help you verify all the different states.

## What's Been Implemented

### Button States
1. **No Request Yet** (Purple button)
   - Text: "Request NDA Access"
   - Clickable, opens NDA modal

2. **Request Pending** (Yellow button, disabled)
   - Text: "NDA Request Pending Review"
   - Shows yellow info box: "Your NDA request is being reviewed by the creator. You'll be notified once approved."
   - Button is disabled

3. **Request Approved** (Green button, disabled)
   - Text: "Access Granted - View Enhanced Info Above"
   - Enhanced information section is visible above
   - Button is disabled

4. **Request Rejected** (Red button, disabled)
   - Text: "NDA Request Rejected"
   - Shows red info box: "Your NDA request was not approved. You may contact the creator for more information."
   - Button is disabled

## Test Steps

### Step 1: Test Unauthenticated State
1. Open browser in incognito/private mode
2. Navigate to http://localhost:5173/marketplace
3. Click on any pitch (e.g., "Neon Nights")
4. **Expected**: Button shows "Sign In to Request Access"

### Step 2: Test Creator Access (Cannot Request NDAs)
1. Go to http://localhost:5173/portals
2. Click "Creator Portal"
3. Login with:
   - Email: alex.creator@demo.com
   - Password: Demo123
4. Go back to marketplace and click on another creator's pitch
5. **Expected**: See message "Creators cannot request NDA access to other pitches"

### Step 3: Test Investor Access - New Request
1. Logout and go to http://localhost:5173/portals
2. Click "Investor Portal"
3. Login with:
   - Email: sarah.investor@demo.com
   - Password: Demo123
4. Go to marketplace and click on a pitch
5. **Expected**: Button shows "Request NDA Access" (purple)
6. Click the button
7. Fill out the NDA request modal and submit
8. **Expected**: Button changes to "NDA Request Pending Review" (yellow, disabled)

### Step 4: Test Production Company Access
1. Logout and go to http://localhost:5173/portals
2. Click "Production Portal"
3. Login with:
   - Email: stellar.production@demo.com
   - Password: Demo123
4. Go to marketplace and click on a creator's pitch
5. **Expected**: Same behavior as investor - can request NDAs

### Step 5: Test Creator Approval Flow
1. Login as the creator who owns a pitch with pending NDA requests
2. Navigate to Creator Dashboard > NDA Management
3. Find pending NDA requests
4. Approve or reject a request
5. When the requester views the pitch again:
   - If approved: Button shows "Access Granted - View Enhanced Info Above" (green)
   - If rejected: Button shows "NDA Request Rejected" (red)

## Technical Details

### Files Modified
- `/frontend/src/pages/PublicPitchView.tsx`
  - Added `ndaRequestStatus` state tracking
  - Added `checkNDAStatus` function to query backend
  - Updated button rendering with conditional states
  - Added status message boxes

- `/frontend/src/services/nda.service.ts`
  - Already has `getNDAStatus` method for checking request status

### Backend Integration
The button states are linked to actual backend data through:
- `getNDAStatus(pitchId)` - Checks if user has existing NDA and its status
- `canRequestNDA(pitchId)` - Checks if user can request a new NDA
- NDA status values: 'pending', 'approved', 'rejected', 'expired', 'revoked'

## Demo Accounts
All use password: **Demo123**

- **Creator**: alex.creator@demo.com
- **Investor**: sarah.investor@demo.com  
- **Production**: stellar.production@demo.com

## Visual Guide

### Color Coding
- 🟣 **Purple**: Available to request
- 🟡 **Yellow**: Pending review
- 🟢 **Green**: Approved/granted
- 🔴 **Red**: Rejected

### Button States Flow
```
Not Logged In → Sign In Required
     ↓
Logged In → Request NDA Access (purple)
     ↓
Click Button → Submit Request
     ↓
Pending Review (yellow, disabled)
     ↓
Creator Reviews
   ↙     ↘
Approved  Rejected
(green)    (red)
```

## Troubleshooting

### Rate Limiting
If you see "Too many requests" errors:
1. Wait 60 seconds
2. Or restart the backend server:
   ```bash
   # Kill current server (Ctrl+C)
   # Restart
   PORT=8001 JWT_SECRET="test-secret-key-for-development" DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey" deno run --allow-all working-server.ts
   ```

### NDA Not Showing Different States
1. Check browser console for errors
2. Verify you're logged in with the correct account type
3. Check that the backend server is running on port 8001
4. Clear browser cache and refresh

## Summary
The NDA button now provides clear visual feedback about request status, preventing confusion and repeated clicking. Users can immediately see whether their request is pending, approved, or rejected, creating a better user experience.