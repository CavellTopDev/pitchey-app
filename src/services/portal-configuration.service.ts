// Portal Configuration Service - Dynamic portal settings and branding
import { db } from "../db/client.ts";
import { portalConfigurations, PortalConfiguration } from "../db/schema.ts";
import { eq, and, desc } from "drizzle-orm";

export interface PortalConfigData {
  portalType: string;
  configKey: string;
  configValue: Record<string, any>;
  isSecret?: boolean;
  description?: string;
  validationSchema?: Record<string, any>;
  category?: string;
}

export interface ConfigFilter {
  portalType?: string;
  category?: string;
  includeSecrets?: boolean;
}

export class PortalConfigurationService {
  
  async setConfig(data: PortalConfigData, updatedBy?: number) {
    try {
      // Check if config already exists
      const existing = await this.getConfig(data.portalType, data.configKey);
      
      if (existing) {
        // Update existing config
        const [config] = await db.update(portalConfigurations)
          .set({
            configValue: data.configValue,
            isSecret: data.isSecret,
            description: data.description,
            validationSchema: data.validationSchema,
            category: data.category,
            updatedBy,
            updatedAt: new Date(),
          })
          .where(and(
            eq(portalConfigurations.portalType, data.portalType),
            eq(portalConfigurations.configKey, data.configKey)
          ))
          .returning();
        
        return config;
      } else {
        // Create new config
        const [config] = await db.insert(portalConfigurations).values({
          portalType: data.portalType,
          configKey: data.configKey,
          configValue: data.configValue,
          isSecret: data.isSecret || false,
          description: data.description,
          validationSchema: data.validationSchema,
          category: data.category,
          updatedBy,
        }).returning();
        
        return config;
      }
    } catch (error) {
      throw new Error(`Failed to set portal configuration: ${error.message}`);
    }
  }

  async getConfig(portalType: string, configKey: string) {
    try {
      const [config] = await db.select()
        .from(portalConfigurations)
        .where(and(
          eq(portalConfigurations.portalType, portalType),
          eq(portalConfigurations.configKey, configKey)
        ));
      
      return config || null;
    } catch (error) {
      throw new Error(`Failed to get portal configuration: ${error.message}`);
    }
  }

  async getConfigs(filter: ConfigFilter = {}) {
    try {
      let query = db.select().from(portalConfigurations);
      
      const conditions = [];
      
      if (filter.portalType) {
        conditions.push(eq(portalConfigurations.portalType, filter.portalType));
      }
      
      if (filter.category) {
        conditions.push(eq(portalConfigurations.category, filter.category));
      }
      
      if (!filter.includeSecrets) {
        conditions.push(eq(portalConfigurations.isSecret, false));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const configs = await query.orderBy(
        portalConfigurations.category,
        portalConfigurations.configKey
      );
      
      // Filter out secret values if not requested
      if (!filter.includeSecrets) {
        return configs.map(config => ({
          ...config,
          configValue: config.isSecret ? '[HIDDEN]' : config.configValue
        }));
      }
      
      return configs;
    } catch (error) {
      throw new Error(`Failed to get portal configurations: ${error.message}`);
    }
  }

  async getPortalConfig(portalType: string, includeSecrets = false) {
    try {
      const configs = await this.getConfigs({ portalType, includeSecrets });
      
      // Transform into nested object structure
      const configObject: Record<string, any> = {};
      
      for (const config of configs) {
        const keys = config.configKey.split('.');
        let current = configObject;
        
        // Navigate to the nested location
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        // Set the final value
        const finalKey = keys[keys.length - 1];
        current[finalKey] = config.configValue;
      }
      
      return configObject;
    } catch (error) {
      throw new Error(`Failed to get portal configuration object: ${error.message}`);
    }
  }

  async deleteConfig(portalType: string, configKey: string) {
    try {
      const [deleted] = await db.delete(portalConfigurations)
        .where(and(
          eq(portalConfigurations.portalType, portalType),
          eq(portalConfigurations.configKey, configKey)
        ))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete portal configuration: ${error.message}`);
    }
  }

  // Bulk configuration operations
  async setMultipleConfigs(portalType: string, configs: Record<string, any>, updatedBy?: number, category?: string) {
    try {
      const results = [];
      
      for (const [key, value] of Object.entries(configs)) {
        const configKey = this.flattenKey(key, configs);
        const result = await this.setConfig({
          portalType,
          configKey,
          configValue: value,
          category,
        }, updatedBy);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to set multiple configurations: ${error.message}`);
    }
  }

