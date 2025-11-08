import { db } from './src/db/client.ts';
import { pitches } from './src/db/schema.ts';
import { eq } from 'npm:drizzle-orm@0.35.3';

const result = await db.select().from(pitches).where(eq(pitches.id, 1)).limit(1);
console.log('Pitch ID 1 exists:', result.length > 0);
if (result.length > 0) {
  console.log('Pitch:', result[0]);
} else {
  console.log('Pitch ID 1 not found in database');
}

// Also check how many pitches exist total
const allPitches = await db.select({ id: pitches.id, title: pitches.title }).from(pitches).limit(5);
console.log('First 5 pitches in database:', allPitches);