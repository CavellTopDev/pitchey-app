# Creator Workflow Test Suite

A comprehensive test automation framework for validating the complete creator journey on the Pitchey platform, from registration to pitch success.

## 🎯 Coverage Target: 98%+

## 📋 Test Categories

### 🔄 End-to-End Tests
Complete user journeys testing the full creator workflow:
- **Creator Registration & Profile Setup** - Account creation, email verification, profile completion
- **Complete Pitch Creation** - All required fields, validation, character management
- **Document Upload System** - File validation, size limits, type checking, storage
- **NDA Workflow Integration** - Request handling, approval process, access control
- **Analytics Tracking** - Event generation, data collection, reporting
- **Dashboard Functionality** - Data aggregation, real-time updates, performance

### ⚡ Performance Tests
System performance under realistic conditions:
- **Pitch Creation Performance** - Response time benchmarks (< 5 seconds)
- **Dashboard Load Performance** - Page load optimization (< 3 seconds)
- **Concurrent User Simulation** - Multi-user load testing
- **Large File Upload Performance** - Upload handling and progress tracking
- **Database Query Optimization** - Response time monitoring

### 🔍 Edge Case Tests
Boundary conditions and error scenarios:
- **Invalid Input Handling** - Malformed data, injection attempts
- **Boundary Value Testing** - File size limits, character limits, field validation
- **Network Failure Simulation** - Connection drops, timeout handling
- **Race Condition Testing** - Concurrent operations, data consistency
- **Unicode and Special Characters** - International content support

### 🛡️ Security Tests
Authentication, authorization, and data protection:
- **Access Control Validation** - Role-based permissions, cross-user access prevention
- **Token Security** - JWT validation, expiration handling
- **Input Sanitization** - XSS prevention, SQL injection protection
- **Rate Limiting** - API abuse prevention
- **File Upload Security** - Malicious file detection, type validation

## 🚀 Quick Start

### Prerequisites
1. **Backend Server Running**
   ```bash
   cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
   PORT=8001 deno run --allow-all working-server.ts
   ```

2. **Database Connected** - Ensure Neon database is accessible and seeded

3. **Demo Accounts Available** - Test accounts must be present:
   - Creator: `alex.creator@demo.com` (password: `Demo123`)
   - Investor: `sarah.investor@demo.com` (password: `Demo123`)
   - Production: `stellar.production@demo.com` (password: `Demo123`)

### Running Tests

#### Quick Test Run (Essential Tests Only)
```bash
deno run --allow-all run-creator-tests.ts --quick
```

#### Full Test Suite
```bash
deno run --allow-all run-creator-tests.ts --verbose
```

#### Specific Test Categories
```bash
# E2E tests only
deno run --allow-all run-creator-tests.ts --e2e

# Performance tests only  
deno run --allow-all run-creator-tests.ts --performance

# Edge case tests only
deno run --allow-all run-creator-tests.ts --edge-cases
```

#### Custom Configuration
```bash
# Extended timeout with retries disabled
deno run --allow-all run-creator-tests.ts --timeout 120000 --no-retries

# Debug mode (no cleanup)
deno run --allow-all run-creator-tests.ts --no-cleanup --verbose
```

### Using Deno Test Runner
```bash
# Run specific test file
deno test --allow-all tests/workflows/creator-complete.test.ts

# Run all tests with coverage
deno test --allow-all --coverage=coverage tests/

# Generate coverage report
deno coverage coverage --html
```

## 📁 File Structure

```
tests/
├── README.md                          # This documentation
├── setup.ts                          # Test configuration and utilities
├── workflows/
│   └── creator-complete.test.ts       # Main creator workflow tests
├── utilities/
│   ├── test-data-factory.ts          # Test data generation
│   ├── mock-services.ts              # Mock external services
│   └── test-runner.ts                # Test orchestration
├── reports/                           # Generated test reports
└── [existing test files...]          # Other test suites

run-creator-tests.ts                   # CLI test runner script
```

## 🧪 Test Data Management

### Test Data Factory
The `TestDataFactory` class provides realistic test data for all entities:

