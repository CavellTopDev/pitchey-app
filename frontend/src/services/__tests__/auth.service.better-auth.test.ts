import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth.service';

// Mock the Better Auth client
vi.mock('../../lib/better-auth-client', () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
    signOut: vi.fn(),
    session: vi.fn(),
    getSession: vi.fn(),
  },
}));

import { authClient } from '../../lib/better-auth-client';

describe('AuthService - Better Auth Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should handle successful creator login', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'creator',
          },
          session: {
            id: 'session-123',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      };

      (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

      const result = await AuthService.creatorLogin({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        callbackURL: '/creator/dashboard',
        fetchOptions: {
          headers: {
            'X-Portal-Type': 'creator'
          }
        }
      });
    });

    it('should handle successful investor login', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'investor-123',
            email: 'investor@example.com',
            name: 'Investor User',
            role: 'investor',
          },
          session: {
            id: 'session-456',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      };

      (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

      const result = await AuthService.investorLogin({
        email: 'investor@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'investor@example.com',
        password: 'password123',
        callbackURL: '/investor/dashboard',
        fetchOptions: {
          headers: {
            'X-Portal-Type': 'investor'
          }
        }
      });
    });

    it('should handle successful production login', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'production-123',
            email: 'production@example.com',
            name: 'Production User',
            role: 'production',
          },
          session: {
            id: 'session-789',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      };

      (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

      const result = await AuthService.productionLogin({
        email: 'production@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: 'production@example.com',
        password: 'password123',
        callbackURL: '/production/dashboard',
        fetchOptions: {
          headers: {
            'X-Portal-Type': 'production'
          }
        }
      });
    });

    it('should handle login failure', async () => {
      (authClient.signIn.email as any).mockRejectedValueOnce(
        new Error('Invalid credentials')
      );

      await expect(
        AuthService.creatorLogin({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle successful signup', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'new-user-123',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'creator',
          },
          session: {
            id: 'new-session-123',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      };

      (authClient.signUp.email as any).mockResolvedValueOnce(mockResponse);

      const result = await AuthService.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'creator',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
    });

    it('should handle logout', async () => {
      (authClient.signOut as any).mockResolvedValueOnce({ success: true });

      await AuthService.logout();

      expect(authClient.signOut).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should get current user from session', async () => {
      const mockSessionResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      };

      (authClient.getSession as any).mockResolvedValueOnce(mockSessionResponse);

      const user = await AuthService.getCurrentUser();

      expect(user).toEqual(mockSessionResponse.data.user);
      expect(authClient.getSession).toHaveBeenCalled();
    });

    it('should validate token (session check)', async () => {
      const mockSessionResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'creator',
          },
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      };

      (authClient.getSession as any).mockResolvedValueOnce(mockSessionResponse);

      const validation = await AuthService.validateToken();

      expect(validation.valid).toBe(true);
      expect(validation.user).toEqual(mockSessionResponse.data.user);
    });

    it('should handle expired session', async () => {
      (authClient.getSession as any).mockResolvedValueOnce({ data: null });

      const validation = await AuthService.validateToken();

      expect(validation.valid).toBe(false);
      expect(validation.user).toBeUndefined();
    });
  });

  describe('JWT Cleanup', () => {
    it('should clean up old JWT tokens from localStorage on login', async () => {
      // Set some old JWT tokens
      localStorage.setItem('authToken', 'old-jwt');
      localStorage.setItem('token', 'old-token');
      localStorage.setItem('jwt', 'old-jwt-token');
      localStorage.setItem('user', JSON.stringify({ id: 'old' }));

      const mockResponse = {
        data: {
          user: { id: 'user-123', email: 'test@example.com', role: 'creator' },
          session: { id: 'session-123' },
        },
      };

      (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

      await AuthService.creatorLogin({
        email: 'test@example.com',
        password: 'password123',
      });

      // Check that old JWT tokens are removed (toBeFalsy handles both null and undefined)
      expect(localStorage.getItem('authToken')).toBeFalsy();
      expect(localStorage.getItem('token')).toBeFalsy();
      expect(localStorage.getItem('jwt')).toBeFalsy();
      expect(localStorage.getItem('user')).toBeFalsy();
    });
  });

  describe('Demo Accounts', () => {
    const demoAccounts = [
      { email: 'alex.creator@demo.com', password: 'Demo123', role: 'creator' },
      { email: 'sarah.investor@demo.com', password: 'Demo123', role: 'investor' },
      { email: 'stellar.production@demo.com', password: 'Demo123', role: 'production' },
    ];

    demoAccounts.forEach(({ email, password, role }) => {
      it(`should authenticate demo ${role} account`, async () => {
        const mockResponse = {
          data: {
            user: { id: `demo-${role}-123`, email, role },
            session: { id: `session-${role}-123` },
          },
        };

        (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

        let result;
        if (role === 'creator') {
          result = await AuthService.creatorLogin({ email, password });
        } else if (role === 'investor') {
          result = await AuthService.investorLogin({ email, password });
        } else {
          result = await AuthService.productionLogin({ email, password });
        }

        expect(result.user.email).toBe(email);
        expect(result.user.role).toBe(role);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (authClient.signIn.email as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        AuthService.creatorLogin({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle rate limiting', async () => {
      (authClient.signIn.email as any).mockRejectedValueOnce(
        new Error('Too many requests')
      );

      await expect(
        AuthService.creatorLogin({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Too many requests');
    });

    it('should handle missing session on login', async () => {
      const mockResponse = {
        data: {
          user: { id: 'user-123' },
          session: null,
        },
      };

      (authClient.signIn.email as any).mockResolvedValueOnce(mockResponse);

      await expect(
        AuthService.creatorLogin({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Login failed');
    });
  });
});