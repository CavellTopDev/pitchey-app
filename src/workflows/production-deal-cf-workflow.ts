/**
 * Production Deal Workflow - Cloudflare Workflows Implementation
 * 
 * Orchestrates the production company deal flow from initial interest through
 * production contract execution. Supports multiple interested parties with 
 * automatic waitlist management when exclusivity is granted to one company.
 * 
 * States:
 * 1. INTEREST - Production company expresses interest
 * 2. MEETING - Schedule and conduct meetings  
 * 3. PROPOSAL - Company submits production proposal
 * 4. NEGOTIATION - Terms negotiation
 * 5. CONTRACT - Contract drafting and signatures
 * 6. PRODUCTION - Active production phase
 * 7. COMPLETED - Production complete
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// ============================================================================
// Type Definitions
// ============================================================================

interface ProductionDealParams {
  productionCompanyId: string;
  productionCompanyUserId: string;
  pitchId: string;
  creatorId: string;
  interestType: 'option' | 'purchase' | 'co_production' | 'distribution';
  message?: string;
  proposedBudget?: number;
  proposedTimeline?: string;
  ndaId?: string;
}

interface ProductionDealRecord {
  id: string;
  workflowInstanceId: string;
  productionCompanyId: string;
  creatorId: string;
  pitchId: string;
  interestType: string;
  status: string;
  exclusivityGrantedAt?: string;
  exclusivityExpiresAt?: string;
  createdAt: string;
}

interface CreatorInterestResponse {
  decision: 'interested' | 'not_interested' | 'waitlist';
  preferredMeetingTimes?: string[];
  message?: string;
}

interface MeetingOutcome {
  outcome: 'proceed' | 'pass' | 'need_more_info';
  notes?: string;
  nextMeetingDate?: string;
}

interface ProposalSubmission {
  proposalDocumentKey: string;
  terms: {
    budget: number;
    timeline: string;
    rightsStructure: string;
    distributionTerms?: string;
    backendPoints?: number;
  };
  submittedAt: string;
}

interface ProposalResponse {
  decision: 'accept' | 'reject' | 'counter';
  counterTerms?: Record<string, any>;
  message?: string;
}

// ============================================================================
// Main Workflow Class
// ============================================================================

export class ProductionDealWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<ProductionDealParams>, step: WorkflowStep) {
    const { params } = event;
    const startTime = Date.now();
    
    console.log(`Starting production deal workflow for pitch ${params.pitchId}`);
    
    // ========================================================================
    // Step 1: Create Production Deal Record
    // ========================================================================
    const dealRecord = await step.do('create-production-deal', async () => {
      const dealId = crypto.randomUUID();
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Check if creator has granted exclusivity to another company
      const exclusivityCheck = await db(`
        SELECT id, production_company_id, exclusivity_expires_at
        FROM production_deals
        WHERE pitch_id = $1 
          AND status IN ('NEGOTIATION', 'CONTRACT')
          AND exclusivity_expires_at > NOW()
      `, [params.pitchId]);
      
      const hasExclusivity = exclusivityCheck.length > 0;
      const initialStatus = hasExclusivity ? 'WAITLISTED' : 'INTEREST';
      
      // Create deal record
      await db(`
        INSERT INTO production_deals (
          id, workflow_instance_id, production_company_id,
          production_company_user_id, creator_id, pitch_id,
          interest_type, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        dealId,
        this.env.WORKFLOW_INSTANCE_ID,
        params.productionCompanyId,
        params.productionCompanyUserId,
        params.creatorId,
        params.pitchId,
        params.interestType,
        initialStatus
      ]);
      
      // Notify creator of interest
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'production_interest',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          productionCompanyId: params.productionCompanyId,
          pitchId: params.pitchId,
          interestType: params.interestType,
          message: params.message,
          isWaitlisted: hasExclusivity,
          currentExclusiveCompany: exclusivityCheck[0]?.production_company_id
        },
        channels: ['email', 'push', 'in_app'],
        priority: hasExclusivity ? 'normal' : 'high'
      });
      
      if (hasExclusivity) {
        // If waitlisted, wait for exclusivity to expire
        const expiresAt = new Date(exclusivityCheck[0].exclusivity_expires_at);
        const waitTime = expiresAt.getTime() - Date.now();
        
        if (waitTime > 0) {
          await step.sleep('wait-for-exclusivity', waitTime);
        }
        
        // After waiting, update status
        await db(`
          UPDATE production_deals
          SET status = 'INTEREST'
          WHERE id = $1
        `, [dealId]);
      }
      
      return {
        id: dealId,
        workflowInstanceId: this.env.WORKFLOW_INSTANCE_ID,
        productionCompanyId: params.productionCompanyId,
        creatorId: params.creatorId,
        pitchId: params.pitchId,
        interestType: params.interestType,
        status: initialStatus,
        createdAt: new Date().toISOString()
      } as ProductionDealRecord;
    });
    
    // ========================================================================
    // Step 2: Verify Production Company
    // ========================================================================
    const companyVerified = await step.do('verify-production-company', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Verify company credentials
      const result = await db(`
        SELECT 
          company_name,
          verification_status,
          production_history,
          budget_range,
          active_projects_count
        FROM production_companies
        WHERE id = $1
      `, [params.productionCompanyId]);
      
      if (result.length === 0) {
        throw new Error('Production company not found');
      }
      
      const company = result[0];
      
      // Check verification status
      if (company.verification_status !== 'verified') {
        await this.updateDealStatus(dealRecord.id, 'VERIFICATION_FAILED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'verification_failed',
          recipientId: params.productionCompanyUserId,
          recipientType: 'production',
          data: {
            reason: 'Company verification pending',
            dealId: dealRecord.id
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      // Check if company has capacity
      if (company.active_projects_count >= 10) {
        await this.updateDealStatus(dealRecord.id, 'CAPACITY_EXCEEDED');
        return false;
      }
      
      return true;
    });
    
    if (!companyVerified) {
      return {
        success: false,
        reason: 'Production company verification failed',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 3: Wait for Creator Interest Response
    // ========================================================================
    const creatorResponse = await step.waitForEvent<CreatorInterestResponse>(
      'wait-for-creator-interest-response',
      { timeout: '5 days' }
    );
    
    if (!creatorResponse) {
      await this.handleTimeout(dealRecord.id, 'Creator did not respond to interest');
      return {
        success: false,
        reason: 'Creator timeout',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 4: Process Creator Response
    // ========================================================================
    const proceedToMeeting = await step.do('process-creator-response', async () => {
      if (creatorResponse.payload.decision === 'not_interested') {
        await this.updateDealStatus(dealRecord.id, 'CREATOR_DECLINED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'interest_declined',
          recipientId: params.productionCompanyUserId,
          recipientType: 'production',
          data: {
            dealId: dealRecord.id,
            message: creatorResponse.payload.message
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      if (creatorResponse.payload.decision === 'waitlist') {
        await this.updateDealStatus(dealRecord.id, 'WAITLISTED_BY_CREATOR');
        
        // Wait for creator to activate from waitlist
        const activation = await step.waitForEvent<{activate: boolean}>(
          'wait-for-waitlist-activation',
          { timeout: '30 days' }
        );
        
        if (!activation || !activation.payload.activate) {
          return false;
        }
      }
      
      // Creator is interested - schedule meeting
      await this.updateDealStatus(dealRecord.id, 'MEETING_SCHEDULED');
      
      // Schedule meeting (in production, integrate with calendar API)
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'meeting_scheduled',
        recipientId: params.productionCompanyUserId,
        recipientType: 'production',
        data: {
          dealId: dealRecord.id,
          proposedTimes: creatorResponse.payload.preferredMeetingTimes,
          meetingLink: `https://pitchey.com/meetings/${dealRecord.id}`
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      return true;
    });
    
    if (!proceedToMeeting) {
      return {
        success: false,
        reason: 'Deal did not proceed to meeting',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 5: Meeting and Evaluation
    // ========================================================================
    const meetingOutcome = await step.waitForEvent<MeetingOutcome>(
      'wait-for-meeting-outcome',
      { timeout: '7 days' }
    );
    
    if (!meetingOutcome) {
      await this.handleTimeout(dealRecord.id, 'Meeting outcome not recorded');
      return {
        success: false,
        reason: 'Meeting timeout',
        dealId: dealRecord.id
      };
    }
    
    const proceedToProposal = await step.do('process-meeting-outcome', async () => {
      if (meetingOutcome.payload.outcome === 'pass') {
        await this.updateDealStatus(dealRecord.id, 'PASSED_AFTER_MEETING');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'production_passed',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            dealId: dealRecord.id,
            productionCompanyId: params.productionCompanyId,
            notes: meetingOutcome.payload.notes
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      if (meetingOutcome.payload.outcome === 'need_more_info') {
        // Schedule follow-up meeting
        if (meetingOutcome.payload.nextMeetingDate) {
          await step.sleep(
            'wait-for-follow-up-meeting',
            new Date(meetingOutcome.payload.nextMeetingDate).getTime() - Date.now()
          );
          
          // Recursively wait for next meeting outcome
          const followUpOutcome = await step.waitForEvent<MeetingOutcome>(
            'wait-for-follow-up-meeting-outcome',
            { timeout: '7 days' }
          );
          
          if (!followUpOutcome || followUpOutcome.payload.outcome !== 'proceed') {
            await this.updateDealStatus(dealRecord.id, 'DISCONTINUED');
            return false;
          }
        }
      }
      
      // Proceed to proposal stage
      await this.updateDealStatus(dealRecord.id, 'AWAITING_PROPOSAL');
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'proposal_requested',
        recipientId: params.productionCompanyUserId,
        recipientType: 'production',
        data: {
          dealId: dealRecord.id,
          pitchId: params.pitchId,
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      return true;
    });
    
    if (!proceedToProposal) {
      return {
        success: false,
        reason: 'Deal did not proceed to proposal',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 6: Wait for Production Proposal
    // ========================================================================
    const proposal = await step.waitForEvent<ProposalSubmission>(
      'wait-for-proposal-submission',
      { timeout: '14 days' }
    );
    
    if (!proposal) {
      await this.handleTimeout(dealRecord.id, 'Proposal not submitted');
      return {
        success: false,
        reason: 'Proposal timeout',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 7: Creator Reviews Proposal
    // ========================================================================
    await step.do('notify-creator-of-proposal', async () => {
      await this.updateDealStatus(dealRecord.id, 'PROPOSAL_SUBMITTED');
      
      // Store proposal
      await this.env.DOCUMENTS.put(
        `proposals/${dealRecord.id}/proposal.json`,
        JSON.stringify(proposal.payload)
      );
      
      // Grant 30-day exclusivity for negotiation
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      await db(`
        UPDATE production_deals
        SET 
          exclusivity_granted_at = NOW(),
          exclusivity_expires_at = NOW() + INTERVAL '30 days'
        WHERE id = $1
      `, [dealRecord.id]);
      
      // Notify other interested parties they're waitlisted
      await this.notifyWaitlistedCompanies(params.pitchId, dealRecord.id);
      
      // Send proposal to creator
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'proposal_ready_for_review',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          proposalKey: proposal.payload.proposalDocumentKey,
          terms: proposal.payload.terms,
          reviewDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
    });
    
    const proposalResponse = await step.waitForEvent<ProposalResponse>(
      'wait-for-proposal-response',
      { timeout: '7 days' }
    );
    
    if (!proposalResponse) {
      await this.releaseExclusivity(dealRecord.id);
      return {
        success: false,
        reason: 'Creator did not respond to proposal',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 8: Negotiation
    // ========================================================================
    const finalTerms = await step.do('negotiate-terms', async () => {
      if (proposalResponse.payload.decision === 'reject') {
        await this.updateDealStatus(dealRecord.id, 'PROPOSAL_REJECTED');
        await this.releaseExclusivity(dealRecord.id);
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'proposal_rejected',
          recipientId: params.productionCompanyUserId,
          recipientType: 'production',
          data: {
            dealId: dealRecord.id,
            message: proposalResponse.payload.message
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return null;
      }
      
      let terms = proposal.payload.terms;
      
      if (proposalResponse.payload.decision === 'counter') {
        await this.updateDealStatus(dealRecord.id, 'NEGOTIATION');
        
        // Handle counter proposal
        terms = { ...terms, ...proposalResponse.payload.counterTerms };
        
        // Send counter to production company
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'counter_proposal',
          recipientId: params.productionCompanyUserId,
          recipientType: 'production',
          data: {
            dealId: dealRecord.id,
            originalTerms: proposal.payload.terms,
            counterTerms: proposalResponse.payload.counterTerms,
            message: proposalResponse.payload.message
          },
          channels: ['email', 'push', 'in_app'],
          priority: 'high'
        });
        
        // Wait for production company response
        const counterResponse = await step.waitForEvent<{accepted: boolean}>(
          'wait-for-counter-response',
          { timeout: '3 days' }
        );
        
        if (!counterResponse || !counterResponse.payload.accepted) {
          await this.updateDealStatus(dealRecord.id, 'NEGOTIATION_FAILED');
          await this.releaseExclusivity(dealRecord.id);
          return null;
        }
      }
      
      // Terms accepted
      await this.updateDealStatus(dealRecord.id, 'TERMS_AGREED');
      return terms;
    });
    
    if (!finalTerms) {
      return {
        success: false,
        reason: 'Negotiation failed',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 9: Contract Generation and Signing
    // ========================================================================
    const contractKey = await step.do('generate-contract', async () => {
      await this.updateDealStatus(dealRecord.id, 'CONTRACT_DRAFTING');
      
      // Generate production contract
      const contract = {
        dealId: dealRecord.id,
        productionCompanyId: params.productionCompanyId,
        creatorId: params.creatorId,
        pitchId: params.pitchId,
        terms: finalTerms,
        interestType: params.interestType,
        generatedAt: new Date().toISOString()
      };
      
      const contractKey = `contracts/${dealRecord.id}/production-agreement.json`;
      await this.env.DOCUMENTS.put(contractKey, JSON.stringify(contract));
      
      // Send for signatures
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'contract_ready',
        recipientId: params.productionCompanyUserId,
        recipientType: 'production',
        data: {
          dealId: dealRecord.id,
          contractKey,
          signingDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'contract_ready',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          contractKey,
          signingDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      return contractKey;
    });
    
    // ========================================================================
    // Step 10: Wait for Contract Signatures
    // ========================================================================
    const contractSigned = await step.waitForEvent<{signedDocumentKey: string, signedAt: string}>(
      'wait-for-contract-signed',
      { timeout: '5 days' }
    );
    
    if (!contractSigned) {
      await this.updateDealStatus(dealRecord.id, 'CONTRACT_EXPIRED');
      await this.releaseExclusivity(dealRecord.id);
      return {
        success: false,
        reason: 'Contract not signed in time',
        dealId: dealRecord.id
      };
    }
    
    // ========================================================================
    // Step 11: Activate Production
    // ========================================================================
    await step.do('activate-production', async () => {
      await this.updateDealStatus(dealRecord.id, 'PRODUCTION_ACTIVE');
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Update pitch status
      await db(`
        UPDATE pitches
        SET 
          production_status = 'in_production',
          production_company_id = $1,
          production_started_at = NOW()
        WHERE id = $2
      `, [params.productionCompanyId, params.pitchId]);
      
      // Grant production company full access
      await this.grantPitchAccess(
        params.productionCompanyUserId,
        params.pitchId,
        'production_full'
      );
      
      // Create production tracking record
      await db(`
        INSERT INTO production_tracking (
          id, deal_id, pitch_id, production_company_id,
          status, started_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        crypto.randomUUID(),
        dealRecord.id,
        params.pitchId,
        params.productionCompanyId,
        'pre_production'
      ]);
      
      // Release exclusivity permanently
      await this.releaseExclusivity(dealRecord.id);
      
      // Notify all parties
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'production_started',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          pitchId: params.pitchId,
          productionCompanyId: params.productionCompanyId,
          timeline: finalTerms.timeline
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'production_activated',
        recipientId: params.productionCompanyUserId,
        recipientType: 'production',
        data: {
          dealId: dealRecord.id,
          pitchId: params.pitchId,
          accessGranted: true
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
    });
    
    // ========================================================================
    // Step 12: Monitor Production (Long-Running)
    // ========================================================================
    // In production, this would monitor milestones and deliverables
    // For now, we'll wait for a completion event
    
    const productionComplete = await step.waitForEvent<{completedAt: string}>(
      'wait-for-production-complete',
      { timeout: '365 days' }  // 1 year timeout for production
    );
    
    // ========================================================================
    // Step 13: Complete Deal
    // ========================================================================
    await step.do('complete-production-deal', async () => {
      await this.updateDealStatus(dealRecord.id, 'COMPLETED');
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Update pitch status
      await db(`
        UPDATE pitches
        SET 
          production_status = 'completed',
          production_completed_at = NOW()
        WHERE id = $1
      `, [params.pitchId]);
      
      // Send completion notifications
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'production_complete',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          dealId: dealRecord.id,
          pitchId: params.pitchId,
          completedAt: productionComplete?.payload.completedAt || new Date().toISOString()
        },
        channels: ['email', 'push', 'in_app'],
        priority: 'high'
      });
    });
    
    // ========================================================================
    // Workflow Complete
    // ========================================================================
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      dealId: dealRecord.id,
      productionCompanyId: params.productionCompanyId,
      creatorId: params.creatorId,
      pitchId: params.pitchId,
      finalTerms,
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
      UPDATE production_deals
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, dealId]);
  }
  
  private async handleTimeout(dealId: string, reason: string): Promise<void> {
    await this.updateDealStatus(dealId, 'TIMEOUT');
    
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const deal = await db(`
      SELECT production_company_user_id, creator_id
      FROM production_deals
      WHERE id = $1
    `, [dealId]);
    
    if (deal.length > 0) {
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'deal_timeout',
        recipientId: deal[0].production_company_user_id,
        recipientType: 'production',
        data: { dealId, reason },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'deal_timeout',
        recipientId: deal[0].creator_id,
        recipientType: 'creator',
        data: { dealId, reason },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
    }
  }
  
  private async notifyWaitlistedCompanies(pitchId: string, activeDealId: string): Promise<void> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const waitlisted = await db(`
      SELECT id, production_company_user_id
      FROM production_deals
      WHERE pitch_id = $1 
        AND id != $2
        AND status = 'INTEREST'
    `, [pitchId, activeDealId]);
    
    for (const deal of waitlisted) {
      await db(`
        UPDATE production_deals
        SET status = 'WAITLISTED'
        WHERE id = $1
      `, [deal.id]);
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'waitlisted',
        recipientId: deal.production_company_user_id,
        recipientType: 'production',
        data: {
          dealId: deal.id,
          reason: 'Another company has been granted exclusivity',
          estimatedWaitTime: '30 days'
        },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
    }
  }
  
  private async releaseExclusivity(dealId: string): Promise<void> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    await db(`
      UPDATE production_deals
      SET exclusivity_expires_at = NOW()
      WHERE id = $1
    `, [dealId]);
    
    // Notify waitlisted companies they can now proceed
    const deal = await db(`
      SELECT pitch_id FROM production_deals WHERE id = $1
    `, [dealId]);
    
    if (deal.length > 0) {
      const waitlisted = await db(`
        SELECT id, production_company_user_id
        FROM production_deals
        WHERE pitch_id = $1 
          AND status = 'WAITLISTED'
      `, [deal[0].pitch_id]);
      
      for (const waitlistedDeal of waitlisted) {
        await db(`
          UPDATE production_deals
          SET status = 'INTEREST'
          WHERE id = $1
        `, [waitlistedDeal.id]);
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'waitlist_activated',
          recipientId: waitlistedDeal.production_company_user_id,
          recipientType: 'production',
          data: {
            dealId: waitlistedDeal.id,
            message: 'You can now proceed with your proposal'
          },
          channels: ['email', 'push', 'in_app'],
          priority: 'high'
        });
      }
    }
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
      'production_deal'
    ]);
  }
}