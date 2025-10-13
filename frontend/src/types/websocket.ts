export interface WebSocketMessage {
  type: string;
  data?: any;
  id?: string;
  timestamp?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
}

export interface MessageQueueStatus {
  queued: number;
  maxQueue: number;
  dropped: number;
  rateLimited: number;
}