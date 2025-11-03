#!/bin/bash

# =============================================================================
# Pitchey Security Audit Script
# =============================================================================
# Comprehensive security assessment for production deployment
# Usage: ./security-audit.sh [--fix] [--report] [--json]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$SCRIPT_DIR/security-audit-report.txt"
JSON_REPORT="$SCRIPT_DIR/security-audit-report.json"

# Options
FIX_ISSUES=false
GENERATE_REPORT=false
JSON_OUTPUT=false

# Parse command line arguments
for arg in "$@"; do
    case $arg in
        --fix)
            FIX_ISSUES=true
            shift
            ;;
        --report)
            GENERATE_REPORT=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Security findings
declare -A SECURITY_FINDINGS
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        CRITICAL)
            echo -e "${RED}[CRITICAL]${NC} $message"
            ((CRITICAL_COUNT++))
            ;;
        HIGH)
            echo -e "${RED}[HIGH]${NC} $message"
            ((HIGH_COUNT++))
            ;;
        MEDIUM)
            echo -e "${YELLOW}[MEDIUM]${NC} $message"
            ((MEDIUM_COUNT++))
            ;;
        LOW)
            echo -e "${BLUE}[LOW]${NC} $message"
            ((LOW_COUNT++))
            ;;
        PASS)
            echo -e "${GREEN}[PASS]${NC} $message"
            ;;
    esac
    
    if [ "$GENERATE_REPORT" = true ]; then
        echo "[$timestamp] [$level] $message" >> "$REPORT_FILE"
    fi
}

# Check for secrets in code
check_secrets_in_code() {
    log "INFO" "🔍 Checking for exposed secrets in source code..."
    
    local found_secrets=false
    
    # Check for various secret patterns
    local secret_patterns=(
        "sk_live_[a-zA-Z0-9]+"
        "pk_live_[a-zA-Z0-9]+"
        "rk_live_[a-zA-Z0-9]+"
        "AIza[0-9A-Za-z_-]{35}"
        "ya29\.[0-9A-Za-z_-]+"
        "(?i)(password|passwd|pwd)[\s]*[=:[\s]*['\"][^'\"]+['\"]"
        "(?i)(secret|token|key)[\s]*[=:[\s]*['\"][^'\"]+['\"]"
        "-----BEGIN [A-Z]+ PRIVATE KEY-----"
    )
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -E "$pattern" --include="*.ts" --include="*.js" --include="*.json" --include="*.yaml" --include="*.yml" . 2>/dev/null | grep -v node_modules | grep -v ".git"; then
            log "CRITICAL" "Potential secret found matching pattern: $pattern"
            SECURITY_FINDINGS["secrets_exposed"]="true"
            found_secrets=true
        fi
    done
    
    if [ "$found_secrets" = false ]; then
        log "PASS" "No secrets found in source code"
        SECURITY_FINDINGS["secrets_exposed"]="false"
    fi
}

