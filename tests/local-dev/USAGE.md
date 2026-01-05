# Pitchey Local Development Test Suite - Usage Guide

This comprehensive test suite validates the entire Podman local development environment for Pitchey.

## Quick Start

### 1. Prerequisites
Ensure your local development environment is running:

```bash
# Start Podman services
./podman-local.sh start

# Start development backend server (in separate terminal)
PORT=8001 deno run --allow-all working-server.ts
```

### 2. Run All Tests
Execute the complete test suite:

```bash
# Run comprehensive tests (recommended)
./tests/local-dev/scripts/run-comprehensive-tests.sh
```

## Individual Test Execution

### Bash Scripts (Fast API Tests)

```bash
# Quick API health check
./tests/local-dev/scripts/api-health-check.sh

# Authentication flow validation  
./tests/local-dev/scripts/auth-flow-test.sh

# File upload functionality test
./tests/local-dev/scripts/file-upload-test.sh
```

### Deno Integration Tests (Comprehensive)

```bash
# Run all integration test suites
deno run --allow-all tests/local-dev/run-all-tests.ts

# Run individual test suites
deno run --allow-all tests/local-dev/service-availability.test.ts
deno run --allow-all tests/local-dev/auth-validation.test.ts
deno run --allow-all tests/local-dev/access-control.test.ts
deno run --allow-all tests/local-dev/api-integration.test.ts
deno run --allow-all tests/local-dev/websocket-connectivity.test.ts
deno run --allow-all tests/local-dev/storage-validation.test.ts
deno run --allow-all tests/local-dev/performance.test.ts
deno run --allow-all tests/local-dev/security.test.ts
```

## Test Coverage

### ✅ Service Availability Tests
- **Backend Proxy**: Port 8001 health and proxy functionality
- **PostgreSQL**: Database connection and query execution
- **Redis**: Cache connectivity and operations
- **MinIO**: S3-compatible storage API and console
- **Adminer**: Database management interface
- **Network**: Service-to-service connectivity and latency

### ✅ Authentication Tests  
- **Creator Portal**: Complete login/logout flow
- **Investor Portal**: Session management and validation
- **Production Portal**: Authentication and dashboard access
- **Session Persistence**: Cookie-based session handling
- **Concurrent Sessions**: Multiple user login support
- **Invalid Credentials**: Security validation

### ✅ Access Control Tests
- **Portal Isolation**: Users cannot access wrong portals
- **RBAC Validation**: Role-based access control enforcement
- **Protected Endpoints**: Authorization requirement verification
- **Cross-User Data**: Prevention of data access between users
- **Unauthenticated Access**: Proper blocking of unauthorized requests

### ✅ API Integration Tests
- **Pitch CRUD**: Create, read, update, delete operations
- **NDA Workflow**: Upload, signing, and management
- **Investment Tracking**: Interest recording and portfolio
- **File Upload**: Document upload to MinIO storage
- **Search Functionality**: Query and filtering capabilities

### ✅ WebSocket Tests
- **Connection Establishment**: Real-time connection setup
- **Message Handling**: Send/receive functionality
- **Authentication**: Session-based WebSocket auth
- **Concurrent Connections**: Multiple simultaneous connections
- **Connection Management**: Proper connect/disconnect handling

### ✅ Storage Tests
- **MinIO Operations**: Bucket operations and file handling
- **File Upload API**: Application-level file upload
- **Redis Caching**: Cache read/write operations
- **Data Persistence**: Database transaction validation
- **Storage Capacity**: Various file sizes and limits

### ✅ Performance Tests  
- **API Response Times**: Endpoint latency validation
- **Concurrent Load**: Multiple simultaneous requests
- **Database Queries**: Query performance measurement
- **Memory Usage**: Memory consumption monitoring
- **Throughput**: Requests per second capability

### ✅ Security Tests
- **SQL Injection**: Prevention of SQL injection attacks
- **XSS Protection**: Cross-site scripting prevention  
- **Auth Bypass**: Authentication bypass prevention
- **Data Exposure**: Sensitive information protection
- **Input Validation**: Malicious input handling

## Expected Results

A fully functional local development environment should show:

- ✅ **100% service availability** - All Podman services responding
- ✅ **100% authentication success** - All three demo users can login
- ✅ **100% access control** - Portal isolation properly enforced
- ✅ **95%+ API functionality** - Core endpoints working correctly
- ✅ **WebSocket connectivity** - Real-time features operational
- ✅ **File upload capability** - MinIO integration working
- ✅ **Cache operations** - Redis caching functional
- ✅ **Response times < 1000ms** - Good performance metrics
- ✅ **No security vulnerabilities** - All security tests pass

## Interpreting Results

### ✅ Success (Green)
- **100% Pass Rate**: Environment fully functional, ready for development
- **95-99% Pass Rate**: Mostly functional, minor issues may exist

### ⚠️ Warning (Yellow)  
- **80-94% Pass Rate**: Significant issues, some features impaired
- **Action Required**: Review failed tests, check service logs

### ❌ Failure (Red)
- **< 80% Pass Rate**: Major issues, environment not ready
- **Urgent Action**: Restart services, check configuration, review logs

## Troubleshooting

### Common Issues

1. **Backend Server Not Running**
   ```bash
   # Check if running
   curl http://localhost:8001/health
   
   # Start if needed
   PORT=8001 deno run --allow-all working-server.ts
   ```

2. **Podman Services Down**
   ```bash
   # Check status
   ./podman-local.sh status
   
   # Restart services
   ./podman-local.sh stop && ./podman-local.sh start
   ```

3. **Authentication Failures**
   ```bash
   # Re-seed demo users
   ./podman-local.sh seed
   
   # Check database connectivity
   PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local -c "SELECT * FROM users LIMIT 5;"
   ```

4. **Port Conflicts**
   ```bash
   # Check what's using required ports
   ss -tulpn | grep -E "8001|5432|6380|9000|9001|8080"
   
   # Kill conflicting processes if necessary
   sudo pkill -f "port 8001"
   ```

5. **File Upload Issues**
   ```bash
   # Check MinIO health
   curl http://localhost:9000/minio/health/live
   
   # Verify MinIO console access
   curl http://localhost:9001
   ```

### Getting Help

If tests continue to fail:

1. **Check Service Logs**:
   ```bash
   ./podman-local.sh logs postgres
   ./podman-local.sh logs redis  
   ./podman-local.sh logs minio
   ```

2. **Review Test Reports**: 
   - Check `tests/local-dev/reports/` for detailed test reports
   - Look for specific error messages and stack traces

3. **Verify Configuration**:
   - Ensure all environment variables are set correctly
   - Check that demo user credentials match expectations
   - Verify network connectivity between services

4. **Reset Environment**:
   ```bash
   # Nuclear option - reset everything
   ./podman-local.sh reset
   ./podman-local.sh start
   ./podman-local.sh seed
   ```

## Test Reports

Detailed test reports are automatically generated:
- **Location**: `tests/local-dev/reports/`
- **Format**: JSON and text summaries
- **Contents**: Test results, timing, error details, performance metrics

Reports include:
- ✅ Pass/fail status for each test
- ⏱️ Execution timing and performance data  
- 🔍 Detailed error information for failures
- 📊 Overall environment health assessment

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions integration
- name: Run Local Development Tests
  run: |
    ./podman-local.sh start
    PORT=8001 deno run --allow-all working-server.ts &
    sleep 10
    ./tests/local-dev/scripts/run-comprehensive-tests.sh
```

## Development Workflow

Recommended testing workflow:

1. **Before Starting Development**:
   ```bash
   ./tests/local-dev/scripts/api-health-check.sh
   ```

2. **After Making Changes**:
   ```bash
   ./tests/local-dev/scripts/auth-flow-test.sh
   ```

3. **Before Committing**:
   ```bash
   ./tests/local-dev/scripts/run-comprehensive-tests.sh
   ```

4. **Weekly Environment Validation**:
   ```bash
   # Full test suite with performance analysis
   deno run --allow-all tests/local-dev/run-all-tests.ts
   ```

This test suite ensures your local development environment remains stable, secure, and fully functional throughout the development process.