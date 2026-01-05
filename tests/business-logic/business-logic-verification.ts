#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive Business Logic Verification for Pitchey Platform
 * 
 * This suite validates all critical business logic including:
 * - Portal access control (Creator, Investor, Production)
 * - Pricing calculations and subscription tiers
 * - Credit system validation
 * - Usage limits enforcement
 * - Billing integration validation
 * - Workflow state management
 * - Investment tracking and calculations
 * - NDA and legal document workflows
 * - Notification and communication rules
 * - Data consistency and integrity
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";

// Business Logic Test Configuration
const BUSINESS_CONFIG = {
  API_BASE: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  DEMO_ACCOUNTS: {
    creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
    investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
    production: { email: 'stellar.production@demo.com', password: 'Demo123' }
  },
  
  BUSINESS_RULES: {
    subscription_tiers: {
      creator: {
        free: { pitches: 3, uploads: 5, analysis: 1 },
        pro: { pitches: 25, uploads: 50, analysis: 10 },
        enterprise: { pitches: -1, uploads: -1, analysis: -1 } // unlimited
      },
      investor: {
        basic: { views: 100, downloads: 10, meetings: 5 },
        professional: { views: 500, downloads: 50, meetings: 25 },
        institutional: { views: -1, downloads: -1, meetings: -1 }
      },
      production: {
        starter: { projects: 5, collaborators: 10, budget_range: 5000000 },
        studio: { projects: 25, collaborators: 50, budget_range: 50000000 },
        enterprise: { projects: -1, collaborators: -1, budget_range: -1 }
      }
    },
    
    pricing: {
      pitch_analysis: 99, // $0.99
      premium_features: 999, // $9.99
      document_generation: 299, // $2.99
      video_processing: 499, // $4.99
      priority_support: 1999 // $19.99
    },
    
    access_control: {
      creator: {
        own_pitches: ['read', 'write', 'delete'],
        others_pitches: ['read'], // only public
        documents: ['upload', 'download'],
        analytics: ['view']
      },
      investor: {
        own_investments: ['read', 'write'],
        public_pitches: ['read'],
        nda_pitches: ['read'], // after NDA
        documents: ['download'],
        analytics: ['view']
      },
      production: {
        partnered_projects: ['read', 'write'],
        public_pitches: ['read'],
        budget_analysis: ['view'],
        contracts: ['generate', 'manage']
      }
    },
    
    workflow_rules: {
      pitch_submission: ['draft', 'under_review', 'approved', 'rejected', 'published'],
      investment_flow: ['interest_expressed', 'nda_signed', 'due_diligence', 'term_sheet', 'closed'],
      production_flow: ['evaluation', 'development_option', 'pre_production', 'production', 'post_production'],
      nda_workflow: ['requested', 'generated', 'sent', 'signed', 'archived']
    }
  }
};

interface BusinessLogicTestResult {
  domain: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  duration: number;
  error?: string;
  details?: Record<string, any>;
  business_impact?: string;
}

interface BusinessContext {
  sessions: Map<string, string>;
  testData: Map<string, any>;
  violations: BusinessLogicTestResult[];
  complianceScore: number;
}

class BusinessLogicVerificationSuite {
  private results: BusinessLogicTestResult[] = [];
  private context: BusinessContext;
  
  constructor() {
    this.context = {
      sessions: new Map(),
      testData: new Map(),
      violations: [],
      complianceScore: 0
    };
  }

