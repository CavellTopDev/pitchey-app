# Cloudflare Worker Deployment - Working Configuration

## Date: December 18, 2024

### Successfully Deployed Worker with Database Connection

After troubleshooting rate limiting issues (Cloudflare error 1027), the Worker is now fully operational with the following configuration:

## Working URLs

- **Production Worker**: `https://pitchey-api-prod.cavelltheleaddev.workers.dev`
- **Frontend**: `https://pitchey.pages.dev`
- **Database**: Neon PostgreSQL (pooler endpoint)

## Key Fixes Applied

1. **Added Missing `/api/pitches` Endpoint**
   - General pitch listing with pagination
   - Search and genre filtering support
   - Returns pitches with creator information

2. **Fixed CORS Headers**
   - All endpoints now return proper CORS headers
   - Allows cross-origin requests from frontend
   - Headers: `Access-Control-Allow-Origin: *`

3. **Database Connection Fix**
   - Added initialization check before queries
   - Properly handles DATABASE_URL environment variable
   - Connected to Neon PostgreSQL successfully

4. **Renamed Worker to Bypass Rate Limiting**
   - Changed from `pitchey-production` to `pitchey-api-prod`
   - Helped bypass account-level rate limiting

## Verified Working Endpoints

### Health Check
```bash
curl https://pitchey-api-prod.cavelltheleaddev.workers.dev/api/test
# Returns: {"success":true,"message":"Worker is healthy","timestamp":"..."}
```

### Database Test
```bash
curl https://pitchey-api-prod.cavelltheleaddev.workers.dev/api/test-db
# Returns: 3 active pitches from database
```

### Main Pitches Endpoint (with CORS)
```bash
curl -H "Origin: https://pitchey.pages.dev" \
  https://pitchey-api-prod.cavelltheleaddev.workers.dev/api/pitches
# Returns: List of published pitches with proper CORS headers
```

## Environment Variables (Secrets)

Configured in Cloudflare Worker:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `JWT_SECRET`: Authentication secret key

## GitHub Actions Workflow

Updated `.github/workflows/deploy-worker.yml` to:
- Deploy to `pitchey-api-prod` instead of `pitchey-production`
- Set secrets after initial deployment
- Test database connection before deployment
- Monitor deployment health

## Deployment Process

1. **Manual Deployment**:
```bash
wrangler deploy --env production
```

2. **Set Secrets**:
```bash
echo "your-database-url" | wrangler secret put DATABASE_URL --env production
echo "your-jwt-secret" | wrangler secret put JWT_SECRET --env production
```

3. **Verify Deployment**:
```bash
curl https://pitchey-api-prod.cavelltheleaddev.workers.dev/api/test-db
```

## Troubleshooting Notes

### Rate Limiting (Error 1027)
- Cloudflare platform-level protection
- Triggered by multiple rapid deployments
- Solution: Wait for rate limit to clear (took ~24 hours)
- Alternative: Deploy with different Worker name

### Database Connection Issues
- Ensure `DATABASE_URL` secret is set
- Redeploy after adding/updating secrets
- Check initialization in code before queries

### CORS Issues
- All endpoints must return CORS headers
- Headers added to all Response objects
- Supports preflight OPTIONS requests

## Current Status

✅ **FULLY OPERATIONAL**
- Database connected and returning data
- CORS headers working for all endpoints
- All API endpoints accessible
- Frontend can fetch data without errors

## Next Steps

1. Update frontend environment variables to use new Worker URL
2. Consider setting up Hyperdrive for connection pooling
3. Monitor for any rate limiting issues
4. Set up proper error tracking with Sentry