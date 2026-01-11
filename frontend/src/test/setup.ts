import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Reset any test state after each test
afterEach(() => {
  cleanup()
})

// Mock API environment variables for testing
Object.defineProperty(window, 'ENV', {
  value: {
    VITE_API_URL: 'http://mock-api-test.local',
    VITE_WS_URL: 'ws://mock-ws-test.local',
  },
  writable: true,
})

// Set environment variables for Vite
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://mock-api-test.local',
    VITE_WS_URL: 'ws://mock-ws-test.local',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
    BASE_URL: '/'
  },
  writable: true,
})

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 0)
  }

  send(data: string) {
    // Mock send implementation with production-like response
    try {
      const parsed = JSON.parse(data);
      // Simulate production WebSocket response structure
      setTimeout(() => {
        const response = {
          type: parsed.type || 'response',
          eventType: `${parsed.type || 'message'}.${parsed.action || 'response'}`,
          data: parsed.data,
          timestamp: new Date().toISOString(),
          metadata: { messageId: 'mock-' + Date.now() }
        };
        this.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify(response)
        }));
      }, 10);
    } catch (e) {
      // Handle invalid JSON
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

// Mock window.alert for NDA tests
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true,
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

// Mock Sentry
const mockSentry = {
  setUser: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  startTransaction: vi.fn(() => ({
    finish: vi.fn(),
    setTag: vi.fn(),
    setData: vi.fn(),
  })),
  getCurrentHub: vi.fn(() => ({
    getScope: vi.fn(() => ({
      setTag: vi.fn(),
      setUser: vi.fn(),
      setLevel: vi.fn(),
      setContext: vi.fn(),
    })),
  })),
}

// Make Sentry globally available
Object.defineProperty(global, 'Sentry', {
  value: mockSentry,
  writable: true,
})

// Mock fetch to prevent real network calls in tests
const mockFetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
  // Mock successful responses with production-like structure
  const baseUrl = url.toString().replace('http://mock-api-test.local', '')
  
  // Default mock response
  const mockResponse = {
    success: true,
    data: [],
    message: 'Mock response',
    pagination: { total: 0, page: 1, limit: 10 }
  }
  
  // Route-specific mocks
  if (baseUrl.includes('/api/creator/pitches')) {
    mockResponse.data = [{
      id: 'mock-pitch-uuid',
      title: 'Mock Pitch',
      budget: '1000000',
      creator: { id: 'mock-creator-uuid', name: 'Mock Creator', company: 'Mock Co' },
      status: 'published',
      viewCount: 0,
      createdAt: new Date().toISOString(),
      genres: ['Drama']
    }]
  }
  
  if (baseUrl.includes('/api/auth/session')) {
    return new Response(JSON.stringify({
      user: {
        id: 'mock-user-uuid',
        email: 'test@mock.com',
        name: 'Mock User',
        portalType: 'creator',
        company: 'Mock Company',
        createdAt: new Date().toISOString()
      },
      session: {
        id: 'mock-session-uuid',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response(JSON.stringify(mockResponse), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})

global.fetch = mockFetch