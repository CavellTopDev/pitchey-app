# Pitchey Platform - Client Feedback & Required Changes

**Document Version**: 2.0  
**Last Updated**: 2025-11-06  
**Client Feedback Date**: October 2025  
**Overall Client Impression**: "First of all it looks great and looks like one website!"

---

## 🎯 RECENT FIXES & IMPROVEMENTS (November 2025)

### ✅ COMPLETED - Frontend-Backend Consistency
**Status**: FIXED  
**Completion Date**: November 6, 2025

**Issues Resolved**:
1. **Homepage Display Issues**
   - Fixed text overlapping problems in hero section
   - Resolved "scribbly lines" issue caused by conflicting drop-shadow CSS
   - Fixed Chrome-specific text color changes (white to black)
   - Restored floating decoration icons with responsive behavior

2. **Missing API Endpoints**
   - Added `/api/creator/funding/overview` - Creator funding data
   - Added `/api/analytics/user` - User analytics with preset support
   - Added `/api/ndas/stats` - NDA statistics endpoint
   - Added `/api/user/notifications` - User notification management
   - Added `/api/search/users` - Advanced user search functionality

3. **Authentication & Response Patterns**
   - Standardized authentication error responses across all endpoints
   - Fixed incorrect function references (`unauthorizedResponse` → `authErrorResponse`)
   - Implemented consistent JWT validation patterns
   - Added proper demo account context for testing

4. **Database & API Consistency**
   - Conducted comprehensive frontend-backend consistency analysis
   - Identified and resolved 87+ potential API/database inconsistencies
   - Fixed camelCase vs snake_case field mapping issues
   - Standardized response structures across all endpoints

**Technical Achievements**:
- Zero 404 errors in demo dashboards
- Consistent authentication flows across all portals
- Proper responsive design that works across all browsers
- Clean separation of concerns between frontend services and backend APIs

---

## 🚨 CRITICAL ISSUES (Priority 1)

### Investor Account Issues

#### 1. Sign-Out Functionality Broken
**Current State**: Investor accounts CANNOT sign out - button/functionality is completely broken  
**Required State**: Working sign-out functionality across all user types  
**Impact**: Security risk - users cannot properly log out  

**Technical Requirements**:
- Fix logout endpoint for investor portal
- Ensure JWT token is properly cleared
- Redirect to appropriate landing page after logout
- Test across all three user types (Creator, Investor, Production)

**Testing Criteria**:
- [ ] Investor can successfully sign out
- [ ] Session/JWT is cleared after sign out
- [ ] User is redirected to login page
- [ ] Cannot access protected routes after sign out

#### 2. Investor Dashboard Not Working
**Current State**: Investor dashboard showing "Still Not working!" message  
**Required State**: Fully functional investor dashboard with all metrics and features  

**Required Dashboard Features**:
- Investment portfolio overview
- Saved pitches section
- NDA status tracking
- Recent activity feed
- Analytics and metrics
- Info request management

**Known Issues to Investigate**:
- Database connection for investor-specific queries
- Role-based permission checks
- WebSocket connection for real-time updates
- Data aggregation for dashboard metrics

---

## 📁 BROWSE PITCHES SECTION (Priority 2)

### Navigation & Filtering Issues

#### 1. Tab Content Separation
**Current State**: 
- "Trending" tab shows mixed content (trending + new)
- "New" tab also shows trending content
- "Top Rated" tab duplicates Trending functionality

**Required State**:
- "Trending" tab: ONLY trending pitches (based on views/engagement metrics)
- "New" tab: ONLY newest pitches (sorted by creation date descending)
- REMOVE "Top Rated" tab completely

**Implementation Notes**:
```typescript
// API endpoints should filter correctly:
GET /api/pitches/trending - Returns only trending pitches
GET /api/pitches/new - Returns only new pitches (last 30 days)
// Remove: GET /api/pitches/top-rated
```

#### 2. Genre & Format UI Enhancement
**Current State**: Basic text or limited UI for genre/format selection  
**Required State**: Dropdown/select UI matching the upload page design

**UI Requirements**:
- Multi-select dropdown for Genres
- Single-select dropdown for Formats
- Consistent styling with Create Pitch page
- Clear selected filters indicator
- Reset filters option

#### 3. New General Browse View
**Current State**: Limited browsing options  
**Required State**: Comprehensive browse view with advanced sorting

**Sorting Options Required**:
- **Alphabetical**: A-Z, Z-A (by title)
- **Date**: Newest to Oldest, Oldest to Newest
- **Budget**: High to Low, Low to High
- **View Count**: Most Viewed, Least Viewed
- **Investment Status**: Funded, Seeking Funding, In Production

**Reference Pattern**: Similar to car shopping websites (filters on left, results on right)

### Current Bugs

#### Pitch Visibility Issue
**Bug Description**: Newly uploaded pitches not appearing in Browse section  
**Investigation Required**:
- Check caching mechanism (may need cache invalidation)
- Verify database write confirmation
- Check filtering logic excluding new pitches
- Review publish/draft status handling

