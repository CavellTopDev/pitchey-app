/**
 * GDPR Consent Management System
 * Manages granular consent collection, withdrawal, and tracking
 */

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'cookies' | 'marketing' | 'analytics' | 'functional' | 'essential';
  status: 'granted' | 'denied' | 'withdrawn';
  timestamp: Date;
  version: string;
  ipAddress: string;
  userAgent: string;
  source: 'banner' | 'settings' | 'registration' | 'api';
  expirationDate?: Date;
}

export interface ConsentConfiguration {
  essential: {
    required: boolean;
    description: string;
    cookies: string[];
  };
  functional: {
    required: boolean;
    description: string;
    cookies: string[];
  };
  analytics: {
    required: boolean;
    description: string;
    cookies: string[];
  };
  marketing: {
    required: boolean;
    description: string;
    cookies: string[];
  };
}

export class ConsentManagementService {
  private readonly CONSENT_VERSION = '2025.1';
  private readonly CONSENT_EXPIRY_MONTHS = 13;

  /**
   * Initialize consent for new user
   */
  async initializeUserConsent(userId: string, ipAddress: string, userAgent: string): Promise<void> {
    // Create essential consent record (automatically granted)
    await this.recordConsent({
      id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      consentType: 'essential',
      status: 'granted',
      timestamp: new Date(),
      version: this.CONSENT_VERSION,
      ipAddress,
      userAgent,
      source: 'registration'
    });

    // Initialize other consent types as denied (require explicit consent)
    const consentTypes: Array<'functional' | 'analytics' | 'marketing'> = ['functional', 'analytics', 'marketing'];
    
    for (const type of consentTypes) {
      await this.recordConsent({
        id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        consentType: type,
        status: 'denied',
        timestamp: new Date(),
        version: this.CONSENT_VERSION,
        ipAddress,
        userAgent,
        source: 'registration'
      });
    }
  }

  /**
   * Update consent preferences
   */
  async updateConsent(
    userId: string,
    consents: Record<string, boolean>,
    source: 'banner' | 'settings' | 'api',
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    for (const [consentType, granted] of Object.entries(consents)) {
      // Skip essential cookies (always granted)
      if (consentType === 'essential') continue;

      const status = granted ? 'granted' : 'denied';
      const expirationDate = granted ? this.calculateExpirationDate() : undefined;

      await this.recordConsent({
        id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        consentType: consentType as any,
        status,
        timestamp: new Date(),
        version: this.CONSENT_VERSION,
        ipAddress,
        userAgent,
        source,
        expirationDate
      });

      // Apply consent to active cookies
      await this.applyCookieConsent(userId, consentType, granted);
    }

    // Log consent change for audit trail
    await this.logConsentChange(userId, consents, source);
  }

  /**
   * Withdraw specific consent
   */
  async withdrawConsent(
    userId: string,
    consentType: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.recordConsent({
      id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      consentType: consentType as any,
      status: 'withdrawn',
      timestamp: new Date(),
      version: this.CONSENT_VERSION,
      ipAddress,
      userAgent,
      source: 'settings'
    });

    // Remove associated cookies
    await this.removeCookiesByType(userId, consentType);
    
    // Stop related processing
    await this.stopProcessingByType(userId, consentType);
  }

  /**
   * Get current consent status for user
   */
  async getUserConsent(userId: string): Promise<Record<string, ConsentRecord | null>> {
    const consentTypes = ['essential', 'functional', 'analytics', 'marketing'];
    const consents: Record<string, ConsentRecord | null> = {};

    for (const type of consentTypes) {
      consents[type] = await this.getLatestConsent(userId, type);
    }

    return consents;
  }

