import { create } from 'zustand';
import { authAPI } from '../lib/api';
import type { User } from '../lib/api';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('authToken'),
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
      const { user } = await authAPI.loginCreator(email, password);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  loginInvestor: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { user } = await authAPI.loginInvestor(email, password);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  loginProduction: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { user } = await authAPI.loginProduction(email, password);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const { user } = await authAPI.register(data);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Registration failed',
        loading: false 
      });
      throw error;
    }
  },

  logout: (navigateToLogin = true) => {
    console.log('Logout initiated in authStore');
    
    // Get current user type before clearing state
    const currentUserType = localStorage.getItem('userType');
    console.log('Current user type:', currentUserType);
    
    // Clear authentication state first
    set({ user: null, isAuthenticated: false, loading: false, error: null });
    
    // Call the auth API logout to clear storage and backend session
    authAPI.logout();
    
    // Navigate to appropriate login page if requested
    if (navigateToLogin) {
      // Force a complete page reload to clear all state
      const loginPath = currentUserType === 'creator' ? '/login/creator' : 
                       currentUserType === 'investor' ? '/login/investor' :
                       currentUserType === 'production' ? '/login/production' : '/';
      
      console.log('Redirecting to:', loginPath);
      
      // Add a small delay to ensure state cleanup completes
      setTimeout(() => {
        window.location.replace(loginPath);
      }, 100);
    }
  },

  fetchProfile: async () => {
    set({ loading: true });
    try {
      const user = await authAPI.getProfile();
      set({ user, isAuthenticated: true, loading: false });
    } catch (error) {
      // Don't change isAuthenticated here - let the user stay "logged in"
      // until they explicitly log out or the token is removed
      set({ loading: false });
      console.error('Failed to fetch profile:', error);
    }
  },

  updateProfile: async (data) => {
    set({ loading: true, error: null });
    try {
      const { user } = await authAPI.updateProfile(data);
      set({ user, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Update failed',
        loading: false 
      });
      throw error;
    }
  },
}));