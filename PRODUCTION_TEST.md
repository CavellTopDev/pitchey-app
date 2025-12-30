# Pitchey Production Test - Full Business Workflow Validation

## Test Environment
- Frontend: https://pitchey-5o8.pages.dev
- API: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Demo Accounts
- Creator: alex.creator@demo.com / Demo123
- Investor: sarah.investor@demo.com / Demo123
- Production: stellar.production@demo.com / Demo123

---

## MCP Servers to Use
| MCP | Purpose |
|-----|---------|
| `better-auth` | Validate session creation, cookie handling, logout flow |
| `neon` | Query database to verify data persistence after each workflow |
| `sentry` | Monitor for errors during test execution |
| `chrome-devtools` | Inspect network requests, console errors, performance |
| `cloudflare` | Check Worker logs, R2 bucket state, KV cache |

## Subagents to Deploy
| Subagent | Task |
|----------|------|
| `code-reviewer` | Audit test results and flag issues |
| `cloudflare-deployer` | Verify deployment health before testing |
| `database-migrator` | Verify schema matches expected state |

---

## PRE-TEST CHECKS

### 1. Deployment Health
Use `cloudflare-deployer` subagent:
- Verify Worker is responding: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health`
- Check Pages deployment status
- Review recent Sentry errors via `sentry` MCP

### 2. Database State  
Use `neon` MCP:
```sql
-- Verify demo accounts exist
SELECT id, email, role FROM users WHERE email LIKE '%demo.com';

-- Check pitch count
SELECT COUNT(*) FROM pitches;

-- Verify NDA table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ndas';
```

### 3. R2 Storage
Use `cloudflare` MCP:
- List buckets: verify pitchey uploads bucket exists
- Check recent uploads for test files

---

## WORKFLOW TESTS

### TEST 1: Creator Portal Flow
Login: alex.creator@demo.com / Demo123

Use `better-auth` MCP to verify session creation.
Use `chrome-devtools` MCP to monitor network.

| Step | Action | Expected Result | Verify With |
|------|--------|-----------------|-------------|
| 1.1 | Navigate to /login/creator | Login form displays | chrome-devtools |
| 1.2 | Submit credentials | Redirect to /creator/dashboard | better-auth (session cookie set) |
| 1.3 | Create new pitch | Form accepts input, saves | neon MCP: `SELECT * FROM pitches ORDER BY created_at DESC LIMIT 1` |
| 1.4 | Upload document | R2 presigned URL generated, file uploads | cloudflare MCP: check R2 bucket |
| 1.5 | View pitch list | All creator's pitches display with correct dates | chrome-devtools (no console errors) |
| 1.6 | Receive NDA request | Notification appears | neon MCP: check ndas table |
| 1.7 | Approve NDA | Status updates, notification sent | neon MCP: `SELECT status FROM ndas WHERE id = ?` |
| 1.8 | Logout | Session cleared, redirect to home | better-auth (session cookie removed) |

### TEST 2: Investor Portal Flow
Login: sarah.investor@demo.com / Demo123

| Step | Action | Expected Result | Verify With |
|------|--------|-----------------|-------------|
| 2.1 | Navigate to /login/investor | Login form displays | chrome-devtools |
| 2.2 | Submit credentials | Redirect to /investor/dashboard | better-auth |
| 2.3 | Browse pitches | Trending/New tabs filter correctly | chrome-devtools (API calls) |
| 2.4 | View pitch details | Full pitch info displays | No "Invalid Date" errors |
| 2.5 | Request NDA | NDA request created | neon MCP: `SELECT * FROM ndas ORDER BY created_at DESC LIMIT 1` |
| 2.6 | Track investment | Investment data displays | neon MCP: verify investments table |
| 2.7 | Receive NDA approval notification | Toast notification appears | sentry (no errors) |
| 2.8 | Access NDA-protected content | Documents viewable after approval | cloudflare MCP (R2 access) |

### TEST 3: Production Company Portal Flow
Login: stellar.production@demo.com / Demo123

| Step | Action | Expected Result | Verify With |
|------|--------|-----------------|-------------|
| 3.1 | Navigate to /login/production | Login form displays | chrome-devtools |
| 3.2 | Submit credentials | Redirect to /production/dashboard | better-auth |
| 3.3 | Browse available pitches | Filtered by production criteria | chrome-devtools |
| 3.4 | Bulk NDA request | Multiple NDAs created | neon MCP: `SELECT COUNT(*) FROM ndas WHERE requester_id = ?` |
| 3.5 | View analytics | Dashboard metrics populate | No zero values if data exists |
| 3.6 | Download documents | R2 signed URLs work | cloudflare MCP |

### TEST 4: Cross-Portal Workflow (NDA Lifecycle)
Tests the full NDA flow across portals:

| Step | Actor | Action | Verify With |
|------|-------|--------|-------------|
| 4.1 | Investor | Request NDA on Creator's pitch | neon: NDA status = 'pending' |
| 4.2 | Creator | Receive notification | chrome-devtools: WebSocket/polling |
| 4.3 | Creator | Approve NDA | neon: NDA status = 'approved', approved_at set |
| 4.4 | Investor | Receive approval notification | sentry: no errors |
| 4.5 | Investor | Access protected documents | cloudflare: R2 presigned URL generated |

### TEST 5: Error Handling & Edge Cases

| Test | Action | Expected | Verify With |
|------|--------|----------|-------------|
| 5.1 | Invalid login | Error message, no crash | sentry (no unhandled exceptions) |
| 5.2 | Expired session | Redirect to login | better-auth |
| 5.3 | Large file upload (>100MB) | Multipart upload triggers | cloudflare MCP (R2 multipart) |
| 5.4 | Network disconnect during upload | Graceful failure, retry option | chrome-devtools |
| 5.5 | Concurrent NDA requests | All processed correctly | neon: no duplicate entries |

---

## POST-TEST VALIDATION

### Use `code-reviewer` subagent to:
1. Summarize all test results
2. Flag any failures or warnings
3. Check Sentry for new errors during test window
4. Verify database integrity after tests

### Use `neon` MCP for final queries:
```sql
-- Check for orphaned records
SELECT COUNT(*) FROM ndas WHERE pitch_id NOT IN (SELECT id FROM pitches);

-- Verify no duplicate sessions
SELECT user_id, COUNT(*) FROM sessions GROUP BY user_id HAVING COUNT(*) > 5;

-- Check recent activity
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

### Use `sentry` MCP:
- Pull errors from last 30 minutes
- Check for any new issues created during testing
- Verify error rate hasn't spiked

---

## OUTPUT FORMAT

Generate a test report with:

```
# Pitchey Production Test Report
Date: [timestamp]
Tester: Claude Code

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Warnings: X

## Portal Results
### Creator Portal: [PASS/FAIL]
- [details]

### Investor Portal: [PASS/FAIL]
- [details]

### Production Portal: [PASS/FAIL]
- [details]

## Cross-Portal Workflows: [PASS/FAIL]
- [details]

## Error Handling: [PASS/FAIL]
- [details]

## Issues Found
1. [issue description + severity + recommended fix]

## Database Integrity: [PASS/FAIL]

## Sentry Errors: [count]

## Recommendation
[READY FOR PRODUCTION / NEEDS FIXES]
```

---

## EXECUTION

1. Run `/test` command first to verify test infrastructure
2. Execute each workflow section sequentially
3. Use MCPs to verify each step before proceeding
4. Deploy `code-reviewer` subagent for final analysis
5. Generate test report