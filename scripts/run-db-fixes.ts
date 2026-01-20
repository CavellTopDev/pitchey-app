/**
 * Database Consistency Fix Script
 * Run with: bun run scripts/run-db-fixes.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function fixDatabaseConsistency() {
  console.log('Starting database consistency fixes...\n');

  try {
    // 1. Check for orphaned pitches
    console.log('1. Checking for orphaned pitch records...');
    const orphanedPitches = await sql`
      SELECT p.id, p.title, p.creator_id, p.created_at
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      WHERE u.id IS NULL
    `;
    console.log(`   Found ${orphanedPitches.length} orphaned pitches`);

    if (orphanedPitches.length > 0) {
      console.log('   Deleting orphaned pitches...');
      // First delete related records
      await sql`
        DELETE FROM pitch_views WHERE pitch_id IN (
          SELECT p.id FROM pitches p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE u.id IS NULL
        )
      `;
      await sql`
        DELETE FROM pitch_likes WHERE pitch_id IN (
          SELECT p.id FROM pitches p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE u.id IS NULL
        )
      `;
      await sql`
        DELETE FROM saved_pitches WHERE pitch_id IN (
          SELECT p.id FROM pitches p
          LEFT JOIN users u ON p.creator_id = u.id
          WHERE u.id IS NULL
        )
      `;
      // Delete the orphaned pitches (use LEFT JOIN approach to handle NULLs)
      const deletedPitches = await sql`
        DELETE FROM pitches p
        USING (
          SELECT p2.id
          FROM pitches p2
          LEFT JOIN users u ON p2.creator_id = u.id
          WHERE u.id IS NULL
        ) orphans
        WHERE p.id = orphans.id
        RETURNING p.id
      `;
      console.log(`   ✅ Deleted ${deletedPitches.length} orphaned pitches`);
    } else {
      console.log('   ✅ No orphaned pitches found');
    }

    // 2. Check for orphaned NDA requests
    console.log('\n2. Checking for orphaned NDA request records...');
    const orphanedNDAs = await sql`
      SELECT nr.id, nr.requester_id, nr.pitch_owner_id, nr.created_at
      FROM nda_requests nr
      LEFT JOIN users u1 ON nr.requester_id = u1.id
      LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
      WHERE u1.id IS NULL OR u2.id IS NULL
    `;
    console.log(`   Found ${orphanedNDAs.length} orphaned NDA requests`);

    if (orphanedNDAs.length > 0) {
      console.log('   Deleting orphaned NDA requests...');
      const deletedNDAs = await sql`
        DELETE FROM nda_requests nr
        USING (
          SELECT nr2.id
          FROM nda_requests nr2
          LEFT JOIN users u1 ON nr2.requester_id = u1.id
          LEFT JOIN users u2 ON nr2.pitch_owner_id = u2.id
          WHERE u1.id IS NULL OR u2.id IS NULL
        ) orphans
        WHERE nr.id = orphans.id
        RETURNING nr.id
      `;
      console.log(`   ✅ Deleted ${deletedNDAs.length} orphaned NDA requests`);
    } else {
      console.log('   ✅ No orphaned NDA requests found');
    }

    // 3. Check for orphaned investments
    console.log('\n3. Checking for orphaned investment records...');
    const orphanedInvestments = await sql`
      SELECT i.id, i.investor_id, i.pitch_id
      FROM investments i
      LEFT JOIN users u ON i.investor_id = u.id
      WHERE u.id IS NULL
    `;
    console.log(`   Found ${orphanedInvestments.length} orphaned investments`);

    if (orphanedInvestments.length > 0) {
      console.log('   Deleting orphaned investments...');
      const deletedInvestments = await sql`
        DELETE FROM investments
        WHERE investor_id NOT IN (SELECT id FROM users)
        RETURNING id
      `;
      console.log(`   ✅ Deleted ${deletedInvestments.length} orphaned investments`);
    } else {
      console.log('   ✅ No orphaned investments found');
    }

    // 4. Check for orphaned notifications
    console.log('\n4. Checking for orphaned notification records...');
    const orphanedNotifications = await sql`
      SELECT n.id, n.user_id
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE u.id IS NULL
    `;
    console.log(`   Found ${orphanedNotifications.length} orphaned notifications`);

    if (orphanedNotifications.length > 0) {
      console.log('   Deleting orphaned notifications...');
      const deletedNotifications = await sql`
        DELETE FROM notifications
        WHERE user_id NOT IN (SELECT id FROM users)
        RETURNING id
      `;
      console.log(`   ✅ Deleted ${deletedNotifications.length} orphaned notifications`);
    } else {
      console.log('   ✅ No orphaned notifications found');
    }

    // 5. Check for orphaned messages
    console.log('\n5. Checking for orphaned message records...');
    const orphanedMessages = await sql`
      SELECT m.id, m.sender_id
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE u.id IS NULL
    `;
    console.log(`   Found ${orphanedMessages.length} orphaned messages`);

    if (orphanedMessages.length > 0) {
      console.log('   Deleting orphaned messages...');
      const deletedMessages = await sql`
        DELETE FROM messages
        WHERE sender_id NOT IN (SELECT id FROM users)
        RETURNING id
      `;
      console.log(`   ✅ Deleted ${deletedMessages.length} orphaned messages`);
    } else {
      console.log('   ✅ No orphaned messages found');
    }

    // 6. Final verification
    console.log('\n6. Final verification...');

    const verifyPitches = await sql`
      SELECT COUNT(*) as count FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      WHERE u.id IS NULL
    `;

    const verifyNDAs = await sql`
      SELECT COUNT(*) as count FROM nda_requests nr
      LEFT JOIN users u1 ON nr.requester_id = u1.id
      LEFT JOIN users u2 ON nr.pitch_owner_id = u2.id
      WHERE u1.id IS NULL OR u2.id IS NULL
    `;

    const verifyInvestments = await sql`
      SELECT COUNT(*) as count FROM investments i
      LEFT JOIN users u ON i.investor_id = u.id
      WHERE u.id IS NULL
    `;

    console.log(`   Orphaned pitches remaining: ${verifyPitches[0].count}`);
    console.log(`   Orphaned NDAs remaining: ${verifyNDAs[0].count}`);
    console.log(`   Orphaned investments remaining: ${verifyInvestments[0].count}`);

    // 7. Database health summary
    console.log('\n7. Database health summary:');
    const healthMetrics = await sql`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM pitches) as total_pitches,
        (SELECT COUNT(*) FROM investments) as total_investments,
        (SELECT COUNT(*) FROM nda_requests) as total_nda_requests,
        (SELECT COUNT(*) FROM notifications) as total_notifications,
        (SELECT COUNT(*) FROM messages) as total_messages
    `;

    const metrics = healthMetrics[0];
    console.log(`   Users: ${metrics.total_users}`);
    console.log(`   Pitches: ${metrics.total_pitches}`);
    console.log(`   Investments: ${metrics.total_investments}`);
    console.log(`   NDA Requests: ${metrics.total_nda_requests}`);
    console.log(`   Notifications: ${metrics.total_notifications}`);
    console.log(`   Messages: ${metrics.total_messages}`);

    console.log('\n✅ Database consistency fixes completed successfully!');

  } catch (error) {
    console.error('❌ Error during database fixes:', error);
    process.exit(1);
  }
}

fixDatabaseConsistency();
