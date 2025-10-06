import * as Sentry from '@sentry/react';

// Test component to verify Sentry integration
export function TestSentryButton() {
  const testError = () => {
    throw new Error('Test error from React - Sentry is working!');
  };

  const testMessage = () => {
    Sentry.captureMessage('Test message from React frontend', 'info');
    alert('Test message sent to Sentry! Check your dashboard.');
  };

  const testUserContext = () => {
    Sentry.setUser({
      id: "test-user-123",
      email: "test@pitchey.com",
      username: "testuser"
    });
    Sentry.captureMessage('User context set', 'info');
    alert('User context sent to Sentry!');
  };

  if (import.meta.env.VITE_NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 bg-white p-4 rounded-lg shadow-lg border">
      <h3 className="text-sm font-bold mb-2">Sentry Test (Dev Only)</h3>
      <button
        onClick={testMessage}
        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
      >
        Send Test Message
      </button>
      <button
        onClick={testUserContext}
        className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
      >
        Set User Context
      </button>
      <button
        onClick={testError}
        className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
      >
        Trigger Test Error
      </button>
    </div>
  );
}