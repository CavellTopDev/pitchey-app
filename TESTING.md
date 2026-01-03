# 🧪 Pitchey Platform Testing

This document describes the comprehensive testing infrastructure for the Pitchey platform.

## 🚀 Automated CI/CD Pipeline

The platform includes a fully automated CI/CD pipeline that runs:

- **Security scans** on every commit
- **Frontend builds and tests** for React application
- **Worker builds and validation** for Cloudflare Worker
- **Database schema validation** 
- **Integration tests** across all portal routes
- **Performance monitoring** with daily health checks
- **Automated deployments** to staging and production

### Pipeline Configuration

The CI/CD pipeline is configured in `.github/workflows/ci-cd.yml` and runs:

1. **On Push**: Security scans, builds, tests
2. **On Pull Request**: Full validation before merge
3. **On Main Branch**: Automatic production deployment
4. **Daily Schedule**: Health monitoring and performance checks

## 🔧 Local Testing

### Run All Tests

```bash
# Run comprehensive test suite
npm run test:all

# Or directly
./scripts/run-all-tests.sh
```

### Individual Test Categories

```bash
# API tests
npm run test:api

# Frontend tests
cd frontend && npm run test

# Integration tests
npm run test:integration

# Performance tests
npm run perf:test
```

## 📊 Test Categories

### 1. 🏗️ Infrastructure Tests
- API health endpoints
- Frontend availability
- Database connectivity

### 2. 🔐 Authentication Tests
- Demo account authentication
- Portal-specific login flows
- Security header validation

### 3. 🎬 Core API Tests
- Pitch listing and search
- Category management
- Trending algorithms

### 4. 🔧 Schema Adapter Tests
- Database schema alignment
- Follow system functionality
- View tracking integration

### 5. 🔒 Security Tests
- Security header presence
- Authentication protection
- Input validation

### 6. ⚡ Performance Tests
- API response times
- Frontend bundle size
- Cache hit rates

### 7. 🔗 Integration Tests
- End-to-end portal workflows
- Cross-service communication
- Real user scenarios

### 8. 🎨 Frontend Tests
- Build process validation
- Type checking
- Linting compliance

## 📈 Test Results

Test results are automatically stored in timestamped directories:
```
test_results_YYYYMMDD_HHMMSS/
├── test_summary.txt
├── api-health.log
├── auth-creator.log
├── frontend-build.log
└── ...
```

## 🎯 Success Criteria

- **90%+ Success Rate**: Excellent platform health
- **70-89% Success Rate**: Good with minor issues
- **<70% Success Rate**: Requires immediate attention

## 🔄 Continuous Monitoring

The platform includes automated daily health monitoring:
- API endpoint availability
- Frontend performance metrics
- Security header compliance
- Authentication flow validation

## 🚨 Incident Response

When tests fail:
1. Check test logs in results directory
2. Review Cloudflare Worker logs
3. Validate database connectivity
4. Check recent deployments
5. Monitor platform metrics

## 📝 Adding New Tests

1. Add test scripts to `scripts/` directory
2. Update `scripts/run-all-tests.sh` with new test
3. Add CI/CD pipeline steps if needed
4. Document test purpose and expected outcomes

## 🎛️ Environment Configuration

Tests run against production by default but can be configured:

```bash
# Test against staging
API_URL=https://pitchey-api-staging.ndlovucavelle.workers.dev ./scripts/run-all-tests.sh

# Test against local development
API_URL=http://localhost:8001 ./scripts/run-all-tests.sh
```

## 🔗 Related Documentation

- **API Documentation**: `docs/api/`
- **Deployment Guide**: `docs/deployment/`
- **Architecture Overview**: `docs/architecture/`
- **Security Guide**: `docs/security/`