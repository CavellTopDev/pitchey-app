# Pitchey Frontend WebSocket Integration Guide

This guide provides comprehensive documentation for integrating the WebSocket system into the Pitchey frontend application.

## Overview

The WebSocket system provides real-time functionality including:

- **Real-time notifications** with toast and dropdown display
- **Live dashboard metrics** that update automatically
- **Presence indicators** showing online/offline status
- **Typing indicators** for real-time form interaction
- **Upload progress tracking** with real-time updates
- **Live view counters** for pitch analytics
- **Draft auto-sync** with conflict resolution
- **Message queuing** and offline support
- **Rate limiting** and connection management

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │    │   Context API    │    │   Backend WS    │
│                 │    │                  │    │                 │
│ NotificationDD  │────│ WebSocketContext │────│ ws://server/ws  │
│ LiveMetrics     │    │                  │    │                 │
│ PresenceInd     │    │ - Global State   │    │ - Auth via JWT  │
│ TypingInd       │    │ - Message Route  │    │ - Rate Limiting │
│ UploadProgress  │    │ - Subscriptions  │    │ - Redis Pub/Sub │
│ LiveViewCounter │    │ - Reconnection   │    │ - Message Queue │
│ DraftSync Hook  │    │ - Queue Mgmt     │    │ - Analytics     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Installation & Setup

### 1. Core WebSocket Provider

The WebSocket system is integrated at the app level in `App.tsx`:

```tsx
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <ToastProvider>
            {/* Your app components */}
          </ToastProvider>
        </WebSocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

### 2. Environment Configuration

Update your `.env` file with WebSocket configuration:

```bash
VITE_API_URL=https://your-api-domain.com
VITE_WS_URL=wss://your-api-domain.com  # Optional, auto-derived from API_URL
```

The WebSocket URL is automatically derived from the API URL if not specified.

### 3. Backend Integration

Ensure your backend WebSocket server is running on:
- **Endpoint**: `ws://localhost:8001/ws?token=JWT_TOKEN`
- **Message Format**: `{ type: string, data: any, id?: string }`
- **Authentication**: JWT token via query parameter

## Component Integration Examples

### 1. Enhanced Navigation with Notifications

```tsx
import NotificationDropdown from './components/NotificationDropdown';

function Navigation() {
  return (
    <nav className="bg-white shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Logo and navigation items */}
        </div>
        <div className="flex items-center space-x-4">
          {/* Real-time notifications */}
          <NotificationDropdown />
          {/* Other nav items */}
        </div>
      </div>
    </nav>
  );
}
```

### 2. Dashboard with Live Metrics

```tsx
import LiveMetrics from './components/LiveMetrics';
import { useWebSocket } from './contexts/WebSocketContext';

function CreatorDashboard() {
  const { isConnected, connectionStatus } = useWebSocket();
  
  return (
    <div className="dashboard">
      {/* Connection status indicator */}
      <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
        {isConnected ? 'Live Updates' : 'Offline'}
      </div>
      
      {/* Live updating metrics */}
      <LiveMetrics 
        showConnectionStatus={true}
        refreshInterval={30000}
      />
      
      {/* Rest of dashboard */}
    </div>
  );
}
```

### 3. Pitch Detail with Live Features

```tsx
import LiveViewCounter, { ViewAnalytics, LiveViewBadge } from './components/LiveViewCounter';
import TypingIndicator, { TypingTextArea } from './components/TypingIndicator';

function PitchDetail({ pitchId }: { pitchId: number }) {
  const [comment, setComment] = useState('');
  
  return (
    <div className="pitch-detail">
      {/* Header with live view data */}
      <header className="flex items-center justify-between">
        <h1>Pitch Title</h1>
        <div className="flex items-center space-x-4">
          <LiveViewBadge pitchId={pitchId} />
          <LiveViewCounter 
            pitchId={pitchId}
            showUniqueViewers={true}
            showRecentViewers={true}
            animated={true}
          />
        </div>
      </header>
      
      {/* Pitch content */}
      <div className="pitch-content">
        {/* Content here */}
      </div>
      
      {/* View analytics */}
      <ViewAnalytics pitchId={pitchId} />
      
      {/* Comments with typing indicators */}
      <div className="comments">
        {/* Existing comments */}
        
        {/* Typing indicator */}
        <TypingIndicator conversationId={pitchId} />
        
        {/* Comment input with typing detection */}
        <TypingTextArea
          conversationId={pitchId}
          value={comment}
          onChange={setComment}
          placeholder="Add a comment..."
        />
      </div>
    </div>
  );
}
```

### 4. Auto-syncing Form Editor

