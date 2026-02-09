> **Note**: This document predates the migration from Deno Deploy to Cloudflare Workers (completed Dec 2024). Deno Deploy references are historical.

# Pitchey Testing Suite & Monitoring Tools

This comprehensive testing suite provides thorough testing and monitoring capabilities for the Pitchey platform, covering investor dashboard functionality, end-to-end workflows, performance monitoring, and automated CI/CD testing.

## 🎯 Overview

The testing suite includes four main components:

1. **Investor Dashboard Test Suite** (`test-investor-dashboard-complete.sh`)
2. **End-to-End Platform Test** (`test-platform-e2e.sh`)
3. **Performance Monitoring Script** (`monitor-platform-performance.sh`)
4. **GitHub Actions CI/CD Workflow** (`.github/workflows/test-deploy.yml`)

## 📋 Test Coverage

### ✅ Investor Dashboard Tests
- **Authentication**: Login/logout for all user types
- **Core Endpoints**: Dashboard, opportunities, portfolio, analytics
- **Investment Workflow**: Create investments, portfolio tracking
- **Data Validation**: Response format and data integrity
- **Performance Metrics**: Response times and throughput
- **Error Handling**: Invalid credentials, network failures

### ✅ End-to-End Platform Tests
- **Multi-Portal Authentication**: Creator, Investor, Production portals
- **Cross-Portal Security**: Access restrictions and role validation
- **Data Consistency**: User profiles, pitch data across endpoints
- **Real-Time Features**: WebSocket connectivity, notifications
- **Search Functionality**: General and user-specific search
- **Error Handling**: 404s, malformed requests, unauthorized access
- **Performance Stress**: Concurrent request handling

### ✅ Performance Monitoring
- **API Response Times**: All critical endpoints
- **WebSocket Latency**: Real-time communication performance
- **Database Query Performance**: Complex query timing
- **System Resources**: Memory, CPU, disk usage monitoring
- **Alert System**: Configurable thresholds and notifications
- **Trend Analysis**: Historical performance data

### ✅ CI/CD Integration
- **Automated Testing**: On every push and PR
- **Security Audits**: Dependency and secret scanning
- **Build Validation**: Frontend and backend compilation
- **Deployment Pipeline**: Staging and production deployment
- **Post-Deployment Monitoring**: Health checks and performance validation

## 🚀 Quick Start

### Prerequisites

```bash
# Install required dependencies
sudo apt-get install jq bc curl

# Ensure demo accounts are available
# - alex.creator@demo.com (password: Demo123)
# - sarah.investor@demo.com (password: Demo123)
# - stellar.production@demo.com (password: Demo123)
```

### Running Tests

#### 1. Investor Dashboard Tests
```bash
# Run comprehensive investor dashboard tests
./test-investor-dashboard-complete.sh

# Set custom API URL
API_URL=https://your-api.com ./test-investor-dashboard-complete.sh
```

#### 2. End-to-End Platform Tests
```bash
# Run full platform end-to-end tests
./test-platform-e2e.sh

# Custom configuration
API_URL=https://your-api.com ./test-platform-e2e.sh
```

#### 3. Performance Monitoring
```bash
# Single performance check
./monitor-platform-performance.sh check

# Continuous monitoring
./monitor-platform-performance.sh monitor

# Quick health check
./monitor-platform-performance.sh health

# Generate performance report
./monitor-platform-performance.sh report
```

## 📊 Reports and Outputs

### Test Reports
Each test suite generates comprehensive reports:

```
test-results/
├── investor-dashboard-YYYYMMDD_HHMMSS/
│   ├── test-output.log          # Detailed test execution log
│   ├── errors.log               # Error details and stack traces
│   ├── performance.json         # Raw performance metrics
│   ├── performance-summary.json # Aggregated performance data
│   └── test-summary.md         # Human-readable summary
└── platform-e2e-YYYYMMDD_HHMMSS/
    ├── e2e-test.log            # E2E test execution log
    ├── e2e-errors.log          # E2E error details
    ├── e2e-performance.json    # E2E performance metrics
    └── e2e-results.json        # CI/CD compatible results
```

### Performance Reports
```
monitoring/
├── logs/
│   ├── performance.log         # Performance monitoring log
│   └── alerts.log              # Alert history
└── reports/
    ├── current-metrics.json    # Latest metrics snapshot
    ├── performance-trends.json # Historical performance data
    └── performance-report-*.html # Interactive HTML reports
```

## 🔧 Configuration

### Environment Variables

#### General Configuration
```bash
export API_URL="http://localhost:8001"          # Base API URL
export ALERT_THRESHOLD="2000"                   # Response time threshold (ms)
export MEMORY_THRESHOLD="512"                   # Memory usage threshold (MB)
export CPU_THRESHOLD="80"                       # CPU usage threshold (%)
```

#### Monitoring Configuration
```bash
export MONITOR_INTERVAL="60"                    # Check interval (seconds)
export WEBHOOK_URL="https://hooks.slack.com..." # Alert webhook
export ALERT_EMAIL="admin@yourcompany.com"      # Alert email
```

#### Demo Credentials (Customizable)
```bash
export CREATOR_EMAIL="alex.creator@demo.com"
export CREATOR_PASSWORD="Demo123"
export INVESTOR_EMAIL="sarah.investor@demo.com"
export INVESTOR_PASSWORD="Demo123"
export PRODUCTION_EMAIL="stellar.production@demo.com"
export PRODUCTION_PASSWORD="Demo123"
```

