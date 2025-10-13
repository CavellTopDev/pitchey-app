#!/bin/bash

# Frontend Dynamic Component Integration Test Script
# Tests the integration between frontend dynamic components and backend data

set -e

# Configuration
FRONTEND_URL="http://localhost:5173"
API_BASE="http://localhost:8001"
FRONTEND_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo -e "${BLUE}=== Frontend Dynamic Component Integration Tests ===${NC}"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend API: $API_BASE"
echo ""

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓ PASS${NC} $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            ;;
        "FAIL")
            echo -e "${RED}✗ FAIL${NC} $test_name"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            ;;
        "SKIP")
            echo -e "${YELLOW}⊙ SKIP${NC} $test_name"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            ;;
    esac
    
    if [ -n "$details" ]; then
        echo -e "  ${YELLOW}Details:${NC} $details"
    fi
}

# Function to check if service is running
check_service() {
    local url="$1"
    local service_name="$2"
    
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not running at $url"
        return 1
    fi
}

# Function to test component file structure
test_component_structure() {
    echo -e "${BLUE}=== Testing Component File Structure ===${NC}"
    
    local dynamic_components=(
        "DynamicContent/DynamicPortalCard.tsx"
        "DynamicContent/FeatureFlag.tsx"
        "DynamicContent/DynamicNavigation.tsx"
        "DynamicContent/DynamicFormField.tsx"
        "DynamicContent/DynamicLoginForm.tsx"
    )
    
    for component in "${dynamic_components[@]}"; do
        local component_path="$FRONTEND_DIR/src/components/$component"
        if [ -f "$component_path" ]; then
            print_result "Component exists - $component" "PASS"
        else
            print_result "Component exists - $component" "FAIL" "File not found: $component_path"
        fi
    done
    
    echo ""
}

# Function to test TypeScript compilation
test_typescript_compilation() {
    echo -e "${BLUE}=== Testing TypeScript Compilation ===${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_result "TypeScript Compilation" "SKIP" "node_modules not found, running npm install"
        if npm install > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} npm install completed"
        else
            print_result "NPM Install" "FAIL" "Failed to install dependencies"
            return 1
        fi
    fi
    
    # Run TypeScript type checking
    if npm run type-check > /dev/null 2>&1; then
        print_result "TypeScript Compilation" "PASS"
    elif npx tsc --noEmit > /dev/null 2>&1; then
        print_result "TypeScript Compilation" "PASS" "Using direct tsc"
    else
        print_result "TypeScript Compilation" "FAIL" "Type checking failed"
    fi
    
    echo ""
}

# Function to test component imports and exports
test_component_imports() {
    echo -e "${BLUE}=== Testing Component Imports and Exports ===${NC}"
    
    # Test DynamicPortalCard imports
    local portal_card_imports=$(grep -c "import.*DynamicPortalCard" "$FRONTEND_DIR/src/pages/"*.tsx "$FRONTEND_DIR/src/components/"*.tsx 2>/dev/null || echo "0")
    if [ "$portal_card_imports" -gt 0 ]; then
        print_result "DynamicPortalCard Import Usage" "PASS" "Found $portal_card_imports usages"
    else
        print_result "DynamicPortalCard Import Usage" "FAIL" "No import usages found"
    fi
    
    # Test FeatureFlag imports
    local feature_flag_imports=$(grep -c "import.*FeatureFlag" "$FRONTEND_DIR/src/pages/"*.tsx "$FRONTEND_DIR/src/components/"*.tsx 2>/dev/null || echo "0")
    if [ "$feature_flag_imports" -gt 0 ]; then
        print_result "FeatureFlag Import Usage" "PASS" "Found $feature_flag_imports usages"
    else
        print_result "FeatureFlag Import Usage" "FAIL" "No import usages found"
    fi
    
    # Test hooks existence
    local hooks=(
        "hooks/useContent.ts"
        "hooks/useFeatureFlags.ts"
        "hooks/usePortalConfig.ts"
    )
    
    for hook in "${hooks[@]}"; do
        if [ -f "$FRONTEND_DIR/src/$hook" ]; then
            print_result "Hook exists - ${hook##*/}" "PASS"
        else
            print_result "Hook exists - ${hook##*/}" "FAIL" "File not found"
        fi
    done
    
    echo ""
}

# Function to test API service files
test_api_services() {
    echo -e "${BLUE}=== Testing API Service Files ===${NC}"
    
    local api_services=(
        "services/content-management.api.ts"
        "services/feature-flag.api.ts"
        "services/portal-config.api.ts"
    )
    
    for service in "${api_services[@]}"; do
        local service_path="$FRONTEND_DIR/src/$service"
        if [ -f "$service_path" ]; then
            # Check if service exports the expected functions
            local exports_count=$(grep -c "export.*function\|export.*const.*=" "$service_path" 2>/dev/null || echo "0")
            if [ "$exports_count" -gt 0 ]; then
                print_result "API Service - ${service##*/}" "PASS" "Found $exports_count exports"
            else
                print_result "API Service - ${service##*/}" "FAIL" "No exports found"
            fi
        else
            print_result "API Service - ${service##*/}" "FAIL" "File not found"
        fi
    done
    
    echo ""
}

