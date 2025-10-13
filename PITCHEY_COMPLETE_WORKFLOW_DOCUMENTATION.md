# Pitchey Platform - Complete Workflow Documentation

## System Overview

Pitchey is a comprehensive movie pitch platform that connects creators, investors, and production companies through three distinct portals. The platform features real-time WebSocket communication, Redis-powered caching, comprehensive NDA workflows, and sophisticated analytics.

### Architecture Summary
- **Backend**: Deno/TypeScript server on port 8001
- **Frontend**: React/TypeScript with Vite dev server
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket connections
- **Caching**: Redis (optional)
- **Authentication**: JWT-based with portal-specific flows

---

## Demo Credentials

| Portal | Email | Password | Description |
|--------|-------|----------|-------------|
| Creator | alex.creator@demo.com | Demo123 | Content creator account |
| Investor | sarah.investor@demo.com | Demo123 | Investment professional |
| Production | stellar.production@demo.com | Demo123 | Production company |

---

## 1. Portal Selection & Authentication Workflows

### 1.1 Portal Selection Flow
**Entry Point**: `/portal-select`

1. User visits homepage
2. Clicks "Choose Your Portal"
3. Presented with three portal options:
   - **Creator Portal**: Submit and manage movie pitches
   - **Investor Portal**: Discover and invest in projects
   - **Production Portal**: Find and develop content
4. Selection routes to appropriate login page

### 1.2 Authentication Endpoints

#### Backend Authentication Routes
```
POST /api/auth/creator/login
POST /api/auth/investor/login  
POST /api/auth/production/login

POST /api/auth/creator/register
POST /api/auth/investor/register
POST /api/auth/production/register

POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/verify-email
```

#### Authentication Flow
1. User selects portal type
2. Enters credentials on portal-specific login page
3. Backend validates credentials and user type
4. JWT token issued and stored in localStorage
5. User redirected to appropriate dashboard
6. Token validated on subsequent requests

---

## 2. Creator Portal Workflows

### 2.1 Creator Dashboard
**Route**: `/creator/dashboard`
**API**: `GET /api/creator/dashboard`

#### Dashboard Components
- **Statistics**: Total pitches, active pitches, views, ratings, followers
- **Milestones**: Achievement tracking (first pitch, 100 views, 10 followers, 4.0 rating)
- **Recent Activity**: View history, messages, follower updates
- **Quick Actions**: Upload pitch, manage pitches, analytics, NDA management
- **Subscription Status**: Current plan, credits remaining

### 2.2 Pitch Creation Workflow
**Route**: `/creator/pitch/new`
**API**: `POST /api/creator/pitches`

#### Pitch Creation Steps
1. **Basic Information**
   - Title, logline, genre selection
   - Format (feature, TV, short, web series)
   - Target audience

2. **Content Details**
   - Short synopsis (< 500 characters)
   - Long synopsis (detailed story)
   - Character descriptions
   - Themes and tone

3. **Production Information**
   - Budget bracket selection
   - Estimated budget (optional)
   - Production timeline
   - AI usage disclosure

4. **Media Assets**
   - Title image/poster
   - Pitch deck (PDF)
   - Script upload
   - Trailer/video content
   - Lookbook materials

5. **Visibility Settings**
   - Public/private status
   - NDA requirements
   - Element visibility controls

6. **Final Review & Publish**
   - Preview pitch display
   - Save as draft or publish

#### Supported Formats
- **Features**: Traditional theatrical films
- **TV Series**: Episodic content with season arcs
- **Short Films**: Under 40 minutes
- **Web Series**: Digital-first episodic content
- **Documentaries**: Non-fiction content

#### Supported Genres
Drama, Comedy, Thriller, Horror, Sci-Fi, Fantasy, Action, Romance, Animation, Documentary

### 2.3 Pitch Management Workflow
**Route**: `/creator/pitches`
**API**: `GET /api/creator/pitches`

