#!/bin/bash

# ============================================================================
# Pitchey Application - Hardcoded Elements Security Scanner
# ============================================================================
# Purpose: Comprehensive security audit for hardcoded values, credentials,
#          and configuration issues
# Author: Security Audit Team
# Date: $(date +%Y-%m-%d)
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Risk levels
CRITICAL="CRITICAL"
HIGH="HIGH"
MEDIUM="MEDIUM"
LOW="LOW"
INFO="INFO"

# Counters
TOTAL_ISSUES=0
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
INFO_COUNT=0

# Report file
REPORT_FILE="security-audit-$(date +%Y%m%d-%H%M%S).html"
JSON_REPORT="security-audit-$(date +%Y%m%d-%H%M%S).json"

# Directories to scan
SCAN_DIRS=("src" "frontend/src" "database-administration-scripts")
CONFIG_FILES=("package.json" "tsconfig.json" "vite.config.ts" ".env*")

# ============================================================================
# Helper Functions
# ============================================================================

log_issue() {
    local severity=$1
    local category=$2
    local file=$3
    local line=$4
    local description=$5
    local recommendation=$6
    
    case $severity in
        $CRITICAL)
            echo -e "${RED}[CRITICAL]${NC} $category: $description"
            echo -e "  File: $file:$line"
            echo -e "  Fix: $recommendation"
            ((CRITICAL_COUNT++))
            ;;
        $HIGH)
            echo -e "${RED}[HIGH]${NC} $category: $description"
            echo -e "  File: $file:$line"
            echo -e "  Fix: $recommendation"
            ((HIGH_COUNT++))
            ;;
        $MEDIUM)
            echo -e "${YELLOW}[MEDIUM]${NC} $category: $description"
            echo -e "  File: $file:$line"
            echo -e "  Fix: $recommendation"
            ((MEDIUM_COUNT++))
            ;;
        $LOW)
            echo -e "${BLUE}[LOW]${NC} $category: $description"
            echo -e "  File: $file:$line"
            echo -e "  Fix: $recommendation"
            ((LOW_COUNT++))
            ;;
        $INFO)
            echo -e "${GREEN}[INFO]${NC} $category: $description"
            echo -e "  File: $file:$line"
            ((INFO_COUNT++))
            ;;
    esac
    ((TOTAL_ISSUES++))
    
    # Append to JSON report
    if [ "$TOTAL_ISSUES" -eq 1 ]; then
        echo "[" > "$JSON_REPORT"
    else
        echo "," >> "$JSON_REPORT"
    fi
    
    # Escape special characters for JSON
    local json_desc=$(echo "$description" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
    local json_rec=$(echo "$recommendation" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
    
    cat >> "$JSON_REPORT" <<EOF
  {
    "severity": "$severity",
    "category": "$category",
    "file": "$file",
    "line": "$line",
    "description": "$json_desc",
    "recommendation": "$json_rec",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
EOF
}

# ============================================================================
# 1. Scan for Hardcoded Credentials
# ============================================================================

scan_credentials() {
    echo -e "\n${PURPLE}=== Scanning for Hardcoded Credentials ===${NC}\n"
    
    # Password patterns
    local password_patterns=(
        "password\s*[:=]\s*['\"][^'\"]+['\"]"
        "pwd\s*[:=]\s*['\"][^'\"]+['\"]"
        "passwd\s*[:=]\s*['\"][^'\"]+['\"]"
        "pass\s*[:=]\s*['\"][^'\"]+['\"]"
        "secret\s*[:=]\s*['\"][^'\"]+['\"]"
    )
    
    # API Key patterns
    local api_key_patterns=(
        "api[_-]?key\s*[:=]\s*['\"][^'\"]+['\"]"
        "apikey\s*[:=]\s*['\"][^'\"]+['\"]"
        "api[_-]?secret\s*[:=]\s*['\"][^'\"]+['\"]"
        "access[_-]?key\s*[:=]\s*['\"][^'\"]+['\"]"
        "secret[_-]?key\s*[:=]\s*['\"][^'\"]+['\"]"
    )
    
    # Token patterns
    local token_patterns=(
        "token\s*[:=]\s*['\"][^'\"]+['\"]"
        "auth[_-]?token\s*[:=]\s*['\"][^'\"]+['\"]"
        "bearer\s*[:=]\s*['\"][^'\"]+['\"]"
        "jwt\s*[:=]\s*['\"][^'\"]+['\"]"
    )
    
    # Database connection strings
    local db_patterns=(
        "mongodb://[^'\"\\s]+"
        "postgres://[^'\"\\s]+"
        "mysql://[^'\"\\s]+"
        "redis://[^'\"\\s]+"
        "postgresql://[^'\"\\s]+"
    )
    
    for dir in "${SCAN_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            # Scan for passwords
            for pattern in "${password_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    if [[ ! "$content" =~ (process\.env|import\.meta\.env|getenv|ENV|example|test|mock|demo|placeholder|\$\{) ]]; then
                        log_issue "$CRITICAL" "HARDCODED_PASSWORD" "$file" "$line" \
                            "Hardcoded password found: ${content:0:50}..." \
                            "Move to environment variable or secure vault"
                    fi
                done < <(grep -rniE "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
            
            # Scan for API keys
            for pattern in "${api_key_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    if [[ ! "$content" =~ (process\.env|import\.meta\.env|getenv|ENV|example|test|mock|demo|placeholder|\$\{) ]]; then
                        log_issue "$CRITICAL" "HARDCODED_API_KEY" "$file" "$line" \
                            "Hardcoded API key found: ${content:0:50}..." \
                            "Store in environment variable or key management service"
                    fi
                done < <(grep -rniE "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
            
            # Scan for tokens
            for pattern in "${token_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    if [[ ! "$content" =~ (process\.env|import\.meta\.env|getenv|ENV|example|test|mock|demo|placeholder|\$\{) ]]; then
                        log_issue "$HIGH" "HARDCODED_TOKEN" "$file" "$line" \
                            "Hardcoded token found: ${content:0:50}..." \
                            "Use secure token management"
                    fi
                done < <(grep -rniE "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
            
            # Scan for database URLs
            for pattern in "${db_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    if [[ ! "$content" =~ (process\.env|import\.meta\.env|getenv|ENV|example|test|mock|localhost) ]]; then
                        log_issue "$CRITICAL" "HARDCODED_DB_URL" "$file" "$line" \
                            "Hardcoded database URL found: ${content:0:50}..." \
                            "Use DATABASE_URL environment variable"
                    fi
                done < <(grep -rniE "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
        fi
    done
}

# ============================================================================
# 2. Detect Hardcoded URLs and Endpoints
# ============================================================================

scan_urls() {
    echo -e "\n${PURPLE}=== Scanning for Hardcoded URLs ===${NC}\n"
    
    local url_patterns=(
        "https?://[^'\"\\s]+"
        "wss?://[^'\"\\s]+"
        "ftp://[^'\"\\s]+"
    )
    
    for dir in "${SCAN_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            for pattern in "${url_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    # Check if it's not localhost or example URLs
                    if [[ ! "$content" =~ (localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com|test\.com|process\.env|import\.meta\.env|ENV) ]]; then
                        # Check for production URLs
                        if [[ "$content" =~ (pitchey|production|api|backend|frontend) ]]; then
                            log_issue "$HIGH" "HARDCODED_PROD_URL" "$file" "$line" \
                                "Hardcoded production URL: ${content:0:80}..." \
                                "Use environment variables: VITE_API_URL, API_BASE_URL, etc."
                        else
                            log_issue "$MEDIUM" "HARDCODED_URL" "$file" "$line" \
                                "Hardcoded URL found: ${content:0:80}..." \
                                "Consider using environment variables for configuration"
                        fi
                    fi
                done < <(grep -rniE "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
        fi
    done
}

# ============================================================================
# 3. Find Hardcoded Demo/Mock Data
# ============================================================================

scan_mock_data() {
    echo -e "\n${PURPLE}=== Scanning for Mock/Demo Data ===${NC}\n"
    
    local mock_patterns=(
        "test@test\.com"
        "demo@demo\.com"
        "admin@admin\.com"
        "user@example\.com"
        "password123"
        "testpassword"
        "demopassword"
        "12345678"
        "qwerty"
        "dummy"
        "fake"
        "lorem ipsum"
    )
    
    for dir in "${SCAN_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            for pattern in "${mock_patterns[@]}"; do
                while IFS=: read -r file line content; do
                    # Skip test files and mock files
                    if [[ ! "$file" =~ (test|spec|mock|fixture|example) ]]; then
                        log_issue "$MEDIUM" "MOCK_DATA" "$file" "$line" \
                            "Mock/demo data in production code: $pattern" \
                            "Remove mock data or move to test files"
                    fi
                done < <(grep -rniF "$pattern" "$dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
            done
        fi
    done
}

# ============================================================================
# 4. Identify Hardcoded Configuration Values
# ============================================================================

scan_config_values() {
    echo -e "\n${PURPLE}=== Scanning for Hardcoded Configuration ===${NC}\n"
    
    # Port numbers
    while IFS=: read -r file line content; do
        if [[ ! "$content" =~ (process\.env|import\.meta\.env|ENV|default|fallback) ]]; then
            log_issue "$MEDIUM" "HARDCODED_PORT" "$file" "$line" \
                "Hardcoded port number: ${content:0:50}..." \
                "Use process.env.PORT or configuration file"
        fi
    done < <(grep -rniE "port\s*[:=]\s*[0-9]+" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Timeouts and intervals
    while IFS=: read -r file line content; do
        if [[ "$content" =~ (timeout|interval|delay)\s*[:=]\s*([0-9]+) ]]; then
            local value="${BASH_REMATCH[2]}"
            if [ "$value" -gt 1000 ]; then
                log_issue "$LOW" "HARDCODED_TIMEOUT" "$file" "$line" \
                    "Hardcoded timeout/interval: ${content:0:50}..." \
                    "Consider using configuration constants"
            fi
        fi
    done < <(grep -rniE "(timeout|interval|delay)\s*[:=]\s*[0-9]+" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Rate limits
    while IFS=: read -r file line content; do
        log_issue "$MEDIUM" "HARDCODED_RATE_LIMIT" "$file" "$line" \
            "Hardcoded rate limit: ${content:0:50}..." \
            "Move to configuration file or environment variable"
    done < <(grep -rniE "(rate|limit|max|min)\s*[:=]\s*[0-9]+" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
}

# ============================================================================
# 5. Check Environment Variable Usage
# ============================================================================

check_env_usage() {
    echo -e "\n${PURPLE}=== Checking Environment Variable Usage ===${NC}\n"
    
    # Check for .env files in repository
    if [ -f ".env" ]; then
        log_issue "$CRITICAL" "ENV_FILE_IN_REPO" ".env" "1" \
            ".env file found in repository" \
            "Add .env to .gitignore and use .env.example"
    fi
    
    # Check for missing env validation
    if [ -f "src/config/env.ts" ] || [ -f "src/config/environment.ts" ]; then
        echo -e "${GREEN}✓${NC} Environment configuration file found"
    else
        log_issue "$HIGH" "NO_ENV_VALIDATION" "src/config" "N/A" \
            "No environment variable validation found" \
            "Create env.ts with proper validation using zod or similar"
    fi
    
    # Check for direct process.env access
    local env_count=$(grep -r "process\.env\." src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
    if [ "$env_count" -gt 10 ]; then
        log_issue "$MEDIUM" "SCATTERED_ENV_ACCESS" "multiple files" "N/A" \
            "Found $env_count direct process.env accesses" \
            "Centralize environment variable access in a config module"
    fi
}

# ============================================================================
# 6. Validate No Sensitive Data Exposed
# ============================================================================

scan_sensitive_data() {
    echo -e "\n${PURPLE}=== Scanning for Sensitive Data Exposure ===${NC}\n"
    
    # Credit card patterns
    while IFS=: read -r file line content; do
        log_issue "$CRITICAL" "CREDIT_CARD_PATTERN" "$file" "$line" \
            "Potential credit card number pattern" \
            "Never store credit card data directly, use tokenization"
    done < <(grep -rniE "[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # SSN patterns
    while IFS=: read -r file line content; do
        log_issue "$CRITICAL" "SSN_PATTERN" "$file" "$line" \
            "Potential SSN pattern detected" \
            "Never store SSN directly, use encryption"
    done < <(grep -rniE "[0-9]{3}-[0-9]{2}-[0-9]{4}" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Email patterns in logs
    while IFS=: read -r file line content; do
        if [[ "$content" =~ console\.(log|error|warn|info) ]]; then
            log_issue "$MEDIUM" "EMAIL_IN_LOGS" "$file" "$line" \
                "Email address potentially logged" \
                "Sanitize PII before logging"
        fi
    done < <(grep -rniE "console\.(log|error|warn|info).*@" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
}

# ============================================================================
# 7. Ensure Configuration Externalization
# ============================================================================

check_config_externalization() {
    echo -e "\n${PURPLE}=== Checking Configuration Externalization ===${NC}\n"
    
    # Check for config files
    local config_files=(
        "src/config/index.ts"
        "src/config/config.ts"
        "src/config/constants.ts"
        "frontend/src/config/index.ts"
        "frontend/src/config/config.ts"
    )
    
    local found_config=false
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            found_config=true
            echo -e "${GREEN}✓${NC} Configuration file found: $config_file"
            
            # Check if it uses environment variables
            if grep -q "process\.env\|import\.meta\.env" "$config_file" 2>/dev/null; then
                echo -e "${GREEN}✓${NC} Configuration uses environment variables"
            else
                log_issue "$HIGH" "CONFIG_NOT_EXTERNALIZED" "$config_file" "N/A" \
                    "Configuration file doesn't use environment variables" \
                    "Externalize configuration using environment variables"
            fi
        fi
    done
    
    if [ "$found_config" = false ]; then
        log_issue "$HIGH" "NO_CONFIG_MODULE" "N/A" "N/A" \
            "No centralized configuration module found" \
            "Create a config module to manage all application settings"
    fi
}

# ============================================================================
# 8. Detect TODO/FIXME Comments
# ============================================================================

scan_todo_comments() {
    echo -e "\n${PURPLE}=== Scanning for TODO/FIXME Comments ===${NC}\n"
    
    local patterns=("TODO" "FIXME" "HACK" "XXX" "BUG" "SECURITY")
    
    for pattern in "${patterns[@]}"; do
        local count=0
        while IFS=: read -r file line content; do
            ((count++))
            if [ "$count" -le 10 ]; then  # Show first 10 of each type
                if [[ "$pattern" == "SECURITY" ]]; then
                    log_issue "$HIGH" "SECURITY_TODO" "$file" "$line" \
                        "Security-related TODO: ${content:0:80}..." \
                        "Address security TODOs before production"
                else
                    log_issue "$INFO" "${pattern}_COMMENT" "$file" "$line" \
                        "${pattern} comment: ${content:0:80}..." \
                        "Review and address before deployment"
                fi
            fi
        done < <(grep -rni "//.*$pattern\|/\*.*$pattern\|#.*$pattern" src frontend/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
        
        if [ "$count" -gt 10 ]; then
            echo -e "${YELLOW}  ... and $(($count - 10)) more $pattern comments${NC}"
        fi
    done
}

# ============================================================================
# 9. Find Magic Numbers and Hardcoded Limits
# ============================================================================

scan_magic_numbers() {
    echo -e "\n${PURPLE}=== Scanning for Magic Numbers ===${NC}\n"
    
    # Scan for numeric literals (excluding 0, 1, 2)
    while IFS=: read -r file line content; do
        # Extract the number
        if [[ "$content" =~ ([0-9]{3,}|[0-9]+\.[0-9]+) ]]; then
            local number="${BASH_REMATCH[1]}"
            # Skip common acceptable values and test files
            if [[ ! "$file" =~ (test|spec|mock) ]] && [[ ! "$number" =~ ^(100|200|201|204|400|401|403|404|500)$ ]]; then
                log_issue "$LOW" "MAGIC_NUMBER" "$file" "$line" \
                    "Magic number found: $number" \
                    "Define as named constant with descriptive name"
            fi
        fi
    done < <(grep -rniE "[^0-9]([0-9]{3,}|[0-9]+\.[0-9]+)[^0-9]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | head -50 || true)
}

# ============================================================================
# 10. Verify Proper Secret Management
# ============================================================================

verify_secret_management() {
    echo -e "\n${PURPLE}=== Verifying Secret Management ===${NC}\n"
    
    # Check for JWT secrets
    while IFS=: read -r file line content; do
        if [[ ! "$content" =~ (process\.env|import\.meta\.env) ]]; then
            log_issue "$CRITICAL" "HARDCODED_JWT_SECRET" "$file" "$line" \
                "Hardcoded JWT secret found" \
                "Use process.env.JWT_SECRET with strong random value"
        fi
    done < <(grep -rniE "jwt.*secret|secret.*jwt" src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Check for encryption keys
    while IFS=: read -r file line content; do
        if [[ ! "$content" =~ (process\.env|import\.meta\.env|crypto\.random) ]]; then
            log_issue "$CRITICAL" "HARDCODED_ENCRYPTION_KEY" "$file" "$line" \
                "Hardcoded encryption key found" \
                "Use secure key management service or environment variables"
        fi
    done < <(grep -rniE "(encrypt|decrypt|cipher).*key\s*=" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Check for salt values
    while IFS=: read -r file line content; do
        if [[ "$content" =~ salt[[:space:]]*=[[:space:]]*[\'\"]([^\'\"]+)[\'\"] ]]; then
            local salt="${BASH_REMATCH[1]}"
            if [ ${#salt} -lt 16 ]; then
                log_issue "$HIGH" "WEAK_SALT" "$file" "$line" \
                    "Weak or hardcoded salt value" \
                    "Use crypto.randomBytes() for salt generation"
            fi
        fi
    done < <(grep -rniE "salt\s*=" src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
}

# ============================================================================
# Additional Security Checks
# ============================================================================

additional_security_checks() {
    echo -e "\n${PURPLE}=== Additional Security Checks ===${NC}\n"
    
    # Check for eval usage
    while IFS=: read -r file line content; do
        log_issue "$CRITICAL" "EVAL_USAGE" "$file" "$line" \
            "eval() usage detected - major security risk" \
            "Never use eval(), find alternative approach"
    done < <(grep -rni "eval(" src frontend/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
    
    # Check for innerHTML usage
    while IFS=: read -r file line content; do
        log_issue "$HIGH" "INNERHTML_USAGE" "$file" "$line" \
            "innerHTML usage detected - XSS risk" \
            "Use textContent or sanitize HTML properly"
    done < <(grep -rni "innerHTML" frontend/src --include="*.ts" --include="*.tsx" --include="*.jsx" 2>/dev/null || true)
    
    # Check for SQL query construction
    while IFS=: read -r file line content; do
        if [[ "$content" =~ (SELECT|INSERT|UPDATE|DELETE|DROP).*\+ ]]; then
            log_issue "$CRITICAL" "SQL_INJECTION_RISK" "$file" "$line" \
                "Potential SQL injection - string concatenation in query" \
                "Use parameterized queries or ORM"
        fi
    done < <(grep -rniE "(SELECT|INSERT|UPDATE|DELETE|DROP).*\+" src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
    
    # Check for disabled security features
    while IFS=: read -r file line content; do
        log_issue "$HIGH" "DISABLED_SECURITY" "$file" "$line" \
            "Security feature disabled: ${content:0:50}..." \
            "Re-enable security features or document why disabled"
    done < <(grep -rniE "(disable|skip|bypass).*(auth|security|validation|csrf|cors)" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null || true)
}

# ============================================================================
# Generate HTML Report
# ============================================================================

generate_html_report() {
    cat > "$REPORT_FILE" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Audit Report - $(date +%Y-%m-%d)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .critical { color: #e74c3c; font-weight: bold; }
        .high { color: #e67e22; font-weight: bold; }
        .medium { color: #f39c12; }
        .low { color: #3498db; }
        .info { color: #95a5a6; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-card { background: white; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .recommendations { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; background: white; }
        th { background: #34495e; color: white; padding: 10px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
        tr:hover { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Audit Report</h1>
        <p>Generated: $(date)</p>
        <p>Pitchey Application Security Analysis</p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <p>Total Issues Found: <strong>$TOTAL_ISSUES</strong></p>
        <div class="stats">
            <div class="stat-card">
                <h3 class="critical">CRITICAL</h3>
                <p style="font-size: 24px;">$CRITICAL_COUNT</p>
            </div>
            <div class="stat-card">
                <h3 class="high">HIGH</h3>
                <p style="font-size: 24px;">$HIGH_COUNT</p>
            </div>
            <div class="stat-card">
                <h3 class="medium">MEDIUM</h3>
                <p style="font-size: 24px;">$MEDIUM_COUNT</p>
            </div>
            <div class="stat-card">
                <h3 class="low">LOW</h3>
                <p style="font-size: 24px;">$LOW_COUNT</p>
            </div>
            <div class="stat-card">
                <h3 class="info">INFO</h3>
                <p style="font-size: 24px;">$INFO_COUNT</p>
            </div>
        </div>
    </div>
    
    <div class="recommendations">
        <h2>🎯 Priority Recommendations</h2>
        <ol>
            <li><strong>Immediate Actions (CRITICAL):</strong>
                <ul>
                    <li>Remove all hardcoded credentials and secrets</li>
                    <li>Implement proper environment variable management</li>
                    <li>Fix SQL injection vulnerabilities</li>
                    <li>Remove eval() usage</li>
                </ul>
            </li>
            <li><strong>Short-term (HIGH):</strong>
                <ul>
                    <li>Centralize configuration management</li>
                    <li>Implement secret rotation</li>
                    <li>Add input validation</li>
                    <li>Enable security headers</li>
                </ul>
            </li>
            <li><strong>Medium-term (MEDIUM):</strong>
                <ul>
                    <li>Replace magic numbers with constants</li>
                    <li>Implement comprehensive logging</li>
                    <li>Add security testing to CI/CD</li>
                </ul>
            </li>
        </ol>
    </div>
    
    <div class="recommendations">
        <h2>📋 OWASP Top 10 Compliance</h2>
        <table>
            <tr>
                <th>OWASP Category</th>
                <th>Status</th>
                <th>Issues Found</th>
            </tr>
            <tr>
                <td>A01: Broken Access Control</td>
                <td>⚠️ Review Needed</td>
                <td>Check authentication middleware</td>
            </tr>
            <tr>
                <td>A02: Cryptographic Failures</td>
                <td>❌ Issues Found</td>
                <td>Hardcoded secrets detected</td>
            </tr>
            <tr>
                <td>A03: Injection</td>
                <td>❌ High Risk</td>
                <td>Potential SQL injection points</td>
            </tr>
            <tr>
                <td>A04: Insecure Design</td>
                <td>⚠️ Review Needed</td>
                <td>Configuration management issues</td>
            </tr>
            <tr>
                <td>A05: Security Misconfiguration</td>
                <td>❌ Issues Found</td>
                <td>Hardcoded configuration values</td>
            </tr>
            <tr>
                <td>A06: Vulnerable Components</td>
                <td>⚠️ Check Dependencies</td>
                <td>Run npm audit</td>
            </tr>
            <tr>
                <td>A07: Authentication Failures</td>
                <td>❌ Issues Found</td>
                <td>JWT secret management</td>
            </tr>
            <tr>
                <td>A08: Data Integrity Failures</td>
                <td>⚠️ Review Needed</td>
                <td>Check data validation</td>
            </tr>
            <tr>
                <td>A09: Logging Failures</td>
                <td>⚠️ Review Needed</td>
                <td>PII in logs detected</td>
            </tr>
            <tr>
                <td>A10: SSRF</td>
                <td>⚠️ Review Needed</td>
                <td>Check URL validation</td>
            </tr>
        </table>
    </div>
</body>
</html>
EOF
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Pitchey Security Audit - Hardcoded Elements Scanner      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Starting comprehensive security audit...${NC}"
    echo -e "Timestamp: $(date)"
    echo ""
    
    # Run all scans
    scan_credentials
    scan_urls
    scan_mock_data
    scan_config_values
    check_env_usage
    scan_sensitive_data
    check_config_externalization
    scan_todo_comments
    scan_magic_numbers
    verify_secret_management
    additional_security_checks
    
    # Close JSON report
    if [ -f "$JSON_REPORT" ]; then
        echo "]" >> "$JSON_REPORT"
    fi
    
    # Generate HTML report
    generate_html_report
    
    # Print summary
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                      AUDIT SUMMARY                           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Total Issues Found: ${YELLOW}$TOTAL_ISSUES${NC}"
    echo ""
    echo -e "${RED}CRITICAL:${NC} $CRITICAL_COUNT issues"
    echo -e "${RED}HIGH:${NC}     $HIGH_COUNT issues"
    echo -e "${YELLOW}MEDIUM:${NC}   $MEDIUM_COUNT issues"
    echo -e "${BLUE}LOW:${NC}      $LOW_COUNT issues"
    echo -e "${GREEN}INFO:${NC}     $INFO_COUNT issues"
    echo ""
    
    # Risk assessment
    echo -e "${BLUE}═══ Risk Assessment ═══${NC}"
    if [ "$CRITICAL_COUNT" -gt 0 ]; then
        echo -e "${RED}⚠️  CRITICAL RISK: Immediate action required!${NC}"
        echo -e "${RED}   Do not deploy to production until critical issues are resolved.${NC}"
    elif [ "$HIGH_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  HIGH RISK: Address before production deployment${NC}"
    elif [ "$MEDIUM_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}⚡ MEDIUM RISK: Plan remediation${NC}"
    else
        echo -e "${GREEN}✓ LOW RISK: Good security posture${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}Reports generated:${NC}"
    echo -e "  • HTML Report: ${BLUE}$REPORT_FILE${NC}"
    echo -e "  • JSON Report: ${BLUE}$JSON_REPORT${NC}"
    echo ""
    echo -e "${PURPLE}Next Steps:${NC}"
    echo "1. Review the HTML report for detailed findings"
    echo "2. Address CRITICAL and HIGH severity issues immediately"
    echo "3. Create tickets for MEDIUM and LOW issues"
    echo "4. Implement security testing in CI/CD pipeline"
    echo "5. Schedule regular security audits"
    echo ""
    
    # Exit with error if critical issues found
    if [ "$CRITICAL_COUNT" -gt 0 ]; then
        echo -e "${RED}Exiting with error due to critical security issues${NC}"
        exit 1
    fi
}

# Run main function
main