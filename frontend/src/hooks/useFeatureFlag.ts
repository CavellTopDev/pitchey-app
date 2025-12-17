/**
 * useFeatureFlag Hook
 * React hook for evaluating and using feature flags in components
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface FlagEvaluation {
  enabled: boolean;
  variant?: string;
  reason: string;
  metadata?: Record<string, any>;
}

interface FeatureFlagContextValue {
  flags: Record<string, FlagEvaluation>;
  isLoading: boolean;
  error: Error | null;
  checkFlag: (key: string) => boolean;
  getVariant: (key: string) => string | undefined;
  refresh: () => Promise<void>;
}

// Cache for feature flag evaluations
const flagCache = new Map<string, { evaluation: FlagEvaluation; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Hook to check if a single feature flag is enabled
 */
export function useFeatureFlag(flagKey: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const evaluateFlag = async () => {
      try {
        // Check cache first
        const cached = flagCache.get(flagKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setEnabled(cached.evaluation.enabled);
          setLoading(false);
          return;
        }

        const response = await fetch('/api/feature-flags/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            flagKey,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role,
              subscription: user.subscription
            } : undefined
          })
        });

        if (!response.ok) {
          console.error('Failed to evaluate feature flag');
          setEnabled(false);
          return;
        }

        const evaluation: FlagEvaluation = await response.json();
        
        // Update cache
        flagCache.set(flagKey, { evaluation, timestamp: Date.now() });
        
        setEnabled(evaluation.enabled);
      } catch (error) {
        console.error('Error evaluating feature flag:', error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    evaluateFlag();
  }, [flagKey, user]);

  return enabled;
}

/**
 * Hook to get multiple feature flags at once
 */
export function useFeatureFlags(flagKeys: string[]): Record<string, boolean> {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const evaluateFlags = async () => {
      try {
        const response = await fetch('/api/feature-flags/evaluate-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            flagKeys,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role,
              subscription: user.subscription
            } : undefined
          })
        });

        if (!response.ok) {
          console.error('Failed to evaluate feature flags');
          return;
        }

        const evaluations = await response.json();
        const flagStates: Record<string, boolean> = {};

        for (const key of flagKeys) {
          if (evaluations[key]) {
            flagStates[key] = evaluations[key].enabled;
            // Update cache
            flagCache.set(key, {
              evaluation: evaluations[key],
              timestamp: Date.now()
            });
          } else {
            flagStates[key] = false;
          }
        }

        setFlags(flagStates);
      } catch (error) {
        console.error('Error evaluating feature flags:', error);
        // Set all flags to false on error
        const flagStates: Record<string, boolean> = {};
        flagKeys.forEach(key => { flagStates[key] = false; });
        setFlags(flagStates);
      } finally {
        setLoading(false);
      }
    };

    evaluateFlags();
  }, [JSON.stringify(flagKeys), user]);

  return flags;
}

/**
 * Hook to get all user flags with WebSocket updates
 */
export function useAllFeatureFlags(): FeatureFlagContextValue {
  const [flags, setFlags] = useState<Record<string, FlagEvaluation>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/feature-flags/user-flags', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user flags');
      }

      const data = await response.json();
      setFlags(data);
      
      // Update cache
      Object.entries(data).forEach(([key, evaluation]) => {
        flagCache.set(key, {
          evaluation: evaluation as FlagEvaluation,
          timestamp: Date.now()
        });
      });
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching user flags:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Setup WebSocket for real-time updates
    const ws = new WebSocket(`wss://${window.location.host}/api/feature-flags/ws`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'flag_updated') {
        refresh(); // Refresh flags on update
      }
    };

    return () => {
      ws.close();
    };
  }, [refresh]);

  const checkFlag = useCallback((key: string): boolean => {
    return flags[key]?.enabled || false;
  }, [flags]);

  const getVariant = useCallback((key: string): string | undefined => {
    return flags[key]?.variant;
  }, [flags]);

  return {
    flags,
    isLoading,
    error,
    checkFlag,
    getVariant,
    refresh
  };
}

/**
 * Hook for A/B testing with variants
 */
export function useABTest(flagKey: string): {
  variant: string | null;
  isLoading: boolean;
} {
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const evaluateABTest = async () => {
      try {
        const response = await fetch('/api/feature-flags/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            flagKey,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role
            } : undefined
          })
        });

        if (!response.ok) {
          console.error('Failed to evaluate A/B test');
          setVariant(null);
          return;
        }

        const evaluation: FlagEvaluation = await response.json();
        setVariant(evaluation.variant || null);
      } catch (error) {
        console.error('Error evaluating A/B test:', error);
        setVariant(null);
      } finally {
        setIsLoading(false);
      }
    };

    evaluateABTest();
  }, [flagKey, user]);

  return { variant, isLoading };
}

/**
 * Component wrapper for feature flags
 */
export function FeatureFlag({ 
  flag, 
  children, 
  fallback = null 
}: {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const enabled = useFeatureFlag(flag);
  
  return enabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component wrapper for A/B tests
 */
export function ABTest({ 
  flag, 
  variants,
  fallback = null 
}: {
  flag: string;
  variants: Record<string, React.ReactNode>;
  fallback?: React.ReactNode;
}) {
  const { variant, isLoading } = useABTest(flag);
  
  if (isLoading) return <>{fallback}</>;
  if (!variant || !variants[variant]) return <>{fallback}</>;
  
  return <>{variants[variant]}</>;
}