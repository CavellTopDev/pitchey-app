#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

async function testDirectInsert() {
  console.log("Testing direct database insert bypassing Drizzle...\n");
  
  try {
    const [pitch] = await sql`
      INSERT INTO pitches (
        user_id,
        title,
        logline,
        genre,
        format,
        short_synopsis,
        status,
        view_count,
        like_count,
        nda_count,
        created_at,
        updated_at
      ) VALUES (
        1001,
        'Direct SQL Test',
        'Testing direct insert',
        'Drama',
        'Feature Film',
        'A test pitch',
        'draft',
        0,
        0,
        0,
        NOW(),
        NOW()
      ) RETURNING *
    `;
    
    console.log("✅ Direct SQL insert successful!");
    console.log("Pitch created:", pitch);
    
    // Clean up
    await sql`DELETE FROM pitches WHERE id = ${pitch.id}`;
    console.log("✅ Cleaned up test pitch");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

await testDirectInsert();
