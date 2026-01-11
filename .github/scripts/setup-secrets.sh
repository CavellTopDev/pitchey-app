#!/bin/bash

# GitHub Secrets Setup Script for Pitchey CI/CD Pipeline
# This script provides instructions for setting up required GitHub secrets

echo "🔐 Pitchey CI/CD Pipeline - GitHub Secrets Setup"
echo "================================================"

# Function to display secret requirement
display_secret() {
    local name=$1
    local description=$2
    local example=$3
    
    echo ""
    echo "Secret: $name"
    echo "Description: $description"
    echo "Example: $example"
    echo "Command: gh secret set $name"
    echo "---"
}

echo ""
echo "The following secrets need to be configured in GitHub:"
echo ""

# Core Infrastructure Secrets
echo "🏗️  CORE INFRASTRUCTURE"
display_secret "CLOUDFLARE_API_TOKEN" "Cloudflare API token with Workers and Pages permissions" "abc123..."
display_secret "CLOUDFLARE_ACCOUNT_ID" "Cloudflare Account ID" "def456..."

# Database Secrets
echo "🗄️  DATABASE"
display_secret "NEON_DATABASE_URL" "Neon PostgreSQL connection string for production" "postgresql://user:pass@host/db"
display_secret "NEON_DATABASE_URL_STAGING" "Neon PostgreSQL connection string for staging" "postgresql://user:pass@host/db"

# Cache Secrets
echo "⚡ CACHE"
display_secret "UPSTASH_REDIS_REST_URL" "Upstash Redis REST URL for production" "https://..."
display_secret "UPSTASH_REDIS_REST_TOKEN" "Upstash Redis REST token for production" "token123"
display_secret "UPSTASH_REDIS_REST_URL_STAGING" "Upstash Redis REST URL for staging" "https://..."
display_secret "UPSTASH_REDIS_REST_TOKEN_STAGING" "Upstash Redis REST token for staging" "token456"

# Authentication Secrets
echo "🔑 AUTHENTICATION"
display_secret "JWT_SECRET" "JWT secret key for authentication" "your-super-secret-key"

# Monitoring & Error Tracking
echo "📊 MONITORING"
display_secret "SENTRY_DSN" "Sentry DSN for error tracking" "https://..."
display_secret "SENTRY_AUTH_TOKEN" "Sentry authentication token" "token123"
display_secret "SENTRY_ORG" "Sentry organization name" "your-org"
display_secret "SENTRY_PROJECT" "Sentry project name" "pitchey"

# Code Quality
echo "🔍 CODE QUALITY"
display_secret "SONAR_TOKEN" "SonarCloud authentication token" "token123"
display_secret "LHCI_GITHUB_APP_TOKEN" "Lighthouse CI GitHub App token (optional)" "token123"

# Notifications
echo "📢 NOTIFICATIONS"
display_secret "SLACK_WEBHOOK" "Slack webhook URL for deployment notifications" "https://hooks.slack.com/..."
display_secret "ALERT_EMAIL" "Email address for critical alerts (optional)" "alerts@yourcompany.com"

echo ""
echo "🛠️  SETUP INSTRUCTIONS"
echo "====================="
echo ""
echo "1. Install GitHub CLI if not already installed:"
echo "   https://cli.github.com/"
echo ""
echo "2. Authenticate with GitHub:"
echo "   gh auth login"
echo ""
echo "3. Set each secret using the commands shown above:"
echo "   gh secret set SECRET_NAME"
echo "   # Enter the secret value when prompted"
echo ""
echo "4. Verify secrets are set:"
echo "   gh secret list"
echo ""
echo "5. Optional: Set environment-specific secrets:"
echo "   gh secret set SECRET_NAME --env staging"
echo "   gh secret set SECRET_NAME --env production"
echo ""

echo "📋 VERIFICATION CHECKLIST"
echo "========================="
echo ""
echo "After setting up secrets, verify the following:"
echo "- [ ] All required secrets are set in GitHub"
echo "- [ ] Cloudflare API token has correct permissions"
echo "- [ ] Database URLs are accessible"
echo "- [ ] Redis instances are reachable"
echo "- [ ] Sentry project is configured"
echo "- [ ] SonarCloud project is set up"
echo "- [ ] Slack webhook is working (test message)"
echo ""

echo "🚀 NEXT STEPS"
echo "============="
echo ""
echo "1. Commit and push your changes"
echo "2. Create a pull request to test CI pipeline"
echo "3. Verify all CI checks pass"
echo "4. Merge to main to test CD pipeline"
echo "5. Monitor deployment and alerts"
echo ""

echo "📚 DOCUMENTATION"
echo "================"
echo ""
echo "For more information, see:"
echo "- README.md - General project setup"
echo "- docs/CI_CD_PIPELINE.md - Detailed pipeline documentation"
echo "- .github/workflows/ - Individual workflow files"
echo ""

# Check if running in CI
if [[ -n "$GITHUB_ACTIONS" ]]; then
    echo "ℹ️  This script is running in GitHub Actions"
    echo "Secrets should already be configured for CI/CD pipelines"
fi

echo "✅ Setup instructions displayed successfully!"
echo "Follow the steps above to configure your CI/CD pipeline."