  /**
   * Check if consent is valid and not expired
   */
  async isConsentValid(userId: string, consentType: string): Promise<boolean> {
    const consent = await this.getLatestConsent(userId, consentType);
    
    if (!consent || consent.status !== 'granted') {
      return false;
    }

    // Check expiration
    if (consent.expirationDate && consent.expirationDate < new Date()) {
      return false;
    }

    // Check if consent version is current
    if (consent.version !== this.CONSENT_VERSION) {
      return false;
    }

    return true;
  }

  /**
   * Get consent configuration for display
   */
  getConsentConfiguration(): ConsentConfiguration {
    return {
      essential: {
        required: true,
        description: 'Essential cookies required for basic platform functionality including authentication, security, and core features.',
        cookies: ['auth_token', 'csrf_token', 'session_id']
      },
      functional: {
        required: false,
        description: 'Functional cookies that enhance your experience with personalized features like language preferences and dashboard customization.',
        cookies: ['lang_pref', 'theme_mode', 'dashboard_layout']
      },
      analytics: {
        required: false,
        description: 'Analytics cookies help us understand how you use the platform so we can improve our services and user experience.',
        cookies: ['analytics_id', 'page_views', 'feature_usage']
      },
      marketing: {
        required: false,
        description: 'Marketing cookies enable personalized content and advertising relevant to your interests and platform activity.',
        cookies: ['campaign_source', 'ad_tracking', 'social_media']
      }
    };
  }

  /**
   * Generate consent banner data
   */
  async getConsentBannerData(userId?: string): Promise<{
    showBanner: boolean;
    currentConsents: Record<string, boolean>;
    configuration: ConsentConfiguration;
  }> {
    let showBanner = true;
    let currentConsents: Record<string, boolean> = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false
    };

    if (userId) {
      const userConsents = await this.getUserConsent(userId);
      showBanner = !userConsents.functional && !userConsents.analytics && !userConsents.marketing;
      
      currentConsents = {
        essential: true, // Always true
        functional: userConsents.functional?.status === 'granted' || false,
        analytics: userConsents.analytics?.status === 'granted' || false,
        marketing: userConsents.marketing?.status === 'granted' || false
      };
    }

