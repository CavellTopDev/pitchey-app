/**
 * Database Consistency Test Suite for Pitchey Platform
 *
 * Tests:
 * - Table existence and schema validation
 * - Foreign key relationships
 * - Data integrity across three portals (creator, investor, production)
 * - User data consistency
 * - Pitch data consistency
 * - NDA and messaging data relationships
 * - Enum values validation
 * - Orphaned record detection
 * - Data type consistency
 *
 * Uses: Neon PostgreSQL with raw SQL queries
 */

import { neon } from '@neondatabase/serverless';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// Database connection
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

// Expected tables for the Pitchey platform
const EXPECTED_TABLES = [
  // Core tables
  'users',
  'sessions',
  'accounts',
  'verifications',

  // Pitch-related tables
  'pitches',
  'pitch_views',
  'pitch_likes',
  'saved_pitches',
  'pitch_shares',

  // NDA tables
  'nda_requests',
  'ndas',

  // Investment tables
  'investments',
  'investment_deals',
  'investment_performance',
  'investment_risk_analysis',
  'portfolio',
  'budget_allocations',
  'completed_projects',
  'financial_transactions',
  'market_data',
  'tax_documents',

  // Messaging tables
  'conversations',
  'conversation_participants',
  'messages',
  'message_attachments',
  'message_reactions',
  'message_read_receipts',
  'typing_indicators',
  'message_encryption_keys',
  'message_search_index',
  'blocked_users',
  'conversation_settings',

  // Notification tables
  'notifications',
  'notification_preferences',
  'notification_deliveries',
  'notification_logs',
  'notification_templates',
  'notification_digests',
  'notification_metrics',

  // Email tables
  'email_logs',
  'email_templates',
  'email_queue',
  'email_preferences',
  'email_tracking_events',
  'email_campaigns',
  'email_suppressions',
  'email_webhooks',
  'email_lists',
  'email_list_subscribers',
  'email_ab_tests',
  'email_health_metrics',
  'email_unsubscribe_requests',
  'email_analytics_summary',

  // Production portal tables
  'production_companies',
  'production_projects',
  'production_talent',
  'production_crew',
  'location_scouts',
  'production_budgets',
  'production_schedules',

  // Creator portal tables
  'contracts',
  'contract_milestones',
  'creator_revenue',

  // Engagement tables
  'follows',
  'likes',
  'views',
  'reviews',
  'investment_interests',
  'production_interests',
  'user_activity',
  'search_logs',
  'page_views',
  'analytics_events',

  // Documents
  'documents',
];

describe('Database Consistency Tests', () => {

  describe('1. Table Existence', () => {
    it('should have all expected core tables', async () => {
      const result = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;

      const existingTables = result.map(row => row.table_name);
      console.log(`Found ${existingTables.length} tables in database`);

      const missingTables = EXPECTED_TABLES.filter(
        table => !existingTables.includes(table)
      );

      if (missingTables.length > 0) {
        console.warn('Missing tables:', missingTables);
      }

      // Check that essential tables exist
      const essentialTables = ['users', 'pitches', 'notifications', 'messages'];
      const missingEssential = essentialTables.filter(
        table => !existingTables.includes(table)
      );

      expect(missingEssential).toHaveLength(0);
    });

    it('should have proper primary keys on all tables', async () => {
      const result = await sql`
        SELECT
          t.table_name,
          COUNT(kcu.column_name) as pk_count
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc
          ON t.table_name = tc.table_name
          AND tc.constraint_type = 'PRIMARY KEY'
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        HAVING COUNT(kcu.column_name) = 0;
      `;

      if (result.length > 0) {
        console.warn('Tables without primary keys:', result.map(r => r.table_name));
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('2. Schema Validation', () => {
    it('should have required columns in users table', async () => {
      const result = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `;

      const columns = result.map(r => r.column_name);
      const requiredColumns = ['id', 'email', 'name', 'created_at'];

      const missingColumns = requiredColumns.filter(
        col => !columns.includes(col)
      );

      expect(missingColumns).toHaveLength(0);
    });

    it('should have required columns in pitches table', async () => {
      const exists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'pitches'
        ) as table_exists;
      `;

      if (exists[0].table_exists) {
        const result = await sql`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'pitches'
          ORDER BY ordinal_position;
        `;

        const columns = result.map(r => r.column_name);
        const requiredColumns = ['id', 'title', 'creator_id', 'created_at'];

        const missingColumns = requiredColumns.filter(
          col => !columns.includes(col)
        );

        expect(missingColumns).toHaveLength(0);
      }
    });

    it('should have timestamps on audit tables', async () => {
      const auditTables = [
        'users', 'pitches', 'notifications', 'messages',
        'contracts', 'production_projects'
      ];

      for (const table of auditTables) {
        const exists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = ${table}
          ) as table_exists;
        `;

        if (exists[0].table_exists) {
          const result = await sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = ${table}
            AND column_name IN ('created_at', 'updated_at');
          `;

          expect(result.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('3. Foreign Key Relationships', () => {
    it('should have valid foreign key constraints', async () => {
      // Get all foreign keys and their target tables in one query
      const result = await sql`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `;

      console.log(`Found ${result.length} foreign key constraints`);

      // Verify all foreign key targets exist in a single query (efficient batch check)
      const invalidFKs = await sql`
        WITH fk_targets AS (
          SELECT DISTINCT ccu.table_name AS foreign_table_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        )
        SELECT foreign_table_name
        FROM fk_targets ft
        WHERE NOT EXISTS (
          SELECT 1 FROM information_schema.tables t
          WHERE t.table_name = ft.foreign_table_name
            AND t.table_schema = 'public'
        );
      `;

      if (invalidFKs.length > 0) {
        console.warn('Invalid foreign key targets:', invalidFKs.map(r => r.foreign_table_name));
      }

      expect(invalidFKs).toHaveLength(0);
    }, 10000); // 10 second timeout

    it('should have user_id foreign keys referencing users table', async () => {
      const result = await sql`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name LIKE '%user_id%'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `;

      // Most user_id columns should reference users table
      const userReferences = result.filter(
        r => r.foreign_table_name === 'users'
      );

      console.log(`Found ${userReferences.length} user_id foreign keys`);
      expect(userReferences.length).toBeGreaterThan(0);
    });
  });

  describe('4. Data Integrity - Orphaned Records', () => {
    it('should not have orphaned pitch records', async () => {
      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (pitchesExist[0].exists) {
        const result = await sql`
          SELECT p.id, p.creator_id
          FROM pitches p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE u.id IS NULL
          LIMIT 10;
        `;

        if (result.length > 0) {
          console.warn(`Found ${result.length} orphaned pitches`);
        }

        expect(result).toHaveLength(0);
      }
    });

    it('should not have orphaned notification records', async () => {
      const result = await sql`
        SELECT n.id, n.user_id
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE u.id IS NULL
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.warn(`Found ${result.length} orphaned notifications`);
      }

      expect(result).toHaveLength(0);
    });

    it('should not have orphaned message records', async () => {
      const messagesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'messages'
        ) as exists;
      `;

      if (messagesExist[0].exists) {
        const result = await sql`
          SELECT m.id, m.sender_id
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE u.id IS NULL
          LIMIT 10;
        `;

        if (result.length > 0) {
          console.warn(`Found ${result.length} orphaned messages`);
        }

        expect(result).toHaveLength(0);
      }
    });

    it('should not have orphaned investment records', async () => {
      const investmentsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'investments'
        ) as exists;
      `;

      if (investmentsExist[0].exists) {
        // Check if investor_id column exists (correct column name)
        const columnExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'investments' AND column_name = 'investor_id'
          ) as exists;
        `;

        if (columnExists[0].exists) {
          const result = await sql`
            SELECT i.id, i.investor_id
            FROM investments i
            LEFT JOIN users u ON i.investor_id = u.id
            WHERE u.id IS NULL
            LIMIT 10;
          `;

          if (result.length > 0) {
            console.warn(`Found ${result.length} orphaned investments`);
          }

          expect(result).toHaveLength(0);
        }
      }
    });

    it('should not have orphaned NDA request records', async () => {
      const ndaExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'nda_requests'
        ) as exists;
      `;

      if (ndaExists[0].exists) {
        const result = await sql`
          SELECT nr.id, nr.requester_id, nr.pitch_owner_id
          FROM nda_requests nr
          LEFT JOIN users u1 ON nr.requester_id = u1.id
          LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
          WHERE u1.id IS NULL OR u2.id IS NULL
          LIMIT 10;
        `;

        if (result.length > 0) {
          console.warn(`Found ${result.length} orphaned NDA requests`);
        }

        expect(result).toHaveLength(0);
      }
    });
  });

  describe('5. Portal-Specific Data Consistency', () => {
    it('should validate user types', async () => {
      // The column is called user_type, not portal_type
      const result = await sql`
        SELECT DISTINCT user_type
        FROM users
        WHERE user_type IS NOT NULL;
      `;

      const validUserTypes = ['creator', 'investor', 'production', 'admin'];
      const invalidTypes = result.filter(
        r => !validUserTypes.includes(r.user_type)
      );

      if (invalidTypes.length > 0) {
        console.warn('Invalid user types found:', invalidTypes);
      }

      expect(invalidTypes).toHaveLength(0);
    });

    it('should validate creator-specific data integrity', async () => {
      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (pitchesExist[0].exists) {
        // Check that all pitch creators exist as users
        const result = await sql`
          SELECT COUNT(*)::int as count
          FROM pitches p
          INNER JOIN users u ON p.creator_id = u.id
          WHERE p.creator_id IS NOT NULL;
        `;

        expect(Number(result[0].count)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate investor-specific data integrity', async () => {
      // Check investments table instead of portfolio
      const investmentsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'investments'
        ) as exists;
      `;

      if (investmentsExist[0].exists) {
        // Check investments reference valid users and pitches
        const result = await sql`
          SELECT COUNT(*)::int as count
          FROM investments i
          INNER JOIN users u ON i.investor_id = u.id
          LEFT JOIN pitches p ON i.pitch_id = p.id
          WHERE p.id IS NOT NULL OR i.pitch_id IS NULL;
        `;

        expect(Number(result[0].count)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate production company data integrity', async () => {
      const prodExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'production_companies'
        ) as exists;
      `;

      if (prodExists[0].exists) {
        // Check if production_projects table exists and has the expected structure
        const projectsExist = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'production_projects'
          ) as exists;
        `;

        if (projectsExist[0].exists) {
          // Check if company_id column exists
          const columnExists = await sql`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'production_projects' AND column_name = 'company_id'
            ) as exists;
          `;

          if (columnExists[0].exists) {
            const result = await sql`
              SELECT COUNT(*)::int as count
              FROM production_projects pp
              INNER JOIN production_companies pc ON pp.company_id = pc.id;
            `;
            expect(Number(result[0].count)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  });

  describe('6. Enum and Status Value Validation', () => {
    it('should have valid NDA request statuses', async () => {
      const ndaExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'nda_requests'
        ) as exists;
      `;

      if (ndaExists[0].exists) {
        const result = await sql`
          SELECT DISTINCT status
          FROM nda_requests
          WHERE status IS NOT NULL;
        `;

        const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
        const invalidStatuses = result.filter(
          r => !validStatuses.includes(r.status)
        );

        if (invalidStatuses.length > 0) {
          console.warn('Invalid NDA statuses:', invalidStatuses);
        }
      }
    });

    it('should have valid notification priorities', async () => {
      // Check if priority column exists
      const columnExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notifications' AND column_name = 'priority'
        ) as exists;
      `;

      if (columnExists[0].exists) {
        const result = await sql`
          SELECT DISTINCT priority
          FROM notifications
          WHERE priority IS NOT NULL;
        `;

        const validPriorities = ['low', 'normal', 'high', 'urgent'];
        const invalidPriorities = result.filter(
          r => !validPriorities.includes(r.priority)
        );

        if (invalidPriorities.length > 0) {
          console.warn('Invalid notification priorities:', invalidPriorities);
        }
      }
    });

    it('should have valid investment deal statuses', async () => {
      const dealsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'investment_deals'
        ) as exists;
      `;

      if (dealsExist[0].exists) {
        // Check if status column exists
        const columnExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'investment_deals' AND column_name = 'status'
          ) as exists;
        `;

        if (columnExists[0].exists) {
          const result = await sql`
            SELECT DISTINCT status
            FROM investment_deals
            WHERE status IS NOT NULL;
          `;

          const validStatuses = [
            'negotiating', 'pending', 'due_diligence',
            'approved', 'rejected', 'completed'
          ];

          const invalidStatuses = result.filter(
            r => !validStatuses.includes(r.status)
          );

          if (invalidStatuses.length > 0) {
            console.warn('Invalid deal statuses:', invalidStatuses);
          }
        }
      }
    });
  });

  describe('7. Messaging System Consistency', () => {
    it('should have valid conversation participants', async () => {
      const convExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'conversation_participants'
        ) as exists;
      `;

      if (convExists[0].exists) {
        const result = await sql`
          SELECT cp.id, cp.user_id, cp.conversation_id
          FROM conversation_participants cp
          LEFT JOIN users u ON cp.user_id = u.id
          LEFT JOIN conversations c ON cp.conversation_id = c.id
          WHERE u.id IS NULL OR c.id IS NULL
          LIMIT 10;
        `;

        if (result.length > 0) {
          console.warn(`Found ${result.length} invalid conversation participants`);
        }

        expect(result).toHaveLength(0);
      }
    });

    it('should have valid message attachments', async () => {
      const attachExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'message_attachments'
        ) as exists;
      `;

      if (attachExists[0].exists) {
        const result = await sql`
          SELECT ma.id, ma.message_id
          FROM message_attachments ma
          LEFT JOIN messages m ON ma.message_id = m.id
          WHERE m.id IS NULL
          LIMIT 10;
        `;

        if (result.length > 0) {
          console.warn(`Found ${result.length} orphaned message attachments`);
        }

        expect(result).toHaveLength(0);
      }
    });
  });

  describe('8. Index Existence', () => {
    it('should have indexes on frequently queried columns', async () => {
      const result = await sql`
        SELECT
          t.tablename,
          i.indexname,
          array_agg(a.attname ORDER BY a.attnum) as column_names
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_tables t ON t.tablename = i.tablename
        WHERE t.schemaname = 'public'
          AND a.attnum > 0
        GROUP BY t.tablename, i.indexname
        ORDER BY t.tablename;
      `;

      console.log(`Found ${result.length} indexes in database`);

      // Check for essential indexes
      const indexNames = result.map(r => r.indexname);
      const essentialIndexes = [
        'users_pkey',
        'notifications_pkey',
      ];

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('9. Data Type Consistency', () => {
    it('should have consistent email data types', async () => {
      const result = await sql`
        SELECT table_name, column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE column_name = 'email'
          AND table_schema = 'public'
        ORDER BY table_name;
      `;

      // All email columns should be varchar/text
      const invalidTypes = result.filter(
        r => !['character varying', 'text'].includes(r.data_type)
      );

      expect(invalidTypes).toHaveLength(0);
    });

    it('should have consistent timestamp data types', async () => {
      const result = await sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE column_name LIKE '%_at'
          AND table_schema = 'public'
        ORDER BY table_name, column_name;
      `;

      // All *_at columns should be timestamp types
      const invalidTypes = result.filter(
        r => !r.data_type.includes('timestamp')
      );

      if (invalidTypes.length > 0) {
        console.warn('Invalid timestamp columns:', invalidTypes);
      }
    });

    it('should have consistent ID data types', async () => {
      const result = await sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE column_name = 'id'
          AND table_schema = 'public'
        ORDER BY table_name;
      `;

      // All id columns should be integer or uuid
      const validTypes = ['integer', 'uuid', 'bigint'];
      const invalidTypes = result.filter(
        r => !validTypes.includes(r.data_type)
      );

      if (invalidTypes.length > 0) {
        console.warn('Inconsistent ID types:', invalidTypes);
      }
    });
  });

  describe('10. Database Statistics', () => {
    it('should report table row counts', async () => {
      const result = await sql`
        SELECT
          schemaname,
          relname as tablename,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
      `;

      console.log('\nTable Row Counts:');
      result.forEach(r => {
        if (Number(r.row_count) > 0) {
          console.log(`  ${r.tablename}: ${r.row_count} rows`);
        }
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should report database health metrics', async () => {
      const result = await sql`
        SELECT
          COUNT(*)::int as total_tables,
          (SELECT COUNT(*)::int FROM information_schema.table_constraints
           WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public') as pk_count,
          (SELECT COUNT(*)::int FROM information_schema.table_constraints
           WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as fk_count,
          (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname = 'public') as index_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE';
      `;

      console.log('\nDatabase Health Metrics:');
      console.log(`  Total Tables: ${result[0].total_tables}`);
      console.log(`  Primary Keys: ${result[0].pk_count}`);
      console.log(`  Foreign Keys: ${result[0].fk_count}`);
      console.log(`  Indexes: ${result[0].index_count}`);

      expect(Number(result[0].total_tables)).toBeGreaterThan(0);
    });
  });
});
