/**
 * Production Deal Workflow with Multi-Party Interest Management
 * Implements 7-state workflow following entertainment industry standards
 */

export enum ProductionDealState {
  INTEREST = 'INTEREST',
  MEETING = 'MEETING',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CONTRACT = 'CONTRACT',
  PRODUCTION = 'PRODUCTION',
  COMPLETED = 'COMPLETED',
  // Terminal states
  WITHDRAWN = 'WITHDRAWN',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED'
}

export interface ProductionCompanyInterest {
  companyId: string;
  companyName: string;
  pitchId: string;
  status: ProductionDealState;
  expressedAt: Date;
  lastActivity: Date;
  waitlistedAt?: Date;
  exclusivityExpires?: Date;
  proposalDetails?: ProposalTerms;
  meetingScheduled?: MeetingDetails;
  contractId?: string;
  priority: number; // Lower number = higher priority
}

export interface ProposalTerms {
  proposalId: string;
  budget: number;
  productionTimeline: string;
  rightsRequested: RightsPackage;
  upfrontPayment: number;
  backendParticipation: number;
  distributionTerritory: string[];
  optionPeriod: number; // months
  purchasePrice: number;
  contingencies: string[];
  submittedAt: Date;
}

export interface RightsPackage {
  theatrical: boolean;
  streaming: boolean;
  television: boolean;
  merchandising: boolean;
  sequelRights: boolean;
  remakeRights: boolean;
  territory: 'worldwide' | 'domestic' | 'international' | string[];
  duration: number; // years
  exclusivity: boolean;
}

export interface MeetingDetails {
  meetingId: string;
  scheduledAt: Date;
  type: 'virtual' | 'in_person' | 'phone';
  attendees: string[];
  agenda: string;
  location?: string;
  meetingLink?: string;
  notes?: string;
  outcome?: 'proceed' | 'pass' | 'follow_up';
}

