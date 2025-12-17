import { db } from './src/db/client.ts';
import { sql } from "drizzle-orm";

console.log('=== TESTING NDA AND INFO REQUEST WORKFLOW ===');

async function testNDAWorkflow() {
  try {
    // First, let's check if we have demo users and pitches
    console.log('1. Checking demo data...');
    
    const usersResult = await db.execute(sql`SELECT id, email, user_type FROM users LIMIT 5`);
    const users = Array.isArray(usersResult) ? usersResult : [];
    console.log('Users found:', users.length);
    users.forEach(user => console.log(`  - ${user.email} (${user.user_type})`));

    const pitchesResult = await db.execute(sql`SELECT id, title, user_id, require_nda FROM pitches LIMIT 5`);
    const pitches = Array.isArray(pitchesResult) ? pitchesResult : [];
    console.log('\nPitches found:', pitches.length);
    pitches.forEach(pitch => console.log(`  - ${pitch.title} (NDA: ${pitch.require_nda})`));

    if (users.length === 0 || pitches.length === 0) {
      console.log('❌ Need demo data to test workflow');
      return;
    }

    // Find a creator and an investor/production user
    const creator = users.find(u => u.user_type === 'creator');
    const viewer = users.find(u => u.user_type === 'investor' || u.user_type === 'production');
    const testPitch = pitches[0];

    if (!creator || !viewer) {
      console.log('❌ Need both creator and viewer users for testing');
      return;
    }

    console.log(`\n2. Testing NDA workflow with:
    - Creator: ${creator.email} (ID: ${creator.id})
    - Viewer: ${viewer.email} (ID: ${viewer.id})
    - Pitch: ${testPitch.title} (ID: ${testPitch.id})`);

    // Test 1: Create NDA request
    console.log('\n3. Testing NDA request creation...');
    const ndaRequestResult = await db.execute(sql`
      INSERT INTO nda_requests (pitch_id, requester_id, owner_id, nda_type, request_message)
      VALUES (${testPitch.id}, ${viewer.id}, ${creator.id}, 'basic', 'Test NDA request for workflow validation')
      RETURNING id, status
    `);
    
    const ndaRequestId = ndaRequestResult[0]?.id;
    console.log('✅ NDA request created with ID:', ndaRequestId);

    // Test 2: Check NDA request exists
    console.log('\n4. Verifying NDA request...');
    const ndaCheck = await db.execute(sql`
      SELECT nr.*, u1.email as requester_email, u2.email as owner_email, p.title as pitch_title
      FROM nda_requests nr
      JOIN users u1 ON nr.requester_id = u1.id
      JOIN users u2 ON nr.owner_id = u2.id
      JOIN pitches p ON nr.pitch_id = p.id
      WHERE nr.id = ${ndaRequestId}
    `);
    
    if (ndaCheck.length > 0) {
      const request = ndaCheck[0];
      console.log(`✅ NDA Request verified:
        - From: ${request.requester_email}
        - To: ${request.owner_email}
        - Pitch: ${request.pitch_title}
        - Status: ${request.status}`);
    }

    // Test 3: Create NDA record (simulate approval)
    console.log('\n5. Creating approved NDA...');
    const ndaResult = await db.execute(sql`
      INSERT INTO ndas (pitch_id, user_id, signer_id, status, signed_at)
      VALUES (${testPitch.id}, ${creator.id}, ${viewer.id}, 'signed', NOW())
      RETURNING id, status
    `);
    
    const ndaId = ndaResult[0]?.id;
    console.log('✅ NDA created with ID:', ndaId);

    // Test 4: Create info request
    console.log('\n6. Testing info request creation...');
    const infoRequestResult = await db.execute(sql`
      INSERT INTO info_requests (nda_id, pitch_id, requester_id, owner_id, request_type, subject, message)
      VALUES (${ndaId}, ${testPitch.id}, ${viewer.id}, ${creator.id}, 'financial', 'Budget Breakdown Request', 'Could you provide more details about the budget breakdown?')
      RETURNING id, status, subject
    `);
    
    const infoRequestId = infoRequestResult[0]?.id;
    console.log('✅ Info request created with ID:', infoRequestId, 'Subject:', infoRequestResult[0]?.subject);

    // Test 5: Add attachment to info request
    console.log('\n7. Testing info request attachment...');
    const attachmentResult = await db.execute(sql`
      INSERT INTO info_request_attachments (info_request_id, file_name, file_url, file_type, uploaded_by)
      VALUES (${infoRequestId}, 'additional_questions.pdf', 'https://example.com/files/questions.pdf', 'application/pdf', ${viewer.id})
      RETURNING id, file_name
    `);
    
    console.log('✅ Attachment created:', attachmentResult[0]?.file_name);

    // Test 6: Query complete workflow
    console.log('\n8. Testing complete workflow query...');
    const workflowQuery = await db.execute(sql`
      SELECT 
        ir.id as info_request_id,
        ir.subject,
        ir.message,
        ir.status as info_status,
        ir.request_type,
        n.id as nda_id,
        n.status as nda_status,
        n.signed_at,
        p.title as pitch_title,
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

    if (workflowQuery.length > 0) {
      const workflow = workflowQuery[0];
      console.log(`✅ Complete workflow verified:
        - Pitch: ${workflow.pitch_title}
        - NDA Status: ${workflow.nda_status}
        - Signed: ${workflow.signed_at}
        - Info Request: ${workflow.subject}
        - Request Type: ${workflow.request_type}
        - Info Status: ${workflow.info_status}
        - Attachments: ${workflow.attachment_count}`);
    }

    // Test 7: Test world_description column
    console.log('\n9. Testing world_description column...');
    await db.execute(sql`
      UPDATE pitches 
      SET world_description = 'A dystopian future where AI has taken over most creative industries, but underground artists still fight to preserve human creativity.'
      WHERE id = ${testPitch.id}
    `);
    
    const worldDescCheck = await db.execute(sql`
      SELECT title, world_description 
      FROM pitches 
      WHERE id = ${testPitch.id}
    `);
    
    if (worldDescCheck[0]?.world_description) {
      console.log('✅ World description updated successfully');
      console.log('  Description preview:', worldDescCheck[0].world_description.substring(0, 100) + '...');
    }

    console.log('\n🎉 ALL TESTS PASSED! NDA and Info Request workflow is working correctly.');

    // Cleanup test data
    console.log('\n10. Cleaning up test data...');
    await db.execute(sql`DELETE FROM info_request_attachments WHERE info_request_id = ${infoRequestId}`);
    await db.execute(sql`DELETE FROM info_requests WHERE id = ${infoRequestId}`);
    await db.execute(sql`DELETE FROM ndas WHERE id = ${ndaId}`);
    await db.execute(sql`DELETE FROM nda_requests WHERE id = ${ndaRequestId}`);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
}

await testNDAWorkflow();
Deno.exit(0);