/**
 * GDPR API Handlers
 * Implements API endpoints for GDPR compliance and data subject rights
 */

import { Hono } from 'hono';
import { DataSubjectRightsService } from '../gdpr/data-subject-rights.ts';
import { ConsentManagementService } from '../gdpr/consent-management.ts';

const gdpr = new Hono();
const dataRightsService = new DataSubjectRightsService();
const consentService = new ConsentManagementService();

// Data Subject Rights Endpoints

/**
 * Submit data access request (Right to Access)
 * POST /api/gdpr/requests/access
 */
gdpr.post('/requests/access', async (c) => {
  try {
    const body = await c.req.json();
    const { description } = body;
    const userId = c.get('userId'); // From auth middleware

    if (!description) {
      return c.json({ error: 'Description is required' }, 400);
    }

    const requestId = await dataRightsService.handleAccessRequest(userId, description);
    
    return c.json({
      success: true,
      requestId,
      message: 'Access request submitted successfully. You will receive your data within 30 days.'
    });
  } catch (error) {
    console.error('Error handling access request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Submit data rectification request (Right to Rectification)
 * POST /api/gdpr/requests/rectification
 */
gdpr.post('/requests/rectification', async (c) => {
  try {
    const body = await c.req.json();
    const { corrections, description } = body;
    const userId = c.get('userId');

    if (!corrections || !description) {
      return c.json({ error: 'Corrections and description are required' }, 400);
    }

    const requestId = await dataRightsService.handleRectificationRequest(
      userId,
      corrections,
      description
    );
    
    return c.json({
      success: true,
      requestId,
      message: 'Rectification request submitted successfully.'
    });
  } catch (error) {
    console.error('Error handling rectification request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Submit data erasure request (Right to be Forgotten)
 * POST /api/gdpr/requests/erasure
 */
gdpr.post('/requests/erasure', async (c) => {
  try {
    const body = await c.req.json();
    const { description, specificData } = body;
    const userId = c.get('userId');

    if (!description) {
      return c.json({ error: 'Description is required' }, 400);
    }

    const requestId = await dataRightsService.handleErasureRequest(
      userId,
      description,
      specificData
    );
    
    return c.json({
      success: true,
      requestId,
      message: 'Erasure request submitted successfully. We will process your request within 30 days.'
    });
  } catch (error) {
    console.error('Error handling erasure request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Submit data portability request
 * POST /api/gdpr/requests/portability
 */
gdpr.post('/requests/portability', async (c) => {
  try {
    const body = await c.req.json();
    const { description, destinationProvider } = body;
    const userId = c.get('userId');

    if (!description) {
      return c.json({ error: 'Description is required' }, 400);
    }

    const requestId = await dataRightsService.handlePortabilityRequest(
      userId,
      description,
      destinationProvider
    );
    
    return c.json({
      success: true,
      requestId,
      message: 'Portability request submitted successfully.'
    });
  } catch (error) {
    console.error('Error handling portability request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Submit processing restriction request
 * POST /api/gdpr/requests/restriction
 */
gdpr.post('/requests/restriction', async (c) => {
  try {
    const body = await c.req.json();
    const { description, restrictionType } = body;
    const userId = c.get('userId');

    if (!description || !restrictionType) {
      return c.json({ error: 'Description and restriction type are required' }, 400);
    }

    const requestId = await dataRightsService.handleRestrictionRequest(
      userId,
      description,
      restrictionType
    );
    
    return c.json({
      success: true,
      requestId,
      message: 'Restriction request submitted successfully.'
    });
  } catch (error) {
    console.error('Error handling restriction request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Submit objection to processing request
 * POST /api/gdpr/requests/objection
 */
gdpr.post('/requests/objection', async (c) => {
  try {
    const body = await c.req.json();
    const { description, processingCategories } = body;
    const userId = c.get('userId');

    if (!description || !processingCategories) {
      return c.json({ error: 'Description and processing categories are required' }, 400);
    }

    const requestId = await dataRightsService.handleObjectionRequest(
      userId,
      description,
      processingCategories
    );
    
    return c.json({
      success: true,
      requestId,
      message: 'Objection request submitted successfully.'
    });
  } catch (error) {
    console.error('Error handling objection request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get request status
 * GET /api/gdpr/requests/:requestId
 */
gdpr.get('/requests/:requestId', async (c) => {
  try {
    const requestId = c.req.param('requestId');
    const userId = c.get('userId');

    const request = await dataRightsService.getRequestStatus(requestId);
    
    if (!request) {
      return c.json({ error: 'Request not found' }, 404);
    }

    // Verify request belongs to user
    if (request.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ request });
  } catch (error) {
    console.error('Error getting request status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * List user's data subject requests
 * GET /api/gdpr/requests
 */
gdpr.get('/requests', async (c) => {
  try {
    const userId = c.get('userId');
    const requests = await dataRightsService.getUserRequests(userId);
    
    return c.json({ requests });
  } catch (error) {
    console.error('Error listing user requests:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Consent Management Endpoints

/**
 * Update consent preferences
 * POST /api/gdpr/consent
 */
gdpr.post('/consent', async (c) => {
  try {
    const body = await c.req.json();
    const { consents, source = 'api' } = body;
    const userId = c.get('userId');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    if (!consents) {
      return c.json({ error: 'Consents object is required' }, 400);
    }

    await consentService.updateConsent(userId, consents, source, ipAddress, userAgent);
    
    return c.json({
      success: true,
      message: 'Consent preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating consent:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get current consent status
 * GET /api/gdpr/consent
 */
gdpr.get('/consent', async (c) => {
  try {
    const userId = c.get('userId');
    const consents = await consentService.getUserConsent(userId);
    
    return c.json({ consents });
  } catch (error) {
    console.error('Error getting consent status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Withdraw specific consent
 * DELETE /api/gdpr/consent/:consentType
 */
gdpr.delete('/consent/:consentType', async (c) => {
  try {
    const consentType = c.req.param('consentType');
    const userId = c.get('userId');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    await consentService.withdrawConsent(userId, consentType, ipAddress, userAgent);
    
    return c.json({
      success: true,
      message: `${consentType} consent withdrawn successfully`
    });
  } catch (error) {
    console.error('Error withdrawing consent:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get consent banner configuration
 * GET /api/gdpr/consent/banner
 */
gdpr.get('/consent/banner', async (c) => {
  try {
    const userId = c.get('userId'); // May be undefined for anonymous users
    const bannerData = await consentService.getConsentBannerData(userId);
    
    return c.json(bannerData);
  } catch (error) {
    console.error('Error getting banner data:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Handle anonymous user consent (pre-login)
 * POST /api/gdpr/consent/anonymous
 */
gdpr.post('/consent/anonymous', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, consents } = body;
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    if (!sessionId || !consents) {
      return c.json({ error: 'Session ID and consents are required' }, 400);
    }

    await consentService.handleAnonymousConsent(sessionId, consents, ipAddress, userAgent);
    
    return c.json({
      success: true,
      message: 'Anonymous consent preferences saved'
    });
  } catch (error) {
    console.error('Error handling anonymous consent:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Export consent history for data subject access request
 * GET /api/gdpr/consent/export
 */
gdpr.get('/consent/export', async (c) => {
  try {
    const userId = c.get('userId');
    const consentHistory = await consentService.exportConsentHistory(userId);
    
    return c.json(consentHistory);
  } catch (error) {
    console.error('Error exporting consent history:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Administrative Endpoints (require admin role)

/**
 * Get GDPR compliance metrics
 * GET /api/gdpr/metrics
 */
gdpr.get('/metrics', async (c) => {
  try {
    // Verify admin role
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Mock implementation - replace with actual metrics calculation
    const metrics = {
      totalRequests: 42,
      pendingRequests: 3,
      completedRequests: 35,
      averageResponseTime: 18,
      complianceScore: 94,
      riskLevel: 'low'
    };
    
    return c.json(metrics);
  } catch (error) {
    console.error('Error getting compliance metrics:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get all data subject requests (admin)
 * GET /api/gdpr/admin/requests
 */
gdpr.get('/admin/requests', async (c) => {
  try {
    // Verify admin role
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Mock implementation - replace with actual data fetch
    const requests = [
      {
        id: 'req_001',
        userId: 'user_123',
        userEmail: 'user@example.com',
        requestType: 'access',
        status: 'pending',
        requestDate: new Date(),
        description: 'Request for personal data access',
        priority: 'medium'
      }
    ];
    
    return c.json(requests);
  } catch (error) {
    console.error('Error getting admin requests:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get consent metrics (admin)
 * GET /api/gdpr/consent-metrics
 */
gdpr.get('/consent-metrics', async (c) => {
  try {
    // Verify admin role
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const report = await consentService.generateComplianceReport({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      to: new Date()
    });

    // Mock implementation for demonstration
    const consentMetrics = {
      totalUsers: 1250,
      consentRates: {
        functional: 75,
        analytics: 60,
        marketing: 35
      },
      withdrawalRates: {
        functional: 5,
        analytics: 8,
        marketing: 15
      }
    };
    
    return c.json(consentMetrics);
  } catch (error) {
    console.error('Error getting consent metrics:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Generate compliance report
 * POST /api/gdpr/reports/generate
 */
gdpr.post('/reports/generate', async (c) => {
  try {
    // Verify admin role
    const userRole = c.get('userRole');
    if (userRole !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const body = await c.req.json();
    const { reportType, dateRange } = body;

    // Generate report based on type
    let reportData;
    switch (reportType) {
      case 'compliance':
        reportData = await generateComplianceReport(dateRange);
        break;
      case 'consent':
        reportData = await generateConsentReport(dateRange);
        break;
      case 'requests':
        reportData = await generateRequestsReport(dateRange);
        break;
      default:
        return c.json({ error: 'Invalid report type' }, 400);
    }
    
    return c.json({
      success: true,
      reportId: `report_${Date.now()}`,
      downloadUrl: `/api/gdpr/reports/download/${reportData.id}`,
      message: 'Report generated successfully'
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Utility functions (implementations would be more detailed)
async function generateComplianceReport(dateRange: any) {
  return { id: `comp_${Date.now()}`, type: 'compliance', dateRange };
}

async function generateConsentReport(dateRange: any) {
  return { id: `cons_${Date.now()}`, type: 'consent', dateRange };
}

async function generateRequestsReport(dateRange: any) {
  return { id: `req_${Date.now()}`, type: 'requests', dateRange };
}

export { gdpr };