# Pitchey WebSocket Server Architecture Documentation

## Overview

This document describes the production-ready WebSocket server architecture implemented for the Pitchey platform. The system provides comprehensive real-time features including notifications, live dashboard metrics, draft auto-sync, presence tracking, upload progress, live pitch view counters, typing indicators, and activity feed updates.

## Architecture Components

### 1. Core WebSocket Server (`websocket.service.ts`)

The main WebSocket server class that handles:
- **Authentication**: JWT token-based authentication via query parameters
- **Session Management**: Tracks active WebSocket connections and user sessions
- **Message Routing**: Routes incoming messages to appropriate handlers
- **Connection Management**: Handles connect/disconnect events with cleanup
- **Broadcasting**: Sends messages to specific users or groups

**Key Features:**
- Multiple connections per user support
- Session-based rate limiting (120 messages/minute)
- Automatic cleanup of inactive sessions
- Heartbeat/ping-pong for connection health
- Message queuing for offline users

### 2. Redis Pub/Sub Integration (`websocket-redis.service.ts`)

Provides scalable message broadcasting across multiple server instances:
- **Pub/Sub Channels**: Organized channels for different message types
- **Presence Storage**: Redis-based user presence tracking
- **Message Queuing**: Persistent queue for offline users
- **Draft Synchronization**: Real-time draft auto-sync across sessions
- **Upload Progress**: Progress tracking with Redis persistence

**Redis Channels:**
```typescript
pitchey:notifications:{userId}    - User-specific notifications
pitchey:dashboard:{userId}        - Dashboard updates
pitchey:pitch:{pitchId}          - Pitch-specific updates
pitchey:presence                 - Global presence updates
pitchey:announcements           - System-wide announcements
pitchey:typing:{conversationId}  - Typing indicators
pitchey:messages:{conversationId} - Message updates
pitchey:upload:{userId}          - Upload progress
```

### 3. Rate Limiting System (`websocket-rate-limiter.ts`)

Sophisticated rate limiting with:
- **Per-Message-Type Limits**: Different limits for different message types
- **Token Bucket Algorithm**: Smooth rate limiting with burst capability
- **Violation Tracking**: Progressive penalties for rate limit violations
- **Session Blocking**: Temporary blocks for repeat offenders
- **Distributed State**: Redis-backed state for multi-server deployments

**Rate Limits:**
- PING: 60/minute
- Messaging: 30/minute (with burst of 5)
- Typing indicators: 10/minute
- Presence updates: 5/minute
- Draft sync: 10/minute (with burst of 3)

### 4. Message Router (`websocket-message-router.ts`)

Handles message validation and routing:
- **Validation**: Schema-based message payload validation
- **Handler Registration**: Pluggable message handlers
- **Error Handling**: Comprehensive error responses
- **Permission Checks**: Message-level authorization
- **Database Integration**: Persistent storage for relevant messages

**Supported Message Types:**
- `ping/pong` - Connection health
- `notification_read` - Mark notifications as read
- `draft_sync` - Real-time draft synchronization
- `presence_update` - User status changes
- `typing_start/stop` - Typing indicators
- `send_message` - Real-time messaging
- `message_read` - Read receipts
- `upload_progress` - File upload tracking
- `pitch_view_update` - Live view counters

### 5. Presence Tracking (`presence-tracking.service.ts`)

Comprehensive user presence management:
- **Status Types**: Online, Away, Offline, Do Not Disturb
- **Activity Tracking**: User activity types and details
- **Session Counting**: Multiple session support per user
- **Batch Updates**: Efficient presence broadcasting
- **Automatic Status**: Inactive user detection and status updates

**Presence Features:**
- Following-based online user lists
- Custom status messages
- Location and device tracking
- Activity-based status inference
- Redis-backed presence cache

### 6. Message Queue System (`message-queue.service.ts`)

Reliable message delivery for offline users:
- **Priority Levels**: 5 priority levels (Low to Critical)
- **Retry Logic**: Exponential backoff with max attempts
- **TTL Management**: Automatic message expiration
- **Batch Processing**: Efficient delivery when users come online
- **Delivery Confirmation**: Tracking of successful deliveries

**Queue Features:**
- Priority-based delivery order
- Message deduplication
- Failure handling with retry
- Persistent storage in Redis
- Analytics tracking

### 7. Analytics System (`websocket-analytics.service.ts`)

