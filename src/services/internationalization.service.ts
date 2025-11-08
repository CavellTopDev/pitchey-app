// Internationalization Service - Multi-language support
import { db } from "../db/client.ts";
import { 
  translationKeys, 
  translations, 
  TranslationKey, 
  Translation 
} from "../db/schema.ts";
import { eq, and, desc, sql, inArray } from "npm:drizzle-orm@0.35.3";

export interface TranslationKeyData {
  keyPath: string;
  defaultValue: string;
  description?: string;
  context?: string;
  category?: string;
}

export interface TranslationData {
  translationKeyId: number;
  locale: string;
  value: string;
  isApproved?: boolean;
}

export interface TranslationFilter {
  locale?: string;
  category?: string;
  context?: string;
  isApproved?: boolean;
  keyPaths?: string[];
}

export class InternationalizationService {
  
  // Translation Keys Management
  async createTranslationKey(data: TranslationKeyData) {
    try {
      const [key] = await db.insert(translationKeys).values({
        keyPath: data.keyPath,
        defaultValue: data.defaultValue,
        description: data.description,
        context: data.context,
        category: data.category,
      }).returning();
      
      return key;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error(`Translation key "${data.keyPath}" already exists`);
      }
      throw new Error(`Failed to create translation key: ${error.message}`);
    }
  }

  async getTranslationKeys(filter: { category?: string; context?: string } = {}) {
    try {
      let query = db.select().from(translationKeys);
      
      const conditions = [];
      
      if (filter.category) {
        conditions.push(eq(translationKeys.category, filter.category));
      }
      
      if (filter.context) {
        conditions.push(eq(translationKeys.context, filter.context));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query.orderBy(translationKeys.keyPath);
    } catch (error) {
      throw new Error(`Failed to get translation keys: ${error.message}`);
    }
  }

  async getTranslationKey(keyPath: string) {
    try {
      const [key] = await db.select()
        .from(translationKeys)
        .where(eq(translationKeys.keyPath, keyPath));
      
      return key || null;
    } catch (error) {
      throw new Error(`Failed to get translation key: ${error.message}`);
    }
  }

  async updateTranslationKey(keyPath: string, data: Partial<TranslationKeyData>) {
    try {
      const [key] = await db.update(translationKeys)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(translationKeys.keyPath, keyPath))
        .returning();
      
      return key;
    } catch (error) {
      throw new Error(`Failed to update translation key: ${error.message}`);
    }
  }

  async deleteTranslationKey(keyPath: string) {
    try {
      const [deleted] = await db.delete(translationKeys)
        .where(eq(translationKeys.keyPath, keyPath))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete translation key: ${error.message}`);
    }
  }

  // Translations Management
  async createTranslation(data: TranslationData, translatedBy?: number) {
    try {
      const [translation] = await db.insert(translations).values({
        translationKeyId: data.translationKeyId,
        locale: data.locale,
        value: data.value,
        isApproved: data.isApproved || false,
        translatedBy,
      }).returning();
      
      return translation;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error(`Translation already exists for this key and locale`);
      }
      throw new Error(`Failed to create translation: ${error.message}`);
    }
  }

  async getTranslations(filter: TranslationFilter = {}) {
    try {
      let query = db.select({
        id: translations.id,
        translationKeyId: translations.translationKeyId,
        locale: translations.locale,
        value: translations.value,
        isApproved: translations.isApproved,
        translatedBy: translations.translatedBy,
        approvedBy: translations.approvedBy,
        createdAt: translations.createdAt,
        updatedAt: translations.updatedAt,
        keyPath: translationKeys.keyPath,
        defaultValue: translationKeys.defaultValue,
        description: translationKeys.description,
        context: translationKeys.context,
        category: translationKeys.category,
      })
      .from(translations)
      .leftJoin(translationKeys, eq(translations.translationKeyId, translationKeys.id));
      
      const conditions = [];
      
      if (filter.locale) {
        conditions.push(eq(translations.locale, filter.locale));
      }
      
      if (filter.category) {
        conditions.push(eq(translationKeys.category, filter.category));
      }
      
      if (filter.context) {
        conditions.push(eq(translationKeys.context, filter.context));
      }
      
      if (filter.isApproved !== undefined) {
        conditions.push(eq(translations.isApproved, filter.isApproved));
      }
      
      if (filter.keyPaths && filter.keyPaths.length > 0) {
        conditions.push(inArray(translationKeys.keyPath, filter.keyPaths));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query.orderBy(translationKeys.keyPath, translations.locale);
    } catch (error) {
      throw new Error(`Failed to get translations: ${error.message}`);
    }
  }

  async getTranslation(translationKeyId: number, locale: string) {
    try {
      const [translation] = await db.select()
        .from(translations)
        .where(and(
          eq(translations.translationKeyId, translationKeyId),
          eq(translations.locale, locale)
        ));
      
      return translation || null;
    } catch (error) {
      throw new Error(`Failed to get translation: ${error.message}`);
    }
  }

  async updateTranslation(id: number, data: Partial<TranslationData>) {
    try {
      const [translation] = await db.update(translations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, id))
        .returning();
      
      return translation;
    } catch (error) {
      throw new Error(`Failed to update translation: ${error.message}`);
    }
  }

  async deleteTranslation(id: number) {
    try {
      const [deleted] = await db.delete(translations)
        .where(eq(translations.id, id))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete translation: ${error.message}`);
    }
  }

  // High-level translation operations
  async getTranslationsForLocale(locale: string, approved = true): Promise<Record<string, string>> {
    try {
      const filter: TranslationFilter = { locale };
      if (approved) {
        filter.isApproved = true;
      }
      
      const translations = await this.getTranslations(filter);
      
      const translationMap: Record<string, string> = {};
      
      for (const translation of translations) {
        if (translation.keyPath) {
          translationMap[translation.keyPath] = translation.value;
        }
      }
      
      return translationMap;
    } catch (error) {
      throw new Error(`Failed to get translations for locale: ${error.message}`);
    }
  }

  async getTranslationsWithFallback(locale: string, fallbackLocale = 'en'): Promise<Record<string, string>> {
    try {
      // Get translations for the requested locale
      const primaryTranslations = await this.getTranslationsForLocale(locale, true);
      
      // Get fallback translations if different from primary
      let fallbackTranslations: Record<string, string> = {};
      if (locale !== fallbackLocale) {
        fallbackTranslations = await this.getTranslationsForLocale(fallbackLocale, true);
      }
      
      // Get all translation keys to ensure we have defaults
      const allKeys = await this.getTranslationKeys();
      
      const result: Record<string, string> = {};
      
      for (const key of allKeys) {
        // Priority: primary locale -> fallback locale -> default value
        result[key.keyPath] = 
          primaryTranslations[key.keyPath] ||
          fallbackTranslations[key.keyPath] ||
          key.defaultValue;
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get translations with fallback: ${error.message}`);
    }
  }

  async translateKey(keyPath: string, locale: string): Promise<string> {
    try {
      const key = await this.getTranslationKey(keyPath);
      if (!key) {
        throw new Error(`Translation key "${keyPath}" not found`);
      }
      
      const translation = await this.getTranslation(key.id, locale);
      
      if (translation && translation.isApproved) {
        return translation.value;
      }
      
      // Fallback to English if available
      if (locale !== 'en') {
        const fallback = await this.getTranslation(key.id, 'en');
        if (fallback && fallback.isApproved) {
          return fallback.value;
        }
      }
      
      // Final fallback to default value
      return key.defaultValue;
    } catch (error) {
      throw new Error(`Failed to translate key: ${error.message}`);
    }
  }

  // Bulk operations
  async bulkCreateTranslationKeys(keys: TranslationKeyData[]) {
    try {
      const results = [];
      
      for (const keyData of keys) {
        try {
          const result = await this.createTranslationKey(keyData);
          results.push(result);
        } catch (error) {
          // Continue with other keys if one fails
          console.warn(`Failed to create key "${keyData.keyPath}":`, error.message);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to bulk create translation keys: ${error.message}`);
    }
  }

  async bulkCreateTranslations(translationsData: Array<{
    keyPath: string;
    locale: string;
    value: string;
    isApproved?: boolean;
  }>, translatedBy?: number) {
    try {
      const results = [];
      
      for (const data of translationsData) {
        try {
          const key = await this.getTranslationKey(data.keyPath);
          if (!key) {
            throw new Error(`Translation key "${data.keyPath}" not found`);
          }
          
          const result = await this.createTranslation({
            translationKeyId: key.id,
            locale: data.locale,
            value: data.value,
            isApproved: data.isApproved,
          }, translatedBy);
          
          results.push(result);
        } catch (error) {
          console.warn(`Failed to create translation for "${data.keyPath}" (${data.locale}):`, error.message);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to bulk create translations: ${error.message}`);
    }
  }

  // Translation approval workflow
  async approveTranslation(id: number, approvedBy: number) {
    try {
      const [translation] = await db.update(translations)
        .set({
          isApproved: true,
          approvedBy,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, id))
        .returning();
      
      return translation;
    } catch (error) {
      throw new Error(`Failed to approve translation: ${error.message}`);
    }
  }

  async rejectTranslation(id: number) {
    try {
      const [translation] = await db.update(translations)
        .set({
          isApproved: false,
          approvedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, id))
        .returning();
      
      return translation;
    } catch (error) {
      throw new Error(`Failed to reject translation: ${error.message}`);
    }
  }

  // Analytics and utility methods
  async getTranslationStats() {
    try {
      const stats = await db.select({
        totalKeys: sql<number>`count(distinct ${translationKeys.keyPath})`,
        totalTranslations: sql<number>`count(${translations.id})`,
        approvedTranslations: sql<number>`sum(case when ${translations.isApproved} then 1 else 0 end)`,
        pendingTranslations: sql<number>`sum(case when not ${translations.isApproved} then 1 else 0 end)`,
        supportedLocales: sql<number>`count(distinct ${translations.locale})`,
      })
      .from(translationKeys)
      .leftJoin(translations, eq(translationKeys.id, translations.translationKeyId));
      
      return stats[0];
    } catch (error) {
      throw new Error(`Failed to get translation stats: ${error.message}`);
    }
  }

  async getSupportedLocales() {
    try {
      const locales = await db.selectDistinct({ 
        locale: translations.locale 
      }).from(translations);
      
      return locales.map(l => l.locale).sort();
    } catch (error) {
      throw new Error(`Failed to get supported locales: ${error.message}`);
    }
  }

  async getTranslationCompleteness(locale: string) {
    try {
      const stats = await db.select({
        totalKeys: sql<number>`count(${translationKeys.id})`,
        translatedKeys: sql<number>`count(${translations.id})`,
        approvedKeys: sql<number>`sum(case when ${translations.isApproved} then 1 else 0 end)`,
      })
      .from(translationKeys)
      .leftJoin(translations, and(
        eq(translationKeys.id, translations.translationKeyId),
        eq(translations.locale, locale)
      ));
      
      const result = stats[0];
      return {
        totalKeys: result.totalKeys,
        translatedKeys: result.translatedKeys,
        approvedKeys: result.approvedKeys,
        completeness: result.totalKeys > 0 ? (result.approvedKeys / result.totalKeys) * 100 : 0,
      };
    } catch (error) {
      throw new Error(`Failed to get translation completeness: ${error.message}`);
    }
  }

  // Initialize default translation keys for the platform
  async initializeDefaultKeys() {
    try {
      const defaultKeys: TranslationKeyData[] = [
        // Authentication
        { keyPath: 'auth.login.title', defaultValue: 'Login', category: 'auth', context: 'login' },
        { keyPath: 'auth.login.email', defaultValue: 'Email', category: 'auth', context: 'login' },
        { keyPath: 'auth.login.password', defaultValue: 'Password', category: 'auth', context: 'login' },
        { keyPath: 'auth.login.submit', defaultValue: 'Sign In', category: 'auth', context: 'login' },
        { keyPath: 'auth.register.title', defaultValue: 'Register', category: 'auth', context: 'register' },
        
        // Navigation
        { keyPath: 'nav.dashboard', defaultValue: 'Dashboard', category: 'navigation', context: 'header' },
        { keyPath: 'nav.pitches', defaultValue: 'Pitches', category: 'navigation', context: 'header' },
        { keyPath: 'nav.messages', defaultValue: 'Messages', category: 'navigation', context: 'header' },
        { keyPath: 'nav.profile', defaultValue: 'Profile', category: 'navigation', context: 'header' },
        
        // Portal descriptions
        { keyPath: 'portal.creator.title', defaultValue: 'Creator Portal', category: 'portals', context: 'selection' },
        { keyPath: 'portal.creator.description', defaultValue: 'Share your creative vision and connect with production companies and investors', category: 'portals', context: 'selection' },
        { keyPath: 'portal.investor.title', defaultValue: 'Investor Portal', category: 'portals', context: 'selection' },
        { keyPath: 'portal.investor.description', defaultValue: 'Discover promising film projects and investment opportunities', category: 'portals', context: 'selection' },
        { keyPath: 'portal.production.title', defaultValue: 'Production Portal', category: 'portals', context: 'selection' },
        { keyPath: 'portal.production.description', defaultValue: 'Find and develop the next blockbuster from talented creators', category: 'portals', context: 'selection' },
        
        // Common UI elements
        { keyPath: 'common.save', defaultValue: 'Save', category: 'ui', context: 'buttons' },
        { keyPath: 'common.cancel', defaultValue: 'Cancel', category: 'ui', context: 'buttons' },
        { keyPath: 'common.delete', defaultValue: 'Delete', category: 'ui', context: 'buttons' },
        { keyPath: 'common.edit', defaultValue: 'Edit', category: 'ui', context: 'buttons' },
        { keyPath: 'common.search', defaultValue: 'Search', category: 'ui', context: 'placeholders' },
        
        // Error messages
        { keyPath: 'error.required', defaultValue: 'This field is required', category: 'validation', context: 'form' },
        { keyPath: 'error.invalid_email', defaultValue: 'Please enter a valid email address', category: 'validation', context: 'form' },
        { keyPath: 'error.password_min', defaultValue: 'Password must be at least 8 characters', category: 'validation', context: 'form' },
        
        // Success messages
        { keyPath: 'success.saved', defaultValue: 'Successfully saved', category: 'success', context: 'form' },
        { keyPath: 'success.created', defaultValue: 'Successfully created', category: 'success', context: 'form' },
        { keyPath: 'success.updated', defaultValue: 'Successfully updated', category: 'success', context: 'form' },
      ];
      
      return await this.bulkCreateTranslationKeys(defaultKeys);
    } catch (error) {
      throw new Error(`Failed to initialize default translation keys: ${error.message}`);
    }
  }
}

// Export singleton instance
export const internationalizationService = new InternationalizationService();