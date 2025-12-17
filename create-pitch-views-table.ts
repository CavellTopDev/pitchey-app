import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function createPitchViewsTable() {
  try {
    // Create pitch_views table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pitch_views (
        id SERIAL PRIMARY KEY,
        pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
        viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        view_type VARCHAR(20),
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        session_id VARCHAR(100),
        duration INTEGER,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitch_views_pitch_id_idx ON pitch_views(pitch_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitch_views_viewer_id_idx ON pitch_views(viewer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitch_views_viewed_at_idx ON pitch_views(viewed_at)`);
    
    console.log("✅ pitch_views table created/verified successfully");
    
    // Test insert
    const testResult = await db.execute(sql`
      INSERT INTO pitch_views (pitch_id, viewer_id, view_type, viewed_at)
      VALUES (63, NULL, 'test', CURRENT_TIMESTAMP)
      RETURNING id
    `);
    
    console.log("✅ Test insert successful, table is working");
    
    // Delete test data
    await db.execute(sql`DELETE FROM pitch_views WHERE view_type = 'test'`);
    
  } catch (error) {
    console.error("Error creating pitch_views table:", error);
  }
}

createPitchViewsTable();