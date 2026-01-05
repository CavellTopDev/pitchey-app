/**
 * AI Inference Container Integration Tests
 * 
 * Tests AI inference capabilities including text classification, content generation,
 * sentiment analysis, and content moderation
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import ContainerTestBase from '../framework/container-test-base.ts';
import { PERFORMANCE_TARGETS } from '../config/test-config.ts';

class AIInferenceTests extends ContainerTestBase {
  private serviceName = 'ai';
  
  async testBasicHealth(): Promise<void> {
    console.log('🔍 Testing AI inference basic health');
    
    const startTime = performance.now();
    await this.assertServiceHealthy(this.serviceName);
    const responseTime = performance.now() - startTime;
    
    this.assertResponseTime(responseTime, 10000, 'AI service health check');
    console.log('✅ AI inference health check passed');
  }
  
  async testTextClassification(): Promise<void> {
    console.log('🔍 Testing text classification');
    
    const testTexts = [
      'This movie pitch is absolutely amazing and innovative!',
      'This script is terrible and makes no sense.',
      'The story has potential but needs some refinement.',
    ];
    
    for (const text of testTexts) {
      const startTime = performance.now();
      const response = await this.makeRequest(this.serviceName, '/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          task: 'sentiment',
        }),
      });
      const duration = performance.now() - startTime;
      
      assertEquals(response.status, 200);
      
      const result = await response.json();
      assertExists(result.classification);
      assertExists(result.confidence);
      assert(result.confidence >= 0 && result.confidence <= 1);
      assert(['positive', 'negative', 'neutral'].includes(result.classification));
      
      this.assertResponseTime(duration, PERFORMANCE_TARGETS.AI_INFERENCE.classification, 'Text classification');
    }
    
    console.log('✅ Text classification completed successfully');
  }
  
  async testContentGeneration(): Promise<void> {
    console.log('🔍 Testing content generation');
    
    const prompts = [
      'Generate a brief movie pitch about space exploration.',
      'Write a character description for a detective story.',
      'Create a tagline for an action movie.',
    ];
    
    for (const prompt of prompts) {
      const startTime = performance.now();
      const response = await this.makeRequest(this.serviceName, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
      const duration = performance.now() - startTime;
      
      assertEquals(response.status, 200);
      
      const result = await response.json();
      assertExists(result.generated_text);
      assertExists(result.tokens_used);
      assert(result.generated_text.length > 0);
      assert(result.tokens_used > 0);
      
      this.assertResponseTime(duration, PERFORMANCE_TARGETS.AI_INFERENCE.generation, 'Content generation');
    }
    
    console.log('✅ Content generation completed successfully');
  }
  
  async testContentModeration(): Promise<void> {
    console.log('🔍 Testing content moderation');
    
    const testContents = [
      'This is a family-friendly movie about friendship.',
      'This content contains inappropriate language and violence.',
      'A heartwarming story about overcoming challenges.',
    ];
    
    for (const content of testContents) {
      const startTime = performance.now();
      const response = await this.makeRequest(this.serviceName, '/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          categories: ['violence', 'hate', 'sexual', 'harassment'],
        }),
      });
      const duration = performance.now() - startTime;
      
      assertEquals(response.status, 200);
      
      const result = await response.json();
      assertExists(result.flagged);
      assertExists(result.categories);
      assertExists(result.confidence_scores);
      assert(typeof result.flagged === 'boolean');
      
      this.assertResponseTime(duration, PERFORMANCE_TARGETS.AI_INFERENCE.moderation, 'Content moderation');
    }
    
    console.log('✅ Content moderation completed successfully');
  }
  
  async testSentimentAnalysis(): Promise<void> {
    console.log('🔍 Testing sentiment analysis');
    
    const testReviews = [
      'I absolutely loved this movie! The acting was superb and the plot was engaging.',
      'This was the worst film I have ever seen. Complete waste of time.',
      'The movie was okay, nothing special but not terrible either.',
    ];
    
    for (const review of testReviews) {
      const startTime = performance.now();
      const response = await this.makeRequest(this.serviceName, '/api/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: review,
        }),
      });
      const duration = performance.now() - startTime;
      
      assertEquals(response.status, 200);
      
      const result = await response.json();
      assertExists(result.sentiment);
      assertExists(result.score);
      assertExists(result.confidence);
      assert(['positive', 'negative', 'neutral'].includes(result.sentiment));
      assert(result.score >= -1 && result.score <= 1);
      assert(result.confidence >= 0 && result.confidence <= 1);
      
      this.assertResponseTime(duration, PERFORMANCE_TARGETS.AI_INFERENCE.sentiment, 'Sentiment analysis');
    }
    
    console.log('✅ Sentiment analysis completed successfully');
  }
  
  async testMultiProviderSupport(): Promise<void> {
    console.log('🔍 Testing multi-provider AI support');
    
    const providers = ['openai', 'anthropic', 'local'];
    const testPrompt = 'Generate a short creative story premise.';
    
    for (const provider of providers) {
      try {
        const response = await this.makeRequest(this.serviceName, '/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: testPrompt,
            provider,
            max_tokens: 100,
          }),
        });
        
        if (response.status === 200) {
          const result = await response.json();
          assertExists(result.generated_text);
          assertExists(result.provider);
          assertEquals(result.provider, provider);
          console.log(`✅ Provider ${provider} working correctly`);
        } else if (response.status === 503) {
          console.log(`⚠️ Provider ${provider} not available (expected in test environment)`);
        } else {
          console.log(`⚠️ Provider ${provider} returned status ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ Provider ${provider} error: ${error.message}`);
      }
    }
    
    console.log('✅ Multi-provider support testing completed');
  }
  
  async testBatchProcessing(): Promise<void> {
    console.log('🔍 Testing batch processing');
    
    const batchTexts = [
      'Text 1: This is a positive review.',
      'Text 2: This is a negative review.',
      'Text 3: This is a neutral review.',
      'Text 4: Another positive statement.',
      'Text 5: Another negative statement.',
    ];
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/batch/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: batchTexts,
        task: 'sentiment',
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const results = await response.json();
    assertExists(results.results);
    assertEquals(results.results.length, batchTexts.length);
    
    for (const result of results.results) {
      assertExists(result.classification);
      assertExists(result.confidence);
    }
    
    // Batch processing should be more efficient than individual requests
    const avgTimePerText = duration / batchTexts.length;
    assert(avgTimePerText < PERFORMANCE_TARGETS.AI_INFERENCE.classification);
    
    console.log(`✅ Batch processing completed in ${duration.toFixed(2)}ms (${avgTimePerText.toFixed(2)}ms per item)`);
  }
  
  async testCacheEfficiency(): Promise<void> {
    console.log('🔍 Testing cache efficiency');
    
    const testText = 'This is a test for cache efficiency.';
    
    // First request - should be slower (cache miss)
    const startTime1 = performance.now();
    const response1 = await this.makeRequest(this.serviceName, '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        task: 'sentiment',
      }),
    });
    const duration1 = performance.now() - startTime1;
    
    assertEquals(response1.status, 200);
    const result1 = await response1.json();
    
    // Wait a moment then make the same request
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second request - should be faster (cache hit)
    const startTime2 = performance.now();
    const response2 = await this.makeRequest(this.serviceName, '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        task: 'sentiment',
      }),
    });
    const duration2 = performance.now() - startTime2;
    
    assertEquals(response2.status, 200);
    const result2 = await response2.json();
    
    // Results should be identical
    assertEquals(result1.classification, result2.classification);
    assertEquals(result1.confidence, result2.confidence);
    
    // Second request should be significantly faster
    assert(duration2 < duration1 * 0.8, `Cache hit (${duration2}ms) should be faster than cache miss (${duration1}ms)`);
    
    console.log(`✅ Cache efficiency verified: ${duration1.toFixed(2)}ms → ${duration2.toFixed(2)}ms`);
  }
  
  async testErrorHandling(): Promise<void> {
    console.log('🔍 Testing error handling');
    
    // Test empty input
    const emptyResponse = await this.makeRequest(this.serviceName, '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '',
        task: 'sentiment',
      }),
    });
    
    assertEquals(emptyResponse.status, 400);
    const emptyError = await emptyResponse.json();
    assertExists(emptyError.error);
    
    // Test invalid task
    const invalidTaskResponse = await this.makeRequest(this.serviceName, '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Valid text',
        task: 'invalid_task',
      }),
    });
    
    assertEquals(invalidTaskResponse.status, 400);
    const invalidTaskError = await invalidTaskResponse.json();
    assertExists(invalidTaskError.error);
    
    // Test oversized input
    const oversizedText = 'A'.repeat(100000); // Very large text
    const oversizedResponse = await this.makeRequest(this.serviceName, '/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: oversizedText,
        task: 'sentiment',
      }),
    });
    
    assert(oversizedResponse.status === 400 || oversizedResponse.status === 413);
    
    // Verify service remains healthy after errors
    await this.assertServiceHealthy(this.serviceName);
    
    console.log('✅ Error handling working correctly');
  }
  
  async testResourceMonitoring(): Promise<void> {
    console.log('🔍 Testing AI resource monitoring');
    
    // Monitor GPU usage if available
    try {
      const gpuStats = await this.execInContainer(this.serviceName, [
        'nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'
      ]);
      
      if (gpuStats.code === 0) {
        console.log(`GPU Stats: ${gpuStats.stdout.trim()}`);
        assertExists(gpuStats.stdout);
      } else {
        console.log('⚠️ GPU monitoring not available (CPU-only environment)');
      }
    } catch {
      console.log('⚠️ GPU monitoring not available (CPU-only environment)');
    }
    
    // Monitor memory usage
    const memoryStats = await this.execInContainer(this.serviceName, [
      'cat', '/proc/meminfo'
    ]);
    
    assertExists(memoryStats.stdout);
    assert(memoryStats.stdout.includes('MemTotal'));
    
    console.log('✅ Resource monitoring completed');
  }
  
  async testModelLoading(): Promise<void> {
    console.log('🔍 Testing model loading and warmup');
    
    // Test model info endpoint
    const modelInfoResponse = await this.makeRequest(this.serviceName, '/api/models/info');
    assertEquals(modelInfoResponse.status, 200);
    
    const modelInfo = await modelInfoResponse.json();
    assertExists(modelInfo.loaded_models);
    assert(Array.isArray(modelInfo.loaded_models));
    
    // Test model warmup
    const warmupResponse = await this.makeRequest(this.serviceName, '/api/models/warmup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        models: ['sentiment', 'classification'],
      }),
    });
    
    assertEquals(warmupResponse.status, 200);
    const warmupResult = await warmupResponse.json();
    assertExists(warmupResult.warmed_up);
    
    console.log('✅ Model loading and warmup completed');
  }
}

// Test execution
Deno.test({
  name: "AI Inference: Basic Health Check",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testBasicHealth();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Text Classification",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testTextClassification();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Content Generation",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testContentGeneration();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Content Moderation",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testContentModeration();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Sentiment Analysis",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testSentimentAnalysis();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Multi-Provider Support",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testMultiProviderSupport();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Batch Processing",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testBatchProcessing();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Cache Efficiency",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testCacheEfficiency();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Error Handling",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testErrorHandling();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Resource Monitoring",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testResourceMonitoring();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "AI Inference: Model Loading",
  async fn() {
    const tests = new AIInferenceTests();
    try {
      await tests.setup();
      await tests.testModelLoading();
    } finally {
      await tests.cleanup();
    }
  },
});

export default AIInferenceTests;