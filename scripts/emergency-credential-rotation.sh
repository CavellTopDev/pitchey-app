#!/bin/bash

# Emergency Credential Rotation Script
# CRITICAL: Run this IMMEDIATELY to secure exposed credentials

set -e

echo "🚨 EMERGENCY CREDENTIAL ROTATION STARTED 🚨"
echo "================================================"
echo "This script will rotate all exposed production credentials"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

echo -e "${YELLOW}⚠️  STEP 1: Generate new secure credentials${NC}"
echo "================================================"

# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo -e "${GREEN}✅ New JWT secret generated${NC}"

# Generate new database password (you'll need to update this in Neon dashboard)
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr '+/' '-_')
echo -e "${GREEN}✅ New database password generated${NC}"

# Store credentials temporarily in secure file
TEMP_CREDS_FILE=".credentials.tmp"
cat > $TEMP_CREDS_FILE << EOF
NEW_JWT_SECRET=$NEW_JWT_SECRET
NEW_DB_PASSWORD=$NEW_DB_PASSWORD
EOF

echo ""
echo -e "${YELLOW}⚠️  STEP 2: Update Cloudflare Workers secrets${NC}"
echo "================================================"

# Set new secrets in Cloudflare (will prompt for authentication if needed)
echo "Setting JWT_SECRET..."
echo "$NEW_JWT_SECRET" | wrangler secret put JWT_SECRET

echo "Setting DATABASE_URL (with new password)..."
# Note: You need to update the password in Neon dashboard first
echo "postgresql://neondb_owner:${NEW_DB_PASSWORD}@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL

echo "Setting UPSTASH_REDIS_REST_URL..."
wrangler secret put UPSTASH_REDIS_REST_URL

echo "Setting UPSTASH_REDIS_REST_TOKEN..."
wrangler secret put UPSTASH_REDIS_REST_TOKEN

echo ""
echo -e "${YELLOW}⚠️  STEP 3: Backup and secure wrangler.toml${NC}"
echo "================================================"

# Backup current wrangler.toml
cp wrangler.toml wrangler.toml.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Current wrangler.toml backed up${NC}"

# Replace with secure version
cp wrangler.toml.secure wrangler.toml
echo -e "${GREEN}✅ Secure wrangler.toml deployed${NC}"

# Add to .gitignore if not already there
if ! grep -q "wrangler.toml.backup" .gitignore; then
    echo "wrangler.toml.backup*" >> .gitignore
    echo ".credentials.tmp" >> .gitignore
fi

echo ""
echo -e "${YELLOW}⚠️  STEP 4: Manual actions required${NC}"
echo "================================================"
echo -e "${RED}CRITICAL: Complete these steps manually:${NC}"
echo ""
echo "1. Update Neon Database password:"
echo "   - Go to: https://console.neon.tech"
echo "   - Navigate to your database settings"
echo "   - Update password to: ${NEW_DB_PASSWORD}"
echo ""
echo "2. Update Upstash Redis credentials:"
echo "   - Go to: https://console.upstash.com"
echo "   - Regenerate REST API tokens"
echo "   - Update in Cloudflare dashboard"
echo ""
echo "3. Update any CI/CD pipelines:"
echo "   - GitHub Secrets"
echo "   - Environment variables"
echo "   - Deployment scripts"
echo ""
echo "4. Notify team members:"
echo "   - Send secure communication about rotation"
echo "   - Update internal documentation"
echo "   - Schedule key rotation reminders"
echo ""

echo -e "${YELLOW}⚠️  STEP 5: Verify deployment${NC}"
echo "================================================"

read -p "Have you completed the manual steps above? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying with new credentials..."
    wrangler deploy
    
    echo ""
    echo -e "${GREEN}✅ CREDENTIAL ROTATION COMPLETE${NC}"
    echo "================================================"
    echo "New credentials are now active in production."
    echo ""
    echo -e "${RED}IMPORTANT: Destroy temporary credentials file${NC}"
    shred -vfz $TEMP_CREDS_FILE 2>/dev/null || rm -f $TEMP_CREDS_FILE
    echo ""
    echo "Next steps:"
    echo "1. Monitor application for any authentication issues"
    echo "2. Test all authentication endpoints"
    echo "3. Verify database connectivity"
    echo "4. Check Redis cache operations"
else
    echo -e "${RED}❌ Rotation cancelled. Please complete manual steps first.${NC}"
    echo "Temporary credentials saved in: $TEMP_CREDS_FILE"
    echo "Re-run this script when ready."
    exit 1
fi

echo ""
echo -e "${GREEN}🔒 Security Recommendations:${NC}"
echo "- Enable audit logging for all credential access"
echo "- Set up automated rotation every 90 days"
echo "- Use separate credentials for each environment"
echo "- Implement break-glass procedures for emergency access"
echo "- Review access logs for any suspicious activity from the exposure period"

# Create rotation schedule
cat > rotation-schedule.md << EOF
# Credential Rotation Schedule

## Last Rotation
Date: $(date)
Reason: Emergency - Exposed credentials in repository

## Next Scheduled Rotation
Date: $(date -d "+90 days" 2>/dev/null || date -v +90d)
Type: Regular quarterly rotation

## Rotation Checklist
- [ ] Generate new credentials
- [ ] Update Cloudflare secrets
- [ ] Update database passwords
- [ ] Update Redis tokens
- [ ] Test all services
- [ ] Update documentation
- [ ] Notify team

## Emergency Contacts
- Security Team: security@pitchey.com
- DevOps On-Call: Use PagerDuty
- CTO: Direct Slack message
EOF

echo ""
echo "Rotation schedule saved to: rotation-schedule.md"
echo ""
echo "═══════════════════════════════════════════════"
echo "   CREDENTIAL ROTATION COMPLETED SUCCESSFULLY"
echo "═══════════════════════════════════════════════"