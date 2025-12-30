import { useState, useEffect } from 'react';
import { config } from '../config';
import { useAuth } from './useAuth';

interface FeatureFlagCache {
  [key: string]: {
    evaluation: { enabled: boolean };
    timestamp: number;
  };
}

const flagCache: FeatureFlagCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useFeatureFlag(flagKey: string): {
  enabled: boolean;
  loading: boolean;
  error: Error | null;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const evaluateFlag = async () => {
      try {
        // Check cache first
        const cached = flagCache[flagKey];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setEnabled(cached.evaluation.enabled);
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/feature-flags/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flagKey,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role,
              subscription: user.subscription
            } : undefined
          }),
          credentials: 'include' // Send cookies for Better Auth session
        });

        if (!response.ok) {
          console.error('Failed to evaluate feature flag');
          setEnabled(false);
        } else {
          const evaluation = await response.json();
          setEnabled(evaluation.enabled);
          
          // Cache result
          flagCache[flagKey] = {
            evaluation,
            timestamp: Date.now()
          };
        }
      } catch (err) {
        console.error('Error evaluating feature flag:', err);
        setError(err as Error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    evaluateFlag();
  }, [flagKey, user]);

  return { enabled, loading, error };
}

export function useFeatureFlags(flagKeys: string[]): Record<string, boolean> {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  useEffect(() => {
    const evaluateFlags = async () => {
      try {
        const response = await fetch(`${API_URL}/api/feature-flags/evaluate-multiple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flagKeys,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role,
              subscription: user.subscription
            } : undefined
          }),
          credentials: 'include' // Send cookies for Better Auth session
        });

        if (!response.ok) {
          console.error('Failed to evaluate feature flags');
          return;
        }

        const evaluations = await response.json();
        const flagStates: Record<string, boolean> = {};

        for (const key of flagKeys) {
          flagStates[key] = evaluations[key]?.enabled || false;
        }

        setFlags(flagStates);
      } catch (err) {
        console.error('Error evaluating feature flags:', err);
      }
    };

    evaluateFlags();
  }, [flagKeys.join(','), user]);

  return flags;
}
            flagKey,
            userContext: user ? {
              userId: user.id,
              email: user.email,
              role: user.role
            } : undefined

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
