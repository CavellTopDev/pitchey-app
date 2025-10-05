# Security Guide - Token Management

## 🔒 Secure Token Storage System

This project uses a secure local token storage system to prevent accidental token exposure.

## File Structure

```
pitchey_v0.2/
├── .env.local.secrets    # YOUR TOKENS GO HERE (gitignored)
├── .env.deploy           # Production config (no secrets)
├── .gitignore            # Ensures secrets never get committed
└── deploy-secure.sh      # Deployment script that uses local tokens
```

## Setup Instructions

### 1. Create Your Local Secrets File

The `.env.local.secrets` file is where you store sensitive tokens. This file is:
- ✅ In `.gitignore` (will NEVER be pushed to GitHub)
- ✅ Local to your machine only
- ✅ Not tracked by git

### 2. Add Your Token

1. Get your Deno Deploy token:
   - Go to: https://dash.deno.com/account#access-tokens
   - Click "New Access Token"
   - Name it (e.g., "Local Deploy")
   - Copy the token

2. Edit `.env.local.secrets`:
   ```bash
   # Open the file
   nano .env.local.secrets
   
   # Replace 'your_actual_token_here' with your actual token
   DENO_DEPLOY_TOKEN=ddp_YOUR_ACTUAL_TOKEN_HERE
   ```

3. Save and close the file

### 3. Deploy Using Secure Script

```bash
# Run the secure deployment
./deploy-secure.sh
```

This script will:
- Load your token from `.env.local.secrets`
- Deploy to Deno Deploy
- Never expose your token in logs or history

## Security Checklist

### ✅ Files That Are Safe (Gitignored)
- `.env.local.secrets` - Your tokens
- `.env.secrets` - Any other secrets
- `*.secrets` - Any file ending in .secrets
- `secrets/` - Entire secrets directory
- `.secrets/` - Hidden secrets directory

### ❌ Never Put Tokens In
- Documentation files (*.md)
- Shell scripts (unless gitignored)
- Source code files
- GitHub Actions workflows (use GitHub Secrets instead)
- Any file tracked by git

## Verify Security

### Check if a file is gitignored:
```bash
git check-ignore .env.local.secrets
# Should output: .env.local.secrets (meaning it's ignored)
```

### Check what files would be committed:
```bash
git status
# .env.local.secrets should NEVER appear here
```

### Search for exposed tokens:
```bash
# This should return nothing
git grep "ddp_" 
```

## Token Rotation

If a token is ever exposed:

1. **Immediately revoke it**:
   - Go to: https://dash.deno.com/account#access-tokens
   - Find the exposed token
   - Click "Revoke" or "Delete"

2. **Generate new token**:
   - Click "New Access Token"
   - Copy the new token

3. **Update local secrets**:
   ```bash
   nano .env.local.secrets
   # Update with new token
   ```

4. **Update GitHub Secrets** (if using CI/CD):
   - Go to: https://github.com/YOUR_REPO/settings/secrets/actions
   - Update `DENO_DEPLOY_TOKEN`

## Alternative: Environment Variable

You can also use an environment variable instead of the file:

```bash
# Set for current session
export DENO_DEPLOY_TOKEN="your_token_here"

# Deploy
./deploy-secure.sh
```

Or add to your shell profile (`~/.bashrc` or `~/.zshrc`):
```bash
export DENO_DEPLOY_TOKEN="your_token_here"
```

## GitHub Actions

For GitHub Actions, use GitHub Secrets:
1. Go to repository Settings → Secrets
2. Add `DENO_DEPLOY_TOKEN`
3. Reference in workflow: `${{ secrets.DENO_DEPLOY_TOKEN }}`

## Best Practices

1. **Rotate tokens regularly** (every 3-6 months)
2. **Use different tokens** for local vs CI/CD
3. **Monitor for exposures** with GitGuardian
4. **Never share tokens** via email, Slack, etc.
5. **Use password managers** to store tokens

## Emergency Contacts

- **Token Exposed**: Revoke immediately at https://dash.deno.com
- **GitGuardian Alert**: Check email for security@getgitguardian.com
- **Deno Support**: support@deno.com

## Summary

Your tokens are now stored in `.env.local.secrets` which:
- ✅ Is completely local to your machine
- ✅ Will NEVER be pushed to GitHub
- ✅ Is loaded by `deploy-secure.sh` for deployments
- ✅ Is protected by multiple .gitignore rules

This is the safest way to manage tokens locally!