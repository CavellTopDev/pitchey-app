# Pitchey Platform Database Schema Documentation

## Overview

The Pitchey platform uses PostgreSQL as its primary database with Drizzle ORM for schema management and type-safe queries. The database is designed to support multi-portal functionality with comprehensive tracking of users, pitches, NDAs, messaging, payments, and analytics.

## Database Architecture

### Technology Stack
- **Database**: PostgreSQL 14+
- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit
- **Connection Pooling**: Built-in PostgreSQL pooling
- **Schema Location**: `/src/db/schema.ts`

## Core Tables

### 1. Users Table (`users`)

Stores all platform users across different portals.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `email` | varchar(255) | User email | NOT NULL, UNIQUE |
| `username` | varchar(100) | Display username | NOT NULL, UNIQUE |
| `passwordHash` | text | Bcrypt password hash | NOT NULL |
| `userType` | enum | User type (creator, production, investor, viewer) | NOT NULL, DEFAULT 'viewer' |
| `firstName` | varchar(100) | First name | |
| `lastName` | varchar(100) | Last name | |
| `phone` | varchar(20) | Phone number | |
| `location` | varchar(200) | User location | |
| `bio` | text | User biography | |
| `profileImage` | text | Profile image URL | |
| `companyName` | text | Company name (for production/investors) | |
| `companyNumber` | varchar(100) | Company registration number | |
| `companyWebsite` | text | Company website URL | |
| `companyAddress` | text | Company address | |
| `emailVerified` | boolean | Email verification status | DEFAULT false |
| `emailVerificationToken` | text | Email verification token | |
| `companyVerified` | boolean | Company verification status | DEFAULT false |
| `isActive` | boolean | Account active status | DEFAULT true |
| `subscriptionTier` | enum | Subscription level (free, creator, pro, investor) | DEFAULT 'free' |
| `subscriptionStartDate` | timestamp | Subscription start date | |
| `subscriptionEndDate` | timestamp | Subscription end date | |
| `stripeCustomerId` | text | Stripe customer ID | |
| `stripeSubscriptionId` | text | Stripe subscription ID | |
| `lastLoginAt` | timestamp | Last login timestamp | |
| `createdAt` | timestamp | Account creation date | DEFAULT NOW() |
| `updatedAt` | timestamp | Last update date | DEFAULT NOW() |

**Indexes:**
- `users_email_idx` on `email`
- `users_username_idx` on `username`
- `users_user_type_idx` on `userType`

### 2. Pitches Table (`pitches`)

Stores all pitch information created by users.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | Creator user ID | FK -> users.id, NOT NULL |
| `title` | varchar(200) | Pitch title | NOT NULL |
| `logline` | text | One-line pitch description | NOT NULL |
| `genre` | enum | Genre (drama, comedy, thriller, etc.) | NOT NULL |
| `format` | enum | Format (feature, tv, short, etc.) | NOT NULL |
| `shortSynopsis` | text | Brief synopsis | |
| `longSynopsis` | text | Detailed synopsis | |
| `opener` | text | Opening scene/hook | |
| `premise` | text | Core premise | |
| `targetAudience` | text | Target demographic | |
| `budget` | varchar(100) | Estimated budget range | |
| `comparables` | jsonb | Similar successful projects | |
| `keyTalent` | jsonb | Attached or target talent | |
| `themes` | jsonb | Key themes | |
| `whyNow` | text | Why this story now | |
| `personalConnection` | text | Creator's connection to story | |
| `thumbnailUrl` | text | Thumbnail image URL | |
| `mediaFiles` | jsonb | Associated media files | |
| `status` | enum | Status (draft, published, hidden, archived) | DEFAULT 'draft' |
| `views` | integer | View count | DEFAULT 0 |
| `requiresNDA` | boolean | NDA requirement flag | DEFAULT false |
| `ndaType` | enum | NDA type (basic, enhanced, custom) | |
| `customNDAUrl` | text | Custom NDA document URL | |
| `stage` | varchar(50) | Development stage | |
| `completionPercentage` | integer | Completion percentage | |
| `createdAt` | timestamp | Creation date | DEFAULT NOW() |
| `updatedAt` | timestamp | Last update date | DEFAULT NOW() |
| `publishedAt` | timestamp | Publication date | |

**Indexes:**
- `pitches_user_id_idx` on `userId`
- `pitches_status_idx` on `status`
- `pitches_genre_idx` on `genre`

### 3. NDAs Table (`ndas`)

Manages NDA requests and agreements.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `pitchId` | integer | Associated pitch | FK -> pitches.id, NOT NULL |
| `requesterId` | integer | User requesting NDA | FK -> users.id, NOT NULL |
| `ownerId` | integer | Pitch owner | FK -> users.id, NOT NULL |
| `ndaType` | enum | NDA type (basic, enhanced, custom) | NOT NULL |
| `status` | varchar(50) | Status (pending, approved, rejected, signed, expired) | DEFAULT 'pending' |
| `requestMessage` | text | Request message | |
| `rejectReason` | text | Rejection reason | |
| `signedAt` | timestamp | Signature timestamp | |
| `expiresAt` | timestamp | Expiration date | |
| `documentUrl` | text | Signed document URL | |
| `ipAddress` | varchar(45) | Signer IP address | |
| `userAgent` | text | Signer user agent | |
| `createdAt` | timestamp | Request date | DEFAULT NOW() |
| `updatedAt` | timestamp | Last update | DEFAULT NOW() |

**Indexes:**
- `ndas_pitch_id_idx` on `pitchId`
- `ndas_requester_id_idx` on `requesterId`
- `ndas_owner_id_idx` on `ownerId`
- `ndas_status_idx` on `status`

### 4. Follows Table (`follows`)

Tracks following relationships between users and pitches.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `followerId` | integer | Following user | FK -> users.id, NOT NULL |
| `followingId` | integer | Followed user | FK -> users.id |
| `pitchId` | integer | Followed pitch | FK -> pitches.id |
| `createdAt` | timestamp | Follow date | DEFAULT NOW() |

**Constraints:**
- Unique constraint on (`followerId`, `followingId`)
- Unique constraint on (`followerId`, `pitchId`)

### 5. Messages System Tables

#### Conversations Table (`conversations`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `title` | varchar(255) | Conversation title | |
| `type` | varchar(50) | Type (direct, group, pitch_discussion) | DEFAULT 'direct' |
| `pitchId` | integer | Associated pitch | FK -> pitches.id |
| `isArchived` | boolean | Archive status | DEFAULT false |
| `metadata` | jsonb | Additional metadata | |
| `createdAt` | timestamp | Creation date | DEFAULT NOW() |
| `updatedAt` | timestamp | Last update | DEFAULT NOW() |

#### Conversation Participants (`conversation_participants`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `conversationId` | integer | Conversation ID | FK -> conversations.id, NOT NULL |
| `userId` | integer | Participant user ID | FK -> users.id, NOT NULL |
| `role` | varchar(50) | Participant role | DEFAULT 'member' |
| `joinedAt` | timestamp | Join date | DEFAULT NOW() |
| `lastReadAt` | timestamp | Last read timestamp | |
| `isActive` | boolean | Active status | DEFAULT true |

**Constraints:**
- Unique constraint on (`conversationId`, `userId`)

#### Messages Table (`messages`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `conversationId` | integer | Conversation ID | FK -> conversations.id, NOT NULL |
| `senderId` | integer | Sender user ID | FK -> users.id, NOT NULL |
| `content` | text | Message content | |
| `encryptedContent` | text | Encrypted content | |
| `attachments` | jsonb | File attachments | |
| `messageType` | varchar(50) | Type (text, image, file, system) | DEFAULT 'text' |
| `parentId` | integer | Parent message (for threads) | FK -> messages.id |
| `editedAt` | timestamp | Edit timestamp | |
| `deletedAt` | timestamp | Soft delete timestamp | |
| `metadata` | jsonb | Additional metadata | |
| `createdAt` | timestamp | Send date | DEFAULT NOW() |

