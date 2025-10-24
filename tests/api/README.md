# API Endpoint Validation Test Suite

Comprehensive test suite for validating all API endpoints in the Pitchey platform with 98% coverage target.

## Overview

This test suite provides comprehensive validation for all API endpoints including:

- **Authentication endpoints** - Login, logout, registration across all portals
- **Pitch management** - CRUD operations with validation
- **Character management** - Character creation, editing, reordering
- **NDA workflow** - Request, approval, signing process
- **Investment tracking** - Portfolio management, watchlist operations
- **Info requests** - Creator-investor communication
- **File uploads** - Document and media validation
- **Search and filtering** - Advanced search capabilities
- **Messaging system** - Real-time communication
- **Dashboard endpoints** - Portal-specific analytics
- **WebSocket endpoints** - Real-time features
- **Production portal** - Industry-specific features

## Test Categories

### 1. Request Validation
- Required fields validation
- Data type validation (string, number, boolean, email)
- Field length limits
- Format validation (email, URLs, dates)
- Enum value validation

### 2. Response Format Validation
- Correct HTTP status codes (200, 201, 400, 401, 403, 404, 409, 429, 500)
- Response structure consistency
- Required response fields
- Data type correctness
- Pagination format validation

### 3. Authorization & Permissions
- Portal-specific access control (creator vs investor vs production)
- JWT token validation
- Role-based permissions
- Resource ownership validation
- Cross-user access prevention

### 4. Error Handling
- Validation error responses (400 Bad Request)
- Authentication errors (401 Unauthorized)
- Permission errors (403 Forbidden)
- Not found errors (404)
- Conflict errors (409)
- Rate limiting (429)
- Server errors (500)

### 5. Security Testing
- SQL injection prevention
- XSS protection
- CORS validation
- Content-Type validation
- File upload security
- Rate limiting validation

## Running the Tests

### Prerequisites
1. Backend server running on port 8001
2. Database connection configured
3. Demo accounts available

### Start the Backend Server
```bash
PORT=8001 deno run --allow-all working-server.ts
```

### Run the Test Suite
```bash
# Run all endpoint validation tests
deno test tests/api/endpoint-validation.test.ts --allow-all

# Run with verbose output
deno test tests/api/endpoint-validation.test.ts --allow-all --verbose

# Run specific test group
deno test tests/api/endpoint-validation.test.ts --allow-all --filter "Authentication Endpoints"
```

## Test Structure

### Test Categories
- `Authentication Endpoints` - Login/logout/registration validation
- `Pitch Management Endpoints` - CRUD operations and validation
- `Character Management Endpoints` - Character operations
- `NDA Workflow Endpoints` - Business logic validation
- `Investment and Info Request Endpoints` - Business logic validation
- `Search and Filtering Endpoints` - Query validation
- `Notification Endpoints` - Real-time updates
- `Messaging Endpoints` - Communication validation
- `Production Portal Endpoints` - Industry-specific features
- `File Upload Endpoints` - Validation scenarios
- `Dashboard and Analytics Endpoints` - Authorization & data validation
- `WebSocket and Real-time Endpoints` - Connection & authentication
- `Error Handling and Edge Cases` - Comprehensive validation
- `Response Format Consistency` - Structure validation

### Test Data
Tests use the existing `TestDataFactory` from `tests/setup.ts` for consistent test data generation.

### Demo Accounts
Tests use the configured demo accounts:
- Creator: `alex.creator@demo.com` / `Demo123`
- Investor: `sarah.investor@demo.com` / `Demo123`
- Production: `stellar.production@demo.com` / `Demo123`

## Coverage Goals

### Endpoints Tested (98% target)
✅ Authentication (login, logout, registration)  
✅ Pitch CRUD operations  
✅ Character management  
✅ NDA workflow  
✅ Investment tracking  
✅ Info requests  
✅ File uploads  
✅ Search and filtering  
✅ Messaging  
✅ Notifications  
✅ Dashboard endpoints  
✅ WebSocket endpoints  
✅ Production portal  
✅ Analytics endpoints  

### Validation Types
✅ Request validation (required fields, data types, formats)  
✅ Response validation (status codes, structure, fields)  
✅ Authorization validation (portal-specific access)  
✅ Error handling (all error scenarios)  
✅ Security validation (injection, XSS, CORS)  
✅ File upload validation (size, type, security)  
✅ Rate limiting validation  
✅ Pagination validation  

## Test Output

Each test provides detailed validation including:
- Request/response validation
- Security checks
- Performance considerations
- Error scenario coverage
- Edge case handling

Example output:
```
✅ Authentication Endpoints - Comprehensive Validation
  ✅ POST /api/auth/creator/login - Valid credentials
  ✅ POST /api/auth/creator/login - Invalid credentials
  ✅ POST /api/auth/creator/login - Missing required fields
  ✅ POST /api/auth/creator/login - Invalid data types
```

## Maintenance

To update tests when adding new endpoints:
1. Add endpoint definition to appropriate test category
2. Include request/response validation
3. Add error scenario tests
4. Update coverage documentation

## Integration

This test suite integrates with:
- Existing test setup in `tests/setup.ts`
- Demo account system
- Backend API endpoints
- Database schema validation
- WebSocket integration