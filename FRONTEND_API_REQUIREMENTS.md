# Frontend API Requirements Analysis

## Overview
This document lists all API endpoints that the frontend services expect, organized by service and feature area. Use this to ensure complete backend implementation.

## Authentication Service (`auth.service.ts`)
- `POST /api/auth/{portal}/login` - Portal-specific login (creator/investor/production)
- `POST /api/auth/{portal}/register` - Portal-specific registration
- `POST /api/auth/logout` - Logout
- `GET /api/auth/validate-token` - Validate JWT token ✅
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/two-factor/enable` - Enable 2FA
- `POST /api/auth/two-factor/verify` - Verify 2FA code
- `POST /api/auth/two-factor/disable` - Disable 2FA
- `GET /api/auth/sessions` - Get active sessions
- `DELETE /api/auth/sessions/{sessionId}` - Revoke session
- `POST /api/auth/sessions/revoke-all` - Revoke all sessions

## User Service (`user.service.ts`)
- `GET /api/profile` - Get current user profile ✅
- `GET /api/user/profile` - Alternative profile endpoint ✅
- `GET /api/users/{userId}` - Get user by ID
- `GET /api/users/username/{username}` - Get user by username
- `PUT /api/user/profile` - Update profile
- `PUT /api/user/password` - Change password
- `GET /api/user/settings` - Get user settings ✅
- `POST /api/user/settings` - Update settings
- `DELETE /api/user/account` - Delete account
- `GET /api/user/notifications` - Get notifications with pagination
- `GET /api/{portal}/dashboard/stats` - Portal-specific dashboard stats ✅
- `POST /api/user/follow/{userId}` - Follow user
- `POST /api/user/unfollow/{userId}` - Unfollow user
- `POST /api/user/block/{userId}` - Block user
- `POST /api/user/unblock/{userId}` - Unblock user
- `GET /api/user/preferences` - Get preferences
- `PUT /api/user/preferences` - Update preferences

## Pitch Service (`pitch.service.ts`)
- `POST /api/creator/pitches` - Create pitch ✅
- `GET /api/creator/pitches` - Get creator's pitches ✅
- `GET /api/pitches/{id}` - Get pitch details ✅
- `PUT /api/creator/pitches/{id}` - Update pitch ✅
- `DELETE /api/creator/pitches/{id}` - Delete pitch ✅
- `POST /api/creator/pitches/{id}/publish` - Publish pitch ✅
- `POST /api/creator/pitches/{id}/archive` - Archive pitch ✅
- `GET /api/pitches/public` - Get public pitches ✅
- `GET /api/pitches/trending` - Get trending pitches ✅
- `GET /api/pitches/new` - Get new pitches ✅
- `GET /api/pitches/browse/general` - Browse with filters ✅
- `POST /api/analytics/track-view` - Track pitch view
- `POST /api/creator/pitches/{id}/like` - Like pitch ✅
- `POST /api/creator/pitches/{id}/unlike` - Unlike pitch ✅
- `POST /api/pitches/{id}/nda/request` - Request NDA ✅
- `POST /api/pitches/{id}/nda/sign` - Sign NDA ✅
- `GET /api/creator/pitches/{id}/analytics` - Get pitch analytics ✅
- `POST /api/creator/pitches/{id}/media` - Upload media ✅

## Character Service (`character.service.ts`)
- `GET /api/pitches/{pitchId}/characters` - Get characters ✅
- `POST /api/pitches/{pitchId}/characters` - Add character ✅
- `PUT /api/pitches/{pitchId}/characters/{characterId}` - Update character ✅
- `DELETE /api/pitches/{pitchId}/characters/{characterId}` - Delete character ✅
- `POST /api/pitches/{pitchId}/characters/reorder` - Reorder characters ✅
- `PATCH /api/pitches/{pitchId}/characters/{characterId}/position` - Move character ✅

## Search Service (`search.service.ts`)
- `GET /api/search/pitches` - Search pitches ✅
- `GET /api/search/users` - Search users
- `GET /api/search/advanced` - Advanced search
- `GET /api/search/suggestions` - Get search suggestions
- `GET /api/search/autocomplete` - Autocomplete suggestions
- `POST /api/search/save` - Save search
- `GET /api/search/saved` - Get saved searches
- `PUT /api/search/saved/{id}` - Update saved search
- `DELETE /api/search/saved/{id}` - Delete saved search
- `GET /api/search/saved/{id}/execute` - Execute saved search
- `GET /api/search/history` - Get search history
- `DELETE /api/search/history` - Clear search history
- `GET /api/search/trending` - Get trending searches
- `GET /api/search/related` - Get related terms
- `POST /api/search/batch` - Batch search
- `GET /api/search/metadata` - Get search metadata
- `GET /api/search/similar/pitches` - Similar pitches
- `GET /api/search/similar/users` - Similar users

## Notification Service (`notifications.service.ts`)
- `GET /api/user/notifications` - Get notifications
- `GET /api/notifications/unread` - Get unread notifications ✅
- `POST /api/notifications/{id}/read` - Mark as read
- `POST /api/notifications/read` - Mark all as read
- `GET /api/notifications/preferences` - Get preferences
- `PUT /api/notifications/preferences` - Update preferences

## Messaging Service (`messaging.service.ts`)
- `GET /api/conversations` - Get conversations
- `GET /api/conversations/{id}` - Get conversation
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/{id}/messages` - Get messages
- `POST /api/conversations/{id}/messages` - Send message
- `PUT /api/messages/{id}` - Edit message
- `DELETE /api/messages/{id}` - Delete message
- `POST /api/messages/{id}/read` - Mark as read
- `POST /api/messages/read` - Mark all as read
- `POST /api/conversations/{id}/typing` - Send typing indicator
- `POST /api/conversations/{id}/archive` - Archive conversation
- `POST /api/conversations/{id}/unarchive` - Unarchive
- `POST /api/conversations/{id}/mute` - Mute conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `GET /api/messages/unread-count` - Get unread count
- `GET /api/messages/search` - Search messages
- `POST /api/conversations/{id}/block` - Block conversation
- `POST /api/conversations/{id}/unblock` - Unblock
- `GET /api/conversations/{id}/members` - Get members

## Investment Service (`investment.service.ts`)
- `GET /api/investor/portfolio/summary` - Portfolio summary
- `GET /api/investor/investments` - Get investments
- `GET /api/investment/recommendations` - Get recommendations
- `GET /api/creator/funding/overview` - Funding overview
- `GET /api/creator/investors` - Get investors
- `GET /api/production/investments/overview` - Production overview
- `POST /api/investments/create` - Create investment
- `POST /api/investments/{id}/update` - Update investment
- `GET /api/investments/{id}/details` - Investment details
- `GET /api/investor/portfolio/analytics` - Portfolio analytics
- `GET /api/investor/preferences` - Investment preferences

## Investor Service (`investor.service.ts`)
- `GET /api/investor/dashboard` - Dashboard data ✅
- `GET /api/investor/portfolio` - Portfolio
- `GET /api/investor/watchlist` - Watchlist
- `GET /api/investor/ndas` - NDAs
- `GET /api/investor/analytics` - Analytics
- `POST /api/investor/watchlist/add` - Add to watchlist
- `POST /api/investor/watchlist/remove` - Remove from watchlist
- `GET /api/investor/opportunities` - Investment opportunities
- `POST /api/investor/express-interest` - Express interest
- `DELETE /api/investor/interest/{id}` - Withdraw interest
- `GET /api/investor/saved-pitches` - Saved pitches
- `GET /api/investor/recommendations` - Recommendations
- `GET /api/investor/activity` - Activity history

