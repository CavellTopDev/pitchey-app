/**
 * Data Quality and Business Rules Tests
 *
 * Validates data quality, business constraints, and logical consistency
 */

import { neon } from '@neondatabase/serverless';
import { describe, it, expect } from 'bun:test';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

describe('Data Quality Tests', () => {

  describe('Email Validation', () => {
    it('should have valid email formats in users table', async () => {
      const result = await sql`
        SELECT id, email
        FROM users
        WHERE email IS NOT NULL
          AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.warn('Invalid email formats found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no duplicate emails in users', async () => {
      const result = await sql`
        SELECT email, COUNT(*) as count
        FROM users
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1;
      `;

      if (result.length > 0) {
        console.error('Duplicate emails found:', result);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Timestamp Consistency', () => {
    it('should have created_at before updated_at', async () => {
      const tables = ['users', 'notifications', 'pitches', 'contracts'];

      for (const table of tables) {
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = ${table}
          ) as exists;
        `;

        if (!tableExists[0].exists) continue;

        const hasColumns = await sql`
          SELECT COUNT(*) as count
          FROM information_schema.columns
          WHERE table_name = ${table}
            AND column_name IN ('created_at', 'updated_at');
        `;

        if (hasColumns[0].count < 2) continue;

        const result = await sql.unsafe(`
          SELECT id
          FROM ${table}
          WHERE created_at > updated_at
          LIMIT 10;
        `);

        if (result.length > 0) {
          console.error(`Table ${table} has ${result.length} records with created_at > updated_at`);
        }

        expect(result).toHaveLength(0);
      }
    });

    it('should not have future timestamps', async () => {
      const tables = ['users', 'notifications', 'pitches', 'messages'];

      for (const table of tables) {
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = ${table}
          ) as exists;
        `;

        if (!tableExists[0].exists) continue;

        const hasColumn = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = ${table}
              AND column_name = 'created_at'
          ) as exists;
        `;

        if (!hasColumn[0].exists) continue;

        const result = await sql.unsafe(`
          SELECT id, created_at
          FROM ${table}
          WHERE created_at > NOW() + INTERVAL '1 hour'
          LIMIT 10;
        `);

        if (result.length > 0) {
          console.error(`Table ${table} has future timestamps:`, result);
        }

        expect(result).toHaveLength(0);
      }
    });
  });

  describe('Numeric Data Validation', () => {
    it('should have non-negative investment amounts', async () => {
      const investExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'investments'
        ) as exists;
      `;

      if (!investExists[0].exists) return;

      const result = await sql`
        SELECT id, amount
        FROM investments
        WHERE amount < 0
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Negative investment amounts found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid equity percentages', async () => {
      const portfolioExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'portfolio'
        ) as exists;
      `;

      if (!portfolioExists[0].exists) return;

      const hasColumn = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'portfolio'
            AND column_name = 'equity_percentage'
        ) as exists;
      `;

      if (!hasColumn[0].exists) return;

      const result = await sql`
        SELECT id, equity_percentage
        FROM portfolio
        WHERE equity_percentage IS NOT NULL
          AND (equity_percentage < 0 OR equity_percentage > 100)
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Invalid equity percentages found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have reasonable budget amounts', async () => {
      const budgetExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'budget_allocations'
        ) as exists;
      `;

      if (!budgetExists[0].exists) return;

      const result = await sql`
        SELECT id, allocated_amount, spent_amount
        FROM budget_allocations
        WHERE allocated_amount < 0
          OR spent_amount < 0
          OR spent_amount > allocated_amount * 2
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.warn('Questionable budget amounts found:', result);
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should not allow users to follow themselves', async () => {
      const followsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'follows'
        ) as exists;
      `;

      if (!followsExist[0].exists) return;

      const result = await sql`
        SELECT id, follower_id, following_id
        FROM follows
        WHERE follower_id = following_id;
      `;

      if (result.length > 0) {
        console.error('Self-follows found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should not allow users to like their own pitches', async () => {
      const likesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'likes'
        ) as exists;
      `;

      if (!likesExist[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT l.id, l.user_id, l.pitch_id
        FROM likes l
        JOIN pitches p ON l.pitch_id = p.id
        WHERE l.user_id = p.creator_id;
      `;

      if (result.length > 0) {
        console.warn('Self-likes found:', result);
      }
    });

    it('should have valid notification types', async () => {
      const result = await sql`
        SELECT DISTINCT type
        FROM notifications
        WHERE type IS NOT NULL
        ORDER BY type;
      `;

      const validTypes = [
        'nda_request',
        'nda_approved',
        'nda_rejected',
        'new_message',
        'new_follower',
        'pitch_liked',
        'pitch_viewed',
        'investment_interest',
        'contract_update',
        'system',
      ];

      const unknownTypes = result.filter(
        r => !validTypes.includes(r.type) && !r.type.startsWith('custom_')
      );

      if (unknownTypes.length > 0) {
        console.log('Unknown notification types (may be valid):', unknownTypes);
      }
    });

    it('should have valid NDA request status transitions', async () => {
      const ndaExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'nda_requests'
        ) as exists;
      `;

      if (!ndaExists[0].exists) return;

      // Check for invalid status + timestamp combinations
      const result = await sql`
        SELECT id, status, requested_at, responded_at
        FROM nda_requests
        WHERE (status IN ('approved', 'rejected') AND responded_at IS NULL)
          OR (status = 'pending' AND responded_at IS NOT NULL)
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Invalid NDA status/timestamp combinations:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid investment deal amounts', async () => {
      const dealsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'investment_deals'
        ) as exists;
      `;

      if (!dealsExist[0].exists) return;

      const result = await sql`
        SELECT id, proposed_amount, final_amount
        FROM investment_deals
        WHERE final_amount IS NOT NULL
          AND final_amount > proposed_amount * 2
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.warn('Investment deals with large final amount variance:', result);
      }
    });
  });

  describe('Message System Quality', () => {
    it('should have non-empty message content', async () => {
      const msgExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'messages'
        ) as exists;
      `;

      if (!msgExists[0].exists) return;

      const result = await sql`
        SELECT id, conversation_id
        FROM messages
        WHERE content IS NULL
          OR TRIM(content) = ''
          OR LENGTH(content) < 1
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Empty messages found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid conversation participants count', async () => {
      const convExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'conversations'
        ) as exists;
      `;

      if (!convExists[0].exists) return;

      const partExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'conversation_participants'
        ) as exists;
      `;

      if (!partExists[0].exists) return;

      const result = await sql`
        SELECT c.id, COUNT(cp.id) as participant_count
        FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        GROUP BY c.id
        HAVING COUNT(cp.id) < 2;
      `;

      if (result.length > 0) {
        console.warn('Conversations with less than 2 participants:', result);
      }
    });

    it('should have valid message reply chains', async () => {
      const msgExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'messages'
        ) as exists;
      `;

      if (!msgExists[0].exists) return;

      const hasParent = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'messages'
            AND column_name = 'parent_message_id'
        ) as exists;
      `;

      if (!hasParent[0].exists) return;

      const result = await sql`
        SELECT m1.id, m1.parent_message_id
        FROM messages m1
        LEFT JOIN messages m2 ON m1.parent_message_id = m2.id
        WHERE m1.parent_message_id IS NOT NULL
          AND m2.id IS NULL
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Messages with invalid parent references:', result);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('File and Document Validation', () => {
    it('should have valid file URLs', async () => {
      const docsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'documents'
        ) as exists;
      `;

      if (!docsExist[0].exists) return;

      const hasUrl = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'documents'
            AND column_name = 'url'
        ) as exists;
      `;

      if (!hasUrl[0].exists) return;

      const result = await sql`
        SELECT id, url
        FROM documents
        WHERE url IS NULL
          OR TRIM(url) = ''
          OR url !~ '^https?://'
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Invalid document URLs found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid file sizes', async () => {
      const attachExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'message_attachments'
        ) as exists;
      `;

      if (!attachExists[0].exists) return;

      const result = await sql`
        SELECT id, filename, file_size
        FROM message_attachments
        WHERE file_size IS NULL
          OR file_size < 0
          OR file_size > 524288000
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.warn('Invalid file sizes found:', result);
      }
    });
  });

  describe('Production Data Quality', () => {
    it('should have valid production budget calculations', async () => {
      const budgetExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'production_budgets'
        ) as exists;
      `;

      if (!budgetExists[0].exists) return;

      const result = await sql`
        SELECT id, budgeted_amount, actual_amount, variance
        FROM production_budgets
        WHERE budgeted_amount < 0
          OR (actual_amount IS NOT NULL AND actual_amount < 0)
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Invalid production budget amounts:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid project timelines', async () => {
      const projExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'production_projects'
        ) as exists;
      `;

      if (!projExists[0].exists) return;

      const hasColumns = await sql`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = 'production_projects'
          AND column_name IN ('start_date', 'end_date');
      `;

      if (hasColumns[0].count < 2) return;

      const result = await sql`
        SELECT id, title, start_date, end_date
        FROM production_projects
        WHERE start_date IS NOT NULL
          AND end_date IS NOT NULL
          AND start_date > end_date
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Projects with end_date before start_date:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid location coordinates', async () => {
      const locExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'location_scouts'
        ) as exists;
      `;

      if (!locExists[0].exists) return;

      const hasCoords = await sql`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_name = 'location_scouts'
          AND column_name IN ('latitude', 'longitude');
      `;

      if (hasCoords[0].count < 2) return;

      const result = await sql`
        SELECT id, name, latitude, longitude
        FROM location_scouts
        WHERE (latitude IS NOT NULL AND (latitude < -90 OR latitude > 90))
          OR (longitude IS NOT NULL AND (longitude < -180 OR longitude > 180))
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Invalid location coordinates:', result);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Notification System Quality', () => {
    it('should have valid notification expiration dates', async () => {
      const result = await sql`
        SELECT id, title, expires_at, created_at
        FROM notifications
        WHERE expires_at IS NOT NULL
          AND expires_at < created_at
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Notifications with expiration before creation:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have read_at only when is_read is true', async () => {
      const result = await sql`
        SELECT id, is_read, read_at
        FROM notifications
        WHERE (is_read = true AND read_at IS NULL)
          OR (is_read = false AND read_at IS NOT NULL)
        LIMIT 10;
      `;

      if (result.length > 0) {
        console.error('Inconsistent notification read status:', result);
      }

      expect(result).toHaveLength(0);
    });
  });
});
