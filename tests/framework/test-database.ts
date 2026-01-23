/**
 * Test Database Management Framework
 * Provides database state management, migrations, and cleanup for tests
 * Using raw SQL with Neon's serverless driver
 */

import { createDatabase, RawSQLDatabase } from "../../src/db/raw-sql-connection.ts";
import type { TestScenario } from "./test-factory.ts";
import { TestFactory } from "./test-factory.ts";

interface DatabaseSnapshot {
  id: string;
  timestamp: Date;
  tables: Record<string, unknown[]>;
  sequences: Record<string, number>;
  metadata: {
    version: string;
    environment: string;
    rowCount: number;
  };
}

interface TestDatabaseConfig {
  isolateTests?: boolean;
  useTransactions?: boolean;
  autoCleanup?: boolean;
  preserveSchemaOnly?: boolean;
  maxConnections?: number;
}

interface TableInfo {
  name: string;
  rowCount: number;
  hasData: boolean;
  dependencies: string[];
}

// Create database connection
function getDb(): RawSQLDatabase | null {
  const connectionString = Deno.env.get("DATABASE_URL");
  if (!connectionString) {
    console.warn("DATABASE_URL not set - test database not available");
    return null;
  }
  return createDatabase({ DATABASE_URL: connectionString });
}

export class TestDatabase {
  private static instance: TestDatabase;
  private config: TestDatabaseConfig;
  private snapshots: Map<string, DatabaseSnapshot> = new Map();
  private activeTransactions: Map<string, any> = new Map();
  private testIsolation: boolean;
  private db: RawSQLDatabase | null;

  private constructor(config: TestDatabaseConfig = {}) {
    this.config = {
      isolateTests: true,
      useTransactions: true,
      autoCleanup: true,
      preserveSchemaOnly: false,
      maxConnections: 10,
      ...config,
    };
    this.testIsolation = this.config.isolateTests || false;
    this.db = getDb();
  }

  static getInstance(config?: TestDatabaseConfig): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase(config);
    }
    return TestDatabase.instance;
  }

  // ==================== DATABASE STATE MANAGEMENT ====================

  async initialize(): Promise<void> {
    if (!this.db) {
      console.warn("Test database not available - skipping initialization");
      return;
    }

    try {
      // Ensure test database is properly set up
      await this.ensureTestEnvironment();

      // Clear any existing test data
      if (this.config.autoCleanup) {
        await this.clearTestData();
      }

      console.log("Test database initialized successfully");
    } catch (error: unknown) {
      console.error("Failed to initialize test database:", error);
      throw error;
    }
  }

  private async ensureTestEnvironment(): Promise<void> {
    if (!this.db) return;

    const env = Deno.env.get("NODE_ENV") || Deno.env.get("DENO_ENV");

    if (env === "production") {
      throw new Error("Cannot run tests against production database!");
    }

    // Verify we're using a test database
    const result = await this.db.query<{ db_name: string }>("SELECT current_database() as db_name");
    const dbName = result[0]?.db_name;

    if (!dbName?.includes("test")) {
      console.warn(`Warning: Database name '${dbName}' doesn't contain 'test'`);
    }
  }

  // ==================== TEST DATA SEEDING ====================

  async seed(scenario: TestScenario): Promise<void> {
    if (!this.db) {
      console.warn("Test database not available - skipping seed");
      return;
    }

    console.log(`Seeding database with scenario: ${scenario}`);

    try {
      const data = await TestFactory.buildScenario(scenario);

      // Clear existing data first
      await this.clearTestData();

      // Insert users first (they're referenced by other tables)
      for (const user of data.users) {
        await this.db.query(
          `INSERT INTO users (
            email, username, password, password_hash, user_type,
            first_name, last_name, phone, location, bio, website,
            avatar_url, profile_image_url, company_name, company_number,
            company_website, company_address, email_verified, is_active,
            subscription_tier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            user.email, user.username, user.password, user.passwordHash,
            user.userType, user.firstName, user.lastName, user.phone,
            user.location, user.bio, user.website, user.avatar_url,
            user.profileImageUrl, user.companyName, user.companyNumber,
            user.companyWebsite, user.companyAddress, user.emailVerified,
            user.isActive, user.subscriptionTier
          ]
        );
      }

      // Insert pitches
      for (const pitch of data.pitches) {
        await this.db.query(
          `INSERT INTO pitches (
            user_id, title, logline, genre, short_synopsis, long_synopsis,
            target_audience, themes, budget_range, visibility, status,
            require_nda, seeking_investment, production_stage
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            pitch.userId, pitch.title, pitch.logline, pitch.genre,
            pitch.shortSynopsis, pitch.longSynopsis, pitch.targetAudience,
            pitch.themes, pitch.budgetRange, pitch.visibility,
            pitch.status, pitch.requireNda, pitch.seekingInvestment,
            pitch.productionStage
          ]
        );
      }

      // Insert NDAs
      for (const nda of data.ndas) {
        await this.db.query(
          `INSERT INTO ndas (
            pitch_id, user_id, signer_id, status, nda_type,
            access_granted, signed_at, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            nda.pitchId, nda.userId, nda.signerId, nda.status,
            nda.ndaType, nda.accessGranted, nda.signedAt, nda.expiresAt
          ]
        );
      }

      // Insert investments
      for (const investment of data.investments) {
        await this.db.query(
          `INSERT INTO investments (
            investor_id, pitch_id, amount, status, terms, current_value, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            investment.investorId, investment.pitchId, investment.amount,
            investment.status, investment.terms, investment.currentValue,
            investment.notes
          ]
        );
      }

      // Insert messages
      for (const message of data.messages) {
        await this.db.query(
          `INSERT INTO messages (
            sender_id, receiver_id, subject, content, message_type,
            pitch_id, read, sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            message.senderId, message.receiverId, message.subject,
            message.content, message.messageType, message.pitchId,
            message.read, message.sentAt
          ]
        );
      }

      console.log(`Successfully seeded database with ${data.users.length} users, ${data.pitches.length} pitches`);
    } catch (error: unknown) {
      console.error("Failed to seed database:", error);
      throw error;
    }
  }

  // ==================== DATABASE CLEANUP ====================

  async clearTestData(): Promise<void> {
    if (Deno.env.get("NODE_ENV") === "production") {
      throw new Error("Cannot clear data in production environment!");
    }

    if (!this.db) {
      console.warn("Test database not available - skipping cleanup");
      return;
    }

    try {
      // Clear tables in dependency order
      const tables = [
        "experiment_events",
        "user_experiment_assignments",
        "experiment_results",
        "experiments",
        "credit_transactions",
        "investments",
        "investment_interests",
        "messages",
        "ndas",
        "nda_requests",
        "pitch_views",
        "pitch_likes",
        "pitch_saves",
        "notifications",
        "follows",
        "saved_pitches",
        "pitches",
        "sessions",
        "user_sessions",
        "analytics_events",
        "users",
      ];

      for (const table of tables) {
        try {
          await this.db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch (error: unknown) {
          // Table might not exist, continue
          console.warn(`Warning: Could not truncate table ${table}:`, (error as Error).message);
        }
      }

      console.log("Test data cleared successfully");
    } catch (error: unknown) {
      console.error("Failed to clear test data:", error);
      throw error;
    }
  }

  // ==================== SNAPSHOT MANAGEMENT ====================

  async createSnapshot(name: string = `snapshot_${Date.now()}`): Promise<string> {
    if (!this.db) {
      throw new Error("Test database not available");
    }

    console.log(`Creating database snapshot: ${name}`);

    try {
      const tables = await this.getAllTableData();
      const sequences = await this.getAllSequenceValues();
      const rowCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);

      const snapshot: DatabaseSnapshot = {
        id: name,
        timestamp: new Date(),
        tables,
        sequences,
        metadata: {
          version: "1.0",
          environment: Deno.env.get("NODE_ENV") || "test",
          rowCount,
        },
      };

      this.snapshots.set(name, snapshot);
      console.log(`Snapshot '${name}' created with ${rowCount} total rows`);

      return name;
    } catch (error: unknown) {
      console.error("Failed to create snapshot:", error);
      throw error;
    }
  }

  async restoreSnapshot(name: string): Promise<void> {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      throw new Error(`Snapshot '${name}' not found`);
    }

    console.log(`Restoring database snapshot: ${name}`);

    try {
      // Clear current data
      await this.clearTestData();

      // Restore table data
      for (const [tableName, rows] of Object.entries(snapshot.tables)) {
        if (rows.length > 0) {
          await this.insertTableData(tableName, rows);
        }
      }

      // Restore sequence values
      for (const [sequenceName, value] of Object.entries(snapshot.sequences)) {
        await this.setSequenceValue(sequenceName, value);
      }

      console.log(`Snapshot '${name}' restored successfully`);
    } catch (error: unknown) {
      console.error("Failed to restore snapshot:", error);
      throw error;
    }
  }

  private async getAllTableData(): Promise<Record<string, unknown[]>> {
    if (!this.db) return {};

    const tables: Record<string, unknown[]> = {};

    // Get list of all tables
    const result = await this.db.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);

    for (const row of result) {
      const tableName = row.table_name;
      try {
        const tableData = await this.db.query(`SELECT * FROM ${tableName}`);
        tables[tableName] = tableData;
      } catch (error: unknown) {
        console.warn(`Could not read table ${tableName}:`, (error as Error).message);
        tables[tableName] = [];
      }
    }

    return tables;
  }

  private async getAllSequenceValues(): Promise<Record<string, number>> {
    if (!this.db) return {};

    const sequences: Record<string, number> = {};

    try {
      const result = await this.db.query<{ sequence_name: string; last_value: number }>(`
        SELECT sequence_name, last_value
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      `);

      for (const row of result) {
        sequences[row.sequence_name] = row.last_value;
      }
    } catch (error: unknown) {
      console.warn("Could not read sequence values:", (error as Error).message);
    }

    return sequences;
  }

  private async insertTableData(tableName: string, rows: unknown[]): Promise<void> {
    if (rows.length === 0 || !this.db) return;

    try {
      // Get column names from first row
      const firstRow = rows[0] as Record<string, unknown>;
      const columns = Object.keys(firstRow);

      // Build INSERT statement
      const columnList = columns.join(", ");
      const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(", ");

      for (const row of rows) {
        const values = columns.map(col => (row as Record<string, unknown>)[col]);
        await this.db.query(
          `INSERT INTO ${tableName} (${columnList}) VALUES (${valuePlaceholders})`,
          values
        );
      }
    } catch (error: unknown) {
      console.warn(`Could not insert data into ${tableName}:`, (error as Error).message);
    }
  }

  private async setSequenceValue(sequenceName: string, value: number): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.query(`SELECT setval('${sequenceName}', ${value})`);
    } catch (error: unknown) {
      console.warn(`Could not set sequence ${sequenceName}:`, (error as Error).message);
    }
  }

  // ==================== DATABASE HEALTH CHECK ====================

  async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    tableCount: number;
    rowCount: number;
    issues: string[];
  }> {
    const startTime = Date.now();
    const issues: string[] = [];
    let connected = false;
    let tableCount = 0;
    let rowCount = 0;

    if (!this.db) {
      issues.push("Database not available");
      return { connected, latency: 0, tableCount, rowCount, issues };
    }

    try {
      // Test basic connectivity
      await this.db.query("SELECT 1 as test");
      connected = true;

      // Count tables
      const tableResult = await this.db.query<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
      tableCount = tableResult[0]?.count || 0;

      // Get approximate row count
      const rowResult = await this.db.query<{ total_rows: number }>(`
        SELECT SUM(n_tup_ins) as total_rows
        FROM pg_stat_user_tables
      `);
      rowCount = rowResult[0]?.total_rows || 0;

      // Check for missing required tables
      const requiredTables = ["users", "pitches", "ndas", "messages"];
      for (const table of requiredTables) {
        try {
          await this.db.query(`SELECT 1 FROM ${table} LIMIT 1`);
        } catch (error: unknown) {
          issues.push(`Missing required table: ${table}`);
        }
      }

    } catch (error: unknown) {
      issues.push(`Database connection failed: ${(error as Error).message}`);
    }

    const latency = Date.now() - startTime;

    return {
      connected,
      latency,
      tableCount,
      rowCount,
      issues,
    };
  }

  // ==================== UTILITY METHODS ====================

  async getTableInfo(): Promise<TableInfo[]> {
    if (!this.db) return [];

    const result = await this.db.query<{
      table_name: string;
      row_count: number;
      has_data: boolean;
    }>(`
      SELECT
        t.table_name,
        COALESCE(s.n_tup_ins, 0) as row_count,
        CASE WHEN s.n_tup_ins > 0 THEN true ELSE false END as has_data
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    return result.map((row) => ({
      name: row.table_name,
      rowCount: row.row_count,
      hasData: row.has_data,
      dependencies: [],
    }));
  }

  listSnapshots(): DatabaseSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  deleteSnapshot(name: string): boolean {
    return this.snapshots.delete(name);
  }

  async cleanup(): Promise<void> {
    // Clear test data if auto cleanup is enabled
    if (this.config.autoCleanup) {
      await this.clearTestData();
    }

    // Clear snapshots
    this.snapshots.clear();
  }
}

// ==================== CONVENIENCE EXPORTS ====================

export const testDb = TestDatabase.getInstance();

export async function withDatabase<T>(
  scenario: TestScenario,
  testFn: () => Promise<T>
): Promise<T> {
  const db = TestDatabase.getInstance();

  try {
    await db.seed(scenario);
    return await testFn();
  } finally {
    await db.clearTestData();
  }
}

export async function withSnapshot<T>(
  snapshotName: string,
  testFn: () => Promise<T>
): Promise<T> {
  const db = TestDatabase.getInstance();

  try {
    await db.restoreSnapshot(snapshotName);
    return await testFn();
  } finally {
    await db.clearTestData();
  }
}
