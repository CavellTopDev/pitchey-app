/**
 * Creator ↔ Investor Interaction Workflow Implementation
 * Complete business logic for investment deal lifecycle
 */

import type { Env } from '../db/connection';
import { getDb } from '../db/connection';
import { PortalAccessController, createPortalAccessMiddleware } from '../middleware/portal-access-control';
import { UserRole, Permission, RBAC, PermissionContext } from '../middleware/rbac';
import { getCorsHeaders } from '../utils/response';

// Investment deal states - matching database enum
export enum InvestmentDealState {
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

// Deal priorities
export enum DealPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Investment deal interface
export interface InvestmentDeal {
  id?: number;
  pitch_id: number;
  investor_id: number;
  creator_id: number;
  deal_state: InvestmentDealState;
  deal_type: string;
  investment_amount?: number;
  equity_percentage?: number;
  valuation?: number;
  minimum_funding?: number;
  funding_deadline?: Date;
  terms?: any;
  due_diligence_items?: any;
  legal_documents?: any;
  milestone_conditions?: any;
  priority: DealPriority;
  notes?: string;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

// Deal transition interface
export interface DealTransition {
  from_state: InvestmentDealState;
  to_state: InvestmentDealState;
  required_permissions: Permission[];
  required_user_types: UserRole[];
  validation_rules: string[];
  auto_advance_conditions?: string[];
}

// Define valid state transitions
const DEAL_TRANSITIONS: Record<string, DealTransition> = {
  'inquiry_to_nda_required': {
    from_state: InvestmentDealState.INQUIRY,
    to_state: InvestmentDealState.NDA_REQUIRED,
    required_permissions: [Permission.NDA_APPROVE],
    required_user_types: [UserRole.CREATOR],
    validation_rules: ['pitch_requires_nda']
  },
  'inquiry_to_due_diligence': {
    from_state: InvestmentDealState.INQUIRY,
    to_state: InvestmentDealState.DUE_DILIGENCE,
    required_permissions: [Permission.INVESTMENT_CREATE],
    required_user_types: [UserRole.CREATOR, UserRole.INVESTOR],
    validation_rules: ['basic_validation_passed']
  },
  'nda_required_to_nda_signed': {
    from_state: InvestmentDealState.NDA_REQUIRED,
    to_state: InvestmentDealState.NDA_SIGNED,
    required_permissions: [Permission.NDA_SIGN],
    required_user_types: [UserRole.INVESTOR],
    validation_rules: ['nda_signed_and_approved'],
    auto_advance_conditions: ['nda_status_approved']
  },
  'nda_signed_to_due_diligence': {
    from_state: InvestmentDealState.NDA_SIGNED,
    to_state: InvestmentDealState.DUE_DILIGENCE,
    required_permissions: [Permission.INVESTMENT_CREATE],
    required_user_types: [UserRole.CREATOR, UserRole.INVESTOR],
    validation_rules: ['nda_access_verified']
  },
  'due_diligence_to_negotiation': {
    from_state: InvestmentDealState.DUE_DILIGENCE,
    to_state: InvestmentDealState.NEGOTIATION,
    required_permissions: [Permission.INVESTMENT_UPDATE],
    required_user_types: [UserRole.CREATOR, UserRole.INVESTOR],
    validation_rules: ['due_diligence_completed']
  },
  'negotiation_to_term_sheet': {
    from_state: InvestmentDealState.NEGOTIATION,
    to_state: InvestmentDealState.TERM_SHEET,
    required_permissions: [Permission.INVESTMENT_UPDATE],
    required_user_types: [UserRole.CREATOR, UserRole.INVESTOR],
    validation_rules: ['terms_agreed']
  },
  'term_sheet_to_legal_review': {
    from_state: InvestmentDealState.TERM_SHEET,
    to_state: InvestmentDealState.LEGAL_REVIEW,
    required_permissions: [Permission.INVESTMENT_APPROVE],
    required_user_types: [UserRole.CREATOR, UserRole.INVESTOR],
    validation_rules: ['term_sheet_signed']
  },
  'legal_review_to_funding': {
    from_state: InvestmentDealState.LEGAL_REVIEW,
    to_state: InvestmentDealState.FUNDING,
    required_permissions: [Permission.INVESTMENT_APPROVE],
    required_user_types: [UserRole.INVESTOR],
    validation_rules: ['legal_documents_complete', 'payment_verified']
  },
  'funding_to_completed': {
    from_state: InvestmentDealState.FUNDING,
    to_state: InvestmentDealState.COMPLETED,
    required_permissions: [Permission.INVESTMENT_APPROVE],
    required_user_types: [UserRole.CREATOR],
    validation_rules: ['funds_received_confirmation']
  }
};

export class CreatorInvestorWorkflow {
  private env: Env;
  private db: any;
  private portalController: PortalAccessController;

