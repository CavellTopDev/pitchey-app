// Role-Based Access Control Service
import { createMongoAbility, MongoAbility, RawRuleOf, ForcedSubject, AbilityBuilder } from '@casl/ability';
import { db } from '../../db/client.ts';
import { users, pitches, ndas, investments, messages, roles, permissions, rolePermissions } from '../../db/schema.ts';
import { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';

// Define Actions
export const actions = [
  'manage', // Full access
  'create', 'read', 'update', 'delete', // CRUD operations
  'approve', 'reject', 'request', 'sign', // NDA actions
  'invest', 'withdraw', 'track', // Investment actions
  'message', 'broadcast', // Communication
  'moderate', 'feature', 'archive', // Admin actions
  'export', 'import', // Data operations
  'view_analytics', 'view_sensitive' // Special permissions
] as const;

// Define Subjects
export const subjects = [
  'all', // Everything
  'Pitch', 'User', 'NDA', 'Investment', 'Message',
  'Analytics', 'Settings', 'Report', 'Export',
  'Dashboard', 'Profile', 'Document', 'Review'
] as const;

// Type Definitions
export type AppActions = typeof actions[number];
export type AppSubjects = typeof subjects[number] | ForcedSubject<Exclude<typeof subjects[number], 'all'>>;
export type AppAbilities = [AppActions, AppSubjects];
export type AppAbility = MongoAbility<AppAbilities>;

// Condition types for field-level permissions
interface PitchConditions {
  creatorId?: number;
  status?: string;
  visibility?: string;
  ndaRequired?: boolean;
}

interface UserConditions {
  id?: number;
  userType?: string;
  emailVerified?: boolean;
  subscriptionTier?: string;
}

interface NDAConditions {
  requesterId?: number;
  creatorId?: number;
  pitchId?: number;
  status?: string;
  expiresAt?: Date;
}

interface InvestmentConditions {
  investorId?: number;
  pitchId?: number;
  status?: string;
  amount?: number;
}

// Role Permission Definitions
type DefinePermissions = (user: any, builder: AbilityBuilder<AppAbility>) => void;

interface RoleConfig {
  name: string;
  description: string;
  permissions: DefinePermissions;
  priority: number; // Higher priority overrides lower
}

// Define Role Configurations
export const roleConfigs: Record<string, RoleConfig> = {
  // Super Admin - Full system access
  superAdmin: {
    name: 'Super Administrator',
    description: 'Complete system access with all permissions',
    priority: 100,
    permissions: (user, { can }) => {
      can('manage', 'all');
    }
  },

  // Platform Admin - Manage platform operations
  admin: {
    name: 'Administrator',
    description: 'Platform administration and moderation',
    priority: 90,
    permissions: (user, { can, cannot }) => {
      // Admin permissions
      can(['read', 'update', 'delete', 'moderate', 'feature', 'archive'], 'Pitch');
      can(['read', 'update', 'delete', 'moderate'], 'User');
      can(['read', 'update', 'approve', 'reject'], 'NDA');
      can(['read', 'update'], 'Investment');
      can(['read', 'delete', 'broadcast'], 'Message');
      can(['read', 'export'], 'Analytics');
      can(['read', 'update'], 'Settings');
      can('view_analytics', 'Dashboard');
      can('view_sensitive', 'Report');
      
      // Cannot manage super admin users
      cannot('delete', 'User', { userType: 'superAdmin' });
      cannot('update', 'User', { userType: 'superAdmin' });
    }
  },

  // Creator Role - Content creators and pitch owners
  creator: {
    name: 'Creator',
    description: 'Content creators who can create and manage pitches',
    priority: 50,
    permissions: (user, { can, cannot }) => {
      // Pitch management
      can('create', 'Pitch');
      can(['read', 'update', 'delete'], 'Pitch', { creatorId: user.id });
      can('read', 'Pitch', { 
        visibility: { $in: ['public', 'unlisted'] }
      });
      
      // NDA management for their pitches
      can(['approve', 'reject'], 'NDA', { creatorId: user.id });
      can('read', 'NDA', { 
        $or: [
          { creatorId: user.id },
          { requesterId: user.id }
        ]
      });
      
      // Investment tracking
      can('read', 'Investment', { pitchId: { $in: user.ownedPitchIds || [] } });
      
      // Messaging
      can(['create', 'read'], 'Message');
      can('delete', 'Message', { senderId: user.id });
      
      // Analytics for their content
      can('view_analytics', 'Dashboard', { userId: user.id });
      can('read', 'Analytics', { creatorId: user.id });
      
      // Profile management
      can(['read', 'update'], 'Profile', { id: user.id });
      can('read', 'Profile'); // Can view other profiles
      
      // Cannot modify others' content
      cannot(['update', 'delete'], 'Pitch', { creatorId: { $ne: user.id } });
    }
  },

  // Investor Role - Can invest and request NDAs
  investor: {
    name: 'Investor',
    description: 'Investors who can browse pitches and make investments',
    priority: 40,
    permissions: (user, { can, cannot }) => {
      // Browse and read public pitches
      can('read', 'Pitch', {
        $or: [
          { visibility: 'public' },
          { ndaSignedBy: { $in: [user.id] } } // Can read NDA-protected if signed
        ]
      });
      
      // NDA requests
      can('request', 'NDA');
      can('sign', 'NDA', { requesterId: user.id, status: 'approved' });
      can('read', 'NDA', { requesterId: user.id });
      
      // Investments
      can('create', 'Investment');
      can(['read', 'update', 'withdraw'], 'Investment', { investorId: user.id });
      can('track', 'Investment', { investorId: user.id });
      
      // Messaging
      can(['create', 'read'], 'Message');
      can('delete', 'Message', { senderId: user.id });
      
      // Dashboard and analytics
      can('view_analytics', 'Dashboard', { userId: user.id });
      can('read', 'Analytics', { investorId: user.id });
      
      // Profile
      can(['read', 'update'], 'Profile', { id: user.id });
      can('read', 'Profile');
      
      // Restrictions
      cannot('create', 'Pitch'); // Investors cannot create pitches by default
      cannot(['update', 'delete'], 'Pitch');
      cannot(['approve', 'reject'], 'NDA');
    }
  },

  // Production Company Role
  productionCompany: {
    name: 'Production Company',
    description: 'Production companies evaluating pitches',
    priority: 45,
    permissions: (user, { can, cannot }) => {
      // Similar to investor but with additional permissions
      can('read', 'Pitch', {
        $or: [
          { visibility: 'public' },
          { ndaSignedBy: { $in: [user.id] } },
          { status: 'featured' } // Can see featured pitches
        ]
      });
      
      // Can create review reports
      can('create', 'Review');
      can(['read', 'update', 'delete'], 'Review', { reviewerId: user.id });
      
      // NDA with extended permissions
      can(['request', 'sign'], 'NDA');
      can('read', 'NDA', {
        $or: [
          { requesterId: user.id },
          { companyId: user.companyId }
        ]
      });
      
      // Investments with company tracking
      can('create', 'Investment');
      can(['read', 'update', 'track'], 'Investment', {
        $or: [
          { investorId: user.id },
          { companyId: user.companyId }
        ]
      });
      
      // Extended analytics
      can('view_analytics', 'Dashboard');
      can('view_sensitive', 'Report', { companyId: user.companyId });
      
      // Export capabilities
      can('export', 'Report');
      can('export', 'Analytics', { companyId: user.companyId });
      
      // Messaging with broadcast to team
      can(['create', 'read', 'broadcast'], 'Message', { companyId: user.companyId });
      
      // Profile and company management
      can(['read', 'update'], 'Profile', {
        $or: [
          { id: user.id },
          { companyId: user.companyId }
        ]
      });
      
      cannot(['update', 'delete'], 'Pitch');
      cannot(['approve', 'reject'], 'NDA', { creatorId: { $ne: user.id } });
    }
  },

  // Moderator Role - Content moderation
  moderator: {
    name: 'Moderator',
    description: 'Content moderation and quality control',
    priority: 60,
    permissions: (user, { can, cannot }) => {
      // Content moderation
      can(['read', 'moderate', 'archive'], 'Pitch');
      can('feature', 'Pitch', { quality_score: { $gte: 80 } });
      
      // User moderation
      can(['read', 'moderate'], 'User');
      can('update', 'User', { fields: ['status', 'warnings', 'restrictions'] });
      
      // Review and report management
      can(['read', 'create', 'update'], 'Review');
      can(['read', 'create'], 'Report');
      
      // Message moderation
      can(['read', 'delete'], 'Message', { reported: true });
      
      // Analytics access
      can('view_analytics', 'Dashboard');
      can('read', 'Analytics');
      
      // Cannot delete content permanently
      cannot('delete', 'Pitch');
      cannot('delete', 'User');
      cannot(['approve', 'reject'], 'NDA');
      cannot(['create', 'update', 'delete'], 'Investment');
    }
  },

  // Viewer Role - Basic read-only access
  viewer: {
    name: 'Viewer',
    description: 'Basic viewing permissions for public content',
    priority: 10,
    permissions: (user, { can, cannot }) => {
      // Can only read public content
      can('read', 'Pitch', { visibility: 'public' });
      can('read', 'Profile');
      
      // Basic profile management
      can(['read', 'update'], 'Profile', { id: user.id });
      
      // Cannot perform any modifications
      cannot('create', 'Pitch');
      cannot(['update', 'delete'], 'Pitch');
      cannot(['request', 'sign'], 'NDA');
      cannot('create', 'Investment');
      cannot('create', 'Message');
    }
  },

  // Guest Role - Unauthenticated users
  guest: {
    name: 'Guest',
    description: 'Unauthenticated user with minimal permissions',
    priority: 0,
    permissions: (user, { can, cannot }) => {
      // Only public content
      can('read', 'Pitch', { 
        visibility: 'public',
        status: { $in: ['published', 'featured'] }
      });
      
      // Cannot do anything else
      cannot('create', subjects);
      cannot('update', subjects);
      cannot('delete', subjects);
    }
  }
};

// Helper to get user's owned pitch IDs
async function getUserOwnedPitchIds(userId: number): Promise<number[]> {
  const userPitches = await db
    .select({ id: pitches.id })
    .from(pitches)
    .where(eq(pitches.creatorId, userId));
  
  return userPitches.map(p => p.id);
}

// Helper to get user's signed NDA pitch IDs
async function getUserSignedNDAPitchIds(userId: number): Promise<number[]> {
  const signedNDAs = await db
    .select({ pitchId: ndas.pitchId })
    .from(ndas)
    .where(
      and(
        eq(ndas.requesterId, userId),
        eq(ndas.status, 'signed')
      )
    );
  
  return signedNDAs.map(n => n.pitchId).filter(Boolean) as number[];
}

// Main function to define abilities for a user
export async function defineAbilityFor(user: any): Promise<AppAbility> {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  
  // Get user's additional context
  if (user && user.id) {
    user.ownedPitchIds = await getUserOwnedPitchIds(user.id);
    user.signedNDAPitchIds = await getUserSignedNDAPitchIds(user.id);
  }
  
  // Determine user role (with fallback)
  const userRole = user?.role || user?.userType || 'guest';
  const roleConfig = roleConfigs[userRole] || roleConfigs.guest;
  
  // Apply role permissions
  roleConfig.permissions(user, builder);
  
  // Check for custom permissions (from database)
  if (user?.customPermissions) {
    applyCustomPermissions(user, builder);
  }
  
  // Check for temporary permissions (e.g., time-limited access)
  if (user?.temporaryPermissions) {
    applyTemporaryPermissions(user, builder);
  }
  
  return builder.build();
}

// Apply custom permissions from database
function applyCustomPermissions(user: any, builder: AbilityBuilder<AppAbility>) {
  if (!user.customPermissions || !Array.isArray(user.customPermissions)) return;
  
  user.customPermissions.forEach((permission: any) => {
    const { action, subject, conditions, granted } = permission;
    
    if (granted === false) {
      builder.cannot(action, subject, conditions);
    } else {
      builder.can(action, subject, conditions);
    }
  });
}

// Apply temporary permissions with expiry checking
function applyTemporaryPermissions(user: any, builder: AbilityBuilder<AppAbility>) {
  if (!user.temporaryPermissions || !Array.isArray(user.temporaryPermissions)) return;
  
  const now = new Date();
  
  user.temporaryPermissions.forEach((permission: any) => {
    const { action, subject, conditions, expiresAt } = permission;
    
    // Check if permission is still valid
    if (expiresAt && new Date(expiresAt) > now) {
      builder.can(action, subject, conditions);
    }
  });
}

// Check if user can perform action on subject
export function can(ability: AppAbility, action: AppActions, subject: AppSubjects, field?: string): boolean {
  if (field) {
    return ability.can(action, subject, field);
  }
  return ability.can(action, subject);
}

// Get permitted fields for a subject
export function permittedFieldsFor(ability: AppAbility, action: AppActions, subject: AppSubjects): string[] {
  const rules = ability.rulesFor(action, subject);
  const fields = new Set<string>();
  
  rules.forEach(rule => {
    if (rule.fields) {
      rule.fields.forEach(field => fields.add(field));
    }
  });
  
  return Array.from(fields);
}

// Filter query based on abilities
export function scopeQuery(ability: AppAbility, action: AppActions, subject: AppSubjects, query: any) {
  const rules = ability.rulesFor(action, subject);
  const conditions: any[] = [];
  
  rules.forEach(rule => {
    if (rule.conditions) {
      conditions.push(rule.conditions);
    }
  });
  
  if (conditions.length === 0) {
    return query; // No conditions, return original query
  }
  
  if (conditions.length === 1) {
    return { ...query, ...conditions[0] };
  }
  
  // Multiple conditions, use OR
  return {
    ...query,
    $or: conditions
  };
}

// Export ability creation helper
export function createAbility(rules: RawRuleOf<AppAbility>[] = []) {
  return createMongoAbility<AppAbility>(rules);
}

// Middleware helper for routes
export async function checkPermission(
  user: any,
  action: AppActions,
  subject: AppSubjects,
  conditions?: any
): Promise<boolean> {
  const ability = await defineAbilityFor(user);
  
  if (conditions) {
    return ability.can(action, subject, conditions);
  }
  
  return ability.can(action, subject);
}

// Role assignment helper
export async function assignRole(
  userId: number,
  role: string,
  sqlConnection: any
): Promise<void> {
  // Check if role exists
  if (!roleConfigs[role]) {
    throw new Error(`Invalid role: ${role}`);
  }
  
  // Update user role
  await sqlConnection
    .update(users)
    .set({ 
      userType: role,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));
}

// Get all permissions for a user
export async function getUserPermissions(user: any): Promise<string[]> {
  const ability = await defineAbilityFor(user);
  const permissions: string[] = [];
  
  // Get all rules and format them
  ability.rules.forEach(rule => {
    const action = Array.isArray(rule.action) ? rule.action.join(',') : rule.action;
    const subject = Array.isArray(rule.subject) ? rule.subject.join(',') : rule.subject;
    
    if (rule.inverted) {
      permissions.push(`cannot:${action}:${subject}`);
    } else {
      permissions.push(`can:${action}:${subject}`);
    }
  });
  
  return permissions;
}

export default {
  defineAbilityFor,
  createAbility,
  checkPermission,
  assignRole,
  getUserPermissions,
  can,
  permittedFieldsFor,
  scopeQuery
};