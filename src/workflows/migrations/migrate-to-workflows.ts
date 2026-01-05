/**
 * Migration Script: Transition from manual state machines to Cloudflare Workflows
 * Handles data migration, state mapping, and workflow instantiation
 */

import postgres from 'postgres';
import { WorkflowEntrypoint, WorkflowEvent } from 'cloudflare:workers';

interface LegacyDeal {
  id: string;
  type: 'investment' | 'production' | 'nda';
  state: string;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  // Investment specific
  investor_id?: string;
  pitch_id?: string;
  amount?: number;
  // Production specific
  company_id?: string;
  company_name?: string;
  // NDA specific
  requester_id?: string;
  document_id?: string;
}

interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: Array<{ dealId: string; error: string }>;
  workflows: Array<{ dealId: string; workflowId: string }>;
}

export class WorkflowMigration {
  private db: postgres.Sql;
  private env: any;
  private dryRun: boolean;
  
  // State mappings from legacy to new workflow states
  private readonly STATE_MAPPINGS = {
    investment: {
      'initial': 'INTEREST',
      'pending_qualification': 'INTEREST',
      'qualified': 'QUALIFIED',
      'pending_approval': 'PENDING_CREATOR',
      'approved': 'APPROVED',
      'rejected': 'CREATOR_REJECTED',
      'term_sheet_sent': 'TERM_SHEET',
      'term_sheet_signed': 'SIGNED',
      'payment_pending': 'ESCROW',
      'payment_received': 'ESCROW',
      'funds_transferred': 'FUNDS_RELEASED',
      'complete': 'COMPLETED',
      'cancelled': 'WITHDRAWN'
    },
    production: {
      'initial': 'INTEREST',
      'interest_expressed': 'INTEREST',
      'meeting_scheduled': 'MEETING',
      'meeting_held': 'MEETING',
      'proposal_submitted': 'PROPOSAL',
      'negotiating': 'NEGOTIATION',
      'contract_draft': 'CONTRACT',
      'contract_signed': 'CONTRACT',
      'in_production': 'PRODUCTION',
      'complete': 'COMPLETED',
      'rejected': 'REJECTED',
      'withdrawn': 'WITHDRAWN'
    },
    nda: {
      'requested': 'PENDING',
      'pending_review': 'RISK_ASSESSMENT',
      'in_review': 'REVIEW',
      'approved': 'APPROVED',
      'pending_signature': 'APPROVED',
      'signed': 'SIGNED',
      'active': 'ACCESS_GRANTED',
      'rejected': 'REJECTED',
      'expired': 'EXPIRED'
    }
  };

  constructor(db: postgres.Sql, env: any, dryRun: boolean = false) {
    this.db = db;
    this.env = env;
    this.dryRun = dryRun;
  }

  /**
   * Main migration entry point
   */
  async migrate(
    batchSize: number = 100,
    types?: Array<'investment' | 'production' | 'nda'>
  ): Promise<MigrationResult> {
    console.log(`Starting workflow migration (dry run: ${this.dryRun})`);
    
    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      workflows: []
    };

    const dealTypes = types || ['investment', 'production', 'nda'];
    
    for (const type of dealTypes) {
      console.log(`Migrating ${type} deals...`);
      const typeResult = await this.migrateDealType(type, batchSize);
      
      // Aggregate results
      result.total += typeResult.total;
      result.migrated += typeResult.migrated;
      result.failed += typeResult.failed;
      result.skipped += typeResult.skipped;
      result.errors.push(...typeResult.errors);
      result.workflows.push(...typeResult.workflows);
    }

    // Generate migration report
    await this.generateReport(result);
    
