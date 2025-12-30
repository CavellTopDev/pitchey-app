# Pitchey Notifications System Documentation

## Overview

The Pitchey platform features a comprehensive real-time notification system that keeps users informed about important events, interactions, and updates. This document provides complete implementation details and integration guidelines.

## 🚀 Features

### ✅ **Implemented Features**
- **Real-time notifications** via WebSocket connections
- **Persistent notification storage** with database integration
- **Interactive notification dropdown** with rich UI
- **Mark as read/unread functionality**
- **Bulk notification management** (mark all as read, clear all)
- **Notification type categorization** with visual indicators
- **Action buttons** for context-specific responses
- **Unread count badges** with real-time updates
- **Browser notifications** (native OS notifications)
- **Sound alerts** for important notifications
- **Loading states** and error handling
- **Cross-portal compatibility** (Creator, Investor, Production)

### 🎯 **Notification Types**

The system supports the following notification types:

1. **`nda_request`** - NDA access requests
   - **Actions**: View Pitch, Manage NDAs
   - **Visual**: Warning style (yellow)

2. **`nda_approved`** - NDA request approvals
   - **Actions**: View Pitch
   - **Visual**: Success style (green)

3. **`nda_rejected`** - NDA request rejections
   - **Actions**: View Pitch, Resubmit
   - **Visual**: Error style (red)

4. **`pitch_view`** - Pitch view notifications
   - **Actions**: View Analytics
   - **Visual**: Info style (blue)

5. **`message`** - New message notifications
   - **Actions**: View Messages
   - **Visual**: Info style (blue)

6. **`investment`** - Investment notifications
   - **Actions**: View Investment
   - **Visual**: Success style (green)

7. **`follow`** - New follower notifications
   - **Actions**: View Profile
   - **Visual**: Success style (green)

8. **`pitch_update`** - Pitch update notifications
   - **Actions**: View Pitch
   - **Visual**: Warning style (yellow)

9. **`system`** - System notifications
   - **Actions**: None (informational)
   - **Visual**: Info style (blue)

10. **`info_request`** - Information requests
    - **Actions**: Respond, View Details
    - **Visual**: Warning style (yellow)

11. **`info_request_response`** - Information request responses
    - **Actions**: View Response
    - **Visual**: Info style (blue)

## 🏗️ System Architecture

### **Frontend Components**

#### 1. **NotificationDropdown Component**
**Location**: `/frontend/src/components/NotificationDropdown.tsx`

**Features**:
- Animated bell icon with unread count badge
- Dropdown panel with notification list
- Loading states and empty states
- Click outside to close functionality
- Real-time updates

**Props**:
```typescript
interface NotificationDropdownProps {
  className?: string;
}
```

#### 2. **NotificationItem Component**
**Internal component within NotificationDropdown**

**Props**:
```typescript
interface NotificationItemProps {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
  onMarkAsRead: (id: string) => void;
}
```

#### 3. **NotificationAction Interface**
```typescript
interface NotificationAction {
  label: string;
  action: () => void;
  type?: 'primary' | 'secondary';
}
```

### **Backend Services**

#### 1. **NotificationsService**
**Location**: `/frontend/src/services/notifications.service.ts`

**Main Methods**:
```typescript
// Load notifications from API
static async getNotifications(limit: number = 20): Promise<Notification[]>

// Get only unread notifications
static async getUnreadNotifications(): Promise<Notification[]>

// Mark single notification as read
static async markAsRead(notificationId: number): Promise<boolean>

// Mark multiple notifications as read
static async markMultipleAsRead(notificationIds: number[]): Promise<boolean>

// Mark all notifications as read
static async markAllAsRead(): Promise<boolean>

// Get notification preferences
static async getPreferences(): Promise<NotificationPreferences | null>

// Update notification preferences
static async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean>

// Convert backend format to frontend format
static convertToFrontendFormat(notification: Notification)

// Get contextual actions for notification type
static getNotificationActions(notification: Notification)
```

#### 2. **WebSocket Integration**
**Location**: `/frontend/src/contexts/WebSocketContext.tsx`

**Features**:
- Real-time notification delivery
- Connection state management
- Message queuing for offline users
- Automatic reconnection logic

### **API Endpoints**

