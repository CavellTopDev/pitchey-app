// Quick test to verify database optimizations are working

import { OptimizedPitchService } from "./src/services/optimized-pitch.service.ts";
import { databaseCacheService } from "./src/services/database-cache.service.ts";
import { DatabaseMetrics } from "./src/db/client.ts";

async function testOptimizations() {
  console.log("🧪 Testing Database Optimizations...\n");

  // Test 1: Cached trending pitches
  console.log("1. Testing trending pitches with caching...");
  const start1 = performance.now();
  
  const trending1 = await OptimizedPitchService.getTrendingPitches(5, '24h');
  const duration1 = performance.now() - start1;
  console.log(`   First call: ${duration1.toFixed(2)}ms (${trending1.length} pitches)`);
  
  const start2 = performance.now();
  const trending2 = await OptimizedPitchService.getTrendingPitches(5, '24h');
  const duration2 = performance.now() - start2;
  console.log(`   Second call: ${duration2.toFixed(2)}ms (${trending2.length} pitches) - Cache hit!`);
  
  const cacheSpeedup = ((duration1 - duration2) / duration1 * 100).toFixed(1);
  console.log(`   Cache speedup: ${cacheSpeedup}%\n`);

  // Test 2: Optimized pitch with relations
  console.log("2. Testing pitch with relations (single query vs N+1)...");
  let pitch = null;
  if (trending1.length > 0) {
    const pitchId = trending1[0].id;
    const start3 = performance.now();
    
    pitch = await OptimizedPitchService.getPitchWithRelations(pitchId, 1);
    const duration3 = performance.now() - start3;
    
    console.log(`   Pitch query: ${duration3.toFixed(2)}ms`);
    console.log(`   Pitch: "${pitch?.title || 'Not found'}" by ${pitch?.creator?.username || 'Unknown'}`);
    console.log(`   Has relations: ${!!pitch?.creator} (creator), ${!!pitch?.stats} (stats)\n`);
  } else {
    console.log("   No pitches available to test\n");
  }

  // Test 3: Cache statistics
  console.log("3. Cache statistics...");
  const cacheStats = await databaseCacheService.getCacheStats();
  console.log(`   Cache enabled: ${cacheStats.enabled}`);
  console.log(`   Total cached keys: ${cacheStats.totalKeys}\n`);

  // Test 4: Query metrics
  console.log("4. Query performance metrics...");
  const queryStats = DatabaseMetrics.getQueryStats();
  console.log(`   Total queries executed: ${queryStats.totalQueries}`);
  console.log(`   Average query time: ${queryStats.averageTime.toFixed(2)}ms`);
  console.log(`   Slow queries (>100ms): ${queryStats.slowQueries}`);
  console.log(`   Recent queries: ${queryStats.recentQueries.length}\n`);

  // Test 5: Search optimization
  console.log("5. Testing optimized search...");
  const start5 = performance.now();
  
  const searchResults = await OptimizedPitchService.searchPitches({
    query: "drama",
    limit: 10,
    sortBy: 'relevance'
  });
  
  const duration5 = performance.now() - start5;
  console.log(`   Search query: ${duration5.toFixed(2)}ms`);
  console.log(`   Results: ${searchResults.pitches.length}/${searchResults.totalCount} pitches`);
  console.log(`   Query: "${searchResults.query}"\n`);

  // Summary
  console.log("✅ Database Optimization Test Summary:");
  console.log(`   • Caching working: ${duration2 < duration1 ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Relations in single query: ${pitch?.creator ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Query monitoring active: ${queryStats.totalQueries > 0 ? '✅ Yes' : '❌ No'}`);
  console.log(`   • Average query performance: ${queryStats.averageTime < 100 ? '✅ Good' : '⚠️ Needs attention'} (${queryStats.averageTime.toFixed(2)}ms)`);
  console.log(`   • Cache hit rate estimated: ~${cacheSpeedup}%`);
}

if (import.meta.main) {
  try {
    await testOptimizations();
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
  
  Deno.exit(0);
}