import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, Permission } from '../usePermissions';

// Mock betterAuthStore
const mockBetterAuthStore = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  loginCreator: vi.fn(),
  loginInvestor: vi.fn(),
  loginProduction: vi.fn(),
  register: vi.fn(),
  setUser: vi.fn(),
  updateUser: vi.fn(),
  checkSession: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('../../store/betterAuthStore', () => ({
  useBetterAuthStore: () => mockBetterAuthStore,
}));

// Backend RBAC permission map (source of truth from src/services/rbac.service.ts)
const BACKEND_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(Permission),
  creator: [
    'pitch.create', 'pitch.edit.own', 'pitch.delete.own', 'pitch.view.public',
    'pitch.view.private', 'pitch.publish', 'nda.approve', 'nda.reject',
    'nda.revoke', 'nda.view.own', 'nda.upload.custom', 'document.upload',
    'document.view.public', 'document.view.private', 'document.delete.own',
    'user.view.own', 'user.edit.own', 'analytics.view.own', 'analytics.export',
    'message.send', 'message.receive', 'financial.view.own', 'payment.create',
  ],
  investor: [
    'pitch.view.public', 'pitch.view.private', 'nda.request', 'nda.sign',
    'nda.view.own', 'investment.create', 'investment.view.own', 'investment.manage',
    'investment.withdraw', 'portfolio.view', 'portfolio.manage', 'document.view.public',
    'document.view.private', 'user.view.own', 'user.edit.own', 'analytics.view.own',
    'analytics.export', 'message.send', 'message.receive', 'financial.view.own',
    'financial.export', 'payment.create',
  ],
  production: [
    'pitch.create', 'pitch.edit.own', 'pitch.delete.own', 'pitch.view.public',
    'pitch.view.private', 'pitch.publish', 'nda.request', 'nda.sign',
    'nda.view.own', 'investment.create', 'investment.view.own', 'portfolio.view',
    'document.view.public', 'document.view.private', 'document.upload',
    'user.view.own', 'user.edit.own', 'analytics.view.own', 'message.send',
    'message.receive', 'financial.view.own', 'payment.create',
    'production.create.project', 'production.manage.crew', 'production.schedule',
    'production.budget',
  ],
  viewer: [
    'pitch.view.public', 'document.view.public', 'user.view.own',
  ],
};

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBetterAuthStore.isAuthenticated = false;
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  // ─── Permission Constants ───────────────────────────────────────────

  describe('Permission constants', () => {
    it('defines all 55 permissions', () => {
      const allPerms = Object.values(Permission);
      expect(allPerms).toHaveLength(55);
    });

    it('all permission values are unique', () => {
      const values = Object.values(Permission);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('all permission values follow dot notation (category.action)', () => {
      Object.values(Permission).forEach(perm => {
        expect(perm).toMatch(/^[a-z]+\.[a-z]+(\.[a-z]+)?$/);
      });
    });

    it('has correct pitch permissions', () => {
      expect(Permission.PITCH_CREATE).toBe('pitch.create');
      expect(Permission.PITCH_EDIT_OWN).toBe('pitch.edit.own');
      expect(Permission.PITCH_EDIT_ANY).toBe('pitch.edit.any');
      expect(Permission.PITCH_DELETE_OWN).toBe('pitch.delete.own');
      expect(Permission.PITCH_DELETE_ANY).toBe('pitch.delete.any');
      expect(Permission.PITCH_VIEW_PUBLIC).toBe('pitch.view.public');
      expect(Permission.PITCH_VIEW_PRIVATE).toBe('pitch.view.private');
      expect(Permission.PITCH_PUBLISH).toBe('pitch.publish');
      expect(Permission.PITCH_MODERATE).toBe('pitch.moderate');
    });

    it('has correct NDA permissions', () => {
      expect(Permission.NDA_REQUEST).toBe('nda.request');
      expect(Permission.NDA_APPROVE).toBe('nda.approve');
      expect(Permission.NDA_REJECT).toBe('nda.reject');
      expect(Permission.NDA_SIGN).toBe('nda.sign');
      expect(Permission.NDA_REVOKE).toBe('nda.revoke');
      expect(Permission.NDA_VIEW_OWN).toBe('nda.view.own');
      expect(Permission.NDA_VIEW_ANY).toBe('nda.view.any');
      expect(Permission.NDA_UPLOAD_CUSTOM).toBe('nda.upload.custom');
    });

    it('has correct production-specific permissions', () => {
      expect(Permission.PRODUCTION_CREATE_PROJECT).toBe('production.create.project');
      expect(Permission.PRODUCTION_MANAGE_CREW).toBe('production.manage.crew');
      expect(Permission.PRODUCTION_SCHEDULE).toBe('production.schedule');
      expect(Permission.PRODUCTION_BUDGET).toBe('production.budget');
    });

    it('has correct admin permissions', () => {
      expect(Permission.ADMIN_ACCESS).toBe('admin.access');
      expect(Permission.ADMIN_SETTINGS).toBe('admin.settings');
      expect(Permission.ADMIN_LOGS).toBe('admin.logs');
      expect(Permission.ADMIN_BACKUP).toBe('admin.backup');
    });
  });

  // ─── Role Derivation (getUserRole) ──────────────────────────────────

  describe('getUserRole / userRole', () => {
    it('returns viewer when unauthenticated', () => {
      mockBetterAuthStore.isAuthenticated = false;
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('viewer');
    });

    it('returns viewer when authenticated but no userType in localStorage', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('viewer');
    });

    it('returns creator when userType is creator', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('creator');
    });

    it('returns investor when userType is investor', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('investor');
    });

    it('returns production when userType is production', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('production');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('production');
    });

    it('returns admin when userType is admin', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('admin');
    });

    it('returns viewer for unknown userType', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('unknown_role');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('viewer');
    });

    it('returns viewer for empty string userType', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.userRole).toBe('viewer');
    });
  });

  // ─── Backend Sync Verification ──────────────────────────────────────

  describe('frontend/backend RBAC sync', () => {
    const roles = ['admin', 'creator', 'investor', 'production', 'viewer'] as const;

    roles.forEach(role => {
      it(`${role} role has the same permissions as backend`, () => {
        mockBetterAuthStore.isAuthenticated = true;
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(role);
        const { result } = renderHook(() => usePermissions());

        const frontendPerms = [...result.current.permissions].sort();
        const backendPerms = [...BACKEND_ROLE_PERMISSIONS[role]].sort();

        expect(frontendPerms).toEqual(backendPerms);
      });
    });

    it('admin has all 55 permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions).toHaveLength(55);
    });

    it('viewer has exactly 3 permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions).toHaveLength(3);
    });
  });

  // ─── hasPermission ──────────────────────────────────────────────────

  describe('hasPermission', () => {
    it('creator can create pitches', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_CREATE)).toBe(true);
    });

    it('creator cannot create investments', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.INVESTMENT_CREATE)).toBe(false);
    });

    it('investor can create investments', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.INVESTMENT_CREATE)).toBe(true);
    });

    it('investor cannot create pitches', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_CREATE)).toBe(false);
    });

    it('viewer can view public pitches', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_VIEW_PUBLIC)).toBe(true);
    });

    it('viewer cannot send messages', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.MESSAGE_SEND)).toBe(false);
    });

    it('admin can do anything', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      Object.values(Permission).forEach(perm => {
        expect(result.current.hasPermission(perm)).toBe(true);
      });
    });

    it('production can manage crew', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('production');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PRODUCTION_MANAGE_CREW)).toBe(true);
    });

    it('creator cannot manage crew', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PRODUCTION_MANAGE_CREW)).toBe(false);
    });

    it('investor cannot manage crew', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PRODUCTION_MANAGE_CREW)).toBe(false);
    });

    it('creator can approve NDAs (owns pitches)', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.NDA_APPROVE)).toBe(true);
    });

    it('investor cannot approve NDAs', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.NDA_APPROVE)).toBe(false);
    });

    it('investor can request NDAs', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.NDA_REQUEST)).toBe(true);
    });

    it('creator cannot request NDAs', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.NDA_REQUEST)).toBe(false);
    });

    it('accepts string permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('pitch.create')).toBe(true);
    });

    it('returns false for non-existent permission string', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('nonexistent.permission')).toBe(false);
    });

    it('unauthenticated user gets viewer permissions', () => {
      mockBetterAuthStore.isAuthenticated = false;
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_VIEW_PUBLIC)).toBe(true);
      expect(result.current.hasPermission(Permission.PITCH_CREATE)).toBe(false);
    });
  });

  // ─── hasAnyPermission ───────────────────────────────────────────────

  describe('hasAnyPermission', () => {
    it('returns true when user has one of the listed permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission([
        Permission.INVESTMENT_CREATE,
        Permission.PITCH_CREATE,
      ])).toBe(true);
    });

    it('returns false when user has none of the listed permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission([
        Permission.PITCH_CREATE,
        Permission.INVESTMENT_CREATE,
      ])).toBe(false);
    });

    it('returns false for empty array', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission([])).toBe(false);
    });

    it('investor has any of investment or portfolio permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission([
        Permission.INVESTMENT_CREATE,
        Permission.PORTFOLIO_VIEW,
        Permission.PORTFOLIO_MANAGE,
      ])).toBe(true);
    });

    it('creator has none of the investment-specific permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission([
        Permission.INVESTMENT_CREATE,
        Permission.PORTFOLIO_VIEW,
        Permission.PORTFOLIO_MANAGE,
      ])).toBe(false);
    });

    it('works with string permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission(['pitch.create', 'nonexistent.perm'])).toBe(true);
    });
  });

  // ─── hasAllPermissions ──────────────────────────────────────────────

  describe('hasAllPermissions', () => {
    it('returns true when user has all listed permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([
        Permission.PITCH_CREATE,
        Permission.PITCH_EDIT_OWN,
        Permission.PITCH_PUBLISH,
      ])).toBe(true);
    });

    it('returns false when user is missing one permission', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([
        Permission.PITCH_CREATE,
        Permission.INVESTMENT_CREATE, // creator doesn't have this
      ])).toBe(false);
    });

    it('returns true for empty array', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([])).toBe(true);
    });

    it('admin passes any combination', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([
        Permission.PITCH_CREATE,
        Permission.INVESTMENT_CREATE,
        Permission.ADMIN_ACCESS,
        Permission.PRODUCTION_BUDGET,
      ])).toBe(true);
    });

    it('viewer fails multi-permission checks', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('viewer');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([
        Permission.PITCH_VIEW_PUBLIC,
        Permission.PITCH_CREATE,
      ])).toBe(false);
    });

    it('production has all production-specific permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('production');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions([
        Permission.PRODUCTION_CREATE_PROJECT,
        Permission.PRODUCTION_MANAGE_CREW,
        Permission.PRODUCTION_SCHEDULE,
        Permission.PRODUCTION_BUDGET,
      ])).toBe(true);
    });

    it('works with string permissions', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions(['pitch.create', 'pitch.publish'])).toBe(true);
    });
  });

  // ─── Role-Specific Permission Boundaries ────────────────────────────

  describe('role-specific permission boundaries', () => {
    it('creator cannot access admin panel', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.ADMIN_ACCESS)).toBe(false);
      expect(result.current.hasPermission(Permission.ADMIN_SETTINGS)).toBe(false);
    });

    it('investor cannot edit any pitches', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_EDIT_OWN)).toBe(false);
      expect(result.current.hasPermission(Permission.PITCH_EDIT_ANY)).toBe(false);
    });

    it('creator cannot delete any pitches (only own)', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_DELETE_OWN)).toBe(true);
      expect(result.current.hasPermission(Permission.PITCH_DELETE_ANY)).toBe(false);
    });

    it('only admin can moderate pitches', () => {
      const roles = ['creator', 'investor', 'production', 'viewer'] as const;
      roles.forEach(role => {
        mockBetterAuthStore.isAuthenticated = true;
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(role);
        const { result } = renderHook(() => usePermissions());
        expect(result.current.hasPermission(Permission.PITCH_MODERATE)).toBe(false);
      });

      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PITCH_MODERATE)).toBe(true);
    });

    it('only admin can view any user', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.USER_VIEW_ANY)).toBe(false);
      expect(result.current.hasPermission(Permission.USER_VIEW_OWN)).toBe(true);
    });

    it('investor can export financial data, creator cannot', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result: investorResult } = renderHook(() => usePermissions());
      expect(investorResult.current.hasPermission(Permission.FINANCIAL_EXPORT)).toBe(true);

      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result: creatorResult } = renderHook(() => usePermissions());
      expect(creatorResult.current.hasPermission(Permission.FINANCIAL_EXPORT)).toBe(false);
    });

    it('production can request NDAs but creator cannot', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('production');
      const { result: prodResult } = renderHook(() => usePermissions());
      expect(prodResult.current.hasPermission(Permission.NDA_REQUEST)).toBe(true);

      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');
      const { result: creatorResult } = renderHook(() => usePermissions());
      expect(creatorResult.current.hasPermission(Permission.NDA_REQUEST)).toBe(false);
    });

    it('only admin can broadcast messages', () => {
      const nonAdminRoles = ['creator', 'investor', 'production', 'viewer'] as const;
      nonAdminRoles.forEach(role => {
        mockBetterAuthStore.isAuthenticated = true;
        (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(role);
        const { result } = renderHook(() => usePermissions());
        expect(result.current.hasPermission(Permission.MESSAGE_BROADCAST)).toBe(false);
      });
    });

    it('only admin can refund payments', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('admin');
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission(Permission.PAYMENT_REFUND)).toBe(true);

      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('investor');
      const { result: investorResult } = renderHook(() => usePermissions());
      expect(investorResult.current.hasPermission(Permission.PAYMENT_REFUND)).toBe(false);
    });
  });

  // ─── Memoization & Stability ────────────────────────────────────────

  describe('memoization', () => {
    it('returns stable references across re-renders with same auth state', () => {
      mockBetterAuthStore.isAuthenticated = true;
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('creator');

      const { result, rerender } = renderHook(() => usePermissions());
      const firstPermissions = result.current.permissions;
      const firstHasPermission = result.current.hasPermission;

      rerender();

      expect(result.current.permissions).toBe(firstPermissions);
      expect(result.current.hasPermission).toBe(firstHasPermission);
    });
  });
});