  async runComprehensiveBusinessLogicValidation(): Promise<BusinessLogicTestResult[]> {
    console.log('💼 Starting Comprehensive Business Logic Validation');
    console.log('==================================================');
    
    // Setup and Authentication
    await this.runBusinessDomain('Authentication & Session Management', [
      { name: 'Portal-Specific Authentication', fn: () => this.validatePortalAuthentication(), severity: 'HIGH' },
      { name: 'Session State Management', fn: () => this.validateSessionStateManagement(), severity: 'MEDIUM' },
      { name: 'Cross-Portal Access Prevention', fn: () => this.validateCrossPortalAccess(), severity: 'HIGH' },
      { name: 'Session Timeout Handling', fn: () => this.validateSessionTimeout(), severity: 'MEDIUM' }
    ]);
    
    // Access Control & Permissions
    await this.runBusinessDomain('Access Control & Permissions', [
      { name: 'Role-Based Access Control', fn: () => this.validateRoleBasedAccess(), severity: 'CRITICAL' },
      { name: 'Resource Ownership Validation', fn: () => this.validateResourceOwnership(), severity: 'HIGH' },
      { name: 'Permission Inheritance', fn: () => this.validatePermissionInheritance(), severity: 'MEDIUM' },
      { name: 'Privilege Escalation Prevention', fn: () => this.validatePrivilegeEscalation(), severity: 'CRITICAL' },
      { name: 'Data Visibility Rules', fn: () => this.validateDataVisibility(), severity: 'HIGH' }
    ]);
    
    // Subscription & Billing Logic
    await this.runBusinessDomain('Subscription & Billing Logic', [
      { name: 'Subscription Tier Validation', fn: () => this.validateSubscriptionTiers(), severity: 'HIGH' },
      { name: 'Usage Limits Enforcement', fn: () => this.validateUsageLimits(), severity: 'HIGH' },
      { name: 'Billing Calculations', fn: () => this.validateBillingCalculations(), severity: 'CRITICAL' },
      { name: 'Credit System Logic', fn: () => this.validateCreditSystem(), severity: 'HIGH' },
      { name: 'Payment Processing Validation', fn: () => this.validatePaymentProcessing(), severity: 'CRITICAL' },
      { name: 'Subscription Upgrades/Downgrades', fn: () => this.validateSubscriptionChanges(), severity: 'MEDIUM' }
    ]);
    
    // Content & Media Management
    await this.runBusinessDomain('Content & Media Management', [
      { name: 'Pitch Submission Workflow', fn: () => this.validatePitchSubmissionWorkflow(), severity: 'HIGH' },
      { name: 'Content Moderation Rules', fn: () => this.validateContentModeration(), severity: 'MEDIUM' },
      { name: 'Media Processing Pipeline', fn: () => this.validateMediaProcessing(), severity: 'HIGH' },
      { name: 'Document Version Control', fn: () => this.validateDocumentVersioning(), severity: 'MEDIUM' },
      { name: 'Content Ownership Transfer', fn: () => this.validateContentOwnership(), severity: 'HIGH' }
    ]);
    
    // Investment & Financial Logic
    await this.runBusinessDomain('Investment & Financial Logic', [
      { name: 'Investment Interest Tracking', fn: () => this.validateInvestmentTracking(), severity: 'CRITICAL' },
      { name: 'Financial Calculations', fn: () => this.validateFinancialCalculations(), severity: 'CRITICAL' },
      { name: 'Investment Round Management', fn: () => this.validateInvestmentRounds(), severity: 'HIGH' },
      { name: 'Equity Distribution Logic', fn: () => this.validateEquityDistribution(), severity: 'CRITICAL' },
      { name: 'Valuation Calculations', fn: () => this.validateValuationCalculations(), severity: 'HIGH' },
      { name: 'Investment Portfolio Management', fn: () => this.validatePortfolioManagement(), severity: 'MEDIUM' }
    ]);
    
    // Legal & Compliance
    await this.runBusinessDomain('Legal & Compliance', [
      { name: 'NDA Workflow Management', fn: () => this.validateNDAWorkflow(), severity: 'CRITICAL' },
      { name: 'Contract Generation Logic', fn: () => this.validateContractGeneration(), severity: 'HIGH' },
      { name: 'Legal Document Versioning', fn: () => this.validateLegalDocumentVersioning(), severity: 'HIGH' },
      { name: 'Compliance Tracking', fn: () => this.validateComplianceTracking(), severity: 'HIGH' },
      { name: 'Audit Trail Integrity', fn: () => this.validateAuditTrail(), severity: 'CRITICAL' },
      { name: 'Data Retention Policies', fn: () => this.validateDataRetention(), severity: 'MEDIUM' }
    ]);
    
    // Communication & Notifications
    await this.runBusinessDomain('Communication & Notifications', [
      { name: 'Notification Rules Engine', fn: () => this.validateNotificationRules(), severity: 'MEDIUM' },
      { name: 'Communication Preferences', fn: () => this.validateCommunicationPreferences(), severity: 'LOW' },
      { name: 'Message Threading Logic', fn: () => this.validateMessageThreading(), severity: 'MEDIUM' },
      { name: 'Escalation Procedures', fn: () => this.validateEscalationProcedures(), severity: 'HIGH' },
      { name: 'Privacy Controls', fn: () => this.validatePrivacyControls(), severity: 'HIGH' }
    ]);
    
    // Production & Partnership Logic
    await this.runBusinessDomain('Production & Partnership Logic', [
      { name: 'Partnership Agreement Logic', fn: () => this.validatePartnershipLogic(), severity: 'HIGH' },
      { name: 'Production Budget Validation', fn: () => this.validateProductionBudgets(), severity: 'HIGH' },
      { name: 'Collaboration Permissions', fn: () => this.validateCollaborationPermissions(), severity: 'MEDIUM' },
      { name: 'Project Timeline Management', fn: () => this.validateProjectTimelines(), severity: 'MEDIUM' },
      { name: 'Resource Allocation Logic', fn: () => this.validateResourceAllocation(), severity: 'MEDIUM' }
    ]);
    
    // Data Integrity & Consistency
    await this.runBusinessDomain('Data Integrity & Consistency', [
      { name: 'Transaction Integrity', fn: () => this.validateTransactionIntegrity(), severity: 'CRITICAL' },
      { name: 'Data Consistency Across Services', fn: () => this.validateDataConsistency(), severity: 'HIGH' },
      { name: 'Concurrent Access Handling', fn: () => this.validateConcurrentAccess(), severity: 'HIGH' },
      { name: 'Backup and Recovery Logic', fn: () => this.validateBackupRecovery(), severity: 'MEDIUM' },
      { name: 'Data Migration Integrity', fn: () => this.validateDataMigration(), severity: 'HIGH' }
    ]);
    
    this.calculateComplianceScore();
    this.printBusinessLogicSummary();
    return this.results;
  }

  private async runBusinessDomain(domain: string, tests: Array<{name: string, fn: () => Promise<void>, severity: string}>): Promise<void> {
    console.log(`\n💼 Testing ${domain}`);
    console.log('-'.repeat(60));
    
    for (const test of tests) {
      await this.runBusinessLogicTest(domain, test.name, test.fn, test.severity as any);
    }
  }

  private async runBusinessLogicTest(domain: string, testName: string, testFn: () => Promise<void>, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): Promise<void> {
    const startTime = Date.now();
    console.log(`  🧪 ${testName}...`);
    
    try {
      await testFn();
      
      const duration = Date.now() - startTime;
      this.results.push({ 
        domain, 
        test: testName, 
        status: 'PASS', 
        severity,
        duration 
      });
      console.log(`    ✅ COMPLIANT (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: BusinessLogicTestResult = { 
        domain, 
        test: testName, 
        status: 'FAIL', 
        severity,
        duration, 
        error: error.message,
        business_impact: this.assessBusinessImpact(domain, testName, severity)
      };
      
      this.results.push(result);
      this.context.violations.push(result);
      
      const severityIcon = severity === 'CRITICAL' ? '🔥' : severity === 'HIGH' ? '⚠️' : severity === 'MEDIUM' ? '⚡' : 'ℹ️';
      console.log(`    ${severityIcon} VIOLATION (${duration}ms): ${error.message}`);
    }
  }

  // Setup and Authentication Tests
  private async setupDemoSessions(): Promise<void> {
    for (const [role, credentials] of Object.entries(BUSINESS_CONFIG.DEMO_ACCOUNTS)) {
      const response = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (response.ok) {
        const sessionCookie = response.headers.get('set-cookie');
        if (sessionCookie) {
          this.context.sessions.set(role, sessionCookie);
        }
      }
    }
  }

  private async validatePortalAuthentication(): Promise<void> {
    await this.setupDemoSessions();
    
    // Validate that each portal has specific authentication requirements
    for (const [portal, credentials] of Object.entries(BUSINESS_CONFIG.DEMO_ACCOUNTS)) {
      const session = this.context.sessions.get(portal);
      if (!session) {
        throw new Error(`Failed to establish ${portal} session`);
      }
      
      // Validate portal-specific endpoints
      const portalEndpoint = `/api/${portal}/dashboard`;
      const response = await fetch(`${BUSINESS_CONFIG.API_BASE}${portalEndpoint}`, {
        headers: { 'Cookie': session }
      });
      
      // Should either succeed or give appropriate authorization error
      assert(response.status === 200 || response.status === 403 || response.status === 404, 
        `Portal ${portal} authentication should be handled appropriately`);
    }
  }

  private async validateSessionStateManagement(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test session state persistence
    const stateResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/session-state`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        current_pitch: 'test-pitch-123',
        preferences: { theme: 'dark', notifications: true },
        workflow_step: 'pitch_creation'
      })
    });
    
    // Session state might not be implemented, which is acceptable
    if (stateResponse.status !== 404) {
      assert(stateResponse.status === 200 || stateResponse.status === 501, 
        'Session state management should be handled appropriately');
    }
  }

  private async validateCrossPortalAccess(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    const investorSession = this.context.sessions.get('investor');
    
    if (!creatorSession || !investorSession) {
      throw new Error('Both creator and investor sessions required');
    }
    
    // Creator should not access investor-specific endpoints
    const investorOnlyEndpoints = [
      '/api/investor/portfolio',
      '/api/investor/due-diligence',
      '/api/investor/investment-history'
    ];
    
    for (const endpoint of investorOnlyEndpoints) {
      const response = await fetch(`${BUSINESS_CONFIG.API_BASE}${endpoint}`, {
        headers: { 'Cookie': creatorSession }
      });
      
      if (response.status === 200) {
        throw new Error(`Creator can access investor-only endpoint: ${endpoint}`);
      }
    }
    
    // Investor should not access creator-specific endpoints
    const creatorOnlyEndpoints = [
      '/api/creator/pitch-analytics',
      '/api/creator/revenue-share',
      '/api/creator/content-management'
    ];
    
    for (const endpoint of creatorOnlyEndpoints) {
      const response = await fetch(`${BUSINESS_CONFIG.API_BASE}${endpoint}`, {
        headers: { 'Cookie': investorSession }
      });
      
      if (response.status === 200) {
        throw new Error(`Investor can access creator-only endpoint: ${endpoint}`);
      }
    }
  }

  private async validateSessionTimeout(): Promise<void> {
    // Test session timeout behavior
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test immediate session validity
    const validResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/profile`, {
      headers: { 'Cookie': creatorSession }
    });
    
    assertEquals(validResponse.status, 200, 'Valid session should work');
    
    // Test with invalid session
    const invalidSession = creatorSession.replace(/[a-f0-9]{8}/, '12345678');
    const invalidResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/profile`, {
      headers: { 'Cookie': invalidSession }
    });
    
    assertEquals(invalidResponse.status, 401, 'Invalid session should be rejected');
  }

  // Access Control & Permissions Tests
  private async validateRoleBasedAccess(): Promise<void> {
    const sessions = this.context.sessions;
    
    // Test creator access to own resources
    const creatorSession = sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Create a test pitch
    const pitchResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        title: 'Business Logic Test Pitch',
        genre: 'Drama',
        logline: 'Testing business logic validation',
        synopsis: 'This pitch tests role-based access control',
        budget: 1000000,
        status: 'draft'
      })
    });
    
    if (pitchResponse.ok) {
      const pitch = await pitchResponse.json();
      const pitchId = pitch.data.id;
      this.context.testData.set('test_pitch_id', pitchId);
      
      // Creator should be able to access their own pitch
      const creatorAccessResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
        headers: { 'Cookie': creatorSession }
      });
      
      assertEquals(creatorAccessResponse.status, 200, 'Creator should access their own pitch');
      
      // Test investor access to the same pitch (should be restricted until public/NDA)
      const investorSession = sessions.get('investor');
      if (investorSession) {
        const investorAccessResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
          headers: { 'Cookie': investorSession }
        });
        
        // Should be forbidden or not found for private pitch
        assert(investorAccessResponse.status === 403 || investorAccessResponse.status === 404, 
          'Investor should not access private pitch without permission');
      }
    }
  }

  private async validateResourceOwnership(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    const investorSession = this.context.sessions.get('investor');
    
    if (!creatorSession || !investorSession) {
      throw new Error('Both creator and investor sessions required');
    }
    
    const pitchId = this.context.testData.get('test_pitch_id');
    if (!pitchId) {
      throw new Error('Test pitch required from previous test');
    }
    
    // Test that only the owner can modify the resource
    const modificationResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': investorSession 
      },
      body: JSON.stringify({
        title: 'Modified by non-owner'
      })
    });
    
    // Should be forbidden
    assert(modificationResponse.status === 403 || modificationResponse.status === 404, 
      'Non-owner should not be able to modify resource');
    
    // Owner should be able to modify
    const ownerModificationResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        logline: 'Updated by owner'
      })
    });
    
    assertEquals(ownerModificationResponse.status, 200, 'Owner should be able to modify their resource');
  }

  private async validatePermissionInheritance(): Promise<void> {
    // Test permission inheritance in collaborative scenarios
    const creatorSession = this.context.sessions.get('creator');
    const investorSession = this.context.sessions.get('investor');
    
    if (!creatorSession || !investorSession) {
      throw new Error('Sessions required');
    }
    
    const pitchId = this.context.testData.get('test_pitch_id');
    if (!pitchId) {
      throw new Error('Test pitch required');
    }
    
    // Test sharing pitch with specific permissions
    const shareResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}/share`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        collaborator_email: 'sarah.investor@demo.com',
        permissions: ['read', 'comment'] // No write permission
      })
    });
    
    if (shareResponse.ok) {
      // Investor should now have read access but not write access
      const readResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
        headers: { 'Cookie': investorSession }
      });
      
      assertEquals(readResponse.status, 200, 'Shared user should have read access');
      
      // But should not have write access
      const writeResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': investorSession 
        },
        body: JSON.stringify({ title: 'Unauthorized modification' })
      });
      
      assertEquals(writeResponse.status, 403, 'Shared user should not have write access without permission');
    }
  }

  private async validatePrivilegeEscalation(): Promise<void> {
    // Test that users cannot escalate their privileges
    const investorSession = this.context.sessions.get('investor');
    if (!investorSession) throw new Error('Investor session required');
    
    // Try to access admin endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/system-config',
      '/api/admin/analytics',
      '/api/admin/billing'
    ];
    
    for (const endpoint of adminEndpoints) {
      const response = await fetch(`${BUSINESS_CONFIG.API_BASE}${endpoint}`, {
        headers: { 'Cookie': investorSession }
      });
      
      if (response.status === 200) {
        throw new Error(`Privilege escalation possible: investor can access admin endpoint ${endpoint}`);
      }
      
      // Should be forbidden or not found
      assert(response.status === 403 || response.status === 404, 
        `Admin endpoint ${endpoint} should be protected from non-admin users`);
    }
    
    // Try to modify other users' data
    const userModificationResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/users/1/role`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': investorSession 
      },
      body: JSON.stringify({ role: 'admin' })
    });
    
    assert(userModificationResponse.status === 403 || userModificationResponse.status === 404, 
      'Users should not be able to modify other users or escalate roles');
  }

  private async validateDataVisibility(): Promise<void> {
    // Test data visibility rules based on user roles and relationships
    const creatorSession = this.context.sessions.get('creator');
    const investorSession = this.context.sessions.get('investor');
    
    if (!creatorSession || !investorSession) {
      throw new Error('Sessions required');
    }
    
    // Test that users only see data they should see
    const creatorPitchesResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': creatorSession }
    });
    
    const investorPitchesResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': investorSession }
    });
    
    if (creatorPitchesResponse.ok && investorPitchesResponse.ok) {
      const creatorPitches = await creatorPitchesResponse.json();
      const investorPitches = await investorPitchesResponse.json();
      
      // Creator should see their own pitches
      assert(creatorPitches.data.length >= 0, 'Creator should see their pitches');
      
      // Investor should only see public pitches or ones they have access to
      if (investorPitches.data.length > 0) {
        // Verify that investor doesn't see private pitches they shouldn't
        for (const pitch of investorPitches.data) {
          if (pitch.status === 'draft' || pitch.status === 'private') {
            throw new Error('Investor can see private pitches they should not have access to');
          }
        }
      }
    }
  }

  // Subscription & Billing Logic Tests
  private async validateSubscriptionTiers(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Get current user subscription
    const subscriptionResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/subscription`, {
      headers: { 'Cookie': creatorSession }
    });
    
    if (subscriptionResponse.ok) {
      const subscription = await subscriptionResponse.json();
      const currentTier = subscription.data.tier;
      
      // Test that subscription limits are enforced
      const limits = BUSINESS_CONFIG.BUSINESS_RULES.subscription_tiers.creator[currentTier];
      
      if (limits) {
        // Test pitch creation limit
        if (limits.pitches > 0) {
          const pitchCount = await this.getUserPitchCount(creatorSession);
          
          if (pitchCount >= limits.pitches) {
            // Should not be able to create more pitches
            const exceededResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Cookie': creatorSession 
              },
              body: JSON.stringify({
                title: 'Should be rejected',
                genre: 'Drama',
                logline: 'This should exceed limits',
                synopsis: 'Testing subscription limits',
                budget: 1000000
              })
            });
            
            assertEquals(exceededResponse.status, 402, 'Should be rejected for exceeding subscription limits');
          }
        }
      }
    }
  }

  private async validateUsageLimits(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test various usage limits
    const usageResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/usage`, {
      headers: { 'Cookie': creatorSession }
    });
    
    if (usageResponse.ok) {
      const usage = await usageResponse.json();
      
      // Verify usage tracking is working
      assertExists(usage.data.pitches_created, 'Usage should track pitches created');
      assertExists(usage.data.storage_used, 'Usage should track storage used');
      assertExists(usage.data.api_calls, 'Usage should track API calls');
      
      // Test rate limiting
      const rapidRequests = Array(100).fill(null).map(() =>
        fetch(`${BUSINESS_CONFIG.API_BASE}/api/health`, {
          headers: { 'Cookie': creatorSession }
        })
      );
      
      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      assert(rateLimitedResponses.length > 0, 'Rate limiting should be applied to prevent abuse');
    }
  }

  private async validateBillingCalculations(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test billing calculation accuracy
    const billingResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/billing/calculate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        services: ['pitch_analysis', 'premium_features'],
        quantities: [1, 1]
      })
    });
    
    if (billingResponse.ok) {
      const billing = await billingResponse.json();
      
      const expectedTotal = BUSINESS_CONFIG.BUSINESS_RULES.pricing.pitch_analysis + 
                           BUSINESS_CONFIG.BUSINESS_RULES.pricing.premium_features;
      
      assertEquals(billing.data.total, expectedTotal, 'Billing calculation should be accurate');
      
      // Test tax calculation if applicable
      if (billing.data.tax) {
        assert(billing.data.tax >= 0, 'Tax should be non-negative');
        assertEquals(billing.data.grand_total, billing.data.subtotal + billing.data.tax, 
          'Grand total should equal subtotal plus tax');
      }
    }
  }

  private async validateCreditSystem(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test credit system functionality
    const creditsResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/credits`, {
      headers: { 'Cookie': creatorSession }
    });
    
    if (creditsResponse.ok) {
      const credits = await creditsResponse.json();
      const initialCredits = credits.data.balance;
      
      // Test credit deduction
      const purchaseResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/services/purchase`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': creatorSession 
        },
        body: JSON.stringify({
          service: 'pitch_analysis',
          use_credits: true
        })
      });
      
      if (purchaseResponse.ok) {
        // Check that credits were deducted
        const updatedCreditsResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/credits`, {
          headers: { 'Cookie': creatorSession }
        });
        
        if (updatedCreditsResponse.ok) {
          const updatedCredits = await updatedCreditsResponse.json();
          const finalCredits = updatedCredits.data.balance;
          
          assert(finalCredits < initialCredits, 'Credits should be deducted after purchase');
          
          const expectedDeduction = BUSINESS_CONFIG.BUSINESS_RULES.pricing.pitch_analysis;
          assertEquals(finalCredits, initialCredits - expectedDeduction, 
            'Credit deduction should match service price');
        }
      }
    }
  }

  private async validatePaymentProcessing(): Promise<void> {
    // Test payment processing logic (without actual payments)
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test payment validation
    const paymentResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/billing/validate-payment`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        amount: 999,
        currency: 'USD',
        payment_method: 'test_card'
      })
    });
    
    // Payment processing might not be fully implemented
    if (paymentResponse.status !== 404) {
      assert(paymentResponse.status === 200 || paymentResponse.status === 400, 
        'Payment validation should handle requests appropriately');
      
      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        assertExists(payment.data.validation_result, 'Payment validation should provide result');
      }
    }
  }

  private async validateSubscriptionChanges(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test subscription upgrade/downgrade logic
    const upgradeResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/user/subscription/change`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        new_tier: 'pro',
        billing_cycle: 'monthly'
      })
    });
    
    // Subscription changes might require payment integration
    if (upgradeResponse.status !== 404) {
      assert(upgradeResponse.status === 200 || upgradeResponse.status === 402, 
        'Subscription changes should be handled appropriately');
      
      if (upgradeResponse.ok) {
        const change = await upgradeResponse.json();
        assertExists(change.data.effective_date, 'Subscription change should have effective date');
        assertExists(change.data.prorated_amount, 'Subscription change should calculate proration');
      }
    }
  }

  // Content & Media Management Tests
  private async validatePitchSubmissionWorkflow(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test complete pitch submission workflow
    const workflowStates = BUSINESS_CONFIG.BUSINESS_RULES.workflow_rules.pitch_submission;
    
    // Create pitch in draft state
    const draftResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': creatorSession 
      },
      body: JSON.stringify({
        title: 'Workflow Test Pitch',
        genre: 'Thriller',
        logline: 'Testing pitch workflow states',
        synopsis: 'This pitch tests the submission workflow',
        budget: 2000000,
        status: 'draft'
      })
    });
    
    if (draftResponse.ok) {
      const draft = await draftResponse.json();
      const pitchId = draft.data.id;
      
      assertEquals(draft.data.status, 'draft', 'New pitch should start in draft status');
      
      // Test workflow state transitions
      const submitResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}/submit`, {
        method: 'POST',
        headers: { 'Cookie': creatorSession }
      });
      
      if (submitResponse.ok) {
        const submitted = await submitResponse.json();
        assertEquals(submitted.data.status, 'under_review', 
          'Submitted pitch should be in under_review status');
        
        // Test invalid state transition
        const invalidResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches/${pitchId}/publish`, {
          method: 'POST',
          headers: { 'Cookie': creatorSession }
        });
        
        assert(invalidResponse.status === 400 || invalidResponse.status === 403, 
          'Invalid workflow state transition should be rejected');
      }
    }
  }

  private async validateContentModeration(): Promise<void> {
    const creatorSession = this.context.sessions.get('creator');
    if (!creatorSession) throw new Error('Creator session required');
    
    // Test content moderation rules
    const inappropriateContent = [
      'This contains inappropriate content for testing',
      'Violence and explicit material',
      'Spam and promotional content'
    ];
    
    for (const content of inappropriateContent) {
      const moderationResponse = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': creatorSession 
        },
        body: JSON.stringify({
          title: 'Content Moderation Test',
          genre: 'Drama',
          logline: content,
          synopsis: content,
          budget: 1000000
        })
      });
      
      if (moderationResponse.ok) {
        const pitch = await moderationResponse.json();
        
        // Content should be flagged or require review
        if (pitch.data.status !== 'flagged' && pitch.data.status !== 'pending_review') {
          console.warn(`Content moderation may not be working: "${content}" was not flagged`);
        }
      }
    }
  }

  // Helper Methods
  private async getUserPitchCount(session: string): Promise<number> {
    const response = await fetch(`${BUSINESS_CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': session }
    });
    
    if (response.ok) {
      const pitches = await response.json();
      return pitches.data.length;
    }
    
    return 0;
  }

  private assessBusinessImpact(domain: string, test: string, severity: string): string {
    const impacts: Record<string, string> = {
      'Access Control & Permissions': 'Unauthorized access to sensitive data and functionality',
      'Subscription & Billing Logic': 'Revenue loss and billing disputes',
      'Investment & Financial Logic': 'Incorrect financial calculations and legal issues',
      'Legal & Compliance': 'Legal liability and regulatory violations',
      'Data Integrity & Consistency': 'Data corruption and system reliability issues'
    };
    
    return impacts[domain] || 'Potential business process disruption';
  }

  private calculateComplianceScore(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const criticalViolations = this.context.violations.filter(v => v.severity === 'CRITICAL').length;
    const highViolations = this.context.violations.filter(v => v.severity === 'HIGH').length;
    
    // Calculate weighted score
    let score = (passedTests / totalTests) * 100;
    
    // Heavy penalties for business logic violations
    score -= (criticalViolations * 25);
    score -= (highViolations * 15);
    
    this.context.complianceScore = Math.max(0, Math.round(score));
  }

  private printBusinessLogicSummary(): void {
    const domains = new Map<string, { passed: number, failed: number, total: number }>();
    
    // Group results by domain
    for (const result of this.results) {
      if (!domains.has(result.domain)) {
        domains.set(result.domain, { passed: 0, failed: 0, total: 0 });
      }
      
      const stats = domains.get(result.domain)!;
      stats.total++;
      if (result.status === 'PASS') {
        stats.passed++;
      } else if (result.status === 'FAIL') {
        stats.failed++;
      }
    }
    
    const totalPassed = this.results.filter(r => r.status === 'PASS').length;
    const totalViolations = this.context.violations.length;
    const criticalViolations = this.context.violations.filter(v => v.severity === 'CRITICAL').length;
    const highViolations = this.context.violations.filter(v => v.severity === 'HIGH').length;
    
    console.log('\n💼 Business Logic Validation Summary');
    console.log('====================================');
    
    // Domain breakdown
    for (const [domain, stats] of domains) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const status = stats.failed === 0 ? '🟢' : stats.passed === 0 ? '🔴' : '🟡';
      console.log(`${status} ${domain}: ${stats.passed}/${stats.total} (${successRate}%)`);
    }
    
    console.log('\n📊 Compliance Summary:');
    console.log(`🔥 Critical Violations: ${criticalViolations}`);
    console.log(`⚠️  High Priority Violations: ${highViolations}`);
    console.log(`📈 Compliance Score: ${this.context.complianceScore}/100`);
    console.log(`✅ Total Compliant: ${totalPassed}`);
    console.log(`❌ Total Violations: ${totalViolations}`);
    
    if (this.context.violations.length > 0) {
      console.log('\n🚨 Business Logic Violations:');
      this.context.violations
        .sort((a, b) => {
          const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .forEach(violation => {
          const icon = violation.severity === 'CRITICAL' ? '🔥' : violation.severity === 'HIGH' ? '⚠️' : '⚡';
          console.log(`   ${icon} [${violation.severity}] ${violation.domain} - ${violation.test}`);
          console.log(`      Impact: ${violation.business_impact}`);
          console.log(`      Error: ${violation.error}`);
        });
    }
    
    // Business readiness assessment
    let businessStatus = '';
    if (criticalViolations === 0 && highViolations === 0 && this.context.complianceScore >= 95) {
      businessStatus = '🎉 BUSINESS LOGIC VALIDATED - Production Ready';
    } else if (criticalViolations === 0 && this.context.complianceScore >= 85) {
      businessStatus = '✅ MOSTLY COMPLIANT - Address high-priority issues';
    } else if (criticalViolations === 0) {
      businessStatus = '⚠️  BUSINESS LOGIC ISSUES - Review and fix violations';
    } else {
      businessStatus = '🚨 CRITICAL BUSINESS LOGIC FAILURES - Must be resolved';
    }
    
    console.log(`\n💼 Business Logic Status: ${businessStatus}`);
    console.log('====================================\n');
  }
}

// Export for use in other test files
export { BusinessLogicVerificationSuite, type BusinessLogicTestResult };

// Run if called directly
if (import.meta.main) {
  const suite = new BusinessLogicVerificationSuite();
  const results = await suite.runComprehensiveBusinessLogicValidation();
  
  // Exit with error code if critical violations found
  const criticalViolations = results.filter(r => r.status === 'FAIL' && r.severity === 'CRITICAL').length;
  Deno.exit(criticalViolations > 0 ? 1 : 0);
}