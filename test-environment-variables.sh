#!/bin/bash

# =============================================================================
# PITCHEY APPLICATION - ENVIRONMENT VARIABLES TEST SUITE
# =============================================================================
# Comprehensive test suite to validate environment variable configuration
# for development, staging, and production environments.
#
# Usage: ./test-environment-variables.sh [environment]
# Example: ./test-environment-variables.sh production
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0
CRITICAL_FAILURES=()
SECURITY_ISSUES=()
MISSING_VARS=()
RECOMMENDATIONS=()

# Environment to test (default: detect from DENO_ENV)
TARGET_ENV=${1:-$(echo "${DENO_ENV:-development}")}

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}PITCHEY ENVIRONMENT VARIABLES TEST SUITE${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "Target Environment: ${PURPLE}${TARGET_ENV}${NC}"
echo -e "Test Date: $(date)"
echo ""

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local severity="${4:-info}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case $status in
        "PASS")
            PASSED_TESTS=$((PASSED_TESTS + 1))
            echo -e "[${GREEN}PASS${NC}] $test_name: $message"
            ;;
        "FAIL")
            FAILED_TESTS=$((FAILED_TESTS + 1))
            echo -e "[${RED}FAIL${NC}] $test_name: $message"
            if [[ "$severity" == "critical" ]]; then
                CRITICAL_FAILURES+=("$test_name: $message")
            fi
            ;;
        "WARN")
            WARNING_TESTS=$((WARNING_TESTS + 1))
            echo -e "[${YELLOW}WARN${NC}] $test_name: $message"
            ;;
        "INFO")
            echo -e "[${BLUE}INFO${NC}] $test_name: $message"
            ;;
    esac
}

check_env_var() {
    local var_name="$1"
    local description="$2"
    local required="${3:-true}"
    local env_specific="${4:-all}"
    local security_check="${5:-false}"
    
    # Skip if not applicable to current environment
    if [[ "$env_specific" != "all" && "$env_specific" != "$TARGET_ENV" ]]; then
        return 0
    fi
    
    local value
    if command -v deno >/dev/null 2>&1; then
        value=$(deno eval "console.log(Deno.env.get('$var_name') || '')" 2>/dev/null || echo "")
    else
        value="${!var_name:-}"
    fi
    
    if [[ -z "$value" ]]; then
        if [[ "$required" == "true" ]]; then
            log_test "$var_name" "FAIL" "$description - Variable not set" "critical"
            MISSING_VARS+=("$var_name")
        else
            log_test "$var_name" "WARN" "$description - Optional variable not set"
        fi
        return 1
    fi
    
    # Security checks
    if [[ "$security_check" == "true" ]]; then
        check_security_issues "$var_name" "$value"
    fi
    
    log_test "$var_name" "PASS" "$description - Set"
    return 0
}

