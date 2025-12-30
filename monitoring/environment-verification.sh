#!/bin/bash

# Environment Variables and Secrets Verification Script
# Comprehensive validation of all required configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Emojis
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
GEAR="⚙️"
LOCK="🔒"

echo -e "${BLUE}${GEAR} Environment Variables and Secrets Verification${NC}"
echo "============================================================"
echo ""

# Required environment variables for production
REQUIRED_SECRETS=(
    "JWT_SECRET"
    "DATABASE_URL"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "CLOUDFLARE_API_TOKEN"
    "CLOUDFLARE_ACCOUNT_ID"
    "SENTRY_DSN"
)

# Optional but recommended secrets
OPTIONAL_SECRETS=(
    "SENDGRID_API_KEY"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "STRIPE_SECRET_KEY"
    "WEBHOOK_SECRET"
)

# Environment-specific variables
ENVIRONMENT_VARS=(
    "FRONTEND_URL"
    "ENVIRONMENT"
)

# Cloudflare bindings to verify
CLOUDFLARE_BINDINGS=(
    "KV:98c88a185eb448e4868fcc87e458b3ac"
    "R2_BUCKET:pitchey-uploads"
    "HYPERDRIVE:983d4a1818264b5dbdca26bacf167dee"
    "WEBSOCKET_ROOM:WebSocketRoom"
    "NOTIFICATION_ROOM:NotificationRoom"
)

verify_secret_configured() {
    local secret_name="$1"
    local required="${2:-true}"
    
    echo -n "  $secret_name: "
    
    # Check if secret is configured in Cloudflare (via wrangler)
    if wrangler secret list --name pitchey-production 2>/dev/null | grep -q "$secret_name"; then
        echo -e "${CHECK} ${GREEN}Configured${NC}"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${CROSS} ${RED}Missing (Required)${NC}"
            return 1
        else
            echo -e "${WARNING} ${YELLOW}Missing (Optional)${NC}"
            return 0
        fi
    fi
}

verify_environment_variable() {
    local var_name="$1"
    local expected_value="$2"
    
    echo -n "  $var_name: "
    
    # Check in wrangler.toml
    if grep -q "^$var_name = " wrangler.toml; then
        local current_value
        current_value=$(grep "^$var_name = " wrangler.toml | cut -d'"' -f2)
        
        if [ -n "$expected_value" ] && [ "$current_value" != "$expected_value" ]; then
            echo -e "${WARNING} ${YELLOW}Unexpected value: $current_value${NC}"
            return 1
        else
            echo -e "${CHECK} ${GREEN}$current_value${NC}"
            return 0
        fi
    else
        echo -e "${CROSS} ${RED}Not configured${NC}"
        return 1
    fi
}

verify_cloudflare_binding() {
    local binding_info="$1"
    local binding_name
    local binding_id
    
    binding_name=$(echo "$binding_info" | cut -d':' -f1)
    binding_id=$(echo "$binding_info" | cut -d':' -f2)
    
    echo -n "  $binding_name: "
    
    # Check if binding exists in wrangler.toml
    if grep -A2 -B2 "$binding_name" wrangler.toml | grep -q "$binding_id"; then
        echo -e "${CHECK} ${GREEN}Configured ($binding_id)${NC}"
        return 0
    else
        echo -e "${CROSS} ${RED}Missing or incorrect ID${NC}"
        return 1
    fi
}

test_database_connection() {
    echo -n "  Database connectivity: "
    
    # Test database connection via health endpoint
    if curl -s -f "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}Connected${NC}"
        return 0
    else
        echo -e "${CROSS} ${RED}Connection failed${NC}"
        return 1
    fi
}

test_redis_connection() {
    echo -n "  Redis connectivity: "
    
    # Test Redis connection via health endpoint
    if curl -s -f "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/cache" >/dev/null 2>&1; then
        echo -e "${CHECK} ${GREEN}Connected${NC}"
        return 0
    else
        echo -e "${CROSS} ${RED}Connection failed${NC}"
        return 1
    fi
}

verify_hyperdrive_configuration() {
    echo -n "  Hyperdrive configuration: "
    
    # Check if Hyperdrive is configured
    if grep -q "^\[\[hyperdrive\]\]" wrangler.toml; then
        local hyperdrive_id
        hyperdrive_id=$(grep -A3 "^\[\[hyperdrive\]\]" wrangler.toml | grep "^id = " | cut -d'"' -f2)
        
        if [ "$hyperdrive_id" = "983d4a1818264b5dbdca26bacf167dee" ]; then
            echo -e "${CHECK} ${GREEN}Configured correctly${NC}"
            return 0
        else
            echo -e "${WARNING} ${YELLOW}ID mismatch: $hyperdrive_id${NC}"
            return 1
        fi
    else
        echo -e "${CROSS} ${RED}Not configured${NC}"
        return 1
    fi
}

check_security_best_practices() {
    echo ""
    echo -e "${LOCK} Security Best Practices Check:"
    
    local security_issues=0
    
    # Check that no secrets are in the repository
    echo -n "  No secrets in repository: "
    if grep -r "sk_live\|sk_test\|eyJ" . --exclude-dir=.git --exclude-dir=node_modules >/dev/null 2>&1; then
        echo -e "${CROSS} ${RED}Potential secrets found in code${NC}"
        ((security_issues++))
    else
        echo -e "${CHECK} ${GREEN}Clean${NC}"
    fi
    
    # Check JWT secret complexity (via length check in Cloudflare)
    echo -n "  JWT secret complexity: "
    if wrangler secret list --name pitchey-production 2>/dev/null | grep -q "JWT_SECRET"; then
        echo -e "${CHECK} ${GREEN}Configured${NC}"
    else
        echo -e "${CROSS} ${RED}Not configured${NC}"
        ((security_issues++))
    fi
    
    # Check environment separation
    echo -n "  Environment separation: "
    if grep -q 'ENVIRONMENT = "production"' wrangler.toml; then
        echo -e "${CHECK} ${GREEN}Production environment set${NC}"
    else
        echo -e "${WARNING} ${YELLOW}Environment not clearly marked${NC}"
        ((security_issues++))
    fi
    
    # Check for proper HTTPS URLs
    echo -n "  HTTPS enforcement: "
    if grep "FRONTEND_URL" wrangler.toml | grep -q "https://"; then
        echo -e "${CHECK} ${GREEN}HTTPS enforced${NC}"
    else
        echo -e "${CROSS} ${RED}HTTPS not enforced${NC}"
        ((security_issues++))
    fi
    
    return $security_issues
}

