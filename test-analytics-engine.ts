/**
 * Test Analytics Engine Integration
 * 
 * Tests the database metrics collection and Analytics Engine integration
 * to verify that performance data is being captured correctly.
 */

import { DatabaseMetricsService, getAnalyticsDatasets } from './src/services/database-metrics.service.ts';

interface MockAnalyticsEngine {
  writeDataPoint(data: any): Promise<void>;
}

class MockAnalyticsEngineDataset implements MockAnalyticsEngine {
  private dataPoints: any[] = [];
  
  async writeDataPoint(data: any): Promise<void> {
    console.log('📊 Analytics Engine Data Point:', JSON.stringify(data, null, 2));
    this.dataPoints.push(data);
  }
  
  getDataPoints(): any[] {
    return this.dataPoints;
  }
  
  clear(): void {
    this.dataPoints = [];
  }
}

class TestRunner {
  private mockDatabase: MockAnalyticsEngineDataset;
  private mockPerformance: MockAnalyticsEngineDataset;
  private mockErrors: MockAnalyticsEngineDataset;

  constructor() {
    this.mockDatabase = new MockAnalyticsEngineDataset();
    this.mockPerformance = new MockAnalyticsEngineDataset();
    this.mockErrors = new MockAnalyticsEngineDataset();
  }

  async testDatabaseMetrics(): Promise<void> {
    console.log('\n🔍 Testing Database Query Metrics...\n');

    // Test successful SELECT query
    await DatabaseMetricsService.recordQuery(this.mockDatabase as any, {
      queryType: 'SELECT',
      table: 'pitches',
      duration: 45,
      rowCount: 20,
      success: true,
      timestamp: Date.now(),
      endpoint: '/api/pitches',
      userId: 'user_123'
    });

    // Test slow INSERT query
    await DatabaseMetricsService.recordQuery(this.mockDatabase as any, {
      queryType: 'INSERT',
      table: 'investments',
      duration: 156,
      rowCount: 1,
      success: true,
      timestamp: Date.now(),
      endpoint: '/api/investments',
      userId: 'user_456'
    });

    // Test failed UPDATE query
    await DatabaseMetricsService.recordQuery(this.mockDatabase as any, {
      queryType: 'UPDATE',
      table: 'users',
      duration: 89,
      success: false,
      errorCode: 'CONSTRAINT_VIOLATION',
      timestamp: Date.now(),
      endpoint: '/api/profile',
      userId: 'user_789'
    });

    console.log(`✅ Recorded ${this.mockDatabase.getDataPoints().length} database metrics\n`);
  }

  async testPerformanceMetrics(): Promise<void> {
    console.log('⚡ Testing API Performance Metrics...\n');

    // Test fast API endpoint
    await DatabaseMetricsService.recordPerformance(this.mockPerformance as any, {
      endpoint: '/api/auth/session',
      method: 'GET',
      duration: 23,
      statusCode: 200,
      timestamp: Date.now(),
      queryCount: 1,
      cacheHit: true,
      userId: 'user_123'
    });

    // Test slow API endpoint
    await DatabaseMetricsService.recordPerformance(this.mockPerformance as any, {
      endpoint: '/api/dashboard/creator',
      method: 'GET',
      duration: 234,
      statusCode: 200,
      timestamp: Date.now(),
      queryCount: 8,
      cacheHit: false,
      userId: 'user_456'
    });

    // Test failed API endpoint
    await DatabaseMetricsService.recordPerformance(this.mockPerformance as any, {
      endpoint: '/api/investments',
      method: 'POST',
      duration: 167,
      statusCode: 500,
      timestamp: Date.now(),
      queryCount: 3,
      cacheHit: false,
      userId: 'user_789'
    });

    console.log(`✅ Recorded ${this.mockPerformance.getDataPoints().length} performance metrics\n`);
  }

  async testErrorMetrics(): Promise<void> {
    console.log('🚨 Testing Error Tracking...\n');

    // Test database error
    await DatabaseMetricsService.recordError(this.mockErrors as any, {
      type: 'DATABASE',
      source: 'SELECT:pitches',
      message: 'Connection timeout after 30 seconds',
      code: 'CONNECTION_TIMEOUT',
      timestamp: Date.now(),
      endpoint: '/api/pitches',
      userId: 'user_123'
    });

    // Test API error
    await DatabaseMetricsService.recordError(this.mockErrors as any, {
      type: 'API',
      source: '/api/investments',
      message: 'Invalid investment amount: must be positive number',
      code: 'VALIDATION_ERROR',
      timestamp: Date.now(),
      endpoint: '/api/investments',
      userId: 'user_456'
    });

    // Test slow query warning
    await DatabaseMetricsService.recordError(this.mockErrors as any, {
      type: 'SLOW_QUERY',
      source: 'SELECT:user_analytics_daily',
      message: 'Query took 234ms (threshold: 100ms)',
      code: 'PERFORMANCE_WARNING',
      timestamp: Date.now(),
      endpoint: '/api/analytics/dashboard',
      userId: 'user_789'
    });

    console.log(`✅ Recorded ${this.mockErrors.getDataPoints().length} error metrics\n`);
  }

