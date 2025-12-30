#!/bin/bash

FILE="src/hooks/useFeatureFlag.ts"

echo "Fixing useFeatureFlag.ts..."

# First, remove all duplicate credentials lines
sed -i '/^\s*credentials: .include., \/\/ Send cookies for Better Auth session$/d' "$FILE"

# Remove orphaned method: 'POST', lines
sed -i '/^\s*method: .POST.,$/d' "$FILE"

# Remove orphaned headers lines
sed -i '/^\s*headers: {$/d' "$FILE"
sed -i '/^\s*.*Authorization.*Bearer.*$/d' "$FILE"

# Remove duplicate closing brackets
sed -i '/^\s*})$/d' "$FILE"
sed -i '/^\s*});$/d' "$FILE"

# Now manually reconstruct the fetch calls
cat > temp_fix.ts << 'INNEREOF'
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

        const response = await fetch(`${config.API_URL}/api/feature-flags/evaluate`, {
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
        const response = await fetch(`${config.API_URL}/api/feature-flags/evaluate-multiple`, {
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
INNEREOF

# Keep only the necessary parts that are not duplicated
tail -n +250 "$FILE" | grep -v "const response = await fetch" | grep -v "credentials: 'include'" > temp_tail.ts

# Combine the fixed top part with the remaining unique code
cat temp_fix.ts > "$FILE"
cat temp_tail.ts >> "$FILE"

# Clean up temp files
rm temp_fix.ts temp_tail.ts

echo "Fixed useFeatureFlag.ts"
