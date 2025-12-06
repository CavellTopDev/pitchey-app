import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, desc } from 'drizzle-orm';
import * as schema from './src/db/schema.ts';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function testBrowse() {
  try {
    console.log("Testing browse with film filter...");
    
    // Build where conditions
    let whereConditions = [eq(schema.pitches.status, 'published')];
    
    // Apply film filter
    whereConditions.push(eq(schema.pitches.format, 'Film'));
    
    console.log("Where conditions:", whereConditions);
    console.log("Conditions length:", whereConditions.length);
    
    // Try the query
    const query = db.select({
      id: schema.pitches.id,
      title: schema.pitches.title,
      format: schema.pitches.format,
    })
    .from(schema.pitches)
    .where(whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]);
    
    const results = await query.limit(5);
    
    console.log("Results:", results);
    console.log("Film pitches found:", results.filter(p => p.format === 'Film').length);
    
  } catch (error) {
    console.error("Error:", error);
  }
  
  Deno.exit(0);
}

testBrowse();