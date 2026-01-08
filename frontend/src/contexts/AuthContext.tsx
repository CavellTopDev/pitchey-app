import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, portalType: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use existing auth store to maintain compatibility
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = async () => {
    try {
      setIsLoading(true);
      await authStore.fetchProfile();
    } catch (error) {
      console.error('Session check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, portalType: string) => {
    try {
      if (portalType === 'creator') {
        await authStore.loginCreator(email, password);
      } else if (portalType === 'investor') {
        await authStore.loginInvestor(email, password);
      } else if (portalType === 'production') {
        await authStore.loginProduction(email, password);
      } else {
        await authStore.login(email, password);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      authStore.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateUser = (updatedUser: User) => {
    // Update user in auth store
    authStore.updateProfile(updatedUser);
  };

  useEffect(() => {
    // Skip auth session check for public routes (homepage, login pages, etc.)
    const path = window.location.pathname;
    const isPublicRoute = ['/', '/how-it-works', '/about', '/contact', '/terms', '/privacy', '/portals'].includes(path) ||
                         path.startsWith('/login/') || path.startsWith('/auth/');
    
    // Only check session for protected routes
    if (!isPublicRoute) {
      checkSession();
    }
  }, []);

  const value: AuthContextType = {
    user: authStore.user,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: isLoading || authStore.loading,
    login,
    logout,
    checkSession,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};