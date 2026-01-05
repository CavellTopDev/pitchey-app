/**
 * Investment Deal State Machine with Event Sourcing
 * Implements 10-state workflow for SEC compliance and audit trails
 */

export enum InvestmentDealState {
  INTEREST = 'INTEREST',
  QUALIFICATION = 'QUALIFICATION', 
  NEGOTIATION = 'NEGOTIATION',
  TERM_SHEET = 'TERM_SHEET',
  DUE_DILIGENCE = 'DUE_DILIGENCE',
  COMMITMENT = 'COMMITMENT',
  ESCROW = 'ESCROW',
  CLOSING = 'CLOSING',
  FUNDED = 'FUNDED',
  COMPLETED = 'COMPLETED',
  // Terminal states
  WITHDRAWN = 'WITHDRAWN',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED'
}

export interface DealEvent {
  eventId: string;
  dealId: string;
  eventType: DealEventType;
  payload: any;
  timestamp: Date;
  userId: string;
  version: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
}

export enum DealEventType {
  // Interest events
  INTEREST_EXPRESSED = 'INTEREST_EXPRESSED',
  INTEREST_WITHDRAWN = 'INTEREST_WITHDRAWN',
  
  // Qualification events  
  QUALIFICATION_STARTED = 'QUALIFICATION_STARTED',
  ACCREDITATION_VERIFIED = 'ACCREDITATION_VERIFIED',
  QUALIFICATION_FAILED = 'QUALIFICATION_FAILED',
  
  // Negotiation events
  NEGOTIATION_INITIATED = 'NEGOTIATION_INITIATED',
  TERMS_PROPOSED = 'TERMS_PROPOSED',
  TERMS_COUNTER_OFFERED = 'TERMS_COUNTER_OFFERED',
  
  // Term sheet events
  TERM_SHEET_GENERATED = 'TERM_SHEET_GENERATED',
  TERM_SHEET_SIGNED = 'TERM_SHEET_SIGNED',
  TERM_SHEET_REJECTED = 'TERM_SHEET_REJECTED',
  
  // Due diligence events
  DUE_DILIGENCE_STARTED = 'DUE_DILIGENCE_STARTED',
  DOCUMENTS_REQUESTED = 'DOCUMENTS_REQUESTED',
  DOCUMENTS_PROVIDED = 'DOCUMENTS_PROVIDED',
  DUE_DILIGENCE_COMPLETED = 'DUE_DILIGENCE_COMPLETED',
  
  // Commitment events
  COMMITMENT_MADE = 'COMMITMENT_MADE',
  COMMITMENT_AMENDED = 'COMMITMENT_AMENDED',
  COMMITMENT_CANCELLED = 'COMMITMENT_CANCELLED',
  
  // Escrow events
  FUNDS_ESCROWED = 'FUNDS_ESCROWED',
  ESCROW_VERIFIED = 'ESCROW_VERIFIED',
  ESCROW_RELEASED = 'ESCROW_RELEASED',
  ESCROW_REFUNDED = 'ESCROW_REFUNDED',
  
  // Closing events
  CLOSING_INITIATED = 'CLOSING_INITIATED',
  DOCUMENTS_EXECUTED = 'DOCUMENTS_EXECUTED',
  CLOSING_COMPLETED = 'CLOSING_COMPLETED',
  
  // Funding events
  FUNDS_TRANSFERRED = 'FUNDS_TRANSFERRED',
  TRANSFER_CONFIRMED = 'TRANSFER_CONFIRMED',
  
  // Completion events
  DEAL_COMPLETED = 'DEAL_COMPLETED',
  DEAL_FAILED = 'DEAL_FAILED',
  DEAL_EXPIRED = 'DEAL_EXPIRED'
}

export interface DealState {
  dealId: string;
  currentState: InvestmentDealState;
  pitchId: string;
  investorId: string;
  creatorId: string;
  
  // Financial details
  targetAmount: number;
  minimumAmount: number;
  totalCommitted: number;
  totalEscrowed: number;
  totalFunded: number;
  
  // Dates
  createdAt: Date;
  qualificationDeadline?: Date;
  closingDeadline?: Date;
  fundingDeadline?: Date;
  
  // Regulatory
  regulationType: 'REG_CF' | 'REG_D_506B' | 'REG_D_506C' | 'REG_A_PLUS';
  accreditationStatus?: 'PENDING' | 'VERIFIED' | 'FAILED';
  kycStatus?: 'PENDING' | 'VERIFIED' | 'FAILED';
  