# Check environment variables security
check_environment_security() {
    log "INFO" "🔍 Checking environment variable security..."
    
    # Check if production environment file exists
    if [ -f ".env.production" ]; then
        log "HIGH" ".env.production file found in repository (should not be committed)"
        SECURITY_FINDINGS["env_file_committed"]="true"
        
        if [ "$FIX_ISSUES" = true ]; then
            echo ".env.production" >> .gitignore
            log "INFO" "Added .env.production to .gitignore"
        fi
    else
        log "PASS" "No production environment file in repository"
        SECURITY_FINDINGS["env_file_committed"]="false"
    fi
    
    # Check JWT secret strength (if available)
    if [ -n "${JWT_SECRET:-}" ]; then
        if [ ${#JWT_SECRET} -lt 32 ]; then
            log "HIGH" "JWT_SECRET is too short (${#JWT_SECRET} chars, should be 64+)"
            SECURITY_FINDINGS["weak_jwt_secret"]="true"
        else
            log "PASS" "JWT_SECRET has adequate length"
            SECURITY_FINDINGS["weak_jwt_secret"]="false"
        fi
    fi
}

# Check dependency vulnerabilities
check_dependency_vulnerabilities() {
    log "INFO" "🔍 Checking for dependency vulnerabilities..."
    
    # Check frontend dependencies
    if [ -f "frontend/package.json" ]; then
        cd frontend
        if npm audit --audit-level high --json > /tmp/npm-audit.json 2>/dev/null; then
            local vulnerabilities=$(jq '.metadata.vulnerabilities.total' /tmp/npm-audit.json 2>/dev/null || echo "unknown")
            if [ "$vulnerabilities" = "0" ]; then
                log "PASS" "No high-severity npm vulnerabilities found"
                SECURITY_FINDINGS["npm_vulnerabilities"]="false"
            else
                log "HIGH" "Found $vulnerabilities npm vulnerabilities"
                SECURITY_FINDINGS["npm_vulnerabilities"]="true"
                
                if [ "$FIX_ISSUES" = true ]; then
                    npm audit fix --force
                    log "INFO" "Attempted to fix npm vulnerabilities"
                fi
            fi
        else
            log "MEDIUM" "Could not run npm audit"
        fi
        cd ..
    fi
    
    # Check Deno dependencies
    if command -v deno &> /dev/null; then
        if deno check working-server.ts &> /dev/null; then
            log "PASS" "Deno dependencies are valid"
            SECURITY_FINDINGS["deno_dependencies"]="true"
        else
            log "MEDIUM" "Deno dependency issues found"
            SECURITY_FINDINGS["deno_dependencies"]="false"
        fi
    fi
}

# Check HTTPS configuration
check_https_configuration() {
    log "INFO" "🔍 Checking HTTPS configuration..."
    
    local urls=(
        "https://pitchey.pages.dev"
        "https://pitchey-api-production.cavelltheleaddev.workers.dev"
        "https://pitchey-backend-fresh.deno.dev"
    )
    
    for url in "${urls[@]}"; do
        if curl -s -I "$url" | grep -q "HTTP/2 200\|HTTP/1.1 200"; then
            log "PASS" "HTTPS working for $url"
        else
            log "HIGH" "HTTPS not working for $url"
            SECURITY_FINDINGS["https_issues"]="true"
        fi
        
        # Check HSTS headers
        if curl -s -I "$url" | grep -q "Strict-Transport-Security"; then
            log "PASS" "HSTS header present for $url"
        else
            log "MEDIUM" "HSTS header missing for $url"
            SECURITY_FINDINGS["missing_hsts"]="true"
        fi
    done
}

# Check CORS configuration
check_cors_configuration() {
    log "INFO" "🔍 Checking CORS configuration..."
    
    # Test CORS with malicious origin
    local malicious_origin="https://evil.com"
    local api_url="https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health"
    
    local cors_response=$(curl -s -H "Origin: $malicious_origin" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS "$api_url" 2>/dev/null || echo "")
    
    if echo "$cors_response" | grep -q "Access-Control-Allow-Origin: $malicious_origin"; then
        log "HIGH" "CORS allows requests from malicious origins"
        SECURITY_FINDINGS["cors_too_permissive"]="true"
    else
        log "PASS" "CORS properly restricts origins"
        SECURITY_FINDINGS["cors_too_permissive"]="false"
    fi
}

# Check authentication security
check_authentication_security() {
    log "INFO" "🔍 Checking authentication security..."
    
    local api_url="https://pitchey-api-production.cavelltheleaddev.workers.dev"
    
    # Test unauthenticated access to protected endpoints
    local protected_endpoints=(
        "/api/pitches"
        "/api/user/profile"
        "/api/admin/users"
    )
    
    for endpoint in "${protected_endpoints[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$api_url$endpoint" 2>/dev/null || echo "000")
        
        if [ "$status" = "401" ] || [ "$status" = "403" ]; then
            log "PASS" "Protected endpoint $endpoint properly secured ($status)"
        elif [ "$status" = "200" ]; then
            log "HIGH" "Protected endpoint $endpoint accessible without authentication"
            SECURITY_FINDINGS["unprotected_endpoints"]="true"
        else
            log "MEDIUM" "Unexpected response from $endpoint ($status)"
        fi
    done
}

# Check rate limiting
check_rate_limiting() {
    log "INFO" "🔍 Checking rate limiting..."
    
    local api_url="https://pitchey-api-production.cavelltheleaddev.workers.dev/api/health"
    local request_count=0
    local rate_limited=false
    
    # Send multiple requests quickly
    for i in {1..20}; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$api_url" 2>/dev/null || echo "000")
        ((request_count++))
        
        if [ "$status" = "429" ]; then
            rate_limited=true
            break
        fi
        
        sleep 0.1
    done
    
    if [ "$rate_limited" = true ]; then
        log "PASS" "Rate limiting is working (triggered after $request_count requests)"
        SECURITY_FINDINGS["rate_limiting"]="true"
    else
        log "MEDIUM" "Rate limiting may not be configured properly"
        SECURITY_FINDINGS["rate_limiting"]="false"
    fi
}

# Check SQL injection protection
check_sql_injection_protection() {
    log "INFO" "🔍 Checking SQL injection protection..."
    
    local api_url="https://pitchey-api-production.cavelltheleaddev.workers.dev"
    local sql_payloads=(
        "' OR '1'='1"
        "'; DROP TABLE users; --"
        "' UNION SELECT * FROM users --"
        "1'; WAITFOR DELAY '00:00:05' --"
    )
    
    for payload in "${sql_payloads[@]}"; do
        # Test in search endpoint
        local status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$api_url/api/search" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$payload\"}" 2>/dev/null || echo "000")
        
        if [ "$status" = "500" ] || [ "$status" = "000" ]; then
            log "HIGH" "Potential SQL injection vulnerability with payload: $payload"
            SECURITY_FINDINGS["sql_injection_risk"]="true"
            break
        fi
    done
    
    if [ "${SECURITY_FINDINGS[sql_injection_risk]:-}" != "true" ]; then
        log "PASS" "No obvious SQL injection vulnerabilities found"
        SECURITY_FINDINGS["sql_injection_risk"]="false"
    fi
}

# Check XSS protection
check_xss_protection() {
    log "INFO" "🔍 Checking XSS protection..."
    
    # Check for XSS protection headers
    local frontend_url="https://pitchey.pages.dev"
    local headers=$(curl -s -I "$frontend_url" 2>/dev/null || echo "")
    
    if echo "$headers" | grep -q "X-Content-Type-Options: nosniff"; then
        log "PASS" "X-Content-Type-Options header present"
    else
        log "MEDIUM" "X-Content-Type-Options header missing"
        SECURITY_FINDINGS["missing_xss_headers"]="true"
    fi
    
    if echo "$headers" | grep -q "Content-Security-Policy"; then
        log "PASS" "Content-Security-Policy header present"
        SECURITY_FINDINGS["csp_present"]="true"
    else
        log "HIGH" "Content-Security-Policy header missing"
        SECURITY_FINDINGS["csp_present"]="false"
    fi
}

# Check file upload security
check_file_upload_security() {
    log "INFO" "🔍 Checking file upload security..."
    
    # This would require authentication, so we'll check configuration
    if grep -r "allowedTypes\|ALLOWED_FILE_TYPES" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules; then
        log "PASS" "File type restrictions are configured"
        SECURITY_FINDINGS["file_upload_restrictions"]="true"
    else
        log "MEDIUM" "File upload restrictions not found in code"
        SECURITY_FINDINGS["file_upload_restrictions"]="false"
    fi
    
    if grep -r "maxSize\|MAX_FILE_SIZE" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules; then
        log "PASS" "File size restrictions are configured"
    else
        log "MEDIUM" "File size restrictions not found in code"
    fi
}

# Check database security
check_database_security() {
    log "INFO" "🔍 Checking database security..."
    
    # Check if DATABASE_URL uses SSL
    if [ -n "${DATABASE_URL:-}" ]; then
        if echo "$DATABASE_URL" | grep -q "sslmode=require"; then
            log "PASS" "Database connection uses SSL"
            SECURITY_FINDINGS["database_ssl"]="true"
        else
            log "HIGH" "Database connection may not use SSL"
            SECURITY_FINDINGS["database_ssl"]="false"
        fi
    fi
    
    # Check for SQL injection protection in ORM usage
    if grep -r "sql\`\|db.query\|execute.*\$" --include="*.ts" . 2>/dev/null | grep -v node_modules | grep -v "sql\`SELECT\|sql\`INSERT\|sql\`UPDATE"; then
        log "MEDIUM" "Potential unsafe database queries found"
        SECURITY_FINDINGS["unsafe_queries"]="true"
    else
        log "PASS" "Database queries appear to use safe parameterization"
        SECURITY_FINDINGS["unsafe_queries"]="false"
    fi
}