## 🔄 GitHub Actions Workflow

The CI/CD pipeline automatically runs on:
- **Push to main branch**: Full test suite + production deployment
- **Push to develop branch**: Full test suite + staging deployment
- **Pull requests**: Test suite only
- **Scheduled runs**: Daily at 2 AM UTC
- **Manual triggers**: With environment selection

### Workflow Stages

1. **Setup**: Environment determination and variable setting
2. **Lint & Type Check**: Code quality validation
3. **Unit Tests**: Backend and frontend unit tests with coverage
4. **Integration Tests**: Full platform integration testing
5. **Security Tests**: Dependency audits and secret scanning
6. **Build**: Frontend compilation and artifact creation
7. **Deploy Staging**: Staging environment deployment (if applicable)
8. **Deploy Production**: Production deployment (main branch only)
9. **Post-Deployment Monitoring**: Extended monitoring after deployment

### Required Secrets

```yaml
# Deno Deploy
DENO_DEPLOY_TOKEN_STAGING
DENO_DEPLOY_TOKEN_PRODUCTION

# Cloudflare
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID

# Notifications
DEPLOYMENT_WEBHOOK_URL
FAILURE_WEBHOOK_URL
SLACK_WEBHOOK_URL
```

## 📈 Performance Benchmarks

### Response Time Targets
- **Authentication**: < 500ms
- **Dashboard Endpoints**: < 1000ms
- **Search Operations**: < 1500ms
- **Investment Operations**: < 2000ms

### System Resource Limits
- **Memory Usage**: < 512MB (default threshold)
- **CPU Usage**: < 80% (default threshold)
- **Disk Usage**: < 85%

### Availability Targets
- **Uptime**: > 99.9%
- **API Success Rate**: > 99%
- **WebSocket Connectivity**: > 95%

## 🚨 Alerting

### Alert Types
1. **Performance Degradation**: Response times exceed thresholds
2. **System Resources**: High memory/CPU usage
3. **Service Unavailability**: Failed health checks
4. **Authentication Failures**: Login system issues

### Alert Channels
- **Console Output**: Immediate feedback during test runs
- **Log Files**: Persistent alert history
- **Webhooks**: Slack/Teams integration
- **Email**: Critical alert notifications
- **GitHub Actions**: CI/CD pipeline notifications

## 🔍 Troubleshooting

### Common Issues

#### 1. Authentication Failures
```bash
# Check demo accounts exist and passwords are correct
curl -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}'
```

#### 2. Server Not Responding
```bash
# Check server status
curl http://localhost:8001/health

# Check server logs
tail -f server.log
```

#### 3. Permission Issues
```bash
# Make scripts executable
chmod +x test-investor-dashboard-complete.sh
chmod +x test-platform-e2e.sh
chmod +x monitor-platform-performance.sh
```

#### 4. Missing Dependencies
```bash
# Install required tools
sudo apt-get update
sudo apt-get install jq bc curl

# For monitoring features
sudo apt-get install bc mailutils  # For calculations and email alerts
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Enable debug output
set -x

# Run tests with maximum verbosity
API_URL=http://localhost:8001 ./test-investor-dashboard-complete.sh 2>&1 | tee debug.log
```

## 📝 Test Development

### Adding New Tests

#### 1. Investor Dashboard Tests
Add new test functions to `test-investor-dashboard-complete.sh`:

```bash
test_new_feature() {
    local token="$1"
    
    log_info "Testing new feature..."
    
    local response
    if response=$(make_request "GET" "/api/investor/new-feature" "$token" "" "New-Feature-Test"); then
        if echo "$response" | jq -e '.success and .data' >/dev/null 2>&1; then
            log_success "New feature test passed"
        else
            log_error "Invalid new feature response: $response"
        fi
    else
        log_error "New feature test failed"
    fi
}
```

#### 2. End-to-End Tests
Add test categories to `test-platform-e2e.sh`:

```bash
test_new_workflow() {
    log_category "New Workflow Tests"
    
    # Implementation here
}
```

#### 3. Performance Metrics
Add new metrics to `monitor-platform-performance.sh`:

```bash
measure_new_metric() {
    # Custom performance measurement
    local metric_value=$(your_measurement_logic)
    echo "$metric_value"
}
```

## 📚 Additional Resources

- **API Documentation**: Check `CLAUDE.md` for API endpoint details
- **Deployment Guide**: See `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- **Architecture Notes**: Review `DEPLOYMENT_ARCHITECTURE.md`
- **Client Requirements**: Reference `CLIENT_FEEDBACK_REQUIREMENTS.md`

## 🤝 Contributing

When contributing to the testing suite:

1. **Follow Existing Patterns**: Use the established logging and error handling patterns
2. **Add Performance Tracking**: Include timing metrics for new tests
3. **Update Documentation**: Document new tests and configuration options
4. **Test Idempotency**: Ensure tests can be run repeatedly without side effects
5. **Error Handling**: Implement comprehensive error handling and cleanup

## 📞 Support

For issues with the testing suite:

1. **Check Logs**: Review test output and error logs
2. **Verify Configuration**: Ensure environment variables are set correctly
3. **Test Dependencies**: Confirm all required tools are installed
4. **Server Status**: Verify the Pitchey backend is running and accessible

---

**Last Updated**: November 2024  
**Version**: 1.0.0  
**Maintained By**: Pitchey Development Team