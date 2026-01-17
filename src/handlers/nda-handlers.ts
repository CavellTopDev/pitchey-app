/**
 * Enhanced NDA Request Handlers
 * Integrates with the comprehensive NDA workflow service
 */

import { ApiResponseBuilder } from '../utils/api-response';
import { ErrorCode, errorHandler } from '../utils/errors';
import { NDAWorkflowService, NDARequestSchema, NDAApprovalSchema, NDARejectionSchema, NDASignatureSchema } from '../services/nda-workflow.service';
import { z } from 'zod';

/**
 * Handle NDA request creation
 */
export async function handleNDARequest(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  
  try {
    const data = await request.json() as Record<string, unknown>;
    const ndaService = new NDAWorkflowService(env);
    
    // Parse and validate request data
    const requestData = NDARequestSchema.parse({
      pitchId: data.pitchId,
      ndaType: data.ndaType || 'standard',
      requestMessage: data.message || data.requestMessage,
      requestedAccess: data.requestedAccess || 'standard',
      expirationDays: data.expiryDays || data.expirationDays || 90
    });
    
    // Create NDA request
    const result = await ndaService.requestNDA(authResult.user.id, requestData);
    
    if (!result.success) {
      return builder.error(ErrorCode.BAD_REQUEST, result.error);
    }
    
    return builder.success(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid request data', error.errors);
    }
    return errorHandler(error, request);
  }
}

/**
 * Handle NDA approval
 */
export async function handleNDAApproval(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const data = await request.json() as Record<string, unknown>;
    const ndaService = new NDAWorkflowService(env);
    
    // Parse and validate approval data
    const approvalData = NDAApprovalSchema.parse({
      requestId: parseInt(params.id),
      accessLevel: data.accessLevel,
      expirationDate: data.expirationDate,
      customTerms: data.customTerms,
      watermarkEnabled: data.watermarkEnabled !== false,
      downloadEnabled: data.downloadEnabled || false
    });
    
    // Approve NDA request
    const result = await ndaService.approveNDA(authResult.user.id, approvalData);
    
    if (!result.success) {
      return builder.error(ErrorCode.BAD_REQUEST, result.error);
    }
    
    return builder.success(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid approval data', error.errors);
    }
    return errorHandler(error, request);
  }
}

/**
 * Handle NDA rejection
 */
export async function handleNDARejection(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const data = await request.json() as Record<string, unknown>;
    const ndaService = new NDAWorkflowService(env);
    
    // Parse and validate rejection data
    const rejectionData = NDARejectionSchema.parse({
      requestId: parseInt(params.id),
      reason: data.reason,
      suggestAlternative: data.suggestAlternative || false
    });
    
    // Reject NDA request
    const result = await ndaService.rejectNDA(authResult.user.id, rejectionData);
    
    if (!result.success) {
      return builder.error(ErrorCode.BAD_REQUEST, result.error);
    }
    
    return builder.success(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid rejection data', error.errors);
    }
    return errorHandler(error, request);
  }
}

/**
 * Handle NDA signing
 */
export async function handleNDASignature(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const data = await request.json() as Record<string, unknown>;
    const ndaService = new NDAWorkflowService(env);
    
    // Get IP address from request headers
    const headers = new Headers(request.headers);
    const ipAddress = headers.get('CF-Connecting-IP') || 
                     headers.get('X-Forwarded-For') || 
                     '0.0.0.0';
    
    // Parse and validate signature data
    const signatureData = NDASignatureSchema.parse({
      ndaId: parseInt(params.id || data.ndaId),
      signature: data.signature,
      fullName: data.fullName,
      title: data.title,
      company: data.company,
      ipAddress: ipAddress,
      acceptTerms: data.acceptTerms
    });
    
    // Sign NDA
    const result = await ndaService.signNDA(authResult.user.id, signatureData);
    
    if (!result.success) {
      return builder.error(ErrorCode.BAD_REQUEST, result.error);
    }
    
    return builder.success(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid signature data', error.errors);
    }
    return errorHandler(error, request);
  }
}

/**
 * Handle NDA revocation
 */
export async function handleNDARevocation(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const data = await request.json() as Record<string, unknown>;
    const ndaService = new NDAWorkflowService(env);
    
    // Revoke NDA
    const result = await ndaService.revokeNDA(
      authResult.user.id,
      parseInt(params.id),
      data.reason || 'No reason provided'
    );
    
    if (!result.success) {
      return builder.error(ErrorCode.BAD_REQUEST, result.error);
    }
    
    return builder.success(result.data);
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get NDA status for a pitch
 */
export async function handleNDAStatus(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const pitchId = parseInt(params.pitchId);
    const ndaService = new NDAWorkflowService(env);
    
    // Check if user has NDA access
    const hasAccess = await ndaService.hasNDAAccess(pitchId, authResult.user.id);
    
    // Get NDA details if exists
    const db = env.db;
    const [nda] = await db.query(`
      SELECT n.*, nr.status as request_status
      FROM ndas n
      LEFT JOIN nda_requests nr ON nr.pitch_id = n.pitch_id AND nr.requester_id = n.signer_id
      WHERE n.pitch_id = $1 AND n.signer_id = $2
      ORDER BY n.created_at DESC
      LIMIT 1
    `, [pitchId, authResult.user.id]);
    
    return builder.success({
      hasNDA: !!nda,
      nda: nda || null,
      canAccess: hasAccess,
      status: nda?.status || null,
      requestStatus: nda?.request_status || null
    });
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Check if user can request NDA for a pitch
 */
export async function handleCanRequestNDA(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const pitchId = parseInt(params.pitchId);
    const db = env.db;
    
    // Check for existing NDA or request
    const [existing] = await db.query(`
      SELECT 
        CASE 
          WHEN n.id IS NOT NULL THEN 'has_nda'
          WHEN nr.id IS NOT NULL THEN 'has_request'
          ELSE NULL
        END as status,
        n.status as nda_status,
        nr.status as request_status
      FROM pitches p
      LEFT JOIN ndas n ON n.pitch_id = p.id AND n.signer_id = $2
      LEFT JOIN nda_requests nr ON nr.pitch_id = p.id AND nr.requester_id = $2
      WHERE p.id = $1
    `, [pitchId, authResult.user.id]);
    
    if (!existing) {
      return builder.success({
        canRequest: true,
        reason: null,
        existingNDA: null
      });
    }
    
    if (existing.status === 'has_nda') {
      return builder.success({
        canRequest: false,
        reason: `You already have an NDA (status: ${existing.nda_status})`,
        existingNDA: existing
      });
    }
    
    if (existing.status === 'has_request') {
      return builder.success({
        canRequest: false,
        reason: `You have a pending NDA request (status: ${existing.request_status})`,
        existingNDA: existing
      });
    }
    
    return builder.success({
      canRequest: true,
      reason: null,
      existingNDA: null
    });
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get NDA audit trail
 */
export async function handleNDAAuditTrail(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const params = (request as any).params;
  
  try {
    const ndaId = parseInt(params.id);
    const ndaService = new NDAWorkflowService(env);
    
    // Get audit trail
    const auditTrail = await ndaService.getNDAAuditTrail(ndaId, authResult.user.id);
    
    return builder.success({ auditTrail });
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get NDA statistics
 */
export async function handleNDAStatistics(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  
  try {
    const ndaService = new NDAWorkflowService(env);
    
    // Determine user role
    const userRole = authResult.user.role || 'investor';
    const role = userRole === 'creator' ? 'creator' : 'investor';
    
    // Get statistics
    const stats = await ndaService.getNDAStatistics(authResult.user.id, role);
    
    return builder.success(stats);
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get creator NDA requests
 */
export async function handleCreatorNDARequests(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  
  try {
    const ndaService = new NDAWorkflowService(env);
    
    // Get creator's NDA requests
    const requests = await ndaService.getCreatorNDARequests(authResult.user.id, status);
    
    return builder.success({ requests });
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get investor NDA requests
 */
export async function handleInvestorNDARequests(request: Request, env: any, authResult: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  
  try {
    const ndaService = new NDAWorkflowService(env);
    
    // Get investor's NDA requests
    const requests = await ndaService.getInvestorNDARequests(authResult.user.id, status);
    
    return builder.success({ requests });
  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Expire NDAs (scheduled job)
 */
export async function handleExpireNDAs(request: Request, env: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  
  try {
    // Verify this is an internal request or admin request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('internal-scheduler')) {
      return builder.error(ErrorCode.UNAUTHORIZED, 'Unauthorized');
    }
    
    const ndaService = new NDAWorkflowService(env);
    
    // Check and expire NDAs
    await ndaService.checkAndExpireNDAs();
    
    return builder.success({ message: 'NDA expiration check completed' });
  } catch (error) {
    return errorHandler(error, request);
  }
}