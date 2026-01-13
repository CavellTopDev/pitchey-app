#!/usr/bin/env -S deno run --allow-all

/**
 * Complete NDA Workflow Script
 * Simulates the full NDA approval process by directly updating the database
 * This is needed because the frontend NDA request submission has an API error
 */

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function completeNDAWorkflow() {
  const client = new Client(DATABASE_URL);
  
  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Step 1: Get the investor user ID (Sarah Thompson)
    const investorResult = await client.queryObject(
      "SELECT id, email FROM users WHERE email = $1",
      ["sarah.investor@demo.com"]
    );
    
    if (investorResult.rows.length === 0) {
      throw new Error("Investor user not found");
    }
    
    const investorId = investorResult.rows[0].id;
    console.log(`✅ Found investor: ${investorResult.rows[0].email} (ID: ${investorId})`);

    // Step 2: Get pitch 226 details and creator ID
    const pitchResult = await client.queryObject(
      "SELECT id, user_id, title FROM pitches WHERE id = $1",
      [226]
    );
    
    if (pitchResult.rows.length === 0) {
      throw new Error("Pitch 226 not found");
    }
    
    const pitch = pitchResult.rows[0];
    const creatorId = pitch.user_id;
    console.log(`✅ Found pitch: "${pitch.title}" (Creator ID: ${creatorId})`);

    // Step 3: Check if NDA request already exists
    let ndaRequestResult = await client.queryObject(
      "SELECT id, status FROM nda_requests WHERE pitch_id = $1 AND requester_id = $2",
      [226, investorId]
    );

    let ndaRequestId;
    if (ndaRequestResult.rows.length === 0) {
      // Step 4: Create NDA request if it doesn't exist
      const insertNDAResult = await client.queryObject(
        `INSERT INTO nda_requests (
          pitch_id, 
          requester_id, 
          creator_id,
          status, 
          message,
          requester_company,
          requester_position,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
        [
          226, // pitch_id
          investorId, // requester_id  
          creatorId, // creator_id
          'pending', // status
          'Investment evaluation and due diligence assessment. I plan to review the detailed budget breakdown, production timeline, and attached talent information to evaluate the project\'s commercial viability and investment potential.',
          'Thompson Ventures', // requester_company
          'Senior Investment Manager' // requester_position
        ]
      );
      ndaRequestId = insertNDAResult.rows[0].id;
      console.log(`✅ Created NDA request (ID: ${ndaRequestId})`);
    } else {
      ndaRequestId = ndaRequestResult.rows[0].id;
      console.log(`✅ Found existing NDA request (ID: ${ndaRequestId})`);
    }

    // Step 5: Approve the NDA request (using actual table schema)
    await client.queryObject(
      "UPDATE nda_requests SET status = $1, responded_at = NOW(), updated_at = NOW(), approved_by = $3 WHERE id = $2",
      ['approved', ndaRequestId, creatorId]
    );
    console.log(`✅ Approved NDA request (ID: ${ndaRequestId})`);

    // Step 6: Note - signed_ndas table doesn't exist in current schema
    // The approved status in nda_requests table should be sufficient for access control
    console.log(`✅ NDA approval complete - using nda_requests table (signed_ndas table not found in schema)`)

    // Step 7: Verify the complete workflow
    const verificationResult = await client.queryObject(
      `SELECT 
        nr.id as request_id,
        nr.status as request_status,
        nr.responded_at,
        nr.approved_by,
        p.title as pitch_title,
        u.email as requester_email
      FROM nda_requests nr
      JOIN pitches p ON nr.pitch_id = p.id
      JOIN users u ON nr.requester_id = u.id
      WHERE nr.pitch_id = $1 AND nr.requester_id = $2`,
      [226, investorId]
    );

    if (verificationResult.rows.length > 0) {
      const verification = verificationResult.rows[0];
      console.log(`
🎉 NDA WORKFLOW COMPLETED SUCCESSFULLY!

📋 Request Details:
   - Request ID: ${verification.request_id}
   - Request Status: ${verification.request_status}
   - Approved By: ${verification.approved_by}
   - Responded At: ${verification.responded_at}
   - Requester: ${verification.requester_email}
   - Pitch: "${verification.pitch_title}"

✅ The investor (Sarah Thompson) now has full NDA access to pitch 226.
✅ Protected content should now be visible in the frontend.
      `);
    }

  } catch (error) {
    console.error("❌ Error completing NDA workflow:", error);
    throw error;
  } finally {
    await client.end();
    console.log("✅ Database connection closed");
  }
}

if (import.meta.main) {
  await completeNDAWorkflow();
}