#### Management Functions
- **View All Pitches**: Grid/list view with filters
- **Edit Pitches**: Update content, media, settings
- **Analytics**: View counts, engagement metrics, demographic data
- **Status Management**: Draft → Published → Archived
- **Deletion**: Remove pitches (with dependency checks)

### 2.4 NDA Management Workflow
**Route**: `/creator/ndas`
**APIs**: 
- `GET /api/ndas/incoming-requests` - Pending NDA requests
- `POST /api/ndas/{id}/approve` - Approve NDA
- `POST /api/ndas/{id}/reject` - Reject NDA

#### NDA Process for Creators
1. **Incoming Requests**: View NDA requests from investors/productions
2. **Request Details**: See requester info, company details, purpose
3. **Approval/Rejection**: 
   - Approve: Generate signed NDA document
   - Reject: Provide reason for rejection
4. **Active NDAs**: Monitor signed agreements
5. **Template Management**: Create custom NDA templates

### 2.5 Creator Analytics
**Route**: `/creator/analytics`
**API**: `GET /api/creator/analytics`

#### Analytics Features
- **View Metrics**: Total views, unique visitors, view duration
- **Engagement**: Likes, saves, follow conversions
- **Demographics**: Geographic distribution, user types
- **Performance**: Top-performing pitches, trending content
- **Time-based**: Daily/weekly/monthly trends

### 2.6 Social Features
**Following System**:
- `GET /api/follows/followers` - View followers
- `GET /api/follows/following` - View followed creators
- `POST /api/follows/follow` - Follow another creator
- `DELETE /api/follows/unfollow` - Unfollow

**Portfolio**:
- **Route**: `/creator/portfolio`
- Public-facing creator profile
- Showcase of published pitches
- Bio, company information
- Contact and social links

---

## 3. Investor Portal Workflows

### 3.1 Investor Dashboard
**Route**: `/investor/dashboard`
**API**: `GET /api/investor/dashboard`

#### Dashboard Components
- **Portfolio Overview**: Total investments, active deals, ROI
- **Investment Pipeline**: Pitches under review, due diligence status
- **Following Activity**: Updates from followed creators
- **AI Recommendations**: Machine learning-based suggestions
- **Performance Metrics**: Monthly/quarterly/YTD returns

### 3.2 Pitch Discovery
**Route**: `/investor/browse`
**API**: `GET /api/pitches/public`

#### Discovery Features
- **Search & Filters**: Genre, budget range, format, status
- **Trending Content**: Most viewed/liked pitches
- **New Releases**: Recently published pitches
- **Advanced Search**: Multiple criteria combinations
- **Saved Searches**: Store filter combinations

#### Search Parameters
```javascript
{
  genre: string,
  format: string,
  budgetMin: number,
  budgetMax: number,
  search: string,
  page: number,
  limit: number
}
```

### 3.3 Pitch Evaluation Workflow
**Route**: `/investor/pitch/{id}`
**API**: `GET /api/pitches/{id}`

#### Evaluation Process
1. **Initial Review**: Read logline, synopsis, view materials
2. **NDA Process**: Request NDA if required for full access
3. **Due Diligence**: Access detailed financials, scripts, business plans
4. **Interest Expression**: Save to watchlist, contact creator
5. **Investment Decision**: Make formal offer (future feature)

### 3.4 NDA Request Workflow
**APIs**:
- `GET /api/ndas/pitch/{id}/can-request` - Check eligibility
- `POST /api/ndas/request` - Submit NDA request
- `GET /api/ndas/outgoing-requests` - Track sent requests

#### NDA Request Process
1. **Eligibility Check**: Verify can request NDA for pitch
2. **Request Form**: Company info, investment purpose, contact details
3. **Submission**: Send request to creator
4. **Tracking**: Monitor request status (pending/approved/rejected)
5. **Document Signing**: E-sign approved NDA
6. **Content Access**: Gain access to protected materials

### 3.5 Portfolio Management
**Route**: `/investor/portfolio`
**APIs**: 
- `GET /api/investor/portfolio/summary`
- `GET /api/investor/portfolio/performance`

