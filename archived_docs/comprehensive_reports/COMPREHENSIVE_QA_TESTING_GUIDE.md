# Pitchey Platform - Comprehensive QA Testing Guide

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Portal Testing Guides](#portal-testing-guides)
4. [API Testing Guide](#api-testing-guide)
5. [UI Testing Checklist](#ui-testing-checklist)
6. [WebSocket Testing](#websocket-testing)
7. [Database Testing](#database-testing)
8. [Security Testing](#security-testing)
9. [Performance Testing](#performance-testing)
10. [Test Data & Demo Accounts](#test-data--demo-accounts)
11. [Reporting & Documentation](#reporting--documentation)

---

## Testing Overview

### Platform Architecture
Pitchey is a multi-portal movie pitch platform with three main user types:
- **Creators**: Create and manage movie pitches
- **Investors**: Browse and evaluate pitches, manage NDAs
- **Production Companies**: Advanced pitch management and collaboration

### Core Features to Test
- Authentication & Authorization
- Multi-portal access control
- Pitch creation, editing, and management
- NDA workflow and document management
- Real-time WebSocket communication
- File upload and media management
- Search and filtering
- Analytics and tracking
- Payment processing (Stripe integration)
- Email notifications
- Content management system

---

## Test Environment Setup

### Prerequisites
```bash
# Backend Configuration
PORT=8001 deno run --allow-all working-server.ts

# Frontend Configuration
cd frontend
npm run dev
```

### Environment Variables
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

### Demo Accounts (Password: Demo123)
- **Creator**: alex.creator@demo.com
- **Investor**: sarah.investor@demo.com  
- **Production**: stellar.production@demo.com

### Health Check Commands
```bash
# Backend Health Check
curl http://localhost:8001/health

# Frontend Health Check
curl http://localhost:5173

# Database Connection Test
curl http://localhost:8001/api/health/db

# WebSocket Connection Test
curl http://localhost:8001/api/health/websocket
```

---

## Portal Testing Guides

### Creator Portal Testing

#### Authentication Tests
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| CP-AUTH-001 | Valid login with alex.creator@demo.com | Successful login, redirect to dashboard | JWT token received, user data populated |
| CP-AUTH-002 | Invalid credentials | Login fails with error message | Error message displayed, no token |
| CP-AUTH-003 | Empty email/password | Validation error | Form validation triggers |
| CP-AUTH-004 | Account lockout after 5 failed attempts | Account temporarily locked | Lockout message shown |
| CP-AUTH-005 | Password reset flow | Email sent, reset successful | Reset link works, password updates |

#### Dashboard Functionality
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| CP-DASH-001 | View pitch statistics | Pitch count, views, likes displayed | Numbers match database |
| CP-DASH-002 | Recent activity feed | Latest pitch activities shown | Chronological order, accurate data |
| CP-DASH-003 | Quick actions (Create Pitch) | Navigation works | Redirects to pitch creation |
| CP-DASH-004 | Analytics overview | Charts and metrics visible | Data visualization works |

#### Pitch Management
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| CP-PITCH-001 | Create new pitch | Pitch creation form loads | All fields available |
| CP-PITCH-002 | Submit complete pitch | Pitch saved successfully | Database entry created |
| CP-PITCH-003 | Upload pitch deck PDF | File upload succeeds | File accessible via URL |
| CP-PITCH-004 | Upload video trailer | Video upload succeeds | Video playable |
| CP-PITCH-005 | Edit existing pitch | Changes saved | Database updated |
| CP-PITCH-006 | Delete pitch | Pitch removed | Cascade deletion works |
| CP-PITCH-007 | Set pitch visibility | Public/private toggle works | Access control enforced |

### Investor Portal Testing

#### Authentication & Access
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| IP-AUTH-001 | Login as investor | Access to investor dashboard | Role-specific content |
| IP-AUTH-002 | Access creator-only features | Access denied | 403 error returned |
| IP-AUTH-003 | Session timeout handling | Automatic logout | Session invalidated |

#### Pitch Browsing
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| IP-BROWSE-001 | View public pitches | Pitch listings displayed | Public pitches only |
| IP-BROWSE-002 | Filter by genre | Filtered results shown | Correct filtering |
| IP-BROWSE-003 | Search functionality | Search results accurate | Relevant matches |
| IP-BROWSE-004 | Pagination works | Navigate between pages | Correct page counts |
| IP-BROWSE-005 | Pitch detail view | Full pitch information | All fields populated |

#### NDA Management
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| IP-NDA-001 | Request NDA for pitch | NDA request created | Database entry exists |
| IP-NDA-002 | Sign NDA digitally | NDA marked as signed | Signature recorded |
| IP-NDA-003 | Access protected content | Content becomes visible | Access granted |
| IP-NDA-004 | View NDA history | All NDAs listed | Complete history shown |
| IP-NDA-005 | Download signed NDA | PDF download works | Valid document |

### Production Portal Testing

#### Company Management
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| PP-COMP-001 | Company profile setup | Profile saved | Company data stored |
| PP-COMP-002 | Team member invitation | Invitation sent | Email notification |
| PP-COMP-003 | Role assignment | Permissions applied | Access control works |
| PP-COMP-004 | Company verification | Verification process | Status updated |

#### Advanced Features
| Test ID | Test Case | Expected Result | Validation |
|---------|-----------|----------------|------------|
| PP-ADV-001 | Bulk NDA processing | Multiple NDAs signed | Batch operations |
| PP-ADV-002 | Advanced analytics | Detailed metrics | Rich data visualization |
| PP-ADV-003 | Collaboration tools | Team communication | Real-time updates |
| PP-ADV-004 | Project management | Task tracking | Status management |

---

## API Testing Guide

### Authentication Endpoints

#### POST /api/auth/creator/login
```bash
curl -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}'

# Expected Response (200)
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": 1,
      "email": "alex.creator@demo.com",
      "userType": "creator",
      "username": "alex_creator"
    }
  }
}

# Error Response (401)
{
  "success": false,
  "error": "Invalid credentials"
}
```

#### POST /api/auth/investor/login
```bash
curl -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}'
```

#### POST /api/auth/production/login
```bash
curl -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email": "stellar.production@demo.com", "password": "Demo123"}'
```

### Pitch Endpoints

#### GET /api/pitches (Public pitches)
```bash
curl http://localhost:8001/api/pitches

# Expected Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Sample Pitch",
      "logline": "A compelling story...",
      "genre": "Drama",
      "visibility": "public",
      "viewCount": 42,
      "likeCount": 7
    }
  ]
}
```

#### POST /api/pitches (Create pitch)
```bash
curl -X POST http://localhost:8001/api/pitches \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Pitch",
    "logline": "A test pitch for validation",
    "genre": "Action",
    "shortSynopsis": "Short description here",
    "visibility": "public"
  }'
```

#### GET /api/pitches/:id (Pitch details)
```bash
curl http://localhost:8001/api/pitches/1 \
  -H "Authorization: Bearer jwt-token"
```

#### PUT /api/pitches/:id (Update pitch)
```bash
curl -X PUT http://localhost:8001/api/pitches/1 \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
```

#### DELETE /api/pitches/:id (Delete pitch)
```bash
curl -X DELETE http://localhost:8001/api/pitches/1 \
  -H "Authorization: Bearer jwt-token"
```

### NDA Endpoints

#### POST /api/ndas/request (Request NDA)
```bash
curl -X POST http://localhost:8001/api/ndas/request \
  -H "Authorization: Bearer investor-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"pitchId": 1}'
```

#### POST /api/ndas/:id/sign (Sign NDA)
```bash
curl -X POST http://localhost:8001/api/ndas/1/sign \
  -H "Authorization: Bearer investor-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"signature": "John Doe", "signedAt": "2024-01-01T00:00:00Z"}'
```

#### GET /api/ndas (User's NDAs)
```bash
curl http://localhost:8001/api/ndas \
  -H "Authorization: Bearer jwt-token"
```

### File Upload Endpoints

#### POST /api/upload (Upload file)
```bash
curl -X POST http://localhost:8001/api/upload \
  -H "Authorization: Bearer jwt-token" \
  -F "file=@pitch-deck.pdf" \
  -F "type=pitch-deck"
```

### Analytics Endpoints

#### GET /api/analytics/dashboard (Dashboard metrics)
```bash
curl http://localhost:8001/api/analytics/dashboard \
  -H "Authorization: Bearer jwt-token"
```

#### POST /api/analytics/track (Track event)
```bash
curl -X POST http://localhost:8001/api/analytics/track \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"event": "pitch_view", "pitchId": 1}'
```

---

## UI Testing Checklist

### Navigation & Layout
- [ ] Portal selector page loads correctly
- [ ] Navigation menu displays appropriate options for user type
- [ ] Breadcrumb navigation works
- [ ] Logo links to homepage
- [ ] Footer links function
- [ ] Mobile responsive design
- [ ] Accessibility compliance (WCAG 2.1)

### Forms & Validation
- [ ] All form fields have proper labels
- [ ] Required field validation
- [ ] Email format validation
- [ ] Password strength requirements
- [ ] File upload restrictions (size, type)
- [ ] Form submission loading states
- [ ] Success/error message display
- [ ] Form data persistence on navigation

### Interactive Elements
- [ ] Buttons have hover/focus states
- [ ] Dropdown menus work correctly
- [ ] Modal dialogs open/close properly
- [ ] Tooltips display on hover
- [ ] Loading spinners show during API calls
- [ ] Infinite scroll (if implemented)
- [ ] Drag-and-drop functionality

### Content Display
- [ ] Pitch cards display all information
- [ ] Image/video thumbnails load
- [ ] Truncated text shows ellipsis
- [ ] Date formatting is consistent
- [ ] Number formatting (views, likes)
- [ ] Empty states display messages
- [ ] Error states show appropriate content

### Search & Filtering
- [ ] Search input accepts text
- [ ] Search results are relevant
- [ ] Filter checkboxes work
- [ ] Sort options function
- [ ] Clear filters button
- [ ] No results message
- [ ] Search suggestions (if implemented)

---

## WebSocket Testing

### Connection Testing
```bash
# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:8001/ws
```

### Real-time Features Test Cases

#### Live Notifications
| Test Case | Steps | Expected Result |
|-----------|-------|----------------|
| New pitch notification | 1. User A creates pitch<br>2. User B following User A | User B receives notification |
| NDA request notification | 1. Investor requests NDA<br>2. Creator should be notified | Creator receives real-time notification |
| Message notification | 1. Send direct message<br>2. Recipient online | Instant notification received |

#### Draft Auto-sync
| Test Case | Steps | Expected Result |
|-----------|-------|----------------|
| Pitch draft sync | 1. Start typing in pitch form<br>2. Wait 5 seconds | Draft saved automatically |
| Multi-tab sync | 1. Edit pitch in tab A<br>2. Open same pitch in tab B | Changes appear in tab B |
| Offline/online sync | 1. Go offline, make changes<br>2. Come back online | Changes sync when reconnected |

#### Live View Counter
| Test Case | Steps | Expected Result |
|-----------|-------|----------------|
| View count update | 1. User views pitch<br>2. Creator has pitch open | View count updates in real-time |
| Multiple viewers | 1. Multiple users view pitch | All view counts update correctly |

#### Presence Tracking
| Test Case | Steps | Expected Result |
|-----------|-------|----------------|
| Online status | 1. User logs in<br>2. Other users see status | Shows as "online" |
| Away status | 1. User inactive for 5 minutes | Status changes to "away" |
| Offline status | 1. User closes browser | Status changes to "offline" |

### WebSocket Message Types

#### Client → Server Messages
```javascript
// Connection authentication
{
  type: 'authenticate',
  token: 'jwt-token-here'
}

// Join room for real-time updates
{
  type: 'join_room',
  room: 'pitch_123'
}

// Send typing indicator
{
  type: 'typing',
  recipient: 456,
  isTyping: true
}

// Send message
{
  type: 'message',
  recipient: 456,
  content: 'Hello!'
}
```

#### Server → Client Messages
```javascript
// Authentication result
{
  type: 'auth_result',
  success: true,
  userId: 123
}

// Notification
{
  type: 'notification',
  title: 'New NDA Request',
  message: 'Someone requested access to your pitch',
  data: { pitchId: 123 }
}

// Live update
{
  type: 'live_update',
  event: 'pitch_viewed',
  pitchId: 123,
  viewCount: 45
}

// Heartbeat
{
  type: 'ping',
  timestamp: '2024-01-01T00:00:00Z'
}
```

---

## Database Testing

### Data Integrity Tests

#### User Management
```sql
-- Test user creation
INSERT INTO users (email, username, password_hash, user_type)
VALUES ('test@example.com', 'testuser', 'hashed_password', 'creator');

-- Verify constraints
INSERT INTO users (email, username, password_hash, user_type)
VALUES ('test@example.com', 'testuser2', 'hashed_password', 'creator');
-- Should fail due to unique email constraint

-- Test cascade deletion
DELETE FROM users WHERE id = 1;
-- Should cascade delete related pitches, ndas, etc.
```

#### Pitch Data
```sql
-- Test pitch creation
INSERT INTO pitches (user_id, title, logline, genre, visibility)
VALUES (1, 'Test Pitch', 'A test logline', 'Drama', 'public');

-- Test view tracking
INSERT INTO pitch_views (pitch_id, viewer_id, view_type)
VALUES (1, 2, 'full_view');

-- Verify view count updates
SELECT view_count FROM pitches WHERE id = 1;
```

#### NDA Workflow
```sql
-- Test NDA request
INSERT INTO ndas (pitch_id, requester_id, status)
VALUES (1, 2, 'pending');

-- Test NDA signing
UPDATE ndas SET 
  status = 'signed',
  signed_at = NOW(),
  signature = 'Digital Signature'
WHERE id = 1;

-- Verify access permissions
SELECT * FROM ndas 
WHERE pitch_id = 1 AND requester_id = 2 AND status = 'signed';
```

### Performance Tests

#### Query Optimization
```sql
-- Test pitch search performance
EXPLAIN ANALYZE
SELECT * FROM pitches 
WHERE title ILIKE '%action%' 
  AND genre IN ('Action', 'Thriller')
  AND visibility = 'public'
ORDER BY created_at DESC
LIMIT 20;

-- Test analytics aggregation
EXPLAIN ANALYZE
SELECT 
  DATE(created_at) as date,
  COUNT(*) as pitch_views
FROM pitch_views 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

#### Connection Pool Testing
```sql
-- Simulate concurrent connections
-- Run multiple concurrent queries to test connection handling
SELECT pg_stat_activity FROM pg_stat_activity;
```

### Data Migration Tests

#### Schema Changes
```sql
-- Test adding new column
ALTER TABLE pitches ADD COLUMN new_field VARCHAR(255);

-- Test data migration
UPDATE pitches SET new_field = 'default_value' WHERE new_field IS NULL;

-- Test removing column
ALTER TABLE pitches DROP COLUMN old_field;
```

---

## Security Testing

### Authentication Security

#### Password Security
| Test Case | Method | Expected Result |
|-----------|--------|----------------|
| Weak password rejection | Use password "123" | Registration fails |
| Password hashing | Check stored password | BCrypt hash stored |
| Password history | Change to previous password | Should be rejected |
| Account lockout | 5 failed login attempts | Account locked temporarily |

#### JWT Token Security
| Test Case | Method | Expected Result |
|-----------|--------|----------------|
| Token expiration | Use expired token | 401 Unauthorized |
| Token tampering | Modify token payload | 401 Unauthorized |
| Token without signature | Remove signature | 401 Unauthorized |
| Refresh token rotation | Use refresh token | New tokens issued |

### Authorization Testing

#### Role-Based Access Control
```bash
# Test creator accessing investor endpoint
curl http://localhost:8001/api/investor/dashboard \
  -H "Authorization: Bearer creator-token"
# Expected: 403 Forbidden

# Test accessing protected pitch
curl http://localhost:8001/api/pitches/1/protected \
  -H "Authorization: Bearer token-without-nda"
# Expected: 403 Forbidden or NDA required message
```

#### Resource Ownership
```bash
# Test editing another user's pitch
curl -X PUT http://localhost:8001/api/pitches/1 \
  -H "Authorization: Bearer different-user-token" \
  -d '{"title": "Hacked"}'
# Expected: 403 Forbidden
```

### Input Validation

#### SQL Injection Prevention
```bash
# Test SQL injection in search
curl "http://localhost:8001/api/pitches?search='; DROP TABLE pitches; --"
# Expected: Sanitized search, no SQL injection

# Test SQL injection in login
curl -X POST http://localhost:8001/api/auth/login \
  -d '{"email": "admin@example.com'\'' OR 1=1 --", "password": "any"}'
# Expected: Login fails, no injection
```

#### XSS Prevention
```bash
# Test XSS in pitch title
curl -X POST http://localhost:8001/api/pitches \
  -H "Authorization: Bearer token" \
  -d '{"title": "<script>alert(\"XSS\")</script>"}'
# Expected: Script tags escaped/sanitized
```

### File Upload Security
```bash
# Test malicious file upload
curl -X POST http://localhost:8001/api/upload \
  -H "Authorization: Bearer token" \
  -F "file=@malicious.php"
# Expected: File type rejected

# Test oversized file
curl -X POST http://localhost:8001/api/upload \
  -H "Authorization: Bearer token" \
  -F "file=@huge-file.pdf"
# Expected: File size limit exceeded error
```

---

## Performance Testing

### Load Testing

#### API Endpoint Load Tests
```bash
# Install apache bench for load testing
# Test login endpoint under load
ab -n 1000 -c 10 -p login-data.json -T 'application/json' \
   http://localhost:8001/api/auth/creator/login

# Test pitch listing under load
ab -n 1000 -c 20 http://localhost:8001/api/pitches

# Test WebSocket connections
# Use a WebSocket load testing tool
```

#### Database Performance
```sql
-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Check connection usage
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
```

### Memory and CPU Monitoring
```bash
# Monitor Deno process
top -p $(pgrep -f "deno.*working-server.ts")

# Monitor memory usage
ps aux | grep deno

# Check for memory leaks
# Run extended tests and monitor memory growth
```

---

## Test Data & Demo Accounts

### Demo Account Details

#### Creator Account
- **Email**: alex.creator@demo.com
- **Password**: Demo123
- **User ID**: 1
- **Features**: Create pitches, manage portfolio, view analytics
- **Test Pitches**: 3 sample pitches with different visibility levels

#### Investor Account  
- **Email**: sarah.investor@demo.com
- **Password**: Demo123
- **User ID**: 2
- **Features**: Browse pitches, request NDAs, manage watchlist
- **Test Data**: 5 NDA requests, 2 signed NDAs

#### Production Account
- **Email**: stellar.production@demo.com
- **Password**: Demo123
- **User ID**: 3
- **Features**: Advanced analytics, team management, bulk operations
- **Test Data**: Company profile, team members

### Test Data Generation

#### Sample Pitches
```javascript
const samplePitches = [
  {
    title: "The Digital Frontier",
    logline: "A tech entrepreneur discovers their AI creation has gained consciousness.",
    genre: "Science Fiction",
    visibility: "public",
    status: "active"
  },
  {
    title: "Mountain's Edge",
    logline: "A mountain rescue team faces their biggest challenge when avalanche season arrives early.",
    genre: "Action",
    visibility: "private",
    status: "active"
  },
  {
    title: "The Last Gallery",
    logline: "An art curator races to save priceless paintings from a war-torn city.",
    genre: "Drama",
    visibility: "public",
    status: "active"
  }
];
```

#### Test File Uploads
```bash
# Generate test files for upload testing
mkdir test-files

# Create test PDF (pitch deck)
echo "Sample pitch deck content" > test-files/pitch-deck.pdf

# Create test video file (trailer)
# Use ffmpeg to create a small test video
ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=1 -f mp4 test-files/trailer.mp4

# Create test image (poster)
# Create a simple test image
convert -size 300x400 xc:blue test-files/poster.jpg
```

---

## Reporting & Documentation

### Test Report Template

#### Executive Summary
- Total tests executed: X
- Pass rate: Y%
- Critical issues: Z
- Test environment: Local/Staging/Production
- Test duration: Start - End time

#### Test Categories
1. **Functional Testing**
   - Portal functionality: Pass/Fail
   - API endpoints: Pass/Fail
   - Database operations: Pass/Fail

2. **Non-Functional Testing**
   - Performance: Pass/Fail
   - Security: Pass/Fail
   - Accessibility: Pass/Fail

3. **Integration Testing**
   - Frontend-Backend integration: Pass/Fail
   - WebSocket communication: Pass/Fail
   - Third-party services: Pass/Fail

#### Issues Found
| Severity | Issue | Description | Steps to Reproduce | Status |
|----------|-------|-------------|-------------------|---------|
| Critical | Login failure | Users cannot login | 1. Navigate to login... | Open |
| High | Data corruption | Pitch data lost | 1. Create pitch... | Fixed |
| Medium | UI glitch | Button misaligned | 1. Open dashboard... | Open |

#### Recommendations
1. Fix all critical and high severity issues before release
2. Implement additional automated tests for regression prevention
3. Enhance error handling and user feedback
4. Performance optimization for database queries

### Automated Test Reports

#### Test Coverage Report
```bash
# Generate coverage report (if using test framework)
deno test --coverage=coverage
deno coverage coverage --lcov --output=coverage.lcov
```

#### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: QA Testing
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Deno
        uses: denoland/setup-deno@v1
      - name: Run API Tests
        run: deno test api-tests/
      - name: Run Integration Tests
        run: ./test-all-portals.sh
      - name: Generate Report
        run: ./generate-test-report.sh
```

---

## Test Execution Commands

### Quick Smoke Tests
```bash
# Basic functionality check
./quick-test.sh

# All portal authentication
./test-all-portals.sh

# API endpoint testing
./test-all-endpoints.sh
```

### Comprehensive Testing
```bash
# Full test suite (all categories)
./comprehensive-test-suite.sh

# Specific feature testing
./test-nda-workflow.sh
./test-websocket-integration.sh
./test-security-workflows.sh
```

### Performance Testing
```bash
# Load testing
./test-performance-load.sh

# Database performance
./test-database-performance.sh
```

### Automated Monitoring
```bash
# Set up continuous monitoring
./setup-monitoring.sh

# Run health checks
./health-check.sh
```

---

This comprehensive testing guide provides QA teams with detailed test cases, validation criteria, and execution procedures for the complete Pitchey platform. Each section includes specific test data, expected results, and validation methods to ensure thorough platform testing.