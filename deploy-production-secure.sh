#!/bin/bash
# Production Security-Hardened Deployment Script
# Run this script to deploy Pitchey with full security measures

set -e

echo "🔒 Pitchey Production Security Deployment"
echo "========================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install with: npm install -g wrangler${NC}"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Wrangler. Please run: wrangler auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Security validation
echo -e "${BLUE}🔐 Performing security validation...${NC}"

# Check if JWT secret is properly configured
if grep -q "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz-PRODUCTION" wrangler-production-secure.toml; then
    echo -e "${YELLOW}⚠️  Using default JWT secret. Consider generating a new one for production.${NC}"
fi

# Validate worker code for security issues
echo -e "${BLUE}🛡️  Validating worker security...${NC}"

# Check for wildcard CORS (should be fixed)
if grep -q "Access-Control-Allow-Origin.*\*" src/worker-platform-fixed.ts; then
    echo -e "${RED}❌ Wildcard CORS detected. This should be fixed.${NC}"
    exit 1
fi

# Check for rate limiting implementation
if ! grep -q "RATE_LIMITS" src/worker-platform-fixed.ts; then
    echo -e "${RED}❌ Rate limiting not implemented.${NC}"
    exit 1
fi

# Check for security headers
if ! grep -q "SECURITY_HEADERS" src/worker-platform-fixed.ts; then
    echo -e "${RED}❌ Security headers not implemented.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Security validation passed${NC}"

# Deploy worker
echo -e "${BLUE}🚀 Deploying worker...${NC}"
wrangler deploy --config wrangler-production-secure.toml

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worker deployed successfully${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    exit 1
fi

# Test deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"

WORKER_URL="https://pitchey-production-secure.cavelltheleaddev.workers.dev"

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$WORKER_URL/api/health" || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Health check response: $HEALTH_RESPONSE${NC}"
fi

# Test CORS headers
echo "Testing CORS headers..."
CORS_RESPONSE=$(curl -s -I -H "Origin: https://pitchey.pages.dev" "$WORKER_URL/api/health" || echo "failed")

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin: https://pitchey.pages.dev"; then
    echo -e "${GREEN}✅ CORS configuration correct${NC}"
else
    echo -e "${YELLOW}⚠️  CORS headers: $CORS_RESPONSE${NC}"
fi

# Test rate limiting
echo "Testing rate limiting..."
for i in {1..6}; do
    RATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/api/auth/creator/login" -X POST -H "Content-Type: application/json" -d '{}' || echo "000")
done

if [ "$RATE_RESPONSE" = "429" ]; then
    echo -e "${GREEN}✅ Rate limiting is working${NC}"
else
    echo -e "${YELLOW}⚠️  Rate limiting may not be working properly${NC}"
fi

# Test monitoring endpoint
echo "Testing monitoring endpoint..."
MONITOR_RESPONSE=$(curl -s "$WORKER_URL/api/monitoring/status" || echo "failed")

if echo "$MONITOR_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Monitoring endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Monitoring response: $MONITOR_RESPONSE${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Production deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "• Worker URL: $WORKER_URL"
echo "• Security features: Rate limiting, CORS, CSP, Security headers"
echo "• Monitoring: /api/monitoring/status"
echo "• Health check: /api/health"
echo "• Metrics: /api/metrics (admin only)"
echo ""
echo -e "${YELLOW}🔧 Next Steps:${NC}"
echo "1. Update frontend .env.production with new worker URL"
echo "2. Configure Cloudflare dashboard settings (see CLOUDFLARE_SECURITY_CONFIG.md)"
echo "3. Set up external monitoring alerts"
echo "4. Test all application features"
echo "5. Monitor logs for any issues"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "• Security features: Check SECURITY_AUDIT_REPORT.md"
echo "• Monitoring setup: Check PRODUCTION_MONITORING_GUIDE.md"
echo "• Cloudflare config: Check CLOUDFLARE_SECURITY_CONFIG.md"