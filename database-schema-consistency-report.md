# Database Schema Consistency Analysis Report
## Pitchey Platform - Neon PostgreSQL Database

**Generated:** 2026-01-20
**Database:** Neon PostgreSQL (eu-west-2)
**Total Tables:** 179
**Analysis Scope:** Schema integrity, referential consistency, performance optimization

---

## Executive Summary

### Overall Health: ⚠️ MODERATE RISK

The Pitchey database schema shows **good foundational structure** with comprehensive foreign key constraints and proper cascade configurations. However, several **critical consistency risks** and **missing schema components** require immediate attention to prevent data integrity issues and performance degradation.

**Critical Findings:**
- ✅ No orphaned records detected in current data
- ⚠️ 6 critical nullable foreign keys that should be NOT NULL
- ⚠️ Missing schema tables from TypeScript definitions (10+ tables)
- ⚠️ Duplicate authentication tables causing confusion
- ⚠️ 23 tables without foreign key constraints (orphan risk)
- ✅ Proper CASCADE DELETE configurations on most relationships
- ⚠️ Missing indexes on high-traffic columns

---

## 1. Schema Integrity Issues

### 1.1 Critical: Nullable Foreign Keys (HIGH PRIORITY)

The following foreign keys are nullable but should be NOT NULL to prevent orphaned records:

```sql
-- ISSUE: These foreign keys allow NULL values, creating orphan risk
-- Table: investments
ALTER TABLE investments ALTER COLUMN investor_id SET NOT NULL;
ALTER TABLE investments ALTER COLUMN pitch_id SET NOT NULL;

-- Table: messages
ALTER TABLE messages ALTER COLUMN conversation_id SET NOT NULL;
-- Note: pitch_id can remain nullable as messages may not be pitch-related

-- Table: ndas
ALTER TABLE ndas ALTER COLUMN user_id SET NOT NULL;

-- Table: pitches
ALTER TABLE pitches ALTER COLUMN user_id SET NOT NULL;
```

**Impact:** Without NOT NULL constraints, these tables can accumulate orphaned records if application-level validation fails.

**Recommendation:** Apply these constraints after validating existing data has no NULL values.

---

### 1.2 Missing Schema Tables (CRITICAL)

**TypeScript schema files define tables that don't exist in the database:**

#### Email Schema (email.schema.ts) - Missing 11 tables:
- `email_logs` - Email tracking and delivery status
- `email_templates` - Reusable email templates
- `email_tracking_events` - Granular event tracking
- `email_suppressions` - Bounce/complaint management
- `email_webhooks` - Provider webhook events
- `email_lists` - Recipient list management
- `email_list_subscribers` - Many-to-many subscriptions
- `email_ab_tests` - A/B testing campaigns
- `email_health_metrics` - Service health monitoring
- `email_unsubscribe_requests` - Unsubscribe tracking
- `email_analytics_summary` - Pre-computed analytics

**Existing:** `email_campaigns`, `email_preferences`, `email_queue`

#### Messaging Schema (messaging.schema.ts) - Missing 5 tables:
- `message_attachments` - File attachment support
- `message_reactions` - Emoji reactions
- `message_encryption_keys` - E2E encryption keys
- `message_search_index` - Full-text search
- `conversation_settings` - Per-user preferences

**Existing:** `messages`, `conversations`, `conversation_participants`, `message_read_receipts`, `typing_indicators`, `blocked_users`

#### Notification Schema (notification.schema.ts) - Missing 4 tables:
- `notification_deliveries` - Multi-channel delivery tracking
- `notification_logs` - Debugging and analytics
- `notification_templates` - Template management
- `notification_digests` - Batched notifications
- `notification_metrics` - Analytics and metrics

**Existing:** `notifications`, `notification_preferences`

**Impact:** Application code expecting these tables will fail at runtime. Features like email tracking, message attachments, and notification analytics are partially implemented.

**Recommendation:**
1. Review if these tables are actually needed based on current features
2. If needed, create migration scripts from schema definitions
3. If not needed, remove from TypeScript schema files to avoid confusion

