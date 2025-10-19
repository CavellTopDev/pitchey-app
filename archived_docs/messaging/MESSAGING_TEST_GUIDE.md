# Messaging System Test Suite Guide

## Overview

The Pitchey messaging system test suite (`test-messaging-workflows.sh`) is a comprehensive testing framework that validates all aspects of the real-time messaging system, including WebSocket connections, API endpoints, persistence, and error handling.

## Test Coverage

### 1. WebSocket Connection & Authentication
- ✅ Connection establishment with valid tokens
- ✅ Authentication rejection for invalid tokens
- ✅ Connection stability and reconnection logic
- ✅ Real-time message delivery

### 2. Conversation Management
- ✅ Create conversations between users
- ✅ Retrieve conversation details
- ✅ List conversations with filters
- ✅ Conversation metadata handling

### 3. Real-time Message Sending & Receiving
- ✅ Send text messages
- ✅ Reply to messages
- ✅ Message with mentions
- ✅ Real-time delivery via WebSocket

### 4. Message History & Pagination
- ✅ Retrieve message history
- ✅ Pagination with limit/offset
- ✅ Timestamp-based filtering
- ✅ Message ordering

### 5. File Attachments
- ✅ Upload file attachments
- ✅ Send messages with attachments
- ✅ Multiple file type support
- ✅ Attachment metadata handling

### 6. Message Notifications
- ✅ Unread message counts
- ✅ Notification creation
- ✅ Notification preferences
- ✅ Real-time notification delivery

### 7. Read Receipts & Typing Indicators
- ✅ Mark individual messages as read
- ✅ Mark entire conversations as read
- ✅ Typing indicator broadcasting
- ✅ Real-time status updates

### 8. Message Search
- ✅ Global message search
- ✅ Conversation-specific search
- ✅ Search with filters and pagination
- ✅ Full-text search capabilities

### 9. Block/Unblock Users
- ✅ Block users from messaging
- ✅ Unblock users
- ✅ List blocked users
- ✅ Message blocking enforcement

### 10. Group Conversations
- ✅ Create group conversations
- ✅ Send messages to groups
- ✅ Add/remove participants
- ✅ Group metadata management

### 11. Conversation Actions
- ✅ Archive/unarchive conversations
- ✅ Mute/unmute conversations
- ✅ Delete conversations
- ✅ Conversation state management

### 12. Message Editing & Deletion
- ✅ Edit message content
- ✅ Delete messages
- ✅ Authorization checks
- ✅ Message history tracking

### 13. Error Handling & Edge Cases
- ✅ Invalid conversation IDs
- ✅ Empty message rejection
- ✅ Unauthorized access prevention
- ✅ Message size limits

### 14. Performance & Load Testing
- ✅ Message sending performance
- ✅ Concurrent operations
- ✅ Response time validation
- ✅ System stability under load

## Prerequisites

### System Requirements
- **curl**: For HTTP requests
- **bash**: Version 4.0 or higher
- **python3**: For data generation (optional)
- **Node.js**: For WebSocket testing (optional but recommended)

### Server Requirements
- Pitchey backend server running on specified port
- Database connection established
- WebSocket endpoint available
- All messaging routes configured

### Environment Variables
```bash
export API_URL="http://localhost:8001"  # Backend server URL
export WS_URL="ws://localhost:8001"     # WebSocket server URL
```

## Usage

### Basic Test Run
```bash
# Run all messaging tests
./test-messaging-workflows.sh
```

### Custom Configuration
```bash
# Test against different server
API_URL="https://staging.pitchey.com" ./test-messaging-workflows.sh

# Test with custom WebSocket URL
WS_URL="wss://staging.pitchey.com" ./test-messaging-workflows.sh
```

### Test Output

The script provides colored output for easy reading:
- 🔵 **[INFO]**: Informational messages
- 🟢 **[SUCCESS]**: Successful operations
- 🟡 **[WARNING]**: Non-critical issues
- 🔴 **[ERROR]**: Critical failures
- 🟣 **[TEST]**: Test execution status
- 🔵 **[WEBSOCKET]**: WebSocket-specific operations

### Test Results

The script generates:
1. **Real-time console output** with colored status indicators
2. **JSON report** (`messaging_test_results.json`) with detailed metrics
3. **Exit code**: 0 for success, 1 for failures

## Test Configuration

### Timeouts
- **HTTP Request Timeout**: 10 seconds
- **WebSocket Timeout**: 5 seconds
- **Performance Thresholds**: Configurable per test

