#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Script to migrate all production endpoints to the serverless worker
 * This creates a patch that can be applied to worker-neon-serverless.ts
 */

const endpoints = [
  // Dashboard endpoints
  { path: '/api/creator/dashboard', method: 'GET', auth: true, userType: 'creator' },
  { path: '/api/investor/dashboard', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/production/dashboard', method: 'GET', auth: true, userType: 'production' },
  
  // Pitch management
  { path: '/api/pitches', method: 'POST', auth: true, userType: 'creator' },
  { path: '/api/pitches/:id', method: 'GET', auth: false },
  { path: '/api/pitches/:id', method: 'PUT', auth: true, userType: 'creator' },
  { path: '/api/pitches/:id', method: 'DELETE', auth: true, userType: 'creator' },
  { path: '/api/pitches/trending', method: 'GET', auth: false },
  { path: '/api/pitches/new', method: 'GET', auth: false },
  { path: '/api/pitches/following', method: 'GET', auth: true },
  
  // NDA system
  { path: '/api/nda/request', method: 'POST', auth: true },
  { path: '/api/nda/stats', method: 'GET', auth: true },
  { path: '/api/nda/pending', method: 'GET', auth: true },
  { path: '/api/nda/active', method: 'GET', auth: true },
  { path: '/api/ndas/incoming-requests', method: 'GET', auth: true },
  { path: '/api/ndas/outgoing-requests', method: 'GET', auth: true },
  { path: '/api/ndas/incoming-signed', method: 'GET', auth: true },
  { path: '/api/ndas/outgoing-signed', method: 'GET', auth: true },
  { path: '/api/nda/:id/approve', method: 'PUT', auth: true },
  { path: '/api/nda/:id/reject', method: 'PUT', auth: true },
  
  // Saved pitches
  { path: '/api/saved-pitches', method: 'GET', auth: true },
  { path: '/api/saved-pitches', method: 'POST', auth: true },
  { path: '/api/saved-pitches/:id', method: 'DELETE', auth: true },
  
  // Investment tracking
  { path: '/api/investments', method: 'GET', auth: true },
  { path: '/api/investments', method: 'POST', auth: true },
  { path: '/api/investment/opportunities', method: 'GET', auth: true },
  { path: '/api/investment/express-interest', method: 'POST', auth: true },
  { path: '/api/investor/portfolio/summary', method: 'GET', auth: true },
  
  // Notifications
  { path: '/api/notifications', method: 'GET', auth: true },
  { path: '/api/notifications/:id/read', method: 'PUT', auth: true },
  { path: '/api/notifications/unread', method: 'GET', auth: true },
  { path: '/api/notifications/preferences', method: 'GET', auth: true },
  { path: '/api/notifications/preferences', method: 'PUT', auth: true },
  
  // Analytics
  { path: '/api/analytics/track', method: 'POST', auth: false },
  { path: '/api/analytics/dashboard', method: 'GET', auth: true },
  { path: '/api/analytics/engagement', method: 'GET', auth: true },
  { path: '/api/analytics/revenue', method: 'GET', auth: true },
  { path: '/api/analytics/trending', method: 'GET', auth: true },
  { path: '/api/analytics/realtime', method: 'GET', auth: true },
  
  // Search
  { path: '/api/search', method: 'GET', auth: false },
  { path: '/api/search/pitches', method: 'GET', auth: false },
  
  // User profile
  { path: '/api/profile', method: 'GET', auth: true },
  { path: '/api/profile', method: 'PUT', auth: true },
  { path: '/api/user/preferences', method: 'GET', auth: true },
  { path: '/api/user/preferences', method: 'PUT', auth: true },
  
  // Following
  { path: '/api/follows/:userId', method: 'POST', auth: true },
  { path: '/api/follows/:userId', method: 'DELETE', auth: true },
  { path: '/api/follows/followers', method: 'GET', auth: true },
  { path: '/api/follows/following', method: 'GET', auth: true },
  
  // File upload
  { path: '/api/upload', method: 'POST', auth: true },
  { path: '/api/files/:key', method: 'GET', auth: false },
  
  // Configuration
  { path: '/api/config/genres', method: 'GET', auth: false },
  { path: '/api/config/formats', method: 'GET', auth: false },
  { path: '/api/config/budget-ranges', method: 'GET', auth: false },
  { path: '/api/config/stages', method: 'GET', auth: false },
  { path: '/api/config/all', method: 'GET', auth: false },
  
  // Registration
  { path: '/api/auth/creator/register', method: 'POST', auth: false },
  { path: '/api/auth/investor/register', method: 'POST', auth: false },
  { path: '/api/auth/production/register', method: 'POST', auth: false },
  
  // Session management
  { path: '/api/auth/logout', method: 'POST', auth: true },
  { path: '/api/auth/session', method: 'GET', auth: true },
  { path: '/api/auth/validate-token', method: 'GET', auth: true },
  
  // Password reset
  { path: '/api/auth/request-reset', method: 'POST', auth: false },
  { path: '/api/auth/reset-password', method: 'POST', auth: false },
  
  // Production company specific
  { path: '/api/production/projects', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/pipeline', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/team', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/contracts', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/budget', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/schedule', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/submissions', method: 'GET', auth: true, userType: 'production' },
  { path: '/api/production/smart-pitch-discovery', method: 'GET', auth: true, userType: 'production' },
  
  // Payments
  { path: '/api/payments/credits/balance', method: 'GET', auth: true },
  { path: '/api/payments/subscription-status', method: 'GET', auth: true },
  { path: '/api/payments/history', method: 'GET', auth: true },
  { path: '/api/payments/invoices', method: 'GET', auth: true },
  { path: '/api/payments/payment-methods', method: 'GET', auth: true },
  
  // Additional investor endpoints
  { path: '/api/investor/investments', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/investor/nda-requests', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/investor/recommendations', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/investor/analytics', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/investor/watchlist', method: 'GET', auth: true, userType: 'investor' },
  { path: '/api/investor/activity', method: 'GET', auth: true, userType: 'investor' },
];

console.log(`
==============================================
ENDPOINT MIGRATION SUMMARY
==============================================

Total endpoints to migrate: ${endpoints.length}

By category:
- Authentication & Session: ${endpoints.filter(e => e.path.includes('/auth')).length}
- Pitch Management: ${endpoints.filter(e => e.path.includes('/pitches')).length}
- NDA System: ${endpoints.filter(e => e.path.includes('/nda')).length}
- Dashboard & Analytics: ${endpoints.filter(e => e.path.includes('dashboard') || e.path.includes('analytics')).length}
- Investment: ${endpoints.filter(e => e.path.includes('invest')).length}
- Production: ${endpoints.filter(e => e.path.includes('production')).length}
- Notifications: ${endpoints.filter(e => e.path.includes('notification')).length}
- User Profile: ${endpoints.filter(e => e.path.includes('profile') || e.path.includes('user')).length}
- Configuration: ${endpoints.filter(e => e.path.includes('config')).length}
- Payments: ${endpoints.filter(e => e.path.includes('payment')).length}

Authentication required: ${endpoints.filter(e => e.auth).length}
Public endpoints: ${endpoints.filter(e => !e.auth).length}

User type restrictions:
- Creator only: ${endpoints.filter(e => e.userType === 'creator').length}
- Investor only: ${endpoints.filter(e => e.userType === 'investor').length}
- Production only: ${endpoints.filter(e => e.userType === 'production').length}
- All users: ${endpoints.filter(e => e.auth && !e.userType).length}

==============================================
IMPLEMENTATION STATUS
==============================================

✅ Already implemented in serverless worker:
- /api/health
- /api/auth/creator/login
- /api/auth/investor/login
- /api/auth/production/login
- /api/pitches/browse/enhanced

⏳ Need to migrate: ${endpoints.length - 5} endpoints

==============================================
DEPLOYMENT STEPS
==============================================

1. Update worker-neon-serverless.ts with all endpoints
2. Test locally with wrangler dev
3. Deploy to production: wrangler deploy -c wrangler-serverless.toml
4. Update secrets:
   - wrangler secret put DATABASE_URL
   - wrangler secret put JWT_SECRET
   - wrangler secret put UPSTASH_REDIS_REST_URL
   - wrangler secret put UPSTASH_REDIS_REST_TOKEN
5. Update frontend to point to new worker URL
6. Monitor for errors and performance

==============================================
`);

// Generate migration code snippets
const generateEndpointCode = (endpoint: any) => {
  const pathPattern = endpoint.path.replace(/:(\w+)/g, '(\\d+)');
  const isParameterized = endpoint.path.includes(':');
  
  return `
      // ${endpoint.path} - ${endpoint.method}
      if (${isParameterized ? `path.match(/^${pathPattern.replace(/\//g, '\\/')}$/)` : `path === '${endpoint.path}'`} && method === '${endpoint.method}') {
        ${endpoint.auth ? `
        if (!userPayload${endpoint.userType ? ` || userPayload.userType !== '${endpoint.userType}'` : ''}) {
          return corsResponse(request, { success: false, message: 'Unauthorized' }, 401);
        }
        ` : ''}
        
        // TODO: Implement ${endpoint.path} logic
        return corsResponse(request, {
          success: true,
          message: 'Endpoint ${endpoint.path} implementation pending'
        });
      }
  `;
};

// Save implementation guide
const implementationGuide = `
## Implementation Priority

### Phase 1 - Core Functionality (Immediate)
1. Dashboard endpoints (creator, investor, production)
2. Pitch CRUD operations
3. Saved pitches functionality
4. Basic search and browse

### Phase 2 - Collaboration (Day 2)
1. NDA system complete workflow
2. Notifications system
3. Following/followers
4. Investment tracking

### Phase 3 - Advanced Features (Day 3)
1. File uploads to R2
2. Analytics and metrics
3. Payment integration
4. Production company features

### Phase 4 - Optimization (Day 4)
1. Add Redis caching for all GET endpoints
2. Implement batch operations
3. Add request queuing for heavy operations
4. Performance monitoring

## Testing Checklist
- [ ] All authentication endpoints work
- [ ] Dashboard data loads correctly
- [ ] Pitch creation and editing
- [ ] NDA workflow complete
- [ ] Notifications delivered
- [ ] Search and filtering
- [ ] File uploads
- [ ] WebSocket connections
- [ ] Payment processing
- [ ] Analytics tracking
`;

await Deno.writeTextFile('MIGRATION_IMPLEMENTATION_GUIDE.md', implementationGuide);
console.log('✅ Implementation guide saved to MIGRATION_IMPLEMENTATION_GUIDE.md');

// Generate test script
const testScript = `#!/bin/bash
# Test all migrated endpoints

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
TOKEN="your-jwt-token-here"

echo "Testing API endpoints..."

# Health check
curl -X GET "$API_URL/api/health"

# Browse endpoint
curl -X GET "$API_URL/api/pitches/browse/enhanced"

# Authenticated endpoint test
curl -X GET "$API_URL/api/creator/dashboard" \\
  -H "Authorization: Bearer $TOKEN"

echo "Test complete!"
`;

await Deno.writeTextFile('test-migrated-endpoints.sh', testScript);
console.log('✅ Test script saved to test-migrated-endpoints.sh');