  constructor(env: Env) {
    this.env = env;
    this.db = getDb(env);
    this.portalController = new PortalAccessController(env);
  }

  /**
   * Investor initiates interest in a pitch
   */
  async expressInvestmentInterest(
    request: Request,
    pitchId: number,
    investmentDetails: {
      amount: number;
      equity_percentage?: number;
      terms?: any;
      message?: string;
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      // Validate portal access
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, 'investor', user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Investor portal access required' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate investment amount
      if (investmentDetails.amount < 1000) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'INVALID_AMOUNT', message: 'Minimum investment amount is €1,000' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Check if user is verified for large investments
      if (investmentDetails.amount > 100000) {
        const verification = await this.validateInvestorVerification(user.id);
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

      // Create investment inquiry using database function
      const dealId = await this.db`
        SELECT create_investment_inquiry(
          ${pitchId}::integer,
          ${user.id}::integer,
          ${investmentDetails.amount}::numeric,
          ${JSON.stringify(investmentDetails)}::jsonb
        ) as deal_id
      `.then(result => result[0]?.deal_id);

      if (!dealId) {
        throw new Error('Failed to create investment inquiry');
      }

      // Get the created deal details
      const deal = await this.getDealDetails(dealId);

      return new Response(JSON.stringify({
        success: true,
        data: {
          deal_id: dealId,
          deal_state: deal.deal_state,
          message: 'Investment interest submitted successfully',
          next_steps: await this.getNextSteps(dealId, user.id, UserRole.INVESTOR)
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Investment interest error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process investment interest' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Creator responds to investment interest
   */
  async respondToInvestmentInterest(
    request: Request,
    dealId: number,
    response: {
      action: 'approve' | 'reject' | 'request_nda' | 'negotiate';
      message?: string;
      counter_terms?: any;
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
      const deal = await this.getDealDetails(dealId);
      if (deal.creator_id !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Can only respond to your own pitch inquiries' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      let result;
      
      switch (response.action) {
        case 'approve':
          result = await this.approveDealAdvancement(dealId, user.id, response.message);
          break;
        case 'reject':
          result = await this.rejectDeal(dealId, user.id, response.message);
          break;
        case 'request_nda':
          result = await this.requestNDAForDeal(dealId, user.id);
          break;
        case 'negotiate':
          result = await this.initiateNegotiation(dealId, user.id, response.counter_terms);
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
      console.error('Investment response error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process investment response' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Advance deal to next state
   */
  async advanceDealState(
    request: Request,
    dealId: number,
    targetState?: InvestmentDealState,
    metadata?: any
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const deal = await this.getDealDetails(dealId);
      
      // Verify user has permission to advance this deal
      const canAdvance = await this.canUserAdvanceDeal(deal, user.id, targetState);
      if (!canAdvance.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: canAdvance.reason }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Validate business rules before advancement
      const validation = await this.validateDealAdvancement(deal, targetState, user.id);
      if (!validation.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: 'VALIDATION_FAILED', 
            message: 'Deal advancement validation failed',
            violations: validation.violations 
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Advance deal state using database function
      const advanced = await this.db`
        SELECT advance_deal_state(${dealId}::integer, ${user.id}::integer, ${metadata?.reason || null}) as advanced
      `.then(result => result[0]?.advanced);

      if (!advanced) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'ADVANCEMENT_FAILED', message: 'Could not advance deal state' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Get updated deal details
      const updatedDeal = await this.getDealDetails(dealId);
      const nextSteps = await this.getNextSteps(dealId, user.id, user.userType as UserRole);

      return new Response(JSON.stringify({
        success: true,
        data: {
          deal: updatedDeal,
          previous_state: deal.deal_state,
          current_state: updatedDeal.deal_state,
          next_steps: nextSteps
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Deal advancement error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to advance deal state' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Get investment opportunities for investor
   */
  async getInvestmentOpportunities(
    request: Request,
    filters: {
      genre?: string[];
      format?: string[];
      budget_range?: { min: number; max: number };
      seeking_investment?: boolean;
      location?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const accessResult = await this.portalController.validatePortalAccess(request, 'investor', user);
      
      if (!accessResult.allowed) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Investor portal access required' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const limit = Math.min(filters.limit || 20, 100);
      const offset = filters.offset || 0;

      // Build dynamic query based on filters
      let whereConditions = ['p.status = $1', 'p.seeking_investment = true'];
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

      if (filters.budget_range) {
        whereConditions.push(`p.estimated_budget BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(filters.budget_range.min, filters.budget_range.max);
        paramIndex += 2;
      }

      const query = `
        SELECT 
          p.id, p.title, p.logline, p.genre, p.format,
          p.estimated_budget, p.target_audience, p.production_timeline,
          p.title_image_url, p.view_count, p.like_count,
          p.seeking_investment, p.funding_goal, p.funding_raised,
          u.username as creator_name, u.location as creator_location,
          u.company_name as creator_company,
          -- Check if user already has active deal for this pitch
          EXISTS (
            SELECT 1 FROM investment_deals d 
            WHERE d.pitch_id = p.id AND d.investor_id = $${paramIndex}
            AND d.deal_state NOT IN ('completed', 'cancelled')
          ) as has_active_deal,
          -- Get investment metrics
          (
            SELECT jsonb_build_object(
              'total_investors', COUNT(DISTINCT d.investor_id),
              'total_amount', COALESCE(SUM(d.investment_amount), 0),
              'average_investment', COALESCE(AVG(d.investment_amount), 0)
            )
            FROM investment_deals d
            WHERE d.pitch_id = p.id AND d.deal_state = 'completed'
          ) as investment_metrics
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE WHEN p.funding_deadline IS NOT NULL 
               THEN p.funding_deadline END ASC,
          p.view_count DESC,
          p.created_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      params.push(user.id, limit, offset);

      const opportunities = await this.db.query(query, params);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM pitches p
        JOIN users u ON p.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
      `;

      const countParams = params.slice(0, -2); // Remove limit and offset
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
          filters_applied: filters
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Investment opportunities error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch investment opportunities' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * Get deal dashboard for user
   */
  async getDealDashboard(request: Request, userType: 'creator' | 'investor'): Promise<Response> {
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

      // Get comprehensive deal summary
      const summary = await this.db`
        SELECT get_user_deal_summary(${user.id}::integer, ${userType}) as summary
      `.then(result => result[0]?.summary || {});

      // Get active deals with full details
      const userIdField = userType === 'creator' ? 'creator_id' : 'investor_id';
      const deals = await this.db`
        SELECT 
          d.*,
          p.title as pitch_title,
          p.title_image_url,
          creator.username as creator_name,
          investor.username as investor_name,
          nda.nda_state,
          -- Get next required actions
          CASE d.deal_state
            WHEN 'inquiry' THEN 
              CASE WHEN ${userType} = 'creator' THEN 'Respond to inquiry'
                   ELSE 'Waiting for creator response' END
            WHEN 'nda_required' THEN
              CASE WHEN ${userType} = 'investor' THEN 'Sign NDA'
                   ELSE 'Waiting for NDA signature' END
            WHEN 'due_diligence' THEN 'Provide due diligence materials'
            WHEN 'negotiation' THEN 'Review and negotiate terms'
            WHEN 'term_sheet' THEN 'Review term sheet'
            WHEN 'legal_review' THEN 'Complete legal review'
            WHEN 'funding' THEN 
              CASE WHEN ${userType} = 'investor' THEN 'Complete funding'
                   ELSE 'Confirm funds received' END
            ELSE 'No action required'
          END as next_action,
          -- Calculate days in current state
          EXTRACT(DAY FROM now() - d.state_changed_at) as days_in_state
        FROM investment_deals d
        JOIN pitches p ON d.pitch_id = p.id
        JOIN users creator ON d.creator_id = creator.id
        JOIN users investor ON d.investor_id = investor.id
        LEFT JOIN enhanced_ndas nda ON nda.deal_id = d.id
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

      // Get recent activity
      const recentActivity = await this.db`
        SELECT 
          h.from_state, h.to_state, h.created_at,
          h.reason, p.title as pitch_title,
          u.username as changed_by_user
        FROM investment_deal_history h
        JOIN investment_deals d ON h.deal_id = d.id
        JOIN pitches p ON d.pitch_id = p.id
        JOIN users u ON h.changed_by = u.id
        WHERE d.${this.db(userIdField)} = ${user.id}
        ORDER BY h.created_at DESC
        LIMIT 10
      `;

      // Get performance metrics
      const metrics = await this.getPerformanceMetrics(user.id, userType);

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary,
          active_deals: deals,
          recent_activity: recentActivity,
          metrics,
          user_type: userType
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Deal dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch deal dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  // Private helper methods

  private async getDealDetails(dealId: number): Promise<any> {
    const deals = await this.db`
      SELECT d.*, p.title as pitch_title, p.user_id as pitch_creator_id
      FROM investment_deals d
      JOIN pitches p ON d.pitch_id = p.id
      WHERE d.id = ${dealId}
    `;
    
    if (deals.length === 0) {
      throw new Error('Deal not found');
    }
    
    return deals[0];
  }

  private async validateInvestorVerification(userId: number): Promise<{
    verified: boolean;
    reason?: string;
    required?: string[];
  }> {
    const user = await this.db`
      SELECT email_verified, company_verified, subscription_tier
      FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) {
      return { verified: false, reason: 'User not found' };
    }

    const { email_verified, company_verified, subscription_tier } = user[0];
    const required = [];

    if (!email_verified) {
      required.push('email_verification');
    }

    if (!company_verified) {
      required.push('company_verification');
    }

    if (subscription_tier === 'free') {
      required.push('paid_subscription');
    }

    return {
      verified: required.length === 0,
      reason: required.length > 0 ? 'Additional verification required for large investments' : undefined,
      required
    };
  }

  private async canUserAdvanceDeal(deal: any, userId: number, targetState?: InvestmentDealState): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // User must be either creator or investor
    if (deal.creator_id !== userId && deal.investor_id !== userId) {
      return { allowed: false, reason: 'Not authorized to modify this deal' };
    }

    // If target state is specified, validate transition
    if (targetState) {
      const transitionKey = `${deal.deal_state}_to_${targetState}`;
      const transition = DEAL_TRANSITIONS[transitionKey];
      
      if (!transition) {
        return { allowed: false, reason: 'Invalid state transition' };
      }

      // Check if user has required role for this transition
      const userRole = deal.creator_id === userId ? UserRole.CREATOR : UserRole.INVESTOR;
      if (!transition.required_user_types.includes(userRole)) {
        return { allowed: false, reason: 'User role not authorized for this transition' };
      }
    }

    return { allowed: true };
  }

  private async validateDealAdvancement(deal: any, targetState?: InvestmentDealState, userId?: number): Promise<{
    valid: boolean;
    violations: any[];
  }> {
    // Use database validation function
    const result = await this.db`
      SELECT validate_investment_deal(${deal.id}::integer) as validation
    `.then(result => result[0]?.validation || { valid: false, violations: [] });

    return {
      valid: result.valid,
      violations: result.violations
    };
  }

  private async getNextSteps(dealId: number, userId: number, userRole: UserRole): Promise<string[]> {
    const deal = await this.getDealDetails(dealId);
    const steps: string[] = [];

    switch (deal.deal_state) {
      case InvestmentDealState.INQUIRY:
        if (userRole === UserRole.CREATOR) {
          steps.push('Review investment inquiry');
          steps.push('Approve, reject, or request NDA');
        } else {
          steps.push('Wait for creator response');
        }
        break;

      case InvestmentDealState.NDA_REQUIRED:
        if (userRole === UserRole.INVESTOR) {
          steps.push('Review and sign NDA');
        } else {
          steps.push('Wait for investor to sign NDA');
        }
        break;

      case InvestmentDealState.DUE_DILIGENCE:
        steps.push('Provide due diligence materials');
        steps.push('Schedule discussion call');
        break;

      case InvestmentDealState.NEGOTIATION:
        steps.push('Review investment terms');
        steps.push('Negotiate equity and valuation');
        break;

      case InvestmentDealState.TERM_SHEET:
        steps.push('Review term sheet');
        steps.push('Sign agreement');
        break;

      case InvestmentDealState.LEGAL_REVIEW:
        steps.push('Complete legal documentation');
        break;

      case InvestmentDealState.FUNDING:
        if (userRole === UserRole.INVESTOR) {
          steps.push('Transfer investment funds');
        } else {
          steps.push('Confirm receipt of funds');
        }
        break;
    }

    return steps;
  }

  private async getPerformanceMetrics(userId: number, userType: string): Promise<any> {
    if (userType === 'investor') {
      return await this.db`
        SELECT 
          COUNT(*) as total_investments,
          COALESCE(SUM(investment_amount), 0) as total_invested,
          COALESCE(AVG(investment_amount), 0) as avg_investment,
          COUNT(*) FILTER (WHERE deal_state = 'completed') as successful_deals,
          COUNT(*) FILTER (WHERE deal_state IN ('inquiry', 'due_diligence', 'negotiation')) as active_deals
        FROM investment_deals
        WHERE investor_id = ${userId}
      `.then(result => result[0] || {});
    } else {
      return await this.db`
        SELECT 
          COUNT(DISTINCT d.investor_id) as total_investors,
          COALESCE(SUM(d.investment_amount), 0) as total_funding,
          COALESCE(AVG(d.investment_amount), 0) as avg_deal_size,
          COUNT(*) FILTER (WHERE d.deal_state = 'completed') as funded_projects,
          COUNT(DISTINCT d.pitch_id) as pitched_projects
        FROM investment_deals d
        WHERE d.creator_id = ${userId}
      `.then(result => result[0] || {});
    }
  }

  private async approveDealAdvancement(dealId: number, userId: number, message?: string): Promise<any> {
    const advanced = await this.db`
      SELECT advance_deal_state(${dealId}::integer, ${userId}::integer, ${message || 'Deal approved'}) as advanced
    `.then(result => result[0]?.advanced);

    return {
      advanced,
      message: advanced ? 'Deal advanced to next stage' : 'Could not advance deal'
    };
  }

  private async rejectDeal(dealId: number, userId: number, reason?: string): Promise<any> {
    await this.db`
      UPDATE investment_deals
      SET deal_state = 'cancelled'::investment_deal_state,
          notes = COALESCE(notes || ' | ', '') || 'Rejected: ' || ${reason || 'No reason provided'},
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'cancelled',
      message: 'Deal has been rejected'
    };
  }

  private async requestNDAForDeal(dealId: number, userId: number): Promise<any> {
    const deal = await this.getDealDetails(dealId);
    
    // Create NDA request
    const ndaId = await this.db`
      SELECT create_nda_request(
        ${deal.pitch_id}::integer,
        ${deal.investor_id}::integer,
        'enhanced'::nda_type,
        'full_access'
      ) as nda_id
    `.then(result => result[0]?.nda_id);

    // Update deal state to nda_required
    await this.db`
      UPDATE investment_deals
      SET deal_state = 'nda_required'::investment_deal_state,
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'nda_required',
      nda_id: ndaId,
      message: 'NDA request sent to investor'
    };
  }

  private async initiateNegotiation(dealId: number, userId: number, counterTerms: any): Promise<any> {
    await this.db`
      UPDATE investment_deals
      SET deal_state = 'negotiation'::investment_deal_state,
          terms = ${JSON.stringify(counterTerms)},
          state_changed_at = now(),
          state_changed_by = ${userId}
      WHERE id = ${dealId}
    `;

    return {
      deal_state: 'negotiation',
      counter_terms: counterTerms,
      message: 'Negotiation initiated with counter terms'
    };
  }
}

export { CreatorInvestorWorkflow };