#### Portfolio Features
- **Investment Tracking**: Current positions, cost basis
- **Performance Analytics**: ROI calculations, benchmarking
- **Pipeline Management**: Deals in progress
- **Document Storage**: NDAs, investment agreements
- **Reporting**: Generate investment reports

### 3.6 Following System
**Route**: `/investor/following`
**API**: `GET /api/follows/following`

#### Following Features
- **Creator Following**: Track favorite creators
- **Activity Feed**: Updates from followed creators
- **New Pitch Notifications**: Real-time alerts
- **Batch Management**: Follow/unfollow multiple creators

---

## 4. Production Portal Workflows

### 4.1 Production Dashboard
**Route**: `/production/dashboard`
**API**: `GET /api/production/dashboard`

#### Dashboard Components
- **Project Pipeline**: Active developments, pre-production
- **Talent Pool**: Connected creators and key personnel
- **Industry Metrics**: Market trends, genre performance
- **Calendar Integration**: Meeting scheduling, deadlines
- **Resource Management**: Budget allocation, crew scheduling

### 4.2 Content Discovery
**Route**: `/production/browse`
**Similar to investor browse with production-focused filters**

#### Production-Specific Filters
- **Development Stage**: Script ready, pre-production, financing needed
- **Genre Specialization**: Match production company expertise
- **Budget Alignment**: Match production capabilities
- **Talent Attached**: Known actors, directors, key crew

### 4.3 Project Development Workflow
**Route**: `/production/projects`
**APIs**: 
- `GET /api/production/projects`
- `POST /api/production/offers`

#### Development Process
1. **Content Identification**: Discover suitable pitches
2. **Initial Contact**: Reach out to creators
3. **Option Negotiation**: Secure development rights
4. **Development Phase**: Script development, packaging
5. **Financing**: Secure production funding
6. **Pre-production**: Crew hiring, location scouting
7. **Production**: Filming and post-production

### 4.4 Offer Management
**APIs**:
- `POST /api/production/offers` - Submit development offer
- `GET /api/production/offers` - Track sent offers

#### Offer Types
- **Option Agreement**: Exclusive development rights
- **Development Deal**: Funded script development
- **Production Agreement**: Full financing commitment
- **Distribution Deal**: Release and marketing rights

### 4.5 Team Management
**Route**: `/production/team`
**API**: `GET /api/production/team`

#### Team Features
- **Crew Database**: Director, producer, key personnel contacts
- **Availability Tracking**: Schedule coordination
- **Project Assignment**: Role allocation across projects
- **Performance Metrics**: Team efficiency, delivery tracking

---

## 5. Cross-Portal Features

### 5.1 Messaging System
**Routes**: `/messages`, `/creator/messages`, `/investor/messages`, `/production/messages`
**APIs**: 
- `GET /api/messages/conversations`
- `POST /api/messages`
- `WebSocket /api/messages/ws`

#### Messaging Features
- **Real-time Chat**: WebSocket-powered instant messaging
- **Conversation Threading**: Organized by pitch/project
- **File Attachments**: Documents, images, videos
- **Message Status**: Read receipts, typing indicators
- **Archive/Mute**: Conversation management
- **Search**: Message content search across conversations

### 5.2 Analytics & Tracking
**APIs**:
- `POST /api/analytics/track-view` - Track pitch views
- `POST /api/analytics/track-engagement` - Track user interactions
- `GET /api/analytics/dashboard` - Aggregated metrics

#### Tracked Events
- **Page Views**: Pitch detail page visits
- **Engagement**: Likes, saves, follows, messages
- **Conversion**: NDA requests, investment interest
- **User Journey**: Path analysis, drop-off points
- **Performance**: Load times, error rates

### 5.3 Search & Discovery
**APIs**:
- `GET /api/search/advanced` - Multi-criteria search
- `GET /api/search/suggestions` - Auto-complete suggestions
- `POST /api/search/saved` - Save search criteria

