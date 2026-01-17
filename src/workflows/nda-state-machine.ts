/**
 * NDA Approval State Machine with Automated Access Control
 * Complete workflow for NDA signing, approval, and access management
 */

import type { Env } from '../db/connection';
import { getDb } from '../db/connection';
import { PortalAccessController } from '../middleware/portal-access-control';
import { UserRole, Permission, RBAC } from '../middleware/rbac';
import { getCorsHeaders } from '../utils/response';

// NDA states
export enum NDAState {
  PENDING = 'pending',
  SIGNED = 'signed', 
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

// NDA types
export enum NDAType {
  BASIC = 'basic',
  ENHANCED = 'enhanced',
  CUSTOM = 'custom'
}

// Access levels granted by NDA
export enum NDAAccessLevel {
  BASIC = 'basic',           // View pitch details only
  STANDARD = 'standard',     // View pitch + some documents  
  FULL = 'full_access',      // View all content and documents
  PREMIUM = 'premium'        // Full access + communication rights
}

// NDA template configurations
interface NDATemplate {
  type: NDAType;
  access_level: NDAAccessLevel;
  default_expiry: string; // e.g., "1 year", "6 months"
  auto_approve: boolean;
  required_fields: string[];
  access_permissions: Permission[];
  document_access: string[];
  restrictions: string[];
}

export const NDA_TEMPLATES: Record<string, NDATemplate> = {
  'basic_investor': {
    type: NDAType.BASIC,
    access_level: NDAAccessLevel.BASIC,
    default_expiry: '1 year',
    auto_approve: false,
    required_fields: ['full_name', 'email', 'company'],
    access_permissions: [Permission.PITCH_READ, Permission.DOCUMENT_VIEW],
    document_access: ['pitch_deck', 'synopsis'],
    restrictions: ['no_distribution', 'no_reproduction']
  },
  
  'enhanced_investor': {
    type: NDAType.ENHANCED,
    access_level: NDAAccessLevel.FULL,
    default_expiry: '2 years',
    auto_approve: false,
    required_fields: ['full_name', 'email', 'company', 'investment_capacity', 'references'],
    access_permissions: [Permission.PITCH_READ, Permission.DOCUMENT_VIEW, Permission.DOCUMENT_DOWNLOAD],
    document_access: ['all_documents', 'financial_projections', 'detailed_scripts'],
    restrictions: ['verified_investors_only', 'no_sharing']
  },

  'production_standard': {
    type: NDAType.ENHANCED,
    access_level: NDAAccessLevel.PREMIUM,
    default_expiry: '3 years',
    auto_approve: false,
    required_fields: ['company_name', 'company_registration', 'contact_details', 'production_credits'],
    access_permissions: [Permission.PITCH_READ, Permission.DOCUMENT_VIEW, Permission.DOCUMENT_DOWNLOAD, Permission.INVESTMENT_CREATE],
    document_access: ['full_package', 'production_materials', 'rights_information'],
    restrictions: ['production_companies_only', 'territory_limitations']
  },

  'auto_approve_basic': {
    type: NDAType.BASIC,
    access_level: NDAAccessLevel.STANDARD,
    default_expiry: '6 months',
    auto_approve: true,
    required_fields: ['full_name', 'email'],
    access_permissions: [Permission.PITCH_READ],
    document_access: ['basic_materials'],
    restrictions: ['limited_access']
  }
};

// State transition rules
interface NDAStateTransition {
  from: NDAState;
  to: NDAState;
  allowed_roles: UserRole[];
  required_permissions: Permission[];
  validation_rules: string[];
  automatic_conditions?: string[];
  side_effects: string[];
}

const NDA_TRANSITIONS: NDAStateTransition[] = [
  {
    from: NDAState.PENDING,
    to: NDAState.SIGNED,
    allowed_roles: [UserRole.INVESTOR, UserRole.PRODUCTION],
    required_permissions: [Permission.NDA_SIGN],
    validation_rules: ['signature_required', 'valid_signer'],
    side_effects: ['notify_creator', 'log_signature']
  },
  {
    from: NDAState.SIGNED,
    to: NDAState.APPROVED,
    allowed_roles: [UserRole.CREATOR, UserRole.ADMIN],
    required_permissions: [Permission.NDA_APPROVE],
    validation_rules: ['creator_authorization', 'nda_review_complete'],
    automatic_conditions: ['auto_approve_enabled'],
    side_effects: ['grant_access', 'notify_requester', 'create_access_record']
  },
  {
    from: NDAState.SIGNED,
    to: NDAState.REJECTED,
    allowed_roles: [UserRole.CREATOR, UserRole.ADMIN],
    required_permissions: [Permission.NDA_REJECT],
    validation_rules: ['rejection_reason_provided'],
    side_effects: ['notify_requester', 'log_rejection']
  },
  {
    from: NDAState.APPROVED,
    to: NDAState.REVOKED,
    allowed_roles: [UserRole.CREATOR, UserRole.ADMIN],
    required_permissions: [Permission.NDA_APPROVE],
    validation_rules: ['revocation_reason_required'],
    side_effects: ['revoke_access', 'notify_requester', 'update_access_record']
  }
];

export interface NDARequest {
  id?: number;
  pitch_id: number;
  requester_id: number;
  creator_id: number;
  nda_type: NDAType;
  nda_state: NDAState;
  access_level: NDAAccessLevel;
  template_name?: string;
  custom_terms?: any;
  signature_data?: any;
  access_expiry?: Date;
  auto_approve: boolean;
  metadata?: any;
}

export class NDAStateMachine {
  private env: Env;
  private db: any;
  private portalController: PortalAccessController;