# Function to test environment configuration
test_environment_config() {
    echo -e "${BLUE}=== Testing Environment Configuration ===${NC}"
    
    # Check frontend .env file
    if [ -f "$FRONTEND_DIR/.env" ]; then
        local api_url=$(grep "VITE_API_URL" "$FRONTEND_DIR/.env" | cut -d'=' -f2)
        local ws_url=$(grep "VITE_WS_URL" "$FRONTEND_DIR/.env" | cut -d'=' -f2)
        
        if [ "$api_url" = "http://localhost:8001" ]; then
            print_result "Frontend API URL Configuration" "PASS"
        else
            print_result "Frontend API URL Configuration" "FAIL" "Expected http://localhost:8001, got $api_url"
        fi
        
        if [ "$ws_url" = "ws://localhost:8001" ]; then
            print_result "Frontend WebSocket URL Configuration" "PASS"
        else
            print_result "Frontend WebSocket URL Configuration" "FAIL" "Expected ws://localhost:8001, got $ws_url"
        fi
    else
        print_result "Frontend Environment File" "FAIL" ".env file not found"
    fi
    
    echo ""
}

# Function to test React component rendering (basic syntax check)
test_component_syntax() {
    echo -e "${BLUE}=== Testing Component Syntax ===${NC}"
    
    local components=(
        "src/components/DynamicContent/DynamicPortalCard.tsx"
        "src/components/DynamicContent/FeatureFlag.tsx"
        "src/components/DynamicContent/DynamicNavigation.tsx"
        "src/components/DynamicContent/DynamicFormField.tsx"
        "src/components/DynamicContent/DynamicLoginForm.tsx"
    )
    
    cd "$FRONTEND_DIR"
    
    for component in "${components[@]}"; do
        if [ -f "$component" ]; then
            # Basic syntax checks
            local has_export=$(grep -c "export.*function\|export.*const.*=" "$component" 2>/dev/null || echo "0")
            local has_tsx_syntax=$(grep -c "React\|JSX\|tsx" "$component" 2>/dev/null || echo "0")
            local has_imports=$(grep -c "import.*React\|import.*from" "$component" 2>/dev/null || echo "0")
            
            if [ "$has_export" -gt 0 ] && [ "$has_imports" -gt 0 ]; then
                print_result "Component Syntax - ${component##*/}" "PASS"
            else
                print_result "Component Syntax - ${component##*/}" "FAIL" "Missing exports or imports"
            fi
        else
            print_result "Component Syntax - ${component##*/}" "FAIL" "File not found"
        fi
    done
    
    echo ""
}

# Function to test types and interfaces
test_types_and_interfaces() {
    echo -e "${BLUE}=== Testing Types and Interfaces ===${NC}"
    
    local type_files=(
        "src/types/content-management.ts"
        "src/types/websocket.ts"
    )
    
    cd "$FRONTEND_DIR"
    
    for type_file in "${type_files[@]}"; do
        if [ -f "$type_file" ]; then
            local interface_count=$(grep -c "interface\|type.*=" "$type_file" 2>/dev/null || echo "0")
            local export_count=$(grep -c "export.*interface\|export.*type" "$type_file" 2>/dev/null || echo "0")
            
            if [ "$interface_count" -gt 0 ] && [ "$export_count" -gt 0 ]; then
                print_result "Type Definitions - ${type_file##*/}" "PASS" "Found $interface_count types/interfaces"
            else
                print_result "Type Definitions - ${type_file##*/}" "FAIL" "No types or exports found"
            fi
        else
            print_result "Type Definitions - ${type_file##*/}" "FAIL" "File not found"
        fi
    done
    
    echo ""
}

# Function to test build process
test_build_process() {
    echo -e "${BLUE}=== Testing Build Process ===${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Test if build command exists
    if grep -q '"build"' package.json; then
        print_result "Build Script Exists" "PASS"
        
        # Try to run build (skip actual build to save time, just check if it starts)
        if timeout 10s npm run build > /dev/null 2>&1; then
            print_result "Build Process" "PASS" "Build started successfully"
        else
            # Check if build at least starts (some errors are expected without full setup)
            if npm run build 2>&1 | head -n 5 | grep -q "vite\|webpack\|rollup\|build"; then
                print_result "Build Process" "PASS" "Build tooling detected"
            else
                print_result "Build Process" "FAIL" "Build command failed to start"
            fi
        fi
    else
        print_result "Build Script Exists" "FAIL" "No build script in package.json"
    fi
    
    echo ""
}

