/**
 * Validated API Endpoints using Contract Schemas
 * Critical endpoints with proper validation and error handling
 */

import { ValidatedRoute } from '../middleware/contract-validator';
import { 
  LoginRequestSchema,
  CreatePitchSchema,
  NDARequestSchema,
  UserSchema,
  PitchSchema,
  NDASchema,
  ApiSuccessSchema
} from '../shared/contracts';
import * as Sentry from '@sentry/cloudflare';
import { verifyAuth } from '../utils/auth';

// ============= AUTH ENDPOINTS =============

/**
 * Login endpoint with validation
 * POST /api/auth/sign-in
 */
export const validatedLoginRoute = ValidatedRoute.post('/api/auth/sign-in', {
  bodySchema: LoginRequestSchema,
  responseSchema: ApiSuccessSchema(UserSchema),
  handler: async ({ body, request, env }) => {
    if (!body) {
      throw new Error('Request body is required');
    }

    Sentry.addBreadcrumb({
      message: `Login attempt for ${body.email}`,
      category: 'auth',
      data: { userType: body.userType }
    });

    try {
      // Validate email format more strictly
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        throw new Error('Invalid email format');
      }

      // Validate password strength
      if (body.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Mock authentication logic - in real implementation, check database
      const mockUser = {
        id: 1,
        email: body.email,
        name: 'Test User',
        userType: body.userType || 'creator',
        avatarUrl: null,
        bio: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verified: true
      };

      // Track successful login
      Sentry.addBreadcrumb({
        message: `Login successful for ${body.email}`,
        category: 'auth',
        level: 'info'
      });

      return mockUser;

    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          endpoint: 'login',
          email: body.email
        }
      });
      throw error;
    }
  }
});

// ============= PITCH ENDPOINTS =============

/**
 * Create pitch endpoint with validation
 * POST /api/pitches
 */
export const validatedCreatePitchRoute = ValidatedRoute.post('/api/pitches', {
  bodySchema: CreatePitchSchema,
  responseSchema: ApiSuccessSchema(PitchSchema),
  handler: async ({ body, request, env }) => {
    if (!body) {
      throw new Error('Request body is required');
    }

    // Check authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      throw new Error('Authentication required');
    }

    Sentry.addBreadcrumb({
      message: `Create pitch attempt: ${body.title}`,
      category: 'pitch',
      data: { genre: body.genre, format: body.format }
    });

    try {
      // Validate title length
      if (body.title.trim().length < 3) {
        throw new Error('Title must be at least 3 characters');
      }

      // Validate logline
      if (body.logline && body.logline.length > 500) {
        throw new Error('Logline must not exceed 500 characters');
      }

      // Validate budget if provided
      if (body.budget && body.budget < 0) {
        throw new Error('Budget must be a positive number');
      }

      // Validate tags
      if (body.tags && body.tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }

      // Mock pitch creation - in real implementation, save to database
      const newPitch = {
        id: Math.floor(Math.random() * 10000),
        title: body.title,
        logline: body.logline || '',
        synopsis: body.synopsis,
        genre: body.genre,
        format: body.format || 'Film',
        budget: body.budget,
        status: body.status || 'draft',
        creatorId: authResult.user.id,
        tags: body.tags || [],
        attachments: body.attachments || [],
        viewCount: 0,
        likeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      Sentry.addBreadcrumb({
        message: `Pitch created successfully: ${newPitch.id}`,
        category: 'pitch',
        level: 'info'
      });

      return newPitch;

    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          endpoint: 'create-pitch',
          userId: authResult?.user?.id
        },
        extra: { pitchData: body }
      });
      throw error;
    }
  }
});

// ============= NDA ENDPOINTS =============

/**
 * Request NDA endpoint with validation
 * POST /api/pitches/:pitchId/nda
 */
export const validatedNDARequestRoute = ValidatedRoute.post('/api/pitches/:pitchId/nda', {
  bodySchema: NDARequestSchema,
  responseSchema: ApiSuccessSchema(NDASchema),
  handler: async ({ body, request, env }) => {
    if (!body) {
      throw new Error('Request body is required');
    }

    // Check authentication
    const authResult = await verifyAuth(request, env);
    if (!authResult.success || !authResult.user) {
      throw new Error('Authentication required');
    }

    // Extract pitchId from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const pitchIdIndex = pathSegments.findIndex(segment => segment === 'pitches') + 1;
    const pitchId = parseInt(pathSegments[pitchIdIndex]);

    if (!pitchId || isNaN(pitchId)) {
      throw new Error('Invalid pitch ID');
    }

    Sentry.addBreadcrumb({
      message: `NDA request for pitch ${pitchId}`,
      category: 'nda',
      data: { 
        pitchId,
        ndaType: body.ndaType,
        requesterId: authResult.user.id
      }
    });

    try {
      // Validate pitch ID matches body
      if (body.pitchId && body.pitchId !== pitchId) {
        throw new Error('Pitch ID mismatch between URL and body');
      }

      // Validate company info for enhanced/custom NDAs
      if (body.ndaType !== 'basic' && !body.companyInfo?.name) {
        throw new Error('Company information required for enhanced/custom NDAs');
      }

      // Validate request message length
      if (body.requestMessage && body.requestMessage.length > 1000) {
        throw new Error('Request message must not exceed 1000 characters');
      }

      // Mock NDA creation - in real implementation, save to database
      const newNDA = {
        id: Math.floor(Math.random() * 10000),
        pitchId: pitchId,
        requesterId: authResult.user.id,
        creatorId: Math.floor(Math.random() * 1000), // Mock creator ID
        status: 'pending' as const,
        ndaType: body.ndaType || 'basic',
        signedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        documentUrl: null,
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      Sentry.addBreadcrumb({
        message: `NDA request created successfully: ${newNDA.id}`,
        category: 'nda',
        level: 'info'
      });

      return newNDA;

    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          endpoint: 'request-nda',
          pitchId: pitchId.toString(),
          userId: authResult?.user?.id
        },
        extra: { ndaRequest: body }
      });
      throw error;
    }
  }
});

// ============= ROUTE REGISTRY =============

export const validatedRoutes = [
  // Note: All validated routes removed - they were mock stubs that intercepted
  // real handlers in worker-integrated.ts and never persisted data to the database.
  // Auth is handled by worker-integrated.ts with proper session management.
];

/**
 * Route matcher for validated endpoints
 */
export function matchValidatedRoute(method: string, pathname: string) {
  console.log(`[DEBUG] Checking validated route: ${method} ${pathname}`);
  
  for (const route of validatedRoutes) {
    // Simple pattern matching for :param syntax
    const routePattern = route.path.replace(/:(\w+)/g, '([^/]+)');
    const regex = new RegExp(`^${routePattern}$`);
    
    console.log(`[DEBUG] Testing against route: ${route.method} ${route.path} -> ${routePattern}`);
    
    if (route.method === method && regex.test(pathname)) {
      console.log(`[DEBUG] Matched validated route: ${route.path}`);
      return route;
    }
  }
  
  console.log(`[DEBUG] No validated route matched`);
  return null;
}