#### **Base Endpoint**: `/api/notifications`

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| `GET` | `/api/notifications` | Get user notifications | `limit` (default: 20), `unread=true` |
| `GET` | `/api/notifications/unread` | Get only unread notifications | None |
| `POST` | `/api/notifications/read` | Mark multiple as read | `{"notificationIds": [1,2,3]}` |
| `POST` | `/api/notifications/{id}/read` | Mark single as read | None |
| `GET` | `/api/notifications/preferences` | Get notification preferences | None |
| `PUT` | `/api/notifications/preferences` | Update preferences | `{"email": true, "push": false}` |

#### **Response Formats**

**Standard Response**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "userId": 1,
        "type": "nda_request",
        "title": "New NDA Request",
        "message": "Sarah Investor has requested an NDA for your pitch 'Space Adventure'",
        "isRead": false,
        "createdAt": "2025-10-24T15:43:08.643Z",
        "data": {
          "pitchId": 11,
          "requesterId": 2
        }
      }
    ],
    "message": "Notifications retrieved successfully"
  }
}
```

**Unread Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 11,
      "userId": 1,
      "type": "nda_request",
      "title": "New NDA Request",
      "message": "You have a new NDA request for \"Comprehensive Test Updated Title\"",
      "relatedId": null,
      "relatedType": null,
      "isRead": false,
      "createdAt": "2025-10-24T10:20:07.631Z"
    }
  ]
}
```

### **Database Schema**

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id INTEGER,
  related_type VARCHAR(50),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

## 🔧 Integration Guide

### **Step 1: Import and Use NotificationDropdown**

```tsx
import { NotificationDropdown } from '../components/NotificationDropdown';

// In your layout component
<NotificationDropdown className="mr-4" />
```

### **Step 2: WebSocket Context Setup**

Ensure your app is wrapped with WebSocketProvider:

```tsx
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  return (
    <WebSocketProvider>
      {/* Your app components */}
    </WebSocketProvider>
  );
}
```

### **Step 3: Authentication Integration**

The notification system automatically:
- Loads notifications when user authenticates
- Clears notifications when user logs out
- Handles different user types (creator/investor/production)

### **Step 4: Backend Notification Creation**

```typescript
// Example: Create a notification when NDA is requested
await notificationService.createNotification({
  userId: pitchCreatorId,
  type: 'nda_request',
  title: 'New NDA Request',
  message: `${requesterName} has requested an NDA for your pitch "${pitchTitle}"`,
  data: {
    pitchId: pitch.id,
    requesterId: requester.id
  }
});
```

### **Step 5: WebSocket Message Handling**

```typescript
// Backend WebSocket notification sending
websocketService.sendToUser(userId, {
  type: 'notification',
  data: {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    timestamp: notification.createdAt,
    read: false
  }
});
```

## 🎨 UI/UX Features

### **Visual Indicators**
- **Unread Badge**: Red circle with count on bell icon
- **Animation**: Pulse effect for new notifications
- **Type Icons**: Different icons for each notification type
- **Color Coding**: Visual distinction by notification importance

### **Interaction Patterns**
- **Click Bell**: Opens/closes dropdown
- **Click Notification**: Marks as read and executes primary action
- **Action Buttons**: Context-specific actions within notifications
- **Clear All**: Bulk mark all as read
- **Auto-refresh**: Loads latest notifications when dropdown opens

### **Responsive Design**
- **Desktop**: Full-width dropdown (320px)
- **Mobile**: Optimized touch targets and spacing
- **Dark Mode**: Automatic theme adaptation (if implemented)

## 🔧 Customization

### **Adding New Notification Types**

1. **Update the enum** in your backend:
```typescript
enum NotificationType {
  NDA_REQUEST = 'nda_request',
  YOUR_NEW_TYPE = 'your_new_type'
}
```

2. **Add mapping** in NotificationsService:
```typescript
private static mapNotificationType(backendType: string) {
  switch (backendType) {
    case 'your_new_type':
      return 'info'; // or 'success', 'warning', 'error'
    // ... existing cases
  }
}
```

3. **Add actions** in getNotificationActions:
```typescript
case 'your_new_type':
  actions.push({
    label: 'Your Action',
    action: () => {
      // Your action logic
    },
    type: 'primary'
  });
  break;
```

### **Styling Customization**

The component uses Tailwind CSS classes. Key customization points:

