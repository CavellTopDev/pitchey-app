# Redis Setup on Fly.io for Pitchey Backend

## Option 1: Upstash Redis (Managed - Recommended)

### Create Upstash Redis Database
```bash
# Create a new Redis database (requires Fly CLI)
fly redis create --name pitchey-redis

# This will output connection details including:
# - Database name
# - Private URL (redis://password@fly-your-db.upstash.io)
# - Public URL (for external connections)
```

### Set Environment Variables
```bash
# Set the Redis URL as a secret for your backend app
fly secrets set REDIS_URL="redis://password@fly-your-db.upstash.io" --app pitchey-backend

# Verify the secret was set
fly secrets list --app pitchey-backend
```

### Pricing
- **Starter**: $10/month (200MB storage, single region)
- **Standard**: $50/month (3GB storage, global replicas available)
- **Pro**: $280/month (50GB storage, high performance)

## Option 2: Self-Hosted Redis (More Control)

### Create Redis App
```bash
# Clone the official Redis template
git clone https://github.com/fly-apps/redis.git pitchey-redis
cd pitchey-redis

# Set a Redis password
fly secrets set REDIS_PASSWORD=your-secure-password

# Deploy Redis
fly deploy

# Get the Redis app's internal hostname
fly status
```

### Configure Backend to Use Self-Hosted Redis
```bash
# Set Redis URL for self-hosted instance
fly secrets set REDIS_URL="redis://:your-secure-password@pitchey-redis.internal:6379" --app pitchey-backend
```

## Current Status

✅ **Backend now works WITHOUT Redis** - Authentication is fully functional
✅ **Cache service is Redis-optional** - Falls back gracefully when Redis is unavailable
✅ **Ready for Redis integration** - Just set REDIS_URL environment variable

## Quick Setup (Recommended)

```bash
# 1. Create Upstash Redis
fly redis create --name pitchey-redis

# 2. Set Redis URL (replace with your actual URL from step 1)
fly secrets set REDIS_URL="redis://password@fly-your-db.upstash.io" --app pitchey-backend

# 3. Redeploy backend
fly deploy --app pitchey-backend

# 4. Verify Redis connection
fly logs --app pitchey-backend
# Look for "✅ Redis connected successfully" in logs
```

## Testing Redis Connection

```bash
# Connect to your Redis instance locally for testing
fly redis connect pitchey-redis

# In the Redis CLI, test basic operations:
redis> set test "hello"
redis> get test
redis> ping
```

## Troubleshooting

### Redis Connection Issues
- Check that REDIS_URL secret is set: `fly secrets list --app pitchey-backend`
- Verify Redis instance is running: `fly status --app pitchey-redis` (for self-hosted)
- Check logs for connection errors: `fly logs --app pitchey-backend`

### Performance Without Redis
The app will work without Redis but with these limitations:
- No caching (slower API responses)
- No rate limiting on views
- No analytics aggregation
- All features will still function, just without performance optimizations

## Migration Path

1. **Immediate**: Deploy current changes (Redis optional) ✅
2. **Next**: Set up Upstash Redis with REDIS_URL
3. **Future**: Consider upgrading Redis plan based on usage
4. **Optional**: Add Redis-based session storage for better performance