---

### 1.3 Duplicate Authentication Tables (MODERATE PRIORITY)

The database contains duplicate tables from Better Auth migration:

| Legacy Table | Better Auth Table | Column Count | Status |
|-------------|-------------------|--------------|---------|
| `users` | `user` | 102 vs 6 | ⚠️ Confusion risk |
| `sessions` | `session` | 8 vs 8 | ⚠️ Duplicate |
| `accounts` | `account` | 12 vs 13 | ⚠️ Duplicate |

**Issues:**
- Foreign keys reference both `users` and `user` tables
- Application code may query wrong table
- Data synchronization burden
- Migration incomplete

**Recommendation:**
1. Verify Better Auth migration is complete (as per CLAUDE.md, this was done Dec 2024)
2. Migrate all foreign keys to reference Better Auth tables (`user`, not `users`)
3. Archive legacy tables or drop after confirming no usage
4. Update application code to use consistent table references

---

## 2. Referential Integrity Analysis

### 2.1 Foreign Key Cascade Configuration ✅

**Excellent:** Most foreign keys use appropriate cascade rules:

```sql
-- Proper CASCADE DELETE for dependent records
users -> pitches: ON DELETE CASCADE  ✅
users -> messages: ON DELETE CASCADE ✅
users -> investments: ON DELETE CASCADE ✅
pitches -> ndas: ON DELETE CASCADE ✅
pitches -> pitch_views: ON DELETE CASCADE ✅

-- Proper SET NULL for soft references
pitches -> users.creator_id: ON DELETE NO ACTION ⚠️ (should be CASCADE)
pitch_views -> users.viewer_id: ON DELETE SET NULL ✅
```

**Issue Found:** Some `pitches` table constraints use `NO ACTION` instead of `CASCADE`:
```sql
-- Current (problematic):
pitches.creator_id -> users.id: ON DELETE NO ACTION

-- Should be:
pitches.user_id -> users.id: ON DELETE CASCADE ✅ (already correct)
```

---

### 2.2 Tables Without Foreign Keys (ORPHAN RISK)

**23 tables have NO foreign key constraints:**

**High Risk (should have FKs):**
- `user` - Better Auth table, needs FK to roles/permissions
- `portfolio` - Should reference users.id and pitches.id
- `production_companies` - Should reference users.id for ownership
- `documents` - Should reference users.id and pitches.id
- `ai_analyses` - Should reference pitches.id or users.id

**Low Risk (lookup/config tables):**
- `roles`, `permissions`, `content_types` - Static/lookup data
- `translation_keys`, `ldap_groups` - Configuration
- `cdn_cache`, `trending_cache`, `websocket_sessions` - Temporary data

**Recommendation:**
```sql
-- Add foreign keys to high-risk tables
ALTER TABLE portfolio ADD CONSTRAINT portfolio_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE portfolio ADD CONSTRAINT portfolio_pitch_id_fk
  FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE;

ALTER TABLE production_companies ADD CONSTRAINT production_companies_owner_id_fk
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE documents ADD CONSTRAINT documents_owner_id_fk
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE documents ADD CONSTRAINT documents_pitch_id_fk
  FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE;
```

---

## 3. Performance and Indexing

### 3.1 Missing Indexes on High-Traffic Columns

**Analysis of query patterns shows missing indexes:**

#### Messages Table:
```sql
-- Currently indexed: conversation_id, sender_id
-- Missing indexes:
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_recipient_unread ON messages(recipient_id, is_read)
  WHERE is_read = false;
```

#### Notifications Table:
```sql
-- Currently indexed: user_id, type, is_read
-- Missing composite indexes:
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC)
  WHERE is_read = false;
CREATE INDEX idx_notifications_user_type_unread ON notifications(user_id, type, is_read);
```

#### Analytics Events:
```sql
-- High correlation on created_at (0.994) - good for range queries
-- Missing indexes:
CREATE INDEX idx_analytics_events_pitch_created ON analytics_events(pitch_id, created_at DESC);
CREATE INDEX idx_analytics_events_user_event ON analytics_events(user_id, event_type);
```

