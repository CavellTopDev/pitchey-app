# Sentry Setup Guide for Pitchey Production

## Overview
This guide helps you configure Sentry error tracking for both backend and frontend without exposing secrets in the repository.

## Backend Configuration (Deno Deploy)

### 1. Environment Variables to Set
In your Deno Deploy dashboard for `pitchey-backend-fresh`, add these environment variables:

```bash
SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=pitchey-backend-v3.4
SENTRY_SERVER_NAME=pitchey-backend-fresh.deno.dev
```

### 2. Sentry Project Settings
- **Project URL**: https://o4510137537396736.sentry.io/projects/4510138308755536/settings/
- Add `pitchey-backend-fresh.deno.dev` to allowed domains
- Set environment to `production`

## Frontend Configuration (cloudflare-pages)

### 1. Environment Variables to Set
In your cloudflare-pages dashboard for the Pitchey site, add these environment variables:

```bash
VITE_SENTRY_DSN=https://1fdc8fab855b4b6b2f44f15034bdbb30@o4510137537396736.ingest.de.sentry.io/4510138262945872
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=pitchey-frontend-v1.0
```

### 2. Sentry Project Settings
- **Project URL**: https://o4510137537396736.sentry.io/projects/4510138262945872/settings/
- Add `pitchey.pages.dev` to allowed domains
- Set environment to `production`

## Testing Sentry Integration

### Backend Testing
Run the test script to verify backend Sentry integration:
```bash
SENTRY_DSN="your-backend-dsn" deno run --allow-env --allow-net --allow-read test-sentry.ts
```

### Frontend Testing
After deploying with the environment variables, check the browser console for Sentry initialization messages.

## Security Best Practices

1. **Never commit DSNs to Git** - Always use environment variables
2. **Use separate projects** for frontend and backend
3. **Set proper allowed domains** in Sentry project settings
4. **Use release tracking** for better error organization

## Current Project Structure

- **Backend Project**: Pitchey Backend (ID: 4510138308755536)
- **Frontend Project**: Pitchey Frontend (ID: 4510138262945872)
- **Organization**: o4510137537396736

## Troubleshooting

If Sentry is not working:
1. Check environment variables are set in deployment platforms
2. Verify allowed domains in Sentry project settings
3. Ensure CSP headers allow Sentry domains (already configured)
4. Check browser console for initialization errors