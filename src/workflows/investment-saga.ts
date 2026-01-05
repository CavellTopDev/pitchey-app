/**
 * Saga Pattern for Investment Closing Transactions
 * Implements orchestration-based saga with compensating transactions
 */

import { InvestmentDealState } from './investment-state-machine';

export interface SagaStep<T = any> {
  name: string;
  execute: () => Promise<T>;
  compensate: () => Promise<void>;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number;
  critical?: boolean; // If true, failure stops the saga
}

export interface SagaContext {
  sagaId: string;
  dealId: string;
  startedAt: Date;
  completedSteps: string[];
  failedStep?: string;
  error?: Error;
  compensationLog: Array<{
    step: string;
    timestamp: Date;
    success: boolean;
    error?: string;
  }>;
}

export class InvestmentClosingSaga {
  private context: SagaContext;
  private steps: SagaStep[];
  
  constructor(dealId: string) {
    this.context = {
      sagaId: crypto.randomUUID(),
      dealId,
      startedAt: new Date(),
      completedSteps: [],
      compensationLog: []
    };
    
    this.steps = this.defineClosingSteps(dealId);
  }
  
  /**
   * Define the steps for investment closing
   */
  private defineClosingSteps(dealId: string): SagaStep[] {
    return [
      {
        name: 'validate_escrow_balance',
        execute: async () => this.validateEscrowBalance(dealId),
        compensate: async () => {}, // No compensation needed
        retryable: true,
        maxRetries: 3,
        critical: true
      },
      {
        name: 'freeze_escrow_account',
        execute: async () => this.freezeEscrowAccount(dealId),
        compensate: async () => this.unfreezeEscrowAccount(dealId),
        retryable: true,
        maxRetries: 3,
        timeout: 30000
      },
      {
        name: 'execute_subscription_agreements',
        execute: async () => this.executeSubscriptionAgreements(dealId),
        compensate: async () => this.voidSubscriptionAgreements(dealId),
        retryable: false,
        critical: true
      },
      {
        name: 'update_cap_table',
        execute: async () => this.updateCapTable(dealId),
        compensate: async () => this.rollbackCapTable(dealId),
        retryable: true,
        maxRetries: 5
      },
      {
        name: 'generate_share_certificates',
        execute: async () => this.generateShareCertificates(dealId),
        compensate: async () => this.voidShareCertificates(dealId),
        retryable: true,
        maxRetries: 3
      },
      {
        name: 'transfer_funds_to_creator',
        execute: async () => this.transferFundsToCreator(dealId),
        compensate: async () => this.initiateRefundProcess(dealId),
        retryable: false,
        critical: true,
        timeout: 60000
      },
      {
        name: 'send_closing_notifications',
        execute: async () => this.sendClosingNotifications(dealId),
        compensate: async () => {}, // Notifications don't need compensation
        retryable: true,
        maxRetries: 5
      },
      {
        name: 'archive_deal_documents',
        execute: async () => this.archiveDealDocuments(dealId),
        compensate: async () => {}, // Archive is non-critical
        retryable: true,
        maxRetries: 3
      }
    ];
  }
  
  /**
   * Execute the saga with automatic compensation on failure
   */
  async execute(): Promise<SagaContext> {
    console.log(`Starting investment closing saga ${this.context.sagaId} for deal ${this.context.dealId}`);
    
    for (const step of this.steps) {
      try {
        console.log(`Executing step: ${step.name}`);
        
        // Execute with retry logic
        await this.executeWithRetry(step);
        
        this.context.completedSteps.push(step.name);
        console.log(`Step ${step.name} completed successfully`);
        
      } catch (error) {
        console.error(`Step ${step.name} failed:`, error);
        
        this.context.failedStep = step.name;
        this.context.error = error as Error;
        
        if (step.critical) {
          console.log('Critical step failed, initiating compensation...');
          await this.compensate();
          throw new Error(`Saga failed at critical step: ${step.name}`);
        }
        
        // Non-critical step failed, continue
        console.log(`Non-critical step ${step.name} failed, continuing...`);
      }
    }
    
    console.log(`Saga ${this.context.sagaId} completed successfully`);
    return this.context;
  }
  