```typescript
import { TestDataFactory } from "./tests/utilities/test-data-factory.ts";

// Generate test users
const creator = TestDataFactory.creator({ variation: "complete" });
const investor = TestDataFactory.investor({ variation: "edge-case" });

// Generate test pitches
const pitch = TestDataFactory.pitch(creatorId, { variation: "complete" });

// Generate test characters
const character = TestDataFactory.character(pitchId, { variation: "complete" });

// Generate test files
const validPdf = TestDataFactory.testFiles.validPdf;
const oversizedFile = TestDataFactory.testFiles.oversizedFile;

// Generate related data sets
const relatedData = TestDataFactory.buildRelatedData(3, 2, 3);
```

### Data Variations
- **minimal** - Basic required fields only
- **complete** - All fields populated with realistic data  
- **edge-case** - Boundary values, special characters, unicode

## 🎭 Mock Services

Mock implementations for external dependencies:

```typescript
import { MockServiceFactory } from "./tests/utilities/mock-services.ts";

// Email service mock
const emailService = MockServiceFactory.getEmailService({ enableLogs: true });
await emailService.sendEmail({ to: "test@example.com", subject: "Test" });
console.log(emailService.getSentEmails());

// Storage service mock
const storageService = MockServiceFactory.getStorageService();
const result = await storageService.uploadFile(fileData, "test.pdf");

// Payment service mock
const paymentService = MockServiceFactory.getPaymentService();
const intent = await paymentService.createPaymentIntent({ amount: 1000, currency: "USD" });

// WebSocket service mock
const wsService = MockServiceFactory.getWebSocketService();
const connection = wsService.createConnection(userId);
```

## 📊 Test Reporting

### Automated Reports
Tests generate comprehensive HTML reports with:
- ✅ Pass/fail status for each test
- ⏱️ Performance metrics and timing
- 📈 Coverage analysis
- 🐛 Detailed error information
- 📋 Test execution metadata

### Report Location
```
tests/reports/creator-workflow-[timestamp].html
```

### Console Output
Real-time test execution with:
- Test progress indicators
- Performance benchmarks
- Error details
- Summary statistics

## 🔧 API Endpoints Tested

### Authentication Endpoints
- `POST /api/auth/creator/register` - Creator registration
- `POST /api/auth/creator/login` - Creator authentication
- `POST /api/auth/creator/verify-email` - Email verification
- `POST /api/auth/logout` - Session termination

### Creator Profile Endpoints
- `GET /api/creator/profile` - Profile retrieval
- `PUT /api/creator/profile` - Profile updates
- `POST /api/creator/avatar` - Avatar upload

### Pitch Management Endpoints
- `POST /api/pitches` - Pitch creation
- `GET /api/pitches/:id` - Pitch retrieval
- `PUT /api/pitches/:id` - Pitch updates
- `DELETE /api/pitches/:id` - Pitch deletion
- `GET /api/creator/pitches` - Creator's pitches

### Character Management Endpoints
- `POST /api/pitches/:id/characters` - Character creation
- `GET /api/pitches/:id/characters` - Character listing
- `PUT /api/pitches/:id/characters/:charId` - Character updates
- `DELETE /api/pitches/:id/characters/:charId` - Character deletion

### Document Upload Endpoints
- `POST /api/upload/document` - Document upload
- `POST /api/upload/media` - Media upload
- `DELETE /api/upload/:fileId` - File deletion
- `GET /api/pitches/:id/documents` - Document listing

### NDA Workflow Endpoints
- `POST /api/pitches/:id/nda-settings` - NDA configuration
- `GET /api/creator/nda-requests` - NDA request listing
- `POST /api/ndas/:id/approve` - NDA approval
- `POST /api/ndas/:id/deny` - NDA denial

### Analytics Endpoints
- `GET /api/pitches/:id/analytics` - Pitch analytics
- `POST /api/analytics/events` - Event tracking
- `GET /api/creator/dashboard` - Dashboard data

### Info Request Endpoints
- `GET /api/creator/info-requests` - Info request listing
- `POST /api/info-requests/:id/respond` - Info request response

## 🎯 Test Scenarios Covered

### ✅ Happy Path Scenarios
1. **Complete Creator Journey**
   - Registration → Verification → Profile → Pitch → Characters → Upload → NDA → Analytics
   
2. **Pitch Creation Workflow**
   - All required fields → Character addition → Document upload → Publication

3. **NDA Approval Process**
   - Settings configuration → Request receipt → Approval → Access granted

