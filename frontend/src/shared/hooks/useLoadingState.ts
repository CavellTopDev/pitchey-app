import { useState, useCallback, useEffect, useRef } from 'react';

export type LoadingStateType = 'idle' | 'logging-in' | 'logging-out' | 'switching-portal' | 'loading-data';

interface LoadingState {
  type: LoadingStateType;
  isLoading: boolean;
  message?: string;
  timeoutId?: NodeJS.Timeout;
}

interface UseLoadingStateOptions {
  timeout?: number; // Default 30 seconds
  onTimeout?: () => void;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { timeout = 30000, onTimeout } = options;
  const [state, setState] = useState<LoadingState>({
    type: 'idle',
    isLoading: false
  });
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  // Clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const setLoading = useCallback((type: LoadingStateType, message?: string) => {
    if (!mountedRef.current) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (type === 'idle') {
      setState({ type: 'idle', isLoading: false });
      return;
    }

    // Set loading state
    setState({
      type,
      isLoading: true,
      message
    });

    // Set timeout protection
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        console.warn(`Loading timeout reached for ${type}`);
        setState({ type: 'idle', isLoading: false });
        onTimeout?.();
      }
    }, timeout);
  }, [timeout, onTimeout]);

  const clearLoading = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setState({ type: 'idle', isLoading: false });
  }, []);

  const isSpecificLoading = useCallback((type: LoadingStateType) => {
    return state.type === type && state.isLoading;
  }, [state]);

  return {
    loading: state.isLoading,
    loadingType: state.type,
    loadingMessage: state.message,
    setLoading,
    clearLoading,
    isLoggingIn: isSpecificLoading('logging-in'),
    isLoggingOut: isSpecificLoading('logging-out'),
    isSwitchingPortal: isSpecificLoading('switching-portal'),
    isLoadingData: isSpecificLoading('loading-data')
  };
}

// Enhanced loading state with retry logic
export function useLoadingStateWithRetry(options: UseLoadingStateOptions & {
  maxRetries?: number;
  retryDelay?: number;
} = {}) {
  const { maxRetries = 3, retryDelay = 1000, ...loadingOptions } = options;
  const [retryCount, setRetryCount] = useState(0);
  const loadingState = useLoadingState(loadingOptions);

  const retry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      return true;
    }
    return false;
  }, [retryCount, maxRetries]);

  const resetRetries = useCallback(() => {
    setRetryCount(0);
  }, []);

  const executeWithRetry = useCallback(async <T,>(
    operation: () => Promise<T>,
    loadingType: LoadingStateType,
    message?: string
  ): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        loadingState.setLoading(loadingType, `${message}${attempt > 0 ? ` (Retry ${attempt}/${maxRetries})` : ''}`);
        const result = await operation();
        loadingState.clearLoading();
        resetRetries();
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    loadingState.clearLoading();
    throw lastError;
  }, [maxRetries, retryDelay, loadingState, resetRetries]);

  return {
    ...loadingState,
    retryCount,
    retry,
    resetRetries,
    executeWithRetry
  };
}