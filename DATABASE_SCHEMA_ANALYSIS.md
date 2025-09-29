# Pitchey Database Schema Analysis

## Overview
This document provides a comprehensive analysis of the Pitchey application database schema. The database contains 28 tables supporting a movie pitch platform with user management, pitch creation, messaging, analytics, and NDA functionality.

## Custom Data Types (Enums)

### user_type
- `creator` - Content creators who submit pitches
- `production` - Production companies
- `investor` - Investment professionals
- `viewer` - General users/viewers

### nda_type
- `basic` - Standard NDA template
- `enhanced` - Enhanced NDA with additional clauses
- `custom` - Custom NDA uploaded by user

### nda_request_status
- `pending` - Request submitted, awaiting response
- `approved` - Request approved by pitch owner
- `rejected` - Request denied by pitch owner
- `expired` - Request timed out

### notification_type
- `nda_request` - New NDA request received
- `nda_approved` - NDA request approved
- `nda_rejected` - NDA request rejected
- `nda_revoked` - NDA access revoked
- `pitch_view` - Pitch was viewed
- `pitch_like` - Pitch was liked
- `message_received` - New message received
- `follow` - User was followed
- `comment` - Comment on pitch

## Core Tables

### users
Primary user management table with comprehensive profile and security features.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| email | varchar(255) | NOT NULL, UNIQUE | User email address |
| username | varchar(100) | NOT NULL, UNIQUE | Unique username |
| password_hash | text | NOT NULL | Encrypted password |
| user_type | varchar(50) | NOT NULL, DEFAULT 'viewer' | User role |
| first_name | varchar(100) | NULL | User's first name |
| last_name | varchar(100) | NULL | User's last name |
| phone | varchar(20) | NULL | Phone number |
| location | varchar(200) | NULL | User location |
| bio | text | NULL | User biography |
| profile_image_url | text | NULL | Profile image URL |
| company_name | text | NULL | Company name |
| company_number | varchar(100) | NULL | Company registration number |
| company_website | text | NULL | Company website |
| company_address | text | NULL | Company address |
| email_verified | boolean | DEFAULT false | Email verification status |
| email_verification_token | text | NULL | Email verification token |
| email_verified_at | timestamp | NULL | Email verification timestamp |
| company_verified | boolean | DEFAULT false | Company verification status |
| is_active | boolean | DEFAULT true | Account active status |
| failed_login_attempts | integer | DEFAULT 0 | Failed login counter |
| account_locked_at | timestamp | NULL | Account lock timestamp |
| account_lock_reason | varchar(200) | NULL | Reason for account lock |
| last_password_change_at | timestamp | NULL | Last password change |
| password_history | jsonb | DEFAULT '[]' | Password history for security |
| require_password_change | boolean | DEFAULT false | Force password change flag |
| two_factor_enabled | boolean | DEFAULT false | 2FA enabled status |
| subscription_tier | varchar(50) | DEFAULT 'free' | Subscription level |
| subscription_start_date | timestamp | NULL | Subscription start |
| subscription_end_date | timestamp | NULL | Subscription end |
| stripe_customer_id | text | NULL | Stripe customer ID |
| stripe_subscription_id | text | NULL | Stripe subscription ID |
| last_login_at | timestamp | NULL | Last login timestamp |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Account creation |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- Primary key on `id`
- Unique indexes on `email`, `username`
- Indexes on `email`, `username`, `user_type`

