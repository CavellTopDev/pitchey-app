import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './src/db/schema.ts';
import { eq, desc, and, or, sql } from 'drizzle-orm';

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function testFollowingQuery() {
  const client = neon(DATABASE_URL);
  const db = drizzle(client, { schema });
  
  console.log('Testing /api/pitches/following query...\n');
  
  // Hardcoded userId 3 (production user)
  const userId = 3;
  
  try {
    // Get pitches from creators that the user follows
    const followedPitches = await db.select({
      id: schema.pitches.id,
      title: schema.pitches.title,
      logline: schema.pitches.logline,
      genre: schema.pitches.genre,
      format: schema.pitches.format,
      status: schema.pitches.status,
      posterUrl: schema.pitches.posterUrl,
      titleImage: schema.pitches.titleImage,
      viewCount: schema.pitches.viewCount,
      createdAt: schema.pitches.createdAt,
      userId: schema.pitches.userId,
      creatorId: schema.users.id,
      creatorUsername: schema.users.username,
      creatorFirstName: schema.users.firstName,
      creatorLastName: schema.users.lastName,
      creatorCompanyName: schema.users.companyName,
      creatorProfileImage: schema.users.profileImageUrl,
      creatorUserType: schema.users.userType,
    })
    .from(schema.follows)
    .innerJoin(schema.pitches, eq(schema.follows.creatorId, schema.pitches.userId))
    .innerJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
    .where(
      and(
        eq(schema.follows.followerId, userId),
        or(
          eq(schema.pitches.status, 'published'),
          eq(schema.pitches.status, 'active')
        )
      )
    )
    .orderBy(desc(schema.pitches.createdAt))
    .limit(5);
    
    console.log(`Found ${followedPitches.length} pitches from followed creators\n`);
    
    if (followedPitches.length > 0) {
      console.log('Sample pitch with creator data:');
      const pitch = followedPitches[0];
      console.log({
        id: pitch.id,
        title: pitch.title,
        userId: pitch.userId,
        creatorId: pitch.creatorId,
        creatorUsername: pitch.creatorUsername,
        creatorFirstName: pitch.creatorFirstName,
        creatorLastName: pitch.creatorLastName,
        creatorCompanyName: pitch.creatorCompanyName,
      });
      
      console.log('\nFormatted with nested creator object:');
      const formatted = {
        id: pitch.id,
        title: pitch.title,
        logline: pitch.logline,
        genre: pitch.genre,
        format: pitch.format,
        status: pitch.status,
        posterUrl: pitch.posterUrl,
        titleImage: pitch.titleImage,
        viewCount: pitch.viewCount,
        createdAt: pitch.createdAt,
        userId: pitch.userId,
        creator: {
          id: pitch.creatorId,
          username: pitch.creatorUsername || `${pitch.creatorFirstName} ${pitch.creatorLastName}`,
          firstName: pitch.creatorFirstName,
          lastName: pitch.creatorLastName,
          companyName: pitch.creatorCompanyName,
          profileImageUrl: pitch.creatorProfileImage,
          userType: pitch.creatorUserType
        }
      };
      console.log(JSON.stringify(formatted, null, 2));
    } else {
      console.log('No pitches found. Checking if user is following anyone...');
      const follows = await db.select()
        .from(schema.follows)
        .where(eq(schema.follows.followerId, userId))
        .limit(5);
      console.log(`User is following ${follows.length} creators`);
      
      if (follows.length > 0) {
        console.log('\nChecking if followed creators have any pitches...');
        const creatorIds = follows.map(f => f.creatorId);
        const pitches = await db.select()
          .from(schema.pitches)
          .where(sql`${schema.pitches.userId} = ANY(${creatorIds})`)
          .limit(5);
        console.log(`Found ${pitches.length} pitches from followed creators`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFollowingQuery();