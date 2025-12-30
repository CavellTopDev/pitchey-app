/**
 * GDPR and CCPA Compliance Implementation
 * Handles data privacy regulations compliance
 */

import { z } from 'zod';

export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'deletion' | 'portability' | 'rectification' | 'restriction';
  userId: string;
  email: string;
  requestDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  completedDate?: Date;
  notes?: string;
  data?: any;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  description: string;
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  version: string;
  expiryDate?: Date;
}

export interface PrivacyPreferences {
  userId: string;
  marketingEmails: boolean;
  analyticsTracking: boolean;
  personalizedAds: boolean;
  dataSharingPartners: boolean;
  performanceCookies: boolean;
  functionalCookies: boolean;
  essentialCookies: boolean; // Always true
  dataRetentionPeriod: number; // Days
  autoDeleteInactiveData: boolean;
}

export interface DataInventory {
  dataType: string;
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  retention: number; // Days
  encryption: boolean;
  thirdPartySharing: boolean;
  crossBorderTransfer: boolean;
  sensitiveData: boolean;
}

/**
 * GDPR Compliance Service
 */
export class GDPRCompliance {
  private static readonly DATA_INVENTORY: DataInventory[] = [
    {
      dataType: 'Email Address',
      purpose: 'Account creation and communication',
      legalBasis: 'contract',
      retention: 365 * 3, // 3 years
      encryption: true,
      thirdPartySharing: false,
      crossBorderTransfer: true,
      sensitiveData: false
    },
    {
      dataType: 'Name',
      purpose: 'User identification',
      legalBasis: 'contract',
      retention: 365 * 3,
      encryption: false,
      thirdPartySharing: false,
      crossBorderTransfer: true,
      sensitiveData: false
    },
    {
      dataType: 'IP Address',
      purpose: 'Security and fraud prevention',
      legalBasis: 'legitimate_interests',
      retention: 90,
      encryption: false,
      thirdPartySharing: false,
      crossBorderTransfer: false,
      sensitiveData: false
    },
    {
      dataType: 'Payment Information',
      purpose: 'Transaction processing',
      legalBasis: 'contract',
      retention: 365 * 7, // 7 years for tax purposes
      encryption: true,
      thirdPartySharing: true, // Payment processor
      crossBorderTransfer: true,
      sensitiveData: true
    },
    {
      dataType: 'Usage Analytics',
      purpose: 'Service improvement',
      legalBasis: 'consent',
      retention: 365,
      encryption: false,
      thirdPartySharing: false,
      crossBorderTransfer: false,
      sensitiveData: false
    }
  ];
  
  /**
   * Process data subject request
   */
  static async processDataSubjectRequest(request: DataSubjectRequest): Promise<any> {
    switch (request.type) {
      case 'access':
        return this.handleAccessRequest(request.userId);
      case 'deletion':
        return this.handleDeletionRequest(request.userId);
      case 'portability':
        return this.handlePortabilityRequest(request.userId);
      case 'rectification':
        return this.handleRectificationRequest(request.userId, request.data);
      case 'restriction':
        return this.handleRestrictionRequest(request.userId);
      default:
        throw new Error('Invalid request type');
    }
  }
  
  /**
   * Handle right to access request
   */
  private static async handleAccessRequest(userId: string): Promise<any> {
    // Collect all user data
    const userData = await this.collectUserData(userId);
    
    // Generate report
    return {
      userId,
      generatedAt: new Date(),
      dataCategories: this.DATA_INVENTORY,
      personalData: userData,
      processingPurposes: this.getProcessingPurposes(),
      dataRecipients: this.getDataRecipients(),
      retentionPeriods: this.getRetentionPeriods(),
      rights: this.getDataSubjectRights()
    };
  }
  
  /**
   * Handle right to deletion request
   */
  private static async handleDeletionRequest(userId: string): Promise<any> {
    // Check if deletion can be performed
    const canDelete = await this.checkDeletionEligibility(userId);
    
    if (!canDelete.eligible) {
      return {
        success: false,
        reason: canDelete.reason,
        alternativeAction: canDelete.alternativeAction
      };
    }
    
    // Perform deletion
    const deletionResult = await this.deleteUserData(userId);
    
    // Log deletion for compliance
    await this.logDeletion(userId, deletionResult);
    
    return {
      success: true,
      deletedCategories: deletionResult.categories,
      retainedCategories: deletionResult.retained,
      reason: 'User requested deletion under GDPR Article 17'
    };
  }
  
  /**
   * Handle data portability request
   */
  private static async handlePortabilityRequest(userId: string): Promise<any> {
    const userData = await this.collectUserData(userId);
    
    // Format data in machine-readable format (JSON)
    return {
      format: 'json',
      version: '1.0',
      exportDate: new Date(),
      userData,
      metadata: {
        userId,
        dataCategories: this.DATA_INVENTORY.map(d => d.dataType),
        exportCompliance: 'GDPR Article 20'
      }
    };
  }
  
