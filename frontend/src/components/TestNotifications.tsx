import React from 'react';
import { useNotificationToast } from './Toast/NotificationToastContainer';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * Test component to verify notification system functionality
 * Only visible in development mode
 */
export function TestNotifications() {
  const toast = useNotificationToast();
  const { sendMessage, isConnected } = useWebSocket();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const testNotifications = [
    {
      label: 'Test NDA Request',
      action: () => toast.notifyNDARequest('Amazing Sci-Fi Thriller', 'John Producer', 123)
    },
    {
      label: 'Test NDA Approved',
      action: () => toast.notifyNDAApproved('Amazing Sci-Fi Thriller')
    },
    {
      label: 'Test Investment',
      action: () => toast.notifyNewInvestment(50000, 'Amazing Sci-Fi Thriller')
    },
    {
      label: 'Test New Message',
      action: () => toast.notifyNewMessage('Sarah Investor', 'Hi! I loved your pitch and would like to discuss...', 456)
    },
    {
      label: 'Test Pitch Viewed',
      action: () => toast.notifyPitchViewed('Amazing Sci-Fi Thriller', 'Michael Production')
    },
    {
      label: 'Test New Follower',
      action: () => toast.notifyFollowReceived('Alice Creator', 789)
    },
    {
      label: 'Test Success Toast',
      action: () => toast.success('Success!', 'This is a success notification')
    },
    {
      label: 'Test Error Toast',
      action: () => toast.error('Error!', 'This is an error notification')
    },
    {
      label: 'Test Warning Toast',
      action: () => toast.warning('Warning!', 'This is a warning notification')
    },
    {
      label: 'Test Info Toast',
      action: () => toast.info('Info', 'This is an info notification')
    }
  ];

  const testWebSocketNotification = () => {
    if (!isConnected) {
      toast.error('WebSocket not connected', 'Please ensure WebSocket connection is active');
      return;
    }

    sendMessage({
      type: 'notification',
      data: {
        type: 'test',
        title: 'Test WebSocket Notification',
        message: 'This notification was sent via WebSocket',
        timestamp: new Date().toISOString()
      }
    });
  };

  return (
    <div className="fixed bottom-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-w-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">🔔 Test Notifications</h3>
      
      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-2">
          WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </div>
        <button
          onClick={testWebSocketNotification}
          disabled={!isConnected}
          className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Test WebSocket Notification
        </button>
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {testNotifications.map((test, index) => (
          <button
            key={index}
            onClick={test.action}
            className="w-full text-left px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            {test.label}
          </button>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Only visible in development
      </div>
    </div>
  );
}