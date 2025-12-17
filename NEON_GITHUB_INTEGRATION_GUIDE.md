# Neon + GitHub Integration Setup Guide

## Why GitHub Integration is Perfect for Your Situation

✅ **Automatic branch creation** for each PR
✅ **Isolated test environments** with real data
✅ **Automatic cleanup** when PRs are merged
✅ **Secure credentials** managed by Neon
✅ **Zero manual password management**

## Step 1: Connect GitHub to Neon

### In Neon Console:
1. Go to your project dashboard
2. Click **"Integrations"** in the sidebar
3. Click **"GitHub"**
4. Click **"Connect GitHub"**
5. Authorize Neon to access your repository
6. Select repository: `supremeisbeing/pitcheymovie` (or your repo name)

## Step 2: Configure Branch Settings

### Recommended Configuration:
```yaml
Branch naming: pr-{PR_NUMBER}
Parent branch: main
Data: Current data (includes all data at branch point)
Auto-delete: After PR merge (saves space)
```

### In Neon Console:
1. After connecting GitHub, click **"Configure"**
2. Set these options:
   - ✅ **Create branch for each pull request**
   - ✅ **Delete branch when PR is closed**
   - ✅ **Include current data**
   - Branch name template: `pr-{number}` or `dev-{number}`

## Step 3: Set Up GitHub Actions

Create `.github/workflows/neon-preview.yml`:

```yaml
name: Neon Database Preview
on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  setup-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Get Neon Branch
        id: neon
        uses: neondatabase/action-branch-preview@v1
        with:
          api_key: ${{ secrets.NEON_API_KEY }}
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          branch_name: preview-${{ github.event.pull_request.number }}
          
      - name: Run Migrations
        run: |
          DATABASE_URL="${{ steps.neon.outputs.database_url }}"
          npm run migrate
        env:
          DATABASE_URL: ${{ steps.neon.outputs.database_url }}
          
      - name: Update Preview Environment
        run: |
          echo "DATABASE_URL=${{ steps.neon.outputs.database_url }}" >> $GITHUB_ENV
          
      - name: Comment PR with Database URL
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Neon Preview Database Ready!\n\nBranch: `${{ steps.neon.outputs.branch_name }}`\nEndpoint: `${{ steps.neon.outputs.host }}`'
            })
```

## Step 4: Add GitHub Secrets

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

```bash
NEON_API_KEY=<get-from-neon-console-account-settings>
NEON_PROJECT_ID=<your-project-id>
CLOUDFLARE_API_TOKEN=<your-cloudflare-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

## Step 5: Production Deployment Workflow

Create `.github/workflows/production-deploy.yml`:

```yaml
name: Production Deployment
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install Dependencies
        run: npm ci
        
      - name: Run Tests
        run: npm test
        env:
          DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
          
      - name: Deploy to Cloudflare
        run: |
          npm install -g wrangler
          wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Step 6: Cloudflare Pages + Neon Integration

For automatic preview deployments:

### In Cloudflare Pages:
1. Go to your Pages project
2. Settings → Environment variables
3. Add for **Preview** environment:
   ```
   DATABASE_URL=${NEON_BRANCH_DATABASE_URL}
   ```

### In your build configuration:
```javascript
// wrangler.toml
[env.preview]
vars = { ENVIRONMENT = "preview" }

[[env.preview.hyperdrive]]
binding = "HYPERDRIVE"
id = "preview-hyperdrive-id"
```

## Step 7: Automatic Branch Management

### Create `.neon/config.yml`:
```yaml
branches:
  - name: production
    protected: true
    
  - name: staging
    parent: production
    auto_delete: false
    
  - name: preview-*
    parent: production
    auto_delete: true
    delete_after: "3d"  # Delete after 3 days of inactivity
    
migration_files:
  - src/db/migrations/*.sql
  
on_branch_create:
  - run: npm run migrate:latest
  - run: npm run seed:preview
```

## Benefits of This Setup

### 1. **Security**
- No hardcoded credentials in code
- Each PR gets isolated credentials
- Automatic credential rotation

### 2. **Development Workflow**
```
PR Created → Neon branch created → Preview deployed → Testing → Merge → Branch deleted
```

### 3. **Cost Optimization**
- Branches only use storage for changes
- Auto-delete after PR merge
- Share base data from parent branch

### 4. **Testing**
- Each PR tests against real data structure
- No production data corruption risk
- Easy rollback if needed

## Example PR Workflow

1. **Developer creates PR**:
   ```bash
   git checkout -b feature/new-feature
   git push origin feature/new-feature
   ```

2. **Automatic actions**:
   - Neon creates branch `pr-123`
   - GitHub Action runs migrations
   - Cloudflare deploys preview
   - Comment added to PR with preview URL

3. **PR Description gets updated**:
   ```
   Preview: https://pr-123.pitchey.pages.dev
   Database: pr-123 (Neon branch)
   ```

4. **After merge**:
   - Branch automatically deleted
   - Resources cleaned up
   - Production updated

## Migration Management

### For each PR with database changes:
```sql
-- migrations/001_add_new_feature.sql
-- UP
CREATE TABLE IF NOT EXISTS new_feature (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255)
);

-- DOWN
DROP TABLE IF EXISTS new_feature;
```

### GitHub Action runs automatically:
```bash
DATABASE_URL=<neon-branch-url> npm run migrate up
```

## Environment Variables Setup

### Development (`.env.development`):
```bash
DATABASE_URL=<neon-dev-branch>
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Preview (automatic from Neon):
```bash
DATABASE_URL=<auto-generated-per-pr>
NEXT_PUBLIC_API_URL=https://pr-{number}.pitchey.pages.dev
```

### Production (`.env.production`):
```bash
DATABASE_URL=<neon-main-branch>
NEXT_PUBLIC_API_URL=https://pitchey.pages.dev
```

## Quick Start Commands

```bash
# 1. Get your Neon API key
# Go to: https://console.neon.tech → Account Settings → API Keys

# 2. Get your Project ID
# In Neon Console → Your Project → Settings → General → Project ID

# 3. Add to GitHub Secrets
gh secret set NEON_API_KEY
gh secret set NEON_PROJECT_ID
gh secret set NEON_DATABASE_URL  # Your production branch URL

# 4. Enable integration
# Push this file and create a PR to test!
```

## Troubleshooting

### Branch not creating?
- Check GitHub integration in Neon Console
- Verify API key has correct permissions
- Check GitHub Actions logs

### Connection failing?
- Ensure pooled connection is used
- Add `?sslmode=require` to connection string
- Check if branch is active (not suspended)

### Cleanup not working?
- Check auto-delete settings in Neon
- Verify GitHub webhook is configured
- Manual cleanup: `neonctl branches delete <branch-name>`

## Security Best Practices

1. **Never commit `.env` files**
2. **Use GitHub Secrets for sensitive data**
3. **Rotate API keys every 90 days**
4. **Use branch protection rules on main**
5. **Enable Neon audit logs**

## Resources

- [Neon GitHub Integration Docs](https://neon.tech/docs/guides/github-integration)
- [Neon API Reference](https://api-docs.neon.tech)
- [GitHub Actions for Neon](https://github.com/neondatabase/actions)
- [Cloudflare Pages GitHub Integration](https://developers.cloudflare.com/pages/platform/github-integration)

This setup gives you enterprise-grade database branching with zero manual management!