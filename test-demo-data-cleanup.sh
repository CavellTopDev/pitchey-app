#!/bin/bash

# =============================================================================
# PITCHEY APPLICATION - DEMO DATA CLEANUP TEST SUITE
# =============================================================================
# Comprehensive test suite to ensure demo/mock data doesn't reach production
# and validate proper data isolation between environments.
#
# Usage: ./test-demo-data-cleanup.sh [environment]
# Example: ./test-demo-data-cleanup.sh production
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0
CRITICAL_FAILURES=()
DEMO_DATA_FOUND=()
SECURITY_RISKS=()
CLEANUP_ACTIONS=()
RECOMMENDATIONS=()

# Environment to test (default: detect from DENO_ENV)
TARGET_ENV=${1:-$(echo "${DENO_ENV:-development}")}

# Database connection (if available)
DATABASE_URL=${DATABASE_URL:-}

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}PITCHEY DEMO DATA CLEANUP TEST SUITE${NC}"
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
        "CLEAN")
            echo -e "[${CYAN}CLEAN${NC}] $test_name: $message"
            CLEANUP_ACTIONS+=("$message")
            ;;
    esac
}

check_database_connection() {
    if [[ -z "$DATABASE_URL" ]]; then
        log_test "Database Connection" "WARN" "DATABASE_URL not set, skipping database checks"
        return 1
    fi
    
    # Try to connect using available tools
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            log_test "Database Connection" "PASS" "PostgreSQL connection successful"
            return 0
        else
            log_test "Database Connection" "FAIL" "Cannot connect to PostgreSQL database"
            return 1
        fi
    elif command -v deno >/dev/null 2>&1; then
        # Try with deno and postgres library
        if deno eval "
        import postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
        try {
          const sql = postgres('$DATABASE_URL');
          await sql\`SELECT 1\`;
          await sql.end();
          console.log('connected');
        } catch (e) {
          console.error('failed');
          Deno.exit(1);
        }
        " >/dev/null 2>&1; then
            log_test "Database Connection" "PASS" "Database connection via Deno successful"
            return 0
        else
            log_test "Database Connection" "FAIL" "Cannot connect via Deno"
            return 1
        fi
    else
        log_test "Database Connection" "WARN" "No database tools available, skipping DB checks"
        return 1
    fi
}

run_db_query() {
    local query="$1"
    local description="$2"
    
    if [[ -z "$DATABASE_URL" ]]; then
        return 1
    fi
    
    if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" -t -c "$query" 2>/dev/null | tr -d ' '
    elif command -v deno >/dev/null 2>&1; then
        deno eval "
        import postgres from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
        try {
          const sql = postgres('$DATABASE_URL');
          const result = await sql\`$query\`;
          await sql.end();
          console.log(JSON.stringify(result));
        } catch (e) {
          console.error('Query failed: $description');
          Deno.exit(1);
        }
        " 2>/dev/null
    else
        return 1
    fi
}

# =============================================================================
# SOURCE CODE ANALYSIS
# =============================================================================

scan_source_code_for_demo_data() {
    echo -e "\n${PURPLE}=== SOURCE CODE DEMO DATA SCAN ===${NC}"
    
    # Define patterns that indicate demo/test data
    local demo_patterns=(
        "demo\.com"
        "example\.com"
        "test@test\."
        "Demo123"
        "password123"
        "test-secret"
        "mock.*data"
        "fake.*data"
        "1250.*views"
        "892.*followers"
        "hardcoded.*"
        "placeholder"
        "@demo\."
        "demo.*account"
        "test.*account"
    )
    
    # File types to scan
    local file_types=("*.ts" "*.js" "*.tsx" "*.jsx" "*.json" "*.sql")
    
    for pattern in "${demo_patterns[@]}"; do
        local found_count=0
        local found_files=()
        
        for file_type in "${file_types[@]}"; do
            while IFS= read -r -d '' file; do
                if grep -l -i "$pattern" "$file" >/dev/null 2>&1; then
                    found_files+=("$file")
                    ((found_count++))
                fi
            done < <(find . -name "$file_type" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./.git/*" -print0 2>/dev/null)
        done
        
        if [[ $found_count -gt 0 ]]; then
            if [[ "$TARGET_ENV" == "production" ]]; then
                log_test "Demo Pattern: $pattern" "FAIL" "Found in $found_count files (production environment)" "critical"
                DEMO_DATA_FOUND+=("Pattern '$pattern' found in production")
                
                # Show first few occurrences
                for file in "${found_files[@]:0:3}"; do
                    local line_nums=$(grep -n -i "$pattern" "$file" 2>/dev/null | head -2 | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
                    log_test "Demo Data Location" "INFO" "$file (lines: $line_nums)"
                done
            else
                log_test "Demo Pattern: $pattern" "WARN" "Found in $found_count files (acceptable for $TARGET_ENV)"
            fi
        else
            log_test "Demo Pattern: $pattern" "PASS" "Not found in source code"
        fi
    done
}

scan_hardcoded_responses() {
    echo -e "\n${PURPLE}=== HARDCODED API RESPONSES ===${NC}"
    
    # Look for hardcoded response data that might be served instead of real data
    local response_patterns=(
        "views.*[:=].*[0-9]{3,}"
        "followers.*[:=].*[0-9]{3,}"
        "likes.*[:=].*[0-9]{3,}"
        "return.*{.*views.*}"
        "mockData"
        "dummyData"
        "sampleData"
        "testResponse"
        "hardcoded.*response"
    )
    
    for pattern in "${response_patterns[@]}"; do
        local found_files=$(grep -r -l -i "$pattern" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules | head -5)
        
        if [[ -n "$found_files" ]]; then
            if [[ "$TARGET_ENV" == "production" ]]; then
                log_test "Hardcoded Response: $pattern" "FAIL" "Found hardcoded responses in production" "critical"
                echo "$found_files" | while read -r file; do
                    if [[ -n "$file" ]]; then
                        log_test "Hardcoded Location" "INFO" "$file"
                        # Show the actual lines
                        grep -n -i "$pattern" "$file" 2>/dev/null | head -2 | while read -r line; do
                            log_test "Code Line" "INFO" "$(echo "$line" | cut -c1-100)..."
                        done
                    fi
                done
            else
                log_test "Hardcoded Response: $pattern" "WARN" "Found hardcoded responses in $TARGET_ENV"
            fi
        else
            log_test "Hardcoded Response: $pattern" "PASS" "No hardcoded responses found"
        fi
    done
}

check_mock_data_functions() {
    echo -e "\n${PURPLE}=== MOCK DATA FUNCTIONS ===${NC}"
    
    # Look for functions that generate or return mock data
    local mock_functions=(
        "generateMockData"
        "createTestData"
        "getMockResponse"
        "createDemoUser"
        "seedDemoData"
        "mockUserData"
        "dummyResponse"
        "fakeData"
    )
    
    for func in "${mock_functions[@]}"; do
        local found_files=$(grep -r -l "$func" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules)
        
        if [[ -n "$found_files" ]]; then
            # Check if these functions are being called in production code
            local active_calls=$(echo "$found_files" | xargs grep -l "$func(" 2>/dev/null || true)
            
            if [[ -n "$active_calls" && "$TARGET_ENV" == "production" ]]; then
                log_test "Mock Function: $func" "FAIL" "Mock function called in production" "critical"
                DEMO_DATA_FOUND+=("Mock function '$func' active in production")
            elif [[ -n "$found_files" ]]; then
                log_test "Mock Function: $func" "WARN" "Mock function exists but may be inactive"
            fi
        else
            log_test "Mock Function: $func" "PASS" "Mock function not found"
        fi
    done
}

# =============================================================================
# DATABASE ANALYSIS
# =============================================================================

scan_database_demo_accounts() {
    echo -e "\n${PURPLE}=== DATABASE DEMO ACCOUNTS ===${NC}"
    
    if ! check_database_connection; then
        return 0
    fi
    
    # Check for demo email addresses
    local demo_email_query="SELECT email, user_type, created_at FROM users WHERE email LIKE '%demo.com%' OR email LIKE '%example.com%' OR email LIKE '%test%@%' LIMIT 10;"
    local demo_users=$(run_db_query "$demo_email_query" "Demo users check")
    
    if [[ -n "$demo_users" && "$demo_users" != "[]" && "$demo_users" != "" ]]; then
        local user_count=$(echo "$demo_users" | jq '. | length' 2>/dev/null || echo "1")
        
        if [[ "$TARGET_ENV" == "production" ]]; then
            log_test "Database Demo Users" "FAIL" "Found $user_count demo users in production database" "critical"
            DEMO_DATA_FOUND+=("Database contains demo user accounts")
            
            # Show specific demo accounts found
            echo "$demo_users" | jq -r '.[] | "\(.email) (\(.user_type)) - \(.created_at)"' 2>/dev/null | head -5 | while read -r user; do
                log_test "Demo Account" "INFO" "$user"
            done
            
            CLEANUP_ACTIONS+=("DELETE FROM users WHERE email LIKE '%demo.com%' OR email LIKE '%example.com%';")
        else
            log_test "Database Demo Users" "INFO" "Found $user_count demo users (expected in $TARGET_ENV)"
        fi
    else
        log_test "Database Demo Users" "PASS" "No demo user accounts found"
    fi
    
    # Check for test passwords
    local weak_password_query="SELECT email, user_type FROM users WHERE password_hash IN (SELECT password_hash FROM users WHERE email LIKE '%demo.com%') LIMIT 5;"
    local weak_passwords=$(run_db_query "$weak_password_query" "Weak passwords check")
    
    if [[ -n "$weak_passwords" && "$weak_passwords" != "[]" ]]; then
        if [[ "$TARGET_ENV" == "production" ]]; then
            log_test "Database Weak Passwords" "FAIL" "Found accounts with demo-style passwords" "critical"
            SECURITY_RISKS+=("Weak/demo passwords detected in production")
        fi
    fi
}

scan_database_demo_content() {
    echo -e "\n${PURPLE}=== DATABASE DEMO CONTENT ===${NC}"
    
    if ! check_database_connection; then
        return 0
    fi
    
    # Check for demo pitch content
    local demo_pitches_query="SELECT title, description FROM pitches WHERE title LIKE '%test%' OR title LIKE '%demo%' OR title LIKE '%sample%' OR description LIKE '%lorem ipsum%' LIMIT 5;"
    local demo_pitches=$(run_db_query "$demo_pitches_query" "Demo pitches check")
    
    if [[ -n "$demo_pitches" && "$demo_pitches" != "[]" ]]; then
        local pitch_count=$(echo "$demo_pitches" | jq '. | length' 2>/dev/null || echo "1")
        
        if [[ "$TARGET_ENV" == "production" ]]; then
            log_test "Database Demo Pitches" "FAIL" "Found $pitch_count demo pitches in production" "critical"
            DEMO_DATA_FOUND+=("Database contains demo pitch content")
            CLEANUP_ACTIONS+=("DELETE FROM pitches WHERE title LIKE '%test%' OR title LIKE '%demo%' OR title LIKE '%sample%';")
        else
            log_test "Database Demo Pitches" "INFO" "Found $pitch_count demo pitches (expected in $TARGET_ENV)"
        fi
    else
        log_test "Database Demo Pitches" "PASS" "No demo pitch content found"
    fi
    
    # Check for unrealistic analytics data
    local unrealistic_analytics_query="SELECT event_type, COUNT(*) as count FROM analytics_events WHERE event_metadata->>'views' = '1250' OR event_metadata->>'followers' = '892' GROUP BY event_type;"
    local unrealistic_data=$(run_db_query "$unrealistic_analytics_query" "Unrealistic analytics check")
    
    if [[ -n "$unrealistic_data" && "$unrealistic_data" != "[]" ]]; then
        log_test "Database Hardcoded Analytics" "FAIL" "Found hardcoded analytics values (1250 views, 892 followers)" "critical"
        DEMO_DATA_FOUND+=("Hardcoded analytics values in database")
        CLEANUP_ACTIONS+=("DELETE FROM analytics_events WHERE event_metadata->>'views' = '1250' OR event_metadata->>'followers' = '892';")
    else
        log_test "Database Hardcoded Analytics" "PASS" "No hardcoded analytics values found"
    fi
}

check_database_seed_data() {
    echo -e "\n${PURPLE}=== DATABASE SEED DATA VALIDATION ===${NC}"
    
    if ! check_database_connection; then
        return 0
    fi
    
    # Check if seed data is appropriate for environment
    local total_users_query="SELECT COUNT(*) as total FROM users;"
    local total_users=$(run_db_query "$total_users_query" "Total users count")
    
    if [[ -n "$total_users" ]]; then
        local user_count=$(echo "$total_users" | jq -r '.[0].total' 2>/dev/null || echo "$total_users")
        
        if [[ "$TARGET_ENV" == "production" && "$user_count" -lt 5 ]]; then
            log_test "Database Population" "WARN" "Very few users in production database ($user_count)"
            RECOMMENDATIONS+=("Verify if production database has sufficient real user data")
        elif [[ "$TARGET_ENV" == "development" && "$user_count" -gt 100 ]]; then
            log_test "Database Population" "WARN" "Large number of users in development ($user_count)"
            RECOMMENDATIONS+=("Consider reducing development database size for faster testing")
        else
            log_test "Database Population" "PASS" "User count appropriate for $TARGET_ENV ($user_count users)"
        fi
    fi
    
    # Check for placeholder content
    local placeholder_content_query="SELECT COUNT(*) as count FROM pitches WHERE description LIKE '%Lorem ipsum%' OR description LIKE '%placeholder%' OR description LIKE '%TODO%';"
    local placeholder_count=$(run_db_query "$placeholder_content_query" "Placeholder content check")
    
    if [[ -n "$placeholder_count" ]]; then
        local count=$(echo "$placeholder_count" | jq -r '.[0].count' 2>/dev/null || echo "$placeholder_count")
        
        if [[ "$count" -gt 0 && "$TARGET_ENV" == "production" ]]; then
            log_test "Database Placeholder Content" "FAIL" "Found $count pitches with placeholder content" "critical"
            DEMO_DATA_FOUND+=("Placeholder content in production database")
            CLEANUP_ACTIONS+=("UPDATE pitches SET description = '' WHERE description LIKE '%Lorem ipsum%' OR description LIKE '%placeholder%' OR description LIKE '%TODO%';")
        elif [[ "$count" -gt 0 ]]; then
            log_test "Database Placeholder Content" "WARN" "Found $count pitches with placeholder content"
        else
            log_test "Database Placeholder Content" "PASS" "No placeholder content found"
        fi
    fi
}

# =============================================================================
# API RESPONSE ANALYSIS
# =============================================================================

test_api_responses_for_mock_data() {
    echo -e "\n${PURPLE}=== API RESPONSE MOCK DATA CHECK ===${NC}"
    
    # Try to detect if API is running locally
    local api_url="http://localhost:8001"
    local api_available=false
    
    if curl -s --connect-timeout 5 "$api_url/api/health" >/dev/null 2>&1; then
        api_available=true
        log_test "API Availability" "PASS" "Local API server detected"
    else
        log_test "API Availability" "WARN" "Local API server not available, skipping API tests"
        return 0
    fi
    
    if [[ "$api_available" == true ]]; then
        # Test public endpoints for hardcoded data
        local endpoints=(
            "/api/pitches/public"
            "/api/pitches/new"
            "/api/search/popular"
        )
        
        for endpoint in "${endpoints[@]}"; do
            local response=$(curl -s --connect-timeout 10 "$api_url$endpoint" 2>/dev/null || echo "")
            
            if [[ -n "$response" ]]; then
                # Check for hardcoded values
                if echo "$response" | grep -q "1250\|892\|15000\|mockData\|dummyData"; then
                    if [[ "$TARGET_ENV" == "production" ]]; then
                        log_test "API Mock Data: $endpoint" "FAIL" "API returning hardcoded/mock data" "critical"
                        DEMO_DATA_FOUND+=("API endpoint $endpoint returns mock data")
                    else
                        log_test "API Mock Data: $endpoint" "WARN" "API returning mock data (check if intended)"
                    fi
                else
                    log_test "API Mock Data: $endpoint" "PASS" "No obvious mock data detected"
                fi
                
                # Check response structure for suspicious patterns
                if echo "$response" | grep -q "demo\.com\|example\.com\|test@"; then
                    log_test "API Demo Content: $endpoint" "WARN" "API response contains demo email addresses"
                fi
            else
                log_test "API Response: $endpoint" "WARN" "No response from endpoint"
            fi
        done
    fi
}

# =============================================================================
# CONFIGURATION FILES ANALYSIS
# =============================================================================

scan_configuration_files() {
    echo -e "\n${PURPLE}=== CONFIGURATION FILES SCAN ===${NC}"
    
    # Check environment files for demo data
    local env_files=(".env" ".env.local" ".env.production" ".env.development" "frontend/.env" "frontend/.env.production")
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            # Check for demo/test values
            local demo_values=$(grep -i "demo\|test\|example\|changeme\|password123" "$env_file" 2>/dev/null || true)
            
            if [[ -n "$demo_values" && "$TARGET_ENV" == "production" && "$env_file" =~ production ]]; then
                log_test "Env File Demo Data: $env_file" "FAIL" "Production env file contains demo values" "critical"
                DEMO_DATA_FOUND+=("Production env file $env_file has demo values")
            elif [[ -n "$demo_values" ]]; then
                log_test "Env File Demo Data: $env_file" "WARN" "Environment file contains demo values"
            else
                log_test "Env File Demo Data: $env_file" "PASS" "No demo values found"
            fi
            
            # Check for insecure defaults
            if grep -q "localhost" "$env_file" && [[ "$env_file" =~ production ]]; then
                log_test "Env File Security: $env_file" "FAIL" "Production env references localhost" "critical"
                SECURITY_RISKS+=("Production env file references localhost")
            fi
        fi
    done
    
    # Check package.json for demo scripts
    if [[ -f "package.json" ]]; then
        local demo_scripts=$(grep -i "demo\|seed\|test-data" package.json 2>/dev/null || true)
        if [[ -n "$demo_scripts" ]]; then
            log_test "Package Scripts" "INFO" "Found demo/seed scripts in package.json"
        fi
    fi
}

check_demo_account_documentation() {
    echo -e "\n${PURPLE}=== DEMO ACCOUNT DOCUMENTATION ===${NC}"
    
    # Check if demo accounts are documented (which could be a security risk in production)
    local doc_files=("README.md" "DEMO_ACCOUNTS.md" "USER_GUIDE*.md" "*.md")
    
    for pattern in "${doc_files[@]}"; do
        local files=$(find . -name "$pattern" -not -path "./node_modules/*" 2>/dev/null)
        
        if [[ -n "$files" ]]; then
            echo "$files" | while read -r file; do
                if [[ -f "$file" ]]; then
                    local demo_info=$(grep -i "demo.*password\|test.*password\|alex\.creator\|sarah\.investor\|Demo123" "$file" 2>/dev/null || true)
                    
                    if [[ -n "$demo_info" && "$TARGET_ENV" == "production" ]]; then
                        log_test "Demo Documentation: $file" "FAIL" "Production docs expose demo credentials" "critical"
                        SECURITY_RISKS+=("Documentation file $file exposes demo credentials")
                        CLEANUP_ACTIONS+=("Remove or redact demo credentials from $file")
                    elif [[ -n "$demo_info" ]]; then
                        log_test "Demo Documentation: $file" "INFO" "Documentation contains demo account info"
                    fi
                fi
            done
        fi
    done
}

# =============================================================================
# FILE SYSTEM ANALYSIS
# =============================================================================

scan_test_data_files() {
    echo -e "\n${PURPLE}=== TEST DATA FILES SCAN ===${NC}"
    
    # Look for files that might contain test/demo data
    local test_data_patterns=(
        "*.demo.*"
        "*test-data*"
        "*mock-data*"
        "*seed-data*"
        "*demo-accounts*"
        "test-uploads/*"
    )
    
    for pattern in "${test_data_patterns[@]}"; do
        local found_files=$(find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null)
        
        if [[ -n "$found_files" ]]; then
            local file_count=$(echo "$found_files" | wc -l)
            
            if [[ "$TARGET_ENV" == "production" ]]; then
                log_test "Test Data Files: $pattern" "FAIL" "Found $file_count test data files in production" "critical"
                DEMO_DATA_FOUND+=("Test data files matching pattern $pattern")
                
                echo "$found_files" | head -3 | while read -r file; do
                    log_test "Test File" "INFO" "$file"
                    CLEANUP_ACTIONS+=("Remove test data file: $file")
                done
            else
                log_test "Test Data Files: $pattern" "INFO" "Found $file_count test data files (expected in $TARGET_ENV)"
            fi
        else
            log_test "Test Data Files: $pattern" "PASS" "No test data files found"
        fi
    done
}

check_upload_directories() {
    echo -e "\n${PURPLE}=== UPLOAD DIRECTORIES CHECK ===${NC}"
    
    # Check for demo files in upload directories
    local upload_dirs=("static/uploads" "uploads" "public/uploads" "test-uploads")
    
    for dir in "${upload_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local demo_files=$(find "$dir" -name "*demo*" -o -name "*test*" -o -name "*mock*" 2>/dev/null)
            
            if [[ -n "$demo_files" ]]; then
                local file_count=$(echo "$demo_files" | wc -l)
                
                if [[ "$TARGET_ENV" == "production" ]]; then
                    log_test "Upload Demo Files: $dir" "FAIL" "Found $file_count demo files in uploads" "critical"
                    DEMO_DATA_FOUND+=("Demo files in upload directory $dir")
                    
                    echo "$demo_files" | head -3 | while read -r file; do
                        CLEANUP_ACTIONS+=("Remove demo upload file: $file")
                    done
                else
                    log_test "Upload Demo Files: $dir" "INFO" "Found $file_count demo files (expected in $TARGET_ENV)"
                fi
            else
                log_test "Upload Demo Files: $dir" "PASS" "No demo files found in uploads"
            fi
            
            # Check total size of uploads
            local dir_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            log_test "Upload Directory Size" "INFO" "$dir: $dir_size"
        fi
    done
}

# =============================================================================
# ENVIRONMENT-SPECIFIC VALIDATIONS
# =============================================================================

validate_production_data_integrity() {
    if [[ "$TARGET_ENV" != "production" ]]; then
        return 0
    fi
    
    echo -e "\n${PURPLE}=== PRODUCTION DATA INTEGRITY ===${NC}"
    
    # Check for development-specific configurations
    local dev_configs=(
        "localhost"
        "development"
        "debug"
        "test-secret"
        "changeme"
    )
    
    for config in "${dev_configs[@]}"; do
        # Search in all configuration and source files
        local found_in_prod=$(grep -r -i "$config" --include="*.ts" --include="*.js" --include="*.json" --include="*.env*" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -5)
        
        if [[ -n "$found_in_prod" ]]; then
            log_test "Production Config: $config" "FAIL" "Development configuration found in production" "critical"
            SECURITY_RISKS+=("Development config '$config' in production")
        fi
    done
    
    # Verify no demo accounts can authenticate
    log_test "Demo Account Security" "INFO" "Manual verification required: ensure demo accounts cannot authenticate in production"
    RECOMMENDATIONS+=("Manually test that demo accounts (alex.creator@demo.com, etc.) cannot login in production")
}

validate_development_data_isolation() {
    if [[ "$TARGET_ENV" != "development" ]]; then
        return 0
    fi
    
    echo -e "\n${PURPLE}=== DEVELOPMENT DATA ISOLATION ===${NC}"
    
    # Ensure development isn't accidentally connected to production data
    if [[ -n "$DATABASE_URL" ]]; then
        if echo "$DATABASE_URL" | grep -q "production\|prod\|live"; then
            log_test "Development DB Safety" "FAIL" "Development environment connected to production database" "critical"
            CRITICAL_FAILURES+=("Development environment using production database")
        else
            log_test "Development DB Safety" "PASS" "Development database connection appears safe"
        fi
    fi
    
    # Check for production API endpoints in development
    local prod_endpoints=$(grep -r "api\.pitchey\.com\|pitchey-backend.*\.deno\.dev" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v node_modules)
    
    if [[ -n "$prod_endpoints" ]]; then
        log_test "Development API Safety" "WARN" "Development environment may be calling production APIs"
        RECOMMENDATIONS+=("Verify development environment uses local/staging APIs, not production")
    fi
}

# =============================================================================
# CLEANUP RECOMMENDATIONS
# =============================================================================

generate_cleanup_script() {
    if [[ ${#CLEANUP_ACTIONS[@]} -eq 0 ]]; then
        return 0
    fi
    
    echo -e "\n${PURPLE}=== GENERATING CLEANUP SCRIPT ===${NC}"
    
    local cleanup_script="cleanup-demo-data-$(date +%Y%m%d_%H%M%S).sh"
    
    cat > "$cleanup_script" << 'EOF'
#!/bin/bash
# Auto-generated demo data cleanup script
# Review carefully before executing!

set -euo pipefail

echo "Demo Data Cleanup Script"
echo "Review each command before execution"
echo "Press CTRL+C to abort"
echo ""

EOF
    
    for action in "${CLEANUP_ACTIONS[@]}"; do
        echo "echo 'Executing: $action'" >> "$cleanup_script"
        echo "read -p 'Continue? (y/N): ' confirm" >> "$cleanup_script"
        echo 'if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then' >> "$cleanup_script"
        echo '    echo "Skipped"' >> "$cleanup_script"
        echo 'else' >> "$cleanup_script"
        
        if [[ "$action" =~ ^DELETE|^UPDATE ]]; then
            # Database commands
            echo "    psql \"\$DATABASE_URL\" -c \"$action\"" >> "$cleanup_script"
        elif [[ "$action" =~ ^Remove ]]; then
            # File removal commands
            local file_path=$(echo "$action" | sed 's/Remove.*: //')
            echo "    rm -f \"$file_path\"" >> "$cleanup_script"
        fi
        
        echo 'fi' >> "$cleanup_script"
        echo 'echo ""' >> "$cleanup_script"
    done
    
    chmod +x "$cleanup_script"
    log_test "Cleanup Script" "CLEAN" "Generated cleanup script: $cleanup_script"
}

# =============================================================================
# SUMMARY AND REPORTING
# =============================================================================

generate_report() {
    echo -e "\n${BLUE}=========================================${NC}"
    echo -e "${BLUE}DEMO DATA CLEANUP TEST RESULTS${NC}"
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
    
    # Demo data found
    if [[ ${#DEMO_DATA_FOUND[@]} -gt 0 ]]; then
        echo -e "\n${YELLOW}DEMO DATA DETECTED:${NC}"
        for demo in "${DEMO_DATA_FOUND[@]}"; do
            echo -e "  ${YELLOW}🎭${NC} $demo"
        done
    fi
    
    # Security risks
    if [[ ${#SECURITY_RISKS[@]} -gt 0 ]]; then
        echo -e "\n${RED}SECURITY RISKS:${NC}"
        for risk in "${SECURITY_RISKS[@]}"; do
            echo -e "  ${RED}🔐${NC} $risk"
        done
    fi
    
    # Cleanup actions
    if [[ ${#CLEANUP_ACTIONS[@]} -gt 0 ]]; then
        echo -e "\n${CYAN}CLEANUP ACTIONS AVAILABLE:${NC}"
        for action in "${CLEANUP_ACTIONS[@]}"; do
            echo -e "  ${CYAN}🧹${NC} $action"
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
            echo -e "\n${BLUE}PRODUCTION CHECKLIST:${NC}"
            echo -e "  □ All demo accounts removed"
            echo -e "  □ No hardcoded analytics values"
            echo -e "  □ No test/placeholder content"
            echo -e "  □ Documentation doesn't expose credentials"
            echo -e "  □ Upload directories cleaned of test files"
            echo -e "  □ Environment variables use production values"
            echo -e "  □ Database contains only real user data"
            ;;
        "development")
            echo -e "\n${BLUE}DEVELOPMENT BEST PRACTICES:${NC}"
            echo -e "  □ Demo accounts work for testing"
            echo -e "  □ Connected to development database only"
            echo -e "  □ Test data clearly marked and isolated"
            echo -e "  □ No accidental production API calls"
            echo -e "  □ Mock data functions available for testing"
            ;;
    esac
    
    # Overall status
    echo -e "\n${BLUE}OVERALL STATUS:${NC}"
    if [[ ${#CRITICAL_FAILURES[@]} -gt 0 ]]; then
        echo -e "${RED}❌ CRITICAL DEMO DATA ISSUES - IMMEDIATE CLEANUP REQUIRED${NC}"
        exit 1
    elif [[ ${#DEMO_DATA_FOUND[@]} -gt 0 && "$TARGET_ENV" == "production" ]]; then
        echo -e "${RED}⚠️  DEMO DATA IN PRODUCTION - CLEANUP RECOMMENDED${NC}"
        exit 2
    elif [[ ${#SECURITY_RISKS[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  SECURITY CONCERNS - REVIEW REQUIRED${NC}"
        exit 3
    else
        echo -e "${GREEN}✅ DEMO DATA CLEANUP STATUS ACCEPTABLE${NC}"
        exit 0
    fi
}

# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

main() {
    scan_source_code_for_demo_data
    scan_hardcoded_responses
    check_mock_data_functions
    scan_database_demo_accounts
    scan_database_demo_content
    check_database_seed_data
    test_api_responses_for_mock_data
    scan_configuration_files
    check_demo_account_documentation
    scan_test_data_files
    check_upload_directories
    validate_production_data_integrity
    validate_development_data_isolation
    generate_cleanup_script
    generate_report
}

# Run the tests
main "$@"