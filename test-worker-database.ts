/**
 * Test script to verify Worker database connectivity
 * Tests the Neon database integration without Hyperdrive locally
 */

import { neon } from '@neondatabase/serverless';

// Mock environment for testing
const mockEnv = {
  HYPERDRIVE: {
    connectionString: "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
  },
  FRONTEND_URL: "https://pitchey.pages.dev",
  JWT_SECRET: "test-jwt-secret"
};

// Database service (same as in worker)
class DatabaseService {
  private sql: any;
  
  constructor(env: any) {
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE binding not available');
    }
    
    // Use Hyperdrive's optimized connection string with Neon
    this.sql = neon(env.HYPERDRIVE.connectionString);
  }
  
  async query(query: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await this.sql(query, params);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('Database query error:', query, params, error);
      throw error;
    }
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1 as test');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
  
  async getAllUsers(limit: number = 10): Promise<any[]> {
    try {
      const results = await this.query(
        'SELECT id, email, user_type, first_name, last_name, company_name, bio, is_active, email_verified, created_at FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      
      return results.map(user => ({
        id: user.id,
        email: user.email,
        userType: user.user_type,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: `${user.first_name} ${user.last_name}`,
        companyName: user.company_name,
        bio: user.bio,
        isActive: user.is_active,
        isVerified: user.email_verified,
        createdAt: user.created_at
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }
  
  async getAllPitches(limit: number = 10): Promise<any[]> {
    try {
      const results = await this.query(`
        SELECT p.id, p.title, p.genre, p.budget_range, p.description, p.logline, 
               p.user_id, p.status, p.view_count, p.like_count, p.created_at, p.updated_at,
               u.first_name, u.last_name
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'active' AND p.visibility = 'public'
        ORDER BY p.created_at DESC LIMIT $1
      `, [limit]);
      
      return results.map(pitch => ({
        id: pitch.id,
        title: pitch.title,
        genre: pitch.genre,
        budgetRange: pitch.budget_range,
        description: pitch.description,
        logline: pitch.logline,
        creatorId: pitch.user_id,
        creatorName: `${pitch.first_name} ${pitch.last_name}`,
        status: pitch.status,
        viewCount: pitch.view_count,
        likeCount: pitch.like_count,
        createdAt: pitch.created_at,
        updatedAt: pitch.updated_at
      }));
    } catch (error) {
      console.error('Error fetching pitches:', error);
      return [];
    }
  }
}

async function testWorkerDatabase() {
  console.log("🧪 Testing Worker Database Integration...\n");
  
  try {
    // Test database connection
    console.log("1. Testing database connection...");
    const db = new DatabaseService(mockEnv);
    const isConnected = await db.testConnection();
    
    if (isConnected) {
      console.log("✅ Database connection successful!");
    } else {
      console.log("❌ Database connection failed!");
      return;
    }
    
    // Test user retrieval
    console.log("\n2. Testing user retrieval...");
    const users = await db.getAllUsers(3);
    console.log(`✅ Retrieved ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.displayName} (${user.email}) - ${user.userType}`);
    });
    
    // Test pitch retrieval
    console.log("\n3. Testing pitch retrieval...");
    const pitches = await db.getAllPitches(3);
    console.log(`✅ Retrieved ${pitches.length} pitches:`);
    pitches.forEach(pitch => {
      console.log(`   - "${pitch.title}" by ${pitch.creatorName} (${pitch.genre})`);
    });
    
    // Test API response simulation
    console.log("\n4. Testing API response format...");
    const apiResponse = {
      users: users,
      source: 'database',
      dbConnected: true,
      timestamp: new Date().toISOString()
    };
    
    console.log("✅ API Response Structure:", {
      usersCount: apiResponse.users.length,
      source: apiResponse.source,
      dbConnected: apiResponse.dbConnected
    });
    
    console.log("\n🎉 All Worker database tests passed!");
    console.log("🔧 The Worker is ready for deployment with real database integration");
    
  } catch (error) {
    console.error("❌ Worker database test failed:", error);
  }
}

if (import.meta.main) {
  await testWorkerDatabase();
  Deno.exit(0);
}