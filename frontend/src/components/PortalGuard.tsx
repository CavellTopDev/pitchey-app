import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { validatePortalAccess } from '../utils/auth';

interface PortalGuardProps {
  children: React.ReactNode;
  requiredPortal: 'creator' | 'investor' | 'production';
}

/**
 * PortalGuard ensures users are on the correct portal and handles mismatches
 */
export const PortalGuard: React.FC<PortalGuardProps> = ({ children, requiredPortal }) => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      return; // Let normal auth guards handle this
    }

    const userType = user?.userType;
    const validation = validatePortalAccess(userType, location.pathname);

    if (!validation.isValidPortal && userType && userType !== requiredPortal) {
      console.warn(`🚨 Portal mismatch detected: ${userType} user on ${requiredPortal} portal`);
      
      // Clear auth state and redirect to correct portal
      logout(false); // Don't auto-navigate
      window.location.replace(`/login/${userType}`);
    }
  }, [isAuthenticated, user, location.pathname, requiredPortal, logout]);

  // If not authenticated, redirect to appropriate login
  if (!isAuthenticated) {
    return <Navigate to={`/login/${requiredPortal}`} replace />;
  }

  // If wrong portal, show loading while redirecting
  if (user?.userType && user.userType !== requiredPortal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};