  constructor(env: Env) {
    this.env = env;
    this.db = getDb(env);
    this.portalController = new PortalAccessController(env);
  }

  /**
   * Create NDA request with automatic template selection
   */
  async createNDARequest(
    request: Request,
    pitchId: number,
    templateName: string,
    customTerms?: any
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Validate requester type and access
      const userRole = this.getUserRole(user.userType || user.user_type);
      if (![UserRole.INVESTOR, UserRole.PRODUCTION].includes(userRole)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only investors and production companies can request NDAs' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Get template configuration
      const template = NDA_TEMPLATES[templateName];
      if (!template) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'INVALID_TEMPLATE', 
            message: 'Invalid NDA template',
            available_templates: Object.keys(NDA_TEMPLATES)
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate required fields
      const validationResult = await this.validateNDARequirements(user.id, template, customTerms);
      if (!validationResult.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'NDA requirements not met',
            missing_fields: validationResult.missing_fields,
            requirements: template.required_fields
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Check for existing NDA
      const existingNDA = await this.db`
        SELECT id, nda_state FROM enhanced_ndas
        WHERE pitch_id = ${pitchId} AND requester_id = ${user.id}
        AND nda_state NOT IN ('rejected', 'revoked', 'expired')
      `;

      if (existingNDA.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'NDA_EXISTS', 
            message: 'An active NDA request already exists for this pitch',
            existing_nda: existingNDA[0]
          }
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Create NDA request using database function
      const ndaId = await this.db`
        SELECT create_nda_request(
          ${pitchId}::integer,
          ${user.id}::integer,
          ${template.type}::nda_type,
          ${template.access_level}
        ) as nda_id
      `.then((result: Array<{ nda_id?: number }>) => result[0]?.nda_id);

      // Update with template-specific details
      await this.db`
        UPDATE enhanced_ndas
        SET metadata = ${JSON.stringify({
          template_name: templateName,
          template_config: template,
          custom_terms: customTerms,
          requester_info: {
            company: user.company_name,
            verified: user.company_verified || user.email_verified
          }
        })}
        WHERE id = ${ndaId}
      `;

      // Auto-approve if template allows
      if (template.auto_approve) {
        await this.processNDAAction(ndaId, user.id, 'auto_approve', 'Automatically approved based on template settings');
      }

      const ndaDetails = await this.getNDADetails(ndaId);

      return new Response(JSON.stringify({
        success: true,
        data: {
          nda_id: ndaId,
          nda_state: ndaDetails.nda_state,
          template_used: templateName,
          auto_approved: template.auto_approve,
          access_level: template.access_level,
          expires_at: ndaDetails.access_expiry,
          next_steps: await this.getNextSteps(ndaId, user.id, userRole)
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA request creation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create NDA request' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Sign NDA (investor/production company)
   */
  async signNDA(
    request: Request,
    ndaId: number,
    signatureData: {
      full_name: string;
      title?: string;
      company?: string;
      date: string;
      signature: string; // Digital signature or confirmation
      terms_accepted: boolean;
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const userRole = this.getUserRole(user.userType || user.user_type);
      
      // Validate NDA exists and user can sign it
      const nda = await this.getNDADetails(ndaId);
      if (nda.requester_id !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Can only sign your own NDA requests' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      if (nda.nda_state !== NDAState.PENDING) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'INVALID_STATE', 
            message: `NDA cannot be signed in ${nda.nda_state} state` 
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate signature data
      if (!signatureData.terms_accepted) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'TERMS_NOT_ACCEPTED', message: 'Must accept NDA terms to proceed' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Update NDA with signature
      await this.db`
        UPDATE enhanced_ndas
        SET nda_state = 'signed'::nda_state,
            signature_metadata = ${JSON.stringify({
              ...signatureData,
              signed_at: new Date(),
              ip_address: request.headers.get('CF-Connecting-IP') || signatureData.ip_address,
              user_agent: request.headers.get('User-Agent') || signatureData.user_agent
            })},
            state_changed_at = now(),
            state_changed_by = ${user.id}
        WHERE id = ${ndaId}
      `;

      // Check if auto-approval is enabled
      const template = JSON.parse(nda.metadata || '{}');
      if (template.template_config?.auto_approve) {
        await this.processNDAAction(ndaId, nda.creator_id, 'approve', 'Automatically approved after signing');
      } else {
        // Create notification for creator
        await this.db`
          INSERT INTO workflow_notifications (
            user_id, notification_type, title, message,
            related_nda_id, related_pitch_id, action_url, action_label, priority
          ) VALUES (
            ${nda.creator_id}, 'nda_signed',
            'NDA Signed - Awaiting Your Approval',
            'An NDA has been signed for your pitch and awaits your approval',
            ${ndaId}, ${nda.pitch_id},
            '/creator/ndas/' || ${ndaId}, 'Review & Approve', 'high'
          )
        `;
      }

      const updatedNDA = await this.getNDADetails(ndaId);

      return new Response(JSON.stringify({
        success: true,
        data: {
          nda_state: updatedNDA.nda_state,
          signed_at: signatureData.date,
          awaiting_approval: !template.template_config?.auto_approve,
          next_steps: await this.getNextSteps(ndaId, user.id, userRole)
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA signing error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to sign NDA' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Approve or reject NDA (creator)
   */
  async processNDADecision(
    request: Request,
    ndaId: number,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Validate user is creator of the pitch
      const nda = await this.getNDADetails(ndaId);
      if (nda.creator_id !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Can only approve/reject NDAs for your own pitches' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      if (nda.nda_state !== NDAState.SIGNED) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'INVALID_STATE', 
            message: `NDA cannot be ${decision}d in ${nda.nda_state} state. Must be signed first.` 
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const result = await this.processNDAAction(ndaId, user.id, decision, reason);

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA decision error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process NDA decision' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Revoke NDA access (creator)
   */
  async revokeNDAAccess(
    request: Request,
    ndaId: number,
    reason: string
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      const nda = await this.getNDADetails(ndaId);
      if (nda.creator_id !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Can only revoke your own NDA approvals' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      if (nda.nda_state !== NDAState.APPROVED) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Can only revoke approved NDAs' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const result = await this.processNDAAction(ndaId, user.id, 'revoke', reason);

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA revocation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke NDA access' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Check NDA access for user
   */
  async checkNDAAccess(
    request: Request,
    pitchId: number,
    userId?: number
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const checkUserId = userId || user.id;
      
      // Get NDA status and access level
      const access = await this.db`
        SELECT 
          n.id as nda_id,
          n.nda_state,
          n.access_level,
          n.access_expiry,
          n.nda_type,
          n.created_at,
          n.metadata,
          p.id as pitch_id,
          p.title as pitch_title,
          p.user_id as creator_id,
          creator.username as creator_name,
          -- Check if user is creator (always has access)
          CASE WHEN p.user_id = ${checkUserId} THEN true ELSE false END as is_creator,
          -- Get access record
          pa.access_level as granted_access,
          pa.expires_at as access_expires,
          pa.granted_at
        FROM pitches p
        LEFT JOIN enhanced_ndas n ON n.pitch_id = p.id AND n.requester_id = ${checkUserId}
        LEFT JOIN pitch_access pa ON pa.pitch_id = p.id AND pa.user_id = ${checkUserId}
        LEFT JOIN users creator ON p.user_id = creator.id
        WHERE p.id = ${pitchId}
      `;

      if (access.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PITCH_NOT_FOUND', message: 'Pitch not found' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const accessInfo = access[0];
      
      // Determine access status
      let accessStatus = {
        has_access: false,
        access_level: 'none',
        reason: 'no_nda',
        can_request_nda: true,
        nda_required: true
      };

      if (accessInfo.is_creator) {
        // Creator always has full access
        accessStatus = {
          has_access: true,
          access_level: 'owner',
          reason: 'creator_access',
          can_request_nda: false,
          nda_required: false
        };
      } else if (accessInfo.nda_state === 'approved') {
        // Check if access has expired
        const accessExpired = accessInfo.access_expiry && new Date(accessInfo.access_expiry) < new Date();
        
        if (accessExpired) {
          accessStatus = {
            has_access: false,
            access_level: 'expired',
            reason: 'access_expired',
            can_request_nda: true,
            nda_required: true
          };
        } else {
          accessStatus = {
            has_access: true,
            access_level: accessInfo.access_level || 'basic',
            reason: 'nda_approved',
            can_request_nda: false,
            nda_required: false
          };
        }
      } else if (accessInfo.nda_state === 'pending') {
        accessStatus = {
          has_access: false,
          access_level: 'pending',
          reason: 'nda_pending_approval',
          can_request_nda: false,
          nda_required: true
        };
      } else if (accessInfo.nda_state === 'signed') {
        accessStatus = {
          has_access: false,
          access_level: 'signed',
          reason: 'nda_awaiting_creator_approval',
          can_request_nda: false,
          nda_required: true
        };
      } else if (accessInfo.nda_state === 'rejected') {
        accessStatus = {
          has_access: false,
          access_level: 'rejected',
          reason: 'nda_rejected',
          can_request_nda: true,
          nda_required: true
        };
      } else if (accessInfo.nda_state === 'revoked') {
        accessStatus = {
          has_access: false,
          access_level: 'revoked',
          reason: 'access_revoked',
          can_request_nda: true,
          nda_required: true
        };
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          pitch_id: pitchId,
          user_id: checkUserId,
          access_status: accessStatus,
          nda_info: accessInfo.nda_id ? {
            nda_id: accessInfo.nda_id,
            nda_state: accessInfo.nda_state,
            nda_type: accessInfo.nda_type,
            created_at: accessInfo.created_at,
            access_expiry: accessInfo.access_expiry
          } : null,
          available_templates: Object.keys(NDA_TEMPLATES),
          pitch_info: {
            title: accessInfo.pitch_title,
            creator: accessInfo.creator_name
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA access check error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to check NDA access' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Get user's NDA dashboard
   */
  async getNDADashboard(
    request: Request,
    userType: 'creator' | 'investor' | 'production'
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Get NDAs based on user type
      let ndas;
      if (userType === 'creator') {
        // NDAs for creator's pitches
        ndas = await this.db`
          SELECT 
            n.*,
            p.title as pitch_title,
            p.title_image_url,
            requester.username as requester_name,
            requester.company_name as requester_company,
            requester.user_type as requester_type,
            -- Calculate response time
            CASE WHEN n.nda_state = 'pending' 
                 THEN EXTRACT(HOUR FROM now() - n.created_at) 
                 ELSE NULL END as pending_hours,
            -- Get template info
            (n.metadata->>'template_name') as template_name
          FROM enhanced_ndas n
          JOIN pitches p ON n.pitch_id = p.id
          JOIN users requester ON n.requester_id = requester.id
          WHERE n.creator_id = ${user.id}
          ORDER BY 
            CASE n.nda_state 
              WHEN 'pending' THEN 1
              WHEN 'signed' THEN 2
              ELSE 3
            END,
            n.created_at DESC
        `;
      } else {
        // NDAs requested by this user
        ndas = await this.db`
          SELECT 
            n.*,
            p.title as pitch_title,
            p.title_image_url,
            creator.username as creator_name,
            creator.company_name as creator_company,
            -- Calculate time since signed (if signed)
            CASE WHEN n.nda_state = 'signed' 
                 THEN EXTRACT(HOUR FROM now() - n.state_changed_at) 
                 ELSE NULL END as awaiting_hours,
            -- Get template info
            (n.metadata->>'template_name') as template_name
          FROM enhanced_ndas n
          JOIN pitches p ON n.pitch_id = p.id
          JOIN users creator ON n.creator_id = creator.id
          WHERE n.requester_id = ${user.id}
          ORDER BY 
            CASE n.nda_state 
              WHEN 'signed' THEN 1
              WHEN 'pending' THEN 2
              WHEN 'approved' THEN 3
              ELSE 4
            END,
            n.created_at DESC
        `;
      }

      // Get summary statistics
      const stats = await this.db`
        SELECT 
          COUNT(*) as total_ndas,
          COUNT(*) FILTER (WHERE nda_state = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE nda_state = 'signed') as signed_count,
          COUNT(*) FILTER (WHERE nda_state = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE nda_state = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE nda_state = 'revoked') as revoked_count,
          -- Average response time for creators
          ${userType === 'creator' ? `
            AVG(EXTRACT(EPOCH FROM state_changed_at - created_at) / 3600) 
            FILTER (WHERE nda_state IN ('approved', 'rejected'))
          ` : 'NULL'} as avg_response_hours
        FROM enhanced_ndas
        WHERE ${userType === 'creator' ? 'creator_id' : 'requester_id'} = ${user.id}
      `.then((result: Array<Record<string, unknown>>) => result[0] || {});

      return new Response(JSON.stringify({
        success: true,
        data: {
          ndas,
          statistics: stats,
          user_type: userType,
          templates: NDA_TEMPLATES
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('NDA dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch NDA dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  // Private helper methods

  private getUserRole(userType: string): UserRole {
    switch (userType) {
      case 'creator': return UserRole.CREATOR;
      case 'investor': return UserRole.INVESTOR;
      case 'production': return UserRole.PRODUCTION;
      case 'admin': return UserRole.ADMIN;
      default: return UserRole.VIEWER;
    }
  }

  private async getNDADetails(ndaId: number): Promise<any> {
    const ndas = await this.db`
      SELECT * FROM enhanced_ndas WHERE id = ${ndaId}
    `;
    
    if (ndas.length === 0) {
      throw new Error('NDA not found');
    }
    
    return ndas[0];
  }

  private async validateNDARequirements(
    userId: number,
    template: NDATemplate,
    customTerms?: any
  ): Promise<{ valid: boolean; missing_fields: string[] }> {
    const user = await this.db`
      SELECT * FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return { valid: false, missing_fields: ['user_not_found'] };
    }

    const userInfo = user[0];
    const missing = [];

    // Check required fields
    for (const field of template.required_fields) {
      switch (field) {
        case 'full_name':
          if (!userInfo.first_name || !userInfo.last_name) {
            missing.push('full_name');
          }
          break;
        case 'email':
          if (!userInfo.email || !userInfo.email_verified) {
            missing.push('email_verification');
          }
          break;
        case 'company':
          if (!userInfo.company_name) {
            missing.push('company_name');
          }
          break;
        case 'company_registration':
          if (!userInfo.company_number || !userInfo.company_verified) {
            missing.push('company_verification');
          }
          break;
        case 'investment_capacity':
          // Would check investment capacity verification
          if (!userInfo.company_verified) {
            missing.push('investment_verification');
          }
          break;
      }
    }

    return {
      valid: missing.length === 0,
      missing_fields: missing
    };
  }

  private async processNDAAction(
    ndaId: number,
    userId: number,
    action: 'approve' | 'reject' | 'revoke' | 'auto_approve',
    reason?: string
  ): Promise<any> {
    const nda = await this.getNDADetails(ndaId);
    
    switch (action) {
      case 'approve':
      case 'auto_approve':
        // Use database function for approval
        const approved = await this.db`
          SELECT process_nda_approval(
            ${ndaId}::integer,
            ${userId}::integer,
            true,
            ${reason || 'NDA approved'}
          ) as success
        `.then((result: Array<{ success?: boolean }>) => result[0]?.success);

        return {
          nda_state: 'approved',
          access_granted: true,
          message: action === 'auto_approve' ? 'NDA automatically approved' : 'NDA approved - access granted'
        };

      case 'reject':
        await this.db`
          SELECT process_nda_approval(
            ${ndaId}::integer,
            ${userId}::integer,
            false,
            ${reason || 'NDA rejected'}
          ) as success
        `;

        return {
          nda_state: 'rejected',
          access_granted: false,
          message: 'NDA request rejected'
        };

      case 'revoke':
        await this.db`
          UPDATE enhanced_ndas
          SET nda_state = 'revoked'::nda_state,
              state_changed_at = now(),
              state_changed_by = ${userId},
              metadata = metadata || ${JSON.stringify({ revocation_reason: reason })}
          WHERE id = ${ndaId}
        `;

        // Revoke access
        await this.db`
          UPDATE pitch_access
          SET revoked_at = now()
          WHERE pitch_id = ${nda.pitch_id} AND user_id = ${nda.requester_id}
        `;

        return {
          nda_state: 'revoked',
          access_revoked: true,
          message: 'NDA access revoked'
        };
    }
  }

  private async getNextSteps(ndaId: number, userId: number, userRole: UserRole): Promise<string[]> {
    const nda = await this.getNDADetails(ndaId);
    const steps: string[] = [];

    switch (nda.nda_state) {
      case NDAState.PENDING:
        if (userRole === UserRole.CREATOR) {
          steps.push('Waiting for requester to sign NDA');
        } else {
          steps.push('Review and sign NDA terms');
          steps.push('Provide required information');
        }
        break;

      case NDAState.SIGNED:
        if (userRole === UserRole.CREATOR) {
          steps.push('Review signed NDA');
          steps.push('Approve or reject request');
        } else {
          steps.push('Wait for creator approval');
        }
        break;

      case NDAState.APPROVED:
        steps.push('Access granted - view protected content');
        steps.push('Respect NDA terms and conditions');
        break;

      case NDAState.REJECTED:
        if (userRole !== UserRole.CREATOR) {
          steps.push('NDA was rejected');
          steps.push('Contact creator for clarification');
        }
        break;

      case NDAState.REVOKED:
        steps.push('Access has been revoked');
        break;
    }

    return steps;
  }
}

// All exports are inline above