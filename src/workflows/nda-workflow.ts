/**
 * NDA Workflow - Automated NDA Processing with Risk-Based Routing
 * 
 * This workflow automates the NDA signing process that gates access to 
 * confidential pitch materials. It implements risk-based routing where
 * 80%+ of standard NDAs are auto-approved within seconds.
 * 
 * States:
 * 1. DRAFT - NDA being prepared
 * 2. PENDING - Awaiting signature
 * 3. VIEWED - Document opened by recipient
 * 4. SIGNED - NDA executed
 * 5. ACTIVE - NDA in effect, access granted
 * 6. EXPIRED - NDA term ended
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// ============================================================================
// Type Definitions
// ============================================================================

interface NDAParams {
  requesterId: string;
  requesterType: 'investor' | 'production' | 'partner';
  requesterEmail: string;
  requesterName: string;
  creatorId: string;
  pitchId: string;
  templateId: string;
  customTerms?: Record<string, any>;
  durationMonths?: number;
  territorialRestrictions?: string[];
}

interface NDARecord {
  id: string;
  workflowInstanceId: string;
  requesterId: string;
  creatorId: string;
  pitchId: string;
  templateId: string;
  status: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  durationMonths: number;
  envelopeId?: string;
  effectiveDate?: string;
  expirationDate?: string;
  createdAt: string;
}

interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: {
    requesterVerification: number;
    templateComplexity: number;
    customTermsCount: number;
    durationRisk: number;
    territorialComplexity: number;
    priorHistory: number;
  };
  requiresReview: boolean;
  reviewReason?: string;
}

interface SignatureStatus {
  envelopeId: string;
  status: 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  signedAt?: string;
  declinedReason?: string;
}

interface LegalReviewDecision {
  decision: 'approve' | 'reject' | 'modify';
  reviewerId: string;
  notes?: string;
  modifiedTerms?: Record<string, any>;
}

// ============================================================================
// Main Workflow Class
// ============================================================================

export class NDAWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<NDAParams>, step: WorkflowStep) {
    const { params } = event;
    const startTime = Date.now();
    
    console.log(`Starting NDA workflow for pitch ${params.pitchId}`);
    
    // ========================================================================
    // Step 1: Create NDA Record
    // ========================================================================
    const ndaRecord = await step.do('create-nda-record', async () => {
      const ndaId = crypto.randomUUID();
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Check if requester already has active NDA for this pitch
      const existingNDA = await db(`
        SELECT id, status, expiration_date
        FROM ndas
        WHERE requester_id = $1 
          AND pitch_id = $2
          AND status IN ('ACTIVE', 'PENDING', 'SIGNED')
          AND (expiration_date IS NULL OR expiration_date > NOW())
      `, [params.requesterId, params.pitchId]);
      
      if (existingNDA.length > 0) {
        throw new Error(`Active NDA already exists: ${existingNDA[0].id}`);
      }
      
      // Create NDA record
      const duration = params.durationMonths || 24; // Default 2 years
      
      await db(`
        INSERT INTO ndas (
          id, workflow_instance_id, requester_id, requester_type,
          creator_id, pitch_id, template_id, status, 
          duration_months, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        ndaId,
        this.env.WORKFLOW_INSTANCE_ID,
        params.requesterId,
        params.requesterType,
        params.creatorId,
        params.pitchId,
        params.templateId,
        'DRAFT',
        duration
      ]);
      
      return {
        id: ndaId,
        workflowInstanceId: this.env.WORKFLOW_INSTANCE_ID,
        requesterId: params.requesterId,
        creatorId: params.creatorId,
        pitchId: params.pitchId,
        templateId: params.templateId,
        status: 'DRAFT',
        riskLevel: 'low' as const,
        riskScore: 0,
        durationMonths: duration,
        createdAt: new Date().toISOString()
      } as NDARecord;
    });
    
    // ========================================================================
    // Step 2: Risk Assessment
    // ========================================================================
    const riskAssessment = await step.do('assess-risk', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      const assessment: RiskAssessment = {
        score: 0,
        level: 'low',
        factors: {
          requesterVerification: 0,
          templateComplexity: 0,
          customTermsCount: 0,
          durationRisk: 0,
          territorialComplexity: 0,
          priorHistory: 0
        },
        requiresReview: false
      };
      
      // Check requester verification status
      const requester = await db(`
        SELECT 
          email_verified,
          phone_verified,
          identity_verified,
          created_at,
          trust_score
        FROM users
        WHERE id = $1
      `, [params.requesterId]);
      
      if (requester.length === 0) {
        assessment.factors.requesterVerification = 30;
        assessment.requiresReview = true;
        assessment.reviewReason = 'Requester not found in database';
      } else {
        const user = requester[0];
        
        // Calculate verification score
        if (!user.email_verified) assessment.factors.requesterVerification += 10;
        if (!user.phone_verified) assessment.factors.requesterVerification += 5;
        if (!user.identity_verified) assessment.factors.requesterVerification += 15;
        
        // Account age factor
        const accountAge = Date.now() - new Date(user.created_at).getTime();
        const daysOld = accountAge / (1000 * 60 * 60 * 24);
        if (daysOld < 7) assessment.factors.requesterVerification += 10;
        else if (daysOld < 30) assessment.factors.requesterVerification += 5;
        
        // Trust score factor
        if (user.trust_score < 50) assessment.factors.requesterVerification += 10;
      }
      
      // Check template complexity
      const template = await this.env.NDA_TEMPLATES.get(params.templateId, 'json') as any;
      if (!template || template.type === 'custom') {
        assessment.factors.templateComplexity = 20;
        assessment.requiresReview = true;
        assessment.reviewReason = 'Custom or unknown template';
      } else if (template.type === 'enhanced') {
        assessment.factors.templateComplexity = 10;
      }
      
      // Custom terms complexity
      const customTermsCount = Object.keys(params.customTerms || {}).length;
      assessment.factors.customTermsCount = customTermsCount * 5;
      if (customTermsCount > 3) {
        assessment.requiresReview = true;
        assessment.reviewReason = 'Multiple custom terms require review';
      }
      
      // Duration risk
      if (params.durationMonths && params.durationMonths > 36) {
        assessment.factors.durationRisk = 10;
      } else if (params.durationMonths && params.durationMonths < 12) {
        assessment.factors.durationRisk = 5; // Unusually short
      }
      
      // Territorial complexity
      if (params.territorialRestrictions && params.territorialRestrictions.length > 0) {
        assessment.factors.territorialComplexity = params.territorialRestrictions.length * 3;
        if (params.territorialRestrictions.length > 5) {
          assessment.requiresReview = true;
          assessment.reviewReason = 'Complex territorial restrictions';
        }
      }
      
      // Check prior NDA history
      const priorNDAs = await db(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status = 'BREACHED' THEN 1 ELSE 0 END) as breached,
          SUM(CASE WHEN status = 'DISPUTED' THEN 1 ELSE 0 END) as disputed
        FROM ndas
        WHERE requester_id = $1
      `, [params.requesterId]);
      
      if (priorNDAs[0].breached > 0) {
        assessment.factors.priorHistory = 30;
        assessment.requiresReview = true;
        assessment.reviewReason = 'Prior NDA breach';
      } else if (priorNDAs[0].disputed > 0) {
        assessment.factors.priorHistory = 15;
      }
      
      // Calculate total risk score
      assessment.score = Object.values(assessment.factors).reduce((sum, val) => sum + val, 0);
      
      // Determine risk level
      if (assessment.score >= 80) {
        assessment.level = 'high';
        assessment.requiresReview = true;
      } else if (assessment.score >= 40) {
        assessment.level = 'medium';
      } else {
        assessment.level = 'low';
      }
      
      // Update NDA record with risk assessment
      await db(`
        UPDATE ndas
        SET risk_level = $1, risk_score = $2
        WHERE id = $3
      `, [assessment.level, assessment.score, ndaRecord.id]);
      
      // Log risk assessment
      console.log(`NDA ${ndaRecord.id} risk assessment:`, assessment);
      
      return assessment;
    }, {
      retries: {
        limit: 2,
        backoff: 'linear',
        delay: 1000
      }
    });
    
    // ========================================================================
    // Step 3: Route Based on Risk Level
    // ========================================================================
    
    let approvalDecision: 'auto_approved' | 'creator_approved' | 'legal_approved' | 'rejected' = 'auto_approved';
    
    if (riskAssessment.level === 'high' || riskAssessment.requiresReview) {
      // High risk - requires legal review
      await step.do('request-legal-review', async () => {
        await this.updateNDAStatus(ndaRecord.id, 'LEGAL_REVIEW');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_legal_review_required',
          recipientId: 'legal-team', // Special recipient ID for legal team
          recipientType: 'internal',
          data: {
            ndaId: ndaRecord.id,
            requesterId: params.requesterId,
            pitchId: params.pitchId,
            riskScore: riskAssessment.score,
            riskFactors: riskAssessment.factors,
            reviewReason: riskAssessment.reviewReason
          },
          channels: ['email', 'in_app'],
          priority: 'high'
        });
      });
      
      // Wait for legal review (up to 48 hours)
      const legalReview = await step.waitForEvent<LegalReviewDecision>(
        'wait-for-legal-review',
        { timeout: '48 hours' }
      );
      
      if (!legalReview || legalReview.payload.decision === 'reject') {
        await step.do('handle-legal-rejection', async () => {
          await this.updateNDAStatus(ndaRecord.id, 'REJECTED');
          
          await this.env.NOTIFICATION_QUEUE.send({
            type: 'nda_rejected',
            recipientId: params.requesterId,
            recipientType: params.requesterType,
            data: {
              ndaId: ndaRecord.id,
              reason: legalReview?.payload.notes || 'Legal review did not approve',
              pitchId: params.pitchId
            },
            channels: ['email', 'in_app'],
            priority: 'normal'
          });
        });
        
        return {
          success: false,
          reason: 'NDA rejected by legal review',
          ndaId: ndaRecord.id
        };
      }
      
      if (legalReview.payload.decision === 'modify') {
        // Apply modifications and continue
        params.customTerms = { ...params.customTerms, ...legalReview.payload.modifiedTerms };
      }
      
      approvalDecision = 'legal_approved';
      
    } else if (riskAssessment.level === 'medium') {
      // Medium risk - requires creator approval
      await step.do('request-creator-review', async () => {
        await this.updateNDAStatus(ndaRecord.id, 'CREATOR_REVIEW');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_creator_review_required',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            ndaId: ndaRecord.id,
            requesterId: params.requesterId,
            requesterName: params.requesterName,
            pitchId: params.pitchId,
            riskScore: riskAssessment.score,
            riskFactors: riskAssessment.factors
          },
          channels: ['email', 'push', 'in_app'],
          priority: 'high'
        });
      });
      
      // Wait for creator decision (up to 72 hours)
      const creatorReview = await step.waitForEvent<{decision: 'approve' | 'reject', message?: string}>(
        'wait-for-creator-nda-review',
        { timeout: '72 hours' }
      );
      
      if (!creatorReview || creatorReview.payload.decision === 'reject') {
        await step.do('handle-creator-rejection', async () => {
          await this.updateNDAStatus(ndaRecord.id, 'REJECTED');
          
          await this.env.NOTIFICATION_QUEUE.send({
            type: 'nda_rejected',
            recipientId: params.requesterId,
            recipientType: params.requesterType,
            data: {
              ndaId: ndaRecord.id,
              reason: creatorReview?.payload.message || 'Creator did not approve',
              pitchId: params.pitchId
            },
            channels: ['email', 'in_app'],
            priority: 'normal'
          });
        });
        
        return {
          success: false,
          reason: 'NDA rejected by creator',
          ndaId: ndaRecord.id
        };
      }
      
      approvalDecision = 'creator_approved';
    }
    
    // ========================================================================
    // Step 4: Generate NDA Document
    // ========================================================================
    const documentKey = await step.do('generate-nda-document', async () => {
      // Get template
      const template = await this.env.NDA_TEMPLATES.get(params.templateId, 'json') as any || {
        content: 'Standard NDA Template',
        clauses: []
      };
      
      // Merge custom terms
      const finalTerms = {
        ...template,
        customTerms: params.customTerms,
        duration: params.durationMonths,
        territorialRestrictions: params.territorialRestrictions,
        effectiveDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      // Generate document
      const document = {
        ndaId: ndaRecord.id,
        templateId: params.templateId,
        parties: {
          discloser: {
            id: params.creatorId,
            type: 'creator',
            name: await this.getUserName(params.creatorId)
          },
          recipient: {
            id: params.requesterId,
            type: params.requesterType,
            name: params.requesterName,
            email: params.requesterEmail
          }
        },
        terms: finalTerms,
        approvalDecision,
        riskAssessment: {
          score: riskAssessment.score,
          level: riskAssessment.level
        },
        generatedAt: new Date().toISOString()
      };
      
      // Store document
      const documentKey = `ndas/${ndaRecord.id}/agreement.json`;
      await this.env.DOCUMENTS.put(documentKey, JSON.stringify(document));
      
      return documentKey;
    });
    
    // ========================================================================
    // Step 5: Send for Electronic Signature
    // ========================================================================
    const envelopeId = await step.do('send-for-signature', async () => {
      await this.updateNDAStatus(ndaRecord.id, 'PENDING');
      
      // In production, integrate with DocuSign API
      // For now, we'll simulate with a mock envelope ID
      const envelopeId = `envelope_${ndaRecord.id}`;
      
      // Update NDA with envelope ID
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      await db(`
        UPDATE ndas
        SET envelope_id = $1
        WHERE id = $2
      `, [envelopeId, ndaRecord.id]);
      
      // Send signature request email
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'nda_signature_requested',
        recipientId: params.requesterId,
        recipientType: params.requesterType,
        data: {
          ndaId: ndaRecord.id,
          documentKey,
          envelopeId,
          signingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          pitchTitle: await this.getPitchTitle(params.pitchId)
        },
        channels: ['email'],
        priority: 'high'
      });
      
      // Notify creator
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'nda_sent_for_signature',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          ndaId: ndaRecord.id,
          requesterName: params.requesterName,
          pitchId: params.pitchId
        },
        channels: ['in_app'],
        priority: 'normal'
      });
      
      return envelopeId;
    });
    
    // ========================================================================
    // Step 6: Wait for Signature
    // ========================================================================
    const signatureStatus = await step.waitForEvent<SignatureStatus>(
      'wait-for-signature',
      { timeout: '7 days' }
    );
    
    if (!signatureStatus) {
      await step.do('handle-signature-timeout', async () => {
        await this.updateNDAStatus(ndaRecord.id, 'EXPIRED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_expired',
          recipientId: params.requesterId,
          recipientType: params.requesterType,
          data: {
            ndaId: ndaRecord.id,
            reason: 'Signature deadline missed',
            pitchId: params.pitchId
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_expired',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            ndaId: ndaRecord.id,
            requesterName: params.requesterName,
            reason: 'Signature deadline missed'
          },
          channels: ['in_app'],
          priority: 'normal'
        });
      });
      
      return {
        success: false,
        reason: 'NDA signature timeout',
        ndaId: ndaRecord.id
      };
    }
    
    // ========================================================================
    // Step 7: Process Signature Status
    // ========================================================================
    const ndaExecuted = await step.do('process-signature-status', async () => {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      if (signatureStatus.payload.status === 'declined' || signatureStatus.payload.status === 'voided') {
        await this.updateNDAStatus(ndaRecord.id, 'DECLINED');
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_declined',
          recipientId: params.creatorId,
          recipientType: 'creator',
          data: {
            ndaId: ndaRecord.id,
            requesterName: params.requesterName,
            reason: signatureStatus.payload.declinedReason
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
        
        return false;
      }
      
      if (signatureStatus.payload.status === 'completed') {
        // NDA signed successfully
        const effectiveDate = new Date();
        const expirationDate = new Date(effectiveDate.getTime() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000);
        
        await db(`
          UPDATE ndas
          SET 
            status = 'SIGNED',
            effective_date = $1,
            expiration_date = $2,
            signed_at = $3
          WHERE id = $4
        `, [
          effectiveDate.toISOString(),
          expirationDate.toISOString(),
          signatureStatus.payload.signedAt || new Date().toISOString(),
          ndaRecord.id
        ]);
        
        return true;
      }
      
      // Document viewed but not yet signed - continue waiting
      if (signatureStatus.payload.status === 'delivered') {
        await this.updateNDAStatus(ndaRecord.id, 'VIEWED');
        
        // Send reminder
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_reminder',
          recipientId: params.requesterId,
          recipientType: params.requesterType,
          data: {
            ndaId: ndaRecord.id,
            envelopeId,
            daysRemaining: 5
          },
          channels: ['email'],
          priority: 'normal'
        });
        
        // Wait for actual signature
        const finalSignature = await step.waitForEvent<SignatureStatus>(
          'wait-for-final-signature',
          { timeout: '5 days' }
        );
        
        if (finalSignature && finalSignature.payload.status === 'completed') {
          const effectiveDate = new Date();
          const expirationDate = new Date(effectiveDate.getTime() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000);
          
          await db(`
            UPDATE ndas
            SET 
              status = 'SIGNED',
              effective_date = $1,
              expiration_date = $2,
              signed_at = $3
            WHERE id = $4
          `, [
            effectiveDate.toISOString(),
            expirationDate.toISOString(),
            finalSignature.payload.signedAt || new Date().toISOString(),
            ndaRecord.id
          ]);
          
          return true;
        }
      }
      
      return false;
    });
    
    if (!ndaExecuted) {
      return {
        success: false,
        reason: 'NDA not executed',
        ndaId: ndaRecord.id
      };
    }
    
    // ========================================================================
    // Step 8: Activate NDA and Grant Access
    // ========================================================================
    await step.do('activate-nda', async () => {
      await this.updateNDAStatus(ndaRecord.id, 'ACTIVE');
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      // Grant pitch access
      await db(`
        INSERT INTO pitch_access (
          id, user_id, pitch_id, access_type,
          granted_via, granted_via_id, granted_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT (user_id, pitch_id)
        DO UPDATE SET
          access_type = $4,
          granted_via = $5,
          granted_via_id = $6,
          granted_at = NOW(),
          expires_at = $7
      `, [
        crypto.randomUUID(),
        params.requesterId,
        params.pitchId,
        'nda_protected',
        'nda',
        ndaRecord.id,
        new Date(Date.now() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000).toISOString()
      ]);
      
      // Send success notifications
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'nda_executed',
        recipientId: params.requesterId,
        recipientType: params.requesterType,
        data: {
          ndaId: ndaRecord.id,
          pitchId: params.pitchId,
          accessGranted: true,
          expirationDate: new Date(Date.now() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        channels: ['email', 'in_app'],
        priority: 'high'
      });
      
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'nda_executed',
        recipientId: params.creatorId,
        recipientType: 'creator',
        data: {
          ndaId: ndaRecord.id,
          requesterName: params.requesterName,
          pitchId: params.pitchId,
          durationMonths: params.durationMonths
        },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
    });
    
    // ========================================================================
    // Step 9: Schedule Expiration Monitoring
    // ========================================================================
    await step.do('schedule-expiration-monitoring', async () => {
      const expirationDate = new Date(Date.now() + params.durationMonths! * 30 * 24 * 60 * 60 * 1000);
      
      // Schedule reminder 30 days before expiration
      const reminderDate = new Date(expirationDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (reminderDate > new Date()) {
        await step.sleep('wait-for-expiration-reminder', reminderDate.getTime() - Date.now());
        
        await this.env.NOTIFICATION_QUEUE.send({
          type: 'nda_expiring_soon',
          recipientId: params.requesterId,
          recipientType: params.requesterType,
          data: {
            ndaId: ndaRecord.id,
            pitchId: params.pitchId,
            expirationDate: expirationDate.toISOString(),
            daysRemaining: 30
          },
          channels: ['email', 'in_app'],
          priority: 'normal'
        });
      }
      
      // Wait for expiration
      await step.sleep('wait-for-expiration', expirationDate.getTime() - Date.now());
      
      // Mark as expired and revoke access
      await this.updateNDAStatus(ndaRecord.id, 'EXPIRED');
      
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(this.env.HYPERDRIVE.connectionString);
      
      await db(`
        UPDATE pitch_access
        SET revoked_at = NOW()
        WHERE user_id = $1 AND pitch_id = $2 AND granted_via = 'nda'
      `, [params.requesterId, params.pitchId]);
      
      // Notify of expiration
      await this.env.NOTIFICATION_QUEUE.send({
        type: 'nda_expired',
        recipientId: params.requesterId,
        recipientType: params.requesterType,
        data: {
          ndaId: ndaRecord.id,
          pitchId: params.pitchId,
          accessRevoked: true
        },
        channels: ['email', 'in_app'],
        priority: 'normal'
      });
    });
    
    // ========================================================================
    // Workflow Complete
    // ========================================================================
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      ndaId: ndaRecord.id,
      requesterId: params.requesterId,
      creatorId: params.creatorId,
      pitchId: params.pitchId,
      riskLevel: riskAssessment.level,
      riskScore: riskAssessment.score,
      approvalMethod: approvalDecision,
      durationMonths: params.durationMonths,
      completedAt: new Date().toISOString(),
      duration
    };
  }
  
  // ========================================================================
  // Helper Methods
  // ========================================================================
  
  private async updateNDAStatus(ndaId: string, status: string): Promise<void> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    await db(`
      UPDATE ndas
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, ndaId]);
    
    // Cache status
    await this.env.DEAL_CACHE.put(
      `nda:${ndaId}:status`,
      status,
      { expirationTtl: 3600 }
    );
  }
  
  private async getUserName(userId: string): Promise<string> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const result = await db(`
      SELECT name, email FROM users WHERE id = $1
    `, [userId]);
    
    if (result.length === 0) return 'Unknown User';
    
    return result[0].name || result[0].email;
  }
  
  private async getPitchTitle(pitchId: string): Promise<string> {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(this.env.HYPERDRIVE.connectionString);
    
    const result = await db(`
      SELECT title FROM pitches WHERE id = $1
    `, [pitchId]);
    
    if (result.length === 0) return 'Unknown Pitch';
    
    return result[0].title;
  }
}