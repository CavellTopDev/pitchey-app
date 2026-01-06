import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Reset any test state after each test
afterEach(() => {
  cleanup()
})

// Real API environment variables for testing
Object.defineProperty(window, 'ENV', {
  value: {
    VITE_API_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    VITE_WS_URL: 'wss://pitchey-api-prod.ndlovucavelle.workers.dev',
  },
  writable: true,
})

// Set environment variables for Vite
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    VITE_WS_URL: 'wss://pitchey-api-prod.ndlovucavelle.workers.dev',
    MODE: 'test',
    DEV: false,
    PROD: true,
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
    // Mock send implementation
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