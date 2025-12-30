# Neon Database Credentials Update Guide

## 🔐 Important Security Note
The database credentials were previously exposed in the repository. While they may have been rotated automatically, you need to ensure the correct credentials are being used.

## Where to Find Your Credentials

### Option 1: GitHub Actions Secrets (Recommended)
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Find the `DATABASE_URL` secret
4. Copy the value (it should look like: `postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require`)

### Option 2: Neon Dashboard
1. Log into [Neon Console](https://console.neon.tech)
2. Select your project
3. Go to the **Connection Details** section
4. Copy the connection string (make sure to include the password)

## How to Update Cloudflare Worker

### For Production Worker:
```bash
# Update the DATABASE_URL secret
echo "YOUR_ACTUAL_DATABASE_URL" | wrangler secret put DATABASE_URL

# Verify it worked
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq '.'
```

### For Debug Worker (if testing):
```bash
# Update for debug worker
echo "YOUR_ACTUAL_DATABASE_URL" | wrangler secret put DATABASE_URL -c wrangler-debug.toml

# Test the connection
curl -s https://pitchey-debug.ndlovucavelle.workers.dev/api/debug/db | jq '.'
```

## Using the Secure Setup Script

We've created a secure script that prompts for credentials instead of hardcoding them:

```bash
./setup-worker-secrets-secure.sh
```

This script will:
1. Prompt you for the DATABASE_URL (paste from GitHub Secrets)
2. Prompt for other secrets as needed
3. Configure everything securely without storing credentials in files

## Verification Steps

After updating the credentials:

1. **Check Database Connection:**
   ```bash
   curl -s https://pitchey-debug.ndlovucavelle.workers.dev/api/debug/db | jq '.'
   ```
   
   Expected response:
   ```json
   {
     "success": true,
     "data": {
       "connected": true,
       "result": {...}
     }
   }
   ```

2. **Check Health Status:**
   ```bash
   curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq '.'
   ```
   
   Should show `"database": "connected"` instead of `"database": "error"`

3. **Test Authentication:**
   ```bash
   ./test-better-auth-deployment.sh
   ```

## Security Best Practices

1. **Never commit credentials** to the repository
2. **Use GitHub Secrets** or environment variables for sensitive data
3. **Rotate credentials regularly** if they've been exposed
4. **Use the secure setup script** instead of hardcoding values
5. **Delete any files** that contain hardcoded credentials

## Troubleshooting

If you're still getting authentication errors after updating:

1. **Check the format** - Ensure the connection string includes `?sslmode=require`
2. **Verify in Neon** - Check if the database is active and not suspended
3. **Test locally** - Try connecting with `psql` to verify credentials:
   ```bash
   psql "YOUR_DATABASE_URL"
   ```
4. **Check logs** - Use `wrangler tail` to see detailed error messages

## Next Steps

Once the database connection is working:
1. Better Auth will initialize automatically
2. Authentication endpoints will start working
3. You can proceed with frontend integration
4. Demo accounts will be accessible with password `Demo123`