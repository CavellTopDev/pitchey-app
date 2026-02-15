import { describe, it, expect } from 'vitest';
import {
  getDashboardRoute,
  getLoginRoute,
  getProfileRoute,
  getSettingsRoute,
} from '../navigation';

// ============================================================================
// getDashboardRoute
// ============================================================================
describe('getDashboardRoute', () => {
  it('returns creator dashboard route', () => {
    expect(getDashboardRoute('creator')).toBe('/creator/dashboard');
  });

  it('returns investor dashboard route', () => {
    expect(getDashboardRoute('investor')).toBe('/investor/dashboard');
  });

  it('returns production dashboard route', () => {
    expect(getDashboardRoute('production')).toBe('/production/dashboard');
  });

  it('returns admin dashboard route', () => {
    expect(getDashboardRoute('admin')).toBe('/admin/dashboard');
  });

  it('returns "/" for null userType', () => {
    expect(getDashboardRoute(null)).toBe('/');
  });

  it('returns "/" for undefined userType', () => {
    expect(getDashboardRoute(undefined)).toBe('/');
  });

  it('returns "/" for unknown userType', () => {
    expect(getDashboardRoute('unknown')).toBe('/');
  });
});

// ============================================================================
// getLoginRoute
// ============================================================================
describe('getLoginRoute', () => {
  it('returns creator login route', () => {
    expect(getLoginRoute('creator')).toBe('/login/creator');
  });

  it('returns investor login route', () => {
    expect(getLoginRoute('investor')).toBe('/login/investor');
  });

  it('returns production login route', () => {
    expect(getLoginRoute('production')).toBe('/login/production');
  });

  it('returns admin login route', () => {
    expect(getLoginRoute('admin')).toBe('/login/admin');
  });

  it('returns "/login" for null', () => {
    expect(getLoginRoute(null)).toBe('/login');
  });

  it('returns "/login" for unknown type', () => {
    expect(getLoginRoute('unknown')).toBe('/login');
  });
});

// ============================================================================
// getProfileRoute
// ============================================================================
describe('getProfileRoute', () => {
  it('returns creator profile route', () => {
    expect(getProfileRoute('creator')).toBe('/creator/profile');
  });

  it('returns investor profile route', () => {
    expect(getProfileRoute('investor')).toBe('/investor/profile');
  });

  it('returns production profile route', () => {
    expect(getProfileRoute('production')).toBe('/production/profile');
  });

  it('returns admin profile route', () => {
    expect(getProfileRoute('admin')).toBe('/admin/profile');
  });

  it('returns "/profile" for null', () => {
    expect(getProfileRoute(null)).toBe('/profile');
  });

  it('returns "/profile" for unknown type', () => {
    expect(getProfileRoute('unknown')).toBe('/profile');
  });
});

// ============================================================================
// getSettingsRoute
// ============================================================================
describe('getSettingsRoute', () => {
  it('returns creator settings route', () => {
    expect(getSettingsRoute('creator')).toBe('/creator/settings');
  });

  it('returns investor settings route', () => {
    expect(getSettingsRoute('investor')).toBe('/investor/settings');
  });

  it('returns production settings route', () => {
    expect(getSettingsRoute('production')).toBe('/production/settings');
  });

  it('returns admin settings route', () => {
    expect(getSettingsRoute('admin')).toBe('/admin/settings');
  });

  it('returns "/settings" for null', () => {
    expect(getSettingsRoute(null)).toBe('/settings');
  });

  it('returns "/settings" for unknown type', () => {
    expect(getSettingsRoute('unknown')).toBe('/settings');
  });
});
