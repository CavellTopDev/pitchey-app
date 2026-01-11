/**
 * WebSocket Mock Implementation
 * Matches production WebSocket behavior
 */

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.readyState = MockWebSocket.CONNECTING;
    this.url = url;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    const parsed = JSON.parse(data);
    
    // Match production event structure
    const response = {
      type: parsed.type,
      eventType: `${parsed.type}.${parsed.action || 'response'}`, // Added in production
      data: parsed.data,
      timestamp: new Date().toISOString() // Added in production
    };

    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: JSON.stringify(response)
        }));
      }
    }, 10);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) this.onclose(new CloseEvent('close'));
    }, 10);
  }
}