  // Predefined configuration templates
  async initializePortalDefaults(portalType: string, updatedBy?: number) {
    try {
      const defaults = this.getDefaultConfigs(portalType);
      const results = [];
      
      for (const config of defaults) {
        const result = await this.setConfig({
          ...config,
          portalType,
        }, updatedBy);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to initialize portal defaults: ${error.message}`);
    }
  }

  // Configuration validation
  async validateConfig(portalType: string, configKey: string, value: any) {
    try {
      const config = await this.getConfig(portalType, configKey);
      
      if (!config || !config.validationSchema) {
        return { valid: true };
      }
      
      // Basic validation against JSON schema
      const errors = this.validateAgainstSchema(value, config.validationSchema);
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  // Configuration categories
  async getConfigCategories(portalType?: string) {
    try {
      let query = db.selectDistinct({ 
        category: portalConfigurations.category 
      }).from(portalConfigurations);
      
      if (portalType) {
        query = query.where(eq(portalConfigurations.portalType, portalType));
      }
      
      const categories = await query;
      return categories.map(c => c.category).filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to get configuration categories: ${error.message}`);
    }
  }

  // Portal branding helpers
  async getBrandingConfig(portalType: string) {
    try {
      return await this.getConfigs({ 
        portalType, 
        category: 'branding', 
        includeSecrets: false 
      });
    } catch (error) {
      throw new Error(`Failed to get branding configuration: ${error.message}`);
    }
  }

  async getFeatureConfig(portalType: string) {
    try {
      return await this.getConfigs({ 
        portalType, 
        category: 'features', 
        includeSecrets: false 
      });
    } catch (error) {
      throw new Error(`Failed to get feature configuration: ${error.message}`);
    }
  }

  async getIntegrationConfig(portalType: string, includeSecrets = false) {
    try {
      return await this.getConfigs({ 
        portalType, 
        category: 'integrations', 
        includeSecrets 
      });
    } catch (error) {
      throw new Error(`Failed to get integration configuration: ${error.message}`);
    }
  }

  // Private helper methods
  private flattenKey(key: string, obj: any, prefix = ''): string {
    if (typeof obj !== 'object' || obj === null) {
      return prefix ? `${prefix}.${key}` : key;
    }
    
    return prefix ? `${prefix}.${key}` : key;
  }

  private getDefaultConfigs(portalType: string): Partial<PortalConfigData>[] {
    const commonDefaults = [
      {
        configKey: 'branding.primaryColor',
        configValue: { value: '#3B82F6' },
        category: 'branding',
        description: 'Primary brand color'
      },
      {
        configKey: 'branding.secondaryColor',
        configValue: { value: '#6B7280' },
        category: 'branding',
        description: 'Secondary brand color'
      },
      {
        configKey: 'features.messaging',
        configValue: { enabled: true },
        category: 'features',
        description: 'Enable messaging features'
      },
      {
        configKey: 'features.notifications',
        configValue: { enabled: true },
        category: 'features',
        description: 'Enable notification features'
      }
    ];

    const portalSpecificDefaults: Record<string, Partial<PortalConfigData>[]> = {
      creator: [
        {
          configKey: 'branding.tagline',
          configValue: { text: 'Share your creative vision with the world' },
          category: 'branding',
          description: 'Creator portal tagline'
        },
        {
          configKey: 'features.pitchUpload',
          configValue: { enabled: true, maxFileSize: '100MB' },
          category: 'features',
          description: 'Pitch upload settings'
        }
      ],
      investor: [
        {
          configKey: 'branding.tagline',
          configValue: { text: 'Discover and invest in tomorrow\'s blockbusters' },
          category: 'branding',
          description: 'Investor portal tagline'
        },
        {
          configKey: 'features.portfolioTracking',
          configValue: { enabled: true },
          category: 'features',
          description: 'Portfolio tracking features'
        }
      ],
      production: [
        {
          configKey: 'branding.tagline',
          configValue: { text: 'Transform creative visions into reality' },
          category: 'branding',
          description: 'Production portal tagline'
        },
        {
          configKey: 'features.projectManagement',
          configValue: { enabled: true },
          category: 'features',
          description: 'Project management features'
        }
      ]
    };

    return [
      ...commonDefaults,
      ...(portalSpecificDefaults[portalType] || [])
    ];
  }

  private validateAgainstSchema(value: any, schema: Record<string, any>): string[] {
    const errors: string[] = [];
    
    // Basic JSON schema validation
    if (schema.type && typeof value !== schema.type) {
      errors.push(`Expected type ${schema.type}, got ${typeof value}`);
    }
    
    if (schema.required && (value === null || value === undefined)) {
      errors.push('Value is required');
    }
    
    if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
      errors.push(`Minimum length is ${schema.minLength}`);
    }
    
    if (schema.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
      errors.push(`Maximum length is ${schema.maxLength}`);
    }
    
    if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push('Value does not match required pattern');
    }
    
    return errors;
  }
}

// Export singleton instance
export const portalConfigurationService = new PortalConfigurationService();