  /**
   * Handle rectification request
   */
  private static async handleRectificationRequest(userId: string, corrections: any): Promise<any> {
    // Validate corrections
    const validatedCorrections = this.validateCorrections(corrections);
    
    // Apply corrections
    const result = await this.applyCorrections(userId, validatedCorrections);
    
    return {
      success: true,
      correctedFields: result.fields,
      timestamp: new Date(),
      compliance: 'GDPR Article 16'
    };
  }
  
  /**
   * Handle restriction request
   */
  private static async handleRestrictionRequest(userId: string): Promise<any> {
    // Restrict processing
    await this.restrictProcessing(userId);
    
    return {
      success: true,
      restrictedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      allowedOperations: ['storage', 'legal_claims'],
      compliance: 'GDPR Article 18'
    };
  }
  
  /**
   * Collect all user data
   */
  private static async collectUserData(userId: string): Promise<any> {
    // In production, this would query all databases and services
    return {
      profile: await this.getUserProfile(userId),
      activities: await this.getUserActivities(userId),
      preferences: await this.getUserPreferences(userId),
      consents: await this.getUserConsents(userId),
      communications: await this.getUserCommunications(userId)
    };
  }
  
  /**
   * Check deletion eligibility
   */
  private static async checkDeletionEligibility(userId: string): Promise<{
    eligible: boolean;
    reason?: string;
    alternativeAction?: string;
  }> {
    // Check for legal obligations
    const hasLegalObligations = await this.checkLegalObligations(userId);
    if (hasLegalObligations) {
      return {
        eligible: false,
        reason: 'Data must be retained for legal compliance',
        alternativeAction: 'Data will be automatically deleted after retention period'
      };
    }
    
    // Check for active contracts
    const hasActiveContracts = await this.checkActiveContracts(userId);
    if (hasActiveContracts) {
      return {
        eligible: false,
        reason: 'Active contracts require data retention',
        alternativeAction: 'Data can be deleted after contract completion'
      };
    }
    
    return { eligible: true };
  }
  
  // Placeholder methods - implement with actual database queries
  private static async getUserProfile(userId: string): Promise<any> {
    return { /* User profile data */ };
  }
  
  private static async getUserActivities(userId: string): Promise<any> {
    return { /* User activities */ };
  }
  
  private static async getUserPreferences(userId: string): Promise<any> {
    return { /* User preferences */ };
  }
  
  private static async getUserConsents(userId: string): Promise<any> {
    return { /* User consents */ };
  }
  
  private static async getUserCommunications(userId: string): Promise<any> {
    return { /* User communications */ };
  }
  
  private static async checkLegalObligations(userId: string): Promise<boolean> {
    return false; // Check for legal requirements
  }
  
  private static async checkActiveContracts(userId: string): Promise<boolean> {
    return false; // Check for active contracts
  }
  
  private static async deleteUserData(userId: string): Promise<any> {
    return { categories: [], retained: [] };
  }
  
  private static async logDeletion(userId: string, result: any): Promise<void> {
    // Log deletion for compliance
  }
  
  private static validateCorrections(corrections: any): any {
    return corrections; // Validate and sanitize
  }
  
  private static async applyCorrections(userId: string, corrections: any): Promise<any> {
    return { fields: [] };
  }
  
  private static async restrictProcessing(userId: string): Promise<void> {
    // Implement processing restriction
  }
  
  private static getProcessingPurposes(): string[] {
    return Array.from(new Set(this.DATA_INVENTORY.map(d => d.purpose)));
  }
  
  private static getDataRecipients(): string[] {
    return ['Internal systems', 'Payment processors', 'Email service providers'];
  }
  
  private static getRetentionPeriods(): Record<string, number> {
    const periods: Record<string, number> = {};
    this.DATA_INVENTORY.forEach(item => {
      periods[item.dataType] = item.retention;
    });
    return periods;
  }
  
  private static getDataSubjectRights(): string[] {
    return [
      'Right to access (Article 15)',
      'Right to rectification (Article 16)',
      'Right to erasure (Article 17)',
      'Right to restriction (Article 18)',
      'Right to portability (Article 20)',
      'Right to object (Article 21)',
      'Rights regarding automated decision-making (Article 22)'
    ];
  }
}

/**
 * CCPA Compliance Service
 */
export class CCPACompliance {
  /**
   * Handle consumer rights request
   */
  static async processConsumerRequest(
    type: 'opt_out' | 'delete' | 'know',
    userId: string
  ): Promise<any> {
    switch (type) {
      case 'opt_out':
        return this.handleOptOutRequest(userId);
      case 'delete':
        return this.handleDeleteRequest(userId);
      case 'know':
        return this.handleKnowRequest(userId);
      default:
        throw new Error('Invalid request type');
    }
  }
  