export interface ApprovalGate {
  stage: ProductionDealState;
  party: 'creator' | 'company' | 'legal';
  required: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export class ProductionDealWorkflow {
  private interests: Map<string, ProductionCompanyInterest[]> = new Map();
  private approvalGates: Map<string, ApprovalGate[]> = new Map();
  private readonly MAX_CONCURRENT_INTERESTS = 10;
  private readonly EXCLUSIVITY_PERIOD_DAYS = 45;
  
  /**
   * Express interest from a production company
   */
  async expressInterest(
    pitchId: string,
    companyId: string,
    companyName: string
  ): Promise<ProductionCompanyInterest> {
    const pitchInterests = this.interests.get(pitchId) || [];
    
    // Check if company already has active interest
    const existingInterest = pitchInterests.find(
      i => i.companyId === companyId && 
      !this.isTerminalState(i.status)
    );
    
    if (existingInterest) {
      throw new Error('Company already has active interest in this pitch');
    }
    
    // Check concurrent interest limit
    const activeInterests = pitchInterests.filter(
      i => !this.isTerminalState(i.status)
    );
    
    if (activeInterests.length >= this.MAX_CONCURRENT_INTERESTS) {
      throw new Error('Maximum concurrent interests reached for this pitch');
    }
    
    const newInterest: ProductionCompanyInterest = {
      companyId,
      companyName,
      pitchId,
      status: ProductionDealState.INTEREST,
      expressedAt: new Date(),
      lastActivity: new Date(),
      priority: activeInterests.length + 1
    };
    
    pitchInterests.push(newInterest);
    this.interests.set(pitchId, pitchInterests);
    
    return newInterest;
  }
  
  /**
   * Schedule a meeting between parties
   */
  async scheduleMeeting(
    pitchId: string,
    companyId: string,
    meetingDetails: MeetingDetails
  ): Promise<void> {
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    if (interest.status !== ProductionDealState.INTEREST) {
      throw new Error(`Cannot schedule meeting from state: ${interest.status}`);
    }
    
    // Require creator approval for meetings
    await this.requireApproval(pitchId, companyId, 'creator', 'Accept meeting request');
    
    interest.status = ProductionDealState.MEETING;
    interest.meetingScheduled = meetingDetails;
    interest.lastActivity = new Date();
  }
  
  /**
   * Submit a formal proposal
   */
  async submitProposal(
    pitchId: string,
    companyId: string,
    proposal: ProposalTerms
  ): Promise<void> {
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    if (interest.status !== ProductionDealState.MEETING) {
      throw new Error(`Cannot submit proposal from state: ${interest.status}`);
    }
    
    // Check meeting outcome
    if (interest.meetingScheduled?.outcome !== 'proceed') {
      throw new Error('Meeting must have positive outcome to submit proposal');
    }
    
    interest.status = ProductionDealState.PROPOSAL;
    interest.proposalDetails = proposal;
    interest.lastActivity = new Date();
    
    // Notify creator of new proposal
    await this.notifyCreatorOfProposal(pitchId, companyId, proposal);
  }
  
  /**
   * Enter negotiation with exclusivity
   */
  async enterNegotiation(
    pitchId: string,
    companyId: string
  ): Promise<void> {
    const pitchInterests = this.interests.get(pitchId) || [];
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    if (interest.status !== ProductionDealState.PROPOSAL) {
      throw new Error(`Cannot enter negotiation from state: ${interest.status}`);
    }
    
    // Check if another company already has exclusivity
    const existingExclusivity = pitchInterests.find(
      i => i.exclusivityExpires && i.exclusivityExpires > new Date()
    );
    
    if (existingExclusivity && existingExclusivity.companyId !== companyId) {
      throw new Error(`Exclusivity already granted to ${existingExclusivity.companyName} until ${existingExclusivity.exclusivityExpires}`);
    }
    
    // Move other interested parties to waitlist
    await this.moveOthersToWaitlist(pitchId, companyId);
    
    // Grant exclusivity
    interest.status = ProductionDealState.NEGOTIATION;
    interest.exclusivityExpires = new Date(
      Date.now() + this.EXCLUSIVITY_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );
    interest.lastActivity = new Date();
  }
  
  /**
   * Move to contract stage with multi-party approvals
   */
  async moveToContract(
    pitchId: string,
    companyId: string,
    contractId: string
  ): Promise<void> {
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    if (interest.status !== ProductionDealState.NEGOTIATION) {
      throw new Error(`Cannot move to contract from state: ${interest.status}`);
    }
    
    // Set up approval gates
    const approvalGates: ApprovalGate[] = [
      {
        stage: ProductionDealState.CONTRACT,
        party: 'creator',
        required: true,
        approved: false
      },
      {
        stage: ProductionDealState.CONTRACT,
        party: 'company',
        required: true,
        approved: false
      },
      {
        stage: ProductionDealState.CONTRACT,
        party: 'legal',
        required: true,
        approved: false
      }
    ];
    
    this.approvalGates.set(`${pitchId}-${companyId}`, approvalGates);
    
    interest.status = ProductionDealState.CONTRACT;
    interest.contractId = contractId;
    interest.lastActivity = new Date();
  }
  
  /**
   * Approve contract by party
   */
  async approveContract(
    pitchId: string,
    companyId: string,
    party: 'creator' | 'company' | 'legal',
    approvedBy: string,
    notes?: string
  ): Promise<boolean> {
    const gates = this.approvalGates.get(`${pitchId}-${companyId}`);
    if (!gates) {
      throw new Error('No approval gates found for this deal');
    }
    
    const gate = gates.find(
      g => g.stage === ProductionDealState.CONTRACT && g.party === party
    );
    
    if (!gate) {
      throw new Error(`No approval gate for ${party}`);
    }
    
    if (gate.approved) {
      throw new Error(`${party} has already approved`);
    }
    
    gate.approved = true;
    gate.approvedBy = approvedBy;
    gate.approvedAt = new Date();
    gate.notes = notes;
    
    // Check if all required approvals are complete
    const allApproved = gates
      .filter(g => g.stage === ProductionDealState.CONTRACT && g.required)
      .every(g => g.approved);
    
    if (allApproved) {
      await this.moveToProduction(pitchId, companyId);
    }
    
    return allApproved;
  }
  
  /**
   * Move to production stage
   */
  private async moveToProduction(
    pitchId: string,
    companyId: string
  ): Promise<void> {
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    interest.status = ProductionDealState.PRODUCTION;
    interest.lastActivity = new Date();
    
    // Notify all parties
    await this.notifyProductionStart(pitchId, companyId);
    
    // Automatically reject other waitlisted interests
    await this.rejectWaitlistedInterests(pitchId, companyId);
  }
  
  /**
   * Complete production deal
   */
  async completeDeal(
    pitchId: string,
    companyId: string
  ): Promise<void> {
    const interest = this.getCompanyInterest(pitchId, companyId);
    
    if (interest.status !== ProductionDealState.PRODUCTION) {
      throw new Error(`Cannot complete deal from state: ${interest.status}`);
    }
    
    interest.status = ProductionDealState.COMPLETED;
    interest.lastActivity = new Date();
  }
  
  /**
   * Handle exclusivity expiration
   */
  async handleExclusivityExpiration(pitchId: string): Promise<void> {
    const pitchInterests = this.interests.get(pitchId) || [];
    
    for (const interest of pitchInterests) {
      if (
        interest.status === ProductionDealState.NEGOTIATION &&
        interest.exclusivityExpires &&
        interest.exclusivityExpires < new Date()
      ) {
        // Exclusivity expired without contract
        console.log(`Exclusivity expired for ${interest.companyName} on pitch ${pitchId}`);
        
        // Move back to proposal state
        interest.status = ProductionDealState.PROPOSAL;
        interest.exclusivityExpires = undefined;
        
        // Notify waitlisted companies
        await this.notifyWaitlistedCompanies(pitchId);
      }
    }
  }
  
  /**
   * Move other interests to waitlist
   */
  private async moveOthersToWaitlist(
    pitchId: string,
    selectedCompanyId: string
  ): Promise<void> {
    const pitchInterests = this.interests.get(pitchId) || [];
    
    for (const interest of pitchInterests) {
      if (
        interest.companyId !== selectedCompanyId &&
        [ProductionDealState.INTEREST, ProductionDealState.MEETING, ProductionDealState.PROPOSAL].includes(interest.status)
      ) {
        interest.waitlistedAt = new Date();
        console.log(`Moved ${interest.companyName} to waitlist for pitch ${pitchId}`);
      }
    }
  }
  
  /**
   * Notify waitlisted companies when opportunity reopens
   */
  private async notifyWaitlistedCompanies(pitchId: string): Promise<void> {
    const pitchInterests = this.interests.get(pitchId) || [];
    const waitlisted = pitchInterests.filter(i => i.waitlistedAt);
    
    for (const interest of waitlisted) {
      // Reset waitlist status
      interest.waitlistedAt = undefined;
      
      // Send notification
      console.log(`Notifying ${interest.companyName} that pitch ${pitchId} is available again`);
    }
  }
  
  /**
   * Reject waitlisted interests when deal is finalized
   */
  private async rejectWaitlistedInterests(
    pitchId: string,
    selectedCompanyId: string
  ): Promise<void> {
    const pitchInterests = this.interests.get(pitchId) || [];
    
    for (const interest of pitchInterests) {
      if (interest.companyId !== selectedCompanyId && interest.waitlistedAt) {
        interest.status = ProductionDealState.REJECTED;
        interest.lastActivity = new Date();
        console.log(`Rejected waitlisted interest from ${interest.companyName} for pitch ${pitchId}`);
      }
    }
  }
  
  /**
   * Get specific company interest
   */
  private getCompanyInterest(
    pitchId: string,
    companyId: string
  ): ProductionCompanyInterest {
    const pitchInterests = this.interests.get(pitchId) || [];
    const interest = pitchInterests.find(i => i.companyId === companyId);
    
    if (!interest) {
      throw new Error(`No interest found for company ${companyId} on pitch ${pitchId}`);
    }
    
    return interest;
  }
  
  /**
   * Check if state is terminal
   */
  private isTerminalState(state: ProductionDealState): boolean {
    return [
      ProductionDealState.COMPLETED,
      ProductionDealState.WITHDRAWN,
      ProductionDealState.REJECTED,
      ProductionDealState.EXPIRED,
      ProductionDealState.TERMINATED
    ].includes(state);
  }
  
  /**
   * Get all interests for a pitch
   */
  getPitchInterests(pitchId: string): ProductionCompanyInterest[] {
    return this.interests.get(pitchId) || [];
  }
  
  /**
   * Get active negotiations with exclusivity
   */
  getActiveNegotiations(pitchId: string): ProductionCompanyInterest[] {
    const pitchInterests = this.interests.get(pitchId) || [];
    return pitchInterests.filter(
      i => i.status === ProductionDealState.NEGOTIATION &&
      i.exclusivityExpires &&
      i.exclusivityExpires > new Date()
    );
  }
  
  // Notification stubs (would integrate with actual notification service)
  
  private async requireApproval(
    pitchId: string,
    companyId: string,
    party: string,
    action: string
  ): Promise<void> {
    console.log(`Approval required from ${party} for ${action} on pitch ${pitchId} with company ${companyId}`);
  }
  
  private async notifyCreatorOfProposal(
    pitchId: string,
    companyId: string,
    proposal: ProposalTerms
  ): Promise<void> {
    console.log(`Notifying creator of new proposal for pitch ${pitchId} from company ${companyId}`);
  }
  
  private async notifyProductionStart(
    pitchId: string,
    companyId: string
  ): Promise<void> {
    console.log(`Notifying all parties of production start for pitch ${pitchId} with company ${companyId}`);
  }
}

/**
 * Production deal analytics
 */
export class ProductionDealAnalytics {
  constructor(private workflow: ProductionDealWorkflow) {}
  
