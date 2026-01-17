// A/B Testing Handler for Cloudflare Worker
import { WorkerDatabase } from '../services/worker-database';
import { ApiResponseBuilder } from '../utils/api-response';
import { rateLimiters, Sanitizer } from '../services/security-fix';

export interface ABTestingRequest {
  url: string;
  headers: Headers;
  text(): Promise<string>;
  json(): Promise<any>;
  user?: {
    id: number;
    userType: string;
    email: string;
  };
  params?: Record<string, string>;
  body?: any;
  ip?: string;
}

// Helper to log security events with proper structure
async function logABTestingEvent(
  db: WorkerDatabase,
  userId: number,
  event: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO security_audit_log (timestamp, user_id, action, resource, result, ip_address, user_agent, metadata, severity)
      VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      event,
      'ab_testing',
      'success',
      null,
      null,
      JSON.stringify(details),
      'info'
    ]);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
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
      const rateLimitAllowed = await rateLimiters.api.checkLimit(request.ip || 'unknown');
      if (!rateLimitAllowed) {
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
        Sanitizer.text(body.name),
        Sanitizer.text(body.description || ''),
        Sanitizer.text(body.hypothesis || ''),
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

      if (experimentResult.length === 0) {
        return ApiResponseBuilder.internalServerError('Failed to create experiment');
      }

      const experiment = experimentResult[0];

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
          Sanitizer.text(variant.name),
          Sanitizer.text(variant.description || ''),
          JSON.stringify(variant.config),
          variant.trafficAllocation,
          variant.isControl || false
        ]);
        variants.push(variantResult[0]);
      }

      await logABTestingEvent(
        this.db,
        request.user.id,
        'experiment_created',
        { experimentId: experiment.id, name: body.name }
      );

      return ApiResponseBuilder.success({
        experiment: this.formatExperiment(experiment),
        variants: variants.map(this.formatVariant)
      });

    } catch (error) {
      console.error('Error creating experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to create experiment');
    }
  }

  // Alias for listExperiments - used by routes
  async getExperiments(request: ABTestingRequest): Promise<Response> {
    return this.listExperiments(request);
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
      const total = parseInt(String(countResult[0]?.count || '0'));

      // Get experiments with pagination
      const orderColumn = ['created_at', 'updated_at', 'name'].includes(orderBy) ? orderBy : 'created_at';
      const direction = orderDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const experimentsResult = await this.db.query(`
        SELECT * FROM experiments ${whereClause}
        ORDER BY ${orderColumn} ${direction}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      const experiments = experimentsResult.map(this.formatExperiment);

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

      if (experimentResult.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      const variantsResult = await this.db.query(`
        SELECT * FROM experiment_variants WHERE experiment_id = $1 ORDER BY created_at
      `, [experimentId]);

      const experiment = this.formatExperiment(experimentResult[0]);
      const variants = variantsResult.map(this.formatVariant);

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

      if (experimentResult.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      const experiment = experimentResult[0];
      if (experiment.status !== 'draft') {
        return ApiResponseBuilder.badRequest('Only draft experiments can be started');
      }

      // Check variants exist
      const variantsResult = await this.db.query(`
        SELECT COUNT(*) as count FROM experiment_variants WHERE experiment_id = $1
      `, [experimentId]);

      if (parseInt(String(variantsResult[0]?.count || '0')) < 2) {
        return ApiResponseBuilder.badRequest('Experiment must have at least 2 variants');
      }

      // Start experiment
      await this.db.query(`
        UPDATE experiments 
        SET status = 'active', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [experimentId]);

      await logABTestingEvent(
        this.db,
        request.user.id,
        'experiment_started',
        { experimentId }
      );

      return ApiResponseBuilder.success({ message: 'Experiment started successfully' });

    } catch (error) {
      console.error('Error starting experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to start experiment');
    }
  }

  // Alias for pauseExperiment - used by routes as stopExperiment
  async stopExperiment(request: ABTestingRequest): Promise<Response> {
    return this.pauseExperiment(request);
  }

  // Update experiment
  async updateExperiment(request: ABTestingRequest): Promise<Response> {
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

      await this.db.query(`
        UPDATE experiments
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            hypothesis = COALESCE($4, hypothesis),
            primary_metric = COALESCE($5, primary_metric),
            traffic_allocation = COALESCE($6, traffic_allocation),
            updated_at = NOW()
        WHERE id = $1
      `, [
        experimentId,
        body.name,
        body.description,
        body.hypothesis,
        body.primaryMetric,
        body.trafficAllocation
      ]);

      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      await logABTestingEvent(
        this.db,
        request.user.id,
        'experiment_updated',
        { experimentId }
      );

      return ApiResponseBuilder.success({
        experiment: this.formatExperiment(experimentResult[0])
      });

    } catch (error) {
      console.error('Error updating experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to update experiment');
    }
  }

  // Delete experiment
  async deleteExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = parseInt(request.params?.id || '0');
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Invalid experiment ID');
      }

      // Admin authorization check
      if (!request.user || !['admin', 'super_admin'].includes(request.user.userType)) {
        return ApiResponseBuilder.unauthorized('Admin access required');
      }

      // Check if experiment exists
      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.length === 0) {
        return ApiResponseBuilder.notFound('Experiment not found');
      }

      // Only allow deletion of draft or archived experiments
      const experiment = experimentResult[0] as { status?: string };
      if (!['draft', 'archived'].includes(String(experiment.status || ''))) {
        return ApiResponseBuilder.badRequest('Only draft or archived experiments can be deleted');
      }

      // Delete variants first
      await this.db.query(`
        DELETE FROM experiment_variants WHERE experiment_id = $1
      `, [experimentId]);

      // Delete experiment
      await this.db.query(`
        DELETE FROM experiments WHERE id = $1
      `, [experimentId]);

      await logABTestingEvent(
        this.db,
        request.user.id,
        'experiment_deleted',
        { experimentId }
      );

      return ApiResponseBuilder.success({ message: 'Experiment deleted successfully' });

    } catch (error) {
      console.error('Error deleting experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to delete experiment');
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

      await logABTestingEvent(
        this.db,
        request.user.id,
        'experiment_paused',
        { experimentId, reason }
      );

      return ApiResponseBuilder.success({ message: 'Experiment paused successfully' });

    } catch (error) {
      console.error('Error pausing experiment:', error);
      return ApiResponseBuilder.internalServerError('Failed to pause experiment');
    }
  }

  // Alias for getAssignments - used by routes as getUserAssignment
  async getUserAssignment(request: ABTestingRequest): Promise<Response> {
    return this.getAssignments(request);
  }

  // Get experiment events
  async getExperimentEvents(request: ABTestingRequest): Promise<Response> {
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
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const eventType = url.searchParams.get('eventType');

      let query = `
        SELECT * FROM experiment_events
        WHERE experiment_id = $1
      `;
      const params: any[] = [experimentId];

      if (eventType) {
        query += ` AND event_type = $2`;
        params.push(eventType);
      }

      query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const eventsResult = await this.db.query(query, params);

      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*) as count FROM experiment_events WHERE experiment_id = $1
      `, [experimentId]);

      const totalCount = parseInt(String(countResult[0]?.count || '0'));
      return ApiResponseBuilder.success({
        events: eventsResult,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit
        }
      });

    } catch (error) {
      console.error('Error getting experiment events:', error);
      return ApiResponseBuilder.internalServerError('Failed to get experiment events');
    }
  }

  // Get user experiment assignments
  async getAssignments(request: ABTestingRequest): Promise<Response> {
    try {
      // Rate limiting
      const rateLimitAllowed = await rateLimiters.api.checkLimit(request.ip || 'unknown');
      if (!rateLimitAllowed) {
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
          `, [userContext.userId ?? null, userContext.sessionId ?? null]);

          assignments = assignmentsResult.map(this.formatUserAssignment);
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
      const trackingAllowed = await rateLimiters.api.checkLimit(request.ip || 'unknown');
      if (!trackingAllowed) {
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

      if (experimentResult.length === 0 || experimentResult[0].status !== 'active') {
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

      if (experimentResult.length === 0) {
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

      const variants = variantsResult.map((row: any) => {
        const participants = parseInt(String(row.participants || '0')) || 0;
        const conversions = parseInt(String(row.conversions || '0')) || 0;
        return {
          variantId: row.variant_id,
          variantName: row.variant_name,
          isControl: row.is_control,
          participants,
          conversions,
          conversionRate: participants > 0 ? conversions / participants : 0,
          revenue: parseFloat(String(row.total_revenue || '0')) || 0,
          averageOrderValue: parseFloat(String(row.avg_order_value || '0')) || 0
        };
      });

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
        experimentName: experimentResult[0].name,
        status: experimentResult[0].status,
        startDate: experimentResult[0].started_at,
        totalParticipants,
        totalConversions,
        overallConversionRate,
        variants,
        timeSeriesData: this.formatTimeSeriesData(timeSeriesResult),
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

      if (experimentResult.length === 0) {
        return null;
      }

      const experiment = experimentResult[0];

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
      `, [experimentId, userContext.userId ?? null, userContext.sessionId ?? null]);

      if (existingResult.length > 0) {
        return this.formatUserAssignment(existingResult[0]);
      }

      // Get experiment variants
      const variantsResult = await this.db.query(`
        SELECT * FROM experiment_variants WHERE experiment_id = $1 ORDER BY traffic_allocation DESC
      `, [experimentId]);

      if (variantsResult.length === 0) {
        return null;
      }

      // Assign to variant using deterministic hash
      const variantId = this.assignToVariant(identifier.toString(), variantsResult);

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
        userContext.userId ?? null,
        userContext.sessionId ?? null,
        userContext.userType ?? null,
        userContext.userAgent ?? null,
        userContext.ipAddress ?? null,
        JSON.stringify(userContext.customProperties || {})
      ]);

      return this.formatUserAssignment(assignmentResult[0]);

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
      sessionId: bodyContext?.sessionId || request.headers?.get('x-session-id') || undefined,
      userType: request.user?.userType,
      userAgent: request.headers?.get('user-agent') || undefined,
      ipAddress: request.ip || request.headers?.get('cf-connecting-ip') || undefined,
      referrer: request.headers?.get('referer') || undefined,
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

  // Additional methods to fix TypeScript errors

  async archiveExperiment(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = request.params?.id;
      if (!experimentId) {
        return ApiResponseBuilder.badRequest('Experiment ID required');
      }
      
      await this.db.query(
        'UPDATE experiments SET status = $1, archived_at = NOW() WHERE id = $2',
        ['archived', experimentId]
      );
      
      return ApiResponseBuilder.success({ 
        message: 'Experiment archived successfully' 
      });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to archive experiment');
    }
  }

  async assignUser(request: ABTestingRequest): Promise<Response> {
    try {
      const body = await this.parseJsonBody(request);
      const { userId, experimentId, variantId } = body;
      
      await this.db.query(
        'INSERT INTO experiment_assignments (user_id, experiment_id, variant_id) VALUES ($1, $2, $3)',
        [userId, experimentId, variantId]
      );
      
      return ApiResponseBuilder.success({ 
        assigned: true, 
        variantId 
      });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to assign user');
    }
  }

  async bulkAssignUsers(request: ABTestingRequest): Promise<Response> {
    try {
      const body = await this.parseJsonBody(request);
      const { assignments } = body;
      
      // Bulk insert with proper parameterization
      for (const assignment of assignments) {
        await this.db.query(
          'INSERT INTO experiment_assignments (user_id, experiment_id, variant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [assignment.userId, assignment.experimentId, assignment.variantId]
        );
      }
      
      return ApiResponseBuilder.success({ 
        assigned: assignments.length 
      });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to bulk assign users');
    }
  }

  async getAnalytics(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = request.params?.id ?? null;

      const analytics = await this.db.query(
        `SELECT variant_id, COUNT(*) as users,
                AVG(conversion_rate) as conversion_rate
         FROM experiment_results
         WHERE experiment_id = $1
         GROUP BY variant_id`,
        [experimentId]
      );

      return ApiResponseBuilder.success({ analytics });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to get analytics');
    }
  }

  async calculateResults(request: ABTestingRequest): Promise<Response> {
    try {
      const experimentId = request.params?.id ?? null;

      const results = await this.db.query(
        `SELECT variant_id,
                COUNT(*) as sample_size,
                AVG(metric_value) as mean,
                STDDEV(metric_value) as std_dev
         FROM experiment_metrics
         WHERE experiment_id = $1
         GROUP BY variant_id`,
        [experimentId]
      );

      return ApiResponseBuilder.success({
        results,
        winner: results[0]?.variant_id
      });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to calculate results');
    }
  }

  async getFeatureFlags(request: ABTestingRequest): Promise<Response> {
    try {
      const flags = await this.db.query(
        'SELECT * FROM feature_flags WHERE active = true ORDER BY created_at DESC'
      );
      
      return ApiResponseBuilder.success({ flags });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to get feature flags');
    }
  }

  async createFeatureFlag(request: ABTestingRequest): Promise<Response> {
    try {
      const body = await this.parseJsonBody(request);
      
      const flag = await this.db.query(
        `INSERT INTO feature_flags (name, description, enabled, rules, created_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [body.name, body.description, body.enabled || false, JSON.stringify(body.rules || {}), request.user?.id]
      );
      
      return ApiResponseBuilder.success({ flag: flag[0] });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to create feature flag');
    }
  }

  async getFeatureFlag(request: ABTestingRequest): Promise<Response> {
    try {
      const flagId = request.params?.id ?? null;

      const flag = await this.db.query(
        'SELECT * FROM feature_flags WHERE id = $1',
        [flagId]
      );

      if (flag.length === 0) {
        return ApiResponseBuilder.notFound('Feature flag not found');
      }

      return ApiResponseBuilder.success({ flag: flag[0] });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to get feature flag');
    }
  }

  async updateFeatureFlag(request: ABTestingRequest): Promise<Response> {
    try {
      const flagId = request.params?.id ?? null;
      const body = await this.parseJsonBody(request);

      const flag = await this.db.query(
        `UPDATE feature_flags
         SET name = $1, description = $2, enabled = $3, rules = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [body.name, body.description, body.enabled, JSON.stringify(body.rules || {}), flagId]
      );

      if (flag.length === 0) {
        return ApiResponseBuilder.notFound('Feature flag not found');
      }

      return ApiResponseBuilder.success({ flag: flag[0] });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to update feature flag');
    }
  }

  async deleteFeatureFlag(request: ABTestingRequest): Promise<Response> {
    try {
      const flagId = request.params?.id ?? null;

      await this.db.query(
        'DELETE FROM feature_flags WHERE id = $1',
        [flagId]
      );
      
      return ApiResponseBuilder.success({ 
        message: 'Feature flag deleted successfully' 
      });
    } catch (error) {
      return ApiResponseBuilder.internalServerError('Failed to delete feature flag');
    }
  }
}

export default ABTestingHandler;