```tsx
import { useDraftSync } from './hooks/useDraftSync';

function PitchEditor({ pitchId }: { pitchId: number }) {
  const {
    content,
    isDirty,
    isSaving,
    hasConflict,
    lastSaved,
    updateContent,
    save,
    resolveWithLocal,
    resolveWithRemote,
  } = useDraftSync({
    draftId: `pitch_${pitchId}`,
    draftType: 'pitch',
    autoSaveInterval: 5000,
    conflictResolution: 'ask',
    validateContent: (content) => content?.title && content?.description,
  });
  
  const [formData, setFormData] = useState({
    title: content?.title || '',
    description: content?.description || '',
  });
  
  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    updateContent(newData); // Auto-sync trigger
  };
  
  return (
    <div className="editor">
      {/* Sync status */}
      <div className="sync-status">
        {isSaving && <span>Saving...</span>}
        {isDirty && <span>Unsaved changes</span>}
        {lastSaved && <span>Last saved: {lastSaved.toLocaleTimeString()}</span>}
      </div>
      
      {/* Conflict resolution */}
      {hasConflict && (
        <div className="conflict-alert">
          <p>Sync conflict detected. Choose resolution:</p>
          <button onClick={resolveWithLocal}>Keep My Changes</button>
          <button onClick={resolveWithRemote}>Use Their Changes</button>
        </div>
      )}
      
      {/* Form fields */}
      <input
        value={formData.title}
        onChange={(e) => handleFieldChange('title', e.target.value)}
        placeholder="Pitch title..."
      />
      <textarea
        value={formData.description}
        onChange={(e) => handleFieldChange('description', e.target.value)}
        placeholder="Pitch description..."
      />
    </div>
  );
}
```

### 5. Real-time Messaging Interface

```tsx
import PresenceIndicator from './components/PresenceIndicator';
import { TypingInput } from './components/TypingIndicator';
import { useTyping } from './contexts/WebSocketContext';

function MessagingInterface({ conversationId }: { conversationId: number }) {
  const [message, setMessage] = useState('');
  const { subscribeToTyping } = useTyping(conversationId);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribeToTyping((typing) => {
      setTypingUsers(typing.filter(t => t.isTyping));
    });
    return unsubscribe;
  }, [subscribeToTyping]);
  
  return (
    <div className="messaging">
      {/* Messages list */}
      <div className="messages">
        {/* Render messages */}
        
        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="typing-indicators">
            {typingUsers.map(user => (
              <div key={user.userId} className="flex items-center space-x-2">
                <PresenceIndicator userId={user.userId} size="sm" />
                <span>{user.username} is typing...</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Message input with typing detection */}
      <TypingInput
        conversationId={conversationId}
        value={message}
        onChange={setMessage}
        onSubmit={(msg) => {
          // Send message logic
          setMessage('');
        }}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

### 6. Upload Progress Integration

```tsx
import { UploadProgressList, UploadProgressBadge } from './components/UploadProgress';

function FileUploadPage() {
  return (
    <div className="upload-page">
      {/* Header with upload status */}
      <header className="flex items-center justify-between">
        <h1>Upload Files</h1>
        <UploadProgressBadge />
      </header>
      
      {/* Upload area */}
      <div className="upload-area">
        {/* Drop zone or file input */}
      </div>
      
      {/* Real-time upload progress */}
      <UploadProgressList 
        position="relative"
        onCancel={(id) => cancelUpload(id)}
        onRetry={(id) => retryUpload(id)}
      />
    </div>
  );
}
```

## Available Hooks & Components

### Hooks

1. **`useWebSocket()`** - Main WebSocket context
2. **`useNotifications()`** - Notification management
3. **`useDashboardMetrics()`** - Live dashboard data
4. **`usePresence()`** - User presence tracking
5. **`useTyping(conversationId)`** - Typing indicators
6. **`useUploadProgress()`** - Upload tracking
7. **`usePitchViews(pitchId)`** - Live view counters
8. **`useDraftSync(options)`** - Auto-save functionality

### Components

1. **`NotificationDropdown`** - Real-time notifications
2. **`LiveMetrics`** - Dashboard metrics display
3. **`PresenceIndicator`** - Online/offline status
4. **`OnlineUsersList`** - List of online users
5. **`PresenceStatusSelector`** - Status selection
6. **`TypingIndicator`** - Shows who's typing
7. **`TypingInput`** - Input with typing detection
8. **`TypingTextArea`** - Textarea with typing detection
9. **`UploadProgressList`** - Upload progress display
10. **`UploadProgressBadge`** - Upload status badge
11. **`LiveViewCounter`** - Real-time view counts
12. **`ViewAnalytics`** - View analytics display
13. **`ViewerList`** - Recent viewers list
14. **`LiveViewBadge`** - Live viewing indicator

## WebSocket Message Types

The system handles these message types:

- `notification` - Real-time notifications
- `dashboard_update` - Live metrics updates
- `presence_update` - User status changes
- `typing` - Typing indicators
- `upload_progress` - File upload progress
- `pitch_view` - View count updates
- `draft_sync` - Draft synchronization

## Configuration Options

### WebSocket Provider Options

```tsx
<WebSocketProvider>
  {/* Automatic configuration based on auth state */}
