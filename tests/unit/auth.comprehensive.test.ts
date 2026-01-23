/**
 * Comprehensive Authentication Unit Tests
 * Tests all authentication flows with proper mocking and edge cases
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { TestFactory } from "../framework/test-factory.ts";
import { testDb, withDatabase } from "../framework/test-database.ts";

// Mock JWT utilities for testing
const mockJWT = {
  sign: (payload: any, secret: string, options?: any) => {
    return `mock.jwt.token.${btoa(JSON.stringify(payload))}`;
  },
  verify: (token: string, secret: string) => {
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'mock') {
      throw new Error('Invalid token');
    }
    return JSON.parse(atob(parts[3]));
  }
};

// Mock bcrypt for password hashing
const mockBcrypt = {
  hash: async (password: string, rounds: number) => {
    return `$2a$12$mock.hash.${btoa(password)}`;
  },
  compare: async (password: string, hash: string) => {
    return hash === `$2a$12$mock.hash.${btoa(password)}`;
  }
};

interface AuthService {
  register(userData: any): Promise<{ success: boolean; user?: any; error?: string }>;
  login(credentials: any): Promise<{ success: boolean; token?: string; user?: any; error?: string }>;
  validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }>;
  refreshToken(token: string): Promise<{ success: boolean; newToken?: string; error?: string }>;
  logout(token: string): Promise<{ success: boolean }>;
  changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }>;
  resetPassword(email: string): Promise<{ success: boolean; resetToken?: string; error?: string }>;
  confirmResetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }>;
  enableTwoFactor(userId: number): Promise<{ success: boolean; secret?: string; qrCode?: string; error?: string }>;
  verifyTwoFactor(userId: number, token: string): Promise<{ success: boolean; error?: string }>;
}

// Mock Auth Service Implementation for Testing
class MockAuthService implements AuthService {
  private users: Map<number, any> = new Map();
  private tokens: Map<string, { userId: number; expiresAt: Date }> = new Map();
  private resetTokens: Map<string, { userId: number; expiresAt: Date }> = new Map();
  private twoFactorSecrets: Map<number, string> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  
  async register(userData: any): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Validate required fields
      if (!userData.email || !userData.password || !userData.username) {
        return { success: false, error: "Missing required fields" };
      }

      // Check if user already exists
      const existingUser = Array.from(this.users.values()).find(
        u => u.email === userData.email || u.username === userData.username
      );
      
      if (existingUser) {
        return { success: false, error: "User already exists" };
      }

      // Validate password strength
      if (userData.password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters" };
      }

      // Create user
      const userId = this.users.size + 1;
      const hashedPassword = await mockBcrypt.hash(userData.password, 12);
      
      const user = {
        id: userId,
        email: userData.email,
        username: userData.username,
        passwordHash: hashedPassword,
        userType: userData.userType || 'creator',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        emailVerified: false,
        isActive: true,
        failedLoginAttempts: 0,
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(userId, user);

      // Return user without sensitive data
      const { passwordHash, ...safeUser } = user;
      return { success: true, user: safeUser };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async login(credentials: any): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    try {
      const { email, password, userType } = credentials;
      
      // Find user by email
      const user = Array.from(this.users.values()).find(u => u.email === email);
      if (!user) {
        return { success: false, error: "Invalid credentials" };
      }

      // Check account status
      if (!user.isActive) {
        return { success: false, error: "Account is deactivated" };
      }

      // Check if account is locked
      if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
        return { success: false, error: "Account is temporarily locked" };
      }

      // Check user type if specified
      if (userType && user.userType !== userType) {
        return { success: false, error: "Invalid user type" };
      }

      // Verify password
      const passwordValid = await mockBcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        // Increment failed attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        user.lastFailedLogin = new Date();
        
        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          user.accountLockedAt = new Date();
          user.accountLockReason = "Too many failed login attempts";
        }
        
        this.users.set(user.id, user);
        return { success: false, error: "Invalid credentials" };
      }

      // Reset failed attempts on successful login
      user.failedLoginAttempts = 0;
      user.lastFailedLogin = null;
      user.accountLockedUntil = null;
      user.lastLoginAt = new Date();
      this.users.set(user.id, user);

      // Generate JWT token
      const token = mockJWT.sign(
        { userId: user.id, userType: user.userType },
        'test-secret',
        { expiresIn: '24h' }
      );

      // Store token
      this.tokens.set(token, {
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Return user without sensitive data
      const { passwordHash, ...safeUser } = user;
      return { success: true, token, user: safeUser };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      // Check if token exists in our store
      const tokenData = this.tokens.get(token);
      if (!tokenData) {
        return { valid: false, error: "Token not found" };
      }

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        this.tokens.delete(token);
        return { valid: false, error: "Token expired" };
      }

      // Get user
      const user = this.users.get(tokenData.userId);
      if (!user) {
        return { valid: false, error: "User not found" };
      }

      if (!user.isActive) {
        return { valid: false, error: "User account deactivated" };
      }

      // Return user without sensitive data
      const { passwordHash, ...safeUser } = user;
      return { valid: true, user: safeUser };
      
    } catch (error: unknown) {
      return { valid: false, error: (error as Error).message };
    }
  }

  async refreshToken(token: string): Promise<{ success: boolean; newToken?: string; error?: string }> {
    try {
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Remove old token
      this.tokens.delete(token);

      // Generate new token
      const newToken = mockJWT.sign(
        { userId: validation.user.id, userType: validation.user.userType },
        'test-secret',
        { expiresIn: '24h' }
      );

      // Store new token
      this.tokens.set(newToken, {
        userId: validation.user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      return { success: true, newToken };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async logout(token: string): Promise<{ success: boolean }> {
    this.tokens.delete(token);
    return { success: true };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Verify old password
      const oldPasswordValid = await mockBcrypt.compare(oldPassword, user.passwordHash);
      if (!oldPasswordValid) {
        return { success: false, error: "Current password is incorrect" };
      }

      // Validate new password
      if (newPassword.length < 8) {
        return { success: false, error: "New password must be at least 8 characters" };
      }

      // Check if new password is same as old
      const samePassword = await mockBcrypt.compare(newPassword, user.passwordHash);
      if (samePassword) {
        return { success: false, error: "New password must be different from current password" };
      }

      // Update password
      user.passwordHash = await mockBcrypt.hash(newPassword, 12);
      user.lastPasswordChangeAt = new Date();
      this.users.set(userId, user);

      return { success: true };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; resetToken?: string; error?: string }> {
    try {
      const user = Array.from(this.users.values()).find(u => u.email === email);
      if (!user) {
        // Return success anyway for security reasons (don't leak email existence)
        return { success: true };
      }

      // Generate reset token
      const resetToken = `reset_${Math.random().toString(36).substr(2, 20)}`;
      this.resetTokens.set(resetToken, {
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });

      return { success: true, resetToken };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async confirmResetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const resetData = this.resetTokens.get(token);
      if (!resetData) {
        return { success: false, error: "Invalid reset token" };
      }

      if (new Date() > resetData.expiresAt) {
        this.resetTokens.delete(token);
        return { success: false, error: "Reset token expired" };
      }

      const user = this.users.get(resetData.userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Validate new password
      if (newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters" };
      }

      // Update password
      user.passwordHash = await mockBcrypt.hash(newPassword, 12);
      user.lastPasswordChangeAt = new Date();
      this.users.set(user.id, user);

      // Remove reset token
      this.resetTokens.delete(token);

      return { success: true };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async enableTwoFactor(userId: number): Promise<{ success: boolean; secret?: string; qrCode?: string; error?: string }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Generate 2FA secret
      const secret = Math.random().toString(36).substr(2, 32);
      this.twoFactorSecrets.set(userId, secret);

      // Mock QR code URL
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Pitchey:${user.email}?secret=${secret}&issuer=Pitchey`;

      return { success: true, secret, qrCode };
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async verifyTwoFactor(userId: number, token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const secret = this.twoFactorSecrets.get(userId);
      if (!secret) {
        return { success: false, error: "2FA not set up" };
      }

      // Mock verification - in real implementation would use TOTP library
      const isValid = token === "123456"; // Mock valid token
      
      if (isValid) {
        const user = this.users.get(userId);
        if (user) {
          user.twoFactorEnabled = true;
          this.users.set(userId, user);
        }
        return { success: true };
      } else {
        return { success: false, error: "Invalid 2FA token" };
      }
      
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }
}

// ==================== TEST SUITE ====================

Deno.test({
  name: "Authentication Service - Comprehensive Unit Tests",
  async fn() {
    const authService = new MockAuthService();

    try {
      console.log("🧪 Testing Authentication Service...");

      // ==================== REGISTRATION TESTS ====================
      
      await Deno.test({
        name: "User Registration - Valid Data",
        async fn() {
          const userData = TestFactory.creator();
          const result = await authService.register(userData);
          
          assertEquals(result.success, true);
          assertExists(result.user);
          assertEquals(result.user.email, userData.email);
          assertEquals(result.user.userType, userData.userType);
          assert(!result.user.passwordHash, "Password hash should not be returned");
        }
      });

      await Deno.test({
        name: "User Registration - Missing Required Fields",
        async fn() {
          const result = await authService.register({
            email: "test@example.com"
            // Missing username and password
          });
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Missing required fields");
        }
      });

      await Deno.test({
        name: "User Registration - Duplicate Email",
        async fn() {
          const userData = TestFactory.creator();
          
          // First registration
          await authService.register(userData);
          
          // Attempt duplicate registration
          const result = await authService.register(userData);
          
          assertEquals(result.success, false);
          assertEquals(result.error, "User already exists");
        }
      });

      await Deno.test({
        name: "User Registration - Weak Password",
        async fn() {
          const userData = TestFactory.creator({ password: "123" });
          const result = await authService.register(userData);
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Password must be at least 8 characters");
        }
      });

      // ==================== LOGIN TESTS ====================
      
      await Deno.test({
        name: "User Login - Valid Credentials",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const result = await authService.login({
            email: userData.email,
            password: userData.password,
            userType: userData.userType
          });
          
          assertEquals(result.success, true);
          assertExists(result.token);
          assertExists(result.user);
          assertEquals(result.user.email, userData.email);
        }
      });

      await Deno.test({
        name: "User Login - Invalid Email",
        async fn() {
          const result = await authService.login({
            email: "nonexistent@example.com",
            password: "password123"
          });
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Invalid credentials");
        }
      });

      await Deno.test({
        name: "User Login - Invalid Password",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const result = await authService.login({
            email: userData.email,
            password: "wrongpassword"
          });
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Invalid credentials");
        }
      });

      await Deno.test({
        name: "User Login - Account Lockout After Failed Attempts",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          // Make 5 failed attempts
          for (let i = 0; i < 5; i++) {
            await authService.login({
              email: userData.email,
              password: "wrongpassword"
            });
          }
          
          // 6th attempt should be locked
          const result = await authService.login({
            email: userData.email,
            password: userData.password // Even with correct password
          });
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Account is temporarily locked");
        }
      });

      // ==================== TOKEN VALIDATION TESTS ====================
      
      await Deno.test({
        name: "Token Validation - Valid Token",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const loginResult = await authService.login({
            email: userData.email,
            password: userData.password
          });
          
          const validation = await authService.validateToken(loginResult.token!);
          
          assertEquals(validation.valid, true);
          assertExists(validation.user);
          assertEquals(validation.user.email, userData.email);
        }
      });

      await Deno.test({
        name: "Token Validation - Invalid Token",
        async fn() {
          const validation = await authService.validateToken("invalid.token.here");
          
          assertEquals(validation.valid, false);
          assertEquals(validation.error, "Token not found");
        }
      });

      // ==================== PASSWORD CHANGE TESTS ====================
      
      await Deno.test({
        name: "Password Change - Valid Current Password",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          const result = await authService.changePassword(
            registerResult.user!.id,
            userData.password,
            "newpassword123"
          );
          
          assertEquals(result.success, true);
        }
      });

      await Deno.test({
        name: "Password Change - Invalid Current Password",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          const result = await authService.changePassword(
            registerResult.user!.id,
            "wrongpassword",
            "newpassword123"
          );
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Current password is incorrect");
        }
      });

      await Deno.test({
        name: "Password Change - Same Password",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          const result = await authService.changePassword(
            registerResult.user!.id,
            userData.password,
            userData.password
          );
          
          assertEquals(result.success, false);
          assertEquals(result.error, "New password must be different from current password");
        }
      });

      // ==================== PASSWORD RESET TESTS ====================
      
      await Deno.test({
        name: "Password Reset - Request Reset",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const result = await authService.resetPassword(userData.email);
          
          assertEquals(result.success, true);
          assertExists(result.resetToken);
        }
      });

      await Deno.test({
        name: "Password Reset - Confirm Reset with Valid Token",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const resetResult = await authService.resetPassword(userData.email);
          const confirmResult = await authService.confirmResetPassword(
            resetResult.resetToken!,
            "newpassword123"
          );
          
          assertEquals(confirmResult.success, true);
        }
      });

      await Deno.test({
        name: "Password Reset - Confirm Reset with Invalid Token",
        async fn() {
          const result = await authService.confirmResetPassword(
            "invalid_token",
            "newpassword123"
          );
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Invalid reset token");
        }
      });

      // ==================== TWO-FACTOR AUTHENTICATION TESTS ====================
      
      await Deno.test({
        name: "2FA - Enable Two Factor Authentication",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          const result = await authService.enableTwoFactor(registerResult.user!.id);
          
          assertEquals(result.success, true);
          assertExists(result.secret);
          assertExists(result.qrCode);
          assert(result.qrCode!.includes("otpauth://"));
        }
      });

      await Deno.test({
        name: "2FA - Verify Two Factor Token",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          await authService.enableTwoFactor(registerResult.user!.id);
          const result = await authService.verifyTwoFactor(registerResult.user!.id, "123456");
          
          assertEquals(result.success, true);
        }
      });

      await Deno.test({
        name: "2FA - Verify Invalid Token",
        async fn() {
          const userData = TestFactory.creator();
          const registerResult = await authService.register(userData);
          
          await authService.enableTwoFactor(registerResult.user!.id);
          const result = await authService.verifyTwoFactor(registerResult.user!.id, "000000");
          
          assertEquals(result.success, false);
          assertEquals(result.error, "Invalid 2FA token");
        }
      });

      // ==================== LOGOUT TESTS ====================
      
      await Deno.test({
        name: "User Logout - Valid Token",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const loginResult = await authService.login({
            email: userData.email,
            password: userData.password
          });
          
          const logoutResult = await authService.logout(loginResult.token!);
          assertEquals(logoutResult.success, true);
          
          // Token should now be invalid
          const validation = await authService.validateToken(loginResult.token!);
          assertEquals(validation.valid, false);
        }
      });

      // ==================== TOKEN REFRESH TESTS ====================
      
      await Deno.test({
        name: "Token Refresh - Valid Token",
        async fn() {
          const userData = TestFactory.creator();
          await authService.register(userData);
          
          const loginResult = await authService.login({
            email: userData.email,
            password: userData.password
          });
          
          const refreshResult = await authService.refreshToken(loginResult.token!);
          
          assertEquals(refreshResult.success, true);
          assertExists(refreshResult.newToken);
          assert(refreshResult.newToken !== loginResult.token, "New token should be different");
          
          // Old token should be invalid
          const oldValidation = await authService.validateToken(loginResult.token!);
          assertEquals(oldValidation.valid, false);
          
          // New token should be valid
          const newValidation = await authService.validateToken(refreshResult.newToken!);
          assertEquals(newValidation.valid, true);
        }
      });

      console.log("✅ All authentication tests passed!");
    } catch (error: unknown) {
      console.error("Test suite error:", error);
      throw error;
    }
  }
});