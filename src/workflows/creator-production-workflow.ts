/**
 * Creator ↔ Production Company Workflow Implementation
 * Complete business logic for production deals, options, and licensing
 */

import type { Env } from '../db/connection';
import { getDb } from '../db/connection';
import { PortalAccessController, createPortalAccessMiddleware } from '../middleware/portal-access-control';
import { UserRole, Permission, RBAC, PermissionContext } from '../middleware/rbac';
import { getCorsHeaders } from '../utils/response';

// Production deal types
export enum ProductionDealType {
  OPTION = 'option',
  ACQUISITION = 'acquisition',
  LICENSING = 'licensing',
  DEVELOPMENT = 'development',
  PRODUCTION = 'production'
}

// Production deal states (reusing investment states for consistency)
export enum ProductionDealState {
  INQUIRY = 'inquiry',
  NDA_REQUIRED = 'nda_required',
  NDA_SIGNED = 'nda_signed',
  DUE_DILIGENCE = 'due_diligence',
  NEGOTIATION = 'negotiation',
  TERM_SHEET = 'term_sheet',
  LEGAL_REVIEW = 'legal_review',
  FUNDING = 'funding',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Rights management
export interface MediaRights {
  territory: string[];
  duration: string; // e.g., "10 years", "in perpetuity"
  exclusivity: 'exclusive' | 'non-exclusive';
  media_types: string[]; // theatrical, streaming, tv, digital, etc.
  languages: string[];
  remake_rights: boolean;
  sequel_rights: boolean;
  merchandising_rights: boolean;
}

// Production deal interface
export interface ProductionDeal {
  id?: number;
  pitch_id: number;
  production_company_id: number;
  creator_id: number;
  deal_type: ProductionDealType;
  deal_state: ProductionDealState;
  option_amount?: number;
  purchase_price?: number;
  backend_percentage?: number;
  development_fee?: number;
  option_period?: string; // e.g., "18 months"
  extension_periods?: number;
  rights: MediaRights;
  production_budget_min?: number;
  production_budget_max?: number;
  delivery_requirements?: any;
  approval_rights?: any;
  credit_requirements?: any;
  milestone_payments?: any;
  priority: string;
  notes?: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

// Deal template for different types
interface DealTemplate {
  deal_type: ProductionDealType;
  typical_option_period: string;
  typical_option_amount_range: { min: number; max: number };
  typical_purchase_multiple: number; // multiple of option amount
  standard_rights: Partial<MediaRights>;
  required_approvals: string[];
  standard_terms: any;
}

const PRODUCTION_DEAL_TEMPLATES: Record<ProductionDealType, DealTemplate> = {
  [ProductionDealType.OPTION]: {
    deal_type: ProductionDealType.OPTION,
    typical_option_period: '18 months',
    typical_option_amount_range: { min: 5000, max: 100000 },
    typical_purchase_multiple: 10, // 10x option amount
    standard_rights: {
      territory: ['worldwide'],
      duration: '10 years',
      exclusivity: 'exclusive',
      media_types: ['theatrical', 'streaming', 'tv'],
      remake_rights: true,
      sequel_rights: true
    },
    required_approvals: ['script_changes', 'director_approval', 'cast_approval'],
    standard_terms: {
      development_period: '2 years',
      production_commitment: 'best efforts',
      reversion_rights: 'automatic if not produced within option period'
    }
  },
  
  [ProductionDealType.ACQUISITION]: {
    deal_type: ProductionDealType.ACQUISITION,
    typical_option_period: 'immediate',
    typical_option_amount_range: { min: 50000, max: 2000000 },
    typical_purchase_multiple: 1, // full purchase
    standard_rights: {
      territory: ['worldwide'],
      duration: 'in perpetuity',
      exclusivity: 'exclusive',
      media_types: ['theatrical', 'streaming', 'tv', 'digital', 'merchandising'],
      remake_rights: true,
      sequel_rights: true,
      merchandising_rights: true
    },
    required_approvals: ['major_changes_only'],
    standard_terms: {
      payment_schedule: '50% on signing, 50% on delivery',
      backend_participation: '5-15%',
      credit_position: 'based on original work'
    }
  },

  [ProductionDealType.LICENSING]: {
    deal_type: ProductionDealType.LICENSING,
    typical_option_period: '5 years',
    typical_option_amount_range: { min: 10000, max: 500000 },
    typical_purchase_multiple: 3,
    standard_rights: {
      territory: ['specified regions'],
      duration: '5-10 years',
      exclusivity: 'non-exclusive',
      media_types: ['specified platforms'],
      remake_rights: false,
      sequel_rights: false
    },
    required_approvals: ['adaptation_approval', 'quality_standards'],
    standard_terms: {
      revenue_sharing: '10-30%',
      minimum_guarantees: 'based on territory',
      quality_controls: 'creator approval required'
    }
  },

  [ProductionDealType.DEVELOPMENT]: {
    deal_type: ProductionDealType.DEVELOPMENT,
    typical_option_period: '24 months',
    typical_option_amount_range: { min: 25000, max: 250000 },
    typical_purchase_multiple: 8,
    standard_rights: {
      territory: ['worldwide'],
      duration: '7 years',
      exclusivity: 'exclusive',
      media_types: ['theatrical', 'streaming'],
      remake_rights: false,
      sequel_rights: true
    },
    required_approvals: ['script_approval', 'director_approval', 'budget_approval'],
    standard_terms: {
      development_milestones: 'script, packaging, financing',
      creator_involvement: 'producer credit minimum',
      turnaround_rights: 'available after 2 years'
    }
  },

  [ProductionDealType.PRODUCTION]: {
    deal_type: ProductionDealType.PRODUCTION,
    typical_option_period: 'immediate',
    typical_option_amount_range: { min: 100000, max: 5000000 },
    typical_purchase_multiple: 1,
    standard_rights: {
      territory: ['worldwide'],
      duration: 'in perpetuity',
      exclusivity: 'exclusive',
      media_types: ['all media'],
      remake_rights: true,
      sequel_rights: true,
      merchandising_rights: true
    },
    required_approvals: ['budget_approval', 'schedule_approval'],
    standard_terms: {
      production_timeline: '12-18 months',
      creator_role: 'executive producer',
      profit_participation: '10-25%'
    }
  }
};

export class CreatorProductionWorkflow {
  private env: Env;
  private db: any;
  private portalController: PortalAccessController;

