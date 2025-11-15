/**
 * Intelligent Database Query Optimization Service
 * Provides automated query analysis, optimization suggestions, and performance monitoring
 */

import { telemetry } from "../utils/telemetry.ts";

export interface QueryMetrics {
  id: string;
  sql: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: number;
  database: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  tables: string[];
  indexes: string[];
  planCost: number;
  cacheHit: boolean;
  parameters?: any[];
}

export interface QueryPlan {
  nodeType: string;
  cost: number;
  rows: number;
  width: number;
  actualTime: number;
  actualRows: number;
  children?: QueryPlan[];
  details: {
    table?: string;
    index?: string;
    condition?: string;
    joinType?: string;
    scanType?: "Sequential Scan" | "Index Scan" | "Bitmap Heap Scan";
  };
}

export interface OptimizationSuggestion {
  type: "index" | "query_rewrite" | "schema_change" | "parameter_tuning";
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  sql?: string;
  estimatedImprovement: number; // percentage
  effort: "easy" | "medium" | "complex";
  tables: string[];
  reasoning: string;
}

export interface DatabaseHealth {
  connectionPool: {
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
    utilization: number;
  };
  queryPerformance: {
    averageExecutionTime: number;
    slowQueryCount: number;
    queryPerSecond: number;
    cacheHitRate: number;
  };
  indexHealth: {
    unusedIndexes: string[];
    missingIndexes: string[];
    oversizedIndexes: string[];
    fragmentedIndexes: string[];
  };
  diskUsage: {
    totalSize: number;
    dataSize: number;
    indexSize: number;
    logSize: number;
    freeSpace: number;
  };
}

export interface QueryAnalysis {
  complexity: "simple" | "moderate" | "complex" | "very_complex";
  performance: "excellent" | "good" | "poor" | "critical";
  riskFactors: string[];
  optimizations: OptimizationSuggestion[];
  warnings: string[];
}

export class DatabaseOptimizerService {
  private static queryHistory = new Map<string, QueryMetrics[]>();
  private static queryCache = new Map<string, { result: any; timestamp: number; ttl: number }>();
  private static slowQueries: QueryMetrics[] = [];
  private static optimizationRules: Array<(metrics: QueryMetrics) => OptimizationSuggestion[]> = [];
  
  private static readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private static readonly CACHE_TTL = 300000; // 5 minutes
  private static readonly MAX_HISTORY_SIZE = 10000;
  
  /**
   * Initialize the database optimizer
   */
  static initialize() {
    console.log("🔧 Initializing database query optimizer...");
    
    // Register optimization rules
    this.registerOptimizationRules();
    
    // Start background analysis
    this.startBackgroundAnalysis();
    
    console.log("✅ Database query optimizer initialized");
  }
  
  /**
   * Record a query execution for analysis
   */
  static recordQuery(metrics: Omit<QueryMetrics, "id" | "timestamp">): string {
    const id = crypto.randomUUID();
    const fullMetrics: QueryMetrics = {
      ...metrics,
      id,
      timestamp: Date.now()
    };
    
    // Store in history
    const tableKey = metrics.tables.join(",") || "unknown";
    if (!this.queryHistory.has(tableKey)) {
      this.queryHistory.set(tableKey, []);
    }
    
    const history = this.queryHistory.get(tableKey)!;
    history.push(fullMetrics);
    
    // Keep history manageable
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    // Track slow queries
    if (fullMetrics.executionTime > this.SLOW_QUERY_THRESHOLD) {
      this.slowQueries.push(fullMetrics);
      this.slowQueries.sort((a, b) => b.executionTime - a.executionTime);
      this.slowQueries = this.slowQueries.slice(0, 100); // Keep top 100
      
      telemetry.logger.warn("Slow query detected", {
        queryId: id,
        executionTime: fullMetrics.executionTime,
        operation: fullMetrics.operation,
        tables: fullMetrics.tables
      });
    }
    
    return id;
  }
  
  /**
   * Analyze a specific query for optimization opportunities
   */
  static async analyzeQuery(sql: string, plan?: QueryPlan): Promise<QueryAnalysis> {
    const normalizedSql = this.normalizeSql(sql);
    const complexity = this.analyzeComplexity(sql);
    const tables = this.extractTables(sql);
    const operation = this.extractOperation(sql);
    
    // Find similar queries in history
    const similarQueries = this.findSimilarQueries(normalizedSql, tables);
    const avgExecutionTime = similarQueries.length > 0
      ? similarQueries.reduce((sum, q) => sum + q.executionTime, 0) / similarQueries.length
      : 0;
    
    // Determine performance category
    const performance = this.categorizePerformance(avgExecutionTime);
    
    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(sql, plan);
    
    // Generate optimization suggestions
    const optimizations = await this.generateOptimizations(sql, similarQueries, plan);
    
    // Generate warnings
    const warnings = this.generateWarnings(sql, avgExecutionTime);
    
    return {
      complexity,
      performance,
      riskFactors,
      optimizations,
      warnings
    };
  }
  
  /**
   * Get database health metrics
   */
  static async getDatabaseHealth(): Promise<DatabaseHealth> {
    // In a real implementation, these would come from actual database metrics
    return {
      connectionPool: {
        active: 15,
        idle: 35,
        waiting: 2,
        maxConnections: 100,
        utilization: 52
      },
      queryPerformance: {
        averageExecutionTime: this.calculateAverageExecutionTime(),
        slowQueryCount: this.slowQueries.length,
        queryPerSecond: this.calculateQPS(),
        cacheHitRate: this.calculateCacheHitRate()
      },
      indexHealth: {
        unusedIndexes: await this.findUnusedIndexes(),
        missingIndexes: await this.suggestMissingIndexes(),
        oversizedIndexes: [],
        fragmentedIndexes: []
      },
      diskUsage: {
        totalSize: 5.2 * 1024 * 1024 * 1024, // 5.2 GB
        dataSize: 3.8 * 1024 * 1024 * 1024, // 3.8 GB
        indexSize: 1.1 * 1024 * 1024 * 1024, // 1.1 GB
        logSize: 300 * 1024 * 1024, // 300 MB
        freeSpace: 10 * 1024 * 1024 * 1024 // 10 GB
      }
    };
  }
  
  /**
   * Get optimization recommendations for the entire database
   */
  static async getGlobalOptimizations(): Promise<{
    critical: OptimizationSuggestion[];
    high: OptimizationSuggestion[];
    medium: OptimizationSuggestion[];
    low: OptimizationSuggestion[];
  }> {
    const allOptimizations: OptimizationSuggestion[] = [];
    
    // Analyze slow queries
    for (const query of this.slowQueries.slice(0, 20)) {
      const analysis = await this.analyzeQuery(query.sql);
      allOptimizations.push(...analysis.optimizations);
    }
    
    // Add global optimizations
    allOptimizations.push(...await this.generateGlobalOptimizations());
    
    // Deduplicate and categorize
    const uniqueOptimizations = this.deduplicateOptimizations(allOptimizations);
    
    return {
      critical: uniqueOptimizations.filter(o => o.priority === "critical"),
      high: uniqueOptimizations.filter(o => o.priority === "high"),
      medium: uniqueOptimizations.filter(o => o.priority === "medium"),
      low: uniqueOptimizations.filter(o => o.priority === "low")
    };
  }
  
  /**
   * Execute query with optimization and caching
   */
  static async executeOptimized<T>(
    sql: string,
    params: any[] = [],
    options: {
      cache?: boolean;
      cacheTtl?: number;
      timeout?: number;
      database?: string;
    } = {}
  ): Promise<{ result: T; fromCache: boolean; executionTime: number }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(sql, params);
    const useCache = options.cache !== false;
    
    // Check cache first
    if (useCache) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() < cached.timestamp + cached.ttl) {
        return {
          result: cached.result,
          fromCache: true,
          executionTime: Date.now() - startTime
        };
      }
    }
    
    try {
      // In a real implementation, this would execute the actual query
      const result = await this.mockQueryExecution<T>(sql, params);
      const executionTime = Date.now() - startTime;
      
      // Record metrics
      this.recordQuery({
        sql,
        executionTime,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        database: options.database || "default",
        operation: this.extractOperation(sql),
        tables: this.extractTables(sql),
        indexes: [], // Would be populated from query plan
        planCost: 100, // Mock cost
        cacheHit: false,
        parameters: params
      });
      
      // Cache result
      if (useCache) {
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          ttl: options.cacheTtl || this.CACHE_TTL
        });
      }
      
      return {
        result,
        fromCache: false,
        executionTime
      };
      
    } catch (error) {
      telemetry.logger.error("Query execution failed", error, { sql, params });
      throw error;
    }
  }
  
  /**
   * Get query performance statistics
   */
  static getQueryStats(tableName?: string): {
    totalQueries: number;
    slowQueries: number;
    averageTime: number;
    topSlowQueries: QueryMetrics[];
    cacheHitRate: number;
    operationBreakdown: Record<string, number>;
  } {
    let queries: QueryMetrics[];
    
    if (tableName) {
      queries = this.queryHistory.get(tableName) || [];
    } else {
      queries = Array.from(this.queryHistory.values()).flat();
    }
    
    const slowQueries = queries.filter(q => q.executionTime > this.SLOW_QUERY_THRESHOLD);
    const averageTime = queries.length > 0
      ? queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length
      : 0;
    
    const operationCounts = queries.reduce((acc, q) => {
      acc[q.operation] = (acc[q.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topSlowQueries = queries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);
    
    return {
      totalQueries: queries.length,
      slowQueries: slowQueries.length,
      averageTime,
      topSlowQueries,
      cacheHitRate: this.calculateCacheHitRate(),
      operationBreakdown: operationCounts
    };
  }
  
  // Private helper methods
  
  private static registerOptimizationRules() {
    // Rule 1: Missing indexes on frequently queried columns
    this.optimizationRules.push((metrics) => {
      if (metrics.operation === "SELECT" && metrics.executionTime > 500) {
        return [{
          type: "index",
          priority: "high",
          description: `Consider adding index on frequently queried columns in ${metrics.tables.join(", ")}`,
          estimatedImprovement: 70,
          effort: "easy",
          tables: metrics.tables,
          reasoning: "Long execution time suggests missing indexes"
        }];
      }
      return [];
    });
    
    // Rule 2: Query rewriting for complex joins
    this.optimizationRules.push((metrics) => {
      if (metrics.sql.includes("JOIN") && metrics.executionTime > 1000) {
        return [{
          type: "query_rewrite",
          priority: "medium",
          description: "Consider rewriting complex JOIN query for better performance",
          estimatedImprovement: 40,
          effort: "medium",
          tables: metrics.tables,
          reasoning: "Complex JOINs can often be optimized through rewriting"
        }];
      }
      return [];
    });
    
    // Rule 3: Parameter optimization
    this.optimizationRules.push((metrics) => {
      if (metrics.parameters && metrics.parameters.length > 5) {
        return [{
          type: "parameter_tuning",
          priority: "low",
          description: "Consider reducing parameter count or using batch operations",
          estimatedImprovement: 20,
          effort: "medium",
          tables: metrics.tables,
          reasoning: "Queries with many parameters can be inefficient"
        }];
      }
      return [];
    });
  }
  
  private static startBackgroundAnalysis() {
    // Run analysis every 5 minutes
    setInterval(() => {
      this.runBackgroundAnalysis();
    }, 5 * 60 * 1000);
  }
  
  private static async runBackgroundAnalysis() {
    try {
      // Clean up old cache entries
      this.cleanupCache();
      
      // Analyze recent slow queries
      const recentSlowQueries = this.slowQueries.filter(
        q => Date.now() - q.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
      );
      
      if (recentSlowQueries.length > 10) {
        telemetry.logger.warn("High number of slow queries detected", {
          count: recentSlowQueries.length,
          averageTime: recentSlowQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentSlowQueries.length
        });
      }
      
      // Generate optimization alerts
      const optimizations = await this.getGlobalOptimizations();
      const criticalOptimizations = optimizations.critical;
      
      if (criticalOptimizations.length > 0) {
        telemetry.logger.warn("Critical database optimizations needed", {
          count: criticalOptimizations.length,
          types: criticalOptimizations.map(o => o.type)
        });
      }
      
    } catch (error) {
      telemetry.logger.error("Background analysis failed", error);
    }
  }
  
  private static cleanupCache() {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.queryCache) {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.queryCache.delete(key));
    
    if (expiredKeys.length > 0) {
      telemetry.logger.debug("Cache cleanup", { expiredEntries: expiredKeys.length });
    }
  }
  
  private static normalizeSql(sql: string): string {
    return sql
      .replace(/\s+/g, " ")
      .replace(/\d+/g, "?")
      .replace(/'[^']*'/g, "?")
      .trim()
      .toLowerCase();
  }
  
  private static analyzeComplexity(sql: string): QueryAnalysis["complexity"] {
    const joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
    const subqueryCount = (sql.match(/\bSELECT\b/gi) || []).length - 1;
    const unionCount = (sql.match(/\bUNION\b/gi) || []).length;
    
    const complexity = joinCount + (subqueryCount * 2) + (unionCount * 1.5);
    
    if (complexity > 10) return "very_complex";
    if (complexity > 5) return "complex";
    if (complexity > 2) return "moderate";
    return "simple";
  }
  
  private static extractTables(sql: string): string[] {
    const tablePattern = /(?:FROM|JOIN|UPDATE|INTO)\s+(\w+)/gi;
    const matches = sql.match(tablePattern) || [];
    return [...new Set(matches.map(match => match.split(/\s+/)[1]))];
  }
  
  private static extractOperation(sql: string): QueryMetrics["operation"] {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT")) return "SELECT";
    if (trimmed.startsWith("INSERT")) return "INSERT";
    if (trimmed.startsWith("UPDATE")) return "UPDATE";
    if (trimmed.startsWith("DELETE")) return "DELETE";
    return "SELECT";
  }
  
  private static findSimilarQueries(normalizedSql: string, tables: string[]): QueryMetrics[] {
    const similar: QueryMetrics[] = [];
    
    for (const tableQueries of this.queryHistory.values()) {
      for (const query of tableQueries) {
        const queryNormalized = this.normalizeSql(query.sql);
        
        // Simple similarity check
        if (queryNormalized === normalizedSql ||
            query.tables.some(t => tables.includes(t))) {
          similar.push(query);
        }
      }
    }
    
    return similar.slice(-50); // Return recent 50 similar queries
  }
  
  private static categorizePerformance(avgTime: number): QueryAnalysis["performance"] {
    if (avgTime < 50) return "excellent";
    if (avgTime < 200) return "good";
    if (avgTime < 1000) return "poor";
    return "critical";
  }
  
  private static identifyRiskFactors(sql: string, plan?: QueryPlan): string[] {
    const risks: string[] = [];
    
    if (sql.includes("SELECT *")) {
      risks.push("Using SELECT * can impact performance");
    }
    
    if (sql.includes("ORDER BY") && !sql.includes("LIMIT")) {
      risks.push("ORDER BY without LIMIT can be expensive on large datasets");
    }
    
    if (sql.includes("LIKE '%")) {
      risks.push("Leading wildcard LIKE queries cannot use indexes effectively");
    }
    
    if ((sql.match(/JOIN/gi) || []).length > 3) {
      risks.push("Multiple JOINs may indicate complex query requiring optimization");
    }
    
    if (plan?.nodeType === "Sequential Scan") {
      risks.push("Sequential scan detected - consider adding appropriate indexes");
    }
    
    return risks;
  }
  
  private static async generateOptimizations(
    sql: string, 
    similarQueries: QueryMetrics[], 
    plan?: QueryPlan
  ): Promise<OptimizationSuggestion[]> {
    const optimizations: OptimizationSuggestion[] = [];
    
    // Apply registered rules
    for (const query of similarQueries.slice(0, 5)) {
      for (const rule of this.optimizationRules) {
        optimizations.push(...rule(query));
      }
    }
    
    // Add specific optimizations based on SQL analysis
    if (sql.includes("COUNT(*)") && sql.includes("GROUP BY")) {
      optimizations.push({
        type: "index",
        priority: "medium",
        description: "Consider composite index for GROUP BY columns used with COUNT",
        estimatedImprovement: 50,
        effort: "easy",
        tables: this.extractTables(sql),
        reasoning: "Composite indexes can significantly speed up grouped aggregations"
      });
    }
    
    if (sql.includes("ORDER BY") && sql.includes("LIMIT")) {
      optimizations.push({
        type: "index",
        priority: "high",
        description: "Add index on ORDER BY columns for LIMIT queries",
        estimatedImprovement: 80,
        effort: "easy",
        tables: this.extractTables(sql),
        reasoning: "Index on ORDER BY columns enables efficient top-N queries"
      });
    }
    
    return this.deduplicateOptimizations(optimizations);
  }
  
  private static generateWarnings(sql: string, avgTime: number): string[] {
    const warnings: string[] = [];
    
    if (avgTime > 5000) {
      warnings.push("Query execution time exceeds 5 seconds - immediate optimization needed");
    }
    
    if (sql.length > 1000) {
      warnings.push("Very long query - consider breaking into smaller operations");
    }
    
    if ((sql.match(/\bOR\b/gi) || []).length > 5) {
      warnings.push("Multiple OR conditions can be inefficient - consider UNION or IN clause");
    }
    
    return warnings;
  }
  
  private static async generateGlobalOptimizations(): Promise<OptimizationSuggestion[]> {
    const global: OptimizationSuggestion[] = [];
    
    // Check cache hit rate
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < 70) {
      global.push({
        type: "parameter_tuning",
        priority: "medium",
        description: "Low query cache hit rate - consider increasing cache size or TTL",
        estimatedImprovement: 30,
        effort: "easy",
        tables: [],
        reasoning: "Better caching can reduce database load significantly"
      });
    }
    
    // Check slow query count
    if (this.slowQueries.length > 50) {
      global.push({
        type: "query_rewrite",
        priority: "high",
        description: "High number of slow queries detected - comprehensive query review needed",
        estimatedImprovement: 60,
        effort: "complex",
        tables: [],
        reasoning: "Multiple slow queries indicate systemic performance issues"
      });
    }
    
    return global;
  }
  
  private static deduplicateOptimizations(optimizations: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const seen = new Set<string>();
    return optimizations.filter(opt => {
      const key = `${opt.type}:${opt.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  private static async findUnusedIndexes(): Promise<string[]> {
    // Mock implementation - would query actual database
    return [
      "idx_pitches_unused_field",
      "idx_users_legacy_column"
    ];
  }
  
  private static async suggestMissingIndexes(): Promise<string[]> {
    // Analyze slow queries to suggest missing indexes
    const suggestions: string[] = [];
    
    for (const query of this.slowQueries.slice(0, 10)) {
      if (query.sql.includes("WHERE") && query.executionTime > 1000) {
        suggestions.push(`idx_${query.tables[0]}_missing`);
      }
    }
    
    return [...new Set(suggestions)];
  }
  
  private static calculateAverageExecutionTime(): number {
    const allQueries = Array.from(this.queryHistory.values()).flat();
    if (allQueries.length === 0) return 0;
    
    return allQueries.reduce((sum, q) => sum + q.executionTime, 0) / allQueries.length;
  }
  
  private static calculateQPS(): number {
    const allQueries = Array.from(this.queryHistory.values()).flat();
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentQueries = allQueries.filter(q => q.timestamp > oneSecondAgo);
    return recentQueries.length;
  }
  
  private static calculateCacheHitRate(): number {
    const allQueries = Array.from(this.queryHistory.values()).flat();
    if (allQueries.length === 0) return 0;
    
    const cacheHits = allQueries.filter(q => q.cacheHit).length;
    return (cacheHits / allQueries.length) * 100;
  }
  
  private static generateCacheKey(sql: string, params: any[]): string {
    const normalizedSql = this.normalizeSql(sql);
    const paramString = JSON.stringify(params);
    return btoa(normalizedSql + paramString).substring(0, 32);
  }
  
  private static async mockQueryExecution<T>(sql: string, params: any[]): Promise<T> {
    // Mock implementation - simulate query execution
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Return mock data based on query type
    if (sql.toLowerCase().includes("select")) {
      return [] as unknown as T;
    } else {
      return { affectedRows: 1 } as unknown as T;
    }
  }
  
  // Public API methods
  
  static clearHistory() {
    this.queryHistory.clear();
    this.slowQueries.length = 0;
    this.queryCache.clear();
    telemetry.logger.info("Database optimizer history cleared");
  }
  
  static getSlowQueries(limit = 50): QueryMetrics[] {
    return this.slowQueries.slice(0, limit);
  }
  
  static getCacheStats() {
    return {
      size: this.queryCache.size,
      hitRate: this.calculateCacheHitRate(),
      entriesCount: this.queryCache.size
    };
  }
}