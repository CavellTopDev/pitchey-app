# Local Development Test Suite

This directory contains tests specifically designed to validate the Podman local development environment for Pitchey.

## Test Categories

### 1. Service Availability Tests
- **Podman Services**: PostgreSQL, Redis, MinIO, Adminer
- **Backend Proxy**: Port 8001 service health
- **Network Connectivity**: Service-to-service communication

### 2. Authentication Tests
- **Portal Login Flows**: Creator, Investor, Production Company
- **Session Management**: Cookie-based authentication 
- **Demo Account Validation**: All three demo users

### 3. Access Control Tests
- **Portal Isolation**: Verify users can't access wrong portals
- **RBAC Validation**: Role-based access control
- **Endpoint Authorization**: Protected route testing

### 4. API Integration Tests
- **Pitch Management**: CRUD operations
- **NDA Workflows**: Upload, signing, management
- **Investment Tracking**: Interest recording, portfolio
- **File Operations**: Document upload/download

### 5. WebSocket Tests
- **Real-time Notifications**: Message delivery
- **Connection Management**: Connect/disconnect handling
- **Presence Tracking**: Online/offline status

### 6. Storage Tests
- **MinIO Integration**: File upload/download to S3-compatible storage
- **Cache Operations**: Redis read/write performance
- **Data Persistence**: Database transaction validation

### 7. Performance Tests
- **Response Time**: API endpoint latency
- **Throughput**: Concurrent request handling
- **Resource Usage**: Memory and CPU monitoring

### 8. Security Tests
- **Input Validation**: SQL injection prevention
- **Authentication Bypass**: Unauthorized access attempts
- **Data Exposure**: Sensitive information protection

## Running Tests

### Prerequisites
```bash
# Start Podman services
./podman-local.sh start

# Start development server
PORT=8001 deno run --allow-all working-server.ts
```

### Execute Test Suites
```bash
# All local development tests
deno run --allow-all tests/local-dev/run-all-tests.ts

# Service availability only
deno run --allow-all tests/local-dev/service-availability.test.ts

# Authentication flows
deno run --allow-all tests/local-dev/auth-validation.test.ts

# Performance benchmarks
deno run --allow-all tests/local-dev/performance.test.ts

# Security validation
deno run --allow-all tests/local-dev/security.test.ts
```

### Bash Scripts for API Testing
```bash
# Quick API health checks
./tests/local-dev/scripts/api-health-check.sh

# Full authentication flow test
./tests/local-dev/scripts/auth-flow-test.sh

# File upload validation
./tests/local-dev/scripts/file-upload-test.sh
```

## Test Configuration

Tests are configured to work with the standard Podman local development setup:
- **Backend**: http://localhost:8001
- **PostgreSQL**: localhost:5432 
- **Redis**: localhost:6380
- **MinIO**: localhost:9000 (API), localhost:9001 (Console)
- **Adminer**: localhost:8080

## Demo Credentials

All tests use the standard demo accounts:
- **Creator**: alex.creator@demo.com / Demo123
- **Investor**: sarah.investor@demo.com / Demo123  
- **Production**: stellar.production@demo.com / Demo123

## Expected Results

A fully functional local development environment should:
- ✅ All services accessible and responding
- ✅ All three demo users can authenticate
- ✅ Portal access control enforced
- ✅ API endpoints return expected responses
- ✅ WebSocket connections establish successfully
- ✅ File uploads work with MinIO
- ✅ Redis caching operations succeed
- ✅ Performance metrics within acceptable ranges
- ✅ Security validations pass

## Troubleshooting

If tests fail, check:
1. **Services Running**: `./podman-local.sh status`
2. **Port Conflicts**: `ss -tulpn | grep 8001`
3. **Service Logs**: `./podman-local.sh logs`
4. **Network Connectivity**: Test service URLs directly