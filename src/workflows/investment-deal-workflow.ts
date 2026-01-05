/**
 * Investment Deal Workflow
 * 
 * This workflow orchestrates the complete investment deal lifecycle from initial
 * investor interest through funding completion. It implements a 10-state process
 * with automatic retries, human approval gates, and compensation for failures.
 * 
 * States:
 * 1. INTEREST - Investor expresses interest
 * 2. QUALIFICATION - Verify investor accreditation
 * 3. NEGOTIATION - Creator approval and counter-offers
 * 4. TERM_SHEET - Generate and sign term sheets
 * 5. DUE_DILIGENCE - Background checks and verification
 * 6. COMMITMENT - Final commitment confirmation
 * 7. ESCROW - Funds held in escrow
 * 8. CLOSING - Legal documentation
 * 9. FUNDED - Funds transferred
 * 10. COMPLETED - Deal finalized
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// ============================================================================
// Type Definitions
// ============================================================================

interface InvestmentDealParams {
  investorId: string;
  pitchId: string;
  creatorId: string;
  proposedAmount: number;
  investmentType: 'equity' | 'debt' | 'convertible' | 'revenue_share';
  message?: string;
  ndaAccepted: boolean;
}

interface DealRecord {
  id: string;
  workflowInstanceId: string;
  investorId: string;
  creatorId: string;
  pitchId: string;
  proposedAmount: number;
  agreedAmount?: number;
  investmentType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CreatorDecision {
  decision: 'approve' | 'reject' | 'counter';
  counterAmount?: number;
  message?: string;
  decidedAt: string;
}

interface TermSheetResponse {
  accepted: boolean;
  modifications?: Record<string, any>;
  signedDocumentKey?: string;
}

interface EscrowConfirmation {
  transactionId: string;
  amount: number;
  confirmedAt: string;
}

// ============================================================================
// Main Workflow Class
// ============================================================================

export class InvestmentDealWorkflow extends WorkflowEntrypoint {
  /**
   * Main workflow execution logic.
   * Each step.do() call creates a durable checkpoint. If the workflow fails
   * and restarts, it resumes from the last successful step.
   */
  async run(event: WorkflowEvent<InvestmentDealParams>, step: WorkflowStep) {
    const { params } = event;
    const startTime = Date.now();
    
    console.log(`Starting investment deal workflow for pitch ${params.pitchId}`);
    
    // ========================================================================
    // Step 1: Create Deal Record in Database
    // ========================================================================
    const dealRecord = await step.do('create-deal-record', async () => {
      const dealId = crypto.randomUUID();
      
      // Get database connection from bindings
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Create initial deal record
      await db(`
        INSERT INTO investment_deals (
          id, workflow_instance_id, investor_id, creator_id, pitch_id,
          proposed_amount, investment_type, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        dealId,
        this.env.WORKFLOW_INSTANCE_ID,
        params.investorId,
        params.creatorId,
        params.pitchId,
        params.proposedAmount,
        params.investmentType,
        'INTEREST'
      ]);
      
      // Send notification to creator
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'investment_interest',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          investorId: params.investorId,
          pitchId: params.pitchId,
          amount: params.proposedAmount,
          message: params.message
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      return {
        id: dealId,
        workflowInstanceId: this.env.WORKFLOW_INSTANCE_ID,
        investorId: params.investorId,
        creatorId: params.creatorId,
        pitchId: params.pitchId,
        proposedAmount: params.proposedAmount,
        investmentType: params.investmentType,
        status: 'INTEREST',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as DealRecord;
    }, {
      retries: {
        limit: 3,
        backoff: 'exponential',
        delay: 1000
      }
    });
    
    // ========================================================================
    // Step 2: Verify Investor Qualification
    // ========================================================================
    const isQualified = await step.do('verify-investor-qualification', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Check investor accreditation status
      const result = await db(`
        SELECT 
          accreditation_status,
          accreditation_verified_at,
          investment_limit,
          total_invested_ytd
        FROM users
        WHERE id = $1 AND user_type = 'investor'
      `, [params.investorId]);
      
      if (result.length === 0) {
        throw new Error('Investor not found');
      }
      
      const investor = result[0];
      
      // Validate accreditation
      if (investor.accreditation_status !== 'verified') {
        await this.updateDealStatus(dealRecord.id, 'QUALIFICATION_FAILED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'qualification_failed',
          recipientId: params.investorId,
          recipientType: 'investor',
          data: {
            reason: 'Accreditation not verified',
            dealId: dealRecord.id
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      // Check investment limits
      const totalWithProposed = (investor.total_invested_ytd || 0) + params.proposedAmount;
      if (investor.investment_limit && totalWithProposed > investor.investment_limit) {
        await this.updateDealStatus(dealRecord.id, 'QUALIFICATION_FAILED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'qualification_failed',
          recipientId: params.investorId,
          recipientType: 'investor',
          data: {
            reason: 'Investment limit exceeded',
            dealId: dealRecord.id,
            limit: investor.investment_limit,
            currentTotal: investor.total_invested_ytd
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      // Update status to qualified
      await this.updateDealStatus(dealRecord.id, 'QUALIFIED');
      
      return true;
    }, {
      retries: {
        limit: 2,
        backoff: 'linear',
        delay: 2000
      }
    });
    
    // Stop workflow if investor is not qualified
    if (!isQualified) {
      return {
        success: false,
        reason: 'Investor qualification failed',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 3: Wait for Creator Decision (Human-in-the-Loop)
    // ========================================================================
    const creatorDecision = await step.waitForEvent<CreatorDecision>(
      'wait-for-creator-decision',
      {
        timeout: '7 days'  // Creator has 7 days to respond
      }
    );
    
    // Handle timeout - creator didn't respond in time
    if (!creatorDecision) {
      await step.do('handle-creator-timeout', async () => {
        await this.updateDealStatus(dealRecord.id, 'EXPIRED');
        
        // Notify both parties
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'deal_expired',
          recipientId: params.investorId,
          recipientType: 'investor',
          data: {
            dealId: dealRecord.id,
            reason: 'Creator did not respond within 7 days'
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'deal_expired',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            dealId: dealRecord.id,
            reason: 'Response deadline missed'
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
      });
      
      return {
        success: false,
        reason: 'Creator did not respond in time',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 4: Process Creator Decision
    // ========================================================================
    const negotiatedAmount = await step.do('process-creator-decision', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      if (creatorDecision.payload.decision === 'reject') {
        await this.updateDealStatus(dealRecord.id, 'REJECTED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'deal_rejected',
          recipientId: params.investorId,
          recipientType: 'investor',
          data: {
            dealId: dealRecord.id,
            message: creatorDecision.payload.message
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return null;
      }
      
      let finalAmount = params.proposedAmount;
      
      if (creatorDecision.payload.decision === 'counter') {
        finalAmount = creatorDecision.payload.counterAmount || params.proposedAmount;
        
        // Update deal with counter offer
        await db(`
          UPDATE investment_deals
          SET agreed_amount = $1, status = 'NEGOTIATION'
          WHERE id = $2
        `, [finalAmount, dealRecord.id]);
        
        // Notify investor of counter offer
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'counter_offer',
          recipientId: params.investorId,
          recipientType: 'investor',
          data: {
            dealId: dealRecord.id,
            originalAmount: params.proposedAmount,
            counterAmount: finalAmount,
            message: creatorDecision.payload.message
          },
          channels: ['email', 'push', 'in_app'],
          priority: 'high'
        });
        
        // Wait for investor response to counter
        const investorResponse = await step.waitForEvent<{accepted: boolean}>(
          'wait-for-investor-counter-response',
          { timeout: '3 days' }
        );
        
        if (!investorResponse || !investorResponse.payload.accepted) {
          await this.updateDealStatus(dealRecord.id, 'NEGOTIATION_FAILED');
          return null;
        }
      }
      
      // Deal approved or counter accepted
      await db(`
        UPDATE investment_deals
        SET agreed_amount = $1, status = 'APPROVED'
        WHERE id = $2
      `, [finalAmount, dealRecord.id]);
      
      return finalAmount;
    });
    
    // Stop if deal was rejected or negotiation failed
    if (negotiatedAmount === null) {
      return {
        success: false,
        reason: 'Deal rejected or negotiation failed',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 5: Generate and Send Term Sheet
    // ========================================================================
    const termSheetKey = await step.do('generate-term-sheet', async () => {
      // Generate term sheet document
      const termSheetData = {
        dealId: dealRecord.id,
        investorId: params.investorId,
        creatorId: params.creatorId,
        pitchId: params.pitchId,
        amount: negotiatedAmount,
        investmentType: params.investmentType,
        terms: this.generateTerms(params.investmentType, negotiatedAmount),
        generatedAt: new Date().toISOString()
      };
      
      // Store in R2
      const documentKey = `term-sheets/${dealRecord.id}.json`;
      await this.env.DOCUMENTS.put(documentKey, JSON.stringify(termSheetData));
      
      // Send to both parties for signature
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'term_sheet_ready',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: {
          dealId: dealRecord.id,
          documentKey,
          reviewDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'term_sheet_ready',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          documentKey,
          reviewDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      await this.updateDealStatus(dealRecord.id, 'TERM_SHEET');
      
      return documentKey;
    });
    
    // ========================================================================
    // Step 6: Wait for Term Sheet Signatures
    // ========================================================================
    const termSheetResponse = await step.waitForEvent<TermSheetResponse>(
      'wait-for-term-sheet-response',
      { timeout: '5 days' }
    );
    
    if (!termSheetResponse || !termSheetResponse.payload.accepted) {
      await step.do('handle-term-sheet-rejection', async () => {
        await this.updateDealStatus(dealRecord.id, 'TERM_SHEET_REJECTED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'term_sheet_rejected',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            dealId: dealRecord.id,
            modifications: termSheetResponse?.payload.modifications
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
      });
      
      return {
        success: false,
        reason: 'Term sheet not accepted',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 7: Due Diligence
    // ========================================================================
    await step.do('perform-due-diligence', async () => {
      await this.updateDealStatus(dealRecord.id, 'DUE_DILIGENCE');
      
      // Automated checks
      const checks = await Promise.all([
        this.verifyPitchOwnership(params.pitchId, params.creatorId),
        this.checkForConflictingDeals(params.pitchId, dealRecord.id),
        this.validateInvestmentTerms(negotiatedAmount, params.investmentType)
      ]);
      
      if (checks.some(check => !check)) {
        throw new Error('Due diligence failed');
      }
      
      // Notify parties of successful due diligence
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'due_diligence_complete',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: { dealId: dealRecord.id },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
    }, {
      retries: {
        limit: 3,
        backoff: 'exponential',
        delay: 5000
      }
    });
    
    // ========================================================================
    // Step 8: Final Commitment
    // ========================================================================
    await step.do('confirm-commitment', async () => {
      await this.updateDealStatus(dealRecord.id, 'COMMITMENT');
      
      // Request final confirmation from investor
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'final_commitment_request',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: {
          dealId: dealRecord.id,
          amount: negotiatedAmount,
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
    });
    
    // Wait for final commitment
    const commitment = await step.waitForEvent<{confirmed: boolean}>(
      'wait-for-final-commitment',
      { timeout: '48 hours' }
    );
    
    if (!commitment || !commitment.payload.confirmed) {
      await this.updateDealStatus(dealRecord.id, 'COMMITMENT_WITHDRAWN');
      return {
        success: false,
        reason: 'Final commitment not confirmed',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 9: Escrow Setup
    // ========================================================================
    const escrowDetails = await step.do('setup-escrow', async () => {
      await this.updateDealStatus(dealRecord.id, 'ESCROW');
      
      // Create escrow transaction (in production, integrate with Stripe Connect)
      const escrowId = `escrow_${dealRecord.id}`;
      
      // Store escrow details
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      await db(`
        UPDATE investment_deals
        SET escrow_id = $1, escrow_created_at = NOW()
        WHERE id = $2
      `, [escrowId, dealRecord.id]);
      
      // Notify investor to deposit funds
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'escrow_deposit_request',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: {
          dealId: dealRecord.id,
          escrowId,
          amount: negotiatedAmount,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      return { escrowId };
    });
    
    // ========================================================================
    // Step 10: Wait for Escrow Confirmation
    // ========================================================================
    const escrowConfirmation = await step.waitForEvent<EscrowConfirmation>(
      'wait-for-escrow-confirmation',
      { timeout: '7 days' }
    );
    
    if (!escrowConfirmation) {
      await step.do('handle-escrow-timeout', async () => {
        await this.updateDealStatus(dealRecord.id, 'ESCROW_FAILED');
        
        // Compensation: Cancel the escrow
        await this.cancelEscrow(escrowDetails.escrowId);
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'escrow_timeout',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            dealId: dealRecord.id,
            reason: 'Investor did not deposit funds in time'
          },
          channels: ['email', 'in_app'],
          priority: 'high'
        });
      });
      
      return {
        success: false,
        reason: 'Escrow deposit timeout',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 11: Closing Documents
    // ========================================================================
    await step.do('prepare-closing-documents', async () => {
      await this.updateDealStatus(dealRecord.id, 'CLOSING');
      
      // Generate final investment agreement
      const closingDocs = {
        investmentAgreement: await this.generateInvestmentAgreement(dealRecord),
        sharesCertificate: await this.generateSharesCertificate(dealRecord, negotiatedAmount),
        taxForms: await this.generateTaxForms(params.investorId)
      };
      
      // Store documents
      for (const [docType, docData] of Object.entries(closingDocs)) {
        const key = `closing/${dealRecord.id}/${docType}.pdf`;
        await this.env.DOCUMENTS.put(key, docData);
      }
      
      // Send for signatures
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'closing_documents_ready',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: {
          dealId: dealRecord.id,
          documents: Object.keys(closingDocs)
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'closing_documents_ready',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          documents: Object.keys(closingDocs)
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
    });
    
    // ========================================================================
    // Step 12: Fund Transfer
    // ========================================================================
    const fundingResult = await step.do('transfer-funds', async () => {
      await this.updateDealStatus(dealRecord.id, 'FUNDING');
      
      try {
        // Release funds from escrow to creator
        const transferId = await this.releaseFunds(
          escrowDetails.escrowId,
          params.creatorId,
          negotiatedAmount
        );
        
        // Record transfer
        const { neon } = await import('@neondatabase/serverless');
        const db = neon(this.env.HYPERDRIVE.connectionString);
        
        await db(`
          UPDATE investment_deals
          SET 
            transfer_id = $1,
            funded_at = NOW(),
            status = 'FUNDED'
          WHERE id = $2
        `, [transferId, dealRecord.id]);
        
        // Update pitch funding stats
        await db(`
          UPDATE pitches
          SET 
            total_funded = total_funded + $1,
            investor_count = investor_count + 1,
            last_investment_at = NOW()
          WHERE id = $2
        `, [negotiatedAmount, params.pitchId]);
        
        return { transferId, fundedAt: new Date().toISOString() };
      } catch (error) {
        // Compensation: Refund to investor if transfer fails
        await this.refundToInvestor(escrowDetails.escrowId, params.investorId, negotiatedAmount);
        throw error;
      }
    }, {
      retries: {
        limit: 5,
        backoff: 'exponential',
        delay: 10000
      }
    });
    
    // ========================================================================
    // Step 13: Complete Deal
    // ========================================================================
    await step.do('complete-deal', async () => {
      await this.updateDealStatus(dealRecord.id, 'COMPLETED');
      
      // Send success notifications
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'investment_complete',
        recipientId: params.investorId,
        recipientType: 'investor',
        data: {
          dealId: dealRecord.id,
          amount: negotiatedAmount,
          pitchId: params.pitchId,
          transferId: fundingResult.transferId
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'investment_received',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          amount: negotiatedAmount,
          investorId: params.investorId,
          transferId: fundingResult.transferId
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      // Grant investor access to pitch materials
      await this.grantPitchAccess(params.investorId, params.pitchId, 'investor');
    });
    
    // ========================================================================
    // Workflow Complete
    // ========================================================================
    
    const duration = Date.now() - startTime;
    
    console.log(`Investment deal workflow completed in ${duration}ms for deal ${dealRecord.id}`);
    
    return {
      success: true,
      dealId: dealRecord.id,
      investorId: params.investorId,
      creatorId: params.creatorId,
      pitchId: params.pitchId,
      finalAmount: negotiatedAmount,
      completedAt: new Date().toISOString(),
      duration
    };
  }
  
  // ========================================================================
  // Helper Methods
  // ========================================================================
  
  private async updateDealStatus(dealId: string, status: string): Promise<void> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    await db(`
      UPDATE investment_deals
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, dealId]);
    
    // Cache status for quick lookups
    await this.env.DEAL_CACHE.put(
      `deal:${dealId}:status`,
      status,
      { expirationTtl: 3600 }
    );
  }
  
  private generateTerms(investmentType: string, amount: number): Record<string, any> {
    const baseTerms = {
      investmentAmount: amount,
      investmentType,
      closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      governingLaw: 'Delaware, USA'
    };
    
    switch (investmentType) {
      case 'equity':
        return {
          ...baseTerms,
          equityPercentage: this.calculateEquityPercentage(amount),
          votingRights: 'Class A Common',
          boardSeats: amount > 1000000 ? 1 : 0,
          proRataRights: amount > 500000
        };
      
      case 'debt':
        return {
          ...baseTerms,
          interestRate: 8.5,
          maturityDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          paymentSchedule: 'quarterly',
          collateral: 'None'
        };
      
      case 'convertible':
        return {
          ...baseTerms,
          conversionDiscount: 20,
          valuationCap: 10000000,
          interestRate: 5,
          maturityDate: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000).toISOString()
        };
      
      case 'revenue_share':
        return {
          ...baseTerms,
          revenuePercentage: 5,
          paymentCap: amount * 2.5,
          paymentFrequency: 'monthly',
          startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        };
      
      default:
        return baseTerms;
    }
  }
  
  private calculateEquityPercentage(amount: number): number {
    // Simplified calculation - in production, use valuation from pitch
    const valuation = 5000000; // $5M default valuation
    return (amount / valuation) * 100;
  }
  
  private async verifyPitchOwnership(pitchId: string, creatorId: string): Promise<boolean> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const result = await db(`
      SELECT user_id FROM pitches WHERE id = $1
    `, [pitchId]);
    
    return result.length > 0 && result[0].user_id === creatorId;
  }
  
  private async checkForConflictingDeals(pitchId: string, currentDealId: string): Promise<boolean> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const result = await db(`
      SELECT COUNT(*) as active_deals
      FROM investment_deals
      WHERE pitch_id = $1 
        AND id != $2
        AND status IN ('ESCROW', 'CLOSING', 'FUNDING')
    `, [pitchId, currentDealId]);
    
    return result[0].active_deals === 0;
  }
  
  private async validateInvestmentTerms(amount: number, type: string): Promise<boolean> {
    // Add business rule validations
    if (amount < 1000) return false; // Minimum investment
    if (amount > 10000000) return false; // Maximum single investment
    if (!['equity', 'debt', 'convertible', 'revenue_share'].includes(type)) return false;
    
    return true;
  }
  
  private async cancelEscrow(escrowId: string): Promise<void> {
    // In production, call Stripe API to cancel hold
    console.log(`Cancelling escrow ${escrowId}`);
  }
  
  private async generateInvestmentAgreement(deal: DealRecord): Promise<string> {
    // In production, generate PDF using template
    return `Investment Agreement for Deal ${deal.id}`;
  }
  
  private async generateSharesCertificate(deal: DealRecord, amount: number): Promise<string> {
    // In production, generate PDF certificate
    return `Share Certificate for ${amount} investment in Deal ${deal.id}`;
  }
  
  private async generateTaxForms(investorId: string): Promise<string> {
    // In production, generate W-9 or W-8BEN
    return `Tax forms for investor ${investorId}`;
  }
  
  private async releaseFunds(escrowId: string, recipientId: string, amount: number): Promise<string> {
    // In production, call Stripe Connect API
    const transferId = `transfer_${crypto.randomUUID()}`;
    console.log(`Releasing ${amount} from escrow ${escrowId} to ${recipientId}`);
    return transferId;
  }
  
  private async refundToInvestor(escrowId: string, investorId: string, amount: number): Promise<void> {
    // In production, process refund through Stripe
    console.log(`Refunding ${amount} from escrow ${escrowId} to investor ${investorId}`);
  }
  
  private async grantPitchAccess(userId: string, pitchId: string, accessType: string): Promise<void> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    await db(`
      INSERT INTO pitch_access (
        id, user_id, pitch_id, access_type, 
        granted_via, granted_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, pitch_id) 
      DO UPDATE SET 
        access_type = $4,
        granted_via = $5,
        granted_at = NOW()
    `, [
      crypto.randomUUID(),
      userId,
      pitchId,
      accessType,
      'investment'
    ]);
  }
}