    return result;
  }

  /**
   * Migrate specific deal type
   */
  private async migrateDealType(
    type: 'investment' | 'production' | 'nda',
    batchSize: number
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      workflows: []
    };

    // Get legacy deals from database
    const tableName = this.getTableName(type);
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const deals = await this.db`
        SELECT *
        FROM ${this.db(tableName)}
        WHERE workflow_id IS NULL
          AND status NOT IN ('completed', 'cancelled', 'rejected')
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        OFFSET ${offset}
      `;

      if (deals.length === 0) {
        hasMore = false;
        break;
      }

      result.total += deals.length;

      // Process each deal
      for (const deal of deals) {
        try {
          const migrated = await this.migrateDeal(deal, type);
          
          if (migrated) {
            result.migrated++;
            result.workflows.push({
              dealId: deal.id,
              workflowId: migrated.workflowId
            });
          } else {
            result.skipped++;
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            dealId: deal.id,
            error: error.message
          });
          console.error(`Failed to migrate deal ${deal.id}:`, error);
        }
      }

      offset += batchSize;
      
      // Add delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return result;
  }

  /**
   * Migrate individual deal to workflow
   */
  private async migrateDeal(
    deal: any,
    type: 'investment' | 'production' | 'nda'
  ): Promise<{ workflowId: string } | null> {
    // Check if deal should be migrated
    if (!this.shouldMigrate(deal)) {
      console.log(`Skipping deal ${deal.id} - not eligible for migration`);
      return null;
    }

    // Map legacy state to workflow state
    const workflowState = this.mapState(deal.state || deal.status, type);
    
    if (!workflowState) {
      console.warn(`Cannot map state ${deal.state || deal.status} for ${type} deal ${deal.id}`);
      return null;
    }

    // Prepare workflow parameters
    const workflowParams = this.prepareWorkflowParams(deal, type);
    
    if (this.dryRun) {
      console.log(`[DRY RUN] Would create ${type} workflow for deal ${deal.id}`);
      console.log(`  State: ${deal.state || deal.status} -> ${workflowState}`);
      console.log(`  Params:`, workflowParams);
      return { workflowId: `dry-run-${deal.id}` };
    }

    // Create workflow instance
    const workflowId = await this.createWorkflow(type, workflowParams, workflowState, deal);
    
    // Update database with workflow ID
    await this.updateDealWithWorkflow(deal.id, type, workflowId);
    
    // Migrate related data
    await this.migrateRelatedData(deal.id, type, workflowId);
    
    console.log(`Successfully migrated ${type} deal ${deal.id} to workflow ${workflowId}`);
    
    return { workflowId };
  }

  /**
   * Check if deal should be migrated
   */
  private shouldMigrate(deal: any): boolean {
    // Don't migrate completed or terminal state deals
    const terminalStates = ['completed', 'cancelled', 'rejected', 'expired', 'terminated'];
    if (terminalStates.includes(deal.state || deal.status)) {
      return false;
    }

    // Don't migrate if already has workflow ID
    if (deal.workflow_id) {
      return false;
    }

    // Don't migrate deals older than 90 days with no activity
    const lastActivity = new Date(deal.updated_at || deal.created_at);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActivity > 90) {
      console.log(`Deal ${deal.id} has been inactive for ${daysSinceActivity.toFixed(0)} days`);
      return false;
    }

    return true;
  }

  /**
   * Map legacy state to workflow state
   */
  private mapState(legacyState: string, type: 'investment' | 'production' | 'nda'): string | null {
    const mapping = this.STATE_MAPPINGS[type];
    return mapping[legacyState.toLowerCase()] || null;
  }

  /**
   * Prepare workflow parameters from legacy deal
   */
  private prepareWorkflowParams(deal: any, type: 'investment' | 'production' | 'nda'): any {
    const baseParams = {
      dealId: deal.id,
      createdAt: deal.created_at,
      migratedFrom: 'legacy_system',
      originalState: deal.state || deal.status
    };

    switch (type) {
      case 'investment':
        return {
          ...baseParams,
          investorId: deal.investor_id,
          pitchId: deal.pitch_id,
          amount: deal.amount,
          investorType: deal.investor_type || 'unknown',
          investorEmail: deal.investor_email || '',
          creatorId: deal.creator_id || '',
          creatorEmail: deal.creator_email || '',
          pitchTitle: deal.pitch_title || '',
          minimumInvestment: deal.minimum_investment || 0,
          maximumInvestment: deal.maximum_investment || 0,
          targetRaise: deal.target_raise || 0
        };

      case 'production':
        return {
          ...baseParams,
          companyId: deal.company_id,
          companyName: deal.company_name,
          pitchId: deal.pitch_id,
          creatorId: deal.creator_id || '',
          proposalId: deal.proposal_id,
          budget: deal.budget || 0,
          productionTimeline: deal.timeline || ''
        };

      case 'nda':
        return {
          ...baseParams,
          requesterId: deal.requester_id || deal.user_id,
          pitchId: deal.pitch_id,
          documentId: deal.document_id,
          requesterEmail: deal.requester_email || '',
          requesterType: deal.requester_type || 'investor',
          pitchTitle: deal.pitch_title || '',
          creatorId: deal.creator_id || ''
        };

      default:
        return baseParams;
    }
  }

  /**
   * Create workflow instance
   */
  private async createWorkflow(
    type: 'investment' | 'production' | 'nda',
    params: any,
    targetState: string,
    originalDeal: any
  ): Promise<string> {
    // Generate workflow ID
    const workflowId = `${type}_${originalDeal.id}_${Date.now()}`;
    
    // Create workflow via API
    const response = await fetch(`${this.env.WORKER_URL}/api/workflows/${type}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Migration': 'true'
      },
      body: JSON.stringify({
        ...params,
        workflowId,
        resumeFromState: targetState,
        skipValidation: true // Skip validation for migration
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create workflow: ${await response.text()}`);
    }

    const result = await response.json();
    
    // Fast-forward workflow to target state
    if (targetState !== 'INTEREST' && targetState !== 'PENDING') {
      await this.fastForwardWorkflow(workflowId, type, targetState, originalDeal);
    }

    return workflowId;
  }

  /**
   * Fast-forward workflow to target state
   */
  private async fastForwardWorkflow(
    workflowId: string,
    type: 'investment' | 'production' | 'nda',
    targetState: string,
    originalDeal: any
  ): Promise<void> {
    // Send events to move workflow to target state
    const events = this.generateTransitionEvents(type, targetState, originalDeal);
    
    for (const event of events) {
      await fetch(`${this.env.WORKER_URL}/api/workflows/${type}/${workflowId}/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Migration': 'true'
        },
        body: JSON.stringify(event)
      });
      
      // Small delay between events
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Generate transition events to reach target state
   */
  private generateTransitionEvents(
    type: 'investment' | 'production' | 'nda',
    targetState: string,
    deal: any
  ): any[] {
    const events: any[] = [];
    
    switch (type) {
      case 'investment':
        if (['QUALIFIED', 'PENDING_CREATOR', 'APPROVED', 'TERM_SHEET', 'SIGNED', 'ESCROW', 'FUNDS_RELEASED'].includes(targetState)) {
          events.push({ type: 'qualify', qualified: true });
        }
        if (['APPROVED', 'TERM_SHEET', 'SIGNED', 'ESCROW', 'FUNDS_RELEASED'].includes(targetState)) {
          events.push({ type: 'creator_decision', decision: 'approve' });
        }
        if (['SIGNED', 'ESCROW', 'FUNDS_RELEASED'].includes(targetState)) {
          events.push({ type: 'term_sheet_signed', signed: true });
        }
        if (['ESCROW', 'FUNDS_RELEASED'].includes(targetState)) {
          events.push({ type: 'payment_received', amount: deal.amount });
        }
        if (targetState === 'FUNDS_RELEASED') {
          events.push({ type: 'funds_released', released: true });
        }
        break;

      case 'production':
        if (['MEETING', 'PROPOSAL', 'NEGOTIATION', 'CONTRACT', 'PRODUCTION'].includes(targetState)) {
          events.push({ type: 'meeting_scheduled', scheduled: true });
        }
        if (['PROPOSAL', 'NEGOTIATION', 'CONTRACT', 'PRODUCTION'].includes(targetState)) {
          events.push({ type: 'proposal_submitted', proposal: deal.proposal_id });
        }
        if (['NEGOTIATION', 'CONTRACT', 'PRODUCTION'].includes(targetState)) {
          events.push({ type: 'enter_negotiation', exclusive: true });
        }
        if (['CONTRACT', 'PRODUCTION'].includes(targetState)) {
          events.push({ type: 'contract_ready', contractId: deal.contract_id });
        }
        if (targetState === 'PRODUCTION') {
          events.push({ type: 'contract_signed', allParties: true });
        }
        break;

      case 'nda':
        if (['RISK_ASSESSMENT', 'REVIEW', 'APPROVED', 'SIGNED', 'ACCESS_GRANTED'].includes(targetState)) {
          events.push({ type: 'risk_assessed', riskLevel: 'medium' });
        }
        if (['APPROVED', 'SIGNED', 'ACCESS_GRANTED'].includes(targetState)) {
          events.push({ type: 'review_complete', approved: true });
        }
        if (['SIGNED', 'ACCESS_GRANTED'].includes(targetState)) {
          events.push({ type: 'document_signed', signedAt: deal.signed_at });
        }
        if (targetState === 'ACCESS_GRANTED') {
          events.push({ type: 'access_granted', grantedAt: new Date() });
        }
        break;
    }
    
    return events;
  }

  /**
   * Update deal with workflow ID
   */
  private async updateDealWithWorkflow(
    dealId: string,
    type: 'investment' | 'production' | 'nda',
    workflowId: string
  ): Promise<void> {
    const tableName = this.getTableName(type);
    
    await this.db`
      UPDATE ${this.db(tableName)}
      SET 
        workflow_id = ${workflowId},
        migrated_at = NOW(),
        migration_version = '1.0.0'
      WHERE id = ${dealId}
    `;
  }

  /**
   * Migrate related data (documents, messages, etc.)
   */
  private async migrateRelatedData(
    dealId: string,
    type: 'investment' | 'production' | 'nda',
    workflowId: string
  ): Promise<void> {
    // Migrate documents
    await this.db`
      UPDATE documents
      SET workflow_id = ${workflowId}
      WHERE deal_id = ${dealId}
        AND deal_type = ${type}
    `;
    
    // Migrate messages
    await this.db`
      UPDATE messages
      SET workflow_id = ${workflowId}
      WHERE deal_id = ${dealId}
        AND deal_type = ${type}
    `;
    
    // Migrate audit logs
    await this.db`
      UPDATE audit_logs
      SET workflow_id = ${workflowId}
      WHERE entity_id = ${dealId}
        AND entity_type = ${type + '_deal'}
    `;
    
    // Type-specific migrations
    switch (type) {
      case 'investment':
        await this.db`
          UPDATE payment_transactions
          SET workflow_id = ${workflowId}
          WHERE investment_id = ${dealId}
        `;
        break;
        
      case 'production':
        await this.db`
          UPDATE production_milestones
          SET workflow_id = ${workflowId}
          WHERE deal_id = ${dealId}
        `;
        break;
        
      case 'nda':
        await this.db`
          UPDATE access_logs
          SET workflow_id = ${workflowId}
          WHERE nda_id = ${dealId}
        `;
        break;
    }
  }

  /**
   * Get table name for deal type
   */
  private getTableName(type: 'investment' | 'production' | 'nda'): string {
    switch (type) {
      case 'investment':
        return 'investment_deals';
      case 'production':
        return 'production_deals';
      case 'nda':
        return 'nda_requests';
      default:
        throw new Error(`Unknown deal type: ${type}`);
    }
  }

  /**
   * Generate migration report
   */
  private async generateReport(result: MigrationResult): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_deals: result.total,
        successfully_migrated: result.migrated,
        failed: result.failed,
        skipped: result.skipped,
        success_rate: result.total > 0 ? (result.migrated / result.total) * 100 : 0
      },
      errors: result.errors,
      migrated_workflows: result.workflows
    };

    // Store report in KV
    await this.env.KV.put(
      `migration_report_${Date.now()}`,
      JSON.stringify(report),
      { expirationTtl: 86400 * 30 } // Keep for 30 days
    );

    // Log report summary
    console.log('\n=== Migration Report ===');
    console.log(`Total Deals: ${result.total}`);
    console.log(`Successfully Migrated: ${result.migrated}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Success Rate: ${report.summary.success_rate.toFixed(2)}%`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => {
        console.log(`  - Deal ${error.dealId}: ${error.error}`);
      });
    }
  }

  /**
   * Rollback migration for specific deals
   */
  async rollback(workflowIds: string[]): Promise<void> {
    console.log(`Rolling back ${workflowIds.length} workflows...`);
    
    for (const workflowId of workflowIds) {
      try {
        // Parse workflow ID to get type and deal ID
        const [type, dealId] = workflowId.split('_');
        
        // Remove workflow ID from deal
        const tableName = this.getTableName(type as any);
        await this.db`
          UPDATE ${this.db(tableName)}
          SET 
            workflow_id = NULL,
            migrated_at = NULL,
            migration_version = NULL
          WHERE id = ${dealId}
        `;
        
        // Delete workflow instance (would need API call)
        await fetch(`${this.env.WORKER_URL}/api/workflows/${workflowId}`, {
          method: 'DELETE',
          headers: {
            'X-Migration-Rollback': 'true'
          }
        });
        
        console.log(`Rolled back workflow ${workflowId}`);
      } catch (error) {
        console.error(`Failed to rollback workflow ${workflowId}:`, error);
      }
    }
  }

  /**
   * Verify migration integrity
   */
  async verify(): Promise<{
    valid: number;
    invalid: number;
    issues: Array<{ workflowId: string; issue: string }>;
  }> {
    const result = {
      valid: 0,
      invalid: 0,
      issues: [] as Array<{ workflowId: string; issue: string }>
    };

    // Get all migrated deals
    const deals = await this.db`
      SELECT 
        id,
        workflow_id,
        state,
        type
      FROM (
        SELECT id, workflow_id, status as state, 'investment' as type FROM investment_deals WHERE workflow_id IS NOT NULL
        UNION ALL
        SELECT id, workflow_id, status as state, 'production' as type FROM production_deals WHERE workflow_id IS NOT NULL
        UNION ALL
        SELECT id, workflow_id, status as state, 'nda' as type FROM nda_requests WHERE workflow_id IS NOT NULL
      ) AS all_deals
    `;

    for (const deal of deals) {
      try {
        // Verify workflow exists and is in correct state
        const response = await fetch(
          `${this.env.WORKER_URL}/api/workflows/${deal.workflow_id}/status`
        );
        
        if (!response.ok) {
          result.invalid++;
          result.issues.push({
            workflowId: deal.workflow_id,
            issue: 'Workflow not found'
          });
          continue;
        }

        const workflow = await response.json();
        
        // Verify state mapping is correct
        const expectedState = this.mapState(deal.state, deal.type);
        if (workflow.state !== expectedState) {
          result.invalid++;
          result.issues.push({
            workflowId: deal.workflow_id,
            issue: `State mismatch: expected ${expectedState}, got ${workflow.state}`
          });
        } else {
          result.valid++;
        }
      } catch (error) {
        result.invalid++;
        result.issues.push({
          workflowId: deal.workflow_id,
          issue: `Verification failed: ${error}`
        });
      }
    }

    return result;
  }
}

// CLI interface for running migrations
export async function runMigration(
  env: any,
  args: string[]
): Promise<void> {
  const db = postgres(env.DATABASE_URL);
  const dryRun = args.includes('--dry-run');
  const types = args
    .filter(arg => ['investment', 'production', 'nda'].includes(arg))
    .map(type => type as 'investment' | 'production' | 'nda');
  
  const migration = new WorkflowMigration(db, env, dryRun);
  
  try {
    if (args.includes('--verify')) {
      const verification = await migration.verify();
      console.log('Verification Results:', verification);
    } else if (args.includes('--rollback')) {
      const workflowIds = args.filter(arg => arg.includes('_'));
      await migration.rollback(workflowIds);
    } else {
      const result = await migration.migrate(100, types.length > 0 ? types : undefined);
      console.log('Migration Complete:', result);
    }
  } finally {
    await db.end();
  }
}