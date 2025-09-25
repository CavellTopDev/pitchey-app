#!/usr/bin/env -S deno run --allow-net --allow-env

// Script to check NDA request status

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);

async function checkNDAStatus() {
  try {
    console.log("📋 NDA Request Status Report");
    console.log("============================\n");

    // Get all NDA requests with details
    const ndaRequests = await sql`
      SELECT 
        nr.id,
        nr.status,
        nr.nda_type,
        nr.created_at,
        nr.responded_at,
        p.title as pitch_title,
        requester.email as requester_email,
        requester.username as requester_name,
        requester.user_type as requester_type,
        owner.email as owner_email,
        owner.username as owner_name,
        owner.company_name as owner_company
      FROM nda_requests nr
      JOIN pitches p ON nr.pitch_id = p.id
      JOIN users requester ON nr.requester_id = requester.id
      JOIN users owner ON nr.owner_id = owner.id
      ORDER BY nr.created_at DESC
      LIMIT 10
    `;

    if (ndaRequests.length === 0) {
      console.log("No NDA requests found.");
    } else {
      console.log(`Found ${ndaRequests.length} NDA request(s):\n`);
      
      for (const request of ndaRequests) {
        console.log(`📝 Request #${request.id}`);
        console.log(`   Pitch: "${request.pitch_title}"`);
        console.log(`   From: ${request.requester_name} (${request.requester_type}) - ${request.requester_email}`);
        console.log(`   To: ${request.owner_company || request.owner_name} - ${request.owner_email}`);
        console.log(`   Type: ${request.nda_type || 'basic'}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   Requested: ${new Date(request.created_at).toLocaleString()}`);
        if (request.responded_at) {
          console.log(`   Responded: ${new Date(request.responded_at).toLocaleString()}`);
        }
        console.log("");
      }
    }

    // Get statistics
    const stats = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM nda_requests
      GROUP BY status
    `;

    console.log("📊 NDA Request Statistics:");
    console.log("==========================");
    for (const stat of stats) {
      console.log(`   ${stat.status}: ${stat.count}`);
    }

    // Check for any production company pitches without NDAs
    const productionPitches = await sql`
      SELECT 
        p.id,
        p.title,
        u.company_name,
        p.nda_count
      FROM pitches p
      JOIN users u ON p.user_id = u.id
      WHERE u.user_type = 'production'
      ORDER BY p.created_at DESC
    `;

    console.log("\n🎬 Production Company Pitches:");
    console.log("==============================");
    for (const pitch of productionPitches) {
      console.log(`   "${pitch.title}" by ${pitch.company_name}`);
      console.log(`   NDA Requests: ${pitch.nda_count || 0}`);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    Deno.exit(1);
  }
}

await checkNDAStatus();
Deno.exit(0);