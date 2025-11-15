# GitHub Secrets Configuration

This document outlines the required GitHub secrets for the CI/CD pipeline.

## Required Secrets

### 🔑 Deployment Tokens
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DENO_DEPLOY_TOKEN` | Deno Deploy API token for automated deployments | `ddp_abcd1234...` |
| `DENO_DEPLOY_PROJECT_STAGING` | Staging project name on Deno Deploy | `pitchey-api-staging` |
| `DENO_DEPLOY_PROJECT_PROD` | Production project name on Deno Deploy | `pitchey-api-production` |

### 🗄️ Database Configuration  
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DATABASE_URL_STAGING` | Staging database connection string | `postgresql://user:pass@staging-db.com/pitchey` |
| `DATABASE_URL_PROD` | Production database connection string | `postgresql://user:pass@prod-db.com/pitchey` |

### 🔐 Authentication & Security
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `JWT_SECRET_STAGING` | JWT signing secret for staging | `staging-super-secret-key-256-bits-long` |
| `JWT_SECRET_PROD` | JWT signing secret for production | `production-super-secret-key-256-bits-long` |

### 📊 Monitoring & Observability
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `SENTRY_DSN` | Sentry error tracking DSN | Optional |
| `SLACK_WEBHOOK` | Slack webhook for deployment notifications | Optional |

### 🚀 Performance & Caching
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `REDIS_URL_STAGING` | Staging Redis connection string | Optional |
| `REDIS_URL_PROD` | Production Redis connection string | Optional |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Optional |

### 🌐 Environment URLs
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `STAGING_URL` | Staging environment URL | `https://staging-api.pitchey.com` |
| `PRODUCTION_URL` | Production environment URL | `https://api.pitchey.com` |
| `API_URL` | Default API URL for frontend builds | `https://api.pitchey.com` |

## Setting Up Secrets

### 1. Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name and value

### 2. Via GitHub CLI

\`\`\`bash
# Set deployment secrets
gh secret set DENO_DEPLOY_TOKEN --body "your_deno_deploy_token"
gh secret set DENO_DEPLOY_PROJECT_STAGING --body "pitchey-api-staging"
gh secret set DENO_DEPLOY_PROJECT_PROD --body "pitchey-api-production"

# Set database secrets
gh secret set DATABASE_URL_STAGING --body "postgresql://user:pass@staging-db/pitchey"
gh secret set DATABASE_URL_PROD --body "postgresql://user:pass@prod-db/pitchey"

# Set authentication secrets
gh secret set JWT_SECRET_STAGING --body "$(openssl rand -base64 64)"
gh secret set JWT_SECRET_PROD --body "$(openssl rand -base64 64)"

# Set monitoring secrets
gh secret set SENTRY_DSN --body "https://your-dsn@sentry.io/project-id"
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/..."

# Set environment URLs
gh secret set STAGING_URL --body "https://staging-api.pitchey.com"
gh secret set PRODUCTION_URL --body "https://api.pitchey.com"
\`\`\`

## Environment-Specific Configuration

### Staging Environment
- **Purpose**: Testing and QA validation before production
- **Database**: Separate staging database with test data
- **Authentication**: Weaker JWT secrets acceptable
- **Monitoring**: Optional but recommended
- **Caching**: Optional Redis instance

### Production Environment  
- **Purpose**: Live production system serving real users
- **Database**: Production database with real data
- **Authentication**: Strong JWT secrets (64+ characters)
- **Monitoring**: Required for observability and alerting
- **Caching**: Recommended for performance

## Security Best Practices

### 🔐 Secret Generation
\`\`\`bash
# Generate strong JWT secrets
openssl rand -base64 64

# Generate UUID for session secrets
uuidgen

# Generate hex secrets
openssl rand -hex 32
\`\`\`

### 🛡️ Secret Management
- **Rotation**: Rotate secrets quarterly or after security incidents
- **Access**: Limit access to secrets to authorized team members only
- **Validation**: Never log or expose secrets in application code
- **Backup**: Maintain secure backup of critical secrets

### ⚠️ Common Security Issues
- ❌ Using weak or short secrets
- ❌ Sharing secrets in chat or email
- ❌ Hardcoding secrets in source code
- ❌ Using same secrets across environments
- ❌ Not rotating secrets regularly

### ✅ Security Checklist
- [ ] All secrets are at least 32 characters long
- [ ] Staging and production use different secrets
- [ ] JWT secrets are cryptographically strong
- [ ] Database credentials have minimal required permissions
- [ ] Monitoring secrets are configured for alerting
- [ ] Secrets are documented but values are not shared
- [ ] Regular secret rotation schedule is established

## Troubleshooting

### Common Issues

**❌ "Missing secret" error in workflow**
- Verify the secret name matches exactly (case-sensitive)
- Check that the secret is set at the repository level, not organization level
- Ensure the secret value is not empty

**❌ "Invalid token" during deployment**
- Verify the Deno Deploy token has correct permissions
- Check that the token hasn't expired
- Confirm the project names match exactly

**❌ Database connection failures**
- Verify database URL format and credentials
- Check network access from GitHub Actions runners
- Ensure database accepts connections from external IPs

### Debug Commands

\`\`\`bash
# List all secrets (names only, not values)
gh secret list

# Test secret access in workflow
echo "Secret length: \${#SECRET_NAME}"

# Validate JWT secret strength
echo "\$JWT_SECRET" | wc -c  # Should be 64+ characters
\`\`\`

## Workflow Integration

The secrets are automatically injected into the CI/CD workflow environments:

\`\`\`yaml
env:
  DATABASE_URL: \${{ secrets.DATABASE_URL_PROD }}
  JWT_SECRET: \${{ secrets.JWT_SECRET_PROD }}
  SENTRY_DSN: \${{ secrets.SENTRY_DSN }}
\`\`\`

For more information about the CI/CD pipeline, see [ci-cd.yml](./workflows/ci-cd.yml).