// A/B Testing Handler for Cloudflare Worker
import { Request as CFRequest } from '@cloudflare/workers-types';
import { WorkerDatabase } from '../services/worker-database';
import { ApiResponseBuilder } from '../utils/api-response';
import { rateLimiters, ValidationSchemas, Sanitizer, logSecurityEvent } from '../services/security-fix';

interface ABTestingRequest extends CFRequest {
  user?: {
    id: number;
    userType: string;
    email: string;
  };
  params?: Record<string, string>;
  body?: any;
  ip?: string;
}

interface ExperimentConfig {
  name: string;
  description?: string;
  hypothesis?: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  variants: VariantConfig[];
  trafficAllocation: number;
  targetingRules: Record<string, any>;
  userSegments: string[];
  minimumSampleSize: number;
  statisticalPower: number;
  significanceLevel: number;
  autoWinnerDetection: boolean;
  tags: string[];
}

interface VariantConfig {
  id: string;
  name: string;
  description?: string;
  trafficAllocation: number;
  config: Record<string, any>;
  isControl: boolean;
}

interface UserContext {
  userId?: number;
  sessionId?: string;
  userType?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  customProperties?: Record<string, any>;
}

export class ABTestingHandler {
  private db: WorkerDatabase;

  constructor(db: WorkerDatabase) {
    this.db = db;
  }

  // Create new experiment
  async createExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiters.experimentCreation.check(request.ip || 'unknown');
      if (!rateLimitResult.success) {
        return ApiResponseBuilder.rateLimited('Too many experiment creations');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      const body = await this.parseJsonBody(request);
      
      // Validate experiment configuration
      const validationResult = this.validateExperimentConfig(body);
      if (!validationResult.valid) {
        return ApiResponseBuilder.badRequest(`Invalid experiment config: ${validationResult.errors.join(', ')}`);
      }

      // Create experiment in database
      const experimentResult = await this.db.query(`
        INSERT INTO experiments (
          name, description, hypothesis, primary_metric, secondary_metrics,
          traffic_allocation, targeting_rules, user_segments, minimum_sample_size,
          statistical_power, significance_level, auto_winner_detection, tags, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        Sanitizer.sanitizeString(body.name),
        Sanitizer.sanitizeString(body.description || ''),
        Sanitizer.sanitizeString(body.hypothesis || ''),
        body.primaryMetric,
        JSON.stringify(body.secondaryMetrics || []),
        body.trafficAllocation || 1.0,
        JSON.stringify(body.targetingRules || {}),
        JSON.stringify(body.userSegments || []),
        body.minimumSampleSize || 100,
        body.statisticalPower || 0.8,
        body.significanceLevel || 0.05,
        body.autoWinnerDetection || false,
        JSON.stringify(body.tags || []),
        request.user.id
      ]);

      if (experimentResult.rows.length === 0) {
        return ApiResponseBuilder.internalServerError('Failed to create experiment');
      }

      const experiment = experimentResult.rows[0];

      // Create variants
      const variants = [];
      for (const variant of body.variants) {
        const variantResult = await this.db.query(`
          INSERT INTO experiment_variants (
            experiment_id, variant_id, name, description, config,
            traffic_allocation, is_control
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          experiment.id,
          variant.id,
          Sanitizer.sanitizeString(variant.name),
          Sanitizer.sanitizeString(variant.description || ''),
          JSON.stringify(variant.config),
          variant.trafficAllocation,
          variant.isControl || false
        ]);
        variants.push(variantResult.rows[0]);
      }

      await logSecurityEvent(this.db, {
        userId: request.user.id,
        event: 'experiment_created',
        details: { experimentId: experiment.id, name: body.name }
      });