```css
/* Bell icon container */
.notification-bell {
  @apply relative p-2 text-gray-600 hover:text-gray-900;
}

/* Dropdown panel */
.notification-dropdown {
  @apply absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg;
}

/* Notification item */
.notification-item {
  @apply p-3 hover:bg-gray-50 border-l-4 transition-colors;
}
```

## 🚀 Performance Considerations

### **Frontend Optimization**
- **Virtualization**: For large notification lists (>100 items)
- **Pagination**: Load notifications in batches
- **Debouncing**: Limit API calls when dropdown opens/closes rapidly
- **Caching**: Store notifications in local state to reduce API calls

### **Backend Optimization**
- **Database Indexes**: On user_id, created_at, is_read columns
- **Redis Caching**: Cache frequently accessed notifications
- **WebSocket Scaling**: Use Redis pub/sub for multi-server setups
- **Cleanup**: Automated removal of old read notifications

## 🧪 Testing

### **Component Testing**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationDropdown } from './NotificationDropdown';

test('opens dropdown when bell is clicked', () => {
  render(<NotificationDropdown />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Notifications')).toBeInTheDocument();
});
```

### **API Testing**
```bash
# Test notification retrieval
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/notifications

# Test marking as read
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationIds": [1,2,3]}' \
  http://localhost:8001/api/notifications/read
```

### **WebSocket Testing**
```typescript
// Test WebSocket notification delivery
const mockSocket = new MockWebSocket();
mockSocket.send({
  type: 'notification',
  data: {
    id: '1',
    type: 'info',
    title: 'Test',
    message: 'Test message',
    timestamp: new Date(),
    read: false
  }
});
```

## 🔐 Security Considerations

### **Authentication**
- All notification endpoints require valid JWT tokens
- User can only access their own notifications
- WebSocket connections validate user identity

### **Data Validation**
- Sanitize notification content to prevent XSS
- Validate notification types against allowed enum values
- Rate limiting on notification creation

### **Privacy**
- Sensitive data in notifications should be minimal
- Use references (IDs) rather than full content
- Implement data retention policies

## 🚀 Deployment

### **Environment Variables**
```bash
# WebSocket configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=8001

# Redis configuration (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Notification settings
NOTIFICATION_CLEANUP_DAYS=30
NOTIFICATION_BATCH_SIZE=20
```

### **Production Checklist**
- [ ] Database indexes created
- [ ] Redis configured (if using)
- [ ] WebSocket proxy configured
- [ ] Rate limiting enabled
- [ ] Monitoring setup for notification delivery
- [ ] Backup strategy for notification data

## 📊 Monitoring

### **Key Metrics**
- Notification delivery rate
- Read rate (percentage of notifications read)
- WebSocket connection stability
- API response times
- Database query performance

### **Health Checks**
```typescript
// Notification system health check
GET /api/health/notifications
{
  "status": "healthy",
  "metrics": {
    "totalNotifications": 15420,
    "unreadCount": 523,
    "deliveryRate": 99.8,
    "avgResponseTime": "45ms"
  }
}
```

## 🎯 Future Enhancements

### **Planned Features**
- [ ] **Email Notifications**: Digest emails for offline users
- [ ] **Push Notifications**: Browser/mobile push notifications
- [ ] **Notification Categories**: User-configurable notification types
- [ ] **Snooze Functionality**: Temporarily hide notifications
- [ ] **Notification Templates**: Customizable notification formats
- [ ] **Analytics Dashboard**: Notification engagement metrics
- [ ] **Multi-language Support**: Internationalized notifications

### **Advanced Features**
- [ ] **Smart Batching**: Group related notifications
- [ ] **Priority Levels**: High/medium/low priority notifications
- [ ] **Custom Actions**: User-defined notification actions
- [ ] **Notification Rules**: User-defined filtering and routing
- [ ] **Integration APIs**: Third-party notification services

---

## 📞 Support

For technical support or feature requests related to the notification system:

1. **Documentation**: This file and inline code comments
2. **API Testing**: Use the provided curl examples
3. **Component Testing**: Use React Testing Library examples
4. **Performance Issues**: Check database indexes and Redis configuration

The notification system is designed to be robust, scalable, and user-friendly, providing real-time updates while maintaining excellent performance and reliability.