### ⚠️ Error Scenarios
1. **Validation Failures**
   - Missing required fields
   - Invalid data formats
   - Character/file size limits

2. **Authentication Errors**
   - Invalid credentials
   - Expired tokens
   - Unauthorized access

3. **File Upload Errors**
   - Oversized files (>50MB)
   - Invalid file types
   - Storage failures

4. **Network Issues**
   - Connection timeouts
   - Server errors (500)
   - Rate limiting (429)

### 🔍 Edge Cases
1. **Unicode Content**
   - Special characters in names
   - International content
   - Emoji in descriptions

2. **Boundary Values**
   - Maximum field lengths
   - File size limits
   - Character count limits

3. **Concurrent Operations**
   - Multiple users editing
   - Simultaneous uploads
   - Race conditions

## 🛠️ Troubleshooting

### Common Issues

#### Backend Not Running
```
❌ Backend server health check failed
```
**Solution**: Start backend server on port 8001
```bash
PORT=8001 deno run --allow-all working-server.ts
```

#### Database Connection Failed
```
❌ Database connection failed
```
**Solution**: Check DATABASE_URL environment variable and network connectivity

#### Demo Accounts Missing
```
⚠️ Demo account login failed
```
**Solution**: Run database seed script to create demo accounts
```bash
deno run --allow-all src/db/seed.ts
```

#### Permission Errors
```
❌ Permission denied
```
**Solution**: Run with proper permissions
```bash
deno run --allow-all run-creator-tests.ts
```

### Debug Mode
For detailed debugging, run with verbose output and no cleanup:
```bash
deno run --allow-all run-creator-tests.ts --verbose --no-cleanup
```

### Test Isolation Issues
If tests interfere with each other, run individual test files:
```bash
deno test --allow-all tests/workflows/creator-complete.test.ts
```

## 🔄 Continuous Integration

### GitHub Actions Integration
```yaml
name: Creator Workflow Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - name: Start backend
        run: PORT=8001 deno run --allow-all working-server.ts &
      - name: Wait for server
        run: sleep 10
      - name: Run tests
        run: deno run --allow-all run-creator-tests.ts --quick
```

### Local Development Workflow
1. Start backend server
2. Run quick tests during development
3. Run full suite before commits
4. Check coverage reports
5. Fix failing tests before push

## 📈 Performance Benchmarks

### Target Performance Metrics
- **Pitch Creation**: < 5 seconds
- **Dashboard Load**: < 3 seconds  
- **File Upload**: < 10 seconds for 10MB
- **Character Addition**: < 2 seconds
- **NDA Processing**: < 1 second

### Load Testing Thresholds
- **Concurrent Users**: 10+ simultaneous
- **Request Volume**: 100+ requests/minute
- **Memory Usage**: < 512MB peak
- **CPU Usage**: < 80% sustained

## 🎉 Success Criteria

### Coverage Requirements
- **Test Coverage**: 98%+ code coverage
- **API Coverage**: All creator endpoints tested
- **Scenario Coverage**: Happy path + error cases + edge cases

### Quality Gates
- **Pass Rate**: 95%+ test success rate
- **Performance**: All benchmarks met
- **Security**: No security vulnerabilities
- **Reliability**: No flaky tests

### Acceptance Criteria
- ✅ All critical creator workflows functional
- ✅ Error handling comprehensive
- ✅ Performance targets achieved
- ✅ Security controls validated
- ✅ Documentation complete

## 🤝 Contributing

### Adding New Tests
1. Follow existing test patterns in `creator-complete.test.ts`
2. Use TestDataFactory for consistent test data
3. Include both happy path and error scenarios
4. Add performance benchmarks where applicable
5. Update documentation

### Test Naming Convention
```typescript
Deno.test({
  name: "Creator Workflow: [Feature] - [Scenario]",
  async fn() {
    // Test implementation
  },
});
```

### Mock Service Usage
- Use MockServiceFactory for external dependencies
- Reset mock state between tests
- Enable logging for debugging
- Simulate realistic latency and errors

## 📞 Support

For issues with the test suite:
1. Check this documentation first
2. Run tests with `--verbose` for detailed output
3. Verify prerequisites are met
4. Check backend server logs
5. Review test reports in `tests/reports/`

Remember: These tests validate the core creator experience that drives platform success! 🎬✨