#### Pitch Views:
```sql
-- Missing composite indexes for common queries:
CREATE INDEX idx_pitch_views_pitch_date ON pitch_views(pitch_id, viewed_at DESC);
CREATE INDEX idx_pitch_views_viewer_date ON pitch_views(viewer_id, viewed_at DESC);
```

---

### 3.2 Index Recommendations Priority

**Priority 1 (Immediate):**
1. `notifications(user_id, is_read, created_at)` - User notification feed
2. `messages(conversation_id, created_at)` - Message timeline
3. `pitch_views(pitch_id, viewed_at)` - Analytics dashboard

**Priority 2 (High):**
4. `analytics_events(pitch_id, created_at)` - Pitch analytics
5. `investments(investor_id, status)` - Portfolio queries
6. `ndas(pitch_id, signer_id, signed_at)` - NDA verification

**Priority 3 (Medium):**
7. `users(email, email_verified)` - Authentication lookups
8. `pitches(status, published_at)` - Browse/discovery queries
9. `follows(follower_id, created_at)` - User activity feed

---

## 4. Enum Consistency Analysis

### 4.1 Enum Definitions ✅

**Good:** Enums are well-defined and consistent:

```sql
-- Format enum matches schema.ts
format: feature, tv, short, webseries, other ✅

-- Genre enum matches schema.ts
genre: drama, comedy, thriller, horror, scifi, fantasy,
       documentary, animation, action, romance, other ✅

-- Pitch status matches schema.ts
pitch_status: draft, published, archived, hidden ✅

-- User type matches schema.ts
user_type: creator, production, investor ✅
```

### 4.2 Enum Issues Found

**Duplicate subscription tier enums:**
```sql
subscription_tier: free, pro, enterprise
subscription_tier_new: BASIC, PRO, ENTERPRISE  -- Case mismatch!
```

**Recommendation:**
```sql
-- Migrate all usage to consistent enum
ALTER TABLE users ALTER COLUMN subscription_tier
  TYPE subscription_tier_new USING subscription_tier::text::subscription_tier_new;

-- Drop old enum
DROP TYPE subscription_tier;
ALTER TYPE subscription_tier_new RENAME TO subscription_tier;
```

**Missing enum from email.schema.ts:**
The TypeScript schema defines these enums not present in database:
- `email_provider`: sendgrid, awsSes
- `email_status`: (different values than current)
- `email_priority`: high, normal, low
- `queue_status`: pending, processing, completed, failed
- `campaign_status`: draft, scheduled, sending, sent, paused, cancelled
- `suppression_type`: bounce, complaint, unsubscribe, manual
- `ab_test_status`: draft, running, completed, cancelled
- `health_status`: healthy, warning, critical, down

**Impact:** If email tables are created, these enums must be created first.

---

## 5. Data Consistency Validation

### 5.1 Orphaned Records Check ✅

**Excellent:** No orphaned records found in production data:

```sql
✅ messages without conversation: 0
✅ participants without conversation: 0
✅ notifications with deleted users: 0
✅ investments without pitch: 0
✅ ndas without pitch: 0
```

**Note:** This is good current state, but nullable foreign keys create future risk.

---

### 5.2 Potential Consistency Problems

#### Problem 1: Messages Table Ambiguity
```sql
-- messages table has BOTH:
conversation_id (nullable)
pitch_id (nullable)

-- This creates ambiguity:
-- - Is this a conversation message or direct pitch message?
-- - Application logic must handle both cases
-- - Risk of messages not linked to either
```

**Recommendation:**
```sql
-- Add check constraint to ensure at least one is set
ALTER TABLE messages ADD CONSTRAINT messages_context_check
  CHECK (conversation_id IS NOT NULL OR pitch_id IS NOT NULL);
```

#### Problem 2: Better Auth Integration Incomplete

