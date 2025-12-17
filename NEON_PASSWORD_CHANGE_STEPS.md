# Step-by-Step Guide: Changing Neon Database Password

## ⚠️ CRITICAL: Your database password was exposed in the repository and MUST be changed immediately!

## Method 1: Through Neon Console (Recommended)

### Step 1: Login to Neon Console
1. Open your browser and go to: **https://console.neon.tech**
2. Sign in with your account (GitHub, Google, or email)

### Step 2: Find Your Project
1. Once logged in, you'll see your projects dashboard
2. Look for the project with endpoint: `ep-old-snow-abpr94lc`
3. Click on the project name to open it

### Step 3: Navigate to Settings
1. In your project dashboard, look for the **"Settings"** tab in the left sidebar
2. Click on **"Settings"**

### Step 4: Go to Roles Section
1. In the Settings page, find the **"Roles"** section
2. You should see a role named `neondb_owner` listed

### Step 5: Reset the Password
1. Next to the `neondb_owner` role, click the **"Reset password"** button
2. **IMPORTANT**: A new password will be generated and shown ONLY ONCE
3. **Copy the new password immediately** - you won't be able to see it again!
4. Save it in a secure password manager

### Step 6: Get Your New Connection String
1. After resetting, go to the **"Connection Details"** section
2. Make sure **"Pooled connection"** is selected (required for Cloudflare)
3. Your new connection string will be:
   ```
   postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

## Method 2: Using Neon CLI (Alternative)

### Step 1: Install Neon CLI
```bash
npm install -g neonctl
```

### Step 2: Authenticate
```bash
neonctl auth
```

### Step 3: List Your Projects
```bash
neonctl projects list
```

### Step 4: Reset Password
```bash
# Replace PROJECT_ID with your actual project ID
neonctl roles reset-password neondb_owner --project-id=PROJECT_ID
```

## After Changing the Password

### Step 1: Test the New Connection
```bash
# Test that the new password works
psql "postgresql://neondb_owner:NEW_PASSWORD_HERE@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "SELECT 1;"
```

If successful, you should see:
```
 ?column? 
----------
        1
(1 row)
```

### Step 2: Update Cloudflare Worker Secrets

You have two options:

#### Option A: Using Wrangler CLI (Recommended)
```bash
# Navigate to your project directory
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Update the DATABASE_URL secret
echo "postgresql://neondb_owner:NEW_PASSWORD_HERE@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL --name pitchey-production
```

#### Option B: Through Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to **Workers & Pages**
4. Find `pitchey-production` worker
5. Click on **Settings** → **Variables**
6. Click on **Edit variables**
7. Find `DATABASE_URL` and update it with the new connection string
8. Click **Save and deploy**

### Step 3: Update Any Local Environment Files

If you have local `.env` files, update them:

```bash
# Edit your local .env file
nano .env.local

# Update this line:
DATABASE_URL="postgresql://neondb_owner:NEW_PASSWORD_HERE@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
```

### Step 4: Deploy Your Worker
```bash
# Deploy with the new secrets
wrangler deploy
```

### Step 5: Verify Everything Works
```bash
# Test your production API
curl https://pitchey-production.cavelltheleaddev.workers.dev/health

# Should return something like:
# {"status":"healthy","timestamp":"2024-12-12T..."}
```

## Troubleshooting

### If You Can't Find the Reset Button:
1. Make sure you're logged in as the project owner
2. Try refreshing the page
3. Check if you're in the correct project

### If the New Password Doesn't Work:
1. Make sure you copied it correctly (no extra spaces)
2. Ensure you're using the pooled connection endpoint (with `-pooler`)
3. Check that `?sslmode=require` is included

### If Cloudflare Update Fails:
```bash
# Make sure you're logged in to Wrangler
wrangler login

# Verify your account
wrangler whoami

# Try the update again
echo "postgresql://..." | wrangler secret put DATABASE_URL --name pitchey-production
```

### If You Lose the Password:
- Don't panic! Just reset it again in Neon Console
- Each reset generates a new password
- Old passwords become invalid after reset

## Security Best Practices

1. **Never commit passwords to Git**
2. **Use environment variables or secrets managers**
3. **Rotate passwords regularly (every 90 days)**
4. **Use strong, randomly generated passwords**
5. **Enable audit logging in Neon Console**
6. **Consider using different roles for different environments**

## What Happens After Password Change?

- ✅ Old password immediately stops working
- ✅ All existing connections are terminated
- ✅ New connections must use the new password
- ✅ Your Worker will use the new password after deployment
- ✅ No data is lost - only the password changes

## Need Help?

- **Neon Support**: https://neon.tech/docs
- **Cloudflare Support**: https://developers.cloudflare.com
- **Check Logs**: 
  ```bash
  # Check Worker logs
  wrangler tail --name pitchey-production
  
  # Check Neon logs in Console → Monitoring → Logs
  ```

Remember: The exposed password `npg_DZhIpVaLAk06` is now public and MUST be changed immediately!