      return ApiResponseBuilder.success({
        experiment: this.formatExperiment(experiment),
        variants: variants.map(this.formatVariant)
      });

    } catch (error) {
      console.error('Error creating experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to create experiment');
    }
  }

  // List experiments with filtering
  async listExperiments(request: ABTestingRequest): Promise<Response> {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const tags = url.searchParams.getAll('tags');
      const createdBy = url.searchParams.get('createdBy');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const orderBy = url.searchParams.get('orderBy') || 'created_at';
      const orderDirection = url.searchParams.get('orderDirection') || 'desc';

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      // Build WHERE clause
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (tags.length > 0) {
        conditions.push(`tags && $${paramIndex}`);
        params.push(JSON.stringify(tags));
        paramIndex++;
      }

      if (createdBy) {
        conditions.push(`created_by = $${paramIndex}`);
        params.push(parseInt(createdBy));
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*) as count FROM experiments ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].count);

      // Get experiments with pagination
      const orderColumn = ['created_at', 'updated_at', 'name'].includes(orderBy) ? orderBy : 'created_at';
      const direction = orderDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const experimentsResult = await this.db.query(`
        SELECT * FROM experiments ${whereClause}
        ORDER BY ${orderColumn} ${direction}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      const experiments = experimentsResult.rows.map(this.formatExperiment);

      return ApiResponseBuilder.success({
        experiments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: total > offset + limit
        }
      });

    } catch (error) {
      console.error('Error listing experiments:', error);
      return ApiResponseBuilder.internalServerError('Failed to list experiments');
    }
  }

  // Get experiment details
  async getExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = parseInt(request.params?.id || '0');
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Invalid experiment ID');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.rows.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      const variantsResult = await this.db.query(`
        SELECT * FROM experiment_variants WHERE experiment_id = $1 ORDER BY created_at
      `, [experimentId]);

      const experiment = this.formatExperiment(experimentResult.rows[0]);
      const variants = variantsResult.rows.map(this.formatVariant);

      return ApiResponseBuilder.success({
        experiment,
        variants
      });

    } catch (error) {
      console.error('Error getting experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to get experiment');
    }
  }

  // Start experiment
  async startExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = parseInt(request.params?.id || '0');
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Invalid experiment ID');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      // Validate experiment can be started
      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.rows.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      const experiment = experimentResult.rows[0];
      if (experiment.status !== 'draft') {
        return ApiResponseBuilder.badRequest('Only draft experiments can be started');
      }

      // Check variants exist
      const variantsResult = await this.db.query(`
        SELECT COUNT(*) as count FROM experiment_variants WHERE experiment_id = $1
      `, [experimentId]);

      if (parseInt(variantsResult.rows[0].count) < 2) {
        return ApiResponseBuilder.badRequest('Experiment must have at least 2 variants');
      }

      // Start experiment
      await this.db.query(`
        UPDATE experiments 
        SET status = 'active', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [experimentId]);

      await logSecurityEvent(this.db, {
        userId: request.user.id,
        event: 'experiment_started',
        details: { experimentId }
      });

      return ApiResponseBuilder.success({ message: 'Experiment started successfully' });

    } catch (error) {
      console.error('Error starting experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to start experiment');
    }
  }

  // Pause experiment
  async pauseExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = parseInt(request.params?.id || '0');
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Invalid experiment ID');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      const body = await this.parseJsonBody(request);
      const reason = body?.reason;

      await this.db.query(`
        UPDATE experiments 
        SET status = 'paused', paused_at = NOW(), pause_reason = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'active'
      `, [experimentId, reason]);

      await logSecurityEvent(this.db, {
        userId: request.user.id,
        event: 'experiment_paused',
        details: { experimentId, reason }
      });

      return ApiResponseBuilder.success({ message: 'Experiment paused successfully' });

    } catch (error) {
      console.error('Error pausing experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to pause experiment');
    }
  }

  // Get user experiment assignments
  async getAssignments(request: ABTestingRequest): Promise<Response> {
    try {
      // Rate limiting
      const rateLimitResult = await rateLimiters.apiRequests.check(request.ip || 'unknown');
      if (!rateLimitResult.success) {
        return ApiResponseBuilder.rateLimited('Too many requests');
      }

      const body = await this.parseJsonBody(request);
      const userContext = this.extractUserContext(request, body.userContext);
      const experimentIds = body.experimentIds;

      let assignments = [];

      if (experimentIds && experimentIds.length > 0) {
        // Get assignments for specific experiments
        assignments = await Promise.all(
          experimentIds.map(async (experimentId: number) => {
            return await this.assignUserToExperiment(experimentId, userContext);
          })
        );
        assignments = assignments.filter(assignment => assignment !== null);
      } else {
        // Get all active assignments for user
        const identifier = userContext.userId || userContext.sessionId;
        if (identifier) {
          const assignmentsResult = await this.db.query(`
            SELECT uea.*, e.status as experiment_status, e.name as experiment_name
            FROM user_experiment_assignments uea
            JOIN experiments e ON uea.experiment_id = e.id
            WHERE e.status = 'active' AND (
              (uea.user_id = $1 AND $1 IS NOT NULL) OR 
              (uea.session_id = $2 AND $2 IS NOT NULL)
            )
            ORDER BY uea.assigned_at DESC
          `, [userContext.userId, userContext.sessionId]);

          assignments = assignmentsResult.rows.map(this.formatUserAssignment);
        }
      }

      return ApiResponseBuilder.success({ assignments });

    } catch (error) {
      console.error('Error getting assignments:', error);
      return ApiResponseBuilder.internalServerError('Failed to get assignments');
    }
  }

  // Track experiment event
  async trackEvent(request: ABTestingRequest): Promise<Response> {
    try {
      // High-frequency rate limiting
      const rateLimitResult = await rateLimiters.tracking.check(request.ip || 'unknown');
      if (!rateLimitResult.success) {
        return ApiResponseBuilder.rateLimited('Too many tracking events');
      }

      const body = await this.parseJsonBody(request);
      const { experimentId, variantId, eventType, userContext, eventData } = body;

      if (!experimentId || !variantId || !eventType) {
        return ApiResponseBuilder.badRequest('Missing required fields: experimentId, variantId, eventType');
      }

      const mergedContext = this.extractUserContext(request, userContext);

      // Validate experiment is active
      const experimentResult = await this.db.query(`
        SELECT status FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.rows.length === 0 || experimentResult.rows[0].status !== 'active') {
        return ApiResponseBuilder.badRequest('Experiment is not active');
      }

      // Update first exposure time if needed
      const identifier = mergedContext.userId || mergedContext.sessionId;
      if (identifier) {
        await this.db.query(`
          UPDATE user_experiment_assignments
          SET first_exposure_at = COALESCE(first_exposure_at, NOW())
          WHERE experiment_id = $1 AND (
            (user_id = $2 AND $2 IS NOT NULL) OR 
            (session_id = $3 AND $3 IS NOT NULL)
          )
        `, [experimentId, mergedContext.userId, mergedContext.sessionId]);
      }

      // Track event
      await this.db.query(`
        INSERT INTO experiment_events (
          experiment_id, variant_id, event_type, event_name, event_value,
          user_id, session_id, user_type, user_agent, ip_address,
          url, referrer, element_id, element_text, properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        experimentId,
        variantId,
        eventType,
        eventData?.eventName,
        eventData?.eventValue,
        mergedContext.userId,
        mergedContext.sessionId,
        mergedContext.userType,
        mergedContext.userAgent,
        mergedContext.ipAddress,
        eventData?.url,
        mergedContext.referrer,
        eventData?.elementId,
        eventData?.elementText,
        JSON.stringify(eventData?.properties || {})
      ]);

      return ApiResponseBuilder.success({ message: 'Event tracked successfully' });

    } catch (error) {
      console.error('Error tracking event:', error);
      return ApiResponseBuilder.internalServerError('Failed to track event');
    }
  }

  // Get experiment results and analytics
  async getResults(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = parseInt(request.params?.id || '0');
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Invalid experiment ID');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      const url = new URL(request.url);
      const timeRange = url.searchParams.get('timeRange') || '24h';

      // Get experiment details
      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.rows.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      // Get variant metrics
      const variantsResult = await this.db.query(`
        SELECT 
          ev.variant_id,
          ev.name as variant_name,
          ev.is_control,
          COUNT(DISTINCT COALESCE(ee.user_id::text, ee.session_id)) as participants,
          COUNT(*) FILTER (WHERE ee.event_type = 'conversion') as conversions,
          COALESCE(AVG(ee.event_value) FILTER (WHERE ee.event_type = 'conversion'), 0) as avg_order_value,
          COALESCE(SUM(ee.event_value) FILTER (WHERE ee.event_type = 'conversion'), 0) as total_revenue
        FROM experiment_variants ev
        LEFT JOIN experiment_events ee ON ev.experiment_id = ee.experiment_id AND ev.variant_id = ee.variant_id
        WHERE ev.experiment_id = $1
        GROUP BY ev.variant_id, ev.name, ev.is_control
        ORDER BY ev.is_control DESC, ev.variant_id
      `, [experimentId]);

      const variants = variantsResult.rows.map(row => ({
        variantId: row.variant_id,
        variantName: row.variant_name,
        isControl: row.is_control,
        participants: parseInt(row.participants) || 0,
        conversions: parseInt(row.conversions) || 0,
        conversionRate: parseInt(row.participants) > 0 ? (parseInt(row.conversions) || 0) / (parseInt(row.participants) || 1) : 0,
        revenue: parseFloat(row.total_revenue) || 0,
        averageOrderValue: parseFloat(row.avg_order_value) || 0
      }));

      // Get time series data for trends
      const timeSeriesResult = await this.db.query(`
        SELECT 
          date_trunc('hour', ee.timestamp) as hour,
          ee.variant_id,
          COUNT(DISTINCT COALESCE(ee.user_id::text, ee.session_id)) as hourly_participants,
          COUNT(*) FILTER (WHERE ee.event_type = 'conversion') as hourly_conversions
        FROM experiment_events ee
        WHERE ee.experiment_id = $1 AND ee.timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', ee.timestamp), ee.variant_id
        ORDER BY hour, ee.variant_id
      `, [experimentId]);

      // Calculate overall metrics
      const totalParticipants = variants.reduce((sum, v) => sum + v.participants, 0);
      const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
      const overallConversionRate = totalParticipants > 0 ? totalConversions / totalParticipants : 0;

      const results = {
        experimentId,
        experimentName: experimentResult.rows[0].name,
        status: experimentResult.rows[0].status,
        startDate: experimentResult.rows[0].started_at,
        totalParticipants,
        totalConversions,
        overallConversionRate,
        variants,
        timeSeriesData: this.formatTimeSeriesData(timeSeriesResult.rows),
        lastUpdated: new Date().toISOString()
      };

      return ApiResponseBuilder.success(results);

    } catch (error) {
      console.error('Error getting results:', error);
      return ApiResponseBuilder.internalServerError('Failed to get results');
    }
  }

  // Private helper methods
  private async assignUserToExperiment(experimentId: number, userContext: UserContext): Promise<any> {
    try {
      // Get experiment details
      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1 AND status = 'active'
      `, [experimentId]);

      if (experimentResult.rows.length === 0) {
        return null;
      }

      const experiment = experimentResult.rows[0];

      // Check if user already assigned
      const identifier = userContext.userId || userContext.sessionId;
      if (!identifier) {
        return null;
      }

      const existingResult = await this.db.query(`
        SELECT * FROM user_experiment_assignments
        WHERE experiment_id = $1 AND (
          (user_id = $2 AND $2 IS NOT NULL) OR 
          (session_id = $3 AND $3 IS NOT NULL)
        )
      `, [experimentId, userContext.userId, userContext.sessionId]);

      if (existingResult.rows.length > 0) {
        return this.formatUserAssignment(existingResult.rows[0]);
      }

      // Get experiment variants
      const variantsResult = await this.db.query(`
        SELECT * FROM experiment_variants WHERE experiment_id = $1 ORDER BY traffic_allocation DESC
      `, [experimentId]);

      if (variantsResult.rows.length === 0) {
        return null;
      }

      // Assign to variant using deterministic hash
      const variantId = this.assignToVariant(identifier.toString(), variantsResult.rows);

      // Create assignment
      const assignmentResult = await this.db.query(`
        INSERT INTO user_experiment_assignments (
          experiment_id, variant_id, user_id, session_id, user_type,
          user_agent, ip_address, custom_properties
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        experimentId,
        variantId,
        userContext.userId,
        userContext.sessionId,
        userContext.userType,
        userContext.userAgent,
        userContext.ipAddress,
        JSON.stringify(userContext.customProperties || {})
      ]);

      return this.formatUserAssignment(assignmentResult.rows[0]);

    } catch (error) {
      console.error('Error assigning user to experiment:', error);
      return null;
    }
  }

  private assignToVariant(identifier: string, variants: any[]): string {
    // Use deterministic hash to assign user to variant
    const hash = this.hashString(identifier);
    const normalizedHash = hash / Math.pow(2, 32);
    
    let cumulativeAllocation = 0;
    for (const variant of variants) {
      cumulativeAllocation += parseFloat(variant.traffic_allocation);
      if (normalizedHash <= cumulativeAllocation) {
        return variant.variant_id;
      }
    }
    
    // Fallback to first variant
    return variants[0].variant_id;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private extractUserContext(request: ABTestingRequest, bodyContext?: any): UserContext {
    return {
      userId: request.user?.id,
      sessionId: bodyContext?.sessionId || request.headers?.get('x-session-id'),
      userType: request.user?.userType,
      userAgent: request.headers?.get('user-agent'),
      ipAddress: request.ip || request.headers?.get('cf-connecting-ip'),
      referrer: request.headers?.get('referer'),
      customProperties: bodyContext?.customProperties || {}
    };
  }

  private validateExperimentConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name?.trim()) errors.push('Name is required');
    if (!config.primaryMetric) errors.push('Primary metric is required');
    if (!config.variants || !Array.isArray(config.variants) || config.variants.length < 2) {
      errors.push('At least 2 variants are required');
    }

    if (config.variants) {
      const controlCount = config.variants.filter((v: any) => v.isControl).length;
      if (controlCount !== 1) {
        errors.push('Exactly one control variant is required');
      }

      const totalAllocation = config.variants.reduce((sum: number, v: any) => sum + (v.trafficAllocation || 0), 0);
      if (Math.abs(totalAllocation - 1.0) > 0.001) {
        errors.push('Variant traffic allocations must sum to 1.0');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private formatExperiment(row: any): any {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      hypothesis: row.hypothesis,
      status: row.status,
      primaryMetric: row.primary_metric,
      secondaryMetrics: JSON.parse(row.secondary_metrics || '[]'),
      trafficAllocation: parseFloat(row.traffic_allocation),
      targetingRules: JSON.parse(row.targeting_rules || '{}'),
      userSegments: JSON.parse(row.user_segments || '[]'),
      minimumSampleSize: row.minimum_sample_size,
      statisticalPower: parseFloat(row.statistical_power),
      significanceLevel: parseFloat(row.significance_level),
      autoWinnerDetection: row.auto_winner_detection,
      winnerVariantId: row.winner_variant_id,
      tags: JSON.parse(row.tags || '[]'),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      pausedAt: row.paused_at,
      completedAt: row.completed_at
    };
  }

  private formatVariant(row: any): any {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      variantId: row.variant_id,
      name: row.name,
      description: row.description,
      config: JSON.parse(row.config || '{}'),
      trafficAllocation: parseFloat(row.traffic_allocation),
      isControl: row.is_control,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private formatUserAssignment(row: any): any {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      variantId: row.variant_id,
      userId: row.user_id,
      sessionId: row.session_id,
      userType: row.user_type,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      assignedAt: row.assigned_at,
      firstExposureAt: row.first_exposure_at,
      customProperties: JSON.parse(row.custom_properties || '{}')
    };
  }

  private formatTimeSeriesData(rows: any[]): any[] {
    const groupedData = new Map();

    rows.forEach(row => {
      const hour = row.hour;
      if (!groupedData.has(hour)) {
        groupedData.set(hour, {
          timestamp: hour,
          hour: new Date(hour).toISOString(),
          variants: {}
        });
      }

      groupedData.get(hour).variants[row.variant_id] = {
        participants: parseInt(row.hourly_participants) || 0,
        conversions: parseInt(row.hourly_conversions) || 0,
        conversionRate: parseInt(row.hourly_participants) > 0 
          ? (parseInt(row.hourly_conversions) || 0) / parseInt(row.hourly_participants)
          : 0
      };
    });

    return Array.from(groupedData.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private async parseJsonBody(request: ABTestingRequest): Promise<any> {
    try {
      const text = await request.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
}

export default ABTestingHandler;