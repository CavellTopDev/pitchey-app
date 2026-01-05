/**
 * K6 Load Testing Suite for Container Services
 * 
 * Comprehensive load testing scenarios for all container services
 * to validate performance under realistic load conditions
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTime = new Trend('response_time');
export const throughput = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 30 },   // Ramp up to 30 users
    { duration: '3m', target: 30 },   // Stay at 30 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    // Error rate should be less than 5%
    errors: ['rate < 0.05'],
    
    // Response time thresholds
    http_req_duration: [
      'p(95) < 5000',   // 95% of requests should complete within 5s
      'p(99) < 10000',  // 99% of requests should complete within 10s
    ],
    
    // Throughput threshold
    http_reqs: ['rate > 10'], // Should handle at least 10 requests per second
  ],
};

// Base URLs for services
const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const SERVICES = {
  video: `${BASE_URL}:8081`,
  document: `${BASE_URL}:8082`,
  ai: `${BASE_URL}:8083`,
  media: `${BASE_URL}:8084`,
  code: `${BASE_URL}:8085`,
};

// Test data
const TEST_FILES = {
  video: {
    small: new Uint8Array(1024 * 100),      // 100KB
    medium: new Uint8Array(1024 * 1024 * 5), // 5MB
  },
  document: {
    pdf: new Uint8Array(1024 * 50),          // 50KB
    template: JSON.stringify({
      title: 'Test Document',
      content: 'This is a test document for load testing purposes.',
    }),
  },
  code: {
    python: 'print("Hello from load test!")\nresult = sum(range(100))\nprint(f"Result: {result}")',
    javascript: 'console.log("Hello from load test!"); const result = Array.from({length: 100}, (_, i) => i).reduce((a, b) => a + b, 0); console.log(`Result: ${result}`);',
  },
  ai: {
    texts: [
      'This is a positive review about the amazing product quality.',
      'Unfortunately, this product did not meet my expectations.',
      'The service was okay, nothing special but acceptable.',
      'Outstanding customer service and fast delivery!',
      'Poor quality materials and terrible customer support.',
    ],
  },
};

// Utility function to make requests with error handling
function makeRequest(url, method = 'GET', payload = null, headers = {}) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: '30s',
  };

  let response;
  const start = new Date().getTime();

  try {
    if (method === 'GET') {
      response = http.get(url, params);
    } else if (method === 'POST') {
      response = http.post(url, payload, params);
    } else if (method === 'PUT') {
      response = http.put(url, payload, params);
    } else if (method === 'DELETE') {
      response = http.del(url, params);
    }

    const duration = new Date().getTime() - start;
    responseTime.add(duration);
    throughput.add(1);

    const isError = response.status >= 400;
    errorRate.add(isError);

    return response;
  } catch (error) {
    errorRate.add(true);
    console.error(`Request failed: ${error}`);
    return null;
  }
}

// Video processor load tests
export function testVideoProcessor() {
  group('Video Processor Load Tests', () => {
    // Health check
    const healthResponse = makeRequest(`${SERVICES.video}/health`);
    check(healthResponse, {
      'video service is healthy': (r) => r && r.status === 200,
    });

    // Thumbnail generation load test
    const formData = {
      file: http.file(TEST_FILES.video.small, 'test-video.mp4', 'video/mp4'),
    };

    const thumbnailResponse = makeRequest(
      `${SERVICES.video}/api/thumbnail`,
      'POST',
      formData,
      { 'Content-Type': 'multipart/form-data' }
    );

    check(thumbnailResponse, {
      'thumbnail generation succeeds': (r) => r && r.status === 200,
      'thumbnail response has url': (r) => r && r.json() && r.json().thumbnail_url,
    });

    // Metadata analysis load test
    const metadataResponse = makeRequest(
      `${SERVICES.video}/api/analyze`,
      'POST',
      formData,
      { 'Content-Type': 'multipart/form-data' }
    );

    check(metadataResponse, {
      'metadata analysis succeeds': (r) => r && r.status === 200,
      'metadata has duration': (r) => r && r.json() && r.json().duration,
    });
  });
}

// Document processor load tests
export function testDocumentProcessor() {
  group('Document Processor Load Tests', () => {
    // Health check
    const healthResponse = makeRequest(`${SERVICES.document}/health`);
    check(healthResponse, {
      'document service is healthy': (r) => r && r.status === 200,
    });

    // PDF generation load test
    const pdfPayload = JSON.stringify({
      template: 'nda',
      data: {
        company: 'Test Company',
        date: new Date().toISOString(),
        parties: ['Party 1', 'Party 2'],
      },
    });

    const pdfResponse = makeRequest(
      `${SERVICES.document}/api/generate-pdf`,
      'POST',
      pdfPayload
    );

    check(pdfResponse, {
      'pdf generation succeeds': (r) => r && r.status === 200,
      'pdf response has url': (r) => r && r.json() && r.json().pdf_url,
    });

    // OCR load test
    const formData = {
      file: http.file(TEST_FILES.document.pdf, 'test-document.pdf', 'application/pdf'),
    };

    const ocrResponse = makeRequest(
      `${SERVICES.document}/api/extract-text`,
      'POST',
      formData,
      { 'Content-Type': 'multipart/form-data' }
    );

    check(ocrResponse, {
      'ocr extraction succeeds': (r) => r && [200, 202].includes(r.status),
    });
  });
}

// AI inference load tests
export function testAIInference() {
  group('AI Inference Load Tests', () => {
    // Health check
    const healthResponse = makeRequest(`${SERVICES.ai}/health`);
    check(healthResponse, {
      'ai service is healthy': (r) => r && r.status === 200,
    });

    // Text classification load test
    const randomText = TEST_FILES.ai.texts[Math.floor(Math.random() * TEST_FILES.ai.texts.length)];
    const classificationPayload = JSON.stringify({
      text: randomText,
      task: 'sentiment',
    });

    const classificationResponse = makeRequest(
      `${SERVICES.ai}/api/classify`,
      'POST',
      classificationPayload
    );

    check(classificationResponse, {
      'classification succeeds': (r) => r && r.status === 200,
      'classification has result': (r) => r && r.json() && r.json().classification,
    });

    // Content generation load test
    const generationPayload = JSON.stringify({
      prompt: 'Write a brief movie pitch about adventure.',
      max_tokens: 100,
    });

    const generationResponse = makeRequest(
      `${SERVICES.ai}/api/generate`,
      'POST',
      generationPayload
    );

    check(generationResponse, {
      'content generation succeeds': (r) => r && r.status === 200,
      'generation has text': (r) => r && r.json() && r.json().generated_text,
    });

    // Batch processing load test
    const batchPayload = JSON.stringify({
      texts: TEST_FILES.ai.texts.slice(0, 3),
      task: 'sentiment',
    });

    const batchResponse = makeRequest(
      `${SERVICES.ai}/api/batch/classify`,
      'POST',
      batchPayload
    );

    check(batchResponse, {
      'batch processing succeeds': (r) => r && r.status === 200,
      'batch has results': (r) => r && r.json() && Array.isArray(r.json().results),
    });
  });
}

// Media transcoder load tests
export function testMediaTranscoder() {
  group('Media Transcoder Load Tests', () => {
    // Health check
    const healthResponse = makeRequest(`${SERVICES.media}/health`);
    check(healthResponse, {
      'media service is healthy': (r) => r && r.status === 200,
    });

    // HLS transcoding load test
    const formData = {
      file: http.file(TEST_FILES.video.medium, 'test-video.mp4', 'video/mp4'),
      options: JSON.stringify({
        format: 'hls',
        quality: 'medium',
      }),
    };

    const hlsResponse = makeRequest(
      `${SERVICES.media}/api/hls-transcode`,
      'POST',
      formData,
      { 'Content-Type': 'multipart/form-data' }
    );

    check(hlsResponse, {
      'hls transcoding accepts request': (r) => r && [200, 202].includes(r.status),
    });

    // If transcoding was accepted, check status
    if (hlsResponse && hlsResponse.json() && hlsResponse.json().job_id) {
      const statusResponse = makeRequest(
        `${SERVICES.media}/api/job/${hlsResponse.json().job_id}/status`
      );

      check(statusResponse, {
        'transcoding status available': (r) => r && r.status === 200,
        'status has job info': (r) => r && r.json() && r.json().status,
      });
    }
  });
}

// Code executor load tests
export function testCodeExecutor() {
  group('Code Executor Load Tests', () => {
    // Health check
    const healthResponse = makeRequest(`${SERVICES.code}/health`);
    check(healthResponse, {
      'code service is healthy': (r) => r && r.status === 200,
    });

    // Python execution load test
    const pythonPayload = JSON.stringify({
      code: TEST_FILES.code.python,
      language: 'python',
      timeout: 10000,
    });

    const pythonResponse = makeRequest(
      `${SERVICES.code}/api/execute`,
      'POST',
      pythonPayload
    );

    check(pythonResponse, {
      'python execution succeeds': (r) => r && r.status === 200,
      'python has output': (r) => r && r.json() && r.json().stdout,
    });

    // JavaScript execution load test
    const jsPayload = JSON.stringify({
      code: TEST_FILES.code.javascript,
      language: 'javascript',
      timeout: 10000,
    });

    const jsResponse = makeRequest(
      `${SERVICES.code}/api/execute`,
      'POST',
      jsPayload
    );

    check(jsResponse, {
      'javascript execution succeeds': (r) => r && r.status === 200,
      'javascript has output': (r) => r && r.json() && r.json().stdout,
    });

    // Code validation load test
    const validationPayload = JSON.stringify({
      code: TEST_FILES.code.python,
      language: 'python',
    });

    const validationResponse = makeRequest(
      `${SERVICES.code}/api/validate`,
      'POST',
      validationPayload
    );

    check(validationResponse, {
      'code validation succeeds': (r) => r && r.status === 200,
      'validation has result': (r) => r && r.json() && typeof r.json().valid === 'boolean',
    });
  });
}

// Mixed workload simulation
export function testMixedWorkload() {
  group('Mixed Workload Simulation', () => {
    const services = ['video', 'document', 'ai', 'media', 'code'];
    const randomService = services[Math.floor(Math.random() * services.length)];

    switch (randomService) {
      case 'video':
        testVideoProcessor();
        break;
      case 'document':
        testDocumentProcessor();
        break;
      case 'ai':
        testAIInference();
        break;
      case 'media':
        testMediaTranscoder();
        break;
      case 'code':
        testCodeExecutor();
        break;
    }
  });
}

// Main test function
export default function() {
  // Distribute load across different test types
  const testType = Math.random();

  if (testType < 0.3) {
    // 30% - Video processing tests
    testVideoProcessor();
  } else if (testType < 0.5) {
    // 20% - AI inference tests (most CPU intensive)
    testAIInference();
  } else if (testType < 0.7) {
    // 20% - Code execution tests
    testCodeExecutor();
  } else if (testType < 0.85) {
    // 15% - Document processing tests
    testDocumentProcessor();
  } else if (testType < 0.95) {
    // 10% - Media transcoding tests
    testMediaTranscoder();
  } else {
    // 5% - Mixed workload
    testMixedWorkload();
  }

  // Random sleep between 1-3 seconds to simulate user think time
  sleep(Math.random() * 2 + 1);
}

// Setup function (runs once at the beginning)
export function setup() {
  console.log('🚀 Starting container load testing...');
  console.log(`Testing against services at ${BASE_URL}`);
  
  // Verify all services are accessible
  const serviceChecks = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = http.get(`${url}/health`, { timeout: '10s' });
      serviceChecks[name] = response.status === 200;
      if (response.status === 200) {
        console.log(`✅ ${name} service is available`);
      } else {
        console.log(`❌ ${name} service is not available (status: ${response.status})`);
      }
    } catch (error) {
      serviceChecks[name] = false;
      console.log(`❌ ${name} service is not accessible: ${error}`);
    }
  }
  
  return serviceChecks;
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('📊 Load testing completed');
  console.log('Service availability during test:', data);
  
  // Generate summary
  const availableServices = Object.values(data).filter(Boolean).length;
  const totalServices = Object.keys(data).length;
  
  console.log(`📈 Services available: ${availableServices}/${totalServices}`);
  
  if (availableServices < totalServices) {
    console.log('⚠️  Some services were not available during testing');
  } else {
    console.log('✅ All services remained available throughout the test');
  }
}