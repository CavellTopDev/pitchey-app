#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

async function checkSchema() {
  console.log("🔍 Checking Neon Database Schema");
  console.log("==================================\n");

  try {
    // Check pitches table columns
    const columns = await sql`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'pitches'
      ORDER BY ordinal_position
    `;
    
    console.log("📊 PITCHES TABLE SCHEMA:");
    console.log("------------------------");
    columns.forEach(c => {
      const nullable = c.is_nullable === 'YES' ? '(nullable)' : '(required)';
      const maxLen = c.character_maximum_length ? `[${c.character_maximum_length}]` : '';
      console.log(`  ${c.column_name}: ${c.data_type}${maxLen} ${nullable}`);
    });

    // Check what the code is trying to insert
    console.log("\n📝 FIELDS CODE TRIES TO INSERT:");
    console.log("--------------------------------");
    const codeFields = [
      'userId', 'title', 'logline', 'genre', 'format',
      'shortSynopsis', 'longSynopsis', 'budget',
      'thumbnailUrl', 'lookbookUrl', 'pitchDeckUrl',
      'scriptUrl', 'trailerUrl', 'requireNda',
      'status', 'viewCount', 'likeCount', 'ndaCount',
      'createdAt', 'updatedAt'
    ];
    
    codeFields.forEach(field => {
      const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      const exists = columns.find(c => c.column_name === dbField);
      if (exists) {
        console.log(`  ✅ ${field} -> ${dbField}`);
      } else {
        console.log(`  ❌ ${field} -> ${dbField} (NOT IN DATABASE)`);
      }
    });

    // Check for any missing required fields
    console.log("\n⚠️ REQUIRED DATABASE FIELDS:");
    console.log("----------------------------");
    columns.filter(c => c.is_nullable === 'NO' && !c.column_default).forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type})`);
    });

    // Test a simple insert
    console.log("\n🧪 TESTING SIMPLE INSERT:");
    console.log("-------------------------");
    try {
      const [testPitch] = await sql`
        INSERT INTO pitches (
          user_id, 
          title, 
          logline, 
          genre, 
          format, 
          status
        ) VALUES (
          1001,
          'Schema Test Pitch',
          'Testing database schema compatibility',
          'Drama',
          'feature',
          'draft'
        ) RETURNING id, title
      `;
      console.log(`✅ Insert successful! Created pitch ID: ${testPitch.id}`);
      
      // Clean up
      await sql`DELETE FROM pitches WHERE id = ${testPitch.id}`;
      console.log("✅ Test pitch cleaned up");
    } catch (error) {
      console.error("❌ Insert failed:", error.message);
    }

  } catch (error) {
    console.error("❌ Error checking schema:", error);
  }
}

await checkSchema();
