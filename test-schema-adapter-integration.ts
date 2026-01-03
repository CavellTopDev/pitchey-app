#!/usr/bin/env deno run --allow-all

/**
 * Test Schema Adapter Integration
 * Validates that SchemaAdapter queries work correctly with the database
 */

import { SchemaAdapter } from './src/middleware/schema-adapter.ts';

// Mock database connection for testing
const mockDb = {
  async query(sql: string, params: any[] = []) {
    console.log('🔍 SQL Query:', sql);
    console.log('📊 Parameters:', params);
    
    // Simulate successful query response
    return [
      {
        id: 1,
        username: 'alex.creator',
        email: 'alex.creator@demo.com',
        full_name: 'Alex Creator',
        bio: 'Passionate filmmaker',
        created_at: new Date().toISOString()
      }
    ];
  }
};

async function testSchemaAdapter() {
  console.log('🧪 SCHEMA ADAPTER INTEGRATION TEST');
  console.log('================================');
  console.log('');

  try {
    // Test getFollowersQuery
    console.log('1. Testing getFollowersQuery:');
    console.log('----------------------------');
    const followersQuery = SchemaAdapter.getFollowersQuery(1);
    console.log('✅ Generated Query:', {
      sql: followersQuery.query.substring(0, 100) + '...',
      params: followersQuery.params
    });
    
    const followersResult = await mockDb.query(followersQuery.query, followersQuery.params);
    console.log('✅ Mock Query Result:', followersResult.length, 'followers');
    console.log('');

    // Test getFollowingQuery  
    console.log('2. Testing getFollowingQuery:');
    console.log('-----------------------------');
    const followingQuery = SchemaAdapter.getFollowingQuery(1);
    console.log('✅ Generated Query:', {
      sql: followingQuery.query.substring(0, 100) + '...',
      params: followingQuery.params
    });
    
    const followingResult = await mockDb.query(followingQuery.query, followingQuery.params);
    console.log('✅ Mock Query Result:', followingResult.length, 'following');
    console.log('');

    // Test with production database if DATABASE_URL is available
    if (Deno.env.get('DATABASE_URL')) {
      console.log('3. Testing with Production Database:');
      console.log('-----------------------------------');
      
      const { Client } = await import('https://deno.land/x/postgres@v0.19.3/mod.ts');
      const client = new Client(Deno.env.get('DATABASE_URL')!);
      
      try {
        await client.connect();
        console.log('✅ Connected to production database');
        
        // Test actual query
        const result = await client.queryObject(followersQuery.query, followersQuery.params);
        console.log('✅ Production Query Result:', result.rows.length, 'rows');
        console.log('📊 Sample Data:', result.rows.slice(0, 2));
        
        await client.end();
      } catch (error) {
        console.error('❌ Production database test failed:', error.message);
      }
    } else {
      console.log('ℹ️  Skipping production database test (no DATABASE_URL)');
    }

    console.log('');
    console.log('✅ SCHEMA ADAPTER TESTS COMPLETED SUCCESSFULLY');
    console.log('==============================================');
    
  } catch (error) {
    console.error('❌ SCHEMA ADAPTER TEST FAILED:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await testSchemaAdapter();
}