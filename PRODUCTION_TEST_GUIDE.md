# Pitchey Production Test Suite Guide

## Overview

This comprehensive test suite verifies that the Pitchey production deployment is working correctly across all critical workflows. The tests are designed to catch deployment issues, API failures, authentication problems, and specifically verify the recently fixed NDA request functionality.

## Production URLs Being Tested

- **Frontend**: https://pitchey-frontend.deno.dev
- **Backend**: https://pitchey-backend.deno.dev

## Demo Accounts (All use password: `Demo123`)

- **Creator**: alex.creator@demo.com
- **Investor**: sarah.investor@demo.com  
- **Production**: stellar.production@demo.com

## Test Scripts Available

### 1. Master Test Runner
```bash
./run-all-production-tests.sh [options]
```

**Options:**
- `--quick` - Run only essential tests (faster execution)
- `--nda-only` - Run only NDA workflow tests
- `--no-color` - Disable colored output

**What it does:**
- Runs comprehensive pre-flight checks
- Executes all test suites in sequence
- Provides detailed summary and recommendations
- Returns appropriate exit codes for CI/CD integration

### 2. Complete Production Test Suite (Node.js)
```bash
node production-test-suite.js
```

**Requirements:** Node.js with `node-fetch` package

**Features:**
- Object-oriented test architecture
- Detailed JSON response analysis
- Advanced error categorization
- Comprehensive reporting

### 3. cURL-Based Test Suite
```bash
./production-test-curl.sh
```

**Requirements:** curl, python3 (for JSON parsing)

**Features:**
- Shell-based testing (works anywhere)
- Detailed HTTP response analysis
- Works in any Unix environment
- No external dependencies beyond curl

### 4. NDA Workflow Specialist Tests
```bash
./test-nda-workflow-production.sh
```

**Purpose:** Deep testing of the recently fixed NDA request functionality

**Features:**
- Step-by-step NDA workflow verification
- Tests both investor and production company perspectives
- Validates request creation, listing, and status checking
- Error condition testing

## What Gets Tested

### 🔐 Authentication Workflows
- ✅ Login for all three portals (creator, investor, production)
- ✅ Token generation and validation
- ✅ Profile access verification
- ✅ Session management
- ✅ Error handling for invalid credentials

### 🎬 Pitch Workflows
- ✅ Public pitch listing and viewing
- ✅ Individual pitch detail pages
- ✅ Frontend pitch page rendering
- ✅ **NDA request submission (RECENTLY FIXED)**
- ✅ NDA status checking
- ✅ NDA request listing (incoming/outgoing)
- ✅ Creator pitch management
- ✅ Investor pitch browsing
- ✅ Production company pitch viewing

### 📊 Dashboard Access
- ✅ Creator dashboard API and frontend
- ✅ Investor dashboard and portfolio
- ✅ Production dashboard and projects
- ✅ Analytics endpoints
- ✅ Dashboard navigation

### 🔌 API Endpoints
- ✅ Core CRUD operations
- ✅ Authentication endpoints
- ✅ Error handling (404, 401, 400, 500)
- ✅ Rate limiting detection
- ✅ Input validation
- ✅ JSON response structure

### 🌐 System Integration
- ✅ Frontend-backend connectivity
- ✅ CORS configuration
- ✅ Health checks (if available)
- ✅ WebSocket endpoint availability
- ✅ SSL/TLS verification

## Running the Tests

### Quick Start
```bash
# Run all tests (comprehensive)
./run-all-production-tests.sh

# Run only essential tests (faster)
./run-all-production-tests.sh --quick

# Test only the NDA workflow (recently fixed)
./run-all-production-tests.sh --nda-only
```

### Individual Test Execution
```bash
# Run cURL-based tests only
./production-test-curl.sh

# Run NDA-specific tests only
./test-nda-workflow-production.sh

# Run Node.js tests only (if Node.js available)
node production-test-suite.js
```

## Expected Results

### ✅ All Tests Pass
- Production deployment is fully functional
- All user workflows work correctly
- NDA request fix has been verified
- Ready for user traffic

### ⚠️ Some Tests Fail
- Core functionality may still work
- Specific features may have issues
- Review failed tests for impact assessment
- Consider fixes based on criticality

