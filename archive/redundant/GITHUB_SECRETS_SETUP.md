> **Note**: This document predates the migration from Deno Deploy to Cloudflare Workers (completed Dec 2024). Deno Deploy references are historical.

# GitHub Secrets Configuration Guide

This guide explains how to configure the required GitHub secrets for the Pitchey CI/CD pipelines.

## Required Secrets

### 🔑 Cloudflare (HIGH PRIORITY)
These are essential for deploying to Cloudflare Workers and Pages.

#### `CLOUDFLARE_API_TOKEN`
**Status:** ❌ Needs Update (Authentication failing)
**Purpose:** Deploy to Cloudflare Workers and Pages
**How to get it:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Custom token" template with these permissions:
   - Account: Cloudflare Pages:Edit
   - Account: Cloudflare Workers Scripts:Edit
   - Account: Account Settings:Read
   - Zone: Zone:Read
   - Zone: DNS:Edit (if using custom domains)
4. Copy the token and add to GitHub Secrets

#### `CLOUDFLARE_ACCOUNT_ID`
**Status:** ❓ Check if correct
**Purpose:** Identify your Cloudflare account
**How to get it:**
1. Go to https://dash.cloudflare.com
2. Select your domain
3. On the right sidebar, find "Account ID"
4. Copy and add to GitHub Secrets

### 📊 Monitoring & Analytics (OPTIONAL)

#### `SENTRY_AUTH_TOKEN`
**Status:** ✅ Optional (workflows updated to skip if not set)
**Purpose:** Create releases and upload source maps to Sentry
**How to get it:**
1. Go to https://sentry.io/settings/account/api/auth-tokens/
2. Create a new auth token with scopes:
   - `project:releases`
   - `org:read`
3. Add to GitHub Secrets (optional - monitoring works without it)

#### `SENTRY_ORG`
**Status:** ✅ Optional
**Purpose:** Your Sentry organization slug
**Example:** `my-company`

#### `SENTRY_PROJECT`
**Status:** ✅ Optional
**Purpose:** Your Sentry project slug
**Example:** `pitchey-frontend`

### 💬 Notifications (OPTIONAL)

#### `SLACK_WEBHOOK_URL`
**Status:** ✅ Optional (workflows updated to skip if not set)
**Purpose:** Send deployment notifications to Slack
**How to get it:**
1. Go to your Slack workspace
2. Add "Incoming Webhooks" app
3. Create a webhook for your channel
4. Copy the webhook URL

### 🗄️ Database & Authentication

#### `DATABASE_URL`
**Status:** ✅ Should be configured
**Purpose:** Neon PostgreSQL connection string
**Format:** `postgresql://user:password@host/database?sslmode=require`

#### `JWT_SECRET`
**Status:** ✅ Should be configured
**Purpose:** JWT token signing secret
**Example:** A long random string (min 32 characters)

#### `NEON_DATABASE_URL`
**Status:** ✅ Should be configured
**Purpose:** Same as DATABASE_URL (some workflows use this name)

### 📦 Redis Cache

#### `UPSTASH_REDIS_REST_URL`
**Status:** ✅ Should be configured
**Purpose:** Upstash Redis REST API URL
**Example:** `https://your-instance.upstash.io`

#### `UPSTASH_REDIS_REST_TOKEN`
**Status:** ✅ Should be configured
**Purpose:** Upstash Redis authentication token

### 🚫 Deprecated (No Longer Needed)

These secrets are no longer required since we migrated from Deno to Cloudflare Workers:

- ~~`DENO_DEPLOY_TOKEN`~~ - Not needed (using Cloudflare Workers)
- ~~`DENO_DEPLOY_TOKEN_STAGING`~~ - Not needed
- ~~`DENO_DEPLOY_TOKEN_PRODUCTION`~~ - Not needed

## How to Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click "Settings" tab
3. In the left sidebar, click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add the secret name and value
6. Click "Add secret"

## Verification

After adding secrets, verify they work:

```bash
# Trigger a manual workflow run
gh workflow run "Deploy to Cloudflare Workers"

# Check the status
gh run list --limit 1
```

## Current Status Summary

### ✅ Working
- Database connections
- JWT authentication
- Redis caching
- Optional Slack notifications
- Optional Sentry monitoring

### ❌ Needs Attention
- **CLOUDFLARE_API_TOKEN** - Authentication failing (403 error)
- **CLOUDFLARE_ACCOUNT_ID** - Verify it's correct

### 🎯 Priority Actions
1. **Update CLOUDFLARE_API_TOKEN** with a new token with correct permissions
2. **Verify CLOUDFLARE_ACCOUNT_ID** matches your account
3. **Test deployment** after updating secrets

## Troubleshooting

### Cloudflare 403 Error
If you see "Authentication error" with status 403:
1. Regenerate the API token with correct permissions
2. Ensure the token has not expired
3. Verify the account ID is correct
4. Check that the token has permissions for the correct zone/account

### Workflow Still Failing?
1. Check the workflow logs: `gh run view <run-id> --log`
2. Verify secret names match exactly (case-sensitive)
3. Ensure secrets don't have extra spaces or newlines
4. Try regenerating the problematic token/secret

## Support

For more help:
- Cloudflare API Tokens: https://developers.cloudflare.com/api/tokens
- GitHub Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- Upstash Redis: https://upstash.com/docs/redis/overall/getstarted
- Sentry CLI: https://docs.sentry.io/product/cli/
