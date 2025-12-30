import { create } from 'zustand';
import { authAPI } from '../lib/api';
import { config } from '../config';
import type { User } from '../types';
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
  register: (data: {
    email: string;
    username: string;
    password: string;
    userType: string;
  }) => Promise<void>;
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
      const { user } = await authAPI.login(email, password);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Login failed',
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
    } catch (error: any) {
      set({ 
        error: error.message || 'Login failed',
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
    } catch (error: any) {
      set({ 
        error: error.message || 'Login failed',
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
    } catch (error: any) {
      set({ 
        error: error.message || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.register(data);
      const user = response.data?.user || response.user;
      if (!user) {
        throw new Error('User data not received from server');
      }
      // Better Auth handles session via secure cookies - no localStorage needed!
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || error.message || 'Registration failed',
        loading: false 
      });
      throw error;
    }
  },

  logout: (navigateToLogin = true) => {
    console.log('🔴 Logout initiated in authStore (Better Auth)');
    
    // Get current user type before clearing state
    const currentUserType = localStorage.getItem('userType');
    console.log('Current user type:', currentUserType);
    
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
      
      console.log('🔄 Redirecting to:', loginPath);
      
      // Add a small delay to ensure state cleanup completes
      setTimeout(() => {
        window.location.replace(loginPath);
      }, 100);
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

  updateProfile: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.updateProfile(data);
      const user = response.data?.user || response.user || response.data;
      if (!user) {
        throw new Error('Updated user data not received from server');
      }
      // Update user in state - Better Auth handles session cookies
      set({ user, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || error.message || 'Update failed',
        loading: false 
      });
      throw error;
    }
  },
}));