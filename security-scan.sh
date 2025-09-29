#!/bin/bash

# Security Audit Script for Pitchey Application
# Comprehensive scan for hardcoded elements and security issues

echo "================================================"
echo "    PITCHEY SECURITY AUDIT - HARDCODED SCAN    "
echo "================================================"
echo ""
echo "Date: $(date)"
echo ""

# Initialize counters
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
TOTAL=0

# Output file
OUTPUT="security-audit-report.txt"
echo "Security Audit Report - $(date)" > $OUTPUT
echo "======================================" >> $OUTPUT
echo "" >> $OUTPUT

# Function to log findings
log_finding() {
    local severity=$1
    local category=$2
    local file=$3
    local message=$4
    
    echo "[$severity] $category: $message" | tee -a $OUTPUT
    echo "  Location: $file" | tee -a $OUTPUT
    echo "" | tee -a $OUTPUT
    
    case $severity in
        CRITICAL) ((CRITICAL++));;
        HIGH) ((HIGH++));;
        MEDIUM) ((MEDIUM++));;
        LOW) ((LOW++));;
    esac
    ((TOTAL++))
}

echo "1. SCANNING FOR HARDCODED CREDENTIALS" | tee -a $OUTPUT
echo "--------------------------------------" | tee -a $OUTPUT

# Check for passwords
echo "Checking for hardcoded passwords..."
grep -r "password\s*[=:]\s*['\"]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|import\.meta\.env|example|test) ]]; then
        log_finding "CRITICAL" "HARDCODED_PASSWORD" "$file" "Potential hardcoded password"
    fi
done

# Check for API keys
echo "Checking for hardcoded API keys..."
grep -r "api[_-]key\s*[=:]\s*['\"]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|import\.meta\.env|example|test) ]]; then
        log_finding "CRITICAL" "HARDCODED_API_KEY" "$file" "Potential hardcoded API key"
    fi
done

# Check for tokens
echo "Checking for hardcoded tokens..."
grep -r "token\s*[=:]\s*['\"]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|import\.meta\.env|example|test|localStorage|sessionStorage) ]]; then
        log_finding "HIGH" "HARDCODED_TOKEN" "$file" "Potential hardcoded token"
    fi
done

# Check for secrets
echo "Checking for hardcoded secrets..."
grep -r "secret\s*[=:]\s*['\"]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|import\.meta\.env|JWT_SECRET) ]]; then
        log_finding "CRITICAL" "HARDCODED_SECRET" "$file" "Potential hardcoded secret"
    fi
done

echo "" | tee -a $OUTPUT
echo "2. SCANNING FOR HARDCODED URLS" | tee -a $OUTPUT
echo "-------------------------------" | tee -a $OUTPUT

# Check for production URLs
echo "Checking for hardcoded production URLs..."
grep -r "https://\|http://" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (localhost|127\.0\.0\.1|example\.com|test|mock|process\.env|import\.meta\.env) ]]; then
        if [[ "$rest" =~ (pitchey|api|backend|production) ]]; then
            log_finding "HIGH" "HARDCODED_PROD_URL" "$file" "Hardcoded production URL"
        else
            log_finding "MEDIUM" "HARDCODED_URL" "$file" "Hardcoded URL"
        fi
    fi
done

echo "" | tee -a $OUTPUT
echo "3. SCANNING FOR DATABASE CONNECTION STRINGS" | tee -a $OUTPUT
echo "-------------------------------------------" | tee -a $OUTPUT

# Check for database URLs
echo "Checking for hardcoded database URLs..."
grep -r "mongodb://\|postgres://\|mysql://\|redis://" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|DATABASE_URL|localhost) ]]; then
        log_finding "CRITICAL" "HARDCODED_DB_URL" "$file" "Hardcoded database connection string"
    fi
done

echo "" | tee -a $OUTPUT
echo "4. SCANNING FOR MOCK/DEMO DATA" | tee -a $OUTPUT
echo "-------------------------------" | tee -a $OUTPUT

