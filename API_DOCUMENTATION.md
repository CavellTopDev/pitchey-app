# Pitchey API Documentation

## Base URL
- **Production**: `https://pitchey-optimized.cavelltheleaddev.workers.dev`
- **Frontend**: `https://pitchey.pages.dev`

## Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Available Endpoints

### 🔐 Authentication Endpoints

#### Creator Login
```http
POST /api/auth/creator/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}

Response:
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": { ... }
  },
  "message": "Creator login successful"
}
```

#### Investor Login
```http
POST /api/auth/investor/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

#### Production Login
```http
POST /api/auth/production/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

#### Creator Registration
```http
POST /api/auth/creator/register
Content-Type: application/json

{
  "email": "string",
  "username": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "companyName": "string",
  "bio": "string",
  "location": "string"
}
```

#### Investor Registration
```http
POST /api/auth/investor/register
Content-Type: application/json

{
  "email": "string",
  "username": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "companyName": "string",
  "bio": "string",
  "location": "string"
}
```

#### Production Registration
```http
POST /api/auth/production/register
Content-Type: application/json

{
  "email": "string",
  "username": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "companyName": "string",
  "bio": "string",
  "location": "string"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### 🎬 Pitch Management

#### Create Pitch
```http
POST /api/pitches
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "string",
  "genre": "string",
  "format": "string",
  "logline": "string",
  "target_audience": "string",
  "budget": number
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "title": "string",
    "genre": "string",
    "format": "string",
    "status": "draft",
    "created_at": "2025-11-24T..."
  },
  "message": "Pitch created successfully"
}
```

#### Update Pitch
```http
PUT /api/pitches/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "string",
  "genre": "string",
  "format": "string",
  "logline": "string",
  "target_audience": "string",
  "budget": number,
  "status": "public|draft"
}
```

#### Delete Pitch
```http
DELETE /api/pitches/{id}
Authorization: Bearer <token>
```

#### Get My Pitches
```http
GET /api/pitches/my
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "string",
      "genre": "string",
      "view_count": 0,
      "nda_count": 0
    }
  ]
}
```

#### Get Public Pitches
```http
GET /api/pitches/public

Response:
{
  "success": true,
  "data": [...]
}
```

#### Get Single Public Pitch
```http
GET /api/pitches/public/{id}
```

#### Browse Pitches (Enhanced)
```http
GET /api/pitches/browse/enhanced?genre=Sci-Fi&format=Feature+Film&sort=date&order=desc&limit=24&offset=0
```

#### Browse Pitches (General)
```http
GET /api/pitches/browse/general?genre=Drama&sort=views&limit=24
```

#### Get Trending Pitches
```http
GET /api/pitches/trending
```

#### Get New Pitches
```http
GET /api/pitches/new
```

### 📄 NDA Management

#### Request NDA
```http
POST /api/ndas/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "pitchId": 1,
  "message": "string"
}
```

#### Sign NDA
```http
POST /api/ndas/{id}/sign
Authorization: Bearer <token>
Content-Type: application/json

{
  "signature": "string"
}
```

#### Approve NDA
```http
POST /api/ndas/{id}/approve
Authorization: Bearer <token>
```

#### Reject NDA
```http
POST /api/ndas/{id}/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "string"
}
```

#### Revoke NDA
```http
POST /api/ndas/{id}/revoke
Authorization: Bearer <token>
```

#### Get NDA Details
```http
GET /api/ndas/{id}
Authorization: Bearer <token>
```

#### Get All NDAs
```http
GET /api/ndas
Authorization: Bearer <token>
```

#### Check NDA Status for Pitch
```http
GET /api/ndas/pitch/{pitchId}/status
Authorization: Bearer <token>
```

#### Get NDA History
```http
GET /api/ndas/history
Authorization: Bearer <token>
```

#### Download Signed NDA
```http
GET /api/ndas/{id}/download-signed
Authorization: Bearer <token>
```

#### Preview NDA
```http
POST /api/ndas/preview
Authorization: Bearer <token>
Content-Type: application/json