  /**
   * Handle opt-out of sale request
   */
  private static async handleOptOutRequest(userId: string): Promise<any> {
    // Mark user as opted out of data sale
    await this.setOptOutStatus(userId, true);
    
    return {
      success: true,
      optedOut: true,
      effectiveDate: new Date(),
      compliance: 'CCPA Section 1798.120'
    };
  }
  
  /**
   * Handle delete request
   */
  private static async handleDeleteRequest(userId: string): Promise<any> {
    // Similar to GDPR deletion but with CCPA-specific requirements
    const deletionResult = await this.deleteConsumerData(userId);
    
    return {
      success: true,
      deleted: deletionResult.deleted,
      exceptions: deletionResult.exceptions,
      compliance: 'CCPA Section 1798.105'
    };
  }
  
  /**
   * Handle right to know request
   */
  private static async handleKnowRequest(userId: string): Promise<any> {
    const data = await this.collectConsumerData(userId);
    
    return {
      categories: this.getDataCategories(),
      specificPieces: data,
      sources: this.getDataSources(),
      purposes: this.getBusinessPurposes(),
      thirdParties: this.getThirdPartyCategories(),
      compliance: 'CCPA Section 1798.100'
    };
  }
  
  private static async setOptOutStatus(userId: string, optedOut: boolean): Promise<void> {
    // Update user's opt-out status
  }
  
  private static async deleteConsumerData(userId: string): Promise<any> {
    return { deleted: [], exceptions: [] };
  }
  
  private static async collectConsumerData(userId: string): Promise<any> {
    return {};
  }
  
  private static getDataCategories(): string[] {
    return [
      'Identifiers',
      'Personal information categories',
      'Commercial information',
      'Internet activity',
      'Geolocation data',
      'Professional information',
      'Inferences drawn'
    ];
  }
  
  private static getDataSources(): string[] {
    return [
      'Directly from consumer',
      'Automatically collected',
      'Third-party sources'
    ];
  }
  
  private static getBusinessPurposes(): string[] {
    return [
      'Provide services',
      'Security and fraud prevention',
      'Legal compliance',
      'Internal operations',
      'Service improvement'
    ];
  }
  
  private static getThirdPartyCategories(): string[] {
    return [
      'Service providers',
      'Business partners',
      'Legal authorities (when required)'
    ];
  }
}

/**
 * Cookie Consent Manager
 */
export class CookieConsent {
  private static readonly COOKIE_CATEGORIES = {
    essential: {
      name: 'Essential',
      description: 'Required for basic site functionality',
      required: true,
      cookies: ['session_id', 'csrf_token', 'authToken']
    },
    functional: {
      name: 'Functional',
      description: 'Remember user preferences',
      required: false,
      cookies: ['language', 'theme', 'timezone']
    },
    analytics: {
      name: 'Analytics',
      description: 'Help us understand site usage',
      required: false,
      cookies: ['_ga', '_gid', 'analytics_id']
    },
    marketing: {
      name: 'Marketing',
      description: 'Personalized advertisements',
      required: false,
      cookies: ['ad_id', 'conversion_tracker']
    }
  };
  
  /**
   * Get current consent status
   */
  static getConsentStatus(): Record<string, boolean> {
    const stored = localStorage.getItem('cookie_consent');
    if (!stored) {
      return {
        essential: true,
        functional: false,
        analytics: false,
        marketing: false
      };
    }
    return JSON.parse(stored);
  }
  
  /**
   * Update consent
   */
  static updateConsent(categories: Record<string, boolean>): void {
    // Essential cookies are always enabled
    categories.essential = true;
    
    localStorage.setItem('cookie_consent', JSON.stringify(categories));
    
    // Apply consent choices
    this.applyConsentChoices(categories);
    
    // Log consent for compliance
    this.logConsent(categories);
  }
  
  /**
   * Apply consent choices
   */
  private static applyConsentChoices(categories: Record<string, boolean>): void {
    // Remove cookies for disabled categories
    for (const [category, enabled] of Object.entries(categories)) {
      if (!enabled && category !== 'essential') {
        const cookies = this.COOKIE_CATEGORIES[category as keyof typeof this.COOKIE_CATEGORIES]?.cookies || [];
        cookies.forEach(cookie => {
          this.deleteCookie(cookie);
        });
      }
    }
  }
  
  /**
   * Delete cookie
   */
  private static deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
  
  /**
   * Log consent for compliance
   */
  private static logConsent(categories: Record<string, boolean>): void {
    const consent: ConsentRecord = {
      id: `consent_${Date.now()}`,
      userId: this.getUserId(),
      purpose: 'cookie_consent',
      description: 'User cookie preferences',
      granted: true,
      timestamp: new Date(),
      ipAddress: this.getIPAddress(),
      version: '1.0',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    };
    
    // Send to backend
    
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent, categories }),
    });
  }
  
  private static getUserId(): string {
    return localStorage.getItem('userId') || 'anonymous';
  }
  
  private static getIPAddress(): string {
    return 'client_ip'; // Would be set by server
  }
}

export default { GDPRCompliance, CCPACompliance, CookieConsent };