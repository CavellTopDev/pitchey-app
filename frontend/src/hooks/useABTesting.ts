// React hooks for A/B testing
import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store/authStore';

// Types
export interface ExperimentAssignment {
  experimentId: number;
  experimentName: string;
  variantId: string;
  variantConfig: Record<string, any>;
  isActive: boolean;
}

export interface ExperimentEvent {
  experimentId: number;
  variantId: string;
  eventType: string;
  eventData?: {
    eventName?: string;
    eventValue?: number;
    properties?: Record<string, any>;
    url?: string;
    elementId?: string;
    elementText?: string;
  };
}

export interface UserContext {
  userId?: number;
  sessionId?: string;
  userType?: string;
  customProperties?: Record<string, any>;
}

interface ABTestingConfig {
  apiUrl?: string;
  sessionId?: string;
  autoTrack?: boolean;
  batchTracking?: boolean;
  batchSize?: number;
  batchInterval?: number;
}

class ABTestingClient {
  private config: Required<ABTestingConfig>;
  private assignments: Map<number, ExperimentAssignment> = new Map();
  private eventQueue: ExperimentEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private isInitialized = false;
  
  constructor(config: ABTestingConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || '/api/experiments',
      sessionId: config.sessionId || this.generateSessionId(),
      autoTrack: config.autoTrack ?? true,
      batchTracking: config.batchTracking ?? true,
      batchSize: config.batchSize || 10,
      batchInterval: config.batchInterval || 5000, // 5 seconds
    };