### ❌ Many Tests Fail  
- Significant deployment issues
- Immediate investigation required
- May need redeployment or configuration fixes
- Not ready for production use

## Understanding Test Output

### Test Status Indicators
- `✓ PASS` - Test succeeded
- `✗ FAIL` - Test failed
- `⚠️ WARN` - Non-critical issue detected

### HTTP Status Code Meanings
- `200` - Success
- `201` - Created successfully  
- `400` - Bad request (often expected for validation tests)
- `401` - Unauthorized (expected when testing auth)
- `404` - Not found (may be acceptable for some endpoints)
- `500` - Server error (indicates real problems)

### Key Areas to Watch

#### NDA Request Flow (Recently Fixed)
The NDA request functionality was recently fixed. Tests specifically verify:
- POST `/api/ndas/request` - Creating new NDA requests
- GET `/api/ndas/request` - Listing requests (incoming/outgoing)
- GET `/api/pitches/:id/nda` - Checking NDA status
- Error handling for invalid requests

#### Authentication Flow
All three portals must authenticate successfully:
- Creator login → Token → Dashboard access
- Investor login → Token → Browse pitches  
- Production login → Token → Review projects

#### API Connectivity
Core endpoints must be accessible:
- Public pitch listing works without auth
- Protected endpoints require valid tokens
- Error responses are properly formatted

## Troubleshooting Common Issues

### Authentication Failures
```
✗ FAIL Creator login - HTTP 401
```
**Possible causes:**
- Demo account credentials changed
- Authentication service down
- Database connectivity issues

### NDA Request Failures
```
✗ FAIL NDA request submission - HTTP 500
```
**Possible causes:**
- Database schema issues
- Missing required fields in request
- Authentication middleware problems

### Frontend Connectivity Issues
```
✗ FAIL Frontend accessibility - HTTP 500
```
**Possible causes:**
- Deno Deploy service issues
- DNS resolution problems
- SSL certificate problems

### API Endpoint Failures
```  
✗ FAIL Dashboard API - HTTP 404
```
**Possible causes:**
- Routing configuration errors
- Missing endpoint implementations
- Server deployment issues

## Integration with CI/CD

The test scripts return appropriate exit codes:
- `0` - All tests passed
- `1` - Some tests failed

Use in GitHub Actions:
```yaml
- name: Test Production Deployment
  run: ./run-all-production-tests.sh --quick
```

Use in deployment verification:
```bash
if ./run-all-production-tests.sh --quick; then
    echo "Deployment verified successfully"
    # Continue with traffic routing
else
    echo "Deployment verification failed"  
    # Rollback or investigate
    exit 1
fi
```

## Customizing Tests

### Adding New Test Cases
1. Edit the appropriate test script
2. Add new test functions following the existing pattern
3. Update test counters and reporting
4. Test the new tests locally

### Modifying Demo Accounts
Update the account credentials in all scripts:
```bash
CREATOR_EMAIL="your.creator@example.com"
CREATOR_PASSWORD="YourPassword"
```

### Testing Different Environments
Change the URLs at the top of each script:
```bash
BACKEND_URL="https://your-backend.example.com"
FRONTEND_URL="https://your-frontend.example.com"
```

## Security Considerations

- Demo accounts are used with well-known passwords
- Tests only perform read operations and safe writes
- No production data is modified destructively
- All requests use HTTPS in production
- Tokens are not logged or stored

## Performance Impact

- Tests create minimal load (sequential requests)
- No stress testing or load generation
- Safe to run against production systems
- Typical execution time: 30-120 seconds

## Maintenance

### Regular Tasks
- Verify demo accounts are still active
- Update test cases when new features are added
- Monitor for changes in API responses
- Update documentation when workflows change

### When to Run
- After every deployment
- Before major releases  
- When investigating production issues
- As part of monitoring/health checks
- Before announcing new features

---

## Summary

This test suite provides comprehensive verification that your Pitchey production deployment is working correctly. The tests are designed to catch real-world issues that users would encounter, with special attention to the recently fixed NDA request workflow.

Run `./run-all-production-tests.sh` to get started!