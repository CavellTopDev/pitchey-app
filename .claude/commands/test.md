---
description: Run comprehensive tests for Pitchey platform
allowed-tools: Bash(npm run:*), Bash(curl:*), Bash(deno run:*), Read
argument-hint: [test-type]
---

## Test Suite Execution

Requested test type: $ARGUMENTS

## Your Task

### If no specific test type provided:
1. Run TypeScript type checking: `npm run type-check`
2. Run frontend tests: `cd frontend && npm test`
3. Test API health: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health`
4. Test demo accounts login

### If "auth" or "authentication" specified:
Test all three portal authentications:
1. Creator login: `alex.creator@demo.com` / `Demo123`
2. Investor login: `sarah.investor@demo.com` / `Demo123`
3. Production login: `stellar.production@demo.com` / `Demo123`

### If "performance" specified:
1. Check response times for key endpoints
2. Test database query performance
3. Verify Redis cache hit rates
4. Monitor WebSocket connection stability

### If "integration" specified:
1. Test frontend-backend connection
2. Verify WebSocket real-time features
3. Check file upload to R2
4. Test NDA workflow end-to-end

Report all test results with pass/fail status and any errors encountered.