**Indexes:**
- `messages_conversation_id_idx` on `conversationId`
- `messages_sender_id_idx` on `senderId`

#### Message Read Receipts (`message_read_receipts`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `messageId` | integer | Message ID | FK -> messages.id, NOT NULL |
| `userId` | integer | Reader user ID | FK -> users.id, NOT NULL |
| `readAt` | timestamp | Read timestamp | DEFAULT NOW() |
| `deliveredAt` | timestamp | Delivery timestamp | |

**Constraints:**
- Unique constraint on (`messageId`, `userId`)

#### Typing Indicators (`typing_indicators`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `conversationId` | integer | Conversation ID | FK -> conversations.id, NOT NULL |
| `userId` | integer | Typing user ID | FK -> users.id, NOT NULL |
| `startedAt` | timestamp | Started typing | DEFAULT NOW() |
| `expiresAt` | timestamp | Expiration (auto-cleanup) | |

### 6. Payment Tables

#### Transactions Table (`transactions`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | User ID | FK -> users.id, NOT NULL |
| `type` | varchar(50) | Type (subscription, credits, fee) | NOT NULL |
| `amount` | decimal(10,2) | Amount in cents | NOT NULL |
| `currency` | varchar(3) | Currency code | DEFAULT 'USD' |
| `status` | varchar(50) | Status (pending, completed, failed) | DEFAULT 'pending' |
| `stripePaymentIntentId` | text | Stripe payment intent | |
| `description` | text | Transaction description | |
| `metadata` | jsonb | Additional data | |
| `createdAt` | timestamp | Transaction date | DEFAULT NOW() |

#### Credits Table (`credits`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | User ID | FK -> users.id, NOT NULL |
| `balance` | integer | Current balance | DEFAULT 0 |
| `lifetimePurchased` | integer | Total purchased | DEFAULT 0 |
| `lifetimeUsed` | integer | Total used | DEFAULT 0 |
| `updatedAt` | timestamp | Last update | DEFAULT NOW() |

### 7. Analytics Tables

#### Pitch Views (`pitch_views`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `pitchId` | integer | Viewed pitch | FK -> pitches.id, NOT NULL |
| `viewerId` | integer | Viewer user ID | FK -> users.id |
| `viewerType` | varchar(50) | Viewer type | |
| `duration` | integer | View duration (seconds) | |
| `source` | varchar(100) | Traffic source | |
| `ipAddress` | varchar(45) | Viewer IP | |
| `userAgent` | text | Browser info | |
| `createdAt` | timestamp | View timestamp | DEFAULT NOW() |

**Indexes:**
- `pitch_views_pitch_id_idx` on `pitchId`
- `pitch_views_viewer_id_idx` on `viewerId`

#### Analytics Events (`analytics_events`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | User ID | FK -> users.id |
| `eventType` | varchar(100) | Event type | NOT NULL |
| `eventCategory` | varchar(100) | Event category | |
| `eventAction` | varchar(100) | Event action | |
| `eventLabel` | text | Event label | |
| `eventValue` | integer | Event value | |
| `metadata` | jsonb | Additional data | |
| `sessionId` | varchar(100) | Session ID | |
| `createdAt` | timestamp | Event timestamp | DEFAULT NOW() |

### 8. Email System Tables

#### Email Preferences (`email_preferences`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | User ID | FK -> users.id, NOT NULL, UNIQUE |
| `ndaRequests` | enum | Frequency (instant, daily, weekly, never) | DEFAULT 'instant' |
| `messages` | enum | Frequency | DEFAULT 'instant' |
| `pitchViews` | enum | Frequency | DEFAULT 'daily' |
| `weeklyDigest` | boolean | Weekly digest enabled | DEFAULT true |
| `marketing` | enum | Frequency | DEFAULT 'weekly' |
| `updatedAt` | timestamp | Last update | DEFAULT NOW() |