# Check for test emails
echo "Checking for test/demo emails..."
for email in "test@test.com" "demo@demo.com" "admin@admin.com" "user@example.com"; do
    grep -r "$email" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
        if [[ ! "$file" =~ (test|spec|mock) ]]; then
            log_finding "MEDIUM" "DEMO_DATA" "$file" "Mock/demo email in production code: $email"
        fi
    done
done

# Check for weak passwords
echo "Checking for weak passwords..."
for pwd in "password123" "123456" "admin" "test" "demo"; do
    grep -r "$pwd" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS=: read -r file rest; do
        if [[ ! "$file" =~ (test|spec|mock) ]]; then
            log_finding "HIGH" "WEAK_PASSWORD" "$file" "Weak password in code: $pwd"
        fi
    done
done

echo "" | tee -a $OUTPUT
echo "5. CHECKING ENVIRONMENT CONFIGURATION" | tee -a $OUTPUT
echo "--------------------------------------" | tee -a $OUTPUT

# Check for .env files
echo "Checking for .env files in repository..."
if [ -f ".env" ]; then
    log_finding "CRITICAL" "ENV_FILE" ".env" ".env file found in repository - should be gitignored"
fi

# Check for env validation
echo "Checking for environment variable validation..."
if [ ! -f "src/config/env.ts" ] && [ ! -f "src/config/environment.ts" ]; then
    log_finding "HIGH" "NO_ENV_VALIDATION" "src/config/" "No environment variable validation found"
fi

echo "" | tee -a $OUTPUT
echo "6. SECURITY VULNERABILITY PATTERNS" | tee -a $OUTPUT
echo "-----------------------------------" | tee -a $OUTPUT

# Check for eval usage
echo "Checking for eval() usage..."
grep -r "eval(" src frontend/src --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | while IFS=: read -r file rest; do
    log_finding "CRITICAL" "EVAL_USAGE" "$file" "eval() usage detected - major security risk"
done

# Check for innerHTML
echo "Checking for innerHTML usage..."
grep -r "innerHTML" frontend/src --include="*.tsx" --include="*.jsx" 2>/dev/null | while IFS=: read -r file rest; do
    log_finding "HIGH" "INNERHTML_XSS" "$file" "innerHTML usage - potential XSS vulnerability"
done

# Check for SQL injection risks
echo "Checking for SQL injection risks..."
grep -r "SELECT\|INSERT\|UPDATE\|DELETE" src --include="*.ts" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ "$rest" =~ \+ ]] || [[ "$rest" =~ \$\{ ]]; then
        log_finding "CRITICAL" "SQL_INJECTION" "$file" "Potential SQL injection - string concatenation in query"
    fi
done

echo "" | tee -a $OUTPUT
echo "7. CHECKING FOR TODO/FIXME COMMENTS" | tee -a $OUTPUT
echo "------------------------------------" | tee -a $OUTPUT

# Check for security TODOs
echo "Checking for security-related TODOs..."
grep -r "TODO.*security\|FIXME.*security\|SECURITY" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 | while IFS=: read -r file rest; do
    log_finding "HIGH" "SECURITY_TODO" "$file" "Security-related TODO found"
done

echo "" | tee -a $OUTPUT
echo "8. CHECKING FOR MAGIC NUMBERS" | tee -a $OUTPUT
echo "------------------------------" | tee -a $OUTPUT

# Check for hardcoded limits
echo "Checking for hardcoded numeric limits..."
grep -r "[^0-9][0-9]\{3,\}[^0-9]" src frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | head -20 | while IFS=: read -r file rest; do
    if [[ ! "$file" =~ (test|spec) ]] && [[ ! "$rest" =~ (200|201|204|400|401|403|404|500) ]]; then
        log_finding "LOW" "MAGIC_NUMBER" "$file" "Magic number - should be constant"
    fi
done

echo "" | tee -a $OUTPUT
echo "9. CHECKING JWT AND ENCRYPTION" | tee -a $OUTPUT
echo "-------------------------------" | tee -a $OUTPUT

# Check for JWT secrets
echo "Checking for hardcoded JWT secrets..."
grep -r "jwt.*secret\|JWT_SECRET" src --include="*.ts" 2>/dev/null | while IFS=: read -r file rest; do
    if [[ ! "$rest" =~ (process\.env|import\.meta\.env) ]] && [[ "$rest" =~ = ]]; then
        log_finding "CRITICAL" "JWT_SECRET" "$file" "Hardcoded JWT secret"
    fi
done

echo "" | tee -a $OUTPUT
echo "10. CHECKING CORS CONFIGURATION" | tee -a $OUTPUT
echo "--------------------------------" | tee -a $OUTPUT

# Check for CORS issues
echo "Checking for CORS wildcard..."
grep -r "origin.*\*\|Access-Control-Allow-Origin.*\*" src --include="*.ts" 2>/dev/null | while IFS=: read -r file rest; do
    log_finding "HIGH" "CORS_WILDCARD" "$file" "CORS wildcard (*) allows any origin"
done

echo "" | tee -a $OUTPUT
echo "================================================" | tee -a $OUTPUT
echo "           SECURITY AUDIT SUMMARY               " | tee -a $OUTPUT
echo "================================================" | tee -a $OUTPUT
echo "" | tee -a $OUTPUT
echo "Total Issues Found: $TOTAL" | tee -a $OUTPUT
echo "" | tee -a $OUTPUT
echo "CRITICAL: $CRITICAL" | tee -a $OUTPUT
echo "HIGH:     $HIGH" | tee -a $OUTPUT
echo "MEDIUM:   $MEDIUM" | tee -a $OUTPUT
echo "LOW:      $LOW" | tee -a $OUTPUT
echo "" | tee -a $OUTPUT

# Risk Assessment
echo "RISK ASSESSMENT:" | tee -a $OUTPUT
if [ $CRITICAL -gt 0 ]; then
    echo "⚠️  CRITICAL RISK - DO NOT DEPLOY TO PRODUCTION" | tee -a $OUTPUT
    echo "   Fix all CRITICAL issues immediately!" | tee -a $OUTPUT
elif [ $HIGH -gt 0 ]; then
    echo "⚠️  HIGH RISK - Address before production" | tee -a $OUTPUT
else
    echo "✓  Acceptable risk level" | tee -a $OUTPUT
fi

echo "" | tee -a $OUTPUT
echo "Report saved to: $OUTPUT" | tee -a $OUTPUT
echo "" | tee -a $OUTPUT

# OWASP Top 10 Quick Check
echo "OWASP TOP 10 QUICK CHECK:" | tee -a $OUTPUT
echo "-------------------------" | tee -a $OUTPUT
echo "A01 Broken Access Control - Check auth middleware" | tee -a $OUTPUT
echo "A02 Cryptographic Failures - ${CRITICAL} issues with secrets" | tee -a $OUTPUT
echo "A03 Injection - Check for SQL injection patterns" | tee -a $OUTPUT
echo "A04 Insecure Design - Review configuration management" | tee -a $OUTPUT
echo "A05 Security Misconfiguration - Check hardcoded configs" | tee -a $OUTPUT
echo "A06 Vulnerable Components - Run 'npm audit'" | tee -a $OUTPUT
echo "A07 Authentication Failures - Check JWT implementation" | tee -a $OUTPUT
echo "A08 Data Integrity - Review data validation" | tee -a $OUTPUT
echo "A09 Logging Failures - Check for PII in logs" | tee -a $OUTPUT
echo "A10 SSRF - Review URL validation" | tee -a $OUTPUT

echo ""
echo "Scan complete!"

# Exit with error if critical issues
if [ $CRITICAL -gt 0 ]; then
    exit 1
fi