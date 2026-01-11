import React, { useEffect, useRef } from 'react';
import Homepage from './Homepage';
import { useBetterAuthStore } from '../store/betterAuthStore';

export default function HomepageDebug() {
  const renderCount = useRef(0);
  const { isAuthenticated, user, loading } = useBetterAuthStore();
  const prevAuth = useRef({ isAuthenticated, user, loading });

  useEffect(() => {
    renderCount.current++;
      isAuthenticated,
      user: user?.id,
      loading,
      changed: {
        auth: prevAuth.current.isAuthenticated !== isAuthenticated,
        user: prevAuth.current.user?.id !== user?.id,
        loading: prevAuth.current.loading !== loading
      }
    });
    
    // Track what changed
    if (prevAuth.current.isAuthenticated !== isAuthenticated) {
      console.warn('[HOMEPAGE DEBUG] isAuthenticated changed:', prevAuth.current.isAuthenticated, '->', isAuthenticated);
    }
    if (prevAuth.current.user?.id !== user?.id) {
      console.warn('[HOMEPAGE DEBUG] user changed:', prevAuth.current.user?.id, '->', user?.id);
    }
    if (prevAuth.current.loading !== loading) {
      console.warn('[HOMEPAGE DEBUG] loading changed:', prevAuth.current.loading, '->', loading);
    }
    
    prevAuth.current = { isAuthenticated, user, loading };
  });

  // Check for navigation events
  useEffect(() => {
    const handlePopState = () => {
      console.error('[HOMEPAGE DEBUG] POPSTATE EVENT - Browser navigation detected!');
    };
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.error('[HOMEPAGE DEBUG] BEFOREUNLOAD EVENT - Page is reloading!');
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return <Homepage />;
}