### pitches
Core table for movie/TV pitch content.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Pitch creator |
| title | varchar(255) | NOT NULL | Pitch title |
| logline | text | NOT NULL | One-line pitch summary |
| genre | varchar(100) | NULL | Movie/TV genre |
| format | varchar(100) | NULL | Format (film, series, etc.) |
| short_synopsis | text | NULL | Brief synopsis |
| long_synopsis | text | NULL | Detailed synopsis |
| opener | text | NULL | Opening description |
| premise | text | NULL | Core premise |
| target_audience | text | NULL | Target demographic |
| characters | text | NULL | Character descriptions |
| themes | text | NULL | Story themes |
| episode_breakdown | text | NULL | Episode structure |
| budget_bracket | varchar(100) | NULL | Budget range |
| estimated_budget | numeric(15,2) | NULL | Specific budget estimate |
| video_url | varchar(500) | NULL | Pitch video URL |
| poster_url | varchar(500) | NULL | Poster image URL |
| pitch_deck_url | varchar(500) | NULL | Pitch deck PDF URL |
| additional_materials | jsonb | NULL | Additional files/links |
| visibility | varchar(50) | DEFAULT 'public' | Public/private status |
| status | varchar(50) | DEFAULT 'active' | Pitch status |
| view_count | integer | DEFAULT 0 | Total views |
| like_count | integer | DEFAULT 0 | Total likes |
| comment_count | integer | DEFAULT 0 | Total comments |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |
| nda_count | integer | DEFAULT 0 | Number of NDAs signed |
| title_image | text | NULL | Title image URL |
| lookbook_url | text | NULL | Visual lookbook URL |
| script_url | text | NULL | Script file URL |
| trailer_url | text | NULL | Trailer video URL |
| additional_media | jsonb | NULL | Additional media files |
| production_timeline | text | NULL | Production schedule |
| require_nda | boolean | DEFAULT false | NDA required flag |
| published_at | timestamp | NULL | Publication timestamp |
| visibility_settings | jsonb | DEFAULT '{"showBudget": false, "showLocation": false, "showCharacters": true, "showShortSynopsis": true}' | Visibility controls |
| ai_used | boolean | DEFAULT false | AI assistance used |
| ai_tools | varchar(100)[] | DEFAULT '{}' | AI tools used |
| ai_disclosure | text | NULL | AI usage disclosure |
| share_count | integer | DEFAULT 0 | Share count |
| feedback | jsonb | DEFAULT '[]' | Feedback/reviews |
| tags | varchar(50)[] | DEFAULT '{}' | Content tags |
| archived | boolean | DEFAULT false | Archive status |
| archived_at | timestamp | NULL | Archive timestamp |
| metadata | jsonb | DEFAULT '{}' | Additional metadata |

**Indexes:**
- Primary key on `id`
- Indexes on `user_id`, `status`, `genre`, `format`, `title`, `published_at`, `require_nda`, `nda_count`

## Relationship Tables

### follows
Handles user following relationships (both users and pitches).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| follower_id | integer | NOT NULL, FK(users.id) | User doing the following |
| pitch_id | integer | NULL, FK(pitches.id) | Followed pitch (if applicable) |
| creator_id | integer | NULL, FK(users.id) | Followed creator (if applicable) |
| followed_at | timestamp | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Follow timestamp |

**Constraints:**
- Check constraint: Either `pitch_id` OR `creator_id` must be set, not both
- Unique constraint on `(follower_id, creator_id)`
- Unique constraint on `(follower_id, pitch_id)`

**Key Insight:** This table uses `creator_id`, not `target_user_id` as referenced in some code.

### pitch_likes
User likes on pitches.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Liked pitch |
| user_id | integer | NOT NULL, FK(users.id) | User who liked |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Like timestamp |

**Constraints:**
- Unique constraint on `(pitch_id, user_id)` - prevents duplicate likes

### pitch_saves
User saved pitches (bookmarks).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Saved pitch |
| user_id | integer | NOT NULL, FK(users.id) | User who saved |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Save timestamp |

**Constraints:**
- Unique constraint on `(pitch_id, user_id)` - prevents duplicate saves

### pitch_views
Detailed view tracking with analytics.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Viewed pitch |
| user_id | integer | NULL, FK(users.id) | Viewing user (null for anonymous) |
| ip_address | varchar(100) | NULL | Viewer IP address |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | View timestamp |
| view_type | varchar(20) | NULL | Type of view |
| user_agent | text | NULL | Browser user agent |
| referrer | text | NULL | Referrer URL |
| session_id | varchar(100) | NULL | Session identifier |
| view_duration | integer | NULL | Time spent viewing (seconds) |
| scroll_depth | integer | NULL | Scroll percentage |
| clicked_watch_this | boolean | DEFAULT false | Clicked watch button |

## NDA System

### ndas
Main NDA records when users sign NDAs for pitches.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Associated pitch |
| user_id | integer | NULL, FK(users.id) | Deprecated field |
| status | varchar(50) | DEFAULT 'pending' | NDA status |
| signed_at | timestamp | NULL | Signature timestamp |
| expires_at | timestamp | NULL | Expiration timestamp |
| ip_address | varchar(100) | NULL | Signing IP address |
| signature_data | jsonb | NULL | Digital signature data |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |
| nda_version | varchar(20) | DEFAULT '1.0' | NDA template version |
| custom_nda_url | text | NULL | Custom NDA document URL |
| user_agent | text | NULL | Browser user agent |
| access_granted | boolean | DEFAULT true | Access permission status |
| access_revoked_at | timestamp | NULL | Access revocation timestamp |
| signer_id | integer | NULL, FK(users.id) | User who signed (current field) |
| nda_type | varchar(20) | DEFAULT 'basic' | Type of NDA |

**Constraints:**
- Unique constraint on `(pitch_id, user_id)`

### nda_requests
NDA access requests before signing.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Requested pitch |
| requester_id | integer | NOT NULL, FK(users.id) | User requesting access |
| owner_id | integer | NOT NULL, FK(users.id) | Pitch owner |
| nda_type | nda_type | NOT NULL, DEFAULT 'basic' | Type of NDA requested |
| status | nda_request_status | NOT NULL, DEFAULT 'pending' | Request status |
| request_message | text | NULL | Message from requester |
| rejection_reason | text | NULL | Rejection reason |
| company_info | jsonb | NULL | Requester company details |
| requested_at | timestamp | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Request timestamp |
| responded_at | timestamp | NULL | Response timestamp |
| expires_at | timestamp | NULL | Request expiration |

## Messaging System

### conversations
Conversation containers for messaging.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NULL, FK(pitches.id) | Related pitch |
| created_by_id | integer | NULL, FK(users.id) | Conversation creator |
| title | varchar(200) | NULL | Conversation title |
| is_group | boolean | DEFAULT false | Group conversation flag |
| last_message_at | timestamp | NULL | Last message timestamp |
| created_at | timestamp | DEFAULT now() | Creation timestamp |
| updated_at | timestamp | DEFAULT now() | Last update |

### conversation_participants
Users participating in conversations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| conversation_id | integer | NOT NULL, FK(conversations.id) | Conversation |
| user_id | integer | NOT NULL, FK(users.id) | Participant |
| is_active | boolean | DEFAULT true | Active participation |
| joined_at | timestamp | DEFAULT now() | Join timestamp |
| left_at | timestamp | NULL | Leave timestamp |
| mute_notifications | boolean | DEFAULT false | Notification mute status |
| last_read_at | timestamp | NULL | Last read timestamp |

**Constraints:**
- Unique constraint on `(conversation_id, user_id)`

### messages
Individual messages within conversations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| sender_id | integer | NOT NULL, FK(users.id) | Message sender |
| recipient_id | integer | NOT NULL, FK(users.id) | Message recipient |
| pitch_id | integer | NULL, FK(pitches.id) | Related pitch |
| subject | varchar(255) | NULL | Message subject |
| content | text | NOT NULL | Message content |
| is_read | boolean | DEFAULT false | Read status |
| read_at | timestamp | NULL | Read timestamp |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| conversation_id | integer | NULL | Conversation ID |
| parent_message_id | integer | NULL | Parent message for replies |
| message_type | varchar(50) | DEFAULT 'text' | Message type |
| attachments | jsonb | NULL | File attachments |
| is_edited | boolean | DEFAULT false | Edit status |
| is_deleted | boolean | DEFAULT false | Delete status |
| off_platform_requested | boolean | DEFAULT false | Off-platform communication request |
| off_platform_approved | boolean | DEFAULT false | Off-platform communication approval |
| edited_at | timestamp | NULL | Edit timestamp |
| deleted_at | timestamp | NULL | Delete timestamp |
| receiver_id | integer | NULL | Alternative receiver field |

### message_read_receipts
Read receipt tracking for messages.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| message_id | integer | NOT NULL, FK(messages.id) | Message |
| user_id | integer | NOT NULL, FK(users.id) | User who read |
| read_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Read timestamp |

