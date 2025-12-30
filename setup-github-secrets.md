# GitHub Secrets Setup Guide

## 🎯 Quick Setup

1. **Go to GitHub Repository Settings:**
   ```
   https://github.com/CavellTopDev/pitchey-app/settings/secrets/actions
   ```

2. **Click "New repository secret" for each of these:**

## 🗄️ Required Secrets

### Database & Authentication
```
Name: NEON_DATABASE_URL
Value: postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

```
Name: JWT_SECRET  
Value: vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
```

### Cloudflare (Optional - for Worker deployment)
```
Name: CLOUDFLARE_API_TOKEN
Value: [Get from https://dash.cloudflare.com/profile/api-tokens]
```

```
Name: CLOUDFLARE_ACCOUNT_ID
Value: [Get from Cloudflare dashboard sidebar]
```

### Monitoring (Optional)
```
Name: SENTRY_DSN
Value: https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
```

## 🚀 How to Get Cloudflare Credentials

### API Token:
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Set permissions:
   - Zone:Zone Settings:Edit
   - Zone:Zone:Edit  
   - Account:Cloudflare Workers:Edit
5. Include your account and zones
6. Copy the token

### Account ID:
1. Go to: https://dash.cloudflare.com
2. Select your domain
3. Look at the right sidebar - "Account ID" is shown there
4. Copy the Account ID

## ✅ Test the Setup

Once secrets are added, the GitHub Actions will run automatically on the next push to `main` branch.

You can also manually trigger them:
1. Go to: https://github.com/CavellTopDev/pitchey-app/actions
2. Select "Deploy to Deno Deploy" or "Deploy Full Stack to Production"  
3. Click "Run workflow"

## 📊 Monitor Deployments

- **GitHub Actions**: https://github.com/CavellTopDev/pitchey-app/actions
- **Deno Deploy**: https://dash.deno.com/projects/pitchey-backend-fresh
- **Cloudflare**: https://dash.cloudflare.com

## 🎯 Expected Results

After successful deployment:
- ✅ Backend: https://pitchey-backend-fresh.deno.dev
- ✅ Worker: https://pitchey-api-prod.ndlovucavelle.workers.dev  
- ✅ Frontend: https://pitchey-5o8.pages.dev
- ✅ Browse API: https://pitchey-5o8.pages.dev/browse