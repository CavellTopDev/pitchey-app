# Cloudflare API Token Setup for GitHub Actions

## Required Permissions

Your Cloudflare API token needs the following permissions to deploy Workers:

### 1. Account Permissions
- **Account:** `Cloudflare Workers Scripts:Edit`
- **Account:** `Account Settings:Read`

### 2. Zone Permissions (if using custom domains)
- **Zone:** `Workers Routes:Edit`
- **Zone:** `DNS:Read`

### 3. User Permissions
- **User:** `User Details:Read`

## Creating a New Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Configure permissions:
   - **Account Resources**
     - Include: `002bd5c0e90ae753a387c60546cf6869` (your account)
     - Permissions: 
       - `Cloudflare Workers Scripts:Edit`
       - `Account Settings:Read`
   
   - **User Resources**
     - Include: All users
     - Permissions: `User Details:Read`

5. Set token name: `GitHub Actions Deployment`
6. Click "Continue to summary" and "Create Token"
7. Copy the token immediately (it won't be shown again)

## Update GitHub Secret

Once you have the token with correct permissions:

```bash
# Update the existing token
gh secret set CLOUDFLARE_API_TOKEN --body='YOUR_NEW_API_TOKEN_HERE'

# Verify it's updated
gh secret list | grep CLOUDFLARE
```

## Test the Deployment

After updating the token, trigger a deployment:

```bash
# Manually trigger the workflow
gh workflow run deploy.yml

# Watch the deployment
gh run watch
```

## Troubleshooting

If you still get authentication errors:

1. **Error: "Authentication error [code: 10000]"**
   - Token doesn't have required permissions
   - Token is expired or invalid
   - Wrong account ID

2. **Error: "workers.api.error.service_not_found"**
   - Worker name doesn't exist
   - Account ID mismatch

3. **Verify Token Permissions**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Find your token and click "Roll" to regenerate if needed
   - Ensure all required permissions are enabled

## Current Configuration

- **Worker Name:** `pitchey-api-prod`
- **Account ID:** `002bd5c0e90ae753a387c60546cf6869`
- **Alternative Worker:** `pitchey-api` (on ndlovucavelle subdomain)