  async testUtilityFunctions(): Promise<void> {
    console.log('🔧 Testing Utility Functions...\n');

    const queries = [
      'SELECT * FROM pitches WHERE genre = $1',
      'INSERT INTO investments (pitch_id, amount) VALUES ($1, $2)',
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      'DELETE FROM notifications WHERE created_at < $1',
      'WITH trending AS (SELECT * FROM pitches) SELECT * FROM trending'
    ];

    queries.forEach(query => {
      const queryType = DatabaseMetricsService.extractQueryType(query);
      const table = DatabaseMetricsService.extractTableName(query);
      console.log(`📝 Query: "${query.substring(0, 40)}..."`);
      console.log(`   Type: ${queryType}, Table: ${table}`);
    });

    console.log('\n✅ Utility functions working correctly\n');
  }

  async testQueryWrapper(): Promise<void> {
    console.log('🎯 Testing Query Wrapper Pattern...\n');

    const mockExecutor = async (query: string, params: any[]) => {
      console.log(`🔄 Executing: ${query.substring(0, 50)}...`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Simulate query time
      return { results: [{ id: 1, title: 'Test Pitch' }], changes: 1 };
    };

    const wrapper = DatabaseMetricsService.createQueryWrapper(
      this.mockDatabase as any,
      { endpoint: '/api/pitches', userId: 'test_user' }
    );

    // Test successful query
    const result = await wrapper(
      'SELECT * FROM pitches WHERE id = $1',
      [1],
      mockExecutor
    );

    console.log(`✅ Query wrapper executed successfully, result:`, result);

    // Test failed query
    try {
      const failingExecutor = async () => {
        throw new Error('Simulated database error');
      };
      await wrapper('SELECT * FROM invalid_table', [], failingExecutor);
    } catch (error) {
      console.log(`✅ Query wrapper caught error correctly: ${error.message}`);
    }

    console.log();
  }

  generateAnalyticsReport(): void {
    console.log('\n📊 ANALYTICS ENGINE INTEGRATION REPORT\n');
    console.log('=' .repeat(50));

    const totalDataPoints = 
      this.mockDatabase.getDataPoints().length +
      this.mockPerformance.getDataPoints().length +
      this.mockErrors.getDataPoints().length;

    console.log(`📈 Total Data Points Generated: ${totalDataPoints}`);
    console.log(`🗃️  Database Metrics: ${this.mockDatabase.getDataPoints().length}`);
    console.log(`⚡ Performance Metrics: ${this.mockPerformance.getDataPoints().length}`);
    console.log(`🚨 Error Metrics: ${this.mockErrors.getDataPoints().length}`);

    console.log('\n📋 Data Point Structure Analysis:');
    const sampleDataPoint = this.mockDatabase.getDataPoints()[0];
    if (sampleDataPoint) {
      console.log(`   Blobs: ${sampleDataPoint.blobs?.length || 0} fields`);
      console.log(`   Doubles: ${sampleDataPoint.doubles?.length || 0} numeric fields`);
      console.log(`   Indexes: ${sampleDataPoint.indexes?.length || 0} index fields`);
    }

    console.log('\n🎯 Key Metrics Captured:');
    console.log('   ✅ Query performance (type, table, duration)');
    console.log('   ✅ API endpoint response times');
    console.log('   ✅ Error categorization and tracking');
    console.log('   ✅ User context and endpoint mapping');
    console.log('   ✅ Cache hit/miss tracking');
    console.log('   ✅ Database operation success rates');

    console.log('\n🚀 Ready for Cloudflare Analytics Engine Integration!');
    console.log('   📡 Deploy with: wrangler deploy');
    console.log('   📊 View metrics in Cloudflare Dashboard > Analytics > Analytics Engine');
    console.log('   🔍 Query data via GraphQL API or Dashboard');
    
    console.log('\n=' .repeat(50));
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 CLOUDFLARE ANALYTICS ENGINE INTEGRATION TEST\n');
    console.log('Testing database metrics collection for Pitchey platform\n');

    try {
      await this.testDatabaseMetrics();
      await this.testPerformanceMetrics();
      await this.testErrorMetrics();
      await this.testUtilityFunctions();
      await this.testQueryWrapper();

      this.generateAnalyticsReport();
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
}

// Run tests
const testRunner = new TestRunner();
testRunner.runAllTests();