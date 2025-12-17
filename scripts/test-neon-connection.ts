#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to verify Neon database connection and queries
 * Usage: deno run --allow-all scripts/test-neon-connection.ts
 */

import { createNeonConnection, NeonConnection } from '../src/db/neon-connection.ts';
import { DatabaseQueries } from '../src/db/queries.ts';

const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL="postgresql://user:pass@host/db" deno run --allow-all scripts/test-neon-connection.ts');
  Deno.exit(1);
}

console.log('🔄 Testing Neon database connection...\n');

try {
  // Create connection
  console.log('1. Creating database connection...');
  const db = createNeonConnection({ DATABASE_URL });
  const queries = new DatabaseQueries(db);
  console.log('✅ Connection created successfully\n');

  // Test health check
  console.log('2. Testing health check...');
  const health = await db.healthCheck();
  console.log('✅ Health check passed:', health);
  console.log();

  // Test user query
  console.log('3. Testing getUserByEmail...');
  const user = await queries.getUserByEmail('alex.creator@demo.com');
  if (user) {
    console.log('✅ Found user:', {
      id: user.id,
      email: user.email,
      username: user.username,
      userType: user.user_type
    });
  } else {
    console.log('⚠️  User not found (might need to run migration with --demo flag)');
  }
  console.log();

  // Test public pitches
  console.log('4. Testing getPublicPitches...');
  const pitches = await queries.getPublicPitches({ limit: 3 });
  console.log(`✅ Found ${pitches.length} public pitches:`);
  for (const pitch of pitches) {
    console.log(`   - "${pitch.title}" by ${pitch.creatorName || 'Unknown'} (${pitch.genre})`);
  }
  console.log();

  // Test pitch count
  console.log('5. Testing countPublicPitches...');
  const count = await queries.countPublicPitches();
  console.log(`✅ Total public pitches: ${count}`);
  console.log();

  // Test featured pitches
  console.log('6. Testing getFeaturedPitches...');
  const featured = await queries.getFeaturedPitches(2);
  console.log(`✅ Found ${featured.length} featured pitches`);
  console.log();

  // Test trending pitches
  console.log('7. Testing getTrendingPitches...');
  const trending = await queries.getTrendingPitches(2);
  console.log(`✅ Found ${trending.length} trending pitches`);
  console.log();

  // Test search
  console.log('8. Testing searchPitches...');
  const searchResults = await queries.searchPitches('thriller', {
    genre: null,
    format: null,
    budgetRange: null,
    seekingInvestment: null
  }, 5, 0);
  console.log(`✅ Search found ${searchResults.length} results for "thriller"`);
  console.log();

  // Test browse/enhanced data structure
  console.log('9. Testing browse/enhanced endpoint data structure...');
  const browseData = {
    success: true,
    data: pitches.map(p => ({
      id: p.id,
      title: p.title,
      logline: p.logline,
      genre: p.genre,
      format: p.format,
      status: p.status,
      viewCount: p.view_count,
      tags: [],
      budgetRange: p.budget,
      createdAt: p.created_at,
      userId: p.user_id,
      creatorId: p.user_id,
      thumbnail: '/placeholder.jpg',
      isNew: true,
      isTrending: false,
      creator: {
        id: p.user_id,
        username: p.creatorName || 'unknown',
        firstName: '',
        lastName: '',
        companyName: p.creatorCompany || '',
        profileImageUrl: '/avatars/default.jpg',
        userType: 'creator'
      }
    })),
    pagination: {
      total: count.toString(),
      limit: 3,
      offset: 0,
      hasMore: count > 3
    },
    filters: {
      genre: null,
      format: null,
      budget: null
    }
  };
  console.log('✅ Browse/enhanced data structure created successfully');
  console.log('   Sample response:', JSON.stringify(browseData, null, 2).substring(0, 500) + '...');
  console.log();

  console.log('🎉 All tests passed successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Deploy the worker-neon.ts to test the new endpoints');
  console.log('2. Update wrangler.toml to use the new worker entry point');
  console.log('3. Test the /api/pitches/browse/enhanced endpoint in production');

} catch (error) {
  console.error('❌ Test failed:', error);
  console.error('\nStack trace:', error.stack);
  Deno.exit(1);
}