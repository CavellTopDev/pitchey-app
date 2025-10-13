import { db } from './src/db/client.ts';
import { users } from './src/db/schema.ts';

const demoUsers = await db.select().from(users).limit(10);
console.log('Demo users in database:');
console.log(JSON.stringify(demoUsers, null, 2));