## Creator Service (`creator.service.ts`)
- `GET /api/creator/dashboard` - Dashboard data ✅
- `GET /api/creator/analytics` - Analytics overview
- `GET /api/creator/revenue` - Revenue data
- `GET /api/creator/audience` - Audience insights
- `GET /api/creator/engagement` - Engagement metrics
- `GET /api/creator/content-performance` - Content performance
- `GET /api/creator/investor-interest` - Investor interest

## Production Service (`production.service.ts`)
- `GET /api/production/dashboard` - Dashboard data ✅
- `GET /api/production/projects` - Projects
- `GET /api/production/team` - Team members
- `GET /api/production/schedule` - Production schedule
- `GET /api/production/resources` - Resources
- `GET /api/production/budgets` - Budgets
- `POST /api/production/projects` - Create project
- `PUT /api/production/projects/{id}` - Update project
- `DELETE /api/production/projects/{id}` - Delete project

## Payment Service (implied from dashboard endpoints)
- `GET /api/payments/credits/balance` - Credit balance ✅
- `GET /api/payments/subscription-status` - Subscription status ✅
- `POST /api/payments/credits/purchase` - Purchase credits
- `GET /api/payments/history` - Payment history
- `POST /api/payments/subscription/upgrade` - Upgrade subscription
- `POST /api/payments/subscription/cancel` - Cancel subscription

## Analytics Service
- `POST /api/analytics/track-view` - Track view
- `GET /api/analytics/dashboard` - Dashboard analytics ✅
- `GET /api/analytics/user` - User analytics ✅
- `GET /api/analytics/pitch/{id}` - Pitch analytics
- `GET /api/analytics/engagement` - Engagement metrics
- `GET /api/analytics/conversion` - Conversion metrics

## Follow Service
- `GET /api/follows/stats/{userId}` - Follow stats ✅
- `GET /api/follows/followers` - Get followers
- `GET /api/follows/following` - Get following
- `POST /api/follows/{userId}` - Follow user
- `DELETE /api/follows/{userId}` - Unfollow user

## NDA Service
- `GET /api/nda/pending` - Pending NDAs ✅
- `GET /api/nda/active` - Active NDAs ✅
- `GET /api/nda/stats` - NDA statistics
- `GET /api/nda/{id}` - NDA details
- `POST /api/nda/{id}/approve` - Approve NDA
- `POST /api/nda/{id}/reject` - Reject NDA
- `GET /api/nda/templates` - NDA templates

## Upload Service
- `POST /api/upload` - General file upload ✅
- `POST /api/upload/image` - Image upload
- `POST /api/upload/document` - Document upload
- `POST /api/upload/video` - Video upload
- `DELETE /api/upload/{key}` - Delete uploaded file
- `GET /api/upload/signed-url` - Get signed upload URL

## Admin/Moderation (if applicable)
- `GET /api/admin/reports` - Get reports
- `POST /api/admin/reports/{id}/action` - Take action on report
- `GET /api/admin/users` - Manage users
- `POST /api/admin/users/{id}/ban` - Ban user
- `POST /api/admin/users/{id}/unban` - Unban user

## Legend
- ✅ = Implemented in worker
- No mark = Not yet implemented

## Priority Implementation Order
1. **Critical User Flow** (Login, Profile, Dashboard)
2. **Core Features** (Pitches, Characters, Search)  
3. **Engagement** (Messaging, Notifications, Follows)
4. **Monetization** (Payments, Investments, NDAs)
5. **Analytics & Admin** (Analytics, Reports, Moderation)

## Notes
- Many endpoints expect specific response formats with `success`, `data`, and `message` fields
- Most list endpoints support pagination with `page`, `limit`, `offset` parameters
- Portal-specific endpoints use dynamic paths: `/api/{portal}/...`
- Authentication required for most endpoints (Bearer token in Authorization header)
- Some endpoints have multiple variations (e.g., `/api/profile` vs `/api/user/profile`)