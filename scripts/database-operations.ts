#!/usr/bin/env deno run --allow-all

/**
 * Database Operations Script
 * Provides backup, monitoring, and maintenance operations for the Pitchey database
 * Compatible with both local PostgreSQL and Neon cloud databases
 */

import pg from "npm:pg@8.11.3";
const { Client } = pg;

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const BACKUP_RETENTION_DAYS = 7;
const isLocalDb = DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

interface DatabaseStats {
  totalTables: number;
  totalRows: number;
  totalSize: string;
  contentManagementTables: string[];
  lastBackup?: string;
  connectionCount: number;
}

interface TableInfo {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  lastUpdated?: string;
}

class DatabaseOperations {
  private client: Client;

  constructor() {
    this.client = new Client({
      connectionString: DATABASE_URL,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log("✅ Connected to database");
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    console.log("✅ Disconnected from database");
  }

  /**
   * BACKUP OPERATIONS
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `pitchey_backup_${timestamp}`;

    if (isLocalDb) {
      // Local PostgreSQL backup using pg_dump
      const command = new Deno.Command("pg_dump", {
        args: [
          DATABASE_URL,
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          "--file", `./backups/${backupName}.dump`
        ],
      });

      try {
        // Ensure backup directory exists
        await Deno.mkdir("./backups", { recursive: true });
        
        const { code, stderr } = await command.output();
        
        if (code !== 0) {
          const errorText = new TextDecoder().decode(stderr);
          throw new Error(`Backup failed: ${errorText}`);
        }

        console.log(`✅ Local backup created: ${backupName}.dump`);
        return `./backups/${backupName}.dump`;
      } catch (error) {
        console.error("❌ Local backup failed:", error.message);
        throw error;
      }
    } else {
      // For Neon/cloud databases, create SQL dump
      console.log("📦 Creating SQL backup for cloud database...");
      
      const tables = await this.getAllTables();
      let sqlDump = `-- Pitchey Database Backup\n-- Created: ${new Date().toISOString()}\n\n`;

      for (const table of tables) {
        try {
          // Get table structure
          const structureResult = await this.client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
            ORDER BY ordinal_position
          `, [table]);

          sqlDump += `-- Table: ${table}\n`;
          sqlDump += `-- Columns: ${structureResult.rows.length}\n\n`;

          // Get row count (for reference)
          const countResult = await this.client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          sqlDump += `-- Rows: ${countResult.rows[0].count}\n\n`;

        } catch (error) {
          console.warn(`⚠️ Could not backup table ${table}: ${error.message}`);
        }
      }

      await Deno.mkdir("./backups", { recursive: true });
      await Deno.writeTextFile(`./backups/${backupName}.sql`, sqlDump);
      
      console.log(`✅ Cloud database backup metadata created: ${backupName}.sql`);
      return `./backups/${backupName}.sql`;
    }
  }

  async cleanupOldBackups(): Promise<void> {
    try {
      const backupDir = "./backups";
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

      for await (const dirEntry of Deno.readDir(backupDir)) {
        if (dirEntry.isFile && (dirEntry.name.endsWith('.dump') || dirEntry.name.endsWith('.sql'))) {
          const filePath = `${backupDir}/${dirEntry.name}`;
          const fileInfo = await Deno.stat(filePath);
          
          if (fileInfo.mtime && fileInfo.mtime < cutoffDate) {
            await Deno.remove(filePath);
            console.log(`🗑️ Removed old backup: ${dirEntry.name}`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Backup cleanup failed:", error.message);
    }
  }

  /**
   * MONITORING OPERATIONS
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      // Get table count and content management tables
      const tablesResult = await this.client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);

      const contentMgmtTables = tablesResult.rows
        .map(row => row.table_name)
        .filter((name: string) => [
          'feature_flags', 'portal_configurations', 'content_items', 
          'navigation_menus', 'translations', 'content_types', 
          'content_approvals', 'translation_keys'
        ].includes(name));

      // Get total row count across all tables
      let totalRows = 0;
      for (const row of tablesResult.rows) {
        try {
          const countResult = await this.client.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
          totalRows += parseInt(countResult.rows[0].count);
        } catch (error) {
          console.warn(`⚠️ Could not count rows in ${row.table_name}`);
        }
      }

      // Get database size (for local PostgreSQL)
      let dbSize = "Unknown";
      if (isLocalDb) {
        try {
          const sizeResult = await this.client.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
          `);
          dbSize = sizeResult.rows[0].size;
        } catch (error) {
          console.warn("⚠️ Could not get database size");
        }
      }

      // Get connection count
      let connectionCount = 0;
      try {
        const connResult = await this.client.query(`
          SELECT count(*) as connections 
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `);
        connectionCount = parseInt(connResult.rows[0].connections);
      } catch (error) {
        console.warn("⚠️ Could not get connection count");
      }

      return {
        totalTables: tablesResult.rows.length,
        totalRows,
        totalSize: dbSize,
        contentManagementTables: contentMgmtTables,
        connectionCount
      };
    } catch (error) {
      console.error("❌ Failed to get database stats:", error.message);
      throw error;
    }
  }

  async getTableInfo(): Promise<TableInfo[]> {
    try {
      const tablesResult = await this.client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tableInfo: TableInfo[] = [];

      for (const row of tablesResult.rows) {
        try {
          const countResult = await this.client.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
          
          let sizeBytes = 0;
          if (isLocalDb) {
            const sizeResult = await this.client.query(`
              SELECT pg_total_relation_size($1) as size
            `, [row.table_name]);
            sizeBytes = parseInt(sizeResult.rows[0].size || 0);
          }

          tableInfo.push({
            tableName: row.table_name,
            rowCount: parseInt(countResult.rows[0].count),
            sizeBytes
          });
        } catch (error) {
          console.warn(`⚠️ Could not get info for table ${row.table_name}`);
          tableInfo.push({
            tableName: row.table_name,
            rowCount: 0,
            sizeBytes: 0
          });
        }
      }

      return tableInfo.sort((a, b) => b.rowCount - a.rowCount);
    } catch (error) {
      console.error("❌ Failed to get table info:", error.message);
      throw error;
    }
  }

  /**
   * MAINTENANCE OPERATIONS
   */
  async vacuumAnalyze(): Promise<void> {
    if (!isLocalDb) {
      console.log("⚠️ VACUUM ANALYZE not available for cloud databases");
      return;
    }

    try {
      console.log("🧹 Running VACUUM ANALYZE...");
      await this.client.query("VACUUM ANALYZE");
      console.log("✅ VACUUM ANALYZE completed");
    } catch (error) {
      console.error("❌ VACUUM ANALYZE failed:", error.message);
      throw error;
    }
  }

  async checkContentManagementTables(): Promise<void> {
    const requiredTables = [
      'feature_flags', 'portal_configurations', 'content_items', 
      'navigation_menus', 'translations', 'content_types', 
      'content_approvals', 'translation_keys'
    ];

    console.log("🔍 Checking Content Management System tables...");

    for (const tableName of requiredTables) {
      try {
        const result = await this.client.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);

        if (parseInt(result.rows[0].count) > 0) {
          const rowCountResult = await this.client.query(`SELECT COUNT(*) as rows FROM "${tableName}"`);
          console.log(`✅ ${tableName}: ${rowCountResult.rows[0].rows} rows`);
        } else {
          console.log(`❌ ${tableName}: Table missing`);
        }
      } catch (error) {
        console.log(`❌ ${tableName}: Error checking table - ${error.message}`);
      }
    }
  }

  /**
   * UTILITY METHODS
   */
  private async getAllTables(): Promise<string[]> {
    const result = await this.client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    return result.rows.map(row => row.table_name);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("❌ Connection test failed:", error.message);
      return false;
    }
  }
}