check_security_issues() {
    local var_name="$1"
    local value="$2"
    
    # Check for insecure default values
    case "$var_name" in
        "JWT_SECRET"|"JWT_REFRESH_SECRET")
            if [[ "$value" == "your-secret-key-change-this-in-production" ]]; then
                log_test "$var_name Security" "FAIL" "Using default/insecure JWT secret in $TARGET_ENV" "critical"
                SECURITY_ISSUES+=("$var_name: Default JWT secret detected")
                return 1
            fi
            if [[ ${#value} -lt 32 ]]; then
                log_test "$var_name Security" "FAIL" "JWT secret too short (${#value} chars, minimum 32)" "critical"
                SECURITY_ISSUES+=("$var_name: JWT secret too short")
                return 1
            fi
            ;;
        "SESSION_SECRET")
            if [[ ${#value} -lt 32 ]]; then
                log_test "$var_name Security" "WARN" "Session secret too short (${#value} chars, recommended 32+)"
                return 1
            fi
            ;;
        "DATABASE_URL")
            if [[ "$value" =~ password@localhost && "$TARGET_ENV" == "production" ]]; then
                log_test "$var_name Security" "FAIL" "Localhost database URL in production" "critical"
                SECURITY_ISSUES+=("$var_name: Localhost URL in production")
                return 1
            fi
            if [[ "$value" =~ :password@ ]]; then
                log_test "$var_name Security" "WARN" "Weak database password detected"
                return 1
            fi
            ;;
        *"API_KEY"|*"SECRET"*|*"TOKEN"*)
            if [[ "$value" =~ ^(test|demo|example|changeme) ]]; then
                log_test "$var_name Security" "FAIL" "Test/demo value in $TARGET_ENV environment" "critical"
                SECURITY_ISSUES+=("$var_name: Test/demo value detected")
                return 1
            fi
            ;;
    esac
    
    log_test "$var_name Security" "PASS" "Security check passed"
    return 0
}

validate_url_format() {
    local var_name="$1"
    local url="$2"
    local expected_scheme="$3"
    
    if [[ ! "$url" =~ ^${expected_scheme}:// ]]; then
        log_test "$var_name Format" "FAIL" "Invalid URL scheme (expected: $expected_scheme://)"
        return 1
    fi
    
    log_test "$var_name Format" "PASS" "URL format valid"
    return 0
}

check_numeric_range() {
    local var_name="$1"
    local value="$2"
    local min="$3"
    local max="$4"
    
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        log_test "$var_name Range" "FAIL" "Non-numeric value: $value"
        return 1
    fi
    
    if [[ "$value" -lt "$min" || "$value" -gt "$max" ]]; then
        log_test "$var_name Range" "FAIL" "Value $value outside valid range [$min-$max]"
        return 1
    fi
    
    log_test "$var_name Range" "PASS" "Numeric value in valid range"
    return 0
}

# =============================================================================
# CORE APPLICATION VARIABLES
# =============================================================================

test_core_variables() {
    echo -e "\n${PURPLE}=== CORE APPLICATION VARIABLES ===${NC}"
    
    check_env_var "PORT" "Application port" "false" "all" "false"
    if check_env_var "PORT" "Application port" "false" "all" "false"; then
        local port_value
        if command -v deno >/dev/null 2>&1; then
            port_value=$(deno eval "console.log(Deno.env.get('PORT') || '8001')" 2>/dev/null)
        else
            port_value="${PORT:-8001}"
        fi
        check_numeric_range "PORT" "$port_value" 1024 65535
    fi
    
    check_env_var "DENO_ENV" "Deployment environment" "false" "all" "false"
    check_env_var "ENVIRONMENT" "Environment identifier" "false" "all" "false"
    
    # Validate environment consistency
    if command -v deno >/dev/null 2>&1; then
        local deno_env=$(deno eval "console.log(Deno.env.get('DENO_ENV') || '')" 2>/dev/null)
        local environment=$(deno eval "console.log(Deno.env.get('ENVIRONMENT') || '')" 2>/dev/null)
        
        if [[ -n "$deno_env" && -n "$environment" && "$deno_env" != "$environment" ]]; then
            log_test "Environment Consistency" "WARN" "DENO_ENV ($deno_env) != ENVIRONMENT ($environment)"
        fi
    fi
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

test_database_variables() {
    echo -e "\n${PURPLE}=== DATABASE CONFIGURATION ===${NC}"
    
    if check_env_var "DATABASE_URL" "PostgreSQL connection string" "true" "all" "true"; then
        local db_url
        if command -v deno >/dev/null 2>&1; then
            db_url=$(deno eval "console.log(Deno.env.get('DATABASE_URL') || '')" 2>/dev/null)
        else
            db_url="${DATABASE_URL:-}"
        fi
        
        if [[ -n "$db_url" ]]; then
            validate_url_format "DATABASE_URL" "$db_url" "postgresql"
            
            # Check for production database requirements
            if [[ "$TARGET_ENV" == "production" ]]; then
                if [[ "$db_url" =~ localhost ]]; then
                    log_test "Database Production" "FAIL" "Localhost database in production" "critical"
                    CRITICAL_FAILURES+=("DATABASE_URL: Localhost in production")
                fi
                
                if [[ ! "$db_url" =~ sslmode=require ]]; then
                    log_test "Database SSL" "WARN" "SSL mode not explicitly required for production"
                    RECOMMENDATIONS+=("Add sslmode=require to DATABASE_URL for production")
                fi
            fi
        fi
    fi
    
    # Connection pool settings
    check_env_var "DB_POOL_MAX" "Database connection pool max size" "false" "all" "false"
    check_env_var "DB_POOL_MIN" "Database connection pool min size" "false" "all" "false"
}

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================

test_security_variables() {
    echo -e "\n${PURPLE}=== AUTHENTICATION & SECURITY ===${NC}"
    
    check_env_var "JWT_SECRET" "JWT signing secret" "true" "all" "true"
    check_env_var "JWT_REFRESH_SECRET" "JWT refresh token secret" "false" "all" "true"
    check_env_var "SESSION_SECRET" "Session encryption secret" "false" "all" "true"
    
    # Security configuration
    check_env_var "SECURE_COOKIES" "Secure cookie flag" "false" "production" "false"
    check_env_var "CORS_ORIGIN" "CORS allowed origins" "false" "all" "false"
    
    # Rate limiting
    check_env_var "RATE_LIMIT_WINDOW" "Rate limit window (ms)" "false" "all" "false"
    check_env_var "RATE_LIMIT_MAX" "Rate limit max requests" "false" "all" "false"
    
    if check_env_var "RATE_LIMIT_WINDOW" "Rate limit window" "false" "all" "false"; then
        local window_value
        if command -v deno >/dev/null 2>&1; then
            window_value=$(deno eval "console.log(Deno.env.get('RATE_LIMIT_WINDOW') || '60000')" 2>/dev/null)
        else
            window_value="${RATE_LIMIT_WINDOW:-60000}"
        fi
        check_numeric_range "RATE_LIMIT_WINDOW" "$window_value" 1000 3600000
    fi
}

# =============================================================================
# EXTERNAL SERVICES
# =============================================================================

test_aws_variables() {
    echo -e "\n${PURPLE}=== AWS SERVICES ===${NC}"
    
    check_env_var "AWS_ACCESS_KEY_ID" "AWS access key" "false" "all" "true"
    check_env_var "AWS_SECRET_ACCESS_KEY" "AWS secret key" "false" "all" "true"
    check_env_var "AWS_REGION" "AWS region" "false" "all" "false"
    
    # S3 Configuration
    check_env_var "AWS_S3_BUCKET" "S3 bucket name" "false" "all" "false"
    check_env_var "STORAGE_PROVIDER" "Storage provider (s3/local/hybrid)" "false" "all" "false"
    
    # CloudFront
    check_env_var "CLOUDFRONT_URL" "CloudFront distribution URL" "false" "all" "false"
    check_env_var "CLOUDFRONT_DISTRIBUTION_ID" "CloudFront distribution ID" "false" "all" "false"
    
    # File size limits
    check_env_var "MAX_FILE_SIZE_MB" "Maximum file size (MB)" "false" "all" "false"
    check_env_var "MAX_IMAGE_SIZE_MB" "Maximum image size (MB)" "false" "all" "false"
    check_env_var "MAX_VIDEO_SIZE_MB" "Maximum video size (MB)" "false" "all" "false"
}

test_stripe_variables() {
    echo -e "\n${PURPLE}=== STRIPE PAYMENT PROCESSING ===${NC}"
    
    check_env_var "STRIPE_SECRET_KEY" "Stripe secret key" "false" "all" "true"
    check_env_var "STRIPE_WEBHOOK_SECRET" "Stripe webhook secret" "false" "all" "true"
    
    # Subscription price IDs
    check_env_var "STRIPE_PRO_PRICE_ID" "Stripe Pro tier price ID" "false" "all" "false"
    check_env_var "STRIPE_ENTERPRISE_PRICE_ID" "Stripe Enterprise tier price ID" "false" "all" "false"
    
    # Credit packages
    check_env_var "STRIPE_CREDITS_SMALL_PRICE_ID" "Stripe small credits price ID" "false" "all" "false"
    check_env_var "STRIPE_CREDITS_MEDIUM_PRICE_ID" "Stripe medium credits price ID" "false" "all" "false"
    check_env_var "STRIPE_CREDITS_LARGE_PRICE_ID" "Stripe large credits price ID" "false" "all" "false"
    
    # Validate Stripe key format
    if command -v deno >/dev/null 2>&1; then
        local stripe_key=$(deno eval "console.log(Deno.env.get('STRIPE_SECRET_KEY') || '')" 2>/dev/null)
        if [[ -n "$stripe_key" ]]; then
            if [[ "$TARGET_ENV" == "production" && "$stripe_key" =~ ^sk_test_ ]]; then
                log_test "Stripe Environment" "FAIL" "Test key in production environment" "critical"
                CRITICAL_FAILURES+=("STRIPE_SECRET_KEY: Test key in production")
            elif [[ "$TARGET_ENV" == "development" && "$stripe_key" =~ ^sk_live_ ]]; then
                log_test "Stripe Environment" "WARN" "Live key in development environment"
            fi
        fi
    fi
}

test_email_variables() {
    echo -e "\n${PURPLE}=== EMAIL SERVICES ===${NC}"
    
    check_env_var "EMAIL_PROVIDER" "Email service provider" "false" "all" "false"
    check_env_var "EMAIL_FROM" "From email address" "false" "all" "false"
    check_env_var "EMAIL_FROM_NAME" "From email name" "false" "all" "false"
    check_env_var "EMAIL_REPLY_TO" "Reply-to email address" "false" "all" "false"
    
    # SendGrid
    check_env_var "SENDGRID_API_KEY" "SendGrid API key" "false" "all" "true"
    
    # SMTP Configuration
    check_env_var "SMTP_HOST" "SMTP server host" "false" "all" "false"
    check_env_var "SMTP_PORT" "SMTP server port" "false" "all" "false"
    check_env_var "SMTP_USER" "SMTP username" "false" "all" "false"
    check_env_var "SMTP_PASS" "SMTP password" "false" "all" "true"
    check_env_var "SMTP_SECURE" "SMTP secure connection" "false" "all" "false"
    
    # Email validation
    if command -v deno >/dev/null 2>&1; then
        local email_from=$(deno eval "console.log(Deno.env.get('EMAIL_FROM') || '')" 2>/dev/null)
        if [[ -n "$email_from" && ! "$email_from" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
            log_test "Email Format" "FAIL" "Invalid EMAIL_FROM format: $email_from"
        fi
        
        local smtp_port=$(deno eval "console.log(Deno.env.get('SMTP_PORT') || '')" 2>/dev/null)
        if [[ -n "$smtp_port" ]]; then
            check_numeric_range "SMTP_PORT" "$smtp_port" 1 65535
        fi
    fi
}

# =============================================================================
# CACHING & PERFORMANCE
# =============================================================================

test_caching_variables() {
    echo -e "\n${PURPLE}=== CACHING & PERFORMANCE ===${NC}"
    
    check_env_var "REDIS_URL" "Redis connection string" "false" "all" "false"
    
    if command -v deno >/dev/null 2>&1; then
        local redis_url=$(deno eval "console.log(Deno.env.get('REDIS_URL') || '')" 2>/dev/null)
        if [[ -n "$redis_url" ]]; then
            validate_url_format "REDIS_URL" "$redis_url" "redis"
        fi
    fi
    
    # Cache settings
    check_env_var "CACHE_TTL" "Cache time-to-live (seconds)" "false" "all" "false"
    check_env_var "SEARCH_CACHE_TTL" "Search cache TTL" "false" "all" "false"
}

# =============================================================================
# APPLICATION URLS & ENDPOINTS
# =============================================================================

test_url_variables() {
    echo -e "\n${PURPLE}=== APPLICATION URLS ===${NC}"
    
    check_env_var "APP_URL" "Application base URL" "false" "all" "false"
    check_env_var "BASE_URL" "Base URL for links" "false" "all" "false"
    
    # Validate URL formats
    if command -v deno >/dev/null 2>&1; then
        local app_url=$(deno eval "console.log(Deno.env.get('APP_URL') || '')" 2>/dev/null)
        if [[ -n "$app_url" ]]; then
            if [[ "$TARGET_ENV" == "production" ]]; then
                validate_url_format "APP_URL" "$app_url" "https"
            else
                if [[ "$app_url" =~ ^https?:// ]]; then
                    log_test "APP_URL Format" "PASS" "Valid URL format"
                else
                    log_test "APP_URL Format" "FAIL" "Invalid URL format"
                fi
            fi
        fi
    fi
}

# =============================================================================
# FEATURE FLAGS & TOGGLES
# =============================================================================

test_feature_variables() {
    echo -e "\n${PURPLE}=== FEATURE FLAGS ===${NC}"
    
    check_env_var "NDA_EXPIRATION_SERVICE" "NDA expiration service toggle" "false" "all" "false"
    check_env_var "USE_LOCAL_FALLBACK" "Local storage fallback" "false" "all" "false"
    check_env_var "MIGRATION_BATCH_SIZE" "Database migration batch size" "false" "all" "false"
    
    # Migration settings
    if command -v deno >/dev/null 2>&1; then
        local batch_size=$(deno eval "console.log(Deno.env.get('MIGRATION_BATCH_SIZE') || '10')" 2>/dev/null)
        if [[ -n "$batch_size" ]]; then
            check_numeric_range "MIGRATION_BATCH_SIZE" "$batch_size" 1 1000
        fi
    fi
}

# =============================================================================
# ENVIRONMENT-SPECIFIC CHECKS
# =============================================================================

test_production_requirements() {
    if [[ "$TARGET_ENV" != "production" ]]; then
        return 0
    fi
    
    echo -e "\n${PURPLE}=== PRODUCTION ENVIRONMENT CHECKS ===${NC}"
    
    # Critical production variables
    local prod_required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
    )
    
    for var in "${prod_required_vars[@]}"; do
        if ! check_env_var "$var" "Production required: $var" "true" "production" "true"; then
            CRITICAL_FAILURES+=("Production missing: $var")
        fi
    done
    
    # Production security checks
    if command -v deno >/dev/null 2>&1; then
        local secure_cookies=$(deno eval "console.log(Deno.env.get('SECURE_COOKIES') || 'false')" 2>/dev/null)
        if [[ "$secure_cookies" != "true" ]]; then
            log_test "Production Security" "WARN" "SECURE_COOKIES should be 'true' in production"
            RECOMMENDATIONS+=("Set SECURE_COOKIES=true for production")
        fi
    fi
}

test_development_setup() {
    if [[ "$TARGET_ENV" != "development" ]]; then
        return 0
    fi
    
    echo -e "\n${PURPLE}=== DEVELOPMENT ENVIRONMENT CHECKS ===${NC}"
    
    # Development recommendations
    if command -v deno >/dev/null 2>&1; then
        local jwt_secret=$(deno eval "console.log(Deno.env.get('JWT_SECRET') || '')" 2>/dev/null)
        if [[ "$jwt_secret" == "your-secret-key-change-this-in-production" ]]; then
            log_test "Development JWT" "INFO" "Using default JWT secret (acceptable for development)"
        fi
    fi
    
    # Check for .env files
    local env_files=(".env" ".env.local" ".env.development")
    for file in "${env_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_test "Env File" "PASS" "Found $file"
        else
            log_test "Env File" "INFO" "$file not found (optional)"
        fi
    done
}

# =============================================================================
# CONFIGURATION CONSISTENCY CHECKS
# =============================================================================

test_configuration_consistency() {
    echo -e "\n${PURPLE}=== CONFIGURATION CONSISTENCY ===${NC}"
    
    if ! command -v deno >/dev/null 2>&1; then
        log_test "Configuration Check" "WARN" "Deno not available, skipping consistency checks"
        return 0
    fi
    
    # Check for conflicting storage providers
    local storage_provider=$(deno eval "console.log(Deno.env.get('STORAGE_PROVIDER') || 'local')" 2>/dev/null)
    local aws_key=$(deno eval "console.log(Deno.env.get('AWS_ACCESS_KEY_ID') || '')" 2>/dev/null)
    
    if [[ "$storage_provider" == "s3" && -z "$aws_key" ]]; then
        log_test "Storage Config" "FAIL" "S3 storage selected but AWS credentials missing"
        CRITICAL_FAILURES+=("Storage: S3 provider without AWS credentials")
    fi
    
    # Check email provider consistency
    local email_provider=$(deno eval "console.log(Deno.env.get('EMAIL_PROVIDER') || '')" 2>/dev/null)
    local sendgrid_key=$(deno eval "console.log(Deno.env.get('SENDGRID_API_KEY') || '')" 2>/dev/null)
    local smtp_host=$(deno eval "console.log(Deno.env.get('SMTP_HOST') || '')" 2>/dev/null)
    
    if [[ "$email_provider" == "sendgrid" && -z "$sendgrid_key" ]]; then
        log_test "Email Config" "FAIL" "SendGrid provider selected but API key missing"
    elif [[ "$email_provider" == "smtp" && -z "$smtp_host" ]]; then
        log_test "Email Config" "FAIL" "SMTP provider selected but host missing"
    fi
    
    # Check for hardcoded fallbacks that override env vars
    check_hardcoded_overrides
}

check_hardcoded_overrides() {
    echo -e "\n${PURPLE}=== HARDCODED VALUE DETECTION ===${NC}"
    
    # Search for potentially problematic hardcoded values
    local suspicious_patterns=(
        "localhost:5432"
        "your-secret-key"
        "Demo123"
        "sk_test_"
        "test@example.com"
        "@demo.com"
    )
    
    for pattern in "${suspicious_patterns[@]}"; do
        local found_files=$(grep -r "$pattern" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | head -5)
        if [[ -n "$found_files" ]]; then
            log_test "Hardcoded Values" "WARN" "Found '$pattern' in source code"
            RECOMMENDATIONS+=("Review hardcoded value: $pattern")
        fi
    done
}

# =============================================================================
# DOCUMENTATION & ENV FILE CHECKS
# =============================================================================

check_env_documentation() {
    echo -e "\n${PURPLE}=== ENVIRONMENT DOCUMENTATION ===${NC}"
    
    # Check for environment documentation files
    local doc_files=(
        ".env.example"
        ".env.template"
        "README.md"
        "DEPLOYMENT_INSTRUCTIONS.md"
        "DEVELOPMENT_SETUP.md"
    )
    
    for file in "${doc_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_test "Documentation" "PASS" "Found $file"
            
            # Check if env vars are documented
            if [[ "$file" =~ \.env\. ]]; then
                local documented_vars=$(grep -c "^[A-Z_].*=" "$file" 2>/dev/null || echo "0")
                log_test "Env Documentation" "INFO" "$documented_vars variables documented in $file"
            fi
        else
            if [[ "$file" == ".env.example" ]]; then
                log_test "Documentation" "WARN" "Missing $file (recommended for new developers)"
                RECOMMENDATIONS+=("Create .env.example with all required variables")
            fi
        fi
    done
    
    # Check .env files are in .gitignore
    if [[ -f ".gitignore" ]]; then
        if grep -q "\.env" .gitignore; then
            log_test "Git Security" "PASS" ".env files excluded from git"
        else
            log_test "Git Security" "FAIL" ".env files not in .gitignore" "critical"
            SECURITY_ISSUES+=("Git: .env files not excluded")
        fi
    fi
}

# =============================================================================
# SUMMARY AND RECOMMENDATIONS
# =============================================================================

generate_report() {
    echo -e "\n${BLUE}=========================================${NC}"
    echo -e "${BLUE}ENVIRONMENT VARIABLES TEST RESULTS${NC}"
    echo -e "${BLUE}=========================================${NC}"
    
    echo -e "Environment: ${PURPLE}${TARGET_ENV}${NC}"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
    echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
    echo -e "Warnings: ${YELLOW}${WARNING_TESTS}${NC}"
    
    # Calculate success rate
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    fi
    echo -e "Success Rate: ${success_rate}%"
    
    # Critical failures
    if [[ ${#CRITICAL_FAILURES[@]} -gt 0 ]]; then
        echo -e "\n${RED}CRITICAL FAILURES:${NC}"
        for failure in "${CRITICAL_FAILURES[@]}"; do
            echo -e "  ${RED}⚠${NC} $failure"
        done
    fi
    
    # Security issues
    if [[ ${#SECURITY_ISSUES[@]} -gt 0 ]]; then
        echo -e "\n${RED}SECURITY ISSUES:${NC}"
        for issue in "${SECURITY_ISSUES[@]}"; do
            echo -e "  ${RED}🔒${NC} $issue"
        done
    fi
    
    # Missing variables
    if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
        echo -e "\n${YELLOW}MISSING REQUIRED VARIABLES:${NC}"
        for var in "${MISSING_VARS[@]}"; do
            echo -e "  ${YELLOW}⚡${NC} $var"
        done
    fi
    
    # Recommendations
    if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
        echo -e "\n${BLUE}RECOMMENDATIONS:${NC}"
        for rec in "${RECOMMENDATIONS[@]}"; do
            echo -e "  ${BLUE}💡${NC} $rec"
        done
    fi
    
    # Environment-specific guidance
    case "$TARGET_ENV" in
        "production")
            echo -e "\n${BLUE}PRODUCTION ENVIRONMENT CHECKLIST:${NC}"
            echo -e "  □ All secrets use strong, unique values"
            echo -e "  □ Database uses SSL/TLS connections"
            echo -e "  □ File uploads configured for cloud storage"
            echo -e "  □ Email service properly configured"
            echo -e "  □ Monitoring and logging enabled"
            echo -e "  □ Backup and disaster recovery in place"
            ;;
        "development")
            echo -e "\n${BLUE}DEVELOPMENT ENVIRONMENT CHECKLIST:${NC}"
            echo -e "  □ .env.example file created and maintained"
            echo -e "  □ Local database connection working"
            echo -e "  □ Test email delivery configured"
            echo -e "  □ Debug logging enabled"
            echo -e "  □ Hot reload working correctly"
            ;;
    esac
    
    # Overall status
    echo -e "\n${BLUE}OVERALL STATUS:${NC}"
    if [[ ${#CRITICAL_FAILURES[@]} -gt 0 ]]; then
        echo -e "${RED}❌ CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED${NC}"
        exit 1
    elif [[ ${#SECURITY_ISSUES[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  SECURITY CONCERNS - REVIEW RECOMMENDED${NC}"
        exit 2
    elif [[ $FAILED_TESTS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  CONFIGURATION ISSUES DETECTED${NC}"
        exit 3
    else
        echo -e "${GREEN}✅ ENVIRONMENT CONFIGURATION LOOKS GOOD${NC}"
        exit 0
    fi
}

# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

main() {
    test_core_variables
    test_database_variables
    test_security_variables
    test_aws_variables
    test_stripe_variables
    test_email_variables
    test_caching_variables
    test_url_variables
    test_feature_variables
    test_production_requirements
    test_development_setup
    test_configuration_consistency
    check_env_documentation
    generate_report
}

# Run the tests
main "$@"