  /**
   * Get conversion funnel metrics
   */
  getConversionFunnel(pitchId: string): Record<ProductionDealState, number> {
    const interests = this.workflow.getPitchInterests(pitchId);
    const funnel: Record<string, number> = {};
    
    for (const state of Object.values(ProductionDealState)) {
      funnel[state] = interests.filter(i => i.status === state).length;
    }
    
    return funnel as Record<ProductionDealState, number>;
  }
  
  /**
   * Calculate average time in each stage
   */
  getAverageTimeInStage(pitchId: string): Record<ProductionDealState, number> {
    const interests = this.workflow.getPitchInterests(pitchId);
    const times: Record<string, number[]> = {};
    
    for (const interest of interests) {
      // This would need event history to calculate properly
      // For now, returning placeholder
      times[interest.status] = times[interest.status] || [];
      times[interest.status].push(
        (interest.lastActivity.getTime() - interest.expressedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    
    const averages: Record<string, number> = {};
    for (const [stage, durations] of Object.entries(times)) {
      averages[stage] = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
    
    return averages as Record<ProductionDealState, number>;
  }
  
  /**
   * Get success rate by company
   */
  getCompanySuccessRate(companyId: string): number {
    let totalDeals = 0;
    let successfulDeals = 0;
    
    // Would iterate through all pitches
    // For now, returning placeholder
    return successfulDeals / totalDeals;
  }
}