# Check error handling
check_error_handling() {
    log "INFO" "🔍 Checking error handling..."
    
    # Test error responses don't leak information
    local api_url="https://pitchey-api-production.cavelltheleaddev.workers.dev/api/nonexistent"
    local error_response=$(curl -s "$api_url" 2>/dev/null || echo "")
    
    if echo "$error_response" | grep -i "stack trace\|internal error\|database error"; then
        log "HIGH" "Error responses may leak sensitive information"
        SECURITY_FINDINGS["information_leakage"]="true"
    else
        log "PASS" "Error responses don't appear to leak information"
        SECURITY_FINDINGS["information_leakage"]="false"
    fi
}

# Generate JSON report
generate_json_report() {
    local total_issues=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))
    local security_score=$((100 - (CRITICAL_COUNT * 30) - (HIGH_COUNT * 20) - (MEDIUM_COUNT * 10) - (LOW_COUNT * 5)))
    if [ $security_score -lt 0 ]; then security_score=0; fi
    
    cat > "$JSON_REPORT" << EOF
{
  "timestamp": "$(date --iso-8601=seconds)",
  "security_score": $security_score,
  "summary": {
    "critical": $CRITICAL_COUNT,
    "high": $HIGH_COUNT,
    "medium": $MEDIUM_COUNT,
    "low": $LOW_COUNT,
    "total_issues": $total_issues
  },
  "findings": {
EOF
    
    local first=true
    for key in "${!SECURITY_FINDINGS[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$JSON_REPORT"
        fi
        echo "    \"$key\": \"${SECURITY_FINDINGS[$key]}\"" >> "$JSON_REPORT"
        first=false
    done
    
    cat >> "$JSON_REPORT" << EOF
  },
  "recommendations": [
    "Regularly update dependencies to patch security vulnerabilities",
    "Implement comprehensive input validation and sanitization",
    "Use strong JWT secrets and rotate them regularly",
    "Enable all security headers (HSTS, CSP, X-Content-Type-Options)",
    "Implement proper rate limiting on all endpoints",
    "Regularly audit code for security vulnerabilities",
    "Use SSL/TLS for all database connections",
    "Implement proper error handling to prevent information leakage"
  ]
}
EOF
}

# Main security audit function
main() {
    echo "🔒 Starting Pitchey Security Audit..."
    echo "⏰ Timestamp: $(date)"
    echo ""
    
    if [ "$GENERATE_REPORT" = true ]; then
        echo "# Pitchey Security Audit Report" > "$REPORT_FILE"
        echo "Generated: $(date)" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
    
    # Run all security checks
    check_secrets_in_code
    check_environment_security
    check_dependency_vulnerabilities
    check_https_configuration
    check_cors_configuration
    check_authentication_security
    check_rate_limiting
    check_sql_injection_protection
    check_xss_protection
    check_file_upload_security
    check_database_security
    check_error_handling
    
    echo ""
    echo "📊 Security Audit Summary:"
    echo "   Critical Issues: $CRITICAL_COUNT"
    echo "   High Issues: $HIGH_COUNT"
    echo "   Medium Issues: $MEDIUM_COUNT"
    echo "   Low Issues: $LOW_COUNT"
    
    local total_issues=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))
    local security_score=$((100 - (CRITICAL_COUNT * 30) - (HIGH_COUNT * 20) - (MEDIUM_COUNT * 10) - (LOW_COUNT * 5)))
    if [ $security_score -lt 0 ]; then security_score=0; fi
    
    echo "   Security Score: $security_score/100"
    
    if [ "$JSON_OUTPUT" = true ]; then
        generate_json_report
        echo "   JSON Report: $JSON_REPORT"
    fi
    
    if [ "$GENERATE_REPORT" = true ]; then
        echo ""
        echo "Summary:" >> "$REPORT_FILE"
        echo "Critical: $CRITICAL_COUNT, High: $HIGH_COUNT, Medium: $MEDIUM_COUNT, Low: $LOW_COUNT" >> "$REPORT_FILE"
        echo "Security Score: $security_score/100" >> "$REPORT_FILE"
        echo "   Text Report: $REPORT_FILE"
    fi
    
    echo ""
    if [ $CRITICAL_COUNT -gt 0 ]; then
        echo "🚨 CRITICAL security issues found! Address immediately."
        exit 1
    elif [ $HIGH_COUNT -gt 0 ]; then
        echo "⚠️ HIGH severity security issues found. Address soon."
        exit 2
    elif [ $total_issues -gt 0 ]; then
        echo "ℹ️ Some security issues found. Review recommendations."
        exit 3
    else
        echo "✅ No security issues found. Good job!"
        exit 0
    fi
}

# Run main function
main "$@"