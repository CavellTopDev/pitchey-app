# Pitchey Platform - UI Testing Checklist

## Overview
This document provides detailed UI testing procedures for all user interfaces across the three portals: Creator, Investor, and Production.

---

## General UI Standards

### Cross-Browser Compatibility
- [ ] Chrome (latest version)
- [ ] Firefox (latest version)  
- [ ] Safari (latest version)
- [ ] Edge (latest version)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Responsive Design Breakpoints
- [ ] Desktop (1920x1080, 1366x768)
- [ ] Laptop (1440x900, 1280x800)
- [ ] Tablet (768x1024, 1024x768)
- [ ] Mobile (375x667, 414x896, 360x640)

### Accessibility Standards (WCAG 2.1 AA)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader compatibility (test with NVDA/JAWS)
- [ ] Color contrast ratio minimum 4.5:1
- [ ] Alt text for all images
- [ ] Focus indicators visible
- [ ] Form labels properly associated
- [ ] Heading structure logical (h1→h2→h3)

---

## Portal Selector Page

### URL: http://localhost:5173/portal-select

#### Visual Elements
- [ ] Page loads without console errors
- [ ] Pitchey logo displays correctly
- [ ] Three portal cards visible: Creator, Investor, Production
- [ ] Each card has appropriate icon and description
- [ ] Footer with legal links (Privacy, Terms)

#### Interactive Elements
- [ ] Creator card click navigates to /creator/login
- [ ] Investor card click navigates to /investor/login  
- [ ] Production card click navigates to /production/login
- [ ] Cards have hover effects
- [ ] Logo click returns to homepage
- [ ] Footer links function correctly

#### Responsive Behavior
- [ ] Cards stack vertically on mobile
- [ ] Text remains readable at all sizes
- [ ] Touch targets minimum 44x44px on mobile
- [ ] No horizontal scroll on any device

---

## Authentication Pages

### Creator Login Page (/creator/login)

#### Form Elements
- [ ] Email input field with proper type="email"
- [ ] Password input field with type="password"
- [ ] "Remember me" checkbox
- [ ] "Login" button prominently displayed
- [ ] "Forgot Password?" link
- [ ] "Don't have an account? Register" link

#### Form Validation
- [ ] Required field indicators (* or "Required")
- [ ] Email validation on blur
- [ ] Password minimum length validation
- [ ] Error messages display inline below fields
- [ ] Error messages are descriptive and helpful
- [ ] Success message on valid submission

#### Interactive Behavior
- [ ] Tab navigation follows logical order
- [ ] Enter key submits form
- [ ] Login button shows loading state during submission
- [ ] Form disables during submission to prevent double-submit
- [ ] Focus management after form submission

#### Error Handling
- [ ] Network error: "Connection failed. Please try again."
- [ ] Invalid credentials: "Email or password is incorrect."
- [ ] Account locked: "Account temporarily locked due to failed attempts."
- [ ] Server error: "Something went wrong. Please try again later."

### Investor Login Page (/investor/login)
- [ ] Same validation criteria as Creator Login
- [ ] Portal-specific branding/colors if applicable
- [ ] Redirects to investor dashboard on success

### Production Login Page (/production/login)  
- [ ] Same validation criteria as Creator Login
- [ ] Portal-specific branding/colors if applicable
- [ ] Redirects to production dashboard on success

---

## Dashboard Pages

### Creator Dashboard (/creator/dashboard)

#### Header Section
- [ ] User welcome message with name
- [ ] Profile avatar/initials display
- [ ] Logout button accessible
- [ ] Notification bell with count badge
- [ ] Navigation menu responsive collapse on mobile

#### Metrics Overview Cards
- [ ] Total pitches count displays correctly
- [ ] Total views displays correctly
- [ ] Total likes displays correctly  
- [ ] NDA requests count displays correctly
- [ ] Loading states shown while fetching data
- [ ] Error states if data fails to load
- [ ] Numbers format with commas for large values

#### Recent Activity Feed
- [ ] Activity items display chronologically
- [ ] Each item shows timestamp (relative: "2 hours ago")
- [ ] Activity icons match action types
- [ ] "View all activity" link functions
- [ ] Empty state if no activities

#### Quick Actions Section
- [ ] "Create New Pitch" button prominent
- [ ] "Manage Pitches" link functions
- [ ] "View Analytics" link functions
- [ ] "Account Settings" link functions

### Investor Dashboard (/investor/dashboard)

#### Browse Section
- [ ] Featured pitches carousel/grid
- [ ] Search bar with placeholder text
- [ ] Genre filter dropdown with all options
- [ ] Sort by dropdown (Newest, Most Viewed, etc.)
- [ ] "View All Pitches" button

#### My Activity Section
- [ ] Recent viewed pitches
- [ ] Pending NDA requests
- [ ] Signed NDAs count
- [ ] Watchlist count
- [ ] "View Full History" link

#### Recommendations (if implemented)
- [ ] "Recommended for you" section
- [ ] Pitch cards match user preferences
- [ ] "See more recommendations" link

### Production Dashboard (/production/dashboard)

#### Company Overview
- [ ] Company name and logo display
- [ ] Team member count
- [ ] Active projects count
- [ ] NDA processing metrics

#### Advanced Analytics
- [ ] Charts render without errors
- [ ] Data visualization is clear and readable
- [ ] Interactive elements (hover, click) work
- [ ] Export functionality (if available)

---

## Pitch Management Pages

### Create Pitch Page (/create-pitch)

#### Form Sections
##### Basic Information
- [ ] Title field (required indicator)
- [ ] Logline textarea with character count
- [ ] Genre dropdown with all 50+ options
- [ ] Format selection (Feature, Series, Short, etc.)
- [ ] Target audience field

##### Detailed Information  
- [ ] Short synopsis textarea
- [ ] Long synopsis textarea  
- [ ] Opener description
- [ ] Premise field
- [ ] Characters description
- [ ] Themes field
- [ ] Episode breakdown (for series)

##### Budget & Logistics
- [ ] Budget bracket dropdown
- [ ] Estimated budget field with currency formatting
- [ ] Production timeline (if implemented)

##### Media Upload
- [ ] Pitch deck upload area
- [ ] Video trailer upload area
- [ ] Poster image upload area
- [ ] Progress bars during upload
- [ ] File format restrictions enforced
- [ ] File size limits enforced

##### Visibility Settings
- [ ] Public/Private toggle
- [ ] NDA required checkbox
- [ ] Preview before publish

#### Form Behavior
- [ ] Auto-save draft every 30 seconds
- [ ] Draft saved indicator
- [ ] Form validation on submit
- [ ] All required fields checked
- [ ] Character limits enforced
- [ ] Genre suggestions (if implemented)

#### File Upload Testing
- [ ] PDF upload works (pitch deck)
- [ ] MP4 upload works (video)
- [ ] JPEG/PNG upload works (poster)
- [ ] File too large error handling
- [ ] Invalid file type rejection
- [ ] Upload progress indication
- [ ] Upload cancellation
- [ ] Multiple files upload

### Edit Pitch Page (/pitch/:id/edit)
- [ ] All fields populate with existing data
- [ ] Changes save successfully
- [ ] Version history (if implemented)
- [ ] Cancel changes confirmation
- [ ] Delete pitch option with confirmation

### Manage Pitches Page (/manage-pitches)

#### Pitch List
- [ ] All user's pitches display
- [ ] Pitch cards show: title, genre, status, views, likes
- [ ] Edit button for each pitch
- [ ] Delete button with confirmation
- [ ] Bulk actions (if implemented)

#### List Controls
- [ ] Search within user's pitches
- [ ] Filter by status (Active, Draft, Private)
- [ ] Sort by created date, views, likes
- [ ] Pagination for large lists

---

## Pitch Viewing Pages

### Public Pitch View (/pitch/:id)

#### Pitch Information Display
- [ ] Title displays prominently
- [ ] Creator name and profile link
- [ ] Genre and format tags
- [ ] Logline readable and prominent
- [ ] Synopsis sections formatted properly
- [ ] View count and like count
- [ ] Created/updated date

#### Media Display
- [ ] Poster image loads and displays properly
- [ ] Video player (if video available)
  - [ ] Play/pause controls
  - [ ] Volume controls
  - [ ] Fullscreen option
  - [ ] Responsive sizing
- [ ] Pitch deck viewer/download link

#### Interactive Elements
- [ ] Like button with heart icon
- [ ] Save to watchlist button (for investors)
- [ ] Share button with social options
- [ ] NDA request button (for investors)
- [ ] Contact creator button
- [ ] Report inappropriate content link

#### Related Content
- [ ] "More from this creator" section
- [ ] "Similar pitches" recommendations
- [ ] Tags/keywords clickable for search

### Protected Pitch View (NDA Required)
- [ ] NDA gate displays before content
- [ ] "Request NDA" button prominent
- [ ] NDA terms and conditions visible
- [ ] NDA status indicator
- [ ] Access granted after NDA signed

---

## NDA Management Pages

### NDA Request Modal
- [ ] Modal opens smoothly
- [ ] Pitch details summary shown
- [ ] NDA terms scrollable
- [ ] "I agree" checkbox required
- [ ] "Request Access" button
- [ ] "Cancel" button
- [ ] Modal closes on background click
- [ ] Keyboard navigation (Esc to close)

### NDA Signing Interface
- [ ] Digital signature field
- [ ] Terms and conditions display
- [ ] Date auto-populated
- [ ] "Sign NDA" button disabled until signature provided
- [ ] Legal disclaimer visible
- [ ] Download unsigned NDA option
- [ ] Progress indicator through steps

### NDA History Page
- [ ] Table view of all NDAs
- [ ] Columns: Pitch, Status, Date, Actions
- [ ] Status indicators (Pending, Signed, Expired)
- [ ] Download signed NDA links
- [ ] Filter by status
- [ ] Search by pitch name

---

## Search and Browse Pages

### Marketplace/Browse Page (/marketplace)

#### Search Interface
- [ ] Search input prominent at top
- [ ] Search suggestions dropdown
- [ ] Recent searches (if implemented)
- [ ] Search button and Enter key support
- [ ] Clear search button (X)

#### Filter Sidebar
- [ ] Genre multiselect checkboxes
- [ ] Budget range slider
- [ ] Format filter (Feature, Series, etc.)
- [ ] Release status filter
- [ ] Location filter (if implemented)
- [ ] "Clear all filters" button
- [ ] Filter count indicators

#### Results Display
- [ ] Pitch cards in grid layout
- [ ] Card information: title, creator, genre, views
- [ ] Card hover effects
- [ ] Infinite scroll or pagination
- [ ] Sort options: Newest, Popular, Alphabetical
- [ ] Results count display
- [ ] No results message with suggestions

#### Mobile Considerations
- [ ] Filter sidebar collapses to modal
- [ ] Cards stack appropriately
- [ ] Touch-friendly interactions
- [ ] Swipe gestures (if implemented)

---

## Profile and Settings Pages

### User Profile Page (/profile)

#### Profile Information
- [ ] Profile picture upload/change
- [ ] Name fields editable
- [ ] Bio textarea
- [ ] Contact information fields
- [ ] Social media links
- [ ] Location field
- [ ] Company information (for production users)

#### Profile Visibility
- [ ] Public profile toggle
- [ ] Privacy settings
- [ ] What information to show publicly
- [ ] Profile preview mode

### Account Settings (/settings)

#### Account Security
- [ ] Change password form
- [ ] Two-factor authentication setup
- [ ] Active sessions list
- [ ] Login activity log
- [ ] Account deletion option

#### Notification Preferences
- [ ] Email notification toggles
- [ ] Push notification settings (if implemented)
- [ ] Notification frequency options
- [ ] Unsubscribe from all option

#### Privacy Settings
- [ ] Data usage preferences
- [ ] Third-party integrations
- [ ] Marketing communications opt-out
- [ ] Cookie preferences

---

## Communication Features

### Messages Page (/messages)

#### Message List
- [ ] Conversation list with user names
- [ ] Last message preview
- [ ] Timestamp display
- [ ] Unread message indicators
- [ ] Search conversations
- [ ] Archive conversation option

#### Message Thread
- [ ] Message history chronological
- [ ] Sender identification clear
- [ ] Timestamp for each message
- [ ] Message status (sent, delivered, read)
- [ ] Typing indicator
- [ ] File attachment support (if implemented)

#### Compose Interface
- [ ] Text input with character count
- [ ] Send button enabled when text present
- [ ] Enter key sends message
- [ ] Shift+Enter for new line
- [ ] Emoji picker (if implemented)
- [ ] Message drafts saved

---

## Analytics and Reports

### Analytics Dashboard (/analytics)

#### Chart Display
- [ ] Charts render without JavaScript errors
- [ ] Data loads within reasonable time
- [ ] Interactive elements (hover, click) work
- [ ] Responsive chart sizing
- [ ] Legend displays correctly
- [ ] Axis labels readable

#### Metrics Cards
- [ ] Key performance indicators prominent
- [ ] Comparison periods (vs. last month)
- [ ] Percentage change indicators
- [ ] Trend arrows (up/down)
- [ ] Click-through to detailed views

#### Export Functionality
- [ ] PDF export works
- [ ] CSV export works
- [ ] Date range selection
- [ ] Custom report builder (if implemented)

---

## Error Pages and States

### 404 Not Found
- [ ] Custom 404 page displays
- [ ] Helpful error message
- [ ] Navigation back to home/dashboard
- [ ] Search functionality on error page
- [ ] Consistent branding

### 500 Server Error
- [ ] User-friendly error message
- [ ] Contact support information
- [ ] Retry button functionality
- [ ] Error ID for support reference

### Maintenance Mode
- [ ] Maintenance message displays
- [ ] Estimated downtime information
- [ ] Contact information for urgent issues

### Loading States
- [ ] Skeleton screens for content
- [ ] Loading spinners for actions
- [ ] Progress bars for uploads/processes
- [ ] Timeout handling for long operations

### Empty States
- [ ] "No pitches yet" with call-to-action
- [ ] "No messages" with helpful text
- [ ] "No notifications" placeholder
- [ ] "Search returned no results" with suggestions

---

## Form Validation Patterns

### Field-Level Validation
- [ ] Email format validation
- [ ] Password strength requirements
- [ ] Required field indicators
- [ ] Character count for text fields
- [ ] Number format validation
- [ ] Date format validation

### Inline Error Messages
- [ ] Error appears below field
- [ ] Red color/styling for errors
- [ ] Error icon accompanies message
- [ ] Error persists until corrected
- [ ] Multiple errors handled gracefully

### Form-Level Validation
- [ ] Submit button disabled during processing
- [ ] Success message after successful submission
- [ ] Scroll to first error on validation failure
- [ ] Preserve form data on error
- [ ] Clear validation state on field focus

---

## Performance Criteria

### Page Load Times
- [ ] Initial page load < 3 seconds
- [ ] Subsequent navigation < 1 second
- [ ] Image loading optimized (lazy loading)
- [ ] JavaScript/CSS minified
- [ ] Critical rendering path optimized

### Interactive Elements
- [ ] Button click response < 100ms
- [ ] Form submission feedback immediate
- [ ] Hover effects smooth (no lag)
- [ ] Scroll performance smooth
- [ ] Animation frame rate > 30fps

### Network Conditions
- [ ] Graceful degradation on slow connections
- [ ] Offline mode handling (if implemented)
- [ ] Progress indication for slow operations
- [ ] Timeout handling with user feedback

---

## Security UI Elements

### Authentication Flows
- [ ] Password masking in input fields
- [ ] "Show password" toggle functionality
- [ ] Password strength indicator
- [ ] Account lockout messaging
- [ ] Secure password reset flow

### Data Protection
- [ ] Sensitive data masked in UI
- [ ] Confirmation dialogs for destructive actions
- [ ] Session timeout warnings
- [ ] Secure logout (clear tokens)

---

## Browser Console Checks

### JavaScript Errors
- [ ] No console errors on page load
- [ ] No console errors during navigation
- [ ] No console errors during form submission
- [ ] No console errors during file upload
- [ ] No console warnings about deprecated APIs

### Network Requests
- [ ] All API calls return expected responses
- [ ] No failed resource loading (404s for CSS/JS/images)
- [ ] Proper HTTP status codes
- [ ] No unnecessary duplicate requests
- [ ] CORS headers configured correctly

### Performance Warnings
- [ ] No memory leak warnings
- [ ] No performance bottleneck warnings
- [ ] Reasonable bundle sizes
- [ ] Efficient re-rendering patterns

---

## Testing Tools and Commands

### Browser Developer Tools
```javascript
// Check for global JavaScript errors
console.log('Checking for errors...');
window.addEventListener('error', (e) => console.error('JavaScript Error:', e));

// Performance monitoring
console.log('Page load time:', performance.now());

// Accessibility audit (Chrome DevTools)
// Run Lighthouse audit for accessibility score
```

### Manual Testing Checklist
1. Open browser dev tools (F12)
2. Navigate through all major user flows
3. Test form submissions with various inputs
4. Test responsive design at different breakpoints
5. Verify all links and buttons function
6. Check console for errors/warnings
7. Test keyboard navigation
8. Test with screen reader (if available)

### Automated Testing Integration
```bash
# Run Playwright tests (if implemented)
npx playwright test

# Run accessibility tests
npm run test:a11y

# Visual regression tests
npm run test:visual
```

This comprehensive UI testing checklist ensures that all aspects of the user interface are thoroughly validated before release.