  /**
   * Execute a step with retry logic
   */
  private async executeWithRetry(step: SagaStep): Promise<any> {
    const maxRetries = step.maxRetries || 1;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (step.timeout) {
          return await this.withTimeout(step.execute(), step.timeout);
        } else {
          return await step.execute();
        }
      } catch (error) {
        lastError = error as Error;
        
        if (!step.retryable || attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Retrying step ${step.name} in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error(`Step ${step.name} failed after ${maxRetries} attempts`);
  }
  
  /**
   * Compensate completed steps in reverse order
   */
  private async compensate(): Promise<void> {
    const completedSteps = [...this.context.completedSteps].reverse();
    
    for (const stepName of completedSteps) {
      const step = this.steps.find(s => s.name === stepName);
      if (!step) continue;
      
      try {
        console.log(`Compensating step: ${stepName}`);
        await step.compensate();
        
        this.context.compensationLog.push({
          step: stepName,
          timestamp: new Date(),
          success: true
        });
        
        console.log(`Step ${stepName} compensated successfully`);
      } catch (error) {
        console.error(`Failed to compensate step ${stepName}:`, error);
        
        this.context.compensationLog.push({
          step: stepName,
          timestamp: new Date(),
          success: false,
          error: (error as Error).message
        });
        
        // Continue compensating other steps even if one fails
      }
    }
  }
  
  /**
   * Execute with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }
  
  // Step implementations
  
  private async validateEscrowBalance(dealId: string): Promise<void> {
    // Verify escrow balance matches committed amount
    const escrowBalance = await this.getEscrowBalance(dealId);
    const committedAmount = await this.getCommittedAmount(dealId);
    
    if (escrowBalance < committedAmount) {
      throw new Error(`Insufficient escrow balance: ${escrowBalance} < ${committedAmount}`);
    }
  }
  
  private async freezeEscrowAccount(dealId: string): Promise<void> {
    // Call escrow service to freeze account
    const response = await fetch('/api/escrow/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to freeze escrow account');
    }
  }
  
  private async unfreezeEscrowAccount(dealId: string): Promise<void> {
    // Compensating transaction for freeze
    await fetch('/api/escrow/unfreeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
  }
  
  private async executeSubscriptionAgreements(dealId: string): Promise<void> {
    // Execute all pending subscription agreements
    const response = await fetch('/api/documents/execute-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dealId,
        documentType: 'subscription_agreement'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to execute subscription agreements');
    }
  }
  
  private async voidSubscriptionAgreements(dealId: string): Promise<void> {
    // Void executed agreements
    await fetch('/api/documents/void-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dealId,
        documentType: 'subscription_agreement'
      })
    });
  }
  
  private async updateCapTable(dealId: string): Promise<void> {
    // Update cap table with new shareholders
    const response = await fetch('/api/captable/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update cap table');
    }
  }
  
  private async rollbackCapTable(dealId: string): Promise<void> {
    // Rollback cap table changes
    await fetch('/api/captable/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
  }
  
  private async generateShareCertificates(dealId: string): Promise<void> {
    // Generate digital share certificates
    const response = await fetch('/api/certificates/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate share certificates');
    }
  }
  
  private async voidShareCertificates(dealId: string): Promise<void> {
    // Void generated certificates
    await fetch('/api/certificates/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
  }
  
  private async transferFundsToCreator(dealId: string): Promise<void> {
    // Release escrow funds to creator
    const response = await fetch('/api/payments/release-escrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to transfer funds');
    }
  }
  
  private async initiateRefundProcess(dealId: string): Promise<void> {
    // Initiate refunds to all investors
    await fetch('/api/payments/initiate-refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
  }
  
  private async sendClosingNotifications(dealId: string): Promise<void> {
    // Send notifications to all parties
    const response = await fetch('/api/notifications/deal-closed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send notifications');
    }
  }
  
  private async archiveDealDocuments(dealId: string): Promise<void> {
    // Archive all deal documents for compliance
    const response = await fetch('/api/documents/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId })
    });
    
    if (!response.ok) {
      console.warn('Failed to archive documents, will retry later');
    }
  }
  
  // Helper methods
  
  private async getEscrowBalance(dealId: string): Promise<number> {
    const response = await fetch(`/api/escrow/balance/${dealId}`);
    const data = await response.json();
    return data.balance;
  }
  
  private async getCommittedAmount(dealId: string): Promise<number> {
    const response = await fetch(`/api/deals/${dealId}/committed-amount`);
    const data = await response.json();
    return data.amount;
  }
}

/**
 * Saga orchestrator for managing multiple concurrent sagas
 */
export class SagaOrchestrator {
  private activeSagas: Map<string, InvestmentClosingSaga> = new Map();
  private sagaHistory: SagaContext[] = [];
  
  /**
   * Start a new investment closing saga
   */
  async startClosingSaga(dealId: string): Promise<SagaContext> {
    const saga = new InvestmentClosingSaga(dealId);
    this.activeSagas.set(saga.context.sagaId, saga);
    
    try {
      const result = await saga.execute();
      this.sagaHistory.push(result);
      return result;
    } finally {
      this.activeSagas.delete(saga.context.sagaId);
    }
  }
  
  /**
   * Get status of active sagas
   */
  getActiveSagas(): Array<{ sagaId: string; dealId: string; startedAt: Date }> {
    return Array.from(this.activeSagas.entries()).map(([sagaId, saga]) => ({
      sagaId,
      dealId: saga.context.dealId,
      startedAt: saga.context.startedAt
    }));
  }
  
  /**
   * Get saga history for audit purposes
   */
  getSagaHistory(dealId?: string): SagaContext[] {
    if (dealId) {
      return this.sagaHistory.filter(s => s.dealId === dealId);
    }
    return this.sagaHistory;
  }
}

/**
 * Idempotent compensation helper
 */
export class IdempotentCompensation {
  private completedCompensations: Set<string> = new Set();
  
  /**
   * Execute compensation only once
   */
  async executeOnce(
    compensationId: string,
    compensation: () => Promise<void>
  ): Promise<void> {
    if (this.completedCompensations.has(compensationId)) {
      console.log(`Compensation ${compensationId} already executed, skipping`);
      return;
    }
    
    await compensation();
    this.completedCompensations.add(compensationId);
  }
  
  /**
   * Check if compensation was already executed
   */
  isCompensated(compensationId: string): boolean {
    return this.completedCompensations.has(compensationId);
  }
}