#### Search Capabilities
- **Full-text Search**: Title, logline, synopsis, creator name
- **Faceted Filters**: Genre, format, budget, status combinations
- **Saved Searches**: Persistent filter sets with alerts
- **Auto-complete**: Smart suggestions as user types
- **Search Analytics**: Popular search terms, zero-result queries

### 5.4 Notification System
**APIs**:
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/read` - Mark as read
- `WebSocket` - Real-time notification delivery

#### Notification Types
- **Pitch Activity**: New views, likes, follows
- **NDA Updates**: Request approvals, rejections, expirations
- **Messages**: New conversations, unread messages
- **Investment**: New opportunities, portfolio updates
- **System**: Maintenance, feature announcements

---

## 6. Database Schema & Data Flow

### 6.1 Core Tables
- **users**: All user accounts across portals
- **pitches**: Pitch content and metadata
- **ndas**: NDA requests and approvals
- **messages**: Communication system
- **follows**: Social following relationships
- **analytics_events**: User interaction tracking
- **notifications**: In-app notification system

### 6.2 User Types
```sql
user_type ENUM: 'creator', 'investor', 'production', 'admin'
```

### 6.3 Pitch Status Flow
```
draft → published → archived
       ↓
   under_review (for featured content)
```

### 6.4 NDA Status Flow
```
pending → approved → signed
        ↓
      rejected
        ↓
      expired
        ↓
      revoked
```

---

## 7. API Endpoint Reference

### 7.1 Authentication Endpoints
```
POST /api/auth/{portal}/login       - Portal-specific login
POST /api/auth/{portal}/register    - Portal-specific registration
GET  /api/auth/validate-token       - Token validation
POST /api/auth/refresh-token        - Token refresh
POST /api/auth/logout               - User logout
```

### 7.2 Pitch Management
```
GET    /api/pitches/public          - Public pitch listing
GET    /api/pitches/trending        - Trending pitches
GET    /api/pitches/new             - Recently published
GET    /api/pitches/{id}            - Single pitch details
POST   /api/creator/pitches         - Create new pitch
GET    /api/creator/pitches         - Creator's pitches
PUT    /api/creator/pitches/{id}    - Update pitch
DELETE /api/creator/pitches/{id}    - Delete pitch
```

### 7.3 NDA Management
```
POST /api/ndas/request              - Request NDA
GET  /api/ndas/incoming-requests    - Creator's incoming requests
GET  /api/ndas/outgoing-requests    - User's sent requests
POST /api/ndas/{id}/approve         - Approve NDA request
POST /api/ndas/{id}/reject          - Reject NDA request
POST /api/ndas/{id}/sign            - Sign approved NDA
GET  /api/ndas/signed               - Signed NDAs
```

### 7.4 Social Features
```
POST   /api/follows/follow          - Follow user/creator
DELETE /api/follows/unfollow        - Unfollow user
GET    /api/follows/followers       - Get followers
GET    /api/follows/following       - Get following
GET    /api/watchlist               - Saved pitches
POST   /api/watchlist               - Save pitch
DELETE /api/watchlist/{id}          - Remove from watchlist
```

### 7.5 Messaging
```
GET  /api/messages/conversations    - List conversations
POST /api/messages                  - Send message
GET  /api/messages/{id}/messages    - Conversation messages
POST /api/messages/{id}/read        - Mark as read
WS   /api/messages/ws               - WebSocket connection
```

### 7.6 Analytics
```
POST /api/analytics/track-view      - Track pitch view
POST /api/analytics/track-engagement - Track user action
GET  /api/analytics/dashboard       - Dashboard metrics
GET  /api/analytics/pitch/{id}      - Pitch-specific analytics
```

---

## 8. Testing Scenarios

### 8.1 Creator Journey Test
1. Register as creator → Login → Create pitch
2. Upload media assets → Set NDA requirements → Publish
3. Receive NDA request → Approve/reject → Monitor analytics
4. Respond to investor messages → Update pitch content

### 8.2 Investor Journey Test
1. Register as investor → Login → Browse pitches
2. Save interesting pitches → Request NDA → Sign agreement
3. Access full materials → Contact creator → Express interest
4. Follow creators → Receive activity updates

### 8.3 Production Journey Test
1. Register as production → Login → Discover content
2. Identify development opportunities → Contact creators
3. Negotiate option agreements → Track development pipeline
4. Manage team assignments → Monitor project progress

### 8.4 Cross-Portal Integration Test
1. Creator publishes pitch → Investor receives recommendation
2. Investor requests NDA → Creator receives notification
3. NDA approved → Investor gains access → Analytics updated
4. Investor messages creator → Real-time delivery
5. Production company discovers pitch → Sends development offer

---

## 9. WebSocket Events

### 9.1 Real-time Features
- **Message Delivery**: Instant chat across portals
- **Notification Push**: Real-time alerts for all activities
- **Presence Tracking**: Online/offline/away status
- **Draft Sync**: Auto-save pitch drafts every 5 seconds
- **Live Metrics**: Real-time view count updates
- **Typing Indicators**: Show when users are composing messages

### 9.2 WebSocket Event Types
```javascript
// Connection events
ws_connection_established
ws_connection_lost
ws_presence_changed

// Messaging events
ws_message_sent
ws_message_received
ws_typing_indicator

// Activity events
ws_pitch_view
ws_user_activity
ws_notification_read

// System events
ws_server_broadcast
ws_maintenance_mode
```

---

## 10. Business Rules & Validation

### 10.1 NDA Business Rules
- Users cannot request NDA for their own pitches
- Only one active NDA request per user per pitch
- Creators can revoke NDA access at any time
- NDAs expire after specified duration (default 1 year)
- Signed NDAs required for access to protected content

### 10.2 Pitch Visibility Rules
- Draft pitches visible only to creator
- Published pitches visible based on NDA requirements
- Archived pitches remain accessible to those with NDAs
- Public pitches accessible without authentication

### 10.3 Messaging Rules
- Messages only between users with established relationship
- NDA-protected communications for sensitive content
- Message retention for legal compliance
- Block/report functionality for abuse prevention

### 10.4 Portfolio Access Rules
- Creators: Full access to own content and analytics
- Investors: Access based on NDA status and agreements
- Productions: Access based on option/development agreements
- Public: Limited access to published, non-NDA content

---

## 11. Error Handling & Edge Cases

### 11.1 Authentication Errors
- Invalid credentials → Clear error message
- Expired tokens → Automatic refresh attempt
- Portal mismatch → Redirect to correct login
- Account suspension → Admin contact information

### 11.2 NDA Workflow Errors
- Duplicate requests → Show existing request status
- Expired NDAs → Prompt for renewal
- Invalid signatures → Re-signature required
- Template errors → Fallback to default template

### 11.3 File Upload Errors
- Size limits → Clear size requirements
- Format restrictions → Supported format list
- Upload failures → Retry mechanism
- Corrupted files → Validation and error reporting

### 11.4 Real-time Communication Errors
- WebSocket disconnection → Automatic reconnection
- Message delivery failures → Retry queue
- Offline message handling → Store and forward
- Connection timeouts → Progressive backoff

---

## 12. Performance & Scalability

### 12.1 Caching Strategy
- **Redis Caching**: Dashboard data (5-minute TTL)
- **Browser Caching**: Static assets, images
- **API Response Caching**: Public pitch listings
- **Database Query Optimization**: Indexed searches

### 12.2 File Storage
- **Media Assets**: Cloud storage (AWS S3/CloudFlare)
- **Document Storage**: Encrypted storage for NDAs
- **Backup Strategy**: Multi-region replication
- **CDN Distribution**: Global content delivery

### 12.3 Database Optimization
- **Connection Pooling**: Drizzle ORM connection management
- **Query Optimization**: Indexed searches, pagination
- **Analytics Aggregation**: Pre-computed metrics
- **Data Retention**: Automated cleanup policies

---

This comprehensive documentation covers all three portals, their workflows, API endpoints, and integration points. The platform supports the complete lifecycle from content creation through investment and production development, with robust real-time features and comprehensive analytics throughout.