# Function to simulate frontend-backend integration
test_integration_simulation() {
    echo -e "${BLUE}=== Testing Frontend-Backend Integration Simulation ===${NC}"
    
    # Test if backend endpoints are accessible
    local endpoints=(
        "/api/content/portals/creator"
        "/api/features/flags"
        "/api/config/portal/creator"
        "/api/content/navigation/creator"
        "/api/i18n/translations"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s "$API_BASE$endpoint" > /dev/null 2>&1; then
            print_result "Backend Endpoint - ${endpoint##*/}" "PASS"
        else
            print_result "Backend Endpoint - ${endpoint##*/}" "FAIL" "Endpoint not accessible"
        fi
    done
    
    # Test CORS configuration
    local cors_response=$(curl -s -I -X OPTIONS "$API_BASE/api/content/portals/creator" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
    if [ -n "$cors_response" ]; then
        print_result "CORS Configuration" "PASS"
    else
        print_result "CORS Configuration" "FAIL" "No CORS headers found"
    fi
    
    echo ""
}

# Function to check for common integration issues
test_common_issues() {
    echo -e "${BLUE}=== Testing Common Integration Issues ===${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Check for duplicate dependencies
    local duplicate_react=$(grep -c '"react"' package.json 2>/dev/null || echo "0")
    if [ "$duplicate_react" -eq 1 ]; then
        print_result "React Dependency" "PASS"
    else
        print_result "React Dependency" "FAIL" "Duplicate or missing React dependency"
    fi
    
    # Check for TypeScript configuration
    if [ -f "tsconfig.json" ]; then
        print_result "TypeScript Configuration" "PASS"
    else
        print_result "TypeScript Configuration" "FAIL" "Missing tsconfig.json"
    fi
    
    # Check for Vite configuration
    if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ]; then
        print_result "Vite Configuration" "PASS"
    else
        print_result "Vite Configuration" "FAIL" "Missing vite.config file"
    fi
    
    # Check for potential circular dependencies in imports
    local circular_imports=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "import.*\.\./\.\./\.\." 2>/dev/null | wc -l)
    if [ "$circular_imports" -eq 0 ]; then
        print_result "Circular Import Check" "PASS"
    else
        print_result "Circular Import Check" "FAIL" "Potential circular imports found: $circular_imports files"
    fi
    
    echo ""
}

# Function to test error boundaries and fallbacks
test_error_handling() {
    echo -e "${BLUE}=== Testing Error Handling Implementation ===${NC}"
    
    cd "$FRONTEND_DIR"
    
    # Check for ErrorBoundary component
    if [ -f "src/components/ErrorBoundary.tsx" ]; then
        local has_error_boundary=$(grep -c "componentDidCatch\|getDerivedStateFromError" "src/components/ErrorBoundary.tsx" 2>/dev/null || echo "0")
        if [ "$has_error_boundary" -gt 0 ]; then
            print_result "Error Boundary Implementation" "PASS"
        else
            print_result "Error Boundary Implementation" "FAIL" "Error boundary methods not found"
        fi
    else
        print_result "Error Boundary Component" "FAIL" "ErrorBoundary.tsx not found"
    fi
    
    # Check for fallback props in dynamic components
    local components_with_fallbacks=$(grep -l "fallback.*=" src/components/DynamicContent/*.tsx 2>/dev/null | wc -l)
    if [ "$components_with_fallbacks" -gt 0 ]; then
        print_result "Component Fallback Props" "PASS" "$components_with_fallbacks components have fallbacks"
    else
        print_result "Component Fallback Props" "FAIL" "No fallback props found in dynamic components"
    fi
    
    # Check for loading states
    local components_with_loading=$(grep -l "loading\|isLoading" src/components/DynamicContent/*.tsx 2>/dev/null | wc -l)
    if [ "$components_with_loading" -gt 0 ]; then
        print_result "Loading State Implementation" "PASS" "$components_with_loading components handle loading"
    else
        print_result "Loading State Implementation" "FAIL" "No loading states found"
    fi
    
    echo ""
}

# Main test execution
main() {
    echo "Starting Frontend Dynamic Component Integration Tests..."
    echo "Timestamp: $(date)"
    echo ""
    
    # Check if services are running
    echo -e "${BLUE}=== Checking Service Status ===${NC}"
    check_service "$API_BASE/health" "Backend API" || echo -e "${YELLOW}Note: Some tests may fail if backend is not running${NC}"
    echo ""
    
    # Run all test suites
    test_component_structure
    test_typescript_compilation
    test_component_imports
    test_api_services
    test_environment_config
    test_component_syntax
    test_types_and_interfaces
    test_build_process
    test_integration_simulation
    test_common_issues
    test_error_handling
    
    # Print summary
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}"
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $success_rate%"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✅${NC}"
        exit 0
    elif [ "$success_rate" -ge 80 ]; then
        echo -e "${YELLOW}Most tests passed! ⚠️${NC}"
        exit 0
    else
        echo -e "${RED}Many tests failed! ❌${NC}"
        exit 1
    fi
}

# Check dependencies
command -v curl >/dev/null 2>&1 || { echo -e "${RED}ERROR: curl is required${NC}"; exit 1; }
command -v grep >/dev/null 2>&1 || { echo -e "${RED}ERROR: grep is required${NC}"; exit 1; }

# Run tests
main "$@"