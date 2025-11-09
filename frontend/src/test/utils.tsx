import React, { type ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { WebSocketProvider } from '../contexts/WebSocketContext'
import { NotificationToastProvider } from '../components/Toast/NotificationToastContainer'
import { vi } from 'vitest'

// Mock WebSocket + Notifications context to avoid real sockets in tests
vi.mock('../contexts/WebSocketContext', () => {
  const React = require('react')
  const fakeContextValue = {
    // Connection state
    connectionStatus: { status: 'disconnected', reconnectAttempts: 0 },
    queueStatus: { size: 0, dropped: 0 },
    isConnected: false,
    // Real-time data
    notifications: [],
    dashboardMetrics: null,
    onlineUsers: [],
    typingIndicators: [],
    uploadProgress: [],
    pitchViews: new Map(),
    // Actions
    sendMessage: vi.fn(() => true),
    markNotificationAsRead: vi.fn(),
    clearAllNotifications: vi.fn(),
    updatePresence: vi.fn(),
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    trackPitchView: vi.fn(),
    // Connection control
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearQueue: vi.fn(),
    // Emergency controls
    disableWebSocket: vi.fn(),
    enableWebSocket: vi.fn(),
    isWebSocketDisabled: true,
    // Subscriptions
    subscribeToNotifications: vi.fn(() => () => {}),
    subscribeToDashboard: vi.fn(() => () => {}),
    subscribeToPresence: vi.fn(() => () => {}),
    subscribeToTyping: vi.fn(() => () => {}),
    subscribeToUploads: vi.fn(() => () => {}),
    subscribeToPitchViews: vi.fn(() => () => {}),
    subscribeToMessages: vi.fn(() => () => {}),
    // Notification permission
    requestNotificationPermission: vi.fn(async () => 'denied'),
  }
  return {
    WebSocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useWebSocket: () => fakeContextValue,
    useNotifications: () => ({
      notifications: [],
      markNotificationAsRead: vi.fn(),
      clearAllNotifications: vi.fn(),
      subscribeToNotifications: vi.fn(() => () => {}),
    }),
  }
})

// Mock Zustand stores
const mockAuthStore = {
  user: null,
  token: null,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
}

const mockPitchStore = {
  pitches: [],
  currentPitch: null,
  loading: false,
  error: null,
  fetchPitches: vi.fn(),
  createPitch: vi.fn(),
  updatePitch: vi.fn(),
  deletePitch: vi.fn(),
  setPitches: vi.fn(),
  setCurrentPitch: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
}

// Mock stores
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('../store/pitchStore', () => ({
  usePitchStore: () => mockPitchStore,
}))

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'creator',
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockPitch = (overrides = {}) => ({
  id: '1',
  title: 'Test Pitch',
  description: 'A test pitch description',
  genre: 'Drama',
  duration: 120,
  budget: 1000000,
  format: 'Feature Film',
  status: 'published',
  creator: createMockUser(),
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isPublic: true,
  ndaRequired: false,
  themes: ['Action', 'Adventure'],
  characters: [],
  documents: [],
  ...overrides,
})

export const createMockNDARequest = (overrides = {}) => ({
  id: '1',
  pitchId: '1',
  investorId: '2',
  status: 'pending',
  requestedAt: '2024-01-01T00:00:00Z',
  investor: {
    id: '2',
    name: 'Test Investor',
    email: 'investor@example.com',
    company: 'Test Investment Co.',
  },
  ...overrides,
})

export const createMockCharacter = (overrides = {}) => ({
  id: '1',
  name: 'Test Character',
  description: 'A test character description',
  age: 25,
  role: 'protagonist',
  importance: 'main',
  ...overrides,
})

// Mock WebSocket context
const MockWebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const mockWebSocketValue = {
    socket: null,
    isConnected: false,
    lastMessage: null,
    connectionError: null,
    reconnectAttempts: 0,
    sendMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }

  return (
    <WebSocketProvider value={mockWebSocketValue}>
      {children}
    </WebSocketProvider>
  )
}

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <MockWebSocketProvider>
        <NotificationToastProvider>
          {children}
        </NotificationToastProvider>
      </MockWebSocketProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Helper functions
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  })

  return mockStorage
}

export const mockSessionStorage = () => {
  const store: Record<string, string> = {}
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }

  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  })

  return mockStorage
}

export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

// Custom assertions
export const expectElementToBeVisible = (element: HTMLElement) => {
  expect(element).toBeInTheDocument()
  expect(element).toBeVisible()
}

export const expectElementToHaveAccessibleName = (
  element: HTMLElement,
  name: string
) => {
  expect(element).toHaveAccessibleName(name)
}

// Store getters for testing
export const getMockAuthStore = () => mockAuthStore
export const getMockPitchStore = () => mockPitchStore

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }