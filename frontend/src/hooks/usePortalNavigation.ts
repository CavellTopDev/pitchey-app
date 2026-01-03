/**
 * Portal Navigation Hook
 * Ensures proper navigation and data loading for all portal routes
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface NavigationGuard {
  path: string;
  requiredRole?: string[];
  requiredPermission?: string;
  redirectTo?: string;
}

const PORTAL_GUARDS: NavigationGuard[] = [
  // Creator Portal
  { path: '/creator', requiredRole: ['creator', 'admin'] },
  { path: '/creator/dashboard', requiredRole: ['creator', 'admin'] },
  { path: '/creator/pitches', requiredRole: ['creator', 'admin'] },
  { path: '/creator/analytics', requiredRole: ['creator', 'admin'] },
  { path: '/creator/messages', requiredRole: ['creator', 'admin'] },
  { path: '/creator/settings', requiredRole: ['creator', 'admin'] },
  
  // Investor Portal
  { path: '/investor', requiredRole: ['investor', 'admin'] },
  { path: '/investor/dashboard', requiredRole: ['investor', 'admin'] },
  { path: '/investor/browse', requiredRole: ['investor', 'admin'] },
  { path: '/investor/portfolio', requiredRole: ['investor', 'admin'] },
  { path: '/investor/messages', requiredRole: ['investor', 'admin'] },
  { path: '/investor/settings', requiredRole: ['investor', 'admin'] },
  
  // Production Portal
  { path: '/production', requiredRole: ['production', 'admin'] },
  { path: '/production/dashboard', requiredRole: ['production', 'admin'] },
  { path: '/production/projects', requiredRole: ['production', 'admin'] },
  { path: '/production/analytics', requiredRole: ['production', 'admin'] },
  { path: '/production/team', requiredRole: ['production', 'admin'] },
  { path: '/production/settings', requiredRole: ['production', 'admin'] },
];

export function usePortalNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, checkSession } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Check authentication on mount and route changes
  useEffect(() => {
    const verifyAccess = async () => {
      try {
        setIsLoading(true);
        
        // Check session if not already checked
        if (!hasCheckedAuth) {
          await checkSession();
          setHasCheckedAuth(true);
        }

        // Find guard for current path
        const guard = PORTAL_GUARDS.find(g => 
          location.pathname.startsWith(g.path)
        );

        if (guard) {
          // Check if user is authenticated
          if (!isAuthenticated) {
            toast.error('Please sign in to access this page');
            navigate('/login', { 
              state: { from: location.pathname } 
            });
            return;
          }

          // Check role-based access
          if (guard.requiredRole && user) {
            const userRole = user.user_type || user.role;
            const hasRole = guard.requiredRole.includes(userRole) || 
                           userRole === 'admin';
            
            if (!hasRole) {
              toast.error('You do not have permission to access this page');
              navigate(getDefaultRoute(userRole));
              return;
            }
          }
        }
      } catch (error) {
        console.error('Navigation guard error:', error);
        toast.error('Failed to verify access');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAccess();
  }, [location.pathname, isAuthenticated, user, hasCheckedAuth]);

  // Get default route based on user role
  const getDefaultRoute = useCallback((role: string) => {
    switch (role) {
      case 'creator':
        return '/creator/dashboard';
      case 'investor':
        return '/investor/dashboard';
      case 'production':
        return '/production/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/browse';
    }
  }, []);

  // Navigate to portal home
  const navigateToPortalHome = useCallback(() => {
    if (!user) return;
    
    const role = user.user_type || user.role;
    const defaultRoute = getDefaultRoute(role);
    navigate(defaultRoute);
  }, [user, navigate, getDefaultRoute]);

  // Safe navigation with role check
  const navigateTo = useCallback((path: string) => {
    const guard = PORTAL_GUARDS.find(g => path.startsWith(g.path));
    
    if (guard && guard.requiredRole && user) {
      const userRole = user.user_type || user.role;
      const hasRole = guard.requiredRole.includes(userRole) || 
                     userRole === 'admin';
      
      if (!hasRole) {
        toast.error('You do not have permission to access this page');
        return;
      }
    }
    
    navigate(path);
  }, [user, navigate]);

  // Preload data for navigation
  const preloadRouteData = useCallback(async (path: string) => {
    try {
      // Determine what data to preload based on route
      if (path.includes('/dashboard')) {
        // Preload dashboard stats
        await fetch('/api/dashboard/stats', {
          credentials: 'include'
        });
      } else if (path.includes('/browse')) {
        // Preload pitches
        await fetch('/api/pitches?limit=10', {
          credentials: 'include'
        });
      } else if (path.includes('/portfolio')) {
        // Preload investments
        await fetch('/api/investments', {
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Failed to preload route data:', error);
    }
  }, []);

  return {
    isLoading,
    navigateTo,
    navigateToPortalHome,
    preloadRouteData,
    canAccess: (path: string) => {
      const guard = PORTAL_GUARDS.find(g => path.startsWith(g.path));
      if (!guard) return true;
      if (!isAuthenticated) return false;
      if (!guard.requiredRole) return true;
      
      const userRole = user?.user_type || user?.role;
      return guard.requiredRole.includes(userRole) || userRole === 'admin';
    }
  };
}