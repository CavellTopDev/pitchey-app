// Feature Flag Service - Dynamic feature management
import { db } from "../db/client.ts";
import { featureFlags, FeatureFlag } from "../db/schema.ts";
import { eq, and, sql, or, isNull } from "npm:drizzle-orm@0.35.3";

export interface FeatureFlagData {
  name: string;
  description?: string;
  isEnabled?: boolean;
  portalType?: string;
  userType?: string;
  rolloutPercentage?: number;
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface FeatureFlagContext {
  userId?: number;
  userType?: string;
  portalType?: string;
  userEmail?: string;
  customAttributes?: Record<string, any>;
}

export class FeatureFlagService {
  
  async createFeatureFlag(data: FeatureFlagData, createdBy?: number) {
    try {
      const [flag] = await db.insert(featureFlags).values({
        name: data.name,
        description: data.description,
        isEnabled: data.isEnabled || false,
        portalType: data.portalType,
        userType: data.userType,
        rolloutPercentage: data.rolloutPercentage || 0,
        conditions: data.conditions || {},
        metadata: data.metadata || {},
        createdBy,
        updatedBy: createdBy,
      }).returning();
      
      return flag;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error(`Feature flag "${data.name}" already exists`);
      }
      throw new Error(`Failed to create feature flag: ${error.message}`);
    }
  }

  async getFeatureFlags() {
    try {
      return await db.select().from(featureFlags).orderBy(featureFlags.name);
    } catch (error) {
      throw new Error(`Failed to get feature flags: ${error.message}`);
    }
  }

  async getFeatureFlag(name: string) {
    try {
      const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.name, name));
      return flag || null;
    } catch (error) {
      throw new Error(`Failed to get feature flag: ${error.message}`);
    }
  }

  async updateFeatureFlag(name: string, data: Partial<FeatureFlagData>, updatedBy?: number) {
    try {
      const [flag] = await db.update(featureFlags)
        .set({
          ...data,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.name, name))
        .returning();
      
      return flag;
    } catch (error) {
      throw new Error(`Failed to update feature flag: ${error.message}`);
    }
  }

  async deleteFeatureFlag(name: string) {
    try {
      const [deleted] = await db.delete(featureFlags)
        .where(eq(featureFlags.name, name))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete feature flag: ${error.message}`);
    }
  }

  // Toggle feature flag enabled state
  async toggleFeatureFlag(name: string, updatedBy?: number) {
    try {
      const flag = await this.getFeatureFlag(name);
      if (!flag) {
        throw new Error(`Feature flag "${name}" not found`);
      }
      
      return await this.updateFeatureFlag(name, { 
        isEnabled: !flag.isEnabled 
      }, updatedBy);
    } catch (error) {
      throw new Error(`Failed to toggle feature flag: ${error.message}`);
    }
  }

  // Check if a feature is enabled for a specific context
  async isFeatureEnabled(flagName: string, context: FeatureFlagContext = {}): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(flagName);
      
      if (!flag) {
        // Default to false if flag doesn't exist
        return false;
      }
      
      // If flag is globally disabled, return false
      if (!flag.isEnabled) {
        return false;
      }
      
      // Check portal type restriction
      if (flag.portalType && context.portalType && flag.portalType !== context.portalType) {
        return false;
      }
      
      // Check user type restriction
      if (flag.userType && context.userType && flag.userType !== context.userType) {
        return false;
      }
      
      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        const userId = context.userId || 0;
        const hash = this.generateUserHash(userId, flagName);
        const userPercentile = hash % 100;
        
        if (userPercentile >= flag.rolloutPercentage) {
          return false;
        }
      }
      
      // Check custom conditions
      if (flag.conditions && Object.keys(flag.conditions).length > 0) {
        const conditionsResult = this.evaluateConditions(flag.conditions, context);
        if (!conditionsResult) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      // In case of error, default to false for safety
      console.error(`Error checking feature flag "${flagName}":`, error);
      return false;
    }
  }

  // Get all enabled features for a context
  async getEnabledFeatures(context: FeatureFlagContext = {}): Promise<Record<string, boolean>> {
    try {
      const flags = await this.getFeatureFlags();
      const enabledFeatures: Record<string, boolean> = {};
      
      for (const flag of flags) {
        enabledFeatures[flag.name] = await this.isFeatureEnabled(flag.name, context);
      }
      
      return enabledFeatures;
    } catch (error) {
      throw new Error(`Failed to get enabled features: ${error.message}`);
    }
  }

  // Get portal-specific feature flags
  async getPortalFeatureFlags(portalType: string, context: FeatureFlagContext = {}): Promise<Record<string, boolean>> {
    try {
      const flags = await db.select()
        .from(featureFlags)
        .where(
          or(
            eq(featureFlags.portalType, portalType),
            isNull(featureFlags.portalType)
          )
        );
      
      const featureStates: Record<string, boolean> = {};
      
      for (const flag of flags) {
        featureStates[flag.name] = await this.isFeatureEnabled(flag.name, {
          ...context,
          portalType,
        });
      }
      
      return featureStates;
    } catch (error) {
      throw new Error(`Failed to get portal feature flags: ${error.message}`);
    }
  }

  // Bulk update feature flags
  async updateMultipleFlags(updates: Array<{ name: string; data: Partial<FeatureFlagData> }>, updatedBy?: number) {
    try {
      const results = [];
      
      for (const update of updates) {
        const result = await this.updateFeatureFlag(update.name, update.data, updatedBy);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to update multiple feature flags: ${error.message}`);
    }
  }

  // Feature flag analytics
  async getFeatureFlagStats() {
    try {
      const stats = await db.select({
        total: sql<number>`count(*)`,
        enabled: sql<number>`sum(case when ${featureFlags.isEnabled} then 1 else 0 end)`,
        disabled: sql<number>`sum(case when not ${featureFlags.isEnabled} then 1 else 0 end)`,
        portalSpecific: sql<number>`sum(case when ${featureFlags.portalType} is not null then 1 else 0 end)`,
        global: sql<number>`sum(case when ${featureFlags.portalType} is null then 1 else 0 end)`,
      }).from(featureFlags);
      
      return stats[0];
    } catch (error) {
      throw new Error(`Failed to get feature flag stats: ${error.message}`);
    }
  }

  // Private helper methods
  private generateUserHash(userId: number, flagName: string): number {
    // Simple hash function for consistent user bucketing
    const str = `${userId}-${flagName}`;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  private evaluateConditions(conditions: Record<string, any>, context: FeatureFlagContext): boolean {
    try {
      // Basic condition evaluation - can be extended for more complex logic
      for (const [key, expectedValue] of Object.entries(conditions)) {
        const contextValue = this.getContextValue(key, context);
        
        if (Array.isArray(expectedValue)) {
          // Check if context value is in the array
          if (!expectedValue.includes(contextValue)) {
            return false;
          }
        } else if (typeof expectedValue === 'object' && expectedValue !== null) {
          // Handle range conditions, regex, etc.
          if (expectedValue.min !== undefined && contextValue < expectedValue.min) {
            return false;
          }
          if (expectedValue.max !== undefined && contextValue > expectedValue.max) {
            return false;
          }
          if (expectedValue.regex && !new RegExp(expectedValue.regex).test(String(contextValue))) {
            return false;
          }
        } else {
          // Direct value comparison
          if (contextValue !== expectedValue) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }

  private getContextValue(key: string, context: FeatureFlagContext): any {
    // Support dot notation for nested properties
    const keys = key.split('.');
    let value: any = context;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();