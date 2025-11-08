import { db } from "./src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";

async function debugQuery() {
  try {
    console.log("Running query directly...\n");
    
    const result = await db.execute(sql`
      SELECT u.user_type, COUNT(*) as view_count
      FROM pitch_views pv
      LEFT JOIN users u ON pv.user_id = u.id
      WHERE pv.pitch_id = 63
      GROUP BY u.user_type
    `);
    
    console.log("Query result:", result);
    console.log("Rows:", result.rows);
    
  } catch (error) {
    console.error("Query error:", error);
  }
}

debugQuery();