### Test Data
The suite automatically creates:
- Test users for each user type (creator, investor, production)
- Test pitches for messaging context
- Test conversations and messages
- Test attachments and files

### Cleanup
The script automatically cleans up:
- Test conversations
- Temporary files
- WebSocket connections
- Test artifacts

## Troubleshooting

### Common Issues

#### Server Not Running
```
[ERROR] Server is not running or not responding at http://localhost:8001
```
**Solution**: Start the Pitchey backend server before running tests.

#### WebSocket Connection Failed
```
[ERROR] WebSocket connection failed for creator: TIMEOUT
```
**Solutions**:
- Verify WebSocket endpoint is available
- Check authentication token validity
- Ensure proper CORS configuration

#### Node.js Not Available
```
[WARNING] Node.js not found, WebSocket tests will be skipped
```
**Solution**: Install Node.js to enable WebSocket testing features.

#### Database Connection Issues
```
[ERROR] Failed to create test users
```
**Solutions**:
- Verify database connection
- Check user registration endpoints
- Ensure proper database schema

### Debugging

#### Enable Verbose Output
```bash
# Add debug flag for detailed curl output
DEBUG=1 ./test-messaging-workflows.sh
```

#### Check Individual Components
```bash
# Test server health
curl -X GET http://localhost:8001/health

# Test authentication
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Test WebSocket manually
wscat -c "ws://localhost:8001/ws/messages?token=YOUR_TOKEN"
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Messaging System Tests

on: [push, pull_request]

jobs:
  messaging-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install WebSocket client
        run: npm install -g wscat
        
      - name: Start Backend Server
        run: |
          cd backend
          deno run --allow-all working-server.ts &
          sleep 10
          
      - name: Run Messaging Tests
        run: ./test-messaging-workflows.sh
        
      - name: Upload Test Results
        uses: actions/upload-artifact@v2
        with:
          name: messaging-test-results
          path: messaging_test_results.json
```

### Docker Integration
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .

# Install dependencies
RUN apk add --no-cache curl bash python3

# Make script executable
RUN chmod +x test-messaging-workflows.sh

# Run tests
CMD ["./test-messaging-workflows.sh"]
```

## Performance Benchmarks

### Expected Performance Metrics
- **Message Send**: < 100ms response time
- **Message Retrieval**: < 200ms for 50 messages
- **WebSocket Connection**: < 1 second establishment
- **Search Operations**: < 300ms for 1000+ messages
- **Concurrent Operations**: 5 simultaneous requests < 3 seconds

### Load Testing Recommendations
```bash
# For higher load testing, consider:
# 1. Apache Bench (ab)
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
   -p message_payload.json \
   http://localhost:8001/api/messages

# 2. Artillery.io for WebSocket load testing
artillery run websocket-load-test.yml

# 3. Custom scripts for sustained testing
for i in {1..100}; do
  ./test-messaging-workflows.sh &
done
wait
```

## Security Testing

The test suite includes security validations:
- **Authentication**: Token validation and rejection
- **Authorization**: User permission enforcement
- **Input Validation**: Message content and size limits
- **CORS**: Cross-origin request handling
- **Rate Limiting**: Request throttling verification

## Extending the Test Suite

### Adding New Tests
```bash
# Add new test function
test_new_feature() {
    print_status "TEST" "Testing new messaging feature"
    
    # Your test implementation
    local response=$(http_request "GET" "/api/new-endpoint" "" "$CREATOR_TOKEN")
    
    if echo "$response" | grep -q '"success":true'; then
        count_test 0 "New feature test passed"
    else
        count_test 1 "New feature test failed: $response"
    fi
}

# Add to main execution
main() {
    # ... existing tests ...
    test_new_feature
    # ... rest of main function ...
}
```

### Custom Assertions
```bash
# Add custom validation functions
validate_message_format() {
    local response=$1
    local expected_fields=("id" "content" "senderId" "createdAt")
    
    for field in "${expected_fields[@]}"; do
        if ! echo "$response" | grep -q "\"$field\""; then
            return 1
        fi
    done
    return 0
}
```

## Support and Contributions

For issues or improvements:
1. Check existing GitHub issues
2. Create detailed bug reports with test output
3. Submit pull requests with new test cases
4. Update documentation for new features

The messaging test suite is designed to be comprehensive, maintainable, and easily extendable as the Pitchey messaging system evolves.