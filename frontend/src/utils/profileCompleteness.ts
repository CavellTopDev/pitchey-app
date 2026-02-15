import type { User } from '../types';

/**
 * Checks if a creator's profile is complete enough to access the portal.
 * Requires a full name (first + last) and a non-empty bio.
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;

  const nameParts = (user.name || '').trim().split(/\s+/);
  const hasFullName = nameParts.length >= 2 && nameParts[0].length > 0 && nameParts[1].length > 0;
  const hasBio = (user.bio || '').trim().length > 0;

  return hasFullName && hasBio;
}
