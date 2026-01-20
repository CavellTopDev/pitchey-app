/**
 * Referential Integrity Tests
 *
 * Deep validation of foreign key relationships and cascade behaviors
 */

import { neon } from '@neondatabase/serverless';
import { describe, it, expect } from 'bun:test';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

describe('Referential Integrity Tests', () => {

  describe('User Relationships', () => {
    it('should have no orphaned pitches without creators', async () => {
      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          p.id,
          p.title,
          p.creator_id
        FROM pitches p
        LEFT JOIN users u ON p.creator_id = u.id
        WHERE p.creator_id IS NOT NULL
          AND u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error('Orphaned pitches found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no orphaned follows', async () => {
      const followsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'follows'
        ) as exists;
      `;

      if (!followsExist[0].exists) return;

      const result = await sql`
        SELECT
          f.id,
          f.follower_id,
          f.following_id
        FROM follows f
        LEFT JOIN users u1 ON f.follower_id = u1.id
        LEFT JOIN users u2 ON f.following_id = u2.id
        WHERE u1.id IS NULL OR u2.id IS NULL;
      `;

      if (result.length > 0) {
        console.error('Orphaned follows found:', result);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no orphaned sessions', async () => {
      const sessionsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions'
        ) as exists;
      `;

      if (!sessionsExist[0].exists) return;

      const result = await sql`
        SELECT
          s.id,
          s.user_id
        FROM sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.user_id IS NOT NULL
          AND u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error('Orphaned sessions found:', result);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Pitch Relationships', () => {
    it('should have no orphaned pitch views', async () => {
      const viewsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'views'
        ) as exists;
      `;

      if (!viewsExist[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          v.id,
          v.pitch_id
        FROM views v
        LEFT JOIN pitches p ON v.pitch_id = p.id
        WHERE p.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned pitch views`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no orphaned pitch likes', async () => {
      const likesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'likes'
        ) as exists;
      `;

      if (!likesExist[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          l.id,
          l.pitch_id,
          l.user_id
        FROM likes l
        LEFT JOIN pitches p ON l.pitch_id = p.id
        LEFT JOIN users u ON l.user_id = u.id
        WHERE p.id IS NULL OR u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned pitch likes`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no orphaned saved pitches', async () => {
      const savedExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_pitches'
        ) as exists;
      `;

      if (!savedExist[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          sp.id,
          sp.pitch_id,
          sp.user_id
        FROM saved_pitches sp
        LEFT JOIN pitches p ON sp.pitch_id = p.id
        LEFT JOIN users u ON sp.user_id = u.id
        WHERE p.id IS NULL OR u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned saved pitches`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('NDA Relationships', () => {
    it('should have valid NDA request relationships', async () => {
      const ndaExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'nda_requests'
        ) as exists;
      `;

      if (!ndaExists[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          nr.id,
          nr.requester_id,
          nr.pitch_id,
          nr.pitch_owner_id
        FROM nda_requests nr
        LEFT JOIN users u1 ON nr.requester_id = u1.id
        LEFT JOIN pitches p ON nr.pitch_id = p.id
        LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
        WHERE u1.id IS NULL OR p.id IS NULL OR u2.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid NDA requests`);
      }

      expect(result).toHaveLength(0);
    });

    it('should verify NDA requester is not the pitch owner', async () => {
      const ndaExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'nda_requests'
        ) as exists;
      `;

      if (!ndaExists[0].exists) return;

      const result = await sql`
        SELECT
          id,
          requester_id,
          pitch_owner_id
        FROM nda_requests
        WHERE requester_id = pitch_owner_id;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} self-NDA requests`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Investment Relationships', () => {
    it('should have valid portfolio entries', async () => {
      const portfolioExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'portfolio'
        ) as exists;
      `;

      if (!portfolioExists[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          p.id,
          p.investor_id,
          p.pitch_id
        FROM portfolio p
        LEFT JOIN users u ON p.investor_id = u.id
        LEFT JOIN pitches pt ON p.pitch_id = pt.id
        WHERE u.id IS NULL OR pt.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid portfolio entries`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid investment deals', async () => {
      const dealsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'investment_deals'
        ) as exists;
      `;

      if (!dealsExist[0].exists) return;

      const pitchesExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches'
        ) as exists;
      `;

      if (!pitchesExist[0].exists) return;

      const result = await sql`
        SELECT
          id.id,
          id.investor_id,
          id.pitch_id
        FROM investment_deals id
        LEFT JOIN users u ON id.investor_id = u.id
        LEFT JOIN pitches p ON id.pitch_id = p.id
        WHERE u.id IS NULL OR p.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid investment deals`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have no orphaned investment performance records', async () => {
      const perfExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'investment_performance'
        ) as exists;
      `;

      if (!perfExists[0].exists) return;

      const investExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'investments'
        ) as exists;
      `;

      if (!investExists[0].exists) return;

      const result = await sql`
        SELECT
          ip.id,
          ip.investment_id
        FROM investment_performance ip
        LEFT JOIN investments i ON ip.investment_id = i.id
        WHERE i.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned investment performance records`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Messaging Relationships', () => {
    it('should have valid conversation participants', async () => {
      const partExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_participants'
        ) as exists;
      `;

      if (!partExists[0].exists) return;

      const convExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations'
        ) as exists;
      `;

      if (!convExists[0].exists) return;

      const result = await sql`
        SELECT
          cp.id,
          cp.conversation_id,
          cp.user_id
        FROM conversation_participants cp
        LEFT JOIN conversations c ON cp.conversation_id = c.id
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE c.id IS NULL OR u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid conversation participants`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid messages in conversations', async () => {
      const msgExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'messages'
        ) as exists;
      `;

      if (!msgExists[0].exists) return;

      const convExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations'
        ) as exists;
      `;

      if (!convExists[0].exists) return;

      const result = await sql`
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id
        FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE c.id IS NULL OR u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid messages`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid message read receipts', async () => {
      const receiptsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'message_read_receipts'
        ) as exists;
      `;

      if (!receiptsExist[0].exists) return;

      const msgExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'messages'
        ) as exists;
      `;

      if (!msgExists[0].exists) return;

      const result = await sql`
        SELECT
          mrr.id,
          mrr.message_id,
          mrr.user_id
        FROM message_read_receipts mrr
        LEFT JOIN messages m ON mrr.message_id = m.id
        LEFT JOIN users u ON mrr.user_id = u.id
        WHERE m.id IS NULL OR u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} invalid message read receipts`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Production Portal Relationships', () => {
    it('should have valid production projects', async () => {
      const projExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'production_projects'
        ) as exists;
      `;

      if (!projExists[0].exists) return;

      const compExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'production_companies'
        ) as exists;
      `;

      if (!compExists[0].exists) return;

      const result = await sql`
        SELECT
          pp.id,
          pp.company_id
        FROM production_projects pp
        LEFT JOIN production_companies pc ON pp.company_id = pc.id
        WHERE pc.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned production projects`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid production budgets', async () => {
      const budgetExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'production_budgets'
        ) as exists;
      `;

      if (!budgetExists[0].exists) return;

      const projExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'production_projects'
        ) as exists;
      `;

      if (!projExists[0].exists) return;

      const result = await sql`
        SELECT
          pb.id,
          pb.project_id
        FROM production_budgets pb
        LEFT JOIN production_projects pp ON pb.project_id = pp.id
        WHERE pp.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned production budgets`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Contract Relationships', () => {
    it('should have valid contracts with creators', async () => {
      const contractExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts'
        ) as exists;
      `;

      if (!contractExists[0].exists) return;

      const result = await sql`
        SELECT
          c.id,
          c.creator_id
        FROM contracts c
        LEFT JOIN users u ON c.creator_id = u.id
        WHERE u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned contracts`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid contract milestones', async () => {
      const milestoneExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_milestones'
        ) as exists;
      `;

      if (!milestoneExists[0].exists) return;

      const contractExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts'
        ) as exists;
      `;

      if (!contractExists[0].exists) return;

      const result = await sql`
        SELECT
          cm.id,
          cm.contract_id
        FROM contract_milestones cm
        LEFT JOIN contracts c ON cm.contract_id = c.id
        WHERE c.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned contract milestones`);
      }

      expect(result).toHaveLength(0);
    });
  });

  describe('Email System Relationships', () => {
    it('should have valid email preferences for users', async () => {
      const prefExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'email_preferences'
        ) as exists;
      `;

      if (!prefExists[0].exists) return;

      const result = await sql`
        SELECT
          ep.id,
          ep.user_id
        FROM email_preferences ep
        LEFT JOIN users u ON ep.user_id = u.id
        WHERE u.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned email preferences`);
      }

      expect(result).toHaveLength(0);
    });

    it('should have valid email tracking events', async () => {
      const trackExists = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'email_tracking_events'
        ) as exists;
      `;

      if (!trackExists[0].exists) return;

      const logsExist = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs'
        ) as exists;
      `;

      if (!logsExist[0].exists) return;

      const result = await sql`
        SELECT
          ete.id,
          ete.email_log_id
        FROM email_tracking_events ete
        LEFT JOIN email_logs el ON ete.email_log_id = el.id
        WHERE el.id IS NULL;
      `;

      if (result.length > 0) {
        console.error(`Found ${result.length} orphaned email tracking events`);
      }

      expect(result).toHaveLength(0);
    });
  });
});