Comprehensive tracking and monitoring:
- **Session Analytics**: Connection duration, message counts, errors
- **Real-time Metrics**: Live dashboard data
- **Performance Tracking**: Latency measurement and optimization
- **Feature Usage**: Track feature adoption and usage patterns
- **Error Monitoring**: Detailed error tracking and alerting

**Analytics Data:**
- Connection statistics
- Message throughput
- Feature usage patterns
- Performance metrics
- Error rates and patterns

### 8. Error Handling (`websocket-error-handler.service.ts`)

Production-ready error management:
- **Error Categories**: Organized error classification
- **Severity Levels**: 4 severity levels with appropriate responses
- **Recovery Strategies**: Automatic recovery for common failures
- **Circuit Breakers**: Fault tolerance for external services
- **Error Suppression**: Prevent error spam while maintaining visibility

**Error Management:**
- Centralized error logging
- Sentry integration for critical errors
- Client-friendly error messages
- Automatic retry mechanisms
- Error rate monitoring

### 9. Integration Service (`websocket-integration.service.ts`)

Unified API for HTTP server integration:
- **HTTP/WebSocket Bridge**: Seamless integration with existing HTTP endpoints
- **Service Orchestration**: Coordinates all WebSocket services
- **Health Monitoring**: Service health checks and status reporting
- **Graceful Shutdown**: Clean shutdown with connection draining
- **API Compatibility**: HTTP endpoints for WebSocket functionality

## Message Flow Architecture

```
Client Request
     ↓
WebSocket Upgrade
     ↓
Authentication (JWT)
     ↓
Session Creation
     ↓
Message Router
     ↓
Rate Limiter → [BLOCK if exceeded]
     ↓
Message Handler
     ↓
Database/Redis Operations
     ↓
Response/Broadcast
     ↓
Analytics Tracking
```

## Database Schema Integration

The WebSocket system integrates with existing database tables:

### Core Tables Used:
- `users` - User authentication and profiles
- `messages` - Persistent message storage
- `conversations` - Conversation management
- `conversation_participants` - User participation tracking
- `message_read_receipts` - Read status tracking
- `typing_indicators` - Real-time typing status
- `notifications` - System notifications
- `pitch_views` - View tracking for analytics
- `analytics_events` - WebSocket event tracking

### New Tables Added:
- `user_sessions` - Session management
- `analytics_aggregates` - Performance metrics
- `security_events` - Security incident tracking

## Real-time Features Implementation

### 1. Real-time Notifications
- Instant delivery to online users
- Queue for offline users
- Read receipt tracking
- Priority-based delivery

### 2. Live Dashboard Metrics
- Real-time analytics updates
- Performance monitoring
- User activity tracking
- System health metrics

### 3. Draft Auto-sync
- Automatic saving every few seconds
- Conflict resolution between sessions
- Version tracking
- Rollback capability

### 4. Presence Tracking
- Online/away/offline status
- Activity-based status updates
- Following-based online lists
- Custom status messages

### 5. Upload Progress Tracking
- Real-time progress updates
- Error notification
- Completion confirmation
- Resume capability data

### 6. Live Pitch View Counters
- Real-time view count updates
- Unique viewer tracking
- Geographic analytics
- Engagement metrics

### 7. Typing Indicators
- Real-time typing status
- Conversation-specific indicators
- Automatic cleanup
- Multi-user support

### 8. Activity Feed Updates
- Real-time activity notifications
- Follow-based activity streams
- Engagement tracking
- Content updates

## Security Implementation

### Authentication
- JWT token validation on connect
- Token expiration handling
- Session-based security
- IP-based tracking

### Rate Limiting
- Message-type specific limits
- Progressive penalties
- IP-based blocking
- Session tracking

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

### Monitoring
- Security event logging
- Suspicious activity detection
- Rate limit violation tracking
- Error pattern analysis

## Performance Optimizations

### Connection Management
- Connection pooling
- Session reuse
- Automatic cleanup
- Memory optimization

### Message Processing
- Batch processing
- Priority queues
- Async operations
- Database query optimization

### Caching Strategy
- Redis caching
- In-memory caching
- TTL management
- Cache invalidation

### Scaling Considerations
- Horizontal scaling support
- Load balancer compatibility
- Redis clustering
- Database connection pooling

## Deployment Architecture

```
Load Balancer (Nginx/HAProxy)
         ↓
Multiple Server Instances
         ↓
Shared Redis Cluster
         ↓
Database (PostgreSQL)
         ↓
Analytics Store
```

