import { create } from 'zustand';
import { authAPI } from '../lib/api-client';
import { config } from '../config';
import type { User, RegisterData } from '../types/api';
import { clearAuthenticationState, checkAuthPortalConsistency, getSafeUserData } from '../utils/auth';
import { portalAuth, cleanupJWTArtifacts, getCurrentUser, type PortalType } from '../lib/better-auth-client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginCreator: (email: string, password: string) => Promise<void>;
  loginInvestor: (email: string, password: string) => Promise<void>;
  loginProduction: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: (navigateToLogin?: boolean) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Better Auth session-based store - no localStorage needed!
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null, // Will be populated from Better Auth session
  isAuthenticated: false, // Will be determined by Better Auth session
  loading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.login(email, password);
      if (response.success && response.data?.user) {
        const user = response.data.user;
        set({ user, isAuthenticated: true, loading: false });
      } else {
        throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Login failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },

  loginCreator: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      // Use Better Auth portal authentication
      const response = await portalAuth.signInCreator(email, password);
      const user = response.user;
      
      if (!user) {
        throw new Error('User data not received from server');
      }
      
      // Clean up any JWT artifacts from previous sessions
      cleanupJWTArtifacts();
      
      // Better Auth handles session via secure cookies - no localStorage needed!
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Creator login failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },

  loginInvestor: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      // Use Better Auth portal authentication
      const response = await portalAuth.signInInvestor(email, password);
      const user = response.user;
      
      if (!user) {
        throw new Error('User data not received from server');
      }
      
      // Clean up any JWT artifacts from previous sessions
      cleanupJWTArtifacts();
      
      // Better Auth handles session via secure cookies - no localStorage needed!
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Investor login failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },

  loginProduction: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      // Use Better Auth portal authentication
      const response = await portalAuth.signInProduction(email, password);
      const user = response.user;
      
      if (!user) {
        throw new Error('User data not received from server');
      }
      
      // Clean up any JWT artifacts from previous sessions
      cleanupJWTArtifacts();
      
      // Better Auth handles session via secure cookies - no localStorage needed!
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Production login failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },

  register: async (data: RegisterData) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.register(data);
      if (response.success && response.data?.user) {
        const user = response.data.user;
        set({ user, isAuthenticated: true, loading: false });
      } else {
        throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Registration failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },

  logout: (navigateToLogin = true) => {
    
    // Get current user type before clearing state
    const currentUserType = localStorage.getItem('userType');
    
    // Clear authentication state first
    set({ user: null, isAuthenticated: false, loading: false, error: null });
    
    // Use comprehensive authentication cleanup utility
    clearAuthenticationState();
    
    // Clean up JWT artifacts (migration cleanup)
    cleanupJWTArtifacts();
    
    // Call Better Auth logout (async but don't wait)
    portalAuth.signOut().catch(error => {
      console.warn('Better Auth logout failed:', error);
    });
    
    // Navigate to appropriate login page if requested
    if (navigateToLogin) {
      const loginPath = currentUserType === 'creator' ? '/login/creator' : 
                       currentUserType === 'investor' ? '/login/investor' :
                       currentUserType === 'production' ? '/login/production' : '/';
      
      
      // DISABLED: This was causing redirect loops with Better Auth
      // Better Auth handles authentication state, not this redirect
      // setTimeout(() => {
      //   window.location.replace(loginPath);
      // }, 100);
    }
  },

  fetchProfile: async () => {
    set({ loading: true });
    try {
      // Use Better Auth to get current session from cookies
      const session = await getCurrentUser();
      
      if (!session) {
        // No session means user is not authenticated
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }
      
      // Session exists - user is authenticated
      set({ user: session, isAuthenticated: true, loading: false });
    } catch (error) {
      // Session check failed - user is not authenticated
      set({ user: null, isAuthenticated: false, loading: false });
      console.error('Failed to fetch profile:', error);
    }
  },

  updateProfile: async (data: Partial<User>) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.updateProfile(data);
      if (response.success && response.data) {
        const user = response.data;
        set({ user, loading: false });
      } else {
        throw new Error(typeof response.error === 'string' ? response.error : response.error?.message || 'Update failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      set({ 
        error: errorMessage,
        loading: false 
      });
      throw error;
    }
  },
}));