The migration from JWT to Better Auth (Dec 2024) appears incomplete:
- Legacy `users` table still has 102 columns
- New `user` table only has 6 columns
- Foreign keys reference both tables
- Risk of data inconsistency

**Recommendation:**
1. Audit all foreign keys referencing `users` table
2. Create migration to consolidate to Better Auth tables
3. Test authentication flows thoroughly
4. Remove legacy tables after validation

---

## 6. Schema Migration Status

### 6.1 Applied Migrations

**Base migration:** `0000_shallow_medusa.sql` ✅
**Latest migration:** Multiple migrations up to 0012 series

**Migration files found:**
- 19 migration files in `drizzle/` directory
- Multiple `.disabled` files suggesting rolled-back migrations
- Numerous ad-hoc SQL scripts in root directory (50+)

**Concern:** Ad-hoc migrations create risk:
- `fix-*.sql` files suggest schema issues
- `create-*.sql` files bypass migration system
- `add-*.sql` files not tracked in migration table

### 6.2 Pending Schema Changes

Based on TypeScript schema files, these changes appear pending:

**Email system:** 11 tables need creation
**Messaging enhancements:** 5 tables need creation
**Notification system:** 4 tables need creation
**Total pending:** 20+ tables from schema definitions

**Recommendation:**
1. Review if these tables are actually needed
2. Create proper Drizzle migrations (not ad-hoc SQL)
3. Test migrations in staging before production
4. Clean up disabled/failed migration files

---

## 7. Recommendations by Priority

### 🔴 CRITICAL (Implement Immediately)

1. **Add NOT NULL constraints to foreign keys**
   ```sql
   ALTER TABLE investments ALTER COLUMN investor_id SET NOT NULL;
   ALTER TABLE investments ALTER COLUMN pitch_id SET NOT NULL;
   ALTER TABLE messages ALTER COLUMN conversation_id SET NOT NULL;
   ALTER TABLE ndas ALTER COLUMN user_id SET NOT NULL;
   ALTER TABLE pitches ALTER COLUMN user_id SET NOT NULL;
   ```

2. **Add check constraint for message context**
   ```sql
   ALTER TABLE messages ADD CONSTRAINT messages_context_check
     CHECK (conversation_id IS NOT NULL OR pitch_id IS NOT NULL);
   ```

3. **Create missing indexes for notifications**
   ```sql
   CREATE INDEX idx_notifications_user_unread
     ON notifications(user_id, created_at DESC)
     WHERE is_read = false;
   ```

### 🟡 HIGH PRIORITY (Implement This Week)

4. **Resolve Better Auth table duplication**
   - Consolidate `users` and `user` tables
   - Update all foreign key references
   - Remove legacy tables

5. **Add foreign keys to orphaned tables**
   ```sql
   -- portfolio, production_companies, documents
   -- See section 2.2 for full list
   ```

6. **Create critical performance indexes**
   ```sql
   -- messages, pitch_views, analytics_events
   -- See section 3.1 for full list
   ```

7. **Resolve enum duplication**
   ```sql
   -- subscription_tier vs subscription_tier_new
   ```

### 🟢 MEDIUM PRIORITY (Implement This Month)

8. **Review and implement missing schema tables**
   - Email system tables (if needed)
   - Messaging enhancements (if needed)
   - Notification system tables (if needed)

9. **Clean up migration files**
   - Remove `.disabled` migrations
   - Archive ad-hoc SQL scripts
   - Create proper migration tracking

10. **Add additional performance indexes**
    - See section 3.2 Priority 2 and 3

### 🔵 LOW PRIORITY (Ongoing Maintenance)

11. **Set up automated schema validation**
    - Compare TypeScript schemas to database
    - Alert on drift between code and database
    - Automated migration testing

12. **Implement connection pooling monitoring**
    - Track connection usage
    - Alert on pool exhaustion
    - Optimize query patterns

13. **Regular vacuum and analyze**
    - Schedule maintenance windows
    - Monitor table bloat
    - Update statistics for query planner

---

## 8. Maintenance and Monitoring Recommendations

