import { db } from './src/db/client.ts';
import { sql } from "npm:drizzle-orm@0.35.3";

console.log('=== CREATING TEST DATA FOR NDA WORKFLOW ===');

async function createTestData() {
  try {
    // Create demo creator user  
    console.log('1. Creating demo creator...');
    const creatorResult = await db.execute(sql`
      INSERT INTO users (email, username, password_hash, user_type, first_name, last_name)
      VALUES ('demo.creator@test.com', 'democreator', '$2b$10$rN7GGN8vfU0Ey2fNfKPQy.1234567890123456789012345678', 'creator', 'Demo', 'Creator')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING id, email
    `);
    const creatorId = creatorResult[0]?.id;
    console.log('✅ Creator created/updated:', creatorResult[0]?.email, 'ID:', creatorId);

    // Create demo investor user
    console.log('2. Creating demo investor...');
    const investorResult = await db.execute(sql`
      INSERT INTO users (email, username, password_hash, user_type, first_name, last_name)
      VALUES ('demo.investor@test.com', 'demoinvestor', '$2b$10$rN7GGN8vfU0Ey2fNfKPQy.1234567890123456789012345678', 'investor', 'Demo', 'Investor')
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING id, email
    `);
    const investorId = investorResult[0]?.id;
    console.log('✅ Investor created/updated:', investorResult[0]?.email, 'ID:', investorId);

    // Create demo pitch with NDA requirement
    console.log('3. Creating demo pitch...');
    const pitchResult = await db.execute(sql`
      INSERT INTO pitches (
        user_id, title, logline, genre, format, short_synopsis, 
        require_nda, status, world_description
      )
      VALUES (
        ${creatorId}, 
        'The Last Screenwriter', 
        'In a world where AI writes all scripts, one human writer fights to preserve the art of storytelling.',
        'Sci-Fi Drama',
        'Feature Film',
        'Set in 2030, this story follows Maya, the last human screenwriter, as she battles against AI-generated content that has taken over Hollywood.',
        true,
        'active',
        'A dystopian future where artificial intelligence has revolutionized the entertainment industry. Studios rely entirely on AI algorithms to generate scripts, leaving human creativity obsolete. The world is filled with sterile, algorithmically perfect content that lacks soul and genuine human emotion.'
      )
      ON CONFLICT DO NOTHING
      RETURNING id, title
    `);
    
    let pitchId = pitchResult[0]?.id;
    
    if (!pitchId) {
      // Pitch might already exist, let's get it
      const existingPitch = await db.execute(sql`
        SELECT id, title FROM pitches WHERE user_id = ${creatorId} LIMIT 1
      `);
      pitchId = existingPitch[0]?.id;
    }
    
    console.log('✅ Pitch created/found:', pitchResult[0]?.title || 'existing pitch', 'ID:', pitchId);

    // Verify data creation
    console.log('\n4. Verifying test data...');
    const verifyUsers = await db.execute(sql`
      SELECT id, email, user_type FROM users 
      WHERE email IN ('demo.creator@test.com', 'demo.investor@test.com')
    `);
    
    const verifyPitches = await db.execute(sql`
      SELECT id, title, require_nda, world_description FROM pitches 
      WHERE user_id = ${creatorId}
    `);

    console.log('Demo users created:');
    verifyUsers.forEach(user => console.log(`  - ${user.email} (${user.user_type}) ID: ${user.id}`));
    
    console.log('Demo pitches created:');
    verifyPitches.forEach(pitch => console.log(`  - ${pitch.title} (NDA: ${pitch.require_nda}) ID: ${pitch.id}`));

    if (verifyPitches[0]?.world_description) {
      console.log('  - World description:', verifyPitches[0].world_description.substring(0, 100) + '...');
    }

    console.log('\n✅ Test data creation completed successfully!');
    console.log('Ready to test NDA workflow with:');
    console.log(`  - Creator ID: ${creatorId}`);
    console.log(`  - Investor ID: ${investorId}`);
    console.log(`  - Pitch ID: ${pitchId}`);

  } catch (error) {
    console.error('❌ Test data creation failed:', error);
    console.error('Error details:', error.message);
  }
}

await createTestData();
Deno.exit(0);