import { create } from 'zustand';
import { authAPI } from '../lib/api';
import { config } from '../config';
import type { User } from '../types';

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

// LocalStorage helpers for namespacing
const nsKey = (key: string) => {
  try {
    const host = new URL(config.API_URL).host;
    return `pitchey:${host}:${key}`;
  } catch {
    return `pitchey:${key}`;
  }
};
const getLS = (key: string) => localStorage.getItem(nsKey(key)) ?? localStorage.getItem(key);
const setLS = (key: string, value: string) => {
  localStorage.setItem(nsKey(key), value);
  localStorage.setItem(key, value);
};
const removeLS = (key: string) => {
  localStorage.removeItem(nsKey(key));
  localStorage.removeItem(key);
};

// Helper function to safely get from localStorage
const getStoredUser = (): User | null => {
  try {
    const stored = getLS('user');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to parse stored user:', error);
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isAuthenticated: !!getLS('authToken'),
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
      const response = await authAPI.loginCreator(email, password);
      const user = response.data?.user || response.user;
      if (!user) {
        throw new Error('User data not received from server');
      }
      // Store user data and type in localStorage for persistence (namespaced + legacy)
      setLS('user', JSON.stringify(user));
      setLS('userType', 'creator');
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || error.message || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  loginInvestor: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.loginInvestor(email, password);
      const user = response.data?.user || response.user;
      if (!user) {
        throw new Error('User data not received from server');
      }
      // Store user data and type in localStorage for persistence (namespaced + legacy)
      setLS('user', JSON.stringify(user));
      setLS('userType', 'investor');
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || error.message || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  loginProduction: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.loginProduction(email, password);
      const user = response.data?.user || response.user;
      if (!user) {
        throw new Error('User data not received from server');
      }
      // Store user data and type in localStorage for persistence (namespaced + legacy)
      setLS('user', JSON.stringify(user));
      setLS('userType', 'production');
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || error.message || 'Login failed',
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
      // Store user data and type in localStorage for persistence (namespaced + legacy)
      setLS('user', JSON.stringify(user));
      setLS('userType', data.userType);
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
    console.log('Logout initiated in authStore');
    
    // Get current user type before clearing state
    const currentUserType = localStorage.getItem('userType');
    console.log('Current user type:', currentUserType);
    
    // Clear authentication state first
    set({ user: null, isAuthenticated: false, loading: false, error: null });
    
    // Proactively clear storage both namespaced and legacy, then call backend logout
    removeLS('authToken');
    removeLS('user');
    removeLS('userType');
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
      const response = await authAPI.getProfile();
      const user = response.data?.user || response.user || response.data;
      if (!user) {
        throw new Error('User profile data not received from server');
      }
      // Update localStorage with fresh user data (namespaced + legacy)
      setLS('user', JSON.stringify(user));
      if (user.userType) {
        setLS('userType', user.userType);
      }
      set({ user, isAuthenticated: true, loading: false });
    } catch (error) {
      // If profile fetch fails and we have no stored user, consider them unauthenticated
      const storedUser = getStoredUser();
      if (!storedUser) {
        set({ isAuthenticated: false, loading: false });
        removeLS('authToken');
        removeLS('user');
        removeLS('userType');
      } else {
        // Keep them authenticated with stored data if available
        set({ loading: false });
      }
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
      // Update localStorage with new user data (namespaced + legacy)
      setLS('user', JSON.stringify(user));
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