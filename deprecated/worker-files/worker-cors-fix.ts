/**
 * CORS and Endpoint Fix Worker
 * This worker adds missing endpoint aliases and fixes CORS issues
 * Import this into worker-production-db.ts to fix the issues
 */

export function addEndpointAliases(
  path: string,
  method: string,
  request: Request,
  handler: any
): Response | null {
  // Add alias for saved-pitches endpoint
  if (path === '/api/saved-pitches' && method === 'GET') {
    // Redirect to the correct endpoint
    const url = new URL(request.url);
    url.pathname = '/api/user/saved-pitches';
    return handler(new Request(url.toString(), request), path.replace('/api/saved-pitches', '/api/user/saved-pitches'));
  }

  // Add alias for browse enhanced endpoint (without /pitches prefix)
  if (path === '/api/browse/enhanced' && method === 'GET') {
    const url = new URL(request.url);
    url.pathname = '/api/pitches/browse/enhanced';
    return handler(new Request(url.toString(), request), path.replace('/api/browse/enhanced', '/api/pitches/browse/enhanced'));
  }

  return null;
}

// Enhanced CORS headers with better origin handling
export function getEnhancedCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  
  // Expanded list of allowed origins
  const allowedOrigins = [
    'https://pitchey-5o8.pages.dev',
    'http://localhost:5173',
    'http://localhost:5174', 
    'http://localhost:3000',
    'http://localhost:8001'
  ];
  
  // Check if origin matches allowed list or is a Cloudflare Pages subdomain
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.match(/^https:\/\/[a-z0-9]+\.pitchey\.pages\.dev$/);
  
  // Always return proper CORS headers for allowed origins
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie',
      'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
    };
  }
  
  // For non-credentialed requests from other origins
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400'
  };
}

// Preflight handler for OPTIONS requests
export function handlePreflight(request: Request): Response {
  const headers = getEnhancedCorsHeaders(request);
  return new Response(null, {
    status: 204,
    headers
  });
}

// Fix for missing endpoints - add these handlers to worker-production-db.ts
export const missingEndpointHandlers = {
  // Enhanced browse without /pitches prefix (for backward compatibility)
  '/api/browse/enhanced': {
    redirect: '/api/pitches/browse/enhanced'
  },
  
  // Saved pitches alias
  '/api/saved-pitches': {
    redirect: '/api/user/saved-pitches'
  },
  
  // Additional aliases that might be needed
  '/api/investor/saved-pitches': {
    redirect: '/api/user/saved-pitches'
  }
};