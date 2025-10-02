#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const sql = neon("postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require");

console.log("Checking pitches in database for user 1001...\n");

const pitches = await sql`
  SELECT id, user_id, title, status, created_at 
  FROM pitches 
  WHERE user_id = 1001
  ORDER BY created_at DESC
`;

console.log(`Found ${pitches.length} pitches for alex.creator (user_id: 1001):`);
pitches.forEach(p => {
  console.log(`  ID: ${p.id} | Title: "${p.title}" | Status: ${p.status} | Created: ${p.created_at}`);
});

// Check all pitches
const allPitches = await sql`
  SELECT id, user_id, title, status 
  FROM pitches 
  ORDER BY id DESC 
  LIMIT 10
`;

console.log(`\nAll recent pitches (last 10):`);
allPitches.forEach(p => {
  console.log(`  ID: ${p.id} | User: ${p.user_id} | Title: "${p.title}" | Status: ${p.status}`);
});
