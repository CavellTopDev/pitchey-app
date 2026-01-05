# Pitchey Container Integration Test Suite

A comprehensive integration test framework for the Pitchey Cloudflare Containers implementation, covering all container services, runtime compatibility, security validation, and performance monitoring.

## 🎯 Test Coverage Overview

### Container Services Tested
- **Video Processor** - Transcoding, thumbnail generation, metadata analysis
- **Document Processor** - PDF generation, OCR, watermarking, NDA processing
- **AI Inference** - Text analysis, content generation, moderation
- **Media Transcoder** - HLS/DASH streaming, multi-bitrate encoding
- **Code Executor** - Sandboxed execution, security validation, deployment simulation

### Integration Points
- **Worker-to-Container** communication and queue processing
- **Database Integration** with Neon PostgreSQL
- **Cache Integration** with Upstash Redis
- **Storage Operations** with Cloudflare R2
- **Container-to-Container** messaging and workflows

### Runtime Support
- **Docker** compatibility and performance testing
- **Podman** compatibility and functionality verification
- **Kubernetes** deployment and scaling validation
- **Local Development** environment testing

## 🏗️ Test Architecture

```
tests/containers/
├── README.md                           # This documentation
├── config/
│   ├── test-config.ts                  # Test configuration management
│   ├── environment-configs/            # Environment-specific settings
│   │   ├── local.config.ts
│   │   ├── ci.config.ts
│   │   └── production.config.ts
│   └── runtime-configs/                # Runtime-specific settings
│       ├── docker.config.ts
│       └── podman.config.ts
├── framework/
│   ├── container-test-base.ts          # Base test framework
│   ├── test-runner.ts                  # Test orchestration
│   ├── mock-factory.ts                 # Mock data generation
│   └── assertions.ts                   # Custom test assertions
├── services/
│   ├── video-processor.test.ts         # Video processing tests
│   ├── document-processor.test.ts      # Document processing tests
│   ├── ai-inference.test.ts           # AI inference tests
│   ├── media-transcoder.test.ts       # Media transcoding tests
│   └── code-executor.test.ts          # Code execution tests
├── integration/
│   ├── e2e-workflows.test.ts          # End-to-end container workflows
│   ├── worker-container.test.ts       # Worker-to-container communication
│   ├── database-integration.test.ts   # Database operations
│   ├── cache-integration.test.ts      # Redis cache operations
│   └── storage-integration.test.ts    # R2 storage operations
├── runtime/
│   ├── docker-compatibility.test.ts   # Docker-specific tests
│   ├── podman-compatibility.test.ts   # Podman-specific tests
│   └── performance-comparison.test.ts # Runtime performance comparison
├── security/
│   ├── container-security.test.ts     # Security scanning and validation
│   ├── sandbox-isolation.test.ts      # Code execution security
│   └── network-security.test.ts       # Network isolation tests
├── performance/
│   ├── load-testing.test.ts           # Load testing with k6
│   ├── resource-monitoring.test.ts    # CPU/Memory monitoring
│   └── benchmark-suite.test.ts        # Performance benchmarks
├── monitoring/
│   ├── health-checks.test.ts          # Health endpoint validation
│   ├── metrics-collection.test.ts     # Prometheus metrics validation
│   └── alerting.test.ts               # Alert triggering tests
├── fixtures/
│   ├── test-media/                    # Sample media files
│   ├── test-documents/                # Sample documents
│   ├── test-code/                     # Sample code snippets
│   └── mock-data/                     # Generated mock data
├── reports/                            # Generated test reports
└── scripts/
    ├── setup-test-environment.sh      # Environment setup
    ├── teardown-environment.sh        # Cleanup scripts
    ├── run-all-tests.sh              # Full test suite runner
    └── ci-test-runner.sh              # CI-specific test runner
```

## 🚀 Quick Start

### Prerequisites

1. **Container Runtime**
   ```bash
   # Docker
   docker --version  # 20.10+
   docker-compose --version  # 2.0+
   
   # OR Podman
   podman --version  # 4.0+
   podman-compose --version  # 1.0+
   ```

2. **Test Dependencies**
   ```bash
   # Deno for test framework
   deno --version  # 1.40+
   
   # k6 for load testing
   k6 --version  # 0.45+
   
   # Node.js for additional tooling
   node --version  # 18+
   npm --version  # 9+
   ```

3. **Services Running**
   ```bash
   # Start container services
   cd containers/
   docker-compose up -d
   
   # Verify all services are healthy
   ./scripts/health-check.sh
   ```

### Running Tests

#### Quick Health Check
```bash
# Basic container health validation
deno test --allow-all tests/containers/monitoring/health-checks.test.ts
```

#### Service-Specific Tests
```bash
# Test individual container services
deno test --allow-all tests/containers/services/video-processor.test.ts
deno test --allow-all tests/containers/services/ai-inference.test.ts

# All service tests
deno test --allow-all tests/containers/services/
```

#### Integration Tests
```bash
# End-to-end workflows
deno test --allow-all tests/containers/integration/e2e-workflows.test.ts

# Worker-container communication
deno test --allow-all tests/containers/integration/worker-container.test.ts

# All integration tests
deno test --allow-all tests/containers/integration/
```

#### Runtime Compatibility
```bash
# Docker compatibility tests
deno test --allow-all tests/containers/runtime/docker-compatibility.test.ts

# Podman compatibility tests  
deno test --allow-all tests/containers/runtime/podman-compatibility.test.ts

# Performance comparison
deno test --allow-all tests/containers/runtime/performance-comparison.test.ts
```

#### Security Tests
```bash
# Container security validation
deno test --allow-all tests/containers/security/

# Sandbox isolation tests
deno test --allow-all tests/containers/security/sandbox-isolation.test.ts
```

#### Performance & Load Testing
```bash
# Performance benchmarks
deno test --allow-all tests/containers/performance/benchmark-suite.test.ts

# Load testing with k6
k6 run tests/containers/performance/load-testing.js

# Resource monitoring
deno test --allow-all tests/containers/performance/resource-monitoring.test.ts
```

#### Complete Test Suite
```bash
# Run all container tests
./tests/containers/scripts/run-all-tests.sh

# CI-optimized test run
./tests/containers/scripts/ci-test-runner.sh
```

## 🧪 Test Scenarios

### Container Service Tests
Each container service is tested for:
- **Basic Functionality** - Core API endpoints and responses
- **Error Handling** - Invalid inputs, timeouts, resource limits
- **Performance** - Response times, throughput, resource usage
- **Security** - Authentication, authorization, input validation
- **Resource Management** - Memory limits, CPU usage, file handling

### Integration Workflows
- **Video Processing Pipeline** - Upload → Process → Thumbnail → Storage
- **Document Generation** - Template → Data → PDF → Watermark
- **AI Content Analysis** - Input → Classification → Sentiment → Output
- **Media Streaming** - Upload → Transcode → HLS/DASH → Delivery
- **Code Execution** - Source → Validation → Sandbox → Result

### Worker-Container Communication
- **Queue Processing** - Job submission, processing, completion
- **Authentication** - JWT validation, API key verification
- **Error Propagation** - Error handling and retry mechanisms
- **Real-time Updates** - WebSocket notifications and status updates

### Runtime Compatibility
- **Docker vs Podman** - Functionality parity and performance comparison
- **Build Process** - Image building and optimization
- **Resource Management** - Memory, CPU, and storage allocation
- **Network Configuration** - Service discovery and inter-container communication

### Security Validation
- **Container Isolation** - Process isolation and resource limits
- **Sandbox Security** - Code execution safety and containment
- **Network Security** - Service communication and external access
- **Input Validation** - File upload safety and content filtering

### Performance Benchmarking
- **Throughput Testing** - Requests per second under load
- **Latency Analysis** - Response time distribution and percentiles
- **Resource Utilization** - CPU, memory, disk, and network usage
- **Scalability Testing** - Horizontal scaling and load distribution

### Monitoring & Alerting
- **Health Endpoint Validation** - Service status and readiness checks
- **Metrics Collection** - Prometheus metrics accuracy and completeness
- **Alert Triggering** - Alert condition validation and notification
- **Dashboard Data** - Grafana dashboard data accuracy

## 📊 Performance Targets

### Response Time Benchmarks
```typescript
// Service response time targets (95th percentile)
const PERFORMANCE_TARGETS = {
  VIDEO_PROCESSOR: {
    thumbnail: 5000,        // 5s for thumbnail generation
    transcode: 60000,       // 1min for video transcoding
    analyze: 3000,          // 3s for metadata analysis
  },
  DOCUMENT_PROCESSOR: {
    pdf_generation: 10000,  // 10s for PDF generation
    ocr_extraction: 15000,  // 15s for OCR processing
    watermark: 2000,        // 2s for watermarking
  },
  AI_INFERENCE: {
    classification: 2000,   // 2s for text classification
    generation: 30000,      // 30s for content generation
    moderation: 1000,       // 1s for content moderation
  },
  MEDIA_TRANSCODER: {
    hls_transcode: 120000,  // 2min for HLS transcoding
    dash_creation: 90000,   // 1.5min for DASH creation
    quality_analysis: 5000, // 5s for quality analysis
  },
  CODE_EXECUTOR: {
    validation: 1000,       // 1s for code validation
    execution: 30000,       // 30s for code execution
    deployment: 60000,      // 1min for deployment simulation
  },
};
```

### Resource Utilization Limits
```typescript
const RESOURCE_LIMITS = {
  CPU_USAGE: 80,           // Max 80% CPU utilization
  MEMORY_USAGE: 85,        // Max 85% memory utilization
  DISK_USAGE: 90,          // Max 90% disk utilization
  NETWORK_LATENCY: 100,    // Max 100ms network latency
  ERROR_RATE: 1,           // Max 1% error rate
  AVAILABILITY: 99.9,      // Min 99.9% uptime
};
```

## 🔧 Configuration Management

### Environment-Specific Configuration
```typescript
// tests/containers/config/environment-configs/local.config.ts
export const localConfig = {
  containers: {
    baseUrl: 'http://localhost',
    timeout: 30000,
    retries: 3,
  },
  services: {
    video: { port: 8081, memory: '2G', cpu: '2.0' },
    document: { port: 8082, memory: '1.5G', cpu: '1.5' },
    ai: { port: 8083, memory: '4G', cpu: '3.0' },
    media: { port: 8084, memory: '3G', cpu: '2.5' },
    code: { port: 8085, memory: '1G', cpu: '1.5' },
  },
  database: {
    url: process.env.TEST_DATABASE_URL,
    poolSize: 5,
  },
  redis: {
    url: process.env.TEST_REDIS_URL,
    ttl: 300,
  },
};
```

### Runtime-Specific Configuration
```typescript
// tests/containers/config/runtime-configs/docker.config.ts
export const dockerConfig = {
  runtime: 'docker',
  compose: {
    file: 'docker-compose.test.yml',
    project: 'pitchey-test',
  },
  commands: {
    up: 'docker-compose up -d',
    down: 'docker-compose down -v',
    logs: 'docker-compose logs',
    ps: 'docker-compose ps',
  },
  healthCheck: {
    interval: 10000,
    timeout: 5000,
    retries: 5,
  },
};
```

## 🛡️ Security Testing

### Container Security Validation
```typescript
// Security test scenarios
const SECURITY_TESTS = {
  CONTAINER_ISOLATION: [
    'Process isolation between containers',
    'File system access restrictions',
    'Network namespace separation',
    'Resource limit enforcement',
  ],
  SANDBOX_SECURITY: [
    'Code execution containment',
    'System call filtering',
    'Resource consumption limits',
    'Network access restrictions',
  ],
  INPUT_VALIDATION: [
    'File upload security',
    'Payload size limits',
    'Content type validation',
    'Malicious content detection',
  ],
  AUTHENTICATION: [
    'JWT token validation',
    'API key verification',
    'Role-based access control',
    'Session management',
  ],
};
```

### Security Scan Integration
```bash
# Container vulnerability scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image pitchey/video-processor:latest

# Runtime security monitoring
docker run --rm --pid=host --privileged \
  falcosecurity/falco:latest
```

## 📈 Load Testing with k6

### Load Test Scenarios
```javascript
// tests/containers/performance/load-testing.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
};

export default function() {
  // Video processing load test
  let videoResponse = http.post('http://localhost:8081/api/process', {
    file: open('../fixtures/test-video.mp4', 'b'),
  });
  
  check(videoResponse, {
    'video processing status is 200': (r) => r.status === 200,
    'video processing time < 30s': (r) => r.timings.duration < 30000,
  });

  sleep(1);
}
```

## 🔍 Monitoring & Observability

### Health Check Validation
```typescript
// Health endpoint testing
const healthChecks = {
  '/health': 'Basic service health',
  '/ready': 'Service readiness',
  '/metrics': 'Prometheus metrics',
  '/info': 'Service information',
};

// Expected health response format
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: boolean;
    redis: boolean;
    storage: boolean;
  };
}
```

### Metrics Validation
```typescript
// Prometheus metrics validation
const expectedMetrics = [
  'http_requests_total',
  'http_request_duration_seconds',
  'container_memory_usage_bytes',
  'container_cpu_usage_seconds',
  'container_network_receive_bytes',
  'container_network_transmit_bytes',
  'custom_processing_duration_seconds',
  'custom_queue_size',
  'custom_error_rate',
];
```

## 🚨 CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/container-tests.yml
name: Container Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  container-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        runtime: [docker, podman]
        
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
          
      - name: Setup Docker
        if: matrix.runtime == 'docker'
        run: |
          docker --version
          docker-compose --version
          
      - name: Setup Podman
        if: matrix.runtime == 'podman'
        run: |
          sudo apt-get update
          sudo apt-get install -y podman podman-compose
          
      - name: Setup k6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver keyserver.ubuntu.com --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
          
      - name: Start Container Services
        run: |
          cd containers/
          ${{ matrix.runtime }}-compose up -d
          sleep 30
          
      - name: Wait for Services
        run: |
          ./tests/containers/scripts/wait-for-services.sh
          
      - name: Run Health Checks
        run: |
          deno test --allow-all tests/containers/monitoring/health-checks.test.ts
          
      - name: Run Service Tests
        run: |
          deno test --allow-all tests/containers/services/
          
      - name: Run Integration Tests
        run: |
          deno test --allow-all tests/containers/integration/
          
      - name: Run Runtime Tests
        run: |
          deno test --allow-all tests/containers/runtime/${{ matrix.runtime }}-compatibility.test.ts
          
      - name: Run Security Tests
        run: |
          deno test --allow-all tests/containers/security/
          
      - name: Run Performance Tests
        run: |
          deno test --allow-all tests/containers/performance/benchmark-suite.test.ts
          
      - name: Run Load Tests
        run: |
          k6 run tests/containers/performance/load-testing.js
          
      - name: Collect Logs
        if: failure()
        run: |
          ${{ matrix.runtime }}-compose logs > container-logs-${{ matrix.runtime }}.txt
          
      - name: Upload Test Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports-${{ matrix.runtime }}
          path: |
            tests/containers/reports/
            container-logs-*.txt
            
      - name: Cleanup
        if: always()
        run: |
          cd containers/
          ${{ matrix.runtime }}-compose down -v
```

## 🧹 Cleanup & Teardown

### Automatic Cleanup
```typescript
// Test teardown with cleanup
afterAll(async () => {
  // Stop test containers
  await execCommand('docker-compose -f docker-compose.test.yml down -v');
  
  // Clean up test data
  await cleanupTestData();
  
  // Reset mock services
  await resetMockServices();
  
  // Clear temporary files
  await clearTempFiles();
});
```

### Manual Cleanup Scripts
```bash
# Complete environment cleanup
./tests/containers/scripts/teardown-environment.sh

# Remove test volumes and networks
docker system prune -f
docker volume prune -f
docker network prune -f
```

## 📞 Support & Troubleshooting

### Common Issues

#### Container Services Not Starting
```bash
# Check container logs
docker-compose logs [service-name]

# Verify resource availability
docker system df
free -h

# Check port conflicts
netstat -tulpn | grep 808[1-5]
```

#### Test Failures Due to Timing
```bash
# Increase timeouts in test configuration
export TEST_TIMEOUT=60000

# Wait for services to be fully ready
./scripts/wait-for-services.sh --timeout 300
```

#### Memory/CPU Resource Issues
```bash
# Monitor resource usage during tests
docker stats

# Adjust container resource limits
docker-compose -f docker-compose.test.yml up -d
```

#### Network Connectivity Issues
```bash
# Check container network
docker network ls
docker network inspect pitchey-test_default

# Test service connectivity
curl -f http://localhost:8081/health
```

### Debug Mode
```bash
# Run tests with verbose debugging
DEBUG=true deno test --allow-all tests/containers/ --verbose

# Enable container debug logging
docker-compose -f docker-compose.test.yml up -d --scale ai-inference=1
```

## 🎯 Success Criteria

### Coverage Requirements
- ✅ **Service Coverage**: All 5 container services tested (100%)
- ✅ **Integration Coverage**: Worker-container, database, cache, storage (100%)
- ✅ **Runtime Coverage**: Docker and Podman compatibility (100%)
- ✅ **Security Coverage**: All security scenarios validated (100%)

### Performance Requirements
- ✅ **Response Time**: All endpoints meet performance targets
- ✅ **Throughput**: Services handle expected load
- ✅ **Resource Usage**: Within defined limits
- ✅ **Scalability**: Horizontal scaling validated

### Quality Gates
- ✅ **Pass Rate**: 98%+ test success rate
- ✅ **Security**: No critical vulnerabilities
- ✅ **Reliability**: No flaky tests
- ✅ **Monitoring**: All metrics collected accurately

Remember: Comprehensive container testing ensures reliable, secure, and performant containerized services! 🐳✨