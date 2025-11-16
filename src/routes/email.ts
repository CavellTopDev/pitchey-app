/**
 * Email Management Routes - Tracking, Unsubscribe, and Analytics
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { getEmailTrackingService } from "../services/email/tracking-service.ts";
import { getEmailUnsubscribeService } from "../services/email/unsubscribe-service.ts";
import { getEmailQueueService } from "../services/email/queue-service.ts";

/**
 * Track email opens via 1x1 pixel
 * GET /api/email/track/open?e=emailId&r=base64email&t=timestamp
 */
export const trackEmailOpen: RouteHandler = async (request, url) => {
  try {
    const emailId = url.searchParams.get('e');
    const recipientEmailEncoded = url.searchParams.get('r');
    const userAgent = request.headers.get('User-Agent') || '';
    const ipAddress = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    if (!emailId || !recipientEmailEncoded) {
      // Return a 1x1 transparent pixel even for invalid requests
      return new Response(new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 
        0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 
        0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 
        0x04, 0x01, 0x00, 0x3B
      ]), {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...getCorsHeaders()
        }
      });
    }

    try {
      const recipientEmail = atob(recipientEmailEncoded);
      const trackingService = getEmailTrackingService();
      await trackingService.trackOpen(emailId, recipientEmail, userAgent, ipAddress);
    } catch (trackingError) {
      telemetry.logger.error("Failed to track email open", trackingError);
    }

    // Return 1x1 transparent GIF
    return new Response(new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 
      0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 
      0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 
      0x04, 0x01, 0x00, 0x3B
    ]), {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...getCorsHeaders()
      }
    });

  } catch (error) {
    telemetry.logger.error("Email tracking error", error);
    // Always return a pixel, even on error
    return new Response(new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 
      0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 
      0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 
      0x04, 0x01, 0x00, 0x3B
    ]), {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...getCorsHeaders()
      }
    });
  }
};

/**
 * Track email clicks and redirect to target URL
 * GET /api/email/track/click?e=emailId&r=base64email&u=base64url&p=position&t=timestamp
 */
export const trackEmailClick: RouteHandler = async (request, url) => {
  try {
    const emailId = url.searchParams.get('e');
    const recipientEmailEncoded = url.searchParams.get('r');
    const targetUrlEncoded = url.searchParams.get('u');
    const position = url.searchParams.get('p');
    const userAgent = request.headers.get('User-Agent') || '';
    const ipAddress = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    if (!emailId || !recipientEmailEncoded || !targetUrlEncoded) {
      return errorResponse("Missing required parameters", 400);
    }

    let targetUrl: string;
    let recipientEmail: string;

    try {
      targetUrl = atob(targetUrlEncoded);
      recipientEmail = atob(recipientEmailEncoded);
    } catch (error) {
      return errorResponse("Invalid encoded parameters", 400);
    }

    // Track the click (don't await to avoid slowing down redirect)
    const trackingService = getEmailTrackingService();
    trackingService.trackClick(
      emailId, 
      recipientEmail, 
      targetUrl, 
      undefined, 
      position ? parseInt(position) : undefined,
      userAgent, 
      ipAddress
    ).catch(trackingError => {
      telemetry.logger.error("Failed to track email click", trackingError);
    });

    // Redirect to target URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': targetUrl,
        'Cache-Control': 'no-cache',
        ...getCorsHeaders()
      }
    });

  } catch (error) {
    telemetry.logger.error("Email click tracking error", error);
    return errorResponse("Click tracking failed", 500);
  }
};

/**
 * Process unsubscribe requests
 * GET /api/email/unsubscribe?token=unsubscribeToken&category=optional
 * POST /api/email/unsubscribe (with token and optional reason in body)
 */
export const processUnsubscribe: RouteHandler = async (request, url) => {
  try {
    const unsubscribeService = getEmailUnsubscribeService();
    let token: string;
    let category: string | undefined;
    let reason: string | undefined;
    
    if (request.method === 'GET') {
      token = url.searchParams.get('token') || '';
      category = url.searchParams.get('category') || undefined;
    } else {
      const body = await request.json();
      token = body.token || '';
      category = body.category || undefined;
      reason = body.reason || undefined;
    }

    if (!token) {
      return errorResponse("Unsubscribe token is required", 400);
    }

    const userAgent = request.headers.get('User-Agent') || '';
    const ipAddress = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    const result = await unsubscribeService.processUnsubscribe(
      token, 
      category, 
      reason, 
      userAgent, 
      ipAddress
    );

    if (request.method === 'GET') {
      // For GET requests, redirect to a confirmation page
      const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://pitchey.pages.dev';
      const status = result.success ? 'success' : 'error';
      const message = encodeURIComponent(result.message);
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${baseUrl}/unsubscribe-confirm?status=${status}&message=${message}`,
          ...getCorsHeaders()
        }
      });
    } else {
      // For POST requests, return JSON response
      return successResponse(result);
    }

  } catch (error) {
    telemetry.logger.error("Unsubscribe processing error", error);
    return errorResponse("Failed to process unsubscribe request", 500);
  }
};

/**
 * Get email analytics for admin dashboard
 * GET /api/email/analytics/dashboard
 */
export const getEmailAnalyticsDashboard: RouteHandler = async (request, url) => {
  try {
    // TODO: Add admin authentication check here
    
    const trackingService = getEmailTrackingService();
    const queueService = getEmailQueueService();
    const unsubscribeService = getEmailUnsubscribeService();

    const [dashboardMetrics, queueStats, unsubscribeStats] = await Promise.all([
      trackingService.getDashboardMetrics(),
      queueService.getStats(),
      unsubscribeService.getUnsubscribeStats(30)
    ]);

    return successResponse({
      tracking: dashboardMetrics,
      queue: queueStats,
      unsubscribes: unsubscribeStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Email analytics dashboard error", error);
    return errorResponse("Failed to get email analytics", 500);
  }
};

/**
 * Get analytics for a specific email
 * GET /api/email/analytics/:emailId
 */
export const getEmailAnalytics: RouteHandler = async (request, url, params) => {
  try {
    // TODO: Add authentication and authorization check here
    
    const emailId = params?.emailId;
    if (!emailId) {
      return errorResponse("Email ID is required", 400);
    }

    const trackingService = getEmailTrackingService();
    const analytics = await trackingService.getEmailAnalytics(emailId);

    return successResponse(analytics);

  } catch (error) {
    telemetry.logger.error("Email analytics error", error);
    return errorResponse("Failed to get email analytics", 500);
  }
};

/**
 * Get user's email preferences
 * GET /api/email/preferences
 */
export const getEmailPreferences: RouteHandler = async (request, url) => {
  try {
    // TODO: Add user authentication and extract userId from token
    
    const userId = "1"; // Replace with actual user ID from auth token
    
    const unsubscribeService = getEmailUnsubscribeService();
    const preferences = await unsubscribeService.getPreferences(userId);

    if (!preferences) {
      return errorResponse("Email preferences not found", 404);
    }

    // Don't return the unsubscribe token for security
    const { unsubscribeToken, ...safePreferences } = preferences;

    return successResponse(safePreferences);

  } catch (error) {
    telemetry.logger.error("Get email preferences error", error);
    return errorResponse("Failed to get email preferences", 500);
  }
};

/**
 * Update user's email preferences
 * PUT /api/email/preferences
 */
export const updateEmailPreferences: RouteHandler = async (request, url) => {
  try {
    // TODO: Add user authentication and extract userId from token
    
    const userId = "1"; // Replace with actual user ID from auth token
    const updates = await request.json();
    
    const unsubscribeService = getEmailUnsubscribeService();
    const currentPreferences = await unsubscribeService.getPreferences(userId);
    
    if (!currentPreferences) {
      return errorResponse("Email preferences not found", 404);
    }

    // Update only allowed fields
    const allowedUpdates = {
      subscriptions: updates.subscriptions,
      frequency: updates.frequency,
      timezone: updates.timezone,
      language: updates.language
    };

    // Ensure security emails can't be disabled
    if (allowedUpdates.subscriptions) {
      allowedUpdates.subscriptions.password_reset = true;
      allowedUpdates.subscriptions.payment_confirmations = true;
    }

    const updatedPreferences = {
      ...currentPreferences,
      ...allowedUpdates
    };

    await unsubscribeService.updatePreferences(updatedPreferences);

    return successResponse({
      message: "Email preferences updated successfully",
      preferences: updatedPreferences
    });

  } catch (error) {
    telemetry.logger.error("Update email preferences error", error);
    return errorResponse("Failed to update email preferences", 500);
  }
};

/**
 * Health check for email services
 * GET /api/email/health
 */
export const emailHealthCheck: RouteHandler = async (request, url) => {
  try {
    const queueService = getEmailQueueService();
    const queueStats = await queueService.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queue: {
        pending: queueStats.pending,
        processing: queueStats.processing,
        failed: queueStats.failed,
        healthy: queueStats.failed < 100 // Arbitrary threshold
      },
      services: {
        tracking: 'healthy',
        unsubscribe: 'healthy',
        templates: 'healthy'
      }
    };

    // Determine overall health
    if (queueStats.failed > 100 || queueStats.pending > 1000) {
      health.status = 'degraded';
    }

    return successResponse(health);

  } catch (error) {
    telemetry.logger.error("Email health check error", error);
    return errorResponse({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
};