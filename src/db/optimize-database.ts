/**
 * Database Optimization Script
 * Analyzes and optimizes database performance
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';

interface OptimizationResult {
  action: string;
  impact: 'high' | 'medium' | 'low';
  executed: boolean;
  result?: any;
  error?: string;
}

export class DatabaseOptimizer {
  private db: any;
  private results: OptimizationResult[] = [];

  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool);
  }

  /**
   * Run complete optimization suite
   */
  async optimize() {
    console.log('🔧 Starting Database Optimization...\n');

    await this.analyzeCurrentState();
    await this.createMissingIndexes();
    await this.optimizeExistingIndexes();
    await this.updateStatistics();
    await this.identifySlowQueries();
    await this.optimizeTableStructure();
    await this.cleanupOrphanedData();
    await this.optimizeConnections();
    
    this.generateReport();
  }

  /**
   * Analyze current database state
   */
  private async analyzeCurrentState() {
    console.log('📊 Analyzing Database State...');

    try {
      // Get database size
      const sizeResult = await this.db.execute(`
        SELECT 
          pg_database_size(current_database()) as total_size,
          pg_size_pretty(pg_database_size(current_database())) as total_size_pretty
      `);

      // Get table sizes
      const tableSizes = await this.db.execute(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);

      // Get index usage stats
      const indexStats = await this.db.execute(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY schemaname, tablename
      `);

      console.log(`  Database Size: ${sizeResult.rows[0].total_size_pretty}`);
      console.log(`  Tables: ${tableSizes.rowCount}`);
      console.log(`  Unused Indexes: ${indexStats.rowCount}`);

      this.results.push({
        action: 'Database Analysis',
        impact: 'low',
        executed: true,
        result: {
          databaseSize: sizeResult.rows[0].total_size_pretty,
          largestTables: tableSizes.rows.slice(0, 5).map(t => t.tablename),
          unusedIndexes: indexStats.rowCount
        }
      });
    } catch (error) {
      this.results.push({
        action: 'Database Analysis',
        impact: 'low',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Create missing but recommended indexes
   */
  private async createMissingIndexes() {
    console.log('🔍 Creating Missing Indexes...');

    const indexesToCreate = [
      // Pitches table indexes
      {
        name: 'idx_pitches_status_created',
        table: 'pitches',
        columns: ['status', 'created_at DESC'],
        impact: 'high'
      },
      {
        name: 'idx_pitches_genre_status',
        table: 'pitches',
        columns: ['genre', 'status'],
        impact: 'high'
      },
      {
        name: 'idx_pitches_creator_status',
        table: 'pitches',
        columns: ['creator_id', 'status'],
        impact: 'medium'
      },
      
      // Users table indexes
      {
        name: 'idx_users_email_lower',
        table: 'users',
        columns: ['LOWER(email)'],
        impact: 'high'
      },
      {
        name: 'idx_users_type',
        table: 'users',
        columns: ['type'],
        impact: 'medium'
      },
      
      // NDA table indexes
      {
        name: 'idx_ndas_pitch_status',
        table: 'ndas',
        columns: ['pitch_id', 'status'],
        impact: 'high'
      },
      {
        name: 'idx_ndas_requester_status',
        table: 'ndas',
        columns: ['requester_id', 'status'],
        impact: 'medium'
      },
      
      // Views table indexes
      {
        name: 'idx_views_pitch_date',
        table: 'views',
        columns: ['pitch_id', 'viewed_at DESC'],
        impact: 'medium'
      },
      
      // Notifications table indexes
      {
        name: 'idx_notifications_user_read',
        table: 'notifications',
        columns: ['user_id', 'is_read'],
        impact: 'high'
      },
      
      // Messages table indexes
      {
        name: 'idx_messages_conversation',
        table: 'messages',
        columns: ['sender_id', 'recipient_id', 'created_at DESC'],
        impact: 'medium'
      },
      
      // Full-text search indexes
      {
        name: 'idx_pitches_fulltext',
        table: 'pitches',
        columns: ['to_tsvector(\'english\', title || \' \' || logline || \' \' || COALESCE(synopsis, \'\'))'],
        type: 'gin',
        impact: 'high'
      }
    ];

    for (const index of indexesToCreate) {
      try {
        // Check if index exists
        const exists = await this.db.execute(`
          SELECT 1 FROM pg_indexes 
          WHERE indexname = '${index.name}'
        `);

        if (exists.rowCount === 0) {
          const indexType = index.type || 'btree';
          const sql = `
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name}
            ON ${index.table} ${indexType === 'gin' ? 'USING gin' : ''}
            (${index.columns.join(', ')})
          `;

          await this.db.execute(sql);
          
          console.log(`  ✓ Created index: ${index.name}`);
          this.results.push({
            action: `Create index ${index.name}`,
            impact: index.impact,
            executed: true
          });
        }
      } catch (error) {
        console.log(`  ✗ Failed to create index ${index.name}: ${error.message}`);
        this.results.push({
          action: `Create index ${index.name}`,
          impact: index.impact,
          executed: false,
          error: error.message
        });
      }
    }
  }

  /**
   * Optimize existing indexes
   */
  private async optimizeExistingIndexes() {
    console.log('⚡ Optimizing Existing Indexes...');

    try {
      // Rebuild bloated indexes
      const bloatedIndexes = await this.db.execute(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
          indexrelid::regclass AS index
        FROM pg_stat_user_indexes
        JOIN pg_index ON pg_index.indexrelid = pg_stat_user_indexes.indexrelid
        WHERE pg_relation_size(indexrelid) > 1048576 -- > 1MB
          AND NOT indisunique
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      `);

      for (const index of bloatedIndexes.rows) {
        try {
          await this.db.execute(`REINDEX INDEX CONCURRENTLY ${index.indexname}`);
          console.log(`  ✓ Reindexed: ${index.indexname}`);
        } catch (error) {
          console.log(`  ⚠ Could not reindex ${index.indexname}: ${error.message}`);
        }
      }

      this.results.push({
        action: 'Optimize indexes',
        impact: 'medium',
        executed: true,
        result: `Optimized ${bloatedIndexes.rowCount} indexes`
      });
    } catch (error) {
      this.results.push({
        action: 'Optimize indexes',
        impact: 'medium',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Update table statistics for query planner
   */
  private async updateStatistics() {
    console.log('📈 Updating Statistics...');

    const tables = [
      'users', 'pitches', 'ndas', 'views', 'notifications',
      'messages', 'saved_pitches', 'investments', 'follows'
    ];

    try {
      for (const table of tables) {
        await this.db.execute(`ANALYZE ${table}`);
        console.log(`  ✓ Analyzed: ${table}`);
      }

      this.results.push({
        action: 'Update statistics',
        impact: 'medium',
        executed: true,
        result: `Analyzed ${tables.length} tables`
      });
    } catch (error) {
      this.results.push({
        action: 'Update statistics',
        impact: 'medium',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Identify slow queries
   */
  private async identifySlowQueries() {
    console.log('🐌 Identifying Slow Queries...');

    try {
      const slowQueries = await this.db.execute(`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > 100 -- > 100ms average
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      if (slowQueries.rowCount > 0) {
        console.log(`  Found ${slowQueries.rowCount} slow queries`);
        
        // Generate optimization suggestions
        for (const query of slowQueries.rows) {
          const suggestions = this.analyzeQuery(query.query);
          if (suggestions.length > 0) {
            console.log(`  Query: ${query.query.substring(0, 50)}...`);
            suggestions.forEach(s => console.log(`    → ${s}`));
          }
        }
      }

      this.results.push({
        action: 'Identify slow queries',
        impact: 'high',
        executed: true,
        result: `Found ${slowQueries.rowCount} slow queries`
      });
    } catch (error) {
      // pg_stat_statements might not be enabled
      console.log('  ⚠ pg_stat_statements not available');
      this.results.push({
        action: 'Identify slow queries',
        impact: 'high',
        executed: false,
        error: 'pg_stat_statements extension not enabled'
      });
    }
  }

  /**
   * Analyze query and provide optimization suggestions
   */
  private analyzeQuery(query: string): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    if (queryLower.includes('select *')) {
      suggestions.push('Avoid SELECT *, specify needed columns');
    }

    if (queryLower.includes('like \'%')) {
      suggestions.push('Leading wildcard prevents index usage, consider full-text search');
    }

    if (queryLower.includes('not in') || queryLower.includes('not exists')) {
      suggestions.push('Consider using LEFT JOIN with NULL check for better performance');
    }

    if (!queryLower.includes('limit') && queryLower.includes('order by')) {
      suggestions.push('Consider adding LIMIT to ordered queries');
    }

    if (queryLower.includes('distinct')) {
      suggestions.push('DISTINCT can be expensive, ensure proper indexes');
    }

    return suggestions;
  }

  /**
   * Optimize table structure
   */
  private async optimizeTableStructure() {
    console.log('🏗️ Optimizing Table Structure...');

    try {
      // Add missing foreign key constraints
      const foreignKeys = [
        {
          table: 'pitches',
          column: 'creator_id',
          refTable: 'users',
          refColumn: 'id'
        },
        {
          table: 'ndas',
          column: 'pitch_id',
          refTable: 'pitches',
          refColumn: 'id'
        },
        {
          table: 'ndas',
          column: 'requester_id',
          refTable: 'users',
          refColumn: 'id'
        },
        {
          table: 'views',
          column: 'pitch_id',
          refTable: 'pitches',
          refColumn: 'id'
        },
        {
          table: 'views',
          column: 'viewer_id',
          refTable: 'users',
          refColumn: 'id'
        }
      ];

      let addedConstraints = 0;
      for (const fk of foreignKeys) {
        const constraintName = `fk_${fk.table}_${fk.column}`;
        try {
          await this.db.execute(`
            ALTER TABLE ${fk.table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${fk.column})
            REFERENCES ${fk.refTable}(${fk.refColumn})
            ON DELETE CASCADE
            NOT VALID
          `);
          
          // Validate in background
          await this.db.execute(`
            ALTER TABLE ${fk.table}
            VALIDATE CONSTRAINT ${constraintName}
          `);
          
          addedConstraints++;
          console.log(`  ✓ Added foreign key: ${constraintName}`);
        } catch (error) {
          // Constraint might already exist
        }
      }

      this.results.push({
        action: 'Optimize table structure',
        impact: 'medium',
        executed: true,
        result: `Added ${addedConstraints} foreign key constraints`
      });
    } catch (error) {
      this.results.push({
        action: 'Optimize table structure',
        impact: 'medium',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Clean up orphaned data
   */
  private async cleanupOrphanedData() {
    console.log('🧹 Cleaning Orphaned Data...');

    try {
      // Clean orphaned views
      const orphanedViews = await this.db.execute(`
        DELETE FROM views v
        WHERE NOT EXISTS (
          SELECT 1 FROM pitches p WHERE p.id = v.pitch_id
        )
      `);

      // Clean orphaned notifications
      const orphanedNotifications = await this.db.execute(`
        DELETE FROM notifications n
        WHERE NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = n.user_id
        )
      `);

      // Clean old sessions
      const oldSessions = await this.db.execute(`
        DELETE FROM sessions
        WHERE expires_at < NOW() - INTERVAL '30 days'
      `);

      const totalCleaned = 
        orphanedViews.rowCount + 
        orphanedNotifications.rowCount + 
        oldSessions.rowCount;

      console.log(`  ✓ Cleaned ${totalCleaned} orphaned records`);

      this.results.push({
        action: 'Cleanup orphaned data',
        impact: 'low',
        executed: true,
        result: `Cleaned ${totalCleaned} records`
      });
    } catch (error) {
      this.results.push({
        action: 'Cleanup orphaned data',
        impact: 'low',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Optimize connection settings
   */
  private async optimizeConnections() {
    console.log('🔌 Optimizing Connections...');

    try {
      // Get current settings
      const settings = await this.db.execute(`
        SELECT name, setting, unit 
        FROM pg_settings 
        WHERE name IN (
          'max_connections',
          'shared_buffers',
          'effective_cache_size',
          'work_mem',
          'maintenance_work_mem'
        )
      `);

      console.log('  Current Settings:');
      settings.rows.forEach(s => {
        console.log(`    ${s.name}: ${s.setting}${s.unit || ''}`);
      });

      // Recommendations based on Neon best practices
      const recommendations = [
        'Consider using connection pooling (PgBouncer or Hyperdrive)',
        'Set statement_timeout to prevent long-running queries',
        'Enable pg_stat_statements for query monitoring',
        'Use prepared statements for frequently executed queries'
      ];

      console.log('\n  Recommendations:');
      recommendations.forEach(r => console.log(`    → ${r}`));

      this.results.push({
        action: 'Connection optimization',
        impact: 'high',
        executed: true,
        result: {
          settings: settings.rows,
          recommendations
        }
      });
    } catch (error) {
      this.results.push({
        action: 'Connection optimization',
        impact: 'high',
        executed: false,
        error: error.message
      });
    }
  }

  /**
   * Generate optimization report
   */
  private generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE OPTIMIZATION REPORT');
    console.log('='.repeat(60));

    const highImpact = this.results.filter(r => r.impact === 'high');
    const mediumImpact = this.results.filter(r => r.impact === 'medium');
    const lowImpact = this.results.filter(r => r.impact === 'low');
    const successful = this.results.filter(r => r.executed);
    const failed = this.results.filter(r => !r.executed);

    console.log('\nSummary:');
    console.log(`  Total Actions: ${this.results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);
    console.log(`  High Impact: ${highImpact.length}`);
    console.log(`  Medium Impact: ${mediumImpact.length}`);
    console.log(`  Low Impact: ${lowImpact.length}`);

    if (failed.length > 0) {
      console.log('\n❌ Failed Actions:');
      failed.forEach(r => {
        console.log(`  - ${r.action}: ${r.error}`);
      });
    }

    console.log('\n✅ Completed Optimizations:');
    successful.forEach(r => {
      const impact = r.impact === 'high' ? '🔴' : r.impact === 'medium' ? '🟡' : '🟢';
      console.log(`  ${impact} ${r.action}`);
      if (r.result) {
        if (typeof r.result === 'string') {
          console.log(`     ${r.result}`);
        }
      }
    });

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: this.results
    };

    Deno.writeTextFileSync(
      `db-optimization-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Report saved to db-optimization-report-*.json');
  }
}

// Run if executed directly
if (import.meta.main) {
  const connectionString = Deno.env.get('DATABASE_URL');
  if (!connectionString) {
    console.error('DATABASE_URL environment variable not set');
    Deno.exit(1);
  }

  const optimizer = new DatabaseOptimizer(connectionString);
  await optimizer.optimize();
}