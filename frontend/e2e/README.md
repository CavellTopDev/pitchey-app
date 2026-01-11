# Pitchey E2E Testing Suite

This directory contains a comprehensive end-to-end testing suite for the Pitchey platform using Playwright. The tests cover all major workflows across the three portals: Creator, Investor, and Production.

## Quick Start

```bash
# 1. Start the backend proxy server
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
PORT=8001 deno run --allow-all working-server.ts

# 2. Start the frontend development server
cd frontend
npm run dev

# 3. Run the core test suite
./run-e2e-tests.sh

# 4. Run specific test suites
./run-e2e-tests.sh auth        # Authentication only
./run-e2e-tests.sh creator     # Creator workflows only
./run-e2e-tests.sh full        # All test suites including optional ones
```

## Test Suite Overview

### Core Test Suites (Default)
- **Authentication Workflows** (`auth-workflows.spec.ts`)
  - Portal selection and navigation
  - Better Auth session-based login/logout
  - Protected route access control
  - Cross-portal authentication

- **Creator Workflows** (`creator-workflows.spec.ts`)
  - Dashboard functionality and analytics
  - Pitch creation, editing, and publishing
  - Character management
  - File uploads and NDA management
  - Team collaboration features

- **Investor Workflows** (`investor-workflows.spec.ts`)
  - Browse and search functionality
  - NDA request workflows
  - Investment tracking and portfolio management
  - Following creators and notifications

- **Production Workflows** (`production-workflows.spec.ts`)
  - Project management and pipeline
  - Partnership requests and proposals
  - Team management and roles
  - Analytics and reporting

- **Cross-Portal Interactions** (`cross-portal-interactions.spec.ts`)
  - Complete business workflows (Creator → Investor → Production)
  - Real-time notifications between portals
  - Multi-user collaboration scenarios

- **Public Browsing** (`public-browsing.spec.ts`)
  - Unauthenticated user experience
  - Browse tabs and genre filtering
  - Search functionality
  - Public pitch viewing

### Optional Test Suites
- **Accessibility** (`accessibility.spec.ts`)
  - WCAG 2.1 compliance testing
  - Keyboard navigation
  - Screen reader compatibility
  - Color contrast validation

- **WebSocket/Real-time** (`websocket-realtime.spec.ts`)
  - Real-time notifications
  - Draft auto-sync functionality
  - Presence indicators and typing status
  - Connection management and error handling

- **Performance** (`performance.spec.ts`)
  - Core Web Vitals measurement
  - Load performance testing
  - Memory leak detection
  - API response optimization

## Test Infrastructure

### Configuration
- **Playwright Config** (`playwright.config.ts`) - Better Auth configuration, multiple browsers
- **Global Setup** (`global-setup.ts`) - Environment validation and test user pre-authentication
- **Auth Setup** (`auth.setup.ts`) - Session state management for all three portals

### Utilities and Helpers
- **Authentication Helpers** (`utils/auth-helpers.ts`) - Better Auth session management
- **Page Helpers** (`utils/page-helpers.ts`) - Common page interactions and waits
- **WebSocket Helpers** (`utils/websocket-helpers.ts`) - Real-time feature testing utilities

### Test Data
- **Fixtures** (`fixtures/test-data.ts`) - Comprehensive test data including:
  - Demo user credentials (alex.creator@demo.com, sarah.investor@demo.com, etc.)
  - Realistic movie pitch scenarios with detailed plot summaries
  - Character profiles and relationship arcs
  - Investment and partnership scenarios
  - Search filter combinations

## Test Runner Features

The enhanced test runner (`run-e2e-tests.sh`) provides:

### Test Suite Selection
```bash
./run-e2e-tests.sh auth           # Authentication only
./run-e2e-tests.sh creator        # Creator workflows
./run-e2e-tests.sh investor       # Investor workflows
./run-e2e-tests.sh production     # Production workflows
./run-e2e-tests.sh cross-portal   # Cross-portal interactions
./run-e2e-tests.sh public         # Public browsing
./run-e2e-tests.sh core           # All core suites (default)
./run-e2e-tests.sh full           # All suites including optional
```

### Browser Options
```bash
./run-e2e-tests.sh -b chromium    # Chromium only (default)
./run-e2e-tests.sh -b firefox     # Firefox only
./run-e2e-tests.sh -b webkit      # WebKit only
./run-e2e-tests.sh -b all         # All browsers
```

### Execution Modes
```bash
./run-e2e-tests.sh -u             # UI mode (interactive)
./run-e2e-tests.sh -d             # Debug mode
./run-e2e-tests.sh -h             # Headed mode (visible browser)
./run-e2e-tests.sh -s             # Serial execution (no parallel)
./run-e2e-tests.sh -w 8           # Custom worker count
```

### Additional Options
```bash
./run-e2e-tests.sh -c             # Clean previous reports
./run-e2e-tests.sh -r             # Open report after completion
./run-e2e-tests.sh --help         # Show usage information
```

## Demo User Credentials

All demo accounts use the password: **Demo123**

- **Creator Portal**: alex.creator@demo.com
- **Investor Portal**: sarah.investor@demo.com  
- **Production Portal**: stellar.production@demo.com

## Technical Requirements

### Prerequisites
- **Backend**: Must be running on port 8001
  ```bash
  PORT=8001 deno run --allow-all working-server.ts
  ```
- **Frontend**: Must be running on port 5173
  ```bash
  npm run dev
  ```

### Authentication
- Uses **Better Auth** with session-based authentication (cookies)
- No JWT headers - all authentication via secure HTTP-only cookies
- Cross-portal session management with automatic redirects

### Test Environment
- **Base URL**: http://localhost:5173
- **API Proxy**: http://localhost:8001 (forwards to production Worker API)
- **Real-time**: WebSocket testing with connection monitoring
- **Storage**: R2 integration for file uploads

## Reports and Results

### HTML Report
```bash
npx playwright show-report
```

### Test Artifacts
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Complete interaction history for debugging
- **Coverage Reports**: Generated in `test-results/`

### CI Integration
The test suite is designed for CI/CD integration with:
- JUnit XML output for test reporting
- JSON results for automated analysis
- Parallel execution for faster completion
- Configurable timeouts and retry logic

## Best Practices

### Test Structure
- Page Object Model (POM) pattern implementation
- Arrange-Act-Assert test organization
- Comprehensive setup and teardown procedures

### Data Management
- Realistic test data fixtures
- Dynamic test data generation
- Isolated test environments

### Error Handling
- Graceful failure recovery
- Detailed error reporting with screenshots
- Network interruption simulation

### Performance
- Parallel test execution (4 workers default)
- Optimized wait strategies
- Minimal test data overhead

## Troubleshooting

### Common Issues

1. **Backend Not Running**
   ```
   Error: Backend proxy not running on port 8001
   Solution: PORT=8001 deno run --allow-all working-server.ts
   ```

2. **Authentication Failures**
   ```
   Error: Session not found or expired
   Solution: Delete .auth/ directory and run auth.setup.ts
   ```

3. **WebSocket Connection Issues**
   ```
   Error: WebSocket connection failed
   Solution: Verify backend supports WebSocket upgrade
   ```

4. **Browser Installation**
   ```
   Error: Browser not found
   Solution: npx playwright install
   ```

### Debug Mode
Run tests in debug mode for step-by-step execution:
```bash
./run-e2e-tests.sh -d
```

### Verbose Logging
Enable detailed logging in test files:
```typescript
test.use({ video: 'on', trace: 'on' });
```

## Contributing

When adding new tests:
1. Follow the existing Page Object Model pattern
2. Add realistic test data to `fixtures/test-data.ts`
3. Use appropriate data-testid selectors
4. Include both happy path and edge case scenarios
5. Update the test runner if new suites are added

## Architecture Notes

This E2E testing suite is specifically designed for Pitchey's Cloudflare Workers architecture:
- Tests the production API via local proxy server
- Validates Better Auth session-based authentication
- Supports real-time WebSocket features
- Tests R2 storage integration for file uploads
- Verifies cross-portal business workflows

The comprehensive test coverage ensures that all user journeys work correctly across the platform's three distinct portals while maintaining the real-time collaborative features that make Pitchey unique.