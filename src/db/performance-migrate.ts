// Database Performance Migration Runner for Pitchey
// Handles running performance optimization migrations

import { db } from "./client.ts";
import { sql } from "npm:drizzle-orm";

interface MigrationResult {
  success: boolean;
  migration: string;
  duration: number;
  error?: string;
}

export class PerformanceMigrationRunner {
  /**
   * Run the performance optimization migration
   */
  static async runPerformanceIndexes(): Promise<MigrationResult> {
    const start = performance.now();
    
    try {
      console.log(`🚀 Running performance optimization indexes...`);
      
      // Read migration file
      const migrationPath = "/home/supremeisbeing/pitcheymovie/pitchey_v0.2/src/db/migrations/001-core-performance-indexes.sql";
      const migrationContent = await Deno.readTextFile(migrationPath);
      
      // Split by semicolon and execute each statement
      const statements = migrationContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.toUpperCase().startsWith('ANALYZE'));
      
      console.log(`📝 Executing ${statements.length} SQL statements`);
      
      let executedCount = 0;
      
      // Execute statements one by one (indexes can't be in transactions)
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            console.log(`   Creating index... (${++executedCount}/${statements.length})`);
            await db.execute(sql.raw(statement));
          } catch (error: any) {
            // Ignore "already exists" errors
            if (error.message && error.message.includes('already exists')) {
              console.log(`   ⚠️  Index already exists, skipping...`);
            } else {
              throw error;
            }
          }
        }
      }
      
      // Run ANALYZE separately
      console.log("📊 Updating table statistics...");
      const analyzeTables = ['pitches', 'users', 'pitch_views', 'ndas', 'follows', 'messages', 'notifications'];
      
      for (const table of analyzeTables) {
        try {
          await db.execute(sql.raw(`ANALYZE ${table}`));
        } catch (error) {
          console.warn(`Warning: Could not analyze table ${table}:`, error.message);
        }
      }
      
      const duration = performance.now() - start;
      console.log(`✅ Performance optimization completed successfully in ${duration.toFixed(2)}ms`);
      
      return {
        success: true,
        migration: "performance-indexes",
        duration
      };
      
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ Performance optimization failed after ${duration.toFixed(2)}ms:`, error.message);
      
      return {
        success: false,
        migration: "performance-indexes",
        duration,
        error: error.message
      };
    }
  }

  /**
   * Check database performance and index usage
   */
  static async analyzeDatabase(): Promise<any> {
    try {
      console.log("🔍 Analyzing database performance...");
      
      const tableStatsQuery = sql`
        SELECT 
          schemaname,
          tablename,
          n_live_tup as row_count,
          n_dead_tup as dead_rows,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
        LIMIT 10
      `;
      
      const indexStatsQuery = sql`
        SELECT 
          schemaname,
          tablename,
          indexrelname as index_name,
          idx_scan as scans,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
        LIMIT 20
      `;

      const [tableStats, indexStats] = await Promise.all([
        db.execute(tableStatsQuery),
        db.execute(indexStatsQuery)
      ]);

      console.log("\n📊 Database Analysis Results:");
      console.log("\n🗂️  Top Tables by Row Count:");
      (tableStats.rows as any[]).slice(0, 5).forEach((row: any) => {
        console.log(`   ${row.tablename}: ${row.row_count} rows (${row.dead_rows} dead)`);
      });

      console.log("\n📈 Top Used Indexes:");
      (indexStats.rows as any[]).slice(0, 8).forEach((row: any) => {
        console.log(`   ${row.tablename}.${row.index_name}: ${row.scans} scans`);
      });

      return {
        tableStats: tableStats.rows,
        indexStats: indexStats.rows
      };
      
    } catch (error) {
      console.error("Failed to analyze database:", error.message);
      return null;
    }
  }

  /**
   * Test database performance with sample queries
   */
  static async runPerformanceTests(): Promise<any> {
    console.log("🏃 Running performance tests...");
    
    const tests = [
      {
        name: "Trending Pitches Query",
        query: sql`
          SELECT p.id, p.title, p.like_count, p.view_count, u.username
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.status = 'published'
          ORDER BY (p.like_count * 3 + p.view_count) DESC
          LIMIT 10
        `
      },
      {
        name: "User Dashboard Query", 
        query: sql`
          SELECT p.id, p.title, p.status, p.view_count
          FROM pitches p
          WHERE p.user_id = 1
          ORDER BY p.updated_at DESC
          LIMIT 5
        `
      },
      {
        name: "Search with Text Filter",
        query: sql`
          SELECT p.id, p.title, p.logline, u.username
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.status = 'published'
            AND (LOWER(p.title) LIKE '%drama%' OR LOWER(p.logline) LIKE '%drama%')
          LIMIT 20
        `
      },
      {
        name: "User Authentication",
        query: sql`
          SELECT id, email, user_type 
          FROM users 
          WHERE email = 'alex.creator@demo.com' 
            AND is_active = true
          LIMIT 1
        `
      },
      {
        name: "Recent Activity Query",
        query: sql`
          SELECT COUNT(*) as unread_count
          FROM notifications 
          WHERE user_id = 1 
            AND is_read = false
        `
      }
    ];

    const results = [];
    
    for (const test of tests) {
      const start = performance.now();
      
      try {
        const result = await db.execute(test.query);
        const duration = performance.now() - start;
        
        console.log(`   ✅ ${test.name}: ${duration.toFixed(2)}ms (${result.rows.length} rows)`);
        results.push({
          name: test.name,
          duration,
          rowCount: result.rows.length,
          success: true
        });
        
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`   ❌ ${test.name}: Failed (${duration.toFixed(2)}ms) - ${error.message}`);
        results.push({
          name: test.name,
          duration,
          success: false,
          error: error.message
        });
      }
    }
    
    const avgDuration = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.success).length;
    
    console.log(`\n📊 Performance Summary:`);
    console.log(`   Average query time: ${avgDuration.toFixed(2)}ms`);
    console.log(`   Successful queries: ${results.filter(r => r.success).length}/${results.length}`);
    
    return results;
  }
}

// CLI interface when run directly
if (import.meta.main) {
  const command = Deno.args[0];
  
  switch (command) {
    case "indexes":
      await PerformanceMigrationRunner.runPerformanceIndexes();
      break;
      
    case "analyze":
      await PerformanceMigrationRunner.analyzeDatabase();
      break;
      
    case "test":
      await PerformanceMigrationRunner.runPerformanceTests();
      break;
      
    case "all":
      console.log("🔄 Running full database optimization process...\n");
      await PerformanceMigrationRunner.runPerformanceIndexes();
      console.log("\n");
      await PerformanceMigrationRunner.analyzeDatabase();
      console.log("\n");
      await PerformanceMigrationRunner.runPerformanceTests();
      break;
      
    default:
      console.log(`
📈 Database Performance Optimization Tool

Usage: deno run --allow-all src/db/performance-migrate.ts <command>

Commands:
  indexes  - Create performance optimization indexes
  analyze  - Analyze database performance and index usage
  test     - Run performance tests on common queries
  all      - Run all optimization steps

Examples:
  deno run --allow-all src/db/performance-migrate.ts indexes
  deno run --allow-all src/db/performance-migrate.ts all
`);
  }
  
  Deno.exit(0);
}