import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function testFollowersQuery() {
  const userId = 3; // Production user ID

  try {
    console.log('Testing followers query for user ID:', userId);
    
    // Get users who follow the current user
    const followers = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      companyName: schema.users.companyName,
      profileImageUrl: schema.users.profileImageUrl,
      userType: schema.users.userType,
      followedAt: schema.follows.followedAt,
    })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.follows.followerId, schema.users.id))
    .where(eq(schema.follows.creatorId, userId))
    .orderBy(desc(schema.follows.followedAt));

    console.log('Followers query successful:', followers);
    
    // Get users that the current user follows
    const following = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      companyName: schema.users.companyName,
      profileImageUrl: schema.users.profileImageUrl,
      userType: schema.users.userType,
      followedAt: schema.follows.followedAt,
    })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.follows.creatorId, schema.users.id))
    .where(eq(schema.follows.followerId, userId))
    .orderBy(desc(schema.follows.followedAt));

    console.log('Following query successful:', following);
    
  } catch (error) {
    console.error('Error in query:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testFollowersQuery();
