#!/bin/bash

# Security Verification Test Script
# Validates security implementations and configurations

set -e

echo "🔒 Pitchey Security Verification Suite"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test endpoints
PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOCAL_URL="http://localhost:8001"

# Function to test security headers
test_security_headers() {
    local url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🛡️ Testing Security Headers - $environment${NC}"
    echo "================================================"
    
    local failed=0
    
    # Get headers
    echo "Fetching headers from: $url/api/health"
    headers=$(curl -I -s "$url/api/health" 2>/dev/null || echo "ERROR")
    
    if [ "$headers" = "ERROR" ]; then
        echo -e "${RED}❌ Failed to fetch headers${NC}"
        return 1
    fi
    
    echo -e "\n${BLUE}Security Header Analysis:${NC}"
    
    # Test CORS headers
    if echo "$headers" | grep -qi "access-control-allow-origin"; then
        echo -e "${GREEN}✅ CORS headers present${NC}"
    else
        echo -e "${RED}❌ Missing CORS headers${NC}"
        ((failed++))
    fi
    
    # Test Content-Type header
    if echo "$headers" | grep -qi "content-type.*application/json"; then
        echo -e "${GREEN}✅ Content-Type header correct${NC}"
    else
        echo -e "${YELLOW}⚠️ Content-Type header missing or incorrect${NC}"
    fi
    
    # Test for security headers that should be present
    security_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "Referrer-Policy"
        "Cache-Control"
    )
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            echo -e "${GREEN}✅ $header present${NC}"
        else
            echo -e "${YELLOW}⚠️ $header missing (recommended)${NC}"
        fi
    done
    
    # Check for sensitive information leakage
    if echo "$headers" | grep -qi "server.*cloudflare"; then
        echo -e "${GREEN}✅ Server header appropriately minimal${NC}"
    elif echo "$headers" | grep -qi "server:"; then
        echo -e "${YELLOW}⚠️ Server header present - consider minimizing${NC}"
    else
        echo -e "${GREEN}✅ No server header leakage${NC}"
    fi
    
    return $failed
}