#### Investor Pitch Creation Bug
**Current State**: Investors can create/upload pitches (appearing in browse)  
**Required State**: Investors should NOT have pitch creation capability

**Access Control Matrix**:
| User Type | Can Create Pitch | Can View Pitches | Can Invest |
|-----------|-----------------|------------------|------------|
| Creator | ✅ Yes | ✅ Yes | ❌ No |
| Investor | ❌ No | ✅ Yes | ✅ Yes |
| Production | ❌ No | ✅ Yes | ✅ Yes |

---

## ✏️ CREATE A PITCH SECTION (Priority 3)

### Character Management Enhancement

#### 1. Edit Character Feature
**Current State**: Must delete and re-add to edit character details  
**Required State**: In-line editing of existing characters

**Required Features**:
- Edit button for each character card
- Modal or inline form for editing
- Save changes without losing position
- Validation for edited data

#### 2. Character Reordering
**Current State**: Characters appear in order added, cannot be reordered  
**Required State**: Drag-and-drop or button-based reordering

**Implementation Options**:
- **Option A**: Drag-and-drop with visual feedback
- **Option B**: Up/Down arrow buttons
- **Option C**: Both methods for accessibility

**Technical Requirements**:
- Maintain order in database
- Update UI immediately (optimistic updates)
- Persist order on save

### Form Field Updates

#### 1. Themes Field
**Current State**: Predetermined dropdown options  
**Required State**: Free-text input field

**Requirements**:
- Multi-line text input
- Character limit (500-1000 chars)
- Placeholder text with examples
- No validation for specific values

#### 2. New "World" Field
**Current State**: Field doesn't exist  
**Required State**: Add new text field for world-building

**Field Specifications**:
- Location: Under Themes section
- Type: Multi-line text area
- Label: "World"
- Placeholder: "Describe the world where your story takes place..."
- Character limit: 2000 characters
- Required: No (optional field)

### Document Upload System

#### Critical Issues
1. **No Upload Button Visible**
   - Current: Upload section exists but button is missing/hidden
   - Required: Visible, accessible upload button

2. **Multiple Document Support**
   - Current: Cannot add multiple documents
   - Required: Support for multiple file uploads

3. **Custom NDA Upload**
   - Current: No option for custom NDA
   - Required: Specific section for NDA document upload

4. **NDA Opt-in/Opt-out**
   - Current: No checkbox for NDA preference
   - Required: Checkbox with options:
     - [ ] Require NDA before viewing full pitch
     - [ ] Use platform standard NDA
     - [ ] Use custom NDA (enables upload)
     - [ ] No NDA required

**File Requirements**:
- Accepted formats: PDF, DOC, DOCX
- Max file size: 10MB per document
- Max total size: 50MB
- Document types: Script, Treatment, Pitch Deck, NDA, Supporting Materials

---

## 📜 NDA & INFO REQUEST WORKFLOW (Priority 2)

### Current Issues
**Client Quote**: "Does this need to be done on a live site or something?"  
This indicates the NDA workflow is completely unclear or non-functional in current environment.

### Required NDA Workflow

#### Step 1: Pitch Discovery
- Investor browses pitches
- Sees limited preview (non-NDA content)
- "Request Full Access" button visible

#### Step 2: NDA Request
- Investor clicks "Request Full Access"
- System presents NDA terms
- Options:
  - View standard NDA
  - Download NDA for review
  - Sign electronically
  - Request modifications

#### Step 3: Creator Notification
- Creator receives notification of NDA request
- Can review investor profile
- Options:
  - Approve with standard NDA
  - Provide custom NDA
  - Decline request
  - Request more information

#### Step 4: NDA Signing
- Electronic signature interface
- Date/timestamp recording
- IP address logging for legal purposes
- PDF generation of signed document

#### Step 5: Access Grant
- Upon signing, full pitch becomes visible
- Investor can now:
  - View complete pitch details
  - Download materials
  - Request additional information
  - Make investment offers

### Information Request Process

#### After NDA Signing
1. **Request Additional Info**
   - Button: "Request More Information"
   - Form with:
     - Specific questions
     - Document requests
     - Meeting request option

2. **Creator Response**
   - Notification of info request
   - Response interface with:
     - Text responses
     - Document attachments
     - Meeting scheduling

3. **Tracking & History**
   - All requests logged
   - Response status tracking
   - Communication history

### NDA Management Portal

#### For Creators
- List of all NDA requests (pending/signed/declined)
- Signed NDA documents repository
- Analytics on NDA conversions
- Info request management

#### For Investors
- Signed NDAs repository
- Pitches with active NDAs
- Expiration tracking
- Info request history

---

## 🔧 TECHNICAL IMPLEMENTATION NOTES

### Database Schema Updates Required

