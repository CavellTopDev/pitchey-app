// Real-time WebSocket integration for A/B testing updates
import { API_URL } from '../config';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

// Types for A/B testing WebSocket messages
export interface ABTestingWebSocketMessage {
  type: 'experiment_started' | 'experiment_paused' | 'experiment_completed' | 'experiment_results_updated' | 'assignment_updated';
  payload: {
    experimentId: number;
    experimentName?: string;
    status?: string;
    results?: any;
    assignment?: any;
    timestamp: string;
  };
}

export interface ExperimentUpdate {
  experimentId: number;
  type: 'status_change' | 'results_update' | 'assignment_change';
  data: any;
  timestamp: string;
}

// Hook for real-time A/B testing updates
export function useABTestingWebSocket(options: {
  experimentIds?: number[];
  onExperimentUpdate?: (update: ExperimentUpdate) => void;
  autoReconnect?: boolean;
} = {}) {
  const [experimentUpdates, setExperimentUpdates] = useState<ExperimentUpdate[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: any) => {
    try {
      if (message.type && message.type.startsWith('experiment_') || message.type === 'assignment_updated') {
        const abMessage = message as ABTestingWebSocketMessage;
        const { experimentId } = abMessage.payload;

        // Filter messages for subscribed experiments
        if (optionsRef.current.experimentIds && optionsRef.current.experimentIds.length > 0) {
          if (!optionsRef.current.experimentIds.includes(experimentId)) {
            return;
          }
        }

        // Create experiment update
        const update: ExperimentUpdate = {
          experimentId,
          type: getUpdateType(abMessage.type),
          data: abMessage.payload,
          timestamp: abMessage.payload.timestamp
        };

        // Add to updates list
        setExperimentUpdates(prev => {
          const newUpdates = [update, ...prev].slice(0, 100); // Keep last 100 updates
          return newUpdates;
        });

        // Call callback if provided
        if (optionsRef.current.onExperimentUpdate) {
          optionsRef.current.onExperimentUpdate(update);
        }
      }
    } catch (error) {
      console.error('Error processing A/B testing WebSocket message:', error);
    }
  }, []);

  // Handle connection status changes
  const handleStatusChange = useCallback((status: string) => {
    setConnectionStatus(status as any);
  }, []);

  // Use WebSocket hook with A/B testing specific handlers
  const { sendMessage, connectionState } = useWebSocket({
    onMessage: handleMessage,
    onStatusChange: handleStatusChange,
    autoReconnect: options.autoReconnect ?? true,
  });

  // Subscribe to experiment updates when connected
  useEffect(() => {
    if (connectionState === 'connected' && options.experimentIds) {
      sendMessage({
        type: 'subscribe_ab_testing',
        payload: {
          experimentIds: options.experimentIds
        }
      });
    }
  }, [connectionState, options.experimentIds, sendMessage]);

  // Clear updates when experiment IDs change
  useEffect(() => {
    setExperimentUpdates([]);
  }, [options.experimentIds]);

  return {
    experimentUpdates,
    connectionStatus,
    clearUpdates: () => setExperimentUpdates([]),
    isConnected: connectionStatus === 'connected'
  };
}