/**
 * MAIN EXECUTION
 */
async function main() {
  const args = Deno.args;
  const operation = args[0] || "status";

  const dbOps = new DatabaseOperations();

  try {
    await dbOps.connect();

    switch (operation) {
      case "backup":
        console.log("📦 Creating database backup...");
        const backupPath = await dbOps.createBackup();
        console.log(`📦 Backup saved to: ${backupPath}`);
        await dbOps.cleanupOldBackups();
        break;

      case "status":
        console.log("📊 Database Status Report");
        console.log("========================");
        
        const stats = await dbOps.getDatabaseStats();
        console.log(`Total Tables: ${stats.totalTables}`);
        console.log(`Total Rows: ${stats.totalRows.toLocaleString()}`);
        console.log(`Database Size: ${stats.totalSize}`);
        console.log(`Active Connections: ${stats.connectionCount}`);
        console.log(`Content Management Tables: ${stats.contentManagementTables.length}/8`);
        
        if (stats.contentManagementTables.length === 8) {
          console.log("✅ All Content Management tables present");
        } else {
          console.log("⚠️ Some Content Management tables missing");
        }
        break;

      case "tables":
        console.log("📋 Table Information");
        console.log("====================");
        
        const tableInfo = await dbOps.getTableInfo();
        console.log("Table Name".padEnd(30) + "Rows".padEnd(10) + "Size");
        console.log("-".repeat(50));
        
        for (const table of tableInfo) {
          const sizeDisplay = table.sizeBytes > 0 ? 
            `${Math.round(table.sizeBytes / 1024)} KB` : "N/A";
          console.log(
            table.tableName.padEnd(30) + 
            table.rowCount.toString().padEnd(10) + 
            sizeDisplay
          );
        }
        break;

      case "maintenance":
        console.log("🔧 Running database maintenance...");
        await dbOps.vacuumAnalyze();
        await dbOps.checkContentManagementTables();
        console.log("✅ Maintenance completed");
        break;

      case "test":
        console.log("🧪 Testing database connection...");
        const isConnected = await dbOps.testConnection();
        if (isConnected) {
          console.log("✅ Database connection is healthy");
          await dbOps.checkContentManagementTables();
        } else {
          console.log("❌ Database connection failed");
          Deno.exit(1);
        }
        break;

      default:
        console.log("Available operations:");
        console.log("  status      - Show database status");
        console.log("  backup      - Create database backup");
        console.log("  tables      - Show table information");
        console.log("  maintenance - Run maintenance tasks");
        console.log("  test        - Test database connection");
        break;
    }

  } catch (error) {
    console.error("❌ Operation failed:", error.message);
    Deno.exit(1);
  } finally {
    await dbOps.disconnect();
  }
}

if (import.meta.main) {
  await main();
}