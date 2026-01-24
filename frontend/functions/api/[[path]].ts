/**
 * Cloudflare Pages Function - API Proxy
 *
 * This proxy makes all API calls same-origin, which:
 * 1. Eliminates cross-origin cookie issues
 * 2. Removes need for SameSite=None; Secure
 * 3. Simplifies authentication - cookies "just work"
 * 4. No more CORS headers needed for auth endpoints
 *
 * Frontend calls: /api/auth/login
 * This proxies to: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/login
 */

interface Env {
  // The backend Worker URL - can be configured per environment
  API_BACKEND_URL?: string;
}

// Default backend URL
const DEFAULT_BACKEND_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;

  // Get the path segments after /api/
  const pathSegments = params.path as string[];
  const apiPath = pathSegments ? pathSegments.join('/') : '';

  // Build the backend URL
  const backendUrl = env.API_BACKEND_URL || DEFAULT_BACKEND_URL;
  const url = new URL(request.url);
  const targetUrl = `${backendUrl}/api/${apiPath}${url.search}`;

  console.log(`[API Proxy] ${request.method} /api/${apiPath} -> ${targetUrl}`);

  try {
    // Clone the request with the new URL
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual', // Handle redirects manually to preserve cookies
    });

    // Remove host header (will be set by fetch)
    proxyRequest.headers.delete('host');

    // Forward the request to the backend
    const response = await fetch(proxyRequest);

    // Clone the response to modify headers if needed
    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Remove any CORS headers from backend response since we're now same-origin
    // This prevents confusion and potential issues
    const headersToRemove = [
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-max-age',
    ];

    const newHeaders = new Headers(proxyResponse.headers);
    headersToRemove.forEach(header => newHeaders.delete(header));

    // For same-origin, cookies don't need SameSite=None
    // Rewrite Set-Cookie headers to use simpler settings
    const setCookieHeaders = response.headers.getAll?.('set-cookie') ||
      [response.headers.get('set-cookie')].filter(Boolean);

    if (setCookieHeaders.length > 0) {
      // Remove existing Set-Cookie headers
      newHeaders.delete('set-cookie');

      // Rewrite each cookie for same-origin
      for (const cookie of setCookieHeaders) {
        if (cookie) {
          // Simplify cookie: remove SameSite=None (use Lax for better security)
          // and keep Secure only in production
          const simplifiedCookie = cookie
            .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
            .replace(/;\s*Domain=[^;]+/gi, ''); // Remove Domain attribute

          newHeaders.append('set-cookie', simplifiedCookie);
        }
      }
    }

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('[API Proxy] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'API proxy error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