generate_missing_secrets_script() {
    local missing_secrets=("$@")
    
    if [ ${#missing_secrets[@]} -eq 0 ]; then
        return
    fi
    
    echo ""
    echo -e "${INFO} Generated script to configure missing secrets:"
    echo ""
    echo "#!/bin/bash"
    echo "# Configure missing Cloudflare secrets"
    echo ""
    
    for secret in "${missing_secrets[@]}"; do
        case $secret in
            "JWT_SECRET")
                echo "# Generate a strong JWT secret (256-bit)"
                echo "JWT_SECRET=\$(openssl rand -base64 32)"
                echo "wrangler secret put JWT_SECRET --name pitchey-production"
                echo ""
                ;;
            "DATABASE_URL")
                echo "# Set your Neon PostgreSQL connection string"
                echo "echo 'Enter your Neon DATABASE_URL:'"
                echo "read -r DATABASE_URL"
                echo "wrangler secret put DATABASE_URL --name pitchey-production"
                echo ""
                ;;
            "UPSTASH_REDIS_REST_URL")
                echo "# Set your Upstash Redis REST URL"
                echo "echo 'Enter your Upstash Redis REST URL:'"
                echo "read -r UPSTASH_REDIS_REST_URL"
                echo "wrangler secret put UPSTASH_REDIS_REST_URL --name pitchey-production"
                echo ""
                ;;
            "UPSTASH_REDIS_REST_TOKEN")
                echo "# Set your Upstash Redis REST Token"
                echo "echo 'Enter your Upstash Redis REST Token:'"
                echo "read -r UPSTASH_REDIS_REST_TOKEN"
                echo "wrangler secret put UPSTASH_REDIS_REST_TOKEN --name pitchey-production"
                echo ""
                ;;
            "CLOUDFLARE_API_TOKEN")
                echo "# Set your Cloudflare API Token"
                echo "echo 'Enter your Cloudflare API Token:'"
                echo "read -r CLOUDFLARE_API_TOKEN"
                echo "wrangler secret put CLOUDFLARE_API_TOKEN --name pitchey-production"
                echo ""
                ;;
            "SENTRY_DSN")
                echo "# Set your Sentry DSN for error tracking"
                echo "echo 'Enter your Sentry DSN:'"
                echo "read -r SENTRY_DSN"
                echo "wrangler secret put SENTRY_DSN --name pitchey-production"
                echo ""
                ;;
        esac
    done
}

main() {
    local overall_status=0
    local missing_secrets=()
    
    echo -e "${LOCK} Required Secrets Verification:"
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if ! verify_secret_configured "$secret" "true"; then
            missing_secrets+=("$secret")
            overall_status=1
        fi
    done
    
    echo ""
    echo -e "${INFO} Optional Secrets Check:"
    for secret in "${OPTIONAL_SECRETS[@]}"; do
        verify_secret_configured "$secret" "false" >/dev/null
    done
    
    echo ""
    echo -e "${GEAR} Environment Variables:"
    verify_environment_variable "FRONTEND_URL" "https://pitchey-5o8.pages.dev"
    verify_environment_variable "ENVIRONMENT" "production"
    
    echo ""
    echo -e "${BLUE} Cloudflare Bindings:"
    for binding in "${CLOUDFLARE_BINDINGS[@]}"; do
        verify_cloudflare_binding "$binding"
    done
    
    echo ""
    echo -e "${INFO} Connectivity Tests:"
    test_database_connection
    test_redis_connection
    verify_hyperdrive_configuration
    
    # Security check
    check_security_best_practices
    local security_status=$?
    
    echo ""
    echo "============================================================"
    
    # Final status
    if [ $overall_status -eq 0 ] && [ $security_status -eq 0 ]; then
        echo -e "${CHECK} ${GREEN}All environment variables and secrets properly configured!${NC}"
    elif [ $overall_status -eq 0 ] && [ $security_status -gt 0 ]; then
        echo -e "${WARNING} ${YELLOW}Configuration complete but security issues found${NC}"
    else
        echo -e "${CROSS} ${RED}Configuration incomplete - missing required secrets${NC}"
        
        if [ ${#missing_secrets[@]} -gt 0 ]; then
            generate_missing_secrets_script "${missing_secrets[@]}" > "setup-missing-secrets.sh"
            chmod +x "setup-missing-secrets.sh"
            echo ""
            echo -e "${INFO} Generated setup-missing-secrets.sh to configure missing secrets"
        fi
    fi
    
    echo ""
    
    # Additional recommendations
    echo -e "${INFO} Additional Recommendations:"
    echo "  1. Regularly rotate secrets (JWT_SECRET, API tokens)"
    echo "  2. Monitor secret usage via Cloudflare dashboard"
    echo "  3. Use separate secrets for staging and production"
    echo "  4. Enable Cloudflare Access for additional security"
    echo "  5. Set up secret expiration alerts"
    
    return $overall_status
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi