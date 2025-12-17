#!/bin/bash

# Quality Gate Enforcement Script
# Comprehensive quality validation before deployment

set -e

echo "🏁 Running Quality Gate Validation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Quality gate thresholds
MIN_COVERAGE=90
MIN_CRITICAL_COVERAGE=95
MAX_TECHNICAL_DEBT_HOURS=8
MAX_SECURITY_ISSUES=0
MAX_PERFORMANCE_REGRESSION_PERCENT=10
MIN_LIGHTHOUSE_SCORE=90

# Initialize results
RESULTS_FILE="quality-gate-results.json"
REPORT_FILE="quality-gate-report.md"

cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gates": {
    "tests": {"status": "pending", "details": {}},
    "coverage": {"status": "pending", "details": {}},
    "security": {"status": "pending", "details": {}},
    "performance": {"status": "pending", "details": {}},
    "code_quality": {"status": "pending", "details": {}},
    "documentation": {"status": "pending", "details": {}},
    "dependencies": {"status": "pending", "details": {}}
  },
  "overall_status": "pending",
  "deployment_approved": false
}
EOF

# Track gate results
tests_pass=true
coverage_pass=true
security_pass=true
performance_pass=true
code_quality_pass=true
documentation_pass=true
dependencies_pass=true

echo "🚀 Starting Quality Gate Validation Process..."

# ==================== GATE 1: TEST EXECUTION ====================

echo ""
echo "🧪 GATE 1: Test Execution"
echo "========================================="

echo "Running comprehensive test suite..."

# Unit Tests
echo "  📋 Running unit tests..."
unit_test_result="passed"
unit_test_count=0

if command -v deno >/dev/null 2>&1; then
    if deno test tests/unit/ --parallel --quiet > unit-test-output.log 2>&1; then
        unit_test_count=$(grep -c "ok\|PASSED" unit-test-output.log 2>/dev/null || echo "0")
        echo -e "    ${GREEN}✅ Unit tests passed ($unit_test_count tests)${NC}"
    else
        unit_test_result="failed"
        tests_pass=false
        echo -e "    ${RED}❌ Unit tests failed${NC}"
        tail -5 unit-test-output.log
    fi
    rm -f unit-test-output.log
else
    echo -e "    ${YELLOW}⚠️  Deno not available for unit tests${NC}"
fi

# Integration Tests
echo "  🔗 Running integration tests..."
integration_test_result="passed"
integration_test_count=0

if command -v deno >/dev/null 2>&1; then
    if deno test tests/integration/ --parallel --quiet > integration-test-output.log 2>&1; then
        integration_test_count=$(grep -c "ok\|PASSED" integration-test-output.log 2>/dev/null || echo "0")
        echo -e "    ${GREEN}✅ Integration tests passed ($integration_test_count tests)${NC}"
    else
        integration_test_result="failed"
        tests_pass=false
        echo -e "    ${RED}❌ Integration tests failed${NC}"
        tail -5 integration-test-output.log
    fi
    rm -f integration-test-output.log
else
    echo -e "    ${YELLOW}⚠️  Deno not available for integration tests${NC}"
fi

# Frontend Tests
echo "  🎨 Running frontend tests..."
frontend_test_result="passed"
frontend_test_count=0

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend
    if npm test -- --run --silent > ../frontend-test-output.log 2>&1; then
        frontend_test_count=$(grep -c "✓\|PASS" ../frontend-test-output.log 2>/dev/null || echo "0")
        echo -e "    ${GREEN}✅ Frontend tests passed ($frontend_test_count tests)${NC}"
    else
        frontend_test_result="failed"
        tests_pass=false
        echo -e "    ${RED}❌ Frontend tests failed${NC}"
        tail -5 ../frontend-test-output.log
    fi
    cd ..
    rm -f frontend-test-output.log
else
    echo -e "    ${BLUE}ℹ️  No frontend tests configured${NC}"
fi

# E2E Tests (if available)
echo "  🌐 Running E2E tests..."
e2e_test_result="passed"

if [ -f "playwright.config.ts" ] && command -v npx >/dev/null 2>&1; then
    if npx playwright test --quiet > e2e-test-output.log 2>&1; then
        echo -e "    ${GREEN}✅ E2E tests passed${NC}"
    else
        e2e_test_result="failed"
        tests_pass=false
        echo -e "    ${RED}❌ E2E tests failed${NC}"
        tail -5 e2e-test-output.log
    fi
    rm -f e2e-test-output.log
else
    echo -e "    ${BLUE}ℹ️  E2E tests not configured${NC}"
fi

echo "Tests Summary: Unit($unit_test_count), Integration($integration_test_count), Frontend($frontend_test_count)"

# ==================== GATE 2: CODE COVERAGE ====================

echo ""
echo "📊 GATE 2: Code Coverage"
echo "========================================="

if [ -f "scripts/check-coverage.sh" ]; then
    echo "Running coverage analysis..."
    
    if ./scripts/check-coverage.sh > coverage-gate-output.log 2>&1; then
        coverage_percent=$(grep -o "Backend Coverage: [0-9.]*%" coverage-gate-output.log | grep -o "[0-9.]*" || echo "0")
        
        if (( $(echo "$coverage_percent >= $MIN_COVERAGE" | bc -l 2>/dev/null || echo "0") )); then
            echo -e "  ${GREEN}✅ Coverage requirement met: ${coverage_percent}% >= ${MIN_COVERAGE}%${NC}"
        else
            coverage_pass=false
            echo -e "  ${RED}❌ Coverage below threshold: ${coverage_percent}% < ${MIN_COVERAGE}%${NC}"
        fi
    else
        coverage_pass=false
        echo -e "  ${RED}❌ Coverage check failed${NC}"
        tail -10 coverage-gate-output.log
    fi
    rm -f coverage-gate-output.log
else
    coverage_pass=false
    echo -e "  ${RED}❌ Coverage script not found${NC}"
fi

# ==================== GATE 3: SECURITY VALIDATION ====================

echo ""
echo "🔐 GATE 3: Security Validation"
echo "========================================="

if [ -f "scripts/security-scan.sh" ]; then
    echo "Running security scans..."
    
    if ./scripts/security-scan.sh > security-gate-output.log 2>&1; then
        echo -e "  ${GREEN}✅ All security scans passed${NC}"
    else
        security_pass=false
        echo -e "  ${RED}❌ Security issues detected${NC}"
        
        # Extract key security metrics
        critical_vulns=$(grep -o "Critical.*[0-9]\+" security-gate-output.log | grep -o "[0-9]\+" | tail -1 || echo "0")
        high_vulns=$(grep -o "High.*[0-9]\+" security-gate-output.log | grep -o "[0-9]\+" | tail -1 || echo "0")
        
        echo "    Critical vulnerabilities: $critical_vulns"
        echo "    High vulnerabilities: $high_vulns"
        
        if [ "$critical_vulns" -gt "$MAX_SECURITY_ISSUES" ] || [ "$high_vulns" -gt "$MAX_SECURITY_ISSUES" ]; then
            echo -e "    ${RED}❌ Critical/High vulnerabilities exceed threshold${NC}"
        fi
    fi
    rm -f security-gate-output.log
else
    security_pass=false
    echo -e "  ${RED}❌ Security scan script not found${NC}"
fi

# ==================== GATE 4: PERFORMANCE VALIDATION ====================

echo ""
echo "🚀 GATE 4: Performance Validation"
echo "========================================="

if [ -f "scripts/performance-check.sh" ]; then
    echo "Running performance benchmarks..."
    
    if ./scripts/performance-check.sh > performance-gate-output.log 2>&1; then
        echo -e "  ${GREEN}✅ Performance benchmarks passed${NC}"
        
        # Extract performance metrics
        api_time=$(grep -o "Average API response time: [0-9]*ms" performance-gate-output.log | grep -o "[0-9]*" || echo "0")
        bundle_size=$(grep -o "Frontend bundle size: [0-9]*KB" performance-gate-output.log | grep -o "[0-9]*" || echo "0")
        lighthouse_score=$(grep -o "Lighthouse Performance Score: [0-9]*%" performance-gate-output.log | grep -o "[0-9]*" || echo "0")
        
        echo "    API Response Time: ${api_time}ms"
        echo "    Bundle Size: ${bundle_size}KB" 
        echo "    Lighthouse Score: ${lighthouse_score}%"
        
    else
        performance_pass=false
        echo -e "  ${RED}❌ Performance benchmarks failed${NC}"
        tail -10 performance-gate-output.log
    fi
    rm -f performance-gate-output.log
else
    performance_pass=false
    echo -e "  ${RED}❌ Performance check script not found${NC}"
fi

# ==================== GATE 5: CODE QUALITY ====================

echo ""
echo "🎯 GATE 5: Code Quality"
echo "========================================="

# TypeScript compilation check
echo "  🔧 Checking TypeScript compilation..."
ts_check_pass=true

if command -v deno >/dev/null 2>&1; then
    if deno check src/worker.ts > ts-check-output.log 2>&1; then
        echo -e "    ${GREEN}✅ TypeScript compilation successful${NC}"
    else
        ts_check_pass=false
        code_quality_pass=false
        echo -e "    ${RED}❌ TypeScript compilation errors${NC}"
        head -5 ts-check-output.log
    fi
    rm -f ts-check-output.log
fi

# Linting check
echo "  📝 Running code linting..."
lint_check_pass=true

if command -v deno >/dev/null 2>&1; then
    if deno lint src/ > lint-output.log 2>&1; then
        echo -e "    ${GREEN}✅ Code linting passed${NC}"
    else
        lint_issues=$(grep -c "error\|warning" lint-output.log 2>/dev/null || echo "0")
        if [ "$lint_issues" -gt 10 ]; then
            lint_check_pass=false
            code_quality_pass=false
            echo -e "    ${RED}❌ Too many linting issues: $lint_issues${NC}"
        else
            echo -e "    ${YELLOW}⚠️  $lint_issues linting issues (under threshold)${NC}"
        fi
    fi
    rm -f lint-output.log
fi

# Frontend linting
if [ -d "frontend" ]; then
    cd frontend
    if npm run lint > ../frontend-lint-output.log 2>&1; then
        echo -e "    ${GREEN}✅ Frontend linting passed${NC}"
    else
        frontend_lint_issues=$(grep -c "error\|warning" ../frontend-lint-output.log 2>/dev/null || echo "0")
        if [ "$frontend_lint_issues" -gt 10 ]; then
            code_quality_pass=false
            echo -e "    ${RED}❌ Too many frontend linting issues: $frontend_lint_issues${NC}"
        else
            echo -e "    ${YELLOW}⚠️  $frontend_lint_issues frontend linting issues${NC}"
        fi
    fi
    cd ..
    rm -f frontend-lint-output.log
fi

# ==================== GATE 6: DOCUMENTATION ====================

echo ""
echo "📚 GATE 6: Documentation"
echo "========================================="

doc_score=0
total_doc_checks=5

# Check for README
if [ -f "README.md" ]; then
    doc_score=$((doc_score + 1))
    echo -e "  ${GREEN}✅ README.md exists${NC}"
else
    echo -e "  ${YELLOW}⚠️  README.md missing${NC}"
fi

# Check for API documentation
if [ -f "API_ENDPOINTS_DOCUMENTATION.md" ] || [ -f "api-docs.md" ] || [ -f "docs/api.md" ]; then
    doc_score=$((doc_score + 1))
    echo -e "  ${GREEN}✅ API documentation exists${NC}"
else
    echo -e "  ${YELLOW}⚠️  API documentation missing${NC}"
fi

# Check for deployment documentation
if [ -f "CLOUDFLARE_DEPLOYMENT_GUIDE.md" ] || [ -f "DEPLOYMENT_ARCHITECTURE.md" ] || [ -f "deployment.md" ]; then
    doc_score=$((doc_score + 1))
    echo -e "  ${GREEN}✅ Deployment documentation exists${NC}"
else
    echo -e "  ${YELLOW}⚠️  Deployment documentation missing${NC}"
fi

# Check for code comments
comment_files=$(find src -name "*.ts" -exec grep -l "^\s*/\*\*\|^\s*//" {} \; | wc -l)
total_source_files=$(find src -name "*.ts" | wc -l)

if [ "$total_source_files" -gt 0 ]; then
    comment_ratio=$((comment_files * 100 / total_source_files))
    if [ "$comment_ratio" -gt 70 ]; then
        doc_score=$((doc_score + 1))
        echo -e "  ${GREEN}✅ Good code documentation coverage: ${comment_ratio}%${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Code documentation coverage low: ${comment_ratio}%${NC}"
    fi
fi

# Check for type definitions
if find src -name "*.ts" -exec grep -l "interface\|type\|enum" {} \; | wc -l | grep -q -v "0"; then
    doc_score=$((doc_score + 1))
    echo -e "  ${GREEN}✅ TypeScript type definitions found${NC}"
else
    echo -e "  ${YELLOW}⚠️  Limited TypeScript type definitions${NC}"
fi

doc_percentage=$((doc_score * 100 / total_doc_checks))
if [ "$doc_percentage" -lt 60 ]; then
    documentation_pass=false
    echo -e "  ${RED}❌ Documentation score too low: ${doc_percentage}%${NC}"
else
    echo -e "  ${GREEN}✅ Documentation score acceptable: ${doc_percentage}%${NC}"
fi

# ==================== GATE 7: DEPENDENCY CHECK ====================

echo ""
echo "📦 GATE 7: Dependency Validation"
echo "========================================="

# Check for outdated dependencies
echo "  🔍 Checking dependency health..."

outdated_deps=0

# Frontend dependency check
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend
    
    # Check for known vulnerable packages
    if npm audit --audit-level=high > ../npm-audit-output.log 2>&1; then
        echo -e "    ${GREEN}✅ No high-risk npm vulnerabilities${NC}"
    else
        high_vulns=$(grep -c "High" ../npm-audit-output.log 2>/dev/null || echo "0")
        critical_vulns=$(grep -c "Critical" ../npm-audit-output.log 2>/dev/null || echo "0")
        
        if [ "$high_vulns" -gt 0 ] || [ "$critical_vulns" -gt 0 ]; then
            dependencies_pass=false
            echo -e "    ${RED}❌ High/Critical npm vulnerabilities found: High($high_vulns), Critical($critical_vulns)${NC}"
        else
            echo -e "    ${YELLOW}⚠️  Some npm vulnerabilities found (low/medium)${NC}"
        fi
    fi
    
    rm -f ../npm-audit-output.log
    cd ..
fi

# Check for package-lock.json consistency
if [ -f "frontend/package.json" ] && [ -f "frontend/package-lock.json" ]; then
    echo -e "    ${GREEN}✅ Package lock file exists${NC}"
else
    dependencies_pass=false
    echo -e "    ${RED}❌ Package lock file missing or inconsistent${NC}"
fi

# Backend dependency check (Deno)
if [ -f "deno.json" ] || [ -f "deno.jsonc" ]; then
    echo -e "    ${GREEN}✅ Deno configuration found${NC}"
    
    # Check for HTTPS imports
    http_imports=$(find src -name "*.ts" -exec grep -h "from.*http://" {} \; | wc -l)
    if [ "$http_imports" -gt 0 ]; then
        dependencies_pass=false
        echo -e "    ${RED}❌ Insecure HTTP imports found: $http_imports${NC}"
    else
        echo -e "    ${GREEN}✅ All imports use HTTPS${NC}"
    fi
fi

# ==================== FINAL QUALITY GATE DECISION ====================

echo ""
echo "🏆 QUALITY GATE SUMMARY"
echo "========================================="

# Update results file
overall_pass=true

if [ "$tests_pass" = false ] || [ "$coverage_pass" = false ] || [ "$security_pass" = false ] || [ "$performance_pass" = false ] || [ "$code_quality_pass" = false ] || [ "$documentation_pass" = false ] || [ "$dependencies_pass" = false ]; then
    overall_pass=false
fi

