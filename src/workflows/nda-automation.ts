/**
 * NDA Automation with DocuSign/PandaDoc Integration
 * Implements one-click NDA pattern with risk-based auto-approval
 */

export enum NDAState {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  VIEWED = 'VIEWED',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED'
}

export enum NDATemplateType {
  INVESTOR_STANDARD = 'INVESTOR_STANDARD',
  PRODUCTION_COMPANY = 'PRODUCTION_COMPANY',
  MUTUAL_NDA = 'MUTUAL_NDA'
}

export interface NDARequest {
  id: string;
  pitchId: string;
  requestorId: string;
  requestorType: 'investor' | 'production' | 'distributor';
  templateType: NDATemplateType;
  state: NDAState;
  
  // Document details
  envelopeId?: string; // DocuSign/PandaDoc ID
  documentUrl?: string;
  
  // Terms
  duration: number; // months
  jurisdiction: string;
  modifications: NDAModification[];
  
  // Timestamps
  createdAt: Date;
  viewedAt?: Date;
  signedAt?: Date;
  activatedAt?: Date;
  expiresAt?: Date;
  
  // Verification
  kycStatus?: 'pending' | 'verified' | 'failed';
  approvalPath?: 'AUTO' | 'LEGAL_REVIEW';
  approvalNotes?: string;
  
  // Access control
  pitchAccessGranted: boolean;
  accessRevokedAt?: Date;
}

export interface NDAModification {
  clause: string;
  originalText: string;
  modifiedText: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
}

export interface NDATemplate {
  id: string;
  type: NDATemplateType;
  name: string;
  version: string;
  
  // Template configuration
  autoApprovable: boolean;
  standardDuration: number; // months
  allowedJurisdictions: string[];
  requiredFields: string[];
  
  // Content
  documentTemplate: string; // Base64 encoded or URL
  clauses: NDAClauses;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  approvedBy: string;
}

export interface NDAClauses {
  confidentialInformation: string;
  permittedUse: string;
  nonCompete?: string;
  nonSolicitation?: string;
  termAndTermination: string;
  governingLaw: string;
  disputeResolution: string;
}

export class NDAAutomationService {
  private templates: Map<NDATemplateType, NDATemplate> = new Map();
  private activeNDAs: Map<string, NDARequest> = new Map();
  private readonly AUTO_APPROVAL_RULES = {
    maxDuration: 36, // months
    allowedJurisdictions: ['US', 'UK', 'CA', 'EU'],
    requireKYC: true,
    allowModifications: false
  };
  
  constructor() {
    this.initializeTemplates();
  }
  
  /**
   * Initialize standard NDA templates
   */
  private initializeTemplates(): void {
    // Investor Standard Template
    this.templates.set(NDATemplateType.INVESTOR_STANDARD, {
      id: 'nda-investor-standard-v1',
      type: NDATemplateType.INVESTOR_STANDARD,
      name: 'Standard Investor NDA',
      version: '1.0',
      autoApprovable: true,
      standardDuration: 24,
      allowedJurisdictions: ['US', 'UK', 'CA', 'EU'],
      requiredFields: ['name', 'email', 'company', 'title'],
      documentTemplate: '', // Would contain actual template
      clauses: {
        confidentialInformation: 'All non-public information related to the pitch...',
        permittedUse: 'Solely for evaluating potential investment...',
        termAndTermination: '24 months from execution date...',
        governingLaw: 'Laws of Delaware, USA',
        disputeResolution: 'Binding arbitration under AAA rules'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedBy: 'legal-team'
    });
    
    // Production Company Template
    this.templates.set(NDATemplateType.PRODUCTION_COMPANY, {
      id: 'nda-production-v1',
      type: NDATemplateType.PRODUCTION_COMPANY,
      name: 'Production Company NDA',
      version: '1.0',
      autoApprovable: false, // Requires legal review
      standardDuration: 36,
      allowedJurisdictions: ['US', 'UK', 'CA'],
      requiredFields: ['name', 'email', 'company', 'title', 'productionHistory'],
      documentTemplate: '', // Would contain actual template
      clauses: {
        confidentialInformation: 'All creative materials, scripts, treatments...',
        permittedUse: 'Evaluating production and distribution potential...',
        nonCompete: 'Shall not develop similar concepts for 18 months...',
        termAndTermination: '36 months from execution date...',
        governingLaw: 'Laws of California, USA',
        disputeResolution: 'Binding arbitration under JAMS rules'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedBy: 'legal-team'
    });
    
    // Mutual NDA Template
    this.templates.set(NDATemplateType.MUTUAL_NDA, {
      id: 'nda-mutual-v1',
      type: NDATemplateType.MUTUAL_NDA,
      name: 'Mutual NDA',
      version: '1.0',
      autoApprovable: false, // Always requires legal review
      standardDuration: 24,
      allowedJurisdictions: ['US'],
      requiredFields: ['name', 'email', 'company', 'title', 'mutualDisclosures'],
      documentTemplate: '', // Would contain actual template
      clauses: {
        confidentialInformation: 'All non-public information exchanged by either party...',
        permittedUse: 'Solely for evaluating potential business relationship...',
        termAndTermination: '24 months from execution date...',
        governingLaw: 'Negotiable',
        disputeResolution: 'Negotiable'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedBy: 'legal-team'
    });
  }
  
  /**
   * Create one-click NDA request
   */
  async createNDARequest(
    pitchId: string,
    requestorId: string,
    requestorType: 'investor' | 'production' | 'distributor',
    templateType: NDATemplateType = NDATemplateType.INVESTOR_STANDARD,
    customTerms?: Partial<NDARequest>
  ): Promise<NDARequest> {
    const template = this.templates.get(templateType);
    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }
    
    const ndaRequest: NDARequest = {
      id: crypto.randomUUID(),
      pitchId,
      requestorId,
      requestorType,
      templateType,
      state: NDAState.DRAFT,
      duration: customTerms?.duration || template.standardDuration,
      jurisdiction: customTerms?.jurisdiction || template.allowedJurisdictions[0],
      modifications: customTerms?.modifications || [],
      createdAt: new Date(),
      pitchAccessGranted: false
    };
    
    // Determine approval path
    ndaRequest.approvalPath = this.determineApprovalPath(ndaRequest, template);
    
    if (ndaRequest.approvalPath === 'AUTO') {
      // Auto-approve and send for signature
      await this.sendForSignature(ndaRequest);
    } else {
      // Queue for legal review
      await this.queueForLegalReview(ndaRequest);
    }
    
    this.activeNDAs.set(ndaRequest.id, ndaRequest);
    return ndaRequest;
  }
  
  /**
   * Determine if NDA can be auto-approved
   */
  private determineApprovalPath(
    ndaRequest: NDARequest,
    template: NDATemplate
  ): 'AUTO' | 'LEGAL_REVIEW' {
    // Check auto-approval rules
    const checks = {
      isStandardTemplate: template.autoApprovable,
      noModifications: ndaRequest.modifications.length === 0,
      standardDuration: ndaRequest.duration <= this.AUTO_APPROVAL_RULES.maxDuration,
      knownJurisdiction: this.AUTO_APPROVAL_RULES.allowedJurisdictions.includes(
        ndaRequest.jurisdiction
      ),
      recipientVerified: ndaRequest.kycStatus === 'verified' || !this.AUTO_APPROVAL_RULES.requireKYC
    };
    
    const canAutoApprove = Object.values(checks).every(check => check);
    
    console.log('Auto-approval checks:', checks);
    console.log('Auto-approval decision:', canAutoApprove ? 'AUTO' : 'LEGAL_REVIEW');
    
    return canAutoApprove ? 'AUTO' : 'LEGAL_REVIEW';
  }
  
  /**
   * Send NDA for signature via DocuSign/PandaDoc
   */
  private async sendForSignature(ndaRequest: NDARequest): Promise<void> {
    // In production, this would integrate with DocuSign/PandaDoc API
    const envelopeId = `env_${crypto.randomUUID()}`;
    
    // Simulate API call
    const response = await this.mockDocuSignAPI('create_envelope', {
      templateId: ndaRequest.templateType,
      recipients: [{ id: ndaRequest.requestorId }],
      customFields: {
        duration: ndaRequest.duration,
        jurisdiction: ndaRequest.jurisdiction
      }
    });
    
    ndaRequest.envelopeId = envelopeId;
    ndaRequest.documentUrl = `https://docusign.example.com/sign/${envelopeId}`;
    ndaRequest.state = NDAState.PENDING;
  }
  
  /**
   * Queue NDA for legal review
   */
  private async queueForLegalReview(ndaRequest: NDARequest): Promise<void> {
    console.log(`NDA ${ndaRequest.id} queued for legal review`);
    
    // Would integrate with legal review system
    await this.notifyLegalTeam(ndaRequest);
    
    // Track SLA
    this.trackSLA(ndaRequest.id, 'legal_review', 48); // 48 hour SLA
  }
  
  /**
   * Handle DocuSign webhook events
   */
  async handleDocuSignWebhook(event: DocuSignWebhookEvent): Promise<void> {
    const { envelopeId, status, eventDateTime } = event;
    
    // Find NDA by envelope ID
    const nda = Array.from(this.activeNDAs.values()).find(
      n => n.envelopeId === envelopeId
    );
    
    if (!nda) {
      console.warn(`NDA not found for envelope ${envelopeId}`);
      return;
    }
    
    switch (status) {
      case 'viewed':
        await this.transitionTo(nda.id, NDAState.VIEWED);
        nda.viewedAt = new Date(eventDateTime);
        break;
        
      case 'completed':
        await this.transitionTo(nda.id, NDAState.SIGNED);
        nda.signedAt = new Date(eventDateTime);
        await this.activateNDA(nda.id);
        break;
        
      case 'declined':
      case 'voided':
        await this.transitionTo(nda.id, NDAState.TERMINATED);
        break;
    }
  }
  
  /**
   * Activate signed NDA and grant pitch access
   */
  private async activateNDA(ndaId: string): Promise<void> {
    const nda = this.activeNDAs.get(ndaId);
    if (!nda) {
      throw new Error(`NDA ${ndaId} not found`);
    }
    
    if (nda.state !== NDAState.SIGNED) {
      throw new Error(`Cannot activate NDA in state ${nda.state}`);
    }
    
    nda.state = NDAState.ACTIVE;
    nda.activatedAt = new Date();
    nda.expiresAt = new Date(
      Date.now() + nda.duration * 30 * 24 * 60 * 60 * 1000
    );
    
    // Grant pitch access
    await this.grantPitchAccess(nda);
    
    // Schedule expiration
    await this.scheduleExpiration(nda);
    
    // Send confirmation
    await this.sendActivationConfirmation(nda);
  }
  
  /**
   * Grant access to pitch materials
   */
  private async grantPitchAccess(nda: NDARequest): Promise<void> {
    nda.pitchAccessGranted = true;
    
    // Would integrate with access control system
    await fetch('/api/pitch-access/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pitchId: nda.pitchId,
        userId: nda.requestorId,
        ndaId: nda.id,
        expiresAt: nda.expiresAt
      })
    });
  }
  
  /**
   * Schedule NDA expiration with reminders
   */
  private async scheduleExpiration(nda: NDARequest): Promise<void> {
    if (!nda.expiresAt) return;
    
    const expirationTime = nda.expiresAt.getTime();
    const now = Date.now();
    
    // Schedule reminders at 90, 60, 30, 7 days before expiration
    const reminderDays = [90, 60, 30, 7];
    
    for (const days of reminderDays) {
      const reminderTime = expirationTime - (days * 24 * 60 * 60 * 1000);
      if (reminderTime > now) {
        await this.scheduleReminder(nda.id, reminderTime, `${days} days until expiration`);
      }
    }
    
    // Schedule actual expiration
    await this.scheduleExpiration(nda.id, expirationTime);
  }
  
  /**
   * Handle NDA expiration
   */
  async handleExpiration(ndaId: string): Promise<void> {
    const nda = this.activeNDAs.get(ndaId);
    if (!nda) return;
    
    if (nda.state !== NDAState.ACTIVE) return;
    
    // Transition to expired
    nda.state = NDAState.EXPIRED;
    
    // Revoke pitch access
    await this.revokePitchAccess(nda);
    
    // Offer renewal
    await this.offerRenewal(nda);
  }
  
  /**
   * Revoke access to pitch materials
   */
  private async revokePitchAccess(nda: NDARequest): Promise<void> {
    nda.pitchAccessGranted = false;
    nda.accessRevokedAt = new Date();
    
    await fetch('/api/pitch-access/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pitchId: nda.pitchId,
        userId: nda.requestorId,
        ndaId: nda.id
      })
    });
  }
  
  /**
   * Offer NDA renewal
   */
  private async offerRenewal(nda: NDARequest): Promise<void> {
    // Send renewal offer notification
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: nda.requestorId,
        type: 'nda_renewal_offer',
        data: {
          ndaId: nda.id,
          pitchId: nda.pitchId,
          originalExpiry: nda.expiresAt
        }
      })
    });
  }
  
  /**
   * State transition helper
   */
  private async transitionTo(ndaId: string, newState: NDAState): Promise<void> {
    const nda = this.activeNDAs.get(ndaId);
    if (!nda) {
      throw new Error(`NDA ${ndaId} not found`);
    }
    
    const validTransitions: Partial<Record<NDAState, NDAState[]>> = {
      [NDAState.DRAFT]: [NDAState.PENDING],
      [NDAState.PENDING]: [NDAState.VIEWED, NDAState.TERMINATED],
      [NDAState.VIEWED]: [NDAState.SIGNED, NDAState.TERMINATED],
      [NDAState.SIGNED]: [NDAState.ACTIVE],
      [NDAState.ACTIVE]: [NDAState.EXPIRED, NDAState.TERMINATED]
    };
    
    const allowedStates = validTransitions[nda.state] || [];
    if (!allowedStates.includes(newState)) {
      throw new Error(`Invalid transition from ${nda.state} to ${newState}`);
    }
    
    nda.state = newState;
  }
  
  // Helper methods (would integrate with actual services)
  
  private async mockDocuSignAPI(action: string, data: any): Promise<any> {
    console.log(`Mock DocuSign API: ${action}`, data);
    return { success: true };
  }
  
  private async notifyLegalTeam(nda: NDARequest): Promise<void> {
    console.log(`Notifying legal team about NDA ${nda.id}`);
  }
  
  private trackSLA(ndaId: string, process: string, hours: number): void {
    console.log(`Tracking SLA: ${process} for NDA ${ndaId} - ${hours} hours`);
  }
  
  private async scheduleReminder(ndaId: string, time: number, message: string): Promise<void> {
    console.log(`Scheduling reminder for NDA ${ndaId} at ${new Date(time)}: ${message}`);
  }
  
  private async sendActivationConfirmation(nda: NDARequest): Promise<void> {
    console.log(`Sending activation confirmation for NDA ${nda.id}`);
  }
}

/**
 * DocuSign webhook event structure
 */
export interface DocuSignWebhookEvent {
  envelopeId: string;
  status: 'sent' | 'delivered' | 'viewed' | 'completed' | 'declined' | 'voided';
  eventDateTime: string;
  recipientEvents?: Array<{
    recipientId: string;
    status: string;
    signedDateTime?: string;
  }>;
}

/**
 * NDA template factory for different industries
 */
export class NDATemplateFactory {
  static createTemplate(
    industry: 'film' | 'tv' | 'streaming' | 'international'
  ): NDATemplate {
    const baseTemplate: Partial<NDATemplate> = {
      version: '1.0',
      autoApprovable: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedBy: 'legal-team'
    };
    
    switch (industry) {
      case 'film':
        return {
          ...baseTemplate,
          id: 'nda-film-v1',
          type: NDATemplateType.PRODUCTION_COMPANY,
          name: 'Film Production NDA',
          standardDuration: 36,
          allowedJurisdictions: ['US', 'CA'],
          requiredFields: ['name', 'email', 'company', 'imdbProfile'],
          documentTemplate: '',
          clauses: {
            confidentialInformation: 'All creative materials including scripts, treatments, concept art...',
            permittedUse: 'Solely for evaluating theatrical production and distribution...',
            nonCompete: 'Shall not develop substantially similar theatrical releases...',
            termAndTermination: '36 months from execution...',
            governingLaw: 'Laws of California, USA',
            disputeResolution: 'Arbitration in Los Angeles, CA'
          }
        } as NDATemplate;
        
      case 'streaming':
        return {
          ...baseTemplate,
          id: 'nda-streaming-v1',
          type: NDATemplateType.PRODUCTION_COMPANY,
          name: 'Streaming Platform NDA',
          standardDuration: 24,
          allowedJurisdictions: ['US', 'UK', 'EU'],
          requiredFields: ['name', 'email', 'company', 'platform'],
          documentTemplate: '',
          clauses: {
            confidentialInformation: 'All content proposals, series bibles, pilot scripts...',
            permittedUse: 'Evaluating for streaming platform acquisition or production...',
            termAndTermination: '24 months from execution...',
            governingLaw: 'Laws of Delaware, USA',
            disputeResolution: 'Binding arbitration under AAA rules'
          }
        } as NDATemplate;
        
      default:
        throw new Error(`Unknown industry: ${industry}`);
    }
  }
}