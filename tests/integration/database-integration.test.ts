/**
 * Database Integration Testing
 * Tests database operations, transactions, and data integrity
 */

import { assertEquals, assertExists, assert, assertRejects } from "jsr:@std/assert";
import { db } from "../../src/db/client.ts";
import { sql } from "npm:drizzle-orm@0.35.3";
import { TestFactory } from "../framework/test-factory.ts";
import { testDb, withDatabase, withTransaction } from "../framework/test-database.ts";
import { users, pitches, ndas, messages, investments } from "../../src/db/schema.ts";

interface DatabaseTestCase {
  name: string;
  setup?: () => Promise<void>;
  test: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

class DatabaseIntegrationTester {
  private testCases: DatabaseTestCase[] = [];

  addTestCase(testCase: DatabaseTestCase): void {
    this.testCases.push(testCase);
  }

  async runAllTests(): Promise<void> {
    for (const testCase of this.testCases) {
      console.log(`🔌 Running: ${testCase.name}`);
      
      try {
        if (testCase.setup) {
          await testCase.setup();
        }
        
        await testCase.test();
        
        console.log(`✅ ${testCase.name} passed`);
      } catch (error) {
        console.error(`❌ ${testCase.name} failed:`, error.message);
        throw error;
      } finally {
        if (testCase.cleanup) {
          await testCase.cleanup();
        }
      }
    }
  }
}

// ==================== DATABASE INTEGRATION TESTS ====================

Deno.test({
  name: "Database Integration Tests",
  async fn() {
    const tester = new DatabaseIntegrationTester();
    
    // Initialize test database
    await testDb.initialize();

    // ==================== CONNECTION TESTS ====================
    
    tester.addTestCase({
      name: "Database Connection Health Check",
      test: async () => {
        const health = await testDb.healthCheck();
        
        assertEquals(health.connected, true);
        assert(health.latency < 1000, `High latency: ${health.latency}ms`);
        assert(health.tableCount > 10, "Missing expected tables");
        assertEquals(health.issues.length, 0, `Health issues: ${health.issues.join(", ")}`);
      }
    });

    // ==================== CRUD OPERATIONS ====================
    
    tester.addTestCase({
      name: "User CRUD Operations",
      test: async () => {
        const userData = TestFactory.creator();
        
        // CREATE - Insert user
        const insertResult = await db.execute(sql`
          INSERT INTO users (
            email, username, password, password_hash, user_type, 
            first_name, last_name, email_verified, is_active
          ) VALUES (
            ${userData.email}, ${userData.username}, ${userData.password}, 
            ${userData.passwordHash}, ${userData.userType}, ${userData.firstName}, 
            ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
          ) RETURNING id
        `);
        
        const userId = insertResult.rows[0]?.id;
        assertExists(userId);

        // READ - Select user
        const selectResult = await db.execute(sql`
          SELECT * FROM users WHERE id = ${userId}
        `);
        
        assertEquals(selectResult.rows.length, 1);
        const user = selectResult.rows[0];
        assertEquals(user.email, userData.email);
        assertEquals(user.username, userData.username);

        // UPDATE - Modify user
        const newFirstName = "Updated Name";
        await db.execute(sql`
          UPDATE users SET first_name = ${newFirstName} WHERE id = ${userId}
        `);

        const updatedResult = await db.execute(sql`
          SELECT first_name FROM users WHERE id = ${userId}
        `);
        
        assertEquals(updatedResult.rows[0]?.first_name, newFirstName);

        // DELETE - Remove user
        await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
        
        const deletedResult = await db.execute(sql`
          SELECT * FROM users WHERE id = ${userId}
        `);
        
        assertEquals(deletedResult.rows.length, 0);
      }
    });

    tester.addTestCase({
      name: "Pitch CRUD with Relations",
      test: async () => {
        // First create a user
        const userData = TestFactory.creator();
        const userResult = await db.execute(sql`
          INSERT INTO users (
            email, username, password, password_hash, user_type, 
            first_name, last_name, email_verified, is_active
          ) VALUES (
            ${userData.email}, ${userData.username}, ${userData.password}, 
            ${userData.passwordHash}, ${userData.userType}, ${userData.firstName}, 
            ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
          ) RETURNING id
        `);
        
        const userId = userResult.rows[0]?.id;
        assertExists(userId);

        // Create pitch
        const pitchData = TestFactory.pitch(userId);
        const pitchResult = await db.execute(sql`
          INSERT INTO pitches (
            user_id, title, logline, genre, short_synopsis, 
            target_audience, budget_range, visibility, status
          ) VALUES (
            ${pitchData.userId}, ${pitchData.title}, ${pitchData.logline},
            ${pitchData.genre}, ${pitchData.shortSynopsis}, ${pitchData.targetAudience},
            ${pitchData.budgetRange}, ${pitchData.visibility}, ${pitchData.status}
          ) RETURNING id
        `);
        
        const pitchId = pitchResult.rows[0]?.id;
        assertExists(pitchId);

        // Test join query
        const joinResult = await db.execute(sql`
          SELECT p.title, p.genre, u.username, u.email
          FROM pitches p
          JOIN users u ON p.user_id = u.id
          WHERE p.id = ${pitchId}
        `);
        
        assertEquals(joinResult.rows.length, 1);
        const row = joinResult.rows[0];
        assertEquals(row.title, pitchData.title);
        assertEquals(row.username, userData.username);

        // Test cascading delete (users should cascade delete pitches)
        await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
        
        const orphanCheck = await db.execute(sql`
          SELECT * FROM pitches WHERE id = ${pitchId}
        `);
        
        assertEquals(orphanCheck.rows.length, 0, "Pitch should be deleted when user is deleted");
      }
    });

    // ==================== TRANSACTION TESTS ====================
    
    tester.addTestCase({
      name: "Transaction Rollback Test",
      test: async () => {
        const userData = TestFactory.creator();
        
        // Test transaction rollback
        await assertRejects(async () => {
          await db.transaction(async (tx) => {
            // Insert user
            await tx.execute(sql`
              INSERT INTO users (
                email, username, password, password_hash, user_type,
                first_name, last_name, email_verified, is_active
              ) VALUES (
                ${userData.email}, ${userData.username}, ${userData.password},
                ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
                ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
              )
            `);

            // Force an error to trigger rollback
            throw new Error("Intentional error for rollback test");
          });
        });

        // Verify no data was inserted
        const result = await db.execute(sql`
          SELECT * FROM users WHERE email = ${userData.email}
        `);
        
        assertEquals(result.rows.length, 0, "Data should not exist after rollback");
      }
    });

    tester.addTestCase({
      name: "Transaction Commit Test", 
      test: async () => {
        const userData1 = TestFactory.creator();
        const userData2 = TestFactory.investor();
        
        // Test successful transaction
        await db.transaction(async (tx) => {
          // Insert multiple users in transaction
          await tx.execute(sql`
            INSERT INTO users (
              email, username, password, password_hash, user_type,
              first_name, last_name, email_verified, is_active
            ) VALUES (
              ${userData1.email}, ${userData1.username}, ${userData1.password},
              ${userData1.passwordHash}, ${userData1.userType}, ${userData1.firstName},
              ${userData1.lastName}, ${userData1.emailVerified}, ${userData1.isActive}
            )
          `);

          await tx.execute(sql`
            INSERT INTO users (
              email, username, password, password_hash, user_type,
              first_name, last_name, email_verified, is_active
            ) VALUES (
              ${userData2.email}, ${userData2.username}, ${userData2.password},
              ${userData2.passwordHash}, ${userData2.userType}, ${userData2.firstName},
              ${userData2.lastName}, ${userData2.emailVerified}, ${userData2.isActive}
            )
          `);
        });

        // Verify both users were inserted
        const result = await db.execute(sql`
          SELECT * FROM users WHERE email IN (${userData1.email}, ${userData2.email})
        `);
        
        assertEquals(result.rows.length, 2, "Both users should be inserted");
      }
    });

    // ==================== CONSTRAINT TESTS ====================
    
    tester.addTestCase({
      name: "Unique Constraint Violations",
      test: async () => {
        const userData = TestFactory.creator();
        
        // Insert first user
        await db.execute(sql`
          INSERT INTO users (
            email, username, password, password_hash, user_type,
            first_name, last_name, email_verified, is_active
          ) VALUES (
            ${userData.email}, ${userData.username}, ${userData.password},
            ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
            ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
          )
        `);

        // Try to insert user with same email - should fail
        await assertRejects(
          async () => {
            await db.execute(sql`
              INSERT INTO users (
                email, username, password, password_hash, user_type,
                first_name, last_name, email_verified, is_active
              ) VALUES (
                ${userData.email}, ${userData.username + "2"}, ${userData.password},
                ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
                ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
              )
            `);
          },
          Error,
          "Should reject duplicate email"
        );
      }
    });

    tester.addTestCase({
      name: "Foreign Key Constraint Test",
      test: async () => {
        // Try to create pitch with non-existent user_id - should fail
        await assertRejects(
          async () => {
            await db.execute(sql`
              INSERT INTO pitches (user_id, title, logline, genre)
              VALUES (99999, 'Test Pitch', 'Test logline', 'Drama')
            `);
          },
          Error,
          "Should reject invalid foreign key"
        );
      }
    });

    // ==================== PERFORMANCE TESTS ====================
    
    tester.addTestCase({
      name: "Bulk Insert Performance",
      test: async () => {
        const startTime = Date.now();
        const batchSize = 100;
        
        // Create batch of users
        const users = Array.from({ length: batchSize }, () => TestFactory.creator());
        
        // Bulk insert using transaction
        await db.transaction(async (tx) => {
          for (const userData of users) {
            await tx.execute(sql`
              INSERT INTO users (
                email, username, password, password_hash, user_type,
                first_name, last_name, email_verified, is_active
              ) VALUES (
                ${userData.email}, ${userData.username}, ${userData.password},
                ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
                ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
              )
            `);
          }
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`Bulk insert of ${batchSize} users took ${duration}ms`);
        assert(duration < 10000, `Bulk insert too slow: ${duration}ms`);

        // Verify all users were inserted
        const count = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        assert(count.rows[0]?.count >= batchSize, "Not all users were inserted");
      }
    });

    tester.addTestCase({
      name: "Complex Query Performance",
      test: async () => {
        // Create test data
        const userData = TestFactory.creator();
        const userResult = await db.execute(sql`
          INSERT INTO users (
            email, username, password, password_hash, user_type,
            first_name, last_name, email_verified, is_active
          ) VALUES (
            ${userData.email}, ${userData.username}, ${userData.password},
            ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
            ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
          ) RETURNING id
        `);
        
        const userId = userResult.rows[0]?.id;

        // Create multiple pitches
        for (let i = 0; i < 10; i++) {
          const pitchData = TestFactory.pitch(userId);
          await db.execute(sql`
            INSERT INTO pitches (
              user_id, title, logline, genre, short_synopsis,
              target_audience, budget_range, visibility, status
            ) VALUES (
              ${pitchData.userId}, ${pitchData.title}, ${pitchData.logline},
              ${pitchData.genre}, ${pitchData.shortSynopsis}, ${pitchData.targetAudience},
              ${pitchData.budgetRange}, ${pitchData.visibility}, ${pitchData.status}
            )
          `);
        }

        // Test complex join query performance
        const startTime = Date.now();
        const result = await db.execute(sql`
          SELECT 
            u.username,
            u.email,
            COUNT(p.id) as pitch_count,
            AVG(p.view_count) as avg_views,
            MAX(p.created_at) as latest_pitch
          FROM users u
          LEFT JOIN pitches p ON u.id = p.user_id
          WHERE u.is_active = true
          GROUP BY u.id, u.username, u.email
          ORDER BY pitch_count DESC
        `);
        
        const duration = Date.now() - startTime;
        
        console.log(`Complex query took ${duration}ms`);
        assert(duration < 5000, `Complex query too slow: ${duration}ms`);
        assert(result.rows.length > 0, "Query should return results");
      }
    });

    // ==================== DATA INTEGRITY TESTS ====================
    
    tester.addTestCase({
      name: "Data Consistency Check",
      test: async () => {
        // Create user, pitch, and NDA
        const userData = TestFactory.creator();
        const userResult = await db.execute(sql`
          INSERT INTO users (
            email, username, password, password_hash, user_type,
            first_name, last_name, email_verified, is_active
          ) VALUES (
            ${userData.email}, ${userData.username}, ${userData.password},
            ${userData.passwordHash}, ${userData.userType}, ${userData.firstName},
            ${userData.lastName}, ${userData.emailVerified}, ${userData.isActive}
          ) RETURNING id
        `);
        
        const userId = userResult.rows[0]?.id;

        const pitchData = TestFactory.pitch(userId);
        const pitchResult = await db.execute(sql`
          INSERT INTO pitches (
            user_id, title, logline, genre, short_synopsis,
            target_audience, budget_range, visibility, status
          ) VALUES (
            ${pitchData.userId}, ${pitchData.title}, ${pitchData.logline},
            ${pitchData.genre}, ${pitchData.shortSynopsis}, ${pitchData.targetAudience},
            ${pitchData.budgetRange}, ${pitchData.visibility}, ${pitchData.status}
          ) RETURNING id
        `);
        
        const pitchId = pitchResult.rows[0]?.id;

        const ndaData = TestFactory.nda(pitchId, userId);
        await db.execute(sql`
          INSERT INTO ndas (
            pitch_id, user_id, signer_id, status, nda_type, access_granted
          ) VALUES (
            ${ndaData.pitchId}, ${ndaData.userId}, ${ndaData.signerId},
            ${ndaData.status}, ${ndaData.ndaType}, ${ndaData.accessGranted}
          )
        `);

        // Verify data consistency
        const consistency = await db.execute(sql`
          SELECT 
            COUNT(DISTINCT u.id) as user_count,
            COUNT(DISTINCT p.id) as pitch_count,
            COUNT(DISTINCT n.id) as nda_count
          FROM users u
          LEFT JOIN pitches p ON u.id = p.user_id
          LEFT JOIN ndas n ON p.id = n.pitch_id
          WHERE u.id = ${userId}
        `);
        
        const counts = consistency.rows[0];
        assertEquals(counts.user_count, 1, "Should have exactly 1 user");
        assertEquals(counts.pitch_count, 1, "Should have exactly 1 pitch");
        assertEquals(counts.nda_count, 1, "Should have exactly 1 NDA");
      }
    });

    // ==================== RUN ALL TESTS ====================
    
    console.log("🗄️ Starting Database Integration Tests...");
    await tester.runAllTests();
    console.log("✅ All database integration tests passed!");
  }
});