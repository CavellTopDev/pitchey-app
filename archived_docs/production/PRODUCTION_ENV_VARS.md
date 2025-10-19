# Production Environment Variables

## Required Environment Variables

### Database
```bash
DATABASE_URL=postgresql://user:pass@host/dbname  # Neon PostgreSQL URL
```

### Authentication
```bash
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
```

### Frontend
```bash
FRONTEND_URL=https://your-frontend-domain.com
```

## Optional Environment Variables

### Redis Caching (Choose One)

#### Option 1: Upstash Redis (Recommended for Deno Deploy)
```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

Get these from: https://console.upstash.com/

#### Option 2: Standard Redis (For Docker/VPS)
```bash
REDIS_URL=redis://localhost:6379  # or redis://user:pass@host:port
```

### Email Service (Optional)
```bash
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### File Storage (Optional)
```bash
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
```

### Payment Processing (Optional)
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Deployment Configurations

### For Deno Deploy
1. Set environment variables in dashboard: https://dash.deno.com/projects/your-project/settings
2. Use Upstash Redis for caching
3. Use Neon for PostgreSQL

### For Docker/Podman
1. Copy `.env.example` to `.env`
2. Fill in production values
3. Use `docker-compose` with Redis container

### For Kubernetes
1. Create secrets:
```bash
kubectl create secret generic app-secrets \
  --from-literal=DATABASE_URL='...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=UPSTASH_REDIS_REST_URL='...' \
  --from-literal=UPSTASH_REDIS_REST_TOKEN='...'
```

## Cache Behavior

The application automatically detects and uses the best available cache:

1. **Upstash Redis** (if `UPSTASH_REDIS_REST_URL` is set)
   - Best for Deno Deploy
   - Serverless, auto-scales
   - Distributed cache

2. **Standard Redis** (if `REDIS_URL` is set) 
   - Currently not connected (needs client library)
   - Best for self-hosted deployments

3. **In-Memory Cache** (fallback)
   - Used when no Redis is available
   - Single instance only
   - Resets on restart

## Health Check

Check cache status:
```bash
curl https://your-api.com/api/health
```

Response includes:
```json
{
  "cache": {
    "type": "upstash-redis|in-memory",
    "distributed": true|false,
    "status": "healthy"
  }
}
```