### Components:
- **Load Balancer**: WebSocket-aware load balancing
- **App Servers**: Multiple Deno instances
- **Redis Cluster**: Shared state and pub/sub
- **Database**: PostgreSQL with read replicas
- **Monitoring**: Sentry, analytics, logs

## Configuration

### Environment Variables
```bash
# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=8001
WEBSOCKET_PATH=/ws

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_MESSAGES=120

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=pitchey:ws:

# Security
JWT_SECRET=your-secret-key
CORS_ORIGINS=https://yourdomain.com

# Analytics
ANALYTICS_ENABLED=true
SENTRY_DSN=your-sentry-dsn

# Performance
MAX_CONNECTIONS=1000
MESSAGE_QUEUE_SIZE=10000
SESSION_TIMEOUT=300000
```

## API Endpoints

### WebSocket Endpoint
```
ws://localhost:8001/ws?token=JWT_TOKEN
```

### HTTP Integration Endpoints
```
GET  /api/ws/health              - Health check
GET  /api/ws/stats               - Server statistics (admin)
POST /api/ws/notify              - Send notification
GET  /api/ws/presence/{userId}   - Get user presence
GET  /api/ws/following-online    - Get online following
POST /api/ws/upload-progress     - Update upload progress
POST /api/ws/pitch/{id}/stats    - Update pitch stats
POST /api/ws/announce            - System announcement (admin)
```

## Monitoring and Observability

### Metrics Tracked
- Connection count and duration
- Message throughput and latency
- Error rates and types
- Feature usage statistics
- Performance metrics

### Alerting
- High error rates
- Connection failures
- Performance degradation
- Security incidents
- Service unavailability

### Logging
- Structured JSON logging
- Log levels and filtering
- Error stack traces
- Request/response logging
- Performance timing

## Testing Strategy

### Unit Tests
- Individual service testing
- Message handler testing
- Validation testing
- Error handling testing

### Integration Tests
- End-to-end message flow
- Database integration
- Redis integration
- Authentication flow

### Load Testing
- Connection capacity
- Message throughput
- Memory usage
- Performance under load

### Security Testing
- Authentication bypass attempts
- Rate limit testing
- Input validation testing
- CORS testing

## Troubleshooting Guide

### Common Issues

#### Connection Failures
1. Check JWT token validity
2. Verify CORS configuration
3. Check rate limiting status
4. Validate WebSocket upgrade headers

#### Message Delivery Issues
1. Check user online status
2. Verify message queue status
3. Check rate limiting
4. Validate message format

#### Performance Issues
1. Monitor connection count
2. Check Redis performance
3. Analyze database queries
4. Review error rates

#### Memory Leaks
1. Monitor session cleanup
2. Check message queue size
3. Verify cache TTL settings
4. Review connection pooling

### Debug Commands
```bash
# Check WebSocket health
curl http://localhost:8001/api/ws/health

# Get server statistics
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/ws/stats

# Test notification sending
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":1,"notification":{"type":"test","title":"Test","message":"Test message"}}' \
  http://localhost:8001/api/ws/notify
```

## Future Enhancements

### Planned Features
1. **File Attachments**: Real-time file sharing
2. **Voice Messages**: Audio message support
3. **Video Calls**: WebRTC integration
4. **Group Messaging**: Multi-user conversations
5. **Message Encryption**: End-to-end encryption
6. **Push Notifications**: Mobile push notification support
7. **Message Threading**: Reply-to-message functionality
8. **Message Reactions**: Emoji reactions to messages

### Performance Improvements
1. **Binary Protocol**: More efficient message encoding
2. **Compression**: Message compression for large payloads
3. **Connection Multiplexing**: Multiple logical connections over one WebSocket
4. **Edge Caching**: CDN integration for static content
5. **Database Sharding**: Horizontal database scaling

### Monitoring Enhancements
1. **Real-time Dashboards**: Live monitoring interfaces
2. **Predictive Analytics**: AI-powered usage prediction
3. **Automated Scaling**: Auto-scaling based on load
4. **Advanced Alerting**: ML-based anomaly detection
5. **Performance Profiling**: Detailed performance analysis

## Conclusion

This WebSocket architecture provides a robust, scalable, and feature-rich real-time communication system for the Pitchey platform. The modular design allows for easy maintenance and extension, while the comprehensive error handling and monitoring ensure production reliability.

The system is designed to handle thousands of concurrent connections while maintaining low latency and high reliability. The integration with the existing HTTP API ensures a seamless user experience across all platform features.

For questions or support, refer to the individual service documentation or contact the development team.