```sql
-- Character ordering
ALTER TABLE pitch_characters ADD COLUMN display_order INTEGER DEFAULT 0;

-- World field
ALTER TABLE pitches ADD COLUMN world_description TEXT;

-- NDA preferences
ALTER TABLE pitches ADD COLUMN nda_required BOOLEAN DEFAULT false;
ALTER TABLE pitches ADD COLUMN use_custom_nda BOOLEAN DEFAULT false;
ALTER TABLE pitches ADD COLUMN custom_nda_url TEXT;

-- Info requests
CREATE TABLE info_requests (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id),
  investor_id INTEGER REFERENCES users(id),
  request_text TEXT,
  response_text TEXT,
  status VARCHAR(50),
  created_at TIMESTAMP,
  responded_at TIMESTAMP
);
```

### API Endpoints Required

```typescript
// Character management
PUT /api/pitches/:id/characters/:characterId
POST /api/pitches/:id/characters/reorder

// NDA workflow
POST /api/nda/request
POST /api/nda/sign
GET /api/nda/signed
POST /api/nda/custom-upload

// Info requests
POST /api/pitches/:id/info-request
GET /api/info-requests
PUT /api/info-requests/:id/respond

// Fixed browse endpoints
GET /api/pitches/browse/general?sort={sortType}&order={order}
GET /api/pitches/trending (filtered)
GET /api/pitches/new (filtered)
```

---

## 📊 TESTING CRITERIA

### Critical Path Testing

1. **Investor Flow**
   - [ ] Can sign in as investor
   - [ ] Dashboard loads with data
   - [ ] Cannot create pitches
   - [ ] Can browse all pitches
   - [ ] Can request NDA
   - [ ] Can sign NDA
   - [ ] Can view full pitch after NDA
   - [ ] Can request additional info
   - [ ] Can sign out successfully

2. **Creator Flow**
   - [ ] Can create pitch with all fields
   - [ ] Can add/edit/reorder characters
   - [ ] Can upload multiple documents
   - [ ] Can set NDA preferences
   - [ ] Receives NDA notifications
   - [ ] Can respond to info requests
   - [ ] New pitches appear in browse

3. **Browse & Filter**
   - [ ] Trending shows only trending
   - [ ] New shows only new
   - [ ] Sorting works (A-Z, date, budget)
   - [ ] Genre dropdown works
   - [ ] Format dropdown works
   - [ ] No "Top Rated" tab exists

---

## 🚀 DEPLOYMENT CONSIDERATIONS

### Environment Setup
- Development: Full NDA workflow should work locally
- Staging: Test with mock payment/signing services
- Production: Integrate with legal e-signature provider

### Required Services
- Document storage (S3/similar for NDAs and documents)
- E-signature integration (DocuSign/HelloSign)
- Email notifications for NDA events
- Redis caching for browse performance

---

## 📝 KNOWN LIMITATIONS & WORKAROUNDS

### Current Workarounds

1. **Investor Sign-out**: Use browser dev tools to clear localStorage/sessionStorage
2. **Character Editing**: Document order when adding, delete all and re-add in correct order
3. **NDA Workflow**: May need to test on staging/production environment
4. **Document Upload**: Use API directly via Postman/curl for testing

### Temporary Solutions
- Investor dashboard: Use creator dashboard as reference for required features
- Browse filtering: Apply filters manually in database queries
- NDA signing: Manual process via email until e-signature integrated

---

## 📞 SUPPORT & QUESTIONS

### FAQ for Client

**Q: Does the NDA workflow need a live site?**
A: The NDA workflow should work in development, but e-signature integration may require staging/production environment with proper SSL certificates.

**Q: Why can't investors sign out?**
A: This is a critical bug in the logout endpoint specific to investor accounts. Temporary workaround is clearing browser data.

**Q: Why are new pitches not showing?**
A: Likely a caching issue. The system may be serving cached results. Cache invalidation needs to be triggered on new pitch creation.

**Q: Can we test the full workflow locally?**
A: Yes, except for third-party integrations (e-signature, email). These can be mocked in development.

---

## 📅 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1 (Immediate - Week 1)
1. Fix investor sign-out functionality
2. Fix investor dashboard
3. Remove investor pitch creation ability
4. Fix browse section filtering (Trending/New separation)

### Phase 2 (Week 2)
1. Implement general browse with sorting
2. Add character edit/reorder features
3. Fix document upload visibility
4. Update Themes to free-text field

### Phase 3 (Week 3)
1. Implement complete NDA workflow
2. Add info request system
3. Add World field to pitch creation
4. Implement multiple document upload

### Phase 4 (Week 4)
1. Testing and bug fixes
2. Performance optimization
3. Documentation updates
4. Client training/handover

---

## ✅ SUCCESS METRICS

- All investor features functional
- 100% of new pitches visible in browse
- NDA workflow completion rate >80%
- Character management without data loss
- All sorting options functional
- Zero role-permission violations

---

**End of Requirements Document**