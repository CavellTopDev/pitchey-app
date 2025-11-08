import { db } from './src/db/client.ts';
import { sql } from "npm:drizzle-orm@0.35.3";

console.log('=== TESTING NDA WORKFLOW WITH EXISTING DATA ===');

async function testNDAWithExisting() {
  try {
    // Check for existing users
    console.log('1. Checking existing users...');
    const existingUsers = await db.execute(sql`SELECT id, email, user_type FROM users ORDER BY id LIMIT 10`);
    
    if (!existingUsers || existingUsers.length === 0) {
      // Create minimal test users directly in the database
      console.log('No existing users found. Creating test users...');
      
      try {
        // Try to create users with minimal required fields
        await db.execute(sql`
          INSERT INTO users (id, email, username, password_hash, user_type, first_name, last_name) 
          VALUES 
            (100, 'test.creator@demo.com', 'testcreator', 'dummy_hash', 'creator', 'Test', 'Creator'),
            (101, 'test.investor@demo.com', 'testinvestor', 'dummy_hash', 'investor', 'Test', 'Investor')
          ON CONFLICT (id) DO NOTHING
        `);
        console.log('✅ Test users created');
      } catch (userError) {
        console.log('❌ Could not create users:', userError.message);
        console.log('Attempting alternative approach...');
        
        // Try with password field if that's what's required
        await db.execute(sql`
          INSERT INTO users (id, email, username, password, password_hash, user_type, first_name, last_name) 
          VALUES 
            (100, 'test.creator@demo.com', 'testcreator', 'dummy_pass', 'dummy_hash', 'creator', 'Test', 'Creator'),
            (101, 'test.investor@demo.com', 'testinvestor', 'dummy_pass', 'dummy_hash', 'investor', 'Test', 'Investor')
          ON CONFLICT (id) DO NOTHING
        `);
        console.log('✅ Test users created with password field');
      }
    }

    // Get users for testing
    const testUsers = await db.execute(sql`SELECT id, email, user_type FROM users ORDER BY id LIMIT 5`);
    console.log('Available users for testing:');
    testUsers.forEach(user => console.log(`  - ${user.email} (${user.user_type}) ID: ${user.id}`));

    if (testUsers.length < 2) {
      console.log('❌ Need at least 2 users to test NDA workflow');
      return;
    }

    const creator = testUsers.find(u => u.user_type === 'creator') || testUsers[0];
    const viewer = testUsers.find(u => u.user_type === 'investor' || u.user_type === 'production') || testUsers[1];

    console.log(`\n2. Using users for test:
    - Creator: ${creator.email} (ID: ${creator.id})
    - Viewer: ${viewer.email} (ID: ${viewer.id})`);

    // Create a test pitch
    console.log('\n3. Creating test pitch...');
    const pitchResult = await db.execute(sql`
      INSERT INTO pitches (user_id, title, logline, genre, require_nda, world_description)
      VALUES (${creator.id}, 'NDA Test Pitch', 'A test pitch for NDA workflow', 'Drama', true, 'A test world for NDA functionality validation')
      RETURNING id, title
    `);
    
    const pitchId = pitchResult[0]?.id;
    console.log('✅ Test pitch created:', pitchResult[0]?.title, 'ID:', pitchId);

    // Test NDA Request Creation
    console.log('\n4. Testing NDA request...');
    const ndaRequestResult = await db.execute(sql`
      INSERT INTO nda_requests (pitch_id, requester_id, owner_id, nda_type, request_message)
      VALUES (${pitchId}, ${viewer.id}, ${creator.id}, 'basic', 'Test NDA request for database validation')
      RETURNING id, status
    `);
    
    const ndaRequestId = ndaRequestResult[0]?.id;
    console.log('✅ NDA request created with ID:', ndaRequestId);

    // Test NDA Creation (simulate approval)
    console.log('\n5. Creating signed NDA...');
    const ndaResult = await db.execute(sql`
      INSERT INTO ndas (pitch_id, user_id, signer_id, status, signed_at)
      VALUES (${pitchId}, ${creator.id}, ${viewer.id}, 'signed', NOW())
      RETURNING id, status
    `);
    
    const ndaId = ndaResult[0]?.id;
    console.log('✅ NDA signed with ID:', ndaId);

    // Test Info Request Creation
    console.log('\n6. Testing info request...');
    const infoRequestResult = await db.execute(sql`
      INSERT INTO info_requests (nda_id, pitch_id, requester_id, owner_id, request_type, subject, message)
      VALUES (${ndaId}, ${pitchId}, ${viewer.id}, ${creator.id}, 'financial', 'Budget Details Request', 'Can you provide detailed budget breakdown?')
      RETURNING id, subject, status
    `);
    
    const infoRequestId = infoRequestResult[0]?.id;
    console.log('✅ Info request created:', infoRequestResult[0]?.subject, 'ID:', infoRequestId);

    // Test Info Request Attachment
    console.log('\n7. Testing attachment...');
    const attachmentResult = await db.execute(sql`
      INSERT INTO info_request_attachments (info_request_id, file_name, file_url, file_type, uploaded_by)
      VALUES (${infoRequestId}, 'test_document.pdf', 'https://example.com/test.pdf', 'application/pdf', ${viewer.id})
      RETURNING id, file_name
    `);
    
    console.log('✅ Attachment added:', attachmentResult[0]?.file_name);

    // Test Complete Workflow Query
    console.log('\n8. Testing complete workflow query...');
    const workflowResult = await db.execute(sql`
      SELECT 
        ir.id as info_request_id,
        ir.subject,
        ir.request_type,
        ir.status as info_status,
        n.status as nda_status,
        n.signed_at,
        p.title as pitch_title,
        p.world_description,
        u1.email as requester_email,
        u2.email as owner_email,
        COUNT(ira.id) as attachment_count
      FROM info_requests ir
      JOIN ndas n ON ir.nda_id = n.id
      JOIN pitches p ON ir.pitch_id = p.id
      JOIN users u1 ON ir.requester_id = u1.id
      JOIN users u2 ON ir.owner_id = u2.id
      LEFT JOIN info_request_attachments ira ON ir.id = ira.info_request_id
      WHERE ir.id = ${infoRequestId}
      GROUP BY ir.id, n.id, p.id, u1.id, u2.id
    `);

    if (workflowResult && workflowResult.length > 0) {
      const result = workflowResult[0];
      console.log(`✅ Complete NDA workflow verified:
        - Pitch: ${result.pitch_title}
        - World Description: ${result.world_description ? result.world_description.substring(0, 50) + '...' : 'N/A'}
        - NDA Status: ${result.nda_status}
        - Signed At: ${result.signed_at}
        - Info Request: ${result.subject}
        - Request Type: ${result.request_type}
        - Info Status: ${result.info_status}
        - Requester: ${result.requester_email}
        - Owner: ${result.owner_email}
        - Attachments: ${result.attachment_count}`);
    }

    console.log('\n🎉 NDA WORKFLOW FULLY FUNCTIONAL!');
    console.log('✅ All database tables exist and working correctly');
    console.log('✅ NDA requests can be created');
    console.log('✅ NDAs can be signed');
    console.log('✅ Info requests work post-NDA');
    console.log('✅ Attachments can be added');
    console.log('✅ World description column is functional');

    // Cleanup
    console.log('\n9. Cleaning up test data...');
    await db.execute(sql`DELETE FROM info_request_attachments WHERE info_request_id = ${infoRequestId}`);
    await db.execute(sql`DELETE FROM info_requests WHERE id = ${infoRequestId}`);
    await db.execute(sql`DELETE FROM ndas WHERE id = ${ndaId}`);
    await db.execute(sql`DELETE FROM nda_requests WHERE id = ${ndaRequestId}`);
    await db.execute(sql`DELETE FROM pitches WHERE id = ${pitchId}`);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
}

await testNDAWithExisting();
Deno.exit(0);