### 8.1 Database Administration Scripts

**Create these monitoring queries:**

```sql
-- Check for orphaned records daily
CREATE OR REPLACE FUNCTION check_orphaned_records()
RETURNS TABLE(check_name TEXT, orphan_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 'messages without conversation'::TEXT, COUNT(*)
  FROM messages m
  LEFT JOIN conversations c ON m.conversation_id = c.id
  WHERE m.conversation_id IS NOT NULL AND c.id IS NULL

  UNION ALL

  SELECT 'investments without pitch', COUNT(*)
  FROM investments i
  LEFT JOIN pitches p ON i.pitch_id = p.id
  WHERE i.pitch_id IS NOT NULL AND p.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC
LIMIT 20;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 8.2 Backup and Recovery

**Current setup:**
- Neon PostgreSQL with built-in point-in-time recovery
- Connection pooling via Neon's pooler

**Recommendations:**
1. Test restore procedures monthly
2. Document RTO/RPO requirements
3. Create disaster recovery runbook
4. Set up automated backup verification

### 8.3 Performance Monitoring

**Key metrics to track:**
- Connection pool usage (alert at 80%)
- Query response times (p95, p99)
- Table bloat percentage
- Index hit ratio (should be >99%)
- Replication lag (if using read replicas)

---

## 9. Security Considerations

### 9.1 Current Security Posture ✅

**Good practices observed:**
- Foreign keys enforce referential integrity
- CASCADE DELETE prevents orphaned sensitive data
- Better Auth provides session-based authentication
- SSL/TLS required for connections

### 9.2 Security Recommendations

1. **Implement row-level security (RLS)**
   ```sql
   -- Example for pitches table
   ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;

   CREATE POLICY pitch_owner_policy ON pitches
     FOR ALL
     USING (user_id = current_user_id());
   ```

2. **Audit sensitive operations**
   ```sql
   -- Track NDA access
   CREATE TRIGGER nda_access_audit
     AFTER UPDATE OR DELETE ON ndas
     FOR EACH ROW
     EXECUTE FUNCTION audit_nda_access();
   ```

3. **Encrypt sensitive columns**
   - Consider pgcrypto for `messages.encrypted_content`
   - Encryption keys in `message_encryption_keys`
   - Password hashes in authentication tables

---

## 10. Conclusion

### Summary of Findings

**Strengths:**
✅ Comprehensive foreign key relationships
✅ Proper cascade delete configurations
✅ No orphaned records in current data
✅ Well-structured enum types
✅ Good index coverage on primary access patterns

**Critical Issues:**
⚠️ Nullable foreign keys creating orphan risk
⚠️ Missing 20+ schema tables from TypeScript definitions
⚠️ Duplicate authentication tables from incomplete migration
⚠️ 23 tables without foreign key constraints
⚠️ Missing critical performance indexes

**Overall Assessment:**
The database is **operationally functional** but has **architectural debt** that requires attention. The schema shows signs of rapid development with ad-hoc migrations bypassing proper migration controls. Immediate action on nullable foreign keys and Better Auth consolidation is recommended.

### Next Steps

1. **Week 1:** Apply critical NOT NULL constraints and check constraints
2. **Week 2:** Resolve Better Auth table duplication
3. **Week 3:** Add missing foreign keys to high-risk tables
4. **Week 4:** Create critical performance indexes
5. **Month 2:** Review and implement missing schema tables
6. **Ongoing:** Regular monitoring and maintenance

---

## Appendix A: SQL Scripts

See accompanying files:
- `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/fix-critical-constraints.sql` - Critical fixes
- `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/add-performance-indexes.sql` - Index creation
- `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/schema-validation.sql` - Validation queries

---

**Report Generated By:** Claude Code (Database Administrator)
**Analysis Date:** 2026-01-20
**Database Version:** PostgreSQL 15.x (Neon)
**Total Tables Analyzed:** 179
**Total Foreign Keys Checked:** 200+
**Total Indexes Reviewed:** 150+
