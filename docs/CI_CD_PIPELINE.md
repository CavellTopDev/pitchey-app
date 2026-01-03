# 🚀 CI/CD Pipeline Documentation

## Overview

The Pitchey platform uses a comprehensive CI/CD pipeline powered by GitHub Actions to ensure reliable deployments and maintain code quality across the entire stack.

## Pipeline Architecture

### 🏗️ Multi-Stage Pipeline
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Change   │ -> │   Quality Gate  │ -> │   Deployment    │
│                 │    │                 │    │                 │
│ • Push/PR       │    │ • Security Scan │    │ • Staging       │
│ • Branch: main  │    │ • Tests         │    │ • Production    │
│ • Branch: dev   │    │ • Build         │    │ • Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Workflow Stages

### 1. 🔒 Security & Quality Checks
- **Security Scanning**: Automated vulnerability detection
- **Secret Detection**: Scans for hardcoded credentials
- **Code Quality**: ESLint, TypeScript compilation

### 2. 🧪 Testing Pipeline
- **Frontend Tests**: 
  - Unit tests with Vitest
  - E2E tests with Playwright
  - TypeScript compilation
  - Bundle optimization validation
- **Worker Tests**:
  - TypeScript compilation
  - Syntax validation
  - API health checks
- **Database Tests**:
  - Schema validation
  - Migration verification

### 3. 🏗️ Build & Deploy
- **Staging Deployment** (develop/staging branches):
  - Automatic deployment to staging environment
  - Integration testing in isolated environment
- **Production Deployment** (main branch):
  - Full quality gate validation required
  - Cloudflare Workers + Pages deployment
  - Post-deployment health checks

### 4. 📊 Monitoring & Verification
- **Health Monitoring**: Daily automated health checks
- **Performance Testing**: Response time validation
- **Security Monitoring**: Header validation and endpoint protection
- **Integration Tests**: Cross-service functionality verification

## Branch Strategy

| Branch | Purpose | Auto-Deploy | Quality Gate |
|--------|---------|-------------|--------------|
| `main` | Production releases | ✅ Production | Full pipeline |
| `staging` | Pre-production testing | ✅ Staging | Security + Tests |
| `develop` | Development integration | ✅ Staging | Security + Tests |
| Feature branches | Development work | ❌ | Tests on PR |

## Environment Configuration

### Production
- **API**: `https://pitchey-api-prod.ndlovucavelle.workers.dev`
- **Frontend**: `https://pitchey.pages.dev`
- **Database**: Neon PostgreSQL (production)
- **Cache**: Upstash Redis (production)

### Staging
- **API**: `https://pitchey-api-staging.ndlovucavelle.workers.dev`
- **Frontend**: `https://pitchey-staging.pages.dev`
- **Database**: Neon PostgreSQL (staging branch)

## Required GitHub Secrets

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `CLOUDFLARE_API_TOKEN` | Worker & Pages deployment | Production/Staging |
| `VITE_SENTRY_DSN` | Frontend error tracking | Production monitoring |

## Test Coverage

### 🎨 Frontend Tests (Vitest + Playwright)
- **Unit Tests**: Component logic, utilities, services
- **Integration Tests**: API integration, routing
- **E2E Tests**: Full user workflows across portals
- **Visual Tests**: Component rendering, responsive design

### ⚡ Backend Tests (Comprehensive Suite)
- **API Tests**: Endpoint functionality, authentication
- **Schema Tests**: Database schema validation
- **Performance Tests**: Response time monitoring
- **Security Tests**: Authentication, authorization

### 📊 Current Test Metrics
- **Total Test Files**: 6+ test suites
- **Coverage Areas**: Authentication, Core APIs, Schema Adapter, Security
- **Success Rate Target**: 90%+

## Deployment Process

### Automatic Deployments
1. **Code pushed to main** → Production deployment
2. **Code pushed to develop/staging** → Staging deployment
3. **PR created** → Test validation only

### Manual Deployment Override
```bash
# Emergency production deployment
wrangler deploy --env production

# Frontend-only deployment
cd frontend && npm run deploy:pages
```

## Monitoring & Alerting

### 🏥 Daily Health Checks
- **Scheduled**: Every day at 2:00 AM UTC
- **Coverage**: API health, frontend availability, key endpoints
- **Alerting**: GitHub Actions notifications

### 📈 Performance Monitoring
- **API Response Times**: < 2 seconds target
- **Frontend Load Times**: < 3 seconds target
- **Uptime Monitoring**: 99.9% target

### 🔒 Security Monitoring
- **Security Headers**: Automated validation
- **Authentication**: Demo account testing
- **Endpoint Protection**: Unauthorized access detection

## Troubleshooting

### Common Issues

#### ❌ Build Failures
```bash
# Check frontend build locally
cd frontend && npm run build

# Check TypeScript errors
npm run type-check
```

#### ❌ Deployment Failures
```bash
# Validate Wrangler configuration
wrangler config list

# Check deployment status
wrangler deployment list
```

#### ❌ Test Failures
```bash
# Run tests locally
./scripts/run-all-tests.sh

# Check specific test results
./scripts/validate-ci-cd-setup.sh
```

### Pipeline Recovery
1. **Check GitHub Actions logs** for detailed error information
2. **Run validation script**: `./scripts/validate-ci-cd-setup.sh`
3. **Test locally** before re-pushing
4. **Contact team** if infrastructure issues persist

## Performance Optimizations

### 🚀 Build Optimizations
- **Frontend**: Bundle splitting, code optimization
- **Worker**: TypeScript compilation, tree shaking
- **Caching**: NPM dependencies, build artifacts

### ⚡ Test Optimizations
- **Parallel Execution**: Multiple test suites run concurrently
- **Smart Caching**: Dependencies cached across runs
- **Conditional Testing**: Database tests skip on scheduled runs

## Future Enhancements

### 🔮 Planned Improvements
- **Feature Flag Integration**: Canary deployments
- **Advanced Monitoring**: APM integration
- **Mobile Testing**: Device-specific E2E tests
- **Performance Budgets**: Automated performance regression detection

### 🛠️ Infrastructure Scaling
- **Multi-Region**: Global deployment strategy
- **Blue-Green Deployments**: Zero-downtime releases
- **Automated Rollbacks**: Failure detection and recovery

---

## Quick Reference

### 📋 Pipeline Status Commands
```bash
# Validate pipeline setup
./scripts/validate-ci-cd-setup.sh

# Run all tests locally
./scripts/run-all-tests.sh

# Check deployment status
wrangler deployment list

# Monitor health
curl -f https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
```

### 🚨 Emergency Procedures
1. **Production Issue**: Check GitHub Actions, deploy hotfix to main
2. **Pipeline Failure**: Run local validation, fix issues, re-push
3. **Service Outage**: Check Cloudflare status, fallback to manual deployment

---

*Last Updated: January 3, 2026*  
*Pipeline Version: v1.0*  
*Maintained by: Development Team*