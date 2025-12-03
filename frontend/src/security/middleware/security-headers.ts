/**
 * Security Headers Middleware
 * Implements OWASP recommended security headers for Cloudflare Workers
 * Reference: https://owasp.org/www-project-secure-headers/
 */

export interface SecurityHeadersConfig {
  // Content Security Policy - Mitigates XSS attacks
  csp?: {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    fontSrc?: string[];
    objectSrc?: string[];
    mediaSrc?: string[];
    frameSrc?: string[];
    sandbox?: string[];
    reportUri?: string;
    requireTrustedTypesFor?: string[];
    trustedTypes?: string[];
  };
  
  // Strict Transport Security - Enforces HTTPS
  hsts?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  
  // Additional security headers
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  contentTypeOptions?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string[]>;
}

export class SecurityHeaders {
  private config: SecurityHeadersConfig;
  
  constructor(config: SecurityHeadersConfig = {}) {
    this.config = {
      // Default secure configuration
      csp: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'strict-dynamic'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // May need for React
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.pitchey.com", "wss://api.pitchey.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        requireTrustedTypesFor: ["'script'"],
        ...config.csp
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
        ...config.hsts
      },
      frameOptions: config.frameOptions || 'DENY',
      contentTypeOptions: config.contentTypeOptions !== false,
      xssProtection: config.xssProtection !== false,
      referrerPolicy: config.referrerPolicy || 'strict-origin-when-cross-origin',
      permissionsPolicy: config.permissionsPolicy || {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: ["'self'"],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: []
      }
    };
  }
  
  /**
   * Generate Content Security Policy header value
   */
  private generateCSP(): string {
    const csp = this.config.csp;
    if (!csp) return '';
    
    const directives: string[] = [];
    
    // Build CSP directives
    if (csp.defaultSrc) {
      directives.push(`default-src ${csp.defaultSrc.join(' ')}`);
    }
    if (csp.scriptSrc) {
      directives.push(`script-src ${csp.scriptSrc.join(' ')}`);
    }
    if (csp.styleSrc) {
      directives.push(`style-src ${csp.styleSrc.join(' ')}`);
    }
    if (csp.imgSrc) {
      directives.push(`img-src ${csp.imgSrc.join(' ')}`);
    }
    if (csp.connectSrc) {
      directives.push(`connect-src ${csp.connectSrc.join(' ')}`);
    }
    if (csp.fontSrc) {
      directives.push(`font-src ${csp.fontSrc.join(' ')}`);
    }
    if (csp.objectSrc) {
      directives.push(`object-src ${csp.objectSrc.join(' ')}`);
    }
    if (csp.mediaSrc) {
      directives.push(`media-src ${csp.mediaSrc.join(' ')}`);
    }
    if (csp.frameSrc) {
      directives.push(`frame-src ${csp.frameSrc.join(' ')}`);
    }
    if (csp.reportUri) {
      directives.push(`report-uri ${csp.reportUri}`);
    }
    if (csp.requireTrustedTypesFor) {
      directives.push(`require-trusted-types-for ${csp.requireTrustedTypesFor.join(' ')}`);
    }
    if (csp.trustedTypes) {
      directives.push(`trusted-types ${csp.trustedTypes.join(' ')}`);
    }
    
    // Add upgrade-insecure-requests
    directives.push('upgrade-insecure-requests');
    
    return directives.join('; ');
  }
  
  /**
   * Generate HSTS header value
   */
  private generateHSTS(): string {
    const hsts = this.config.hsts;
    if (!hsts) return '';
    
    let value = `max-age=${hsts.maxAge}`;
    if (hsts.includeSubDomains) {
      value += '; includeSubDomains';
    }
    if (hsts.preload) {
      value += '; preload';
    }
    
    return value;
  }
  
  /**
   * Generate Permissions Policy header value
   */
  private generatePermissionsPolicy(): string {
    const policy = this.config.permissionsPolicy;
    if (!policy) return '';
    
    const directives: string[] = [];
    for (const [feature, allowList] of Object.entries(policy)) {
      if (allowList.length === 0) {
        directives.push(`${feature}=()`);
      } else {
        directives.push(`${feature}=(${allowList.join(' ')})`);
      }
    }
    
    return directives.join(', ');
  }
  
  /**
   * Apply security headers to a Response
   */
  apply(response: Response): Response {
    const headers = new Headers(response.headers);
    
    // Content Security Policy
    const csp = this.generateCSP();
    if (csp) {
      headers.set('Content-Security-Policy', csp);
    }
    
    // HTTP Strict Transport Security
    const hsts = this.generateHSTS();
    if (hsts) {
      headers.set('Strict-Transport-Security', hsts);
    }
    
    // X-Frame-Options
    if (this.config.frameOptions) {
      headers.set('X-Frame-Options', this.config.frameOptions);
    }
    
    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }
    
    // X-XSS-Protection (legacy but still useful)
    if (this.config.xssProtection) {
      headers.set('X-XSS-Protection', '1; mode=block');
    }
    
    // Referrer Policy
    if (this.config.referrerPolicy) {
      headers.set('Referrer-Policy', this.config.referrerPolicy);
    }
    
    // Permissions Policy
    const permissionsPolicy = this.generatePermissionsPolicy();
    if (permissionsPolicy) {
      headers.set('Permissions-Policy', permissionsPolicy);
    }
    
    // Additional security headers
    headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  
  /**
   * Create middleware for Cloudflare Workers
   */
  middleware() {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
      const response = await next();
      return this.apply(response);
    };
  }
}

// Export default configuration for production
export const defaultSecurityHeaders = new SecurityHeaders({
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'strict-dynamic'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: [
      "'self'",
      "https://pitchey-production.cavelltheleaddev.workers.dev",
      "wss://pitchey-production.cavelltheleaddev.workers.dev",
      "https://*.upstash.io",
      "https://*.neon.tech"
    ],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'", "blob:"],
    frameSrc: ["'none'"],
    reportUri: "https://pitchey-production.cavelltheleaddev.workers.dev/api/security/csp-report"
  },
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true
  },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: ["'self'"],
    payment: ["'self'"],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: [],
    'ambient-light-sensor': [],
    'autoplay': ["'self'"],
    'battery': [],
    'display-capture': [],
    'document-domain': [],
    'encrypted-media': ["'self'"],
    'fullscreen': ["'self'"],
    'gamepad': [],
    'midi': [],
    'picture-in-picture': ["'self'"],
    'publickey-credentials-get': ["'self'"],
    'screen-wake-lock': [],
    'speaker-selection': [],
    'sync-xhr': [],
    'usb': [],
    'web-share': ["'self'"],
    'xr-spatial-tracking': []
  }
});