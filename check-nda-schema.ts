import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  SELECT id, title, user_id, status 
  FROM pitches 
  ORDER BY id
  LIMIT 10;
`);

console.log("Available pitches:");
result.forEach(row => console.log(`- ID ${row.id}: "${row.title}" (user: ${row.user_id}, status: ${row.status})`));