</WebSocketProvider>
```

### Advanced Hook Configuration

```tsx
const draftSync = useDraftSync({
  draftId: 'unique-id',
  draftType: 'pitch',
  autoSaveInterval: 5000,      // 5 seconds
  maxReconnectAttempts: 10,
  conflictResolution: 'ask',   // 'local' | 'remote' | 'merge' | 'ask'
  enableLocalStorage: true,
  validateContent: (content) => !!content,
  onSave: (draft) => console.log('Saved'),
  onError: (error) => console.error(error),
});
```

## Error Handling

The WebSocket system includes comprehensive error handling:

1. **Connection Errors**: Automatic reconnection with exponential backoff
2. **Rate Limiting**: Message queuing when rate limits are hit
3. **Authentication Errors**: Automatic re-authentication attempts
4. **Network Issues**: Offline support with message persistence
5. **Sync Conflicts**: User-configurable conflict resolution

## Performance Considerations

1. **Message Queuing**: Up to 100 messages queued during disconnection
2. **Rate Limiting**: 120 messages per minute maximum
3. **Auto-save Interval**: Configurable (default 5 seconds)
4. **Connection Pooling**: Shared connection across components
5. **Memory Management**: Automatic cleanup on unmount

## Testing & Development

### Mock WebSocket for Development

```tsx
// In development, you can mock WebSocket functionality
const mockWebSocket = {
  isConnected: true,
  sendMessage: (msg) => console.log('Mock send:', msg),
  // ... other mock methods
};
```

### Debug Tools

1. **Connection Status**: Visual indicators in components
2. **Message Queue**: Status display in development
3. **Console Logging**: Detailed WebSocket activity logs
4. **Error Tracking**: Integration with Sentry for production

## Migration from Existing Components

### Step 1: Wrap App with WebSocket Provider

```tsx
// Before
<App />

// After
<WebSocketProvider>
  <App />
</WebSocketProvider>
```

### Step 2: Replace Static Components

```tsx
// Before: Static notification bell
<Bell className="w-6 h-6" />

// After: Real-time notification dropdown
<NotificationDropdown />
```

### Step 3: Add Real-time Features

```tsx
// Before: Static view count
<span>{viewCount} views</span>

// After: Live view counter
<LiveViewCounter pitchId={pitchId} animated={true} />
```

### Step 4: Enable Auto-sync

```tsx
// Before: Manual save only
const handleSave = () => {
  saveToAPI(formData);
};

// After: Auto-sync with manual save option
const { updateContent, save } = useDraftSync({
  draftId: 'form-id',
  draftType: 'pitch',
});

const handleFieldChange = (field, value) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  updateContent({ ...formData, [field]: value });
};
```

## Best Practices

1. **Use Specific Hooks**: Prefer `useNotifications()` over `useWebSocket()` for specific features
2. **Handle Offline States**: Always provide fallbacks for disconnected states
3. **Validate Content**: Always validate data before syncing
4. **Cleanup Subscriptions**: Use the returned unsubscribe functions
5. **Error Boundaries**: Wrap WebSocket components in error boundaries
6. **Performance**: Use `React.memo()` for frequently updating components

## Troubleshooting

### Common Issues

1. **Connection Fails**
   - Check JWT token validity
   - Verify WebSocket URL configuration
   - Check network connectivity

2. **Messages Not Syncing**
   - Verify authentication
   - Check rate limiting status
   - Review message format

3. **Auto-save Not Working**
   - Check `validateContent` function
   - Verify draft ID uniqueness
   - Review network connection

4. **Performance Issues**
   - Check subscription cleanup
   - Review component re-renders
   - Monitor memory usage

### Debug Commands

```javascript
// Check WebSocket status in browser console
window.pitcheyWS = {
  status: 'connected',
  queueSize: 0,
  lastMessage: {...}
};
```

## Deployment Notes

1. **Environment Variables**: Ensure WebSocket URLs are correct for production
2. **SSL/TLS**: Use `wss://` for production HTTPS sites
3. **Load Balancing**: Configure sticky sessions for WebSocket connections
4. **Monitoring**: Set up alerts for connection failures and high error rates

This integration guide provides everything needed to implement real-time features in the Pitchey frontend using the comprehensive WebSocket system.