#### Email Queue (`email_queue`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `toEmail` | varchar(255) | Recipient email | NOT NULL |
| `fromEmail` | varchar(255) | Sender email | NOT NULL |
| `subject` | text | Email subject | NOT NULL |
| `htmlContent` | text | HTML content | |
| `textContent` | text | Plain text content | |
| `status` | enum | Status (pending, sent, failed, bounced) | DEFAULT 'pending' |
| `priority` | integer | Priority level | DEFAULT 5 |
| `attempts` | integer | Send attempts | DEFAULT 0 |
| `sentAt` | timestamp | Send timestamp | |
| `error` | text | Error message | |
| `metadata` | jsonb | Additional data | |
| `scheduledFor` | timestamp | Scheduled send time | |
| `createdAt` | timestamp | Queue date | DEFAULT NOW() |

**Indexes:**
- `email_queue_status_idx` on `status`
- `email_queue_scheduled_idx` on `scheduledFor`

#### Email Events (`email_events`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `emailId` | integer | Email queue ID | FK -> email_queue.id |
| `event` | varchar(50) | Event type (delivered, opened, clicked, bounced) | NOT NULL |
| `timestamp` | timestamp | Event timestamp | DEFAULT NOW() |
| `metadata` | jsonb | Provider data | |

### 9. System Tables

#### Audit Log (`audit_log`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | serial | Primary key | PK, Auto-increment |
| `userId` | integer | User ID | FK -> users.id |
| `action` | varchar(100) | Action performed | NOT NULL |
| `entityType` | varchar(50) | Entity type | |
| `entityId` | integer | Entity ID | |
| `oldValues` | jsonb | Previous values | |
| `newValues` | jsonb | New values | |
| `ipAddress` | varchar(45) | User IP | |
| `userAgent` | text | Browser info | |
| `createdAt` | timestamp | Action timestamp | DEFAULT NOW() |

#### Sessions (`sessions`)

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `id` | uuid | Primary key | PK, DEFAULT gen_random_uuid() |
| `userId` | integer | User ID | FK -> users.id, NOT NULL |
| `token` | text | Session token | NOT NULL, UNIQUE |
| `refreshToken` | text | Refresh token | UNIQUE |
| `ipAddress` | varchar(45) | Session IP | |
| `userAgent` | text | Browser info | |
| `expiresAt` | timestamp | Expiration | NOT NULL |
| `createdAt` | timestamp | Creation date | DEFAULT NOW() |
| `lastActivityAt` | timestamp | Last activity | DEFAULT NOW() |

## Enumerations

### User Type Enum
```sql
CREATE TYPE user_type AS ENUM ('creator', 'production', 'investor', 'viewer');
```

### Subscription Tier Enum
```sql
CREATE TYPE subscription_tier AS ENUM ('free', 'creator', 'pro', 'investor');
```

### Pitch Status Enum
```sql
CREATE TYPE pitch_status AS ENUM ('draft', 'published', 'hidden', 'archived');
```

### NDA Type Enum
```sql
CREATE TYPE nda_type AS ENUM ('basic', 'enhanced', 'custom');
```

### Genre Enum
```sql
CREATE TYPE genre AS ENUM ('drama', 'comedy', 'thriller', 'horror', 'scifi', 
  'fantasy', 'documentary', 'animation', 'action', 'romance', 'other');
```

### Format Enum
```sql
CREATE TYPE format AS ENUM ('feature', 'tv', 'short', 'webseries', 'other');
```

### Notification Frequency Enum
```sql
CREATE TYPE notification_frequency AS ENUM ('instant', 'daily', 'weekly', 'never');
```

### Email Status Enum
```sql
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'delivered', 'bounced', 
  'failed', 'unsubscribed');
```

## Database Relationships

### Primary Relationships

1. **Users → Pitches** (One-to-Many)
   - A user can create multiple pitches
   - Each pitch belongs to one creator