    return {
      showBanner,
      currentConsents,
      configuration: this.getConsentConfiguration()
    };
  }

  /**
   * Handle consent expiration check and renewal
   */
  async checkConsentExpiration(userId: string): Promise<{
    expired: string[];
    renewalRequired: boolean;
  }> {
    const consents = await this.getUserConsent(userId);
    const expired: string[] = [];
    const now = new Date();

    for (const [type, consent] of Object.entries(consents)) {
      if (consent && consent.expirationDate && consent.expirationDate < now) {
        expired.push(type);
      }
    }

    return {
      expired,
      renewalRequired: expired.length > 0
    };
  }

  /**
   * Export consent history for data subject access request
   */
  async exportConsentHistory(userId: string): Promise<{
    consents: ConsentRecord[];
    summary: {
      totalRecords: number;
      firstConsentDate: Date;
      lastUpdated: Date;
      currentStatus: Record<string, string>;
    };
  }> {
    const allConsents = await this.getAllUserConsents(userId);
    const currentConsents = await this.getUserConsent(userId);

    const summary = {
      totalRecords: allConsents.length,
      firstConsentDate: allConsents[0]?.timestamp || new Date(),
      lastUpdated: allConsents[allConsents.length - 1]?.timestamp || new Date(),
      currentStatus: Object.fromEntries(
        Object.entries(currentConsents).map(([type, consent]) => [
          type,
          consent?.status || 'not_set'
        ])
      )
    };

    return {
      consents: allConsents,
      summary
    };
  }

  /**
   * Process consent for anonymous users (cookie-based)
   */
  async handleAnonymousConsent(
    sessionId: string,
    consents: Record<string, boolean>,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Store consent in session/cookie for anonymous users
    const consentData = {
      sessionId,
      consents,
      timestamp: new Date(),
      version: this.CONSENT_VERSION,
      ipAddress,
      userAgent
    };

    await this.storeAnonymousConsent(sessionId, consentData);
    
    // Apply cookie preferences immediately
    await this.applyAnonymousCookieConsent(sessionId, consents);
  }

  /**
   * Transfer anonymous consent to user account
   */
  async transferAnonymousConsent(sessionId: string, userId: string): Promise<void> {
    const anonymousConsent = await this.getAnonymousConsent(sessionId);
    
    if (anonymousConsent) {
      await this.updateConsent(
        userId,
        anonymousConsent.consents,
        'registration',
        anonymousConsent.ipAddress,
        anonymousConsent.userAgent
      );

      // Clean up anonymous consent data
      await this.removeAnonymousConsent(sessionId);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(dateRange: { from: Date; to: Date }): Promise<{
    consentStats: {
      totalConsents: number;
      grantedConsents: number;
      deniedConsents: number;
      withdrawnConsents: number;
    };
    consentByType: Record<string, number>;
    consentBySource: Record<string, number>;
    expirationWarnings: number;
  }> {
    const consents = await this.getConsentsInRange(dateRange.from, dateRange.to);
    
    const stats = {
      totalConsents: consents.length,
      grantedConsents: consents.filter(c => c.status === 'granted').length,
      deniedConsents: consents.filter(c => c.status === 'denied').length,
      withdrawnConsents: consents.filter(c => c.status === 'withdrawn').length
    };

    const consentByType: Record<string, number> = {};
    const consentBySource: Record<string, number> = {};

    for (const consent of consents) {
      consentByType[consent.consentType] = (consentByType[consent.consentType] || 0) + 1;
      consentBySource[consent.source] = (consentBySource[consent.source] || 0) + 1;
    }

    const expirationWarnings = await this.countExpiringConsents();

    return {
      consentStats: stats,
      consentByType,
      consentBySource,
      expirationWarnings
    };
  }

  // Private utility methods
  private calculateExpirationDate(): Date {
    const expiration = new Date();
    expiration.setMonth(expiration.getMonth() + this.CONSENT_EXPIRY_MONTHS);
    return expiration;
  }

  private async recordConsent(consent: ConsentRecord): Promise<void> {
    // Implementation would save to database
  }

  private async getLatestConsent(userId: string, consentType: string): Promise<ConsentRecord | null> {
    // Implementation would query database for latest consent of type
    return null;
  }

  private async getAllUserConsents(userId: string): Promise<ConsentRecord[]> {
    // Implementation would fetch all consent records for user
    return [];
  }

  private async applyCookieConsent(userId: string, consentType: string, granted: boolean): Promise<void> {
    // Implementation would enable/disable cookies based on consent
  }

  private async removeCookiesByType(userId: string, consentType: string): Promise<void> {
    // Implementation would remove cookies of specific type
  }

  private async stopProcessingByType(userId: string, consentType: string): Promise<void> {
    // Implementation would stop data processing activities
  }

  private async logConsentChange(userId: string, consents: Record<string, boolean>, source: string): Promise<void> {
    // Implementation would log consent changes for audit
  }

  private async storeAnonymousConsent(sessionId: string, consentData: any): Promise<void> {
    // Implementation would store consent for anonymous users
  }

  private async getAnonymousConsent(sessionId: string): Promise<any> {
    // Implementation would retrieve anonymous consent
    return null;
  }

  private async removeAnonymousConsent(sessionId: string): Promise<void> {
    // Implementation would clean up anonymous consent data
  }

  private async applyAnonymousCookieConsent(sessionId: string, consents: Record<string, boolean>): Promise<void> {
    // Implementation would apply cookie preferences for anonymous users
  }

  private async getConsentsInRange(from: Date, to: Date): Promise<ConsentRecord[]> {
    // Implementation would query consents within date range
    return [];
  }

  private async countExpiringConsents(): Promise<number> {
    // Implementation would count consents expiring soon
    return 0;
  }
}