### typing_indicators
Real-time typing indicators.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Typing user |
| conversation_id | integer | NULL | Conversation |
| is_typing | boolean | DEFAULT false | Typing status |
| last_activity | timestamp | DEFAULT CURRENT_TIMESTAMP | Last activity |

## Analytics System

### analytics
Core analytics tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Tracked pitch |
| user_id | integer | NULL, FK(users.id) | User (null for anonymous) |
| event_type | text | NOT NULL | Type of event |
| event_data | jsonb | NULL | Additional event data |
| session_id | text | NULL | Session identifier |
| ip_address | text | NULL | User IP address |
| user_agent | text | NULL | Browser user agent |
| referrer | text | NULL | Referrer URL |
| timestamp | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Event timestamp |

### analytics_events
Extended analytics event tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| event_type | text | NOT NULL | Event type |
| user_id | integer | NULL, FK(users.id) | User |
| pitch_id | integer | NULL, FK(pitches.id) | Related pitch |
| conversation_id | integer | NULL, FK(conversations.id) | Related conversation |
| message_id | integer | NULL, FK(messages.id) | Related message |
| session_id | text | NULL | Session ID |
| ip_address | text | NULL | IP address |
| user_agent | text | NULL | User agent |
| referrer | text | NULL | Referrer |
| event_data | jsonb | NULL | Event metadata |
| timestamp | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Event timestamp |

## User Management & Security

### sessions
User session management.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PRIMARY KEY, NOT NULL | Session ID |
| user_id | integer | NOT NULL, FK(users.id) | Session owner |
| token | text | NOT NULL, UNIQUE | Access token |
| refresh_token | text | NULL, UNIQUE | Refresh token |
| ip_address | varchar(45) | NULL | Session IP |
| user_agent | text | NULL | Browser user agent |
| fingerprint | text | NULL | Browser fingerprint |
| expires_at | timestamp | NOT NULL | Token expiration |
| refresh_expires_at | timestamp | NULL | Refresh token expiration |
| last_activity | timestamp | DEFAULT CURRENT_TIMESTAMP | Last activity |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Session creation |

### security_events
Security event logging.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NULL, FK(users.id) | Related user |
| event_type | text | NOT NULL | Security event type |
| severity | text | DEFAULT 'info' | Event severity |
| description | text | NULL | Event description |
| ip_address | text | NULL | Source IP |
| user_agent | text | NULL | User agent |
| event_data | jsonb | NULL | Additional data |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

## Financial & Business Intelligence

### watchlist
User pitch watchlists.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Watchlist owner |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Watched pitch |
| notes | text | NULL | User notes |
| priority | text | DEFAULT 'normal' | Priority level |
| created_at | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Addition timestamp |
| updated_at | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update |

**Constraints:**
- Unique constraint on `(user_id, pitch_id)`

### portfolio
Investment portfolio tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| investor_id | integer | NOT NULL, FK(users.id) | Investor |
| pitch_id | integer | NOT NULL, FK(pitches.id) | Invested pitch |
| amount_invested | numeric(15,2) | NULL | Investment amount |
| ownership_percentage | numeric(5,2) | NULL | Ownership stake |
| status | text | DEFAULT 'active' | Investment status |
| invested_at | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Investment date |
| exited_at | timestamp with time zone | NULL | Exit date |
| returns | numeric(15,2) | NULL | Return amount |
| notes | text | NULL | Investment notes |
| updated_at | timestamp with time zone | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update |

### user_credits
User credit/payment system.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Credit owner |
| credits | integer | DEFAULT 0 | Credit balance |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Account creation |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |

### credit_transactions
Credit transaction history.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Transaction user |
| pitch_id | integer | NULL, FK(pitches.id) | Related pitch |
| transaction_type | text | NOT NULL | Transaction type |
| amount | integer | NOT NULL | Credit amount |
| description | text | NULL | Transaction description |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Transaction timestamp |

### payments
Payment processing records.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Paying user |
| amount | numeric(10,2) | NOT NULL | Payment amount |
| currency | varchar(3) | DEFAULT 'USD' | Payment currency |
| status | text | NOT NULL | Payment status |
| stripe_payment_intent_id | text | NULL | Stripe payment ID |
| description | text | NULL | Payment description |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Payment timestamp |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |

### transactions
General transaction logging.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Transaction user |
| type | text | NOT NULL | Transaction type |
| amount | numeric(15,2) | NULL | Transaction amount |
| description | text | NULL | Description |
| metadata | jsonb | NULL | Additional data |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Transaction timestamp |

## Communication & Notifications

### notifications
User notification system.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | Notification recipient |
| type | notification_type | NOT NULL | Notification type |
| title | varchar(200) | NOT NULL | Notification title |
| message | text | NOT NULL | Notification message |
| is_read | boolean | NOT NULL, DEFAULT false | Read status |
| related_pitch_id | integer | NULL, FK(pitches.id) | Related pitch |
| related_user_id | integer | NULL | Related user |
| related_nda_request_id | integer | NULL, FK(nda_requests.id) | Related NDA request |
| action_url | text | NULL | Action link |
| created_at | timestamp | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| read_at | timestamp | NULL | Read timestamp |

### email_queue
Email delivery queue.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NULL, FK(users.id) | Recipient user |
| to_email | varchar(255) | NOT NULL | Recipient email |
| subject | varchar(255) | NOT NULL | Email subject |
| body | text | NOT NULL | Email body |
| template_name | varchar(100) | NULL | Template used |
| template_data | jsonb | NULL | Template variables |
| status | text | DEFAULT 'pending' | Delivery status |
| attempts | integer | DEFAULT 0 | Delivery attempts |
| last_attempt_at | timestamp | NULL | Last attempt timestamp |
| sent_at | timestamp | NULL | Successful delivery timestamp |
| error_message | text | NULL | Error details |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Queue timestamp |

### email_preferences
User email notification preferences.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| user_id | integer | NOT NULL, FK(users.id) | User |
| notification_type | text | NOT NULL | Notification type |
| email_enabled | boolean | DEFAULT true | Email enabled |
| frequency | text | DEFAULT 'immediate' | Notification frequency |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Last update |

## System Administration

### database_alerts
Database monitoring and alerts.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| alert_type | text | NOT NULL | Alert type |
| severity | text | DEFAULT 'info' | Alert severity |
| message | text | NOT NULL | Alert message |
| details | jsonb | NULL | Alert details |
| resolved | boolean | DEFAULT false | Resolution status |
| resolved_at | timestamp | NULL | Resolution timestamp |
| created_at | timestamp | DEFAULT CURRENT_TIMESTAMP | Alert timestamp |

### maintenance_log
System maintenance logging.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | integer | PRIMARY KEY, NOT NULL | Auto-incrementing |
| operation_type | text | NOT NULL | Maintenance type |
| description | text | NOT NULL | Operation description |
| performed_by | text | NULL | Operator |
| started_at | timestamp | NOT NULL | Start timestamp |
| completed_at | timestamp | NULL | Completion timestamp |
| status | text | DEFAULT 'in_progress' | Operation status |
| details | jsonb | NULL | Operation details |

## Key Insights and Naming Conventions

### Important Structural Notes

1. **follows table structure**: Uses `creator_id` not `target_user_id` - this is critical for follow functionality
2. **NDA system**: Has both `ndas` (signed NDAs) and `nda_requests` (pending requests) tables
3. **User types**: Four distinct user types (creator, production, investor, viewer)
4. **Messaging**: Supports both direct messages and conversation-based messaging
5. **Analytics**: Dual analytics system with basic `analytics` and extended `analytics_events`

### Foreign Key Relationships

Most tables have proper CASCADE deletion set up:
- User deletion cascades to all related records
- Pitch deletion cascades to views, likes, saves, etc.
- Conversation deletion cascades to participants and messages

### Indexing Strategy

The database is well-indexed with:
- Primary keys on all tables
- Foreign key indexes for joins
- Search indexes on commonly queried fields (email, username, pitch titles)
- Performance indexes on high-volume tables (analytics, views)

### JSONB Usage

Several tables use JSONB for flexible data storage:
- `pitches.additional_materials`, `pitches.additional_media`, `pitches.visibility_settings`
- `users.password_history`
- `analytics.event_data`, `analytics_events.event_data`
- `messages.attachments`

This schema supports a comprehensive movie pitch platform with robust user management, content creation, social features, messaging, analytics, and business intelligence capabilities.