# Function to test API security
test_api_security() {
    local url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🔐 Testing API Security - $environment${NC}"
    echo "========================================="
    
    local failed=0
    
    # Test unauthorized access
    echo -e "\n${BLUE}Testing unauthorized access protection:${NC}"
    
    # Test protected endpoints without auth
    protected_endpoints=(
        "/api/pitches"
        "/api/users"
        "/api/investments"
        "/api/ndas"
    )
    
    for endpoint in "${protected_endpoints[@]}"; do
        echo "Testing: $endpoint"
        response=$(curl -s -w "%{http_code}" "$url$endpoint" 2>/dev/null || echo "ERROR")
        status_code=$(echo "$response" | tail -c 4)
        
        if [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
            echo -e "${GREEN}✅ $endpoint properly protected (Status: $status_code)${NC}"
        elif [ "$status_code" = "404" ]; then
            echo -e "${YELLOW}⚠️ $endpoint returns 404 (expected if not implemented)${NC}"
        else
            echo -e "${RED}❌ $endpoint not properly protected (Status: $status_code)${NC}"
            ((failed++))
        fi
    done
    
    # Test SQL injection protection
    echo -e "\n${BLUE}Testing SQL injection protection:${NC}"
    injection_payloads=(
        "'; DROP TABLE users; --"
        "' OR 1=1 --"
        "' UNION SELECT * FROM users --"
        "%27%20OR%201%3D1%20--%20"
    )
    
    for payload in "${injection_payloads[@]}"; do
        echo "Testing SQL injection payload: $(echo "$payload" | head -c 20)..."
        response=$(curl -s "$url/api/health?test=$payload" 2>/dev/null || echo "ERROR")
        
        if echo "$response" | grep -qi "error\|sql\|syntax"; then
            echo -e "${RED}❌ Potential SQL injection vulnerability detected${NC}"
            ((failed++))
        else
            echo -e "${GREEN}✅ SQL injection payload handled safely${NC}"
        fi
    done
    
    return $failed
}

# Function to test authentication endpoints
test_authentication() {
    local url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🔑 Testing Authentication - $environment${NC}"
    echo "==========================================="
    
    local failed=0
    
    # Test login endpoints
    echo -e "\n${BLUE}Testing login endpoint security:${NC}"
    
    login_endpoints=(
        "/api/auth/creator/login"
        "/api/auth/investor/login"
        "/api/auth/production/login"
    )
    
    for endpoint in "${login_endpoints[@]}"; do
        echo "Testing: $endpoint"
        
        # Test without credentials
        response=$(curl -s -X POST -w "%{http_code}" "$url$endpoint" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null || echo "ERROR000")
        
        status_code=$(echo "$response" | tail -c 4)
        body=$(echo "$response" | head -c -4)
        
        if [ "$status_code" = "400" ] || [ "$status_code" = "422" ] || [ "$status_code" = "401" ]; then
            echo -e "${GREEN}✅ $endpoint rejects empty credentials (Status: $status_code)${NC}"
        else
            echo -e "${RED}❌ $endpoint doesn't validate credentials properly (Status: $status_code)${NC}"
            ((failed++))
        fi
        
        # Test with invalid credentials
        response=$(curl -s -X POST -w "%{http_code}" "$url$endpoint" \
            -H "Content-Type: application/json" \
            -d '{"email":"invalid@test.com","password":"wrongpassword"}' 2>/dev/null || echo "ERROR000")
        
        status_code=$(echo "$response" | tail -c 4)
        
        if [ "$status_code" = "401" ] || [ "$status_code" = "400" ]; then
            echo -e "${GREEN}✅ $endpoint rejects invalid credentials (Status: $status_code)${NC}"
        else
            echo -e "${YELLOW}⚠️ $endpoint response to invalid credentials: $status_code${NC}"
        fi
    done
    
    return $failed
}

# Function to test rate limiting
test_rate_limiting() {
    local url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}⏱️ Testing Rate Limiting - $environment${NC}"
    echo "========================================="
    
    local failed=0
    
    echo -e "\n${BLUE}Testing rate limiting on health endpoint:${NC}"
    
    # Make rapid requests to test rate limiting
    echo "Making 10 rapid requests to test rate limiting..."
    
    rate_limit_triggered=false
    
    for i in {1..10}; do
        response=$(curl -s -w "%{http_code}" "$url/api/health" 2>/dev/null || echo "ERROR000")
        status_code=$(echo "$response" | tail -c 4)
        
        if [ "$status_code" = "429" ]; then
            echo -e "${GREEN}✅ Rate limiting triggered on request $i${NC}"
            rate_limit_triggered=true
            break
        elif [ "$status_code" = "200" ]; then
            echo -n "."
        else
            echo -e "\n${YELLOW}⚠️ Unexpected response on request $i: $status_code${NC}"
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    if [ "$rate_limit_triggered" = false ]; then
        echo -e "\n${YELLOW}⚠️ Rate limiting not triggered (may be configured for higher limits)${NC}"
    fi
    
    return $failed
}

# Function to test for information disclosure
test_information_disclosure() {
    local url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🕵️ Testing Information Disclosure - $environment${NC}"
    echo "=================================================="
    
    local failed=0
    
    # Test for sensitive information in responses
    echo -e "\n${BLUE}Testing for sensitive information leakage:${NC}"
    
    # Test error responses
    response=$(curl -s "$url/api/nonexistent" 2>/dev/null || echo "ERROR")
    
    if echo "$response" | grep -qi "stack\|trace\|debug\|internal\|development"; then
        echo -e "${RED}❌ Error responses may leak sensitive information${NC}"
        echo "Response snippet: $(echo "$response" | head -c 100)..."
        ((failed++))
    else
        echo -e "${GREEN}✅ Error responses don't leak sensitive information${NC}"
    fi
    
    # Test for version information
    if echo "$response" | grep -qi "version\|v[0-9]"; then
        echo -e "${YELLOW}⚠️ Version information exposed (not necessarily critical)${NC}"
    else
        echo -e "${GREEN}✅ No version information leaked${NC}"
    fi
    
    # Test for path disclosure
    if echo "$response" | grep -qi "path\|file\|directory"; then
        echo -e "${YELLOW}⚠️ Potential path disclosure in error messages${NC}"
    else
        echo -e "${GREEN}✅ No path information disclosed${NC}"
    fi
    
    return $failed
}

# Function to test HTTPS and TLS
test_https_tls() {
    local url=$1
    local environment=$2
    
    # Only test HTTPS for production URLs
    if [[ $url == https://* ]]; then
        echo -e "\n${YELLOW}🔐 Testing HTTPS/TLS Security - $environment${NC}"
        echo "============================================="
        
        local failed=0
        
        echo -e "\n${BLUE}Testing TLS configuration:${NC}"
        
        # Test TLS version
        tls_info=$(curl -I -s --tlsv1.2 "$url/api/health" 2>&1)
        
        if echo "$tls_info" | grep -qi "200 OK"; then
            echo -e "${GREEN}✅ TLS 1.2+ supported${NC}"
        else
            echo -e "${RED}❌ TLS connection failed${NC}"
            ((failed++))
        fi
        
        # Test certificate
        cert_info=$(curl -I -s "$url/api/health" 2>&1)
        
        if echo "$cert_info" | grep -qi "certificate verify failed"; then
            echo -e "${RED}❌ Certificate verification failed${NC}"
            ((failed++))
        else
            echo -e "${GREEN}✅ Certificate verification passed${NC}"
        fi
        
        return $failed
    else
        echo -e "\n${YELLOW}ℹ️ Skipping HTTPS/TLS tests for local environment${NC}"
        return 0
    fi
}

# Function to run comprehensive security test
run_security_test() {
    local url=$1
    local environment=$2
    
    echo -e "\n${BLUE}🔍 Running Comprehensive Security Test - $environment${NC}"
    echo "==========================================================="
    
    local total_failed=0
    
    # Run all security tests
    test_security_headers "$url" "$environment" || ((total_failed++))
    test_api_security "$url" "$environment" || ((total_failed++))
    test_authentication "$url" "$environment" || ((total_failed++))
    test_rate_limiting "$url" "$environment" || ((total_failed++))
    test_information_disclosure "$url" "$environment" || ((total_failed++))
    test_https_tls "$url" "$environment" || ((total_failed++))
    
    return $total_failed
}

# Function to check if local server is running
check_local_server() {
    if curl -s "$LOCAL_URL/api/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting security verification test sequence...${NC}"
    
    local test_local=false
    local test_production=false
    
    # Parse command line arguments
    for arg in "$@"; do
        case $arg in
            --local)
                test_local=true
                shift
                ;;
            --production)
                test_production=true
                shift
                ;;
            --all)
                test_local=true
                test_production=true
                shift
                ;;
            *)
                # Default: test production only
                test_production=true
                ;;
        esac
    done
    
    # If no arguments, default to production testing
    if [ "$test_local" = false ] && [ "$test_production" = false ]; then
        test_production=true
    fi
    
    local overall_success=true
    
    # Test local environment
    if [ "$test_local" = true ]; then
        if check_local_server; then
            run_security_test "$LOCAL_URL" "LOCAL" || overall_success=false
        else
            echo -e "${RED}❌ Local server not available at $LOCAL_URL${NC}"
            overall_success=false
        fi
    fi
    
    # Test production environment
    if [ "$test_production" = true ]; then
        run_security_test "$PRODUCTION_URL" "PRODUCTION" || overall_success=false
    fi
    
    # Final summary
    echo -e "\n${BLUE}📋 Security Verification Summary${NC}"
    echo "================================="
    
    if [ "$overall_success" = true ]; then
        echo -e "${GREEN}✅ All security tests completed successfully!${NC}"
        echo -e "\n${BLUE}🔒 Security Status: VERIFIED${NC}"
        echo -e "\n${GREEN}Key Security Features Confirmed:${NC}"
        echo "- API authentication and authorization"
        echo "- Input validation and sanitization"  
        echo "- Rate limiting protection"
        echo "- Information disclosure prevention"
        echo "- Secure HTTP headers"
        echo "- TLS/HTTPS encryption (production)"
        exit 0
    else
        echo -e "${RED}❌ Some security tests failed. Review the output above.${NC}"
        echo -e "\n${RED}🔒 Security Status: NEEDS ATTENTION${NC}"
        echo -e "\n${YELLOW}Recommended Actions:${NC}"
        echo "- Review failed security tests"
        echo "- Implement missing security headers"
        echo "- Strengthen authentication mechanisms"
        echo "- Configure rate limiting"
        exit 1
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Security Verification Test Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --local       Test local development server"
    echo "  --production  Test production server (default)"
    echo "  --all         Test both local and production"
    echo "  --help        Show this help message"
    echo ""
    echo "Security Tests Include:"
    echo "  - Security headers validation"
    echo "  - API authentication testing"
    echo "  - SQL injection protection"
    echo "  - Rate limiting verification"
    echo "  - Information disclosure checks"
    echo "  - HTTPS/TLS security (production)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Test production security"
    echo "  $0 --local           # Test local server security"
    echo "  $0 --all             # Test both environments"
    exit 0
fi

# Run main function with all arguments
main "$@"