{
  "pitchId": 1
}
```

#### Get NDA Templates
```http
GET /api/ndas/templates
```

#### Get NDA Template by ID
```http
GET /api/ndas/templates/{id}
```

#### Get NDA Stats
```http
GET /api/ndas/stats
Authorization: Bearer <token>
```

#### Get NDA Stats for Pitch
```http
GET /api/ndas/stats/{pitchId}
Authorization: Bearer <token>
```

#### Check If Can Request NDA
```http
GET /api/ndas/pitch/{pitchId}/can-request
Authorization: Bearer <token>
```

#### Bulk Approve NDAs
```http
POST /api/ndas/bulk-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "ndaIds": [1, 2, 3]
}
```

#### Bulk Reject NDAs
```http
POST /api/ndas/bulk-reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "ndaIds": [1, 2, 3],
  "reason": "string"
}
```

#### Send NDA Reminder
```http
POST /api/ndas/{id}/remind
Authorization: Bearer <token>
```

#### Verify NDA
```http
GET /api/ndas/{id}/verify
```

#### Get Pending NDAs
```http
GET /api/nda/pending
Authorization: Bearer <token>
```

#### Get Active NDAs
```http
GET /api/nda/active
Authorization: Bearer <token>
```

### 👤 User Management

#### Get Profile
```http
GET /api/profile
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "string",
  "lastName": "string",
  "bio": "string",
  "location": "string",
  "companyName": "string",
  "profileImage": "string"
}
```

#### Get Notifications
```http
GET /api/user/notifications
Authorization: Bearer <token>
```

#### Get Unread Notifications
```http
GET /api/notifications/unread
Authorization: Bearer <token>
```

#### Search Users
```http
GET /api/search/users?q=searchterm&type=creator|investor|production
```

### 👥 Follow System

#### Follow User
```http
POST /api/follows/follow
Authorization: Bearer <token>
Content-Type: application/json

{
  "followingId": 1
}
```

#### Unfollow User
```http
POST /api/follows/unfollow
Authorization: Bearer <token>
Content-Type: application/json

{
  "followingId": 1
}
```

#### Get Follow Stats
```http
GET /api/follows/stats/{userId}
```

#### Get Follow Suggestions
```http
GET /api/follows/suggestions
Authorization: Bearer <token>
```

#### Get Followers
```http
GET /api/follows/followers
Authorization: Bearer <token>
```

#### Get Following
```http
GET /api/follows/following
Authorization: Bearer <token>
```

#### Get Mutual Follows
```http
GET /api/follows/mutual/{userId}
Authorization: Bearer <token>
```

### 💰 Investment & Funding

#### Get Investor Portfolio Summary
```http
GET /api/investor/portfolio/summary
Authorization: Bearer <token>
```

#### Get Investor Investments
```http
GET /api/investor/investments
Authorization: Bearer <token>
```

#### Get Investment Recommendations
```http
GET /api/investment/recommendations
Authorization: Bearer <token>
```

#### Get Creator Funding Overview
```http
GET /api/creator/funding/overview
Authorization: Bearer <token>
```

#### Get Creator's Investors
```http
GET /api/creator/investors
Authorization: Bearer <token>
```

#### Get Production Investments Overview
```http
GET /api/production/investments/overview
Authorization: Bearer <token>
```

#### Create Investment
```http
POST /api/investments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "pitchId": 1,
  "amount": 100000,
  "terms": "string",
  "message": "string"
}
```

#### Update Investment
```http
POST /api/investments/{id}/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 150000,
  "status": "string"
}
```

#### Get Investment Details
```http
GET /api/investments/{id}/details
Authorization: Bearer <token>
```

#### Get Portfolio Analytics
```http
GET /api/investor/portfolio/analytics
Authorization: Bearer <token>
```

### 📊 Analytics

#### Get User Analytics
```http
GET /api/analytics/user
Authorization: Bearer <token>
```

#### Get Dashboard Analytics
```http
GET /api/analytics/dashboard
Authorization: Bearer <token>
```

#### Get Pitch Analytics
```http
GET /api/analytics/pitch/{id}
Authorization: Bearer <token>
```

#### Get Activity Analytics
```http
GET /api/analytics/activity
Authorization: Bearer <token>
```

#### Track Analytics Event
```http
POST /api/analytics/track
Authorization: Bearer <token>
Content-Type: application/json

{
  "event": "string",
  "properties": {}
}
```

#### Export Analytics
```http
POST /api/analytics/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "csv|json",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  }
}
```

#### Compare Analytics
```http
GET /api/analytics/compare/{type}
Authorization: Bearer <token>
```

#### Get Trending Analytics
```http
GET /api/analytics/trending
Authorization: Bearer <token>
```

#### Get Engagement Analytics
```http
GET /api/analytics/engagement
Authorization: Bearer <token>
```

#### Get Funnel Analytics
```http
GET /api/analytics/funnel/{id}
Authorization: Bearer <token>
```

### 💳 Payments

#### Get Credits Balance
```http
GET /api/payments/credits/balance
Authorization: Bearer <token>
```

#### Get Subscription Status
```http
GET /api/payments/subscription-status
Authorization: Bearer <token>
```

### 📱 Real-time Features

#### WebSocket Connection
```
wss://pitchey-optimized.cavelltheleaddev.workers.dev/ws
```

#### Get Online Presence
```http
GET /api/presence/online
Authorization: Bearer <token>
```

#### Update Presence
```http
POST /api/presence/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "online|away|offline"
}
```

#### Test WebSocket
```http
GET /api/websocket/test
```

### 📤 File Upload

#### Upload File
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- file: <file>
- type: "document|image|video"

Response:
{
  "success": true,
  "data": {
    "url": "string",
    "filename": "string",
    "type": "string",
    "size": number
  },
  "message": "File uploaded successfully"
}
```

### 📋 Content Pages

#### Get About Content
```http
GET /api/content/about
```

#### Get How It Works Content
```http
GET /api/content/how-it-works
```

#### Get Team Content
```http
GET /api/content/team
```

#### Get Stats Content
```http
GET /api/content/stats
```

### 🏢 Dashboards

#### Get Creator Dashboard
```http
GET /api/creator/dashboard
Authorization: Bearer <token>
```

#### Get Activity Feed
```http
GET /api/activity/feed
Authorization: Bearer <token>
```

### 🧪 Testing Endpoints

#### Health Check
```http
GET /api/health

Response:
{
  "success": true,
  "message": "Pitchey API - Direct endpoints active",
  "architecture": "simplified",
  "services": {...},
  "timestamp": "2025-11-24T..."
}
```

#### Simple Test
```http
GET /api/simple-test
```

#### Database Test
```http
GET /api/db-test
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting:
- **Authenticated requests**: 100 requests per minute
- **Unauthenticated requests**: 20 requests per minute

## CORS

The API supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Demo Accounts

For testing purposes, use these demo accounts (password: `Demo123`):

- **Creator**: alex.creator@demo.com
- **Investor**: sarah.investor@demo.com
- **Production**: stellar.production@demo.com

## Deployment Information

- **Platform**: Cloudflare Workers
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis
- **Storage**: Cloudflare R2
- **WebSockets**: Cloudflare Durable Objects

## Environment Variables Required

```env
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://...
SENTRY_DSN=https://...
CACHE_ENABLED=true
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
FRONTEND_URL=https://pitchey.pages.dev
```

## Recent Updates (November 2025)

### New Endpoints Added
- ✅ Complete pitch CRUD operations
- ✅ User registration for all portals
- ✅ File upload to R2 storage
- ✅ User profile management
- ✅ User notifications system
- ✅ User search functionality

### Migration from Deno to Cloudflare
- All endpoints migrated to Cloudflare Workers
- Direct database connections (Hyperdrive bypassed due to 530 errors)
- Optimized for edge performance
- WebSocket support via Durable Objects

### Known Limitations
- Hyperdrive connection pooling temporarily disabled
- Some columns in pitches table may vary (tagline, synopsis not available)
- File uploads use fallback URL in development mode

## Support

For issues or questions:
- GitHub Issues: https://github.com/pitchey/api/issues
- Documentation: This file
- Health Check: https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health