  constructor(env: Env) {
    this.env = env;
    this.db = getDb(env);
    this.portalController = new PortalAccessController(env);
  }

  /**
   * Production company expresses interest in a pitch
   */
  async expressProductionInterest(
    request: Request,
    pitchId: number,
    dealDetails: {
      deal_type: ProductionDealType;
      offer_amount: number;
      option_period?: string;
      proposed_rights: Partial<MediaRights>;
      production_timeline?: string;
      message?: string;
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, 'production', user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Production portal access required' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate deal type and amount
      const template = PRODUCTION_DEAL_TEMPLATES[dealDetails.deal_type];
      if (!template) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'INVALID_DEAL_TYPE', message: 'Invalid production deal type' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate minimum offer amount
      if (dealDetails.offer_amount < template.typical_option_amount_range.min) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'INSUFFICIENT_OFFER', 
            message: `Minimum offer for ${dealDetails.deal_type} deals is €${template.typical_option_amount_range.min}`,
            suggested_range: template.typical_option_amount_range
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Check if company is verified for large deals
      if (dealDetails.offer_amount > 500000) {
        const verification = await this.validateProductionCompanyVerification(user.id);
        if (!verification.verified) {
          return new Response(JSON.stringify({
            success: false,
            error: { 
              code: 'VERIFICATION_REQUIRED', 
              message: verification.reason,
              required_verification: verification.required
            }
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
          });
        }
      }

      // Get creator and check if pitch allows production deals
      const pitch = await this.db`
        SELECT user_id, title, visibility_settings, production_stage
        FROM pitches 
        WHERE id = ${pitchId} AND status = 'published'
      `;

      if (pitch.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PITCH_NOT_FOUND', message: 'Pitch not found or not available' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const creatorId = pitch[0].user_id;
      
      // Merge proposed rights with template defaults
      const finalRights: MediaRights = {
        ...template.standard_rights,
        ...dealDetails.proposed_rights
      } as MediaRights;

      // Create production deal
      const dealId = await this.db`
        INSERT INTO production_deals (
          pitch_id, production_company_id, creator_id, deal_type,
          deal_state, option_amount, option_period, rights_territory,
          rights_duration, production_budget_min, production_budget_max,
          metadata, priority
        ) VALUES (
          ${pitchId}, ${user.id}, ${creatorId}, ${dealDetails.deal_type},
          ${pitch[0].visibility_settings?.requiresNDA ? 'nda_required' : 'inquiry'}, 
          ${dealDetails.offer_amount},
          ${dealDetails.option_period || template.typical_option_period},
          ${finalRights.territory?.[0] || 'worldwide'},
          ${finalRights.duration || template.standard_rights.duration},
          ${template.typical_option_amount_range.min},
          ${template.typical_option_amount_range.max},
          ${JSON.stringify({
            deal_template: template,
            proposed_rights: finalRights,
            production_timeline: dealDetails.production_timeline,
            message: dealDetails.message
          })},
          'medium'
        ) RETURNING id
      `.then(result => result[0]?.id);

      // Create notification for creator
      await this.db`
        INSERT INTO workflow_notifications (
          user_id, notification_type, title, message, 
          related_production_deal_id, related_pitch_id, 
          action_url, action_label, priority
        ) VALUES (
          ${creatorId}, 'production_offer', 
          'New Production Deal Offer',
          'A production company is interested in your pitch: ' || ${dealDetails.deal_type},
          ${dealId}, ${pitchId},
          '/creator/production-deals/' || ${dealId},
          'Review Offer', 'high'
        )
      `;

      // Get deal details for response
      const deal = await this.getProductionDealDetails(dealId);

      return new Response(JSON.stringify({
        success: true,
        data: {
          deal_id: dealId,
          deal_type: dealDetails.deal_type,
          deal_state: deal.deal_state,
          message: 'Production interest submitted successfully',
          deal_template: template,
          next_steps: await this.getProductionNextSteps(dealId, user.id, UserRole.PRODUCTION)
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Production interest error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to submit production interest' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Creator responds to production deal offer
   */
  async respondToProductionOffer(
    request: Request,
    dealId: number,
    response: {
      action: 'approve' | 'reject' | 'request_nda' | 'counter_offer';
      message?: string;
      counter_terms?: {
        option_amount?: number;
        option_period?: string;
        backend_percentage?: number;
        rights_modifications?: Partial<MediaRights>;
        approval_rights?: string[];
      };
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, 'creator', user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Creator portal access required' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Verify deal ownership
      const deal = await this.getProductionDealDetails(dealId);
      if (deal.creator_id !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Can only respond to your own pitch offers' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      let result;
      
      switch (response.action) {
        case 'approve':
          result = await this.approveProductionDeal(dealId, user.id, response.message);
          break;
        case 'reject':
          result = await this.rejectProductionDeal(dealId, user.id, response.message);
          break;
        case 'request_nda':
          result = await this.requestNDAForProductionDeal(dealId, user.id);
          break;
        case 'counter_offer':
          result = await this.submitCounterOffer(dealId, user.id, response.counter_terms, response.message);
          break;
        default:
          throw new Error('Invalid response action');
      }

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Production offer response error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process production response' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Get production opportunities for production companies
   */
  async getProductionOpportunities(
    request: Request,
    filters: {
      genre?: string[];
      format?: string[];
      production_stage?: string[];
      budget_range?: { min: number; max: number };
      location?: string;
      seeking_production?: boolean;
      available_rights?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, 'production', user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Production portal access required' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const limit = Math.min(filters.limit || 20, 100);
      const offset = filters.offset || 0;

      // Build dynamic query
      let whereConditions = ['p.status = $1', '(p.seeking_production = true OR p.rights_available = true)'];
      let params = ['published'];
      let paramIndex = 2;

      if (filters.genre && filters.genre.length > 0) {
        whereConditions.push(`p.genre = ANY($${paramIndex})`);
        params.push(filters.genre);
        paramIndex++;
      }

      if (filters.format && filters.format.length > 0) {
        whereConditions.push(`p.format = ANY($${paramIndex})`);
        params.push(filters.format);
        paramIndex++;
      }

      if (filters.production_stage && filters.production_stage.length > 0) {
        whereConditions.push(`p.production_stage = ANY($${paramIndex})`);
        params.push(filters.production_stage);
        paramIndex++;
      }

      if (filters.budget_range) {
        whereConditions.push(`p.estimated_budget BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(filters.budget_range.min, filters.budget_range.max);
        paramIndex += 2;
      }

      const query = `
        SELECT 
          p.id, p.title, p.logline, p.genre, p.format,
          p.estimated_budget, p.production_stage, p.production_timeline,
          p.title_image_url, p.view_count, p.like_count,
          p.seeking_production, p.rights_available,
          u.username as creator_name, u.location as creator_location,
          u.company_name as creator_company,
          -- Check for existing deals
          EXISTS (
            SELECT 1 FROM production_deals d 
            WHERE d.pitch_id = p.id AND d.production_company_id = $${paramIndex}
            AND d.deal_state NOT IN ('completed', 'cancelled')
          ) as has_active_deal,
          -- Get production deal metrics
          (
            SELECT jsonb_build_object(
              'total_offers', COUNT(*),
              'highest_offer', MAX(option_amount),
              'deal_types', array_agg(DISTINCT deal_type)
            )
            FROM production_deals d
            WHERE d.pitch_id = p.id
          ) as deal_metrics,
          -- Get available rights info
          CASE 
            WHEN p.rights_available THEN 
              jsonb_build_object(
                'territories', COALESCE(p.available_territories, '[\"worldwide\"]'::jsonb),
                'media_types', COALESCE(p.available_media_types, '[\"all\"]'::jsonb),
                'exclusivity', COALESCE(p.rights_exclusivity, 'negotiable')
              )
            ELSE NULL
          END as rights_info
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE WHEN p.production_deadline IS NOT NULL 
               THEN p.production_deadline END ASC,
          p.view_count DESC,
          p.created_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      params.push(user.id, limit, offset);

      const opportunities = await this.db.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countParams = params.slice(0, -2);
      const [{ total }] = await this.db.query(countQuery, countParams);

      return new Response(JSON.stringify({
        success: true,
        data: {
          opportunities,
          pagination: {
            total: parseInt(total),
            limit,
            offset,
            has_more: offset + limit < parseInt(total)
          },
          filters_applied: filters,
          deal_templates: PRODUCTION_DEAL_TEMPLATES
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Production opportunities error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch production opportunities' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Get production deal dashboard
   */
  async getProductionDealDashboard(request: Request, userType: 'creator' | 'production'): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, userType, user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: `${userType} portal access required` }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const userIdField = userType === 'creator' ? 'creator_id' : 'production_company_id';

      // Get active production deals
      const deals = await this.db`
        SELECT 
          d.*,
          p.title as pitch_title,
          p.title_image_url,
          p.production_stage,
          creator.username as creator_name,
          prod_company.username as production_company_name,
          prod_company.company_name,
          nda.nda_state,
          -- Calculate deal value based on type and stage
          CASE d.deal_type
            WHEN 'option' THEN d.option_amount
            WHEN 'acquisition' THEN d.purchase_price
            WHEN 'licensing' THEN d.option_amount
            ELSE COALESCE(d.purchase_price, d.option_amount)
          END as current_deal_value,
          -- Get next required actions
          CASE d.deal_state
            WHEN 'inquiry' THEN 
              CASE WHEN ${userType} = 'creator' THEN 'Review production offer'
                   ELSE 'Waiting for creator response' END
            WHEN 'nda_required' THEN
              CASE WHEN ${userType} = 'production' THEN 'Sign NDA'
                   ELSE 'Waiting for NDA signature' END
            WHEN 'due_diligence' THEN 'Provide production materials'
            WHEN 'negotiation' THEN 'Review and negotiate rights'
            WHEN 'term_sheet' THEN 'Review production agreement'
            WHEN 'legal_review' THEN 'Complete legal documentation'
            WHEN 'funding' THEN 
              CASE WHEN ${userType} = 'production' THEN 'Complete deal funding'
                   ELSE 'Confirm deal completion' END
            ELSE 'No action required'
          END as next_action,
          -- Calculate days in current state
          EXTRACT(DAY FROM now() - d.state_changed_at) as days_in_state
        FROM production_deals d
        JOIN pitches p ON d.pitch_id = p.id
        JOIN users creator ON d.creator_id = creator.id
        JOIN users prod_company ON d.production_company_id = prod_company.id
        LEFT JOIN enhanced_ndas nda ON nda.production_deal_id = d.id
        WHERE d.${this.db(userIdField)} = ${user.id}
        AND d.deal_state NOT IN ('completed', 'cancelled')
        ORDER BY 
          CASE d.priority 
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2  
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          d.state_changed_at ASC
      `;

      // Get deal summary statistics
      const summary = await this.db`
        SELECT 
          COUNT(*) as total_deals,
          COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')) as active_deals,
          COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_deals,
          COALESCE(SUM(CASE deal_type
            WHEN 'option' THEN option_amount
            WHEN 'acquisition' THEN purchase_price
            ELSE COALESCE(purchase_price, option_amount)
          END), 0) as total_deal_value,
          jsonb_object_agg(deal_type, count) as deals_by_type,
          jsonb_object_agg(deal_state, state_count) as deals_by_state
        FROM production_deals d,
        LATERAL (SELECT COUNT(*) as count FROM production_deals WHERE deal_type = d.deal_type AND ${this.db(userIdField)} = ${user.id}) type_counts,
        LATERAL (SELECT COUNT(*) as state_count FROM production_deals WHERE deal_state = d.deal_state AND ${this.db(userIdField)} = ${user.id}) state_counts
        WHERE d.${this.db(userIdField)} = ${user.id}
        GROUP BY d.id
        LIMIT 1
      `.then(result => result[0] || {
        total_deals: 0,
        active_deals: 0,
        completed_deals: 0,
        total_deal_value: 0,
        deals_by_type: {},
        deals_by_state: {}
      });

      // Get recent activity
      const recentActivity = await this.db`
        SELECT 
          'production_deal' as activity_type,
          d.deal_type, d.deal_state, d.updated_at as activity_date,
          p.title as pitch_title,
          CASE WHEN ${userType} = 'creator' 
               THEN prod_company.company_name 
               ELSE creator.username END as other_party
        FROM production_deals d
        JOIN pitches p ON d.pitch_id = p.id
        JOIN users creator ON d.creator_id = creator.id
        JOIN users prod_company ON d.production_company_id = prod_company.id
        WHERE d.${this.db(userIdField)} = ${user.id}
        UNION ALL
        SELECT 
          'nda_activity' as activity_type,
          nda.nda_type as deal_type, nda.nda_state as deal_state, nda.updated_at as activity_date,
          p.title as pitch_title,
          CASE WHEN ${userType} = 'creator' 
               THEN requester.username 
               ELSE creator.username END as other_party
        FROM enhanced_ndas nda
        JOIN pitches p ON nda.pitch_id = p.id
        JOIN users creator ON nda.creator_id = creator.id
        JOIN users requester ON nda.requester_id = requester.id
        WHERE nda.${this.db(userType === 'creator' ? 'creator_id' : 'requester_id')} = ${user.id}
        AND nda.production_deal_id IS NOT NULL
        ORDER BY activity_date DESC
        LIMIT 20
      `;

      // Get performance metrics
      const metrics = await this.getProductionMetrics(user.id, userType);

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary,
          active_deals: deals,
          recent_activity: recentActivity,
          metrics,
          user_type: userType,
          deal_templates: PRODUCTION_DEAL_TEMPLATES
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Production deal dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch production deal dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  // Private helper methods

  private async getProductionDealDetails(dealId: number): Promise<any> {
    const deals = await this.db`
      SELECT d.*, p.title as pitch_title, p.user_id as pitch_creator_id
      FROM production_deals d
      JOIN pitches p ON d.pitch_id = p.id
      WHERE d.id = ${dealId}
    `;
    
    if (deals.length === 0) {
      throw new Error('Production deal not found');
    }
    
    return deals[0];
  }

  private async validateProductionCompanyVerification(userId: number): Promise<{
    verified: boolean;
    reason?: string;
    required?: string[];
  }> {
    const user = await this.db`
      SELECT email_verified, company_verified, subscription_tier, company_name
      FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return { verified: false, reason: 'User not found' };
    }

    const { email_verified, company_verified, subscription_tier, company_name } = user[0];
    const required = [];

    if (!email_verified) {
      required.push('email_verification');
    }

    if (!company_verified) {
      required.push('company_verification');
    }

    if (!company_name) {
      required.push('company_information');
    }

    if (subscription_tier === 'free') {
      required.push('paid_subscription');
    }

    return {
      verified: required.length === 0,
      reason: required.length > 0 ? 'Additional verification required for large production deals' : undefined,
      required
    };
  }

  private async approveProductionDeal(dealId: number, userId: number, message?: string): Promise<any> {
    // Advance deal to due diligence stage
    await this.db`
      UPDATE production_deals
      SET deal_state = 'due_diligence'::investment_deal_state,
          notes = COALESCE(notes || ' | ', '') || 'Approved: ' || ${message || 'Creator approved offer'},
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'due_diligence',
      message: 'Production offer approved - proceeding to due diligence'
    };
  }

  private async rejectProductionDeal(dealId: number, userId: number, reason?: string): Promise<any> {
    await this.db`
      UPDATE production_deals
      SET deal_state = 'cancelled'::investment_deal_state,
          notes = COALESCE(notes || ' | ', '') || 'Rejected: ' || ${reason || 'Creator rejected offer'},
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'cancelled',
      message: 'Production offer has been rejected'
    };
  }

  private async requestNDAForProductionDeal(dealId: number, userId: number): Promise<any> {
    const deal = await this.getProductionDealDetails(dealId);
    
    // Create NDA request specifically for production deal
    const ndaId = await this.db`
      INSERT INTO enhanced_ndas (
        pitch_id, requester_id, creator_id, production_deal_id,
        nda_type, access_level, nda_state
      ) VALUES (
        ${deal.pitch_id}, ${deal.production_company_id}, ${deal.creator_id}, ${dealId},
        'enhanced', 'full_access', 'pending'
      ) RETURNING id
    `.then(result => result[0]?.id);

    // Update deal state
    await this.db`
      UPDATE production_deals
      SET deal_state = 'nda_required'::investment_deal_state,
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'nda_required',
      nda_id: ndaId,
      message: 'NDA request sent to production company'
    };
  }

  private async submitCounterOffer(dealId: number, userId: number, counterTerms: any, message?: string): Promise<any> {
    // Update deal with counter terms
    await this.db`
      UPDATE production_deals
      SET deal_state = 'negotiation'::investment_deal_state,
          option_amount = COALESCE(${counterTerms.option_amount}, option_amount),
          option_period = COALESCE(${counterTerms.option_period}, option_period),
          backend_percentage = COALESCE(${counterTerms.backend_percentage}, backend_percentage),
          metadata = metadata || ${JSON.stringify({ counter_offer: counterTerms, counter_message: message })},
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'negotiation',
      counter_terms: counterTerms,
      message: 'Counter offer submitted - deal moved to negotiation'
    };
  }

  private async getProductionNextSteps(dealId: number, userId: number, userRole: UserRole): Promise<string[]> {
    const deal = await this.getProductionDealDetails(dealId);
    const steps: string[] = [];

    switch (deal.deal_state) {
      case ProductionDealState.INQUIRY:
        if (userRole === UserRole.CREATOR) {
          steps.push('Review production offer terms');
          steps.push('Approve, reject, or submit counter offer');
        } else {
          steps.push('Wait for creator response');
        }
        break;

      case ProductionDealState.NDA_REQUIRED:
        if (userRole === UserRole.PRODUCTION) {
          steps.push('Review and sign NDA');
        } else {
          steps.push('Wait for production company to sign NDA');
        }
        break;

      case ProductionDealState.DUE_DILIGENCE:
        steps.push('Provide production materials and documentation');
        steps.push('Schedule creative discussion');
        break;

      case ProductionDealState.NEGOTIATION:
        steps.push('Negotiate rights and territories');
        steps.push('Finalize production timeline');
        break;

      case ProductionDealState.TERM_SHEET:
        steps.push('Review production agreement');
        steps.push('Approve final terms');
        break;

      case ProductionDealState.LEGAL_REVIEW:
        steps.push('Complete legal documentation');
        steps.push('Finalize rights transfer');
        break;

      case ProductionDealState.FUNDING:
        if (userRole === UserRole.PRODUCTION) {
          steps.push('Transfer option/purchase payment');
        } else {
          steps.push('Confirm payment received');
        }
        break;
    }

    return steps;
  }

  private async getProductionMetrics(userId: number, userType: string): Promise<any> {
    if (userType === 'production') {
      return await this.db`
        SELECT 
          COUNT(*) as total_deals,
          COUNT(DISTINCT pitch_id) as unique_projects,
          COALESCE(SUM(option_amount), 0) as total_options,
          COALESCE(SUM(purchase_price), 0) as total_acquisitions,
          COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_deals,
          COUNT(*) FILTER (WHERE deal_state IN ('inquiry', 'due_diligence', 'negotiation')) as active_deals,
          jsonb_object_agg(deal_type, type_count) as deals_by_type
        FROM production_deals d,
        LATERAL (SELECT COUNT(*) as type_count FROM production_deals WHERE deal_type = d.deal_type AND production_company_id = ${userId}) type_counts
        WHERE d.production_company_id = ${userId}
        GROUP BY d.id
        LIMIT 1
      `.then(result => result[0] || {});
    } else {
      return await this.db`
        SELECT 
          COUNT(DISTINCT d.production_company_id) as total_production_partners,
          COALESCE(SUM(d.option_amount), 0) as total_options_received,
          COALESCE(SUM(d.purchase_price), 0) as total_sales,
          COUNT(*) FILTER (WHERE d.deal_state = 'completed') as deals_closed,
          COUNT(DISTINCT d.pitch_id) as projects_with_offers,
          jsonb_object_agg(d.deal_type, type_count) as deals_by_type
        FROM production_deals d,
        LATERAL (SELECT COUNT(*) as type_count FROM production_deals WHERE deal_type = d.deal_type AND creator_id = ${userId}) type_counts
        WHERE d.creator_id = ${userId}
        GROUP BY d.id
        LIMIT 1
      `.then(result => result[0] || {});
    }
  }
}

export { CreatorProductionWorkflow, PRODUCTION_DEAL_TEMPLATES, ProductionDealType, ProductionDealState };