2. **Users → NDAs** (Many-to-Many through NDAs table)
   - Users can request multiple NDAs
   - Users can receive multiple NDA requests

3. **Users → Conversations** (Many-to-Many through conversation_participants)
   - Users can participate in multiple conversations
   - Conversations can have multiple participants

4. **Conversations → Messages** (One-to-Many)
   - A conversation contains multiple messages
   - Each message belongs to one conversation

5. **Pitches → NDAs** (One-to-Many)
   - A pitch can have multiple NDA requests
   - Each NDA request is for one pitch

6. **Users → Follows** (Many-to-Many)
   - Users can follow other users and pitches
   - Users and pitches can have multiple followers

## Indexes Strategy

### Performance Indexes
- Foreign key columns for JOIN operations
- Status and type columns for filtering
- Timestamp columns for sorting
- Search columns for text queries

### Composite Indexes
```sql
CREATE INDEX idx_ndas_pitch_status ON ndas(pitchId, status);
CREATE INDEX idx_messages_conversation_created ON messages(conversationId, createdAt DESC);
CREATE INDEX idx_pitch_views_pitch_date ON pitch_views(pitchId, createdAt DESC);
```

## Migration Management

### Migration Files Location
```
/drizzle/
├── 0000_shallow_medusa.sql       # Initial schema
├── 0001_production_media_update.sql # Media updates
├── 0002_messaging_enhancement.sql   # Messaging system
├── 0003_email_notifications.sql     # Email system
└── meta/
    └── _journal.json              # Migration history
```

### Running Migrations
```bash
# Generate new migration
deno run --allow-all drizzle-kit generate:pg

# Apply migrations
deno run --allow-all src/db/migrate.ts

# Rollback migration
deno run --allow-all src/db/rollback.ts
```

## Performance Optimization

### Query Optimization
1. Use appropriate indexes for frequent queries
2. Implement pagination for large result sets
3. Use EXPLAIN ANALYZE for query planning
4. Consider materialized views for complex aggregations

### Connection Pooling
```javascript
// Configuration in db/client.ts
const pool = new Pool({
  max: 20,                // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy
1. Cache user sessions in memory/Redis
2. Cache frequently accessed pitches
3. Cache NDA status checks
4. Implement query result caching

## Backup and Recovery

### Backup Strategy
```bash
# Daily backups
pg_dump pitchey_production > backup_$(date +%Y%m%d).sql

# Point-in-time recovery with WAL archiving
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
```

### Recovery Procedures
1. Stop application servers
2. Restore from backup
3. Apply WAL logs if needed
4. Verify data integrity
5. Restart application servers

## Security Considerations

### Data Encryption
- Passwords: bcrypt with 12 salt rounds
- Sensitive data: AES-256 encryption
- SSL/TLS for database connections
- Encrypted backups

### Access Control
- Row-level security for multi-tenancy
- Role-based access control
- Audit logging for sensitive operations
- Regular security audits

### Data Privacy
- GDPR compliance with data deletion
- PII encryption and access logging
- Data retention policies
- User consent tracking

## Monitoring and Maintenance

### Key Metrics to Monitor
1. Query performance (slow query log)
2. Connection pool utilization
3. Table sizes and growth rates
4. Index usage statistics
5. Replication lag (if applicable)

### Maintenance Tasks
```sql
-- Weekly vacuum and analyze
VACUUM ANALYZE;

-- Monthly reindex
REINDEX DATABASE pitchey_production;

-- Quarterly statistics update
ANALYZE;
```

## Future Considerations

### Scalability Options
1. **Read Replicas**: For read-heavy workloads
2. **Partitioning**: For large tables (pitch_views, analytics_events)
3. **Sharding**: For horizontal scaling
4. **Caching Layer**: Redis/Memcached integration

### Schema Evolution
1. Version control for migrations
2. Blue-green deployments for schema changes
3. Feature flags for gradual rollouts
4. Backward compatibility requirements

---

*Last Updated: January 2025*
*Database Version: 2.0.0*