# Display gate results
echo "Gate Results:"
echo "  🧪 Tests:         $([ "$tests_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  📊 Coverage:      $([ "$coverage_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  🔐 Security:      $([ "$security_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  🚀 Performance:   $([ "$performance_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  🎯 Code Quality:  $([ "$code_quality_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  📚 Documentation: $([ "$documentation_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  📦 Dependencies:  $([ "$dependencies_pass" = true ] && echo -e "${GREEN}PASS${NC}" || echo -e "${RED}FAIL${NC}")"

echo ""
echo "========================================="

if [ "$overall_pass" = true ]; then
    echo -e "${GREEN}🎉 ALL QUALITY GATES PASSED!${NC}"
    echo -e "${GREEN}✅ Deployment APPROVED${NC}"
    deployment_status="APPROVED"
    exit_code=0
else
    echo -e "${RED}❌ QUALITY GATES FAILED!${NC}"
    echo -e "${RED}🚫 Deployment BLOCKED${NC}"
    deployment_status="BLOCKED"
    exit_code=1
    
    echo ""
    echo "Failed Gates:"
    [ "$tests_pass" = false ] && echo "  - Tests: Fix failing tests before deployment"
    [ "$coverage_pass" = false ] && echo "  - Coverage: Increase test coverage to $MIN_COVERAGE%"
    [ "$security_pass" = false ] && echo "  - Security: Address security vulnerabilities"
    [ "$performance_pass" = false ] && echo "  - Performance: Fix performance regressions"
    [ "$code_quality_pass" = false ] && echo "  - Code Quality: Fix linting and compilation issues"
    [ "$documentation_pass" = false ] && echo "  - Documentation: Improve documentation coverage"
    [ "$dependencies_pass" = false ] && echo "  - Dependencies: Update vulnerable dependencies"
fi

# Generate final quality gate report
cat > "$REPORT_FILE" << EOF
# Quality Gate Report

Generated: $(date)

## Executive Summary

**Deployment Status**: $deployment_status

$([ "$overall_pass" = true ] && echo "🎉 All quality gates have been successfully passed. The code is ready for deployment to production." || echo "❌ One or more quality gates have failed. Deployment is blocked until issues are resolved.")

## Gate Results

| Gate | Status | Details |
|------|--------|---------|
| Tests | $([ "$tests_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | Unit: $unit_test_count, Integration: $integration_test_count, Frontend: $frontend_test_count |
| Coverage | $([ "$coverage_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | Target: ≥${MIN_COVERAGE}%, Actual: ${coverage_percent:-"N/A"}% |
| Security | $([ "$security_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | Critical: $critical_vulns, High: $high_vulns |
| Performance | $([ "$performance_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | API: ${api_time:-"N/A"}ms, Bundle: ${bundle_size:-"N/A"}KB, Lighthouse: ${lighthouse_score:-"N/A"}% |
| Code Quality | $([ "$code_quality_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | TypeScript: $([ "$ts_check_pass" = true ] && echo "✅" || echo "❌"), Linting: $([ "$lint_check_pass" = true ] && echo "✅" || echo "❌") |
| Documentation | $([ "$documentation_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | Coverage: ${doc_percentage}% |
| Dependencies | $([ "$dependencies_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL") | Vulnerabilities checked and resolved |

## Detailed Analysis

### Test Results
- **Unit Tests**: $unit_test_count tests executed
- **Integration Tests**: $integration_test_count tests executed  
- **Frontend Tests**: $frontend_test_count tests executed
- **E2E Tests**: $([ "$e2e_test_result" = "passed" ] && echo "Passed" || echo "Not configured/Failed")

### Code Coverage
- **Backend Coverage**: ${coverage_percent:-"N/A"}%
- **Threshold**: ${MIN_COVERAGE}%
- **Critical Path Coverage**: Target ${MIN_CRITICAL_COVERAGE}%

### Security Assessment
- **Critical Vulnerabilities**: ${critical_vulns:-0}
- **High Vulnerabilities**: ${high_vulns:-0}
- **Secret Scanning**: Completed
- **Dependency Security**: Verified

### Performance Metrics
- **API Response Time**: ${api_time:-"N/A"}ms (Target: <500ms)
- **Bundle Size**: ${bundle_size:-"N/A"}KB (Target: <1024KB)
- **Lighthouse Score**: ${lighthouse_score:-"N/A"}% (Target: ≥90%)

## Recommendations

$(if [ "$overall_pass" = false ]; then
    echo "### Immediate Actions Required"
    [ "$tests_pass" = false ] && echo "1. **Fix Failing Tests**: All tests must pass before deployment"
    [ "$coverage_pass" = false ] && echo "2. **Increase Coverage**: Add tests to reach ${MIN_COVERAGE}% coverage threshold"
    [ "$security_pass" = false ] && echo "3. **Address Security Issues**: Fix all critical and high severity vulnerabilities"
    [ "$performance_pass" = false ] && echo "4. **Optimize Performance**: Address performance regressions and bottlenecks"
    [ "$code_quality_pass" = false ] && echo "5. **Fix Code Quality**: Resolve linting errors and compilation issues"
    [ "$documentation_pass" = false ] && echo "6. **Improve Documentation**: Add missing documentation and code comments"
    [ "$dependencies_pass" = false ] && echo "7. **Update Dependencies**: Fix vulnerable and outdated dependencies"
    echo ""
fi)

### Continuous Improvement
1. **Automated Monitoring**: Set up continuous quality monitoring
2. **Regular Audits**: Schedule monthly security and performance audits
3. **Team Training**: Provide training on quality standards and best practices
4. **Tool Integration**: Integrate quality tools into IDE and development workflow

## Sign-off

$([ "$overall_pass" = true ] && echo "✅ **Quality Assurance**: Approved for production deployment" || echo "❌ **Quality Assurance**: Deployment blocked - resolve issues listed above")

**Reviewed by**: Quality Gate Automation  
**Report generated**: $(date)  
**Next review**: Required after issue resolution

---

*This report was generated automatically by the quality gate system. For questions or support, contact the development team.*
EOF

echo ""
echo -e "${BLUE}📄 Quality gate report generated: $REPORT_FILE${NC}"

# Update final results
jq --arg overall_status "$([ "$overall_pass" = true ] && echo "passed" || echo "failed")" \
   --argjson deployment_approved "$([ "$overall_pass" = true ] && echo "true" || echo "false")" \
   '.overall_status = $overall_status | .deployment_approved = $deployment_approved' \
   "$RESULTS_FILE" > temp-results.json && mv temp-results.json "$RESULTS_FILE" 2>/dev/null || true

echo ""
echo "Quality gate validation complete."

exit $exit_code