    if (this.config.batchTracking) {
      this.startBatchTimer();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private getUserContext(): UserContext {
    return {
      sessionId: this.config.sessionId,
      userType: 'anonymous', // Will be overridden with actual user data
    };
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flushEventQueue();
    }, this.config.batchInterval);
  }

  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.config.batchSize);
    
    try {
      await fetch(`${this.config.apiUrl}/track/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to flush event queue:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  async initialize(userContext?: UserContext): Promise<void> {
    if (this.isInitialized) return;

    try {
      const context = { ...this.getUserContext(), ...userContext };
      
      const response = await fetch(`${this.config.apiUrl}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userContext: context }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          result.data.forEach((assignment: ExperimentAssignment) => {
            this.assignments.set(assignment.experimentId, assignment);
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize A/B testing client:', error);
    }

    this.isInitialized = true;
  }

  async getAssignment(experimentId: number, userContext?: UserContext): Promise<ExperimentAssignment | null> {
    // Check cache first
    if (this.assignments.has(experimentId)) {
      return this.assignments.get(experimentId)!;
    }

    try {
      const context = { ...this.getUserContext(), ...userContext };
      
      const response = await fetch(`${this.config.apiUrl}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          experimentIds: [experimentId],
          userContext: context 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          const assignment = result.data[0];
          this.assignments.set(experimentId, assignment);
          return assignment;
        }
      }
    } catch (error) {
      console.error('Failed to get experiment assignment:', error);
    }

    return null;
  }

  async trackEvent(event: ExperimentEvent, userContext?: UserContext): Promise<void> {
    const eventWithContext = {
      ...event,
      userContext: { ...this.getUserContext(), ...userContext },
    };

    if (this.config.batchTracking) {
      this.eventQueue.push(eventWithContext);
      
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flushEventQueue();
      }
    } else {
      try {
        await fetch(`${this.config.apiUrl}/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventWithContext),
        });
      } catch (error) {
        console.error('Failed to track event:', error);
      }
    }
  }

  async getFeatureFlag<T = any>(
    flagKey: string, 
    defaultValue: T, 
    userContext?: UserContext
  ): Promise<T> {
    try {
      const context = { ...this.getUserContext(), ...userContext };
      
      const response = await fetch(`${this.config.apiUrl}/feature-flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          flagKey,
          defaultValue,
          userContext: context 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.data.value;
        }
      }
    } catch (error) {
      console.error('Failed to get feature flag:', error);
    }

    return defaultValue;
  }

  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flushEventQueue(); // Send remaining events
  }
}

// Global client instance
let abTestingClient: ABTestingClient | null = null;

function getClient(config?: ABTestingConfig): ABTestingClient {
  if (!abTestingClient) {
    abTestingClient = new ABTestingClient(config);
  }
  return abTestingClient;
}

// Hook to get experiment assignment and variant
export function useExperiment(experimentId: number, options: {
  autoTrackPageView?: boolean;
  trackingProperties?: Record<string, any>;
} = {}) {
  const [assignment, setAssignment] = useState<ExperimentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useStore();
  const hasTrackedPageView = useRef(false);

  const client = getClient();

  // Get user context
  const getUserContext = useCallback((): UserContext => {
    return {
      userId: user?.id,
      userType: user?.userType || 'anonymous',
      customProperties: options.trackingProperties,
    };
  }, [user, options.trackingProperties]);

  // Initialize and get assignment
  useEffect(() => {
    async function loadAssignment() {
      setLoading(true);
      setError(null);

      try {
        await client.initialize(getUserContext());
        const result = await client.getAssignment(experimentId, getUserContext());
        setAssignment(result);

        // Auto-track page view
        if (result && options.autoTrackPageView && !hasTrackedPageView.current) {
          await client.trackEvent({
            experimentId: result.experimentId,
            variantId: result.variantId,
            eventType: 'page_view',
            eventData: {
              url: window.location.pathname,
              properties: options.trackingProperties,
            },
          }, getUserContext());
          hasTrackedPageView.current = true;
        }
      } catch (err) {
        console.error('Error loading experiment assignment:', err);
        setError(err instanceof Error ? err.message : 'Failed to load experiment');
      } finally {
        setLoading(false);
      }
    }

    loadAssignment();
  }, [experimentId, client, getUserContext, options.autoTrackPageView, options.trackingProperties]);

  // Track event function
  const track = useCallback(async (
    eventType: string, 
    eventData?: ExperimentEvent['eventData']
  ) => {
    if (!assignment) return;

    await client.trackEvent({
      experimentId: assignment.experimentId,
      variantId: assignment.variantId,
      eventType,
      eventData,
    }, getUserContext());
  }, [assignment, client, getUserContext]);

  return {
    assignment,
    variantId: assignment?.variantId,
    variantConfig: assignment?.variantConfig,
    isActive: assignment?.isActive || false,
    loading,
    error,
    track,
  };
}

// Hook to get a specific variant value
export function useVariant<T = any>(
  experimentId: number,
  configKey: string,
  defaultValue: T
): {
  value: T;
  variantId: string | null;
  loading: boolean;
  error: string | null;
} {
  const { assignment, variantId, loading, error } = useExperiment(experimentId);

  const value = assignment?.variantConfig?.[configKey] ?? defaultValue;

  return {
    value,
    variantId,
    loading,
    error,
  };
}

// Hook to check if user is in experiment
export function useIsInExperiment(experimentId: number): {
  isInExperiment: boolean;
  variantId: string | null;
  loading: boolean;
} {
  const { assignment, variantId, loading } = useExperiment(experimentId, {
    autoTrackPageView: false,
  });

  return {
    isInExperiment: !!assignment,
    variantId,
    loading,
  };
}

// Hook for feature flags
export function useFeatureFlag<T = any>(
  flagKey: string, 
  defaultValue: T
): {
  value: T;
  loading: boolean;
  error: string | null;
} {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useStore();

  const client = getClient();

  useEffect(() => {
    async function loadFeatureFlag() {
      setLoading(true);
      setError(null);

      try {
        const userContext: UserContext = {
          userId: user?.id,
          userType: user?.userType || 'anonymous',
        };

        const result = await client.getFeatureFlag(flagKey, defaultValue, userContext);
        setValue(result);
      } catch (err) {
        console.error('Error loading feature flag:', err);
        setError(err instanceof Error ? err.message : 'Failed to load feature flag');
      } finally {
        setLoading(false);
      }
    }

    loadFeatureFlag();
  }, [flagKey, defaultValue, user, client]);

  return {
    value,
    loading,
    error,
  };
}

// Hook for A/B testing analytics
export function useExperimentTracking() {
  const client = getClient();
  const { user } = useStore();

  const getUserContext = useCallback((): UserContext => {
    return {
      userId: user?.id,
      userType: user?.userType || 'anonymous',
    };
  }, [user]);

  const trackEvent = useCallback(async (
    experimentId: number,
    variantId: string,
    eventType: string,
    eventData?: ExperimentEvent['eventData']
  ) => {
    await client.trackEvent({
      experimentId,
      variantId,
      eventType,
      eventData,
    }, getUserContext());
  }, [client, getUserContext]);

  const trackConversion = useCallback(async (
    experimentId: number,
    variantId: string,
    value?: number,
    properties?: Record<string, any>
  ) => {
    await trackEvent(experimentId, variantId, 'conversion', {
      eventValue: value,
      properties,
    });
  }, [trackEvent]);

  const trackClick = useCallback(async (
    experimentId: number,
    variantId: string,
    elementId?: string,
    elementText?: string
  ) => {
    await trackEvent(experimentId, variantId, 'click', {
      elementId,
      elementText,
      url: window.location.pathname,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackConversion,
    trackClick,
  };
}

// Provider component for A/B testing context
export function ABTestingProvider({ 
  children, 
  config 
}: { 
  children: React.ReactNode;
  config?: ABTestingConfig;
}) {
  useEffect(() => {
    // Initialize client with config
    getClient(config);

    return () => {
      // Cleanup on unmount
      if (abTestingClient) {
        abTestingClient.destroy();
        abTestingClient = null;
      }
    };
  }, [config]);

  return <>{children}</>;
}