  // Documents
  termSheetId?: string;
  subscriptionAgreementId?: string;
  
  // Event sourcing
  version: number;
  lastEventId: string;
  lastModified: Date;
}

export class InvestmentStateMachine {
  private events: Map<string, DealEvent[]> = new Map();
  private snapshots: Map<string, DealState> = new Map();
  private readonly SNAPSHOT_THRESHOLD = 50;

  /**
   * Rebuild state from events with optimistic concurrency control
   */
  async rebuildDealState(dealId: string, targetVersion?: number): Promise<DealState> {
    const events = this.events.get(dealId) || [];
    const snapshot = this.snapshots.get(dealId);
    
    let startIndex = 0;
    let initialState: DealState;
    
    // Use snapshot if available and valid
    if (snapshot && (!targetVersion || snapshot.version <= targetVersion)) {
      initialState = { ...snapshot };
      startIndex = events.findIndex(e => e.version > snapshot.version);
    } else {
      initialState = this.getInitialState(dealId);
    }
    
    // Replay events from snapshot or beginning
    const relevantEvents = targetVersion 
      ? events.slice(startIndex).filter(e => e.version <= targetVersion)
      : events.slice(startIndex);
      
    return relevantEvents.reduce((state, event) => {
      return this.applyEvent(state, event);
    }, initialState);
  }

  /**
   * Apply event to state with business logic
   */
  private applyEvent(state: DealState, event: DealEvent): DealState {
    const newState = { ...state };
    
    switch (event.eventType) {
      case DealEventType.INTEREST_EXPRESSED:
        newState.currentState = InvestmentDealState.INTEREST;
        break;
        
      case DealEventType.QUALIFICATION_STARTED:
        if (state.currentState === InvestmentDealState.INTEREST) {
          newState.currentState = InvestmentDealState.QUALIFICATION;
          newState.qualificationDeadline = new Date(
            event.timestamp.getTime() + 7 * 24 * 60 * 60 * 1000 // 7 days
          );
        }
        break;
        
      case DealEventType.ACCREDITATION_VERIFIED:
        newState.accreditationStatus = 'VERIFIED';
        if (state.currentState === InvestmentDealState.QUALIFICATION) {
          newState.currentState = InvestmentDealState.NEGOTIATION;
        }
        break;
        
      case DealEventType.COMMITMENT_MADE:
        newState.totalCommitted += event.payload.amount;
        if (state.currentState === InvestmentDealState.DUE_DILIGENCE) {
          newState.currentState = InvestmentDealState.COMMITMENT;
        }
        break;
        
      case DealEventType.FUNDS_ESCROWED:
        newState.totalEscrowed += event.payload.amount;
        if (state.currentState === InvestmentDealState.COMMITMENT) {
          newState.currentState = InvestmentDealState.ESCROW;
        }
        break;
        
      case DealEventType.ESCROW_RELEASED:
        if (state.currentState === InvestmentDealState.CLOSING) {
          newState.currentState = InvestmentDealState.FUNDED;
          newState.totalFunded = newState.totalEscrowed;
        }
        break;
        
      case DealEventType.DEAL_COMPLETED:
        if (state.currentState === InvestmentDealState.FUNDED) {
          newState.currentState = InvestmentDealState.COMPLETED;
        }
        break;
        
      case DealEventType.DEAL_FAILED:
        newState.currentState = InvestmentDealState.FAILED;
        break;
        
      case DealEventType.DEAL_EXPIRED:
        newState.currentState = InvestmentDealState.EXPIRED;
        break;
    }
    
    newState.version = event.version;
    newState.lastEventId = event.eventId;
    newState.lastModified = event.timestamp;
    
    return newState;
  }

  /**
   * Process new event with validation and persistence
   */
  async processEvent(event: DealEvent): Promise<DealState> {
    const currentState = await this.rebuildDealState(event.dealId);
    
    // Validate state transition
    if (!this.isValidTransition(currentState.currentState, event.eventType)) {
      throw new Error(`Invalid transition from ${currentState.currentState} with event ${event.eventType}`);
    }
    
    // Apply optimistic locking
    if (event.version !== currentState.version + 1) {
      throw new Error('Version conflict - retry with latest version');
    }
    
    // Store event
    const dealEvents = this.events.get(event.dealId) || [];
    dealEvents.push(event);
    this.events.set(event.dealId, dealEvents);
    
    // Apply event to get new state
    const newState = this.applyEvent(currentState, event);
    
    // Create snapshot if threshold reached
    if (dealEvents.length % this.SNAPSHOT_THRESHOLD === 0) {
      this.snapshots.set(event.dealId, newState);
    }
    
    return newState;
  }

  /**
   * Validate state transitions based on business rules
   */
  private isValidTransition(currentState: InvestmentDealState, eventType: DealEventType): boolean {
    // Terminal states cannot transition
    const terminalStates = [
      InvestmentDealState.COMPLETED,
      InvestmentDealState.WITHDRAWN,
      InvestmentDealState.REJECTED,
      InvestmentDealState.EXPIRED,
      InvestmentDealState.FAILED
    ];
    
    if (terminalStates.includes(currentState)) {
      return false;
    }
    
    // Define valid transitions
    const validTransitions: Partial<Record<InvestmentDealState, DealEventType[]>> = {
      [InvestmentDealState.INTEREST]: [
        DealEventType.QUALIFICATION_STARTED,
        DealEventType.INTEREST_WITHDRAWN
      ],
      [InvestmentDealState.QUALIFICATION]: [
        DealEventType.ACCREDITATION_VERIFIED,
        DealEventType.QUALIFICATION_FAILED
      ],
      [InvestmentDealState.NEGOTIATION]: [
        DealEventType.TERMS_PROPOSED,
        DealEventType.TERMS_COUNTER_OFFERED,
        DealEventType.TERM_SHEET_GENERATED
      ],
      [InvestmentDealState.COMMITMENT]: [
        DealEventType.FUNDS_ESCROWED,
        DealEventType.COMMITMENT_CANCELLED
      ],
      [InvestmentDealState.ESCROW]: [
        DealEventType.CLOSING_INITIATED,
        DealEventType.ESCROW_REFUNDED
      ],
      [InvestmentDealState.FUNDED]: [
        DealEventType.DEAL_COMPLETED
      ]
    };
    
    const allowedEvents = validTransitions[currentState] || [];
    return allowedEvents.includes(eventType) || 
           [DealEventType.DEAL_FAILED, DealEventType.DEAL_EXPIRED].includes(eventType);
  }

  /**
   * Get initial state for new deal
   */
  private getInitialState(dealId: string): DealState {
    return {
      dealId,
      currentState: InvestmentDealState.INTEREST,
      pitchId: '',
      investorId: '',
      creatorId: '',
      targetAmount: 0,
      minimumAmount: 0,
      totalCommitted: 0,
      totalEscrowed: 0,
      totalFunded: 0,
      createdAt: new Date(),
      regulationType: 'REG_CF',
      version: 0,
      lastEventId: '',
      lastModified: new Date()
    };
  }

  /**
   * Handle concurrent modifications with retry logic
   */
  async processEventWithRetry(
    event: DealEvent, 
    maxRetries: number = 3
  ): Promise<DealState> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Get latest version
        const currentState = await this.rebuildDealState(event.dealId);
        event.version = currentState.version + 1;
        
        return await this.processEvent(event);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Version conflict')) {
          lastError = error;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}

/**
 * Pessimistic locking for critical financial operations
 */
export class DealLockManager {
  private locks: Map<string, { holder: string; expiry: Date }> = new Map();
  
  async acquireLock(
    dealId: string, 
    holderId: string, 
    timeout: number = 30000
  ): Promise<boolean> {
    const existingLock = this.locks.get(dealId);
    
    if (existingLock && existingLock.expiry > new Date()) {
      return false; // Lock held by another process
    }
    
    this.locks.set(dealId, {
      holder: holderId,
      expiry: new Date(Date.now() + timeout)
    });
    
    return true;
  }
  
  async releaseLock(dealId: string, holderId: string): Promise<void> {
    const lock = this.locks.get(dealId);
    if (lock && lock.holder === holderId) {
      this.locks.delete(dealId);
    }
  }
  
  async withLock<T>(
    dealId: string,
    holderId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const acquired = await this.acquireLock(dealId, holderId);
    if (!acquired) {
      throw new Error('Could not acquire lock');
    }
    
    try {
      return await operation();
    } finally {
      await this.releaseLock(dealId, holderId);
    }
  }
}