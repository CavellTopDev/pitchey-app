# Pitchey Platform - API Endpoints Documentation

**Last Updated**: December 10, 2024  
**Backend**: Cloudflare Workers with Neon PostgreSQL  
**Status**: Production Ready

## 🔐 Authentication Endpoints

### Login Endpoints (Portal-Specific)
- `POST /api/auth/creator/login` - Creator portal login
- `POST /api/auth/investor/login` - Investor portal login  
- `POST /api/auth/production/login` - Production company login
- `POST /api/auth/admin/login` - Admin portal login

### Registration Endpoints
- `POST /api/auth/creator/register` - Creator registration
- `POST /api/auth/investor/register` - Investor registration
- `POST /api/auth/production/register` - Production company registration

### Session Management
- `POST /api/auth/logout` - Logout (clears session)
- `GET /api/auth/profile` - Get current user profile
- `GET /api/auth/session` - Validate current session
- `GET /api/validate-token` - Validate JWT token

### Password Reset
- `POST /api/auth/request-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

## 👤 User & Profile Endpoints

- `GET /api/profile` - Get user profile
- `GET /api/user/notifications` - Get user notifications
- `GET /api/user/preferences` - Get user preferences
- `GET /api/user/saved-pitches` - Get saved pitches

## 🎬 Creator Endpoints

### Dashboard & Analytics
- `GET /api/creator/dashboard` - Creator dashboard data
- `GET /api/creator/dashboard/stats` - Dashboard statistics
- `GET /api/creator/analytics` - Creator analytics
- `GET /api/creator/portfolio` - Creator portfolio
- `GET /api/creator/funding` - Funding overview

### Pitch Management
- `GET /api/creator/pitches` - Get creator's pitches
- `POST /api/creator/pitches` - Create new pitch
- `GET /api/creator/ndas` - Manage NDAs

### Social Features
- `GET /api/creator/following` - Get following activity
- `GET /api/creator/calendar` - Creator calendar

## 💰 Investor Endpoints

### Dashboard & Portfolio
- `GET /api/investor/dashboard` - Complete dashboard data
- `GET /api/investor/portfolio/summary` - Portfolio summary with ROI
- `GET /api/investor/investments` - List of investments
- `GET /api/investor/analytics` - Investment analytics

### Pitch Discovery
- `GET /api/investor/recommendations` - Recommended pitches
- `GET /api/investor/saved-pitches` - Saved pitches
- `GET /api/investor/watchlist` - Watchlist items

### Activity & Social
- `GET /api/investor/activity` - Activity feed
- `GET /api/investor/following` - Following creators
- `GET /api/investor/notifications` - Investor notifications

### NDA Management
- `GET /api/investor/nda-requests` - NDA requests status

## 🏭 Production Company Endpoints

### Dashboard & Analytics
- `GET /api/production/dashboard` - Production dashboard
- `GET /api/production/analytics` - Production analytics
- `GET /api/production/budget` - Budget management

### Project Management
- `GET /api/production/projects` - Active projects
- `GET /api/production/pipeline` - Project pipeline
- `GET /api/production/schedule` - Production schedule
- `GET /api/production/submissions` - Pitch submissions

### Investment & Discovery
- `GET /api/production/investments` - Investment tracking
- `GET /api/production/investments/overview` - Investment overview
- `GET /api/production/smart-pitch-discovery` - AI-powered discovery

### Team & Operations
- `GET /api/production/team` - Team management
- `GET /api/production/contracts` - Contract management
- `GET /api/production/reviews` - Review system
- `GET /api/production/following` - Following activity

## 📚 Pitch Endpoints

### Public Access
- `GET /api/pitches/public` - Public pitches list
- `GET /api/pitches/{id}` - Get pitch details
- `GET /api/pitches/trending` - Trending pitches
- `GET /api/pitches/new` - New releases
- `GET /api/pitches/browse` - Browse with filters

### Pitch Management
- `POST /api/pitches` - Create pitch
- `PUT /api/pitches/{id}` - Update pitch
- `DELETE /api/pitches/{id}` - Delete pitch
- `PATCH /api/pitches/{id}/fields` - Update specific fields

### Character Management
- `GET /api/pitches/{id}/characters` - Get characters
- `POST /api/pitches/{id}/characters` - Add character
- `PUT /api/pitches/{id}/characters` - Reorder characters
- `PUT /api/pitches/{id}/characters/{charId}` - Update character
- `DELETE /api/pitches/{id}/characters/{charId}` - Delete character

### Social Features
- `POST /api/pitches/save` - Save pitch
- `POST /api/pitches/unsave` - Unsave pitch
- `GET /api/pitches/following` - Pitches from followed creators

## 📄 NDA Endpoints

### NDA Management
- `POST /api/nda/request` - Request NDA for pitch
- `GET /api/nda/active` - Active NDAs
- `GET /api/nda/pending` - Pending NDA requests
- `POST /api/pitches/nda/upload` - Upload custom NDA

### NDA Statistics
- `GET /api/ndas/stats` - NDA statistics
- `GET /api/ndas/incoming-requests` - Incoming NDA requests
- `GET /api/ndas/incoming-signed` - Incoming signed NDAs
- `GET /api/ndas/outgoing-requests` - Outgoing NDA requests
- `GET /api/ndas/outgoing-signed` - Outgoing signed NDAs

## 💳 Billing & Payments

### Subscription Management
- `GET /api/billing/subscription` - Subscription details
- `GET /api/subscription/status` - Subscription status
- `GET /api/payments/subscription-status` - Payment subscription status

### Credits & Balance
- `GET /api/billing/credits` - Credit balance
- `GET /api/payments/credits/balance` - Credits balance

### Payment History
- `GET /api/payments/history` - Payment history
- `GET /api/payments/invoices` - Invoices
- `GET /api/payments/payment-methods` - Payment methods

## 📊 Analytics Endpoints

- `GET /api/analytics/dashboard` - Analytics dashboard
- `GET /api/analytics/user` - User analytics
- `GET /api/analytics/engagement` - Engagement metrics
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/trending` - Trending analytics
- `GET /api/analytics/realtime` - Real-time analytics
- `POST /api/analytics/track` - Track analytics event

## 🔍 Search & Discovery

- `GET /api/search` - Global search
- `GET /api/search/pitches` - Search pitches
- `GET /api/browse/enhanced` - Enhanced browse with filters
- `GET /api/browse/genres` - Browse by genres
- `GET /api/browse/stats` - Browse statistics

## 📨 Notifications & Messaging

- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread` - Unread notifications
- `GET /api/notifications/preferences` - Notification preferences
- `GET /api/messages` - Get messages
- `POST /api/alerts/email` - Email alerts

## 👥 Social Features

### Following System
- `GET /api/follows/followers` - Get followers
- `GET /api/follows/following` - Get following
- `POST /api/follows/{userId}` - Follow user
- `DELETE /api/follows/{userId}` - Unfollow user

### Saved & Filters
- `GET /api/saved-pitches` - Get saved pitches
- `GET /api/filters/saved` - Saved filters

## 💼 Investment Features

- `POST /api/investment/express-interest` - Express investment interest
- `GET /api/investment/recommendations` - Investment recommendations
- `GET /api/investment-opportunities` - Investment opportunities

## 📤 File Management

- `POST /api/upload` - Single file upload
- `POST /api/upload/multiple` - Multiple file upload
- `POST /api/files/rename` - Rename file

## ⚙️ Configuration & Content

### Platform Configuration
- `GET /api/config/genres` - Available genres
- `GET /api/config/formats` - Available formats
- `GET /api/config/budget-ranges` - Budget ranges
- `GET /api/config/stages` - Development stages
- `GET /api/config/all` - All configuration

### Static Content
- `GET /api/content/about` - About page content
- `GET /api/content/how-it-works` - How it works
- `GET /api/content/stats` - Platform statistics
- `GET /api/content/team` - Team information

## 🔧 System Endpoints

- `GET /api/health` - Health check
- `GET /api/permissions/check` - Check permissions
- `GET /api/teams` - Team management

## 🔄 WebSocket Endpoints

- `GET /ws` - WebSocket connection for real-time features
  - Notifications
  - Live updates
  - Draft auto-sync
  - Presence tracking

## 📝 Response Format

All endpoints return JSON responses with the following structure:

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
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## 🔒 Authentication

Most endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <jwt_token>
```

Portal-specific endpoints also validate user type to ensure proper access control.

## 🚀 Production URLs

- **API Gateway**: `https://pitchey-production.cavelltheleaddev.workers.dev`
- **WebSocket**: `wss://pitchey-production.cavelltheleaddev.workers.dev/ws`
- **Frontend**: `https://pitchey.pages.dev`

## 🛠 Local Development

For local development, use the proxy server:
```bash
PORT=8001 deno run --allow-all working-server.ts
```

This proxies all `/api/*` requests to the production Cloudflare Worker.

## 📊 Rate Limiting

- Authentication endpoints: 5 requests per minute
- API endpoints: 100 requests per minute per user
- Upload endpoints: 10 requests per minute

## 🎯 Demo Accounts

For testing (password: `Demo123`):
- Creator: `alex.creator@demo.com`
- Investor: `sarah.investor@demo.com`  
- Production: `stellar.production@demo.com`