// Hook for real-time experiment results
export function useRealTimeResults(experimentId: number, options: {
  refreshInterval?: number;
  onSignificantResult?: (results: any) => void;
} = {}) {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Handle experiment updates via WebSocket
  const handleExperimentUpdate = useCallback((update: ExperimentUpdate) => {
    if (update.experimentId === experimentId && update.type === 'results_update') {
      setResults(update.data.results);
      setLastUpdate(update.timestamp);

      // Call callback for significant results
      if (options.onSignificantResult && update.data.results?.isStatisticallySignificant) {
        options.onSignificantResult(update.data.results);
      }
    }
  }, [experimentId, options.onSignificantResult]);

  // Subscribe to WebSocket updates
  const { connectionStatus } = useABTestingWebSocket({
    experimentIds: [experimentId],
    onExperimentUpdate: handleExperimentUpdate,
    autoReconnect: true
  });

  // Fetch initial results
  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await response.json();
      if (data.success) {
        setResults(data.data);
        setLastUpdate(new Date().toISOString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  // Initial fetch
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Periodic refresh fallback
  useEffect(() => {
    if (options.refreshInterval && options.refreshInterval > 0) {
      const interval = setInterval(fetchResults, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchResults, options.refreshInterval]);

  return {
    results,
    loading,
    error,
    lastUpdate,
    connectionStatus,
    refresh: fetchResults
  };
}

// Hook for real-time experiment list updates
export function useRealTimeExperimentList(options: {
  status?: string[];
  onExperimentStatusChange?: (experimentId: number, newStatus: string) => void;
} = {}) {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle experiment updates
  const handleExperimentUpdate = useCallback((update: ExperimentUpdate) => {
    if (update.type === 'status_change') {
      setExperiments(prev => 
        prev.map(exp => 
          exp.id === update.experimentId 
            ? { ...exp, status: update.data.status, updatedAt: update.timestamp }
            : exp
        )
      );

      // Call status change callback
      if (options.onExperimentStatusChange) {
        options.onExperimentStatusChange(update.experimentId, update.data.status);
      }
    }
  }, [options.onExperimentStatusChange]);

  // Subscribe to all experiment updates
  const { connectionStatus } = useABTestingWebSocket({
    onExperimentUpdate: handleExperimentUpdate,
    autoReconnect: true
  });

  // Fetch initial experiment list
  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams();
        
        if (options.status) {
          options.status.forEach(status => queryParams.append('status', status));
        }

    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

        if (response.ok) {
          const data = await response.json();
          setExperiments(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch experiments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiments();
  }, [options.status]);

  return {
    experiments,
    loading,
    connectionStatus
  };
}

// Hook for experiment progress tracking
export function useExperimentProgress(experimentId: number) {
  const [progress, setProgress] = useState({
    currentParticipants: 0,
    targetParticipants: 0,
    progressPercentage: 0,
    estimatedCompletion: null as string | null,
    isOnTrack: true
  });

  const { results } = useRealTimeResults(experimentId, {
    refreshInterval: 30000 // Update every 30 seconds
  });

  // Update progress when results change
  useEffect(() => {
    if (results) {
      const currentParticipants = results.totalParticipants || 0;
      const targetParticipants = results.targetParticipants || currentParticipants;
      const progressPercentage = targetParticipants > 0 
        ? Math.min((currentParticipants / targetParticipants) * 100, 100)
        : 0;

      setProgress({
        currentParticipants,
        targetParticipants,
        progressPercentage,
        estimatedCompletion: results.estimatedCompletion || null,
        isOnTrack: results.isOnTrack ?? true
      });
    }
  }, [results]);

  return progress;
}

// Helper function to map WebSocket message types to update types
function getUpdateType(messageType: ABTestingWebSocketMessage['type']): ExperimentUpdate['type'] {
  switch (messageType) {
    case 'experiment_started':
    case 'experiment_paused':
    case 'experiment_completed':
      return 'status_change';
    case 'experiment_results_updated':
      return 'results_update';
    case 'assignment_updated':
      return 'assignment_change';
    default:
      return 'status_change';
  }
}

// Real-time notification hook for significant results
export function useABTestingNotifications(options: {
  experimentIds?: number[];
  onSignificantResult?: (experiment: any) => void;
  onExperimentComplete?: (experiment: any) => void;
} = {}) {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'significant_result' | 'experiment_complete' | 'experiment_started';
    experimentId: number;
    experimentName: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>>([]);

  const handleExperimentUpdate = useCallback((update: ExperimentUpdate) => {
    let notification = null;

    if (update.type === 'results_update' && update.data.results?.isStatisticallySignificant) {
      notification = {
        id: `${update.experimentId}-significant-${Date.now()}`,
        type: 'significant_result' as const,
        experimentId: update.experimentId,
        experimentName: update.data.experimentName || `Experiment ${update.experimentId}`,
        message: `Experiment "${update.data.experimentName}" has reached statistical significance!`,
        timestamp: update.timestamp,
        read: false
      };

      if (options.onSignificantResult) {
        options.onSignificantResult(update.data);
      }
    } else if (update.type === 'status_change' && update.data.status === 'completed') {
      notification = {
        id: `${update.experimentId}-complete-${Date.now()}`,
        type: 'experiment_complete' as const,
        experimentId: update.experimentId,
        experimentName: update.data.experimentName || `Experiment ${update.experimentId}`,
        message: `Experiment "${update.data.experimentName}" has been completed.`,
        timestamp: update.timestamp,
        read: false
      };

      if (options.onExperimentComplete) {
        options.onExperimentComplete(update.data);
      }
    }

    if (notification) {
      setNotifications(prev => [notification!, ...prev].slice(0, 50)); // Keep last 50 notifications
    }
  }, [options.onSignificantResult, options.onExperimentComplete]);

  const { connectionStatus } = useABTestingWebSocket({
    experimentIds: options.experimentIds,
    onExperimentUpdate: handleExperimentUpdate,
    autoReconnect: true
  });

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    connectionStatus,
    markAsRead,
    clearNotifications
  };
}

export default useABTestingWebSocket;