# Pitchey Performance Testing Framework

A comprehensive performance testing framework designed specifically for the Pitchey platform's Cloudflare Workers + Neon PostgreSQL architecture.

## 🚀 Overview

This framework provides end-to-end performance testing for:
- **API Load Testing** - K6-based tests for Cloudflare Worker endpoints
- **WebSocket Performance** - Real-time messaging and presence testing
- **Database Stress Testing** - Neon PostgreSQL connection and query performance
- **Core Web Vitals** - Lighthouse-based frontend performance monitoring
- **Automated CI/CD Integration** - GitHub Actions workflow for continuous monitoring

## 📁 Framework Structure

```
performance/
├── k6/                          # K6 load testing scripts
│   ├── api-load-test.js         # API endpoint load testing
│   ├── websocket-load-test.js   # WebSocket performance testing
│   ├── database-stress-test.js  # Database connection stress testing
│   └── test-data/               # Test data files
├── lighthouse/                  # Core Web Vitals testing
│   ├── core-web-vitals.js       # Lighthouse performance analysis
│   └── package.json             # Dependencies
├── analysis/                    # Performance analysis tools
│   └── performance-analyzer.js  # Report generation and analysis
├── scripts/                     # Utility scripts
│   └── run-all-tests.sh         # Comprehensive test runner
└── reports/                     # Generated reports (created at runtime)
```

## 🛠 Prerequisites

### Required Tools
- **K6 v0.47.0+** - Load testing tool
- **Node.js v18+** - For Lighthouse and analysis scripts
- **Bash** - For running shell scripts

### Installation

1. **Install K6**:
```bash
# On macOS
brew install k6

# On Ubuntu/Debian
sudo apt install k6

# Or download from https://k6.io/docs/get-started/installation/
```

2. **Install Node.js dependencies**:
```bash
cd performance/lighthouse
npm install
```

3. **Verify installation**:
```bash
k6 version
node --version
```

## 🎯 Test Types

### 1. API Load Testing (`k6/api-load-test.js`)

Tests Cloudflare Worker API endpoints with progressive load patterns:
- **Warmup**: 10 users for 5 minutes
- **Normal Load**: 50 users for 15 minutes  
- **Spike Test**: Sudden increase to 200 users
- **Stress Test**: Progressive ramp to 400 users
- **Soak Test**: 30 users for 30 minutes

**Key Metrics**:
- Response time percentiles (p95, p99)
- Error rates by scenario
- Cache hit rates
- Database query timing

### 2. WebSocket Performance (`k6/websocket-load-test.js`)

Tests real-time features via Cloudflare Durable Objects:
- Connection stress testing
- Message latency measurement
- Presence/typing indicators
- Notification broadcasting
- Long-running connection stability

**Key Metrics**:
- Connection establishment time
- Message round-trip latency
- Connection error rates
- Concurrent connection limits

### 3. Database Stress Testing (`k6/database-stress-test.js`)

Tests Neon PostgreSQL performance:
- Connection pool stress testing
- Complex query performance
- Transaction concurrency
- Deadlock detection
- Connection timeout handling

**Key Metrics**:
- Query execution times
- Connection pool utilization
- Transaction latency
- Database error rates

### 4. Core Web Vitals (`lighthouse/core-web-vitals.js`)

Frontend performance analysis:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Performance budgets
- Mobile vs desktop analysis

**Key Metrics**:
- Lighthouse scores
- Core Web Vitals compliance
- Resource budget analysis
- Network performance simulation

## 🚀 Usage

### Quick Start

1. **Run comprehensive test suite**:
```bash
cd performance
./scripts/run-all-tests.sh
```

2. **Run specific test types**:
```bash
# API load testing only
k6 run k6/api-load-test.js

# WebSocket testing only  
k6 run k6/websocket-load-test.js

# Core Web Vitals only
cd lighthouse && node core-web-vitals.js
```

### Environment Configuration

Set environment variables to customize testing:

```bash
# Test intensity (light, medium, heavy)
export INTENSITY=medium

# Target URLs
export API_URL=https://pitchey-production.cavelltheleaddev.workers.dev
export WS_URL=wss://pitchey-production.cavelltheleaddev.workers.dev/ws
export FRONTEND_URL=https://pitchey.pages.dev

# Run tests
./scripts/run-all-tests.sh
```

### Test Intensity Levels

| Intensity | VUs  | Duration | Throttling | Use Case |
|-----------|------|----------|------------|----------|
| **light** | 10   | 2m       | none       | Development/PR testing |
| **medium**| 50   | 5m       | fast3g     | Staging validation |
| **heavy** | 100  | 10m      | slow3g     | Production monitoring |

## 📊 Performance Thresholds

### API Performance
- **Response Time**: p95 < 800ms (normal), p95 < 1500ms (spike)
- **Error Rate**: < 1% (normal), < 5% (spike)
- **Cache Hit Rate**: > 70%

### WebSocket Performance  
- **Connection Time**: p95 < 1000ms
- **Message Latency**: p95 < 500ms
- **Error Rate**: < 5%

### Database Performance
- **Query Time**: p95 < 500ms
- **Connection Errors**: < 2%
- **Slow Queries**: < 5%

### Core Web Vitals
- **LCP**: < 2.5s (good), < 4s (needs improvement)
- **FID**: < 100ms (good), < 300ms (needs improvement)  
- **CLS**: < 0.1 (good), < 0.25 (needs improvement)

## 📈 Reports and Analysis

### Generated Reports

After test execution, reports are generated in `performance/reports/`:

- **HTML Dashboard**: `performance-dashboard-*.html`
- **K6 Results**: `k6-summary-*.json`
- **Lighthouse Results**: `performance-results-*.json`
- **WebSocket Results**: `ws-summary-*.json`
- **Database Results**: `db-stress-*.json`
- **Analysis Report**: `performance-analysis-*.json`

### Performance Analysis

The `performance-analyzer.js` tool provides:
- **Trend Analysis**: Performance over time
- **Regression Detection**: Automatic alerts for performance degradation
- **Recommendations**: Actionable optimization suggestions
- **Comparative Analysis**: Before/after comparisons

### Dashboard Features

The HTML dashboard includes:
- **Overall Performance Score**: Weighted average across all test types
- **Status Indicators**: Good/Warning/Critical status for each area
- **Trend Visualization**: Performance trends over time
- **Detailed Metrics**: Breakdown by test type and scenario
- **Recommendations**: Prioritized optimization suggestions

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The framework includes a comprehensive GitHub Actions workflow (`.github/workflows/performance-testing.yml`) that:

- **Triggers**:
  - Push to main/develop branches
  - Pull requests to main
  - Daily scheduled runs (2 AM UTC)
  - Manual dispatch with configuration options

- **Test Matrix**:
  - Runs different test suites based on changes
  - Adjusts intensity based on trigger type
  - Supports production and staging environments

- **Regression Detection**:
  - Compares results against baseline
  - Fails builds on significant performance degradation
  - Updates baseline automatically on main branch

- **Reporting**:
  - Posts PR comments with performance summary
  - Generates downloadable artifacts
  - Sends alerts for critical issues

### Performance Budgets

The CI/CD pipeline enforces performance budgets:
- **Fail Threshold**: Overall score < 70
- **Warning Threshold**: > 20% performance regression
- **Error Rate Limit**: > 5% error rate fails the build

## 🔧 Configuration

### Test Data

Test data is stored in `k6/test-data/`:
- `users.json`: Demo user credentials for authenticated testing
- `pitches.json`: Sample pitch data for content testing

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | Production API |
| `WS_URL` | WebSocket URL | Production WebSocket |
| `FRONTEND_URL` | Frontend URL | Production frontend |
| `INTENSITY` | Test intensity | medium |
| `K6_VUS` | K6 virtual users | 50 |
| `K6_DURATION` | Test duration | 5m |

### Customization

To customize tests for your environment:

1. **Update test data** in `k6/test-data/`
2. **Modify thresholds** in individual test files
3. **Adjust scenarios** in `k6/api-load-test.js`
4. **Configure budgets** in `lighthouse/core-web-vitals.js`

## 🐛 Troubleshooting

### Common Issues

1. **K6 Installation Issues**:
```bash
# Verify K6 is in PATH
which k6

# Check version compatibility  
k6 version
```

2. **Authentication Failures**:
```bash
# Verify demo accounts are available
curl -X POST https://api.pitchey.com/auth/creator/login \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

3. **WebSocket Connection Issues**:
```bash
# Test WebSocket connectivity
wscat -c wss://pitchey-production.cavelltheleaddev.workers.dev/ws
```

4. **Lighthouse Timeout**:
```bash
# Increase timeout in core-web-vitals.js
export LIGHTHOUSE_TIMEOUT=60000
```

### Debug Mode

Enable debug logging:
```bash
export DEBUG=true
export K6_LOG_LEVEL=debug
./scripts/run-all-tests.sh
```

## 📚 Best Practices

### Test Design
- **Realistic Load Patterns**: Mirror actual user behavior
- **Progressive Loading**: Start with warmup, gradually increase load
- **Comprehensive Coverage**: Test all critical user journeys
- **Resource Constraints**: Test within infrastructure limits

### Performance Monitoring
- **Baseline Establishment**: Set realistic performance baselines
- **Regular Monitoring**: Schedule daily/weekly performance checks
- **Trend Analysis**: Monitor performance trends over time
- **Alert Thresholds**: Set up meaningful alert thresholds

### CI/CD Integration
- **Fast Feedback**: Use light tests for PR validation
- **Comprehensive Testing**: Full suite for main branch
- **Performance Gates**: Fail builds on critical regressions
- **Automatic Baselines**: Update baselines automatically

## 🔗 Resources

### Documentation
- [K6 Documentation](https://k6.io/docs/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Core Web Vitals](https://web.dev/vitals/)
- [Cloudflare Workers Performance](https://developers.cloudflare.com/workers/platform/performance/)

### Monitoring Integration
- **Grafana**: Import K6 results for dashboards
- **DataDog**: Custom metrics integration
- **New Relic**: Performance monitoring
- **Sentry**: Error tracking integration

## 🤝 Contributing

To contribute improvements:

1. **Test your changes** with all intensity levels
2. **Update documentation** for new features
3. **Add test cases** for new scenarios
4. **Maintain backward compatibility** with existing reports

## 📄 License

This performance testing framework is part of the Pitchey platform and follows the same licensing terms.

---

**Need Help?** Check the troubleshooting section or review the execution logs in `performance/reports/test-execution.log`.