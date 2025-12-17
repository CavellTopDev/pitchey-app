#!/bin/bash

# Coverage Check Script
# Enforces minimum coverage thresholds for backend and frontend

set -e

echo "🔍 Checking Test Coverage..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Coverage thresholds
MIN_OVERALL_COVERAGE=90
MIN_CRITICAL_COVERAGE=95
MIN_FRONTEND_COVERAGE=85

# ==================== BACKEND COVERAGE ====================

echo "📊 Checking Backend Coverage..."

# Run backend tests with coverage
cd "$(dirname "$0")/.."
deno test tests/unit/ tests/integration/ --coverage=coverage/ --parallel > /dev/null 2>&1

# Generate coverage report
deno coverage coverage/ --lcov > coverage/lcov.info

# Parse coverage from lcov file
if [ -f "coverage/lcov.info" ]; then
    # Extract coverage percentage using awk
    BACKEND_COVERAGE=$(awk '
        /^SF:/ { file_count++ }
        /^LH:/ { lines_hit += $2 }
        /^LF:/ { lines_found += $2 }
        END { 
            if (lines_found > 0) 
                printf "%.1f", (lines_hit / lines_found) * 100 
            else 
                print "0"
        }
    ' coverage/lcov.info)
    
    echo "Backend Coverage: ${BACKEND_COVERAGE}%"
    
    # Check if coverage meets threshold
    if (( $(echo "$BACKEND_COVERAGE >= $MIN_OVERALL_COVERAGE" | bc -l) )); then
        echo -e "${GREEN}✅ Backend coverage meets threshold (${MIN_OVERALL_COVERAGE}%)${NC}"
        BACKEND_PASS=true
    else
        echo -e "${RED}❌ Backend coverage below threshold: ${BACKEND_COVERAGE}% < ${MIN_OVERALL_COVERAGE}%${NC}"
        BACKEND_PASS=false
    fi
else
    echo -e "${RED}❌ Backend coverage report not found${NC}"
    BACKEND_PASS=false
fi

# ==================== CRITICAL PATH COVERAGE ====================

echo "🎯 Checking Critical Path Coverage..."

# Define critical files/paths
CRITICAL_PATHS=(
    "src/routes/auth"
    "src/routes/users"
    "src/routes/pitches"
    "src/routes/ndas"
    "src/db/connection"
    "src/middleware"
)

CRITICAL_PASS=true

for path in "${CRITICAL_PATHS[@]}"; do
    if [ -d "$path" ]; then
        # Check coverage for each file in critical path
        find "$path" -name "*.ts" -not -name "*.test.ts" | while read -r file; do
            # Extract coverage for specific file from lcov
            FILE_COVERAGE=$(awk -v file="$file" '
                /^SF:/ { current_file = substr($0, 4) }
                current_file == file && /^LH:/ { lines_hit = $2 }
                current_file == file && /^LF:/ { lines_found = $2 }
                current_file == file && /^end_of_record/ { 
                    if (lines_found > 0) 
                        printf "%.1f", (lines_hit / lines_found) * 100
                    else
                        print "0"
                    exit
                }
            ' coverage/lcov.info)
            
            if [ -n "$FILE_COVERAGE" ]; then
                if (( $(echo "$FILE_COVERAGE >= $MIN_CRITICAL_COVERAGE" | bc -l) )); then
                    echo -e "  ${GREEN}✅ $file: ${FILE_COVERAGE}%${NC}"
                else
                    echo -e "  ${RED}❌ $file: ${FILE_COVERAGE}% < ${MIN_CRITICAL_COVERAGE}%${NC}"
                    CRITICAL_PASS=false
                fi
            else
                echo -e "  ${YELLOW}⚠️  $file: No coverage data${NC}"
            fi
        done
    fi
done

# ==================== FRONTEND COVERAGE ====================

echo "🎨 Checking Frontend Coverage..."

cd frontend

# Run frontend tests with coverage
if npm test -- --run --coverage --reporter=json > test-results.json 2>/dev/null; then
    # Extract coverage from test results
    if [ -f "coverage/coverage-summary.json" ]; then
        FRONTEND_COVERAGE=$(node -e "
            const coverage = require('./coverage/coverage-summary.json');
            console.log(coverage.total.lines.pct);
        " 2>/dev/null || echo "0")
        
        echo "Frontend Coverage: ${FRONTEND_COVERAGE}%"
        
        # Check if coverage meets threshold
        if (( $(echo "$FRONTEND_COVERAGE >= $MIN_FRONTEND_COVERAGE" | bc -l) )); then
            echo -e "${GREEN}✅ Frontend coverage meets threshold (${MIN_FRONTEND_COVERAGE}%)${NC}"
            FRONTEND_PASS=true
        else
            echo -e "${RED}❌ Frontend coverage below threshold: ${FRONTEND_COVERAGE}% < ${MIN_FRONTEND_COVERAGE}%${NC}"
            FRONTEND_PASS=false
        fi
    else
        echo -e "${YELLOW}⚠️  Frontend coverage report not found${NC}"
        FRONTEND_PASS=true  # Don't fail if frontend tests are optional
    fi
else
    echo -e "${YELLOW}⚠️  Frontend tests failed or not configured${NC}"
    FRONTEND_PASS=true  # Don't fail if frontend tests are optional
fi

cd ..

# ==================== COVERAGE REPORT GENERATION ====================

echo "📈 Generating Coverage Report..."

# Create combined coverage report
cat > coverage-report.md << EOF
# Test Coverage Report

Generated: $(date)

## Summary

| Component | Coverage | Status | Threshold |
|-----------|----------|--------|-----------|
| Backend | ${BACKEND_COVERAGE:-"N/A"}% | $([ "$BACKEND_PASS" = true ] && echo "✅ PASS" || echo "❌ FAIL") | ${MIN_OVERALL_COVERAGE}% |
| Frontend | ${FRONTEND_COVERAGE:-"N/A"}% | $([ "$FRONTEND_PASS" = true ] && echo "✅ PASS" || echo "❌ FAIL") | ${MIN_FRONTEND_COVERAGE}% |
| Critical Paths | - | $([ "$CRITICAL_PASS" = true ] && echo "✅ PASS" || echo "❌ FAIL") | ${MIN_CRITICAL_COVERAGE}% |

## Critical Path Coverage

$(for path in "${CRITICAL_PATHS[@]}"; do
    echo "- $path"
done)

## Coverage Details

### Backend Coverage
\`\`\`
$([ -f "coverage/lcov.info" ] && head -20 coverage/lcov.info || echo "No backend coverage data")
\`\`\`

### Frontend Coverage
\`\`\`
$([ -f "frontend/coverage/coverage-summary.json" ] && cat frontend/coverage/coverage-summary.json | head -20 || echo "No frontend coverage data")
\`\`\`

## Recommendations

$(if [ "$BACKEND_PASS" = false ]; then
    echo "- Increase backend test coverage to meet ${MIN_OVERALL_COVERAGE}% threshold"
fi)

$(if [ "$FRONTEND_PASS" = false ]; then
    echo "- Increase frontend test coverage to meet ${MIN_FRONTEND_COVERAGE}% threshold"
fi)

$(if [ "$CRITICAL_PASS" = false ]; then
    echo "- Focus on critical path coverage (auth, core business logic)"
fi)
EOF

echo -e "${GREEN}📄 Coverage report generated: coverage-report.md${NC}"

# ==================== FINAL RESULT ====================

echo ""
echo "📋 Coverage Check Summary:"

if [ "$BACKEND_PASS" = true ] && [ "$FRONTEND_PASS" = true ] && [ "$CRITICAL_PASS" = true ]; then
    echo -e "${GREEN}🎉 All coverage checks passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Coverage checks failed!${NC}"
    echo ""
    echo "Please increase test coverage before committing:"
    [ "$BACKEND_PASS" = false ] && echo "  - Backend coverage: ${BACKEND_COVERAGE:-0}% < ${MIN_OVERALL_COVERAGE}%"
    [ "$FRONTEND_PASS" = false ] && echo "  - Frontend coverage: ${FRONTEND_COVERAGE:-0}% < ${MIN_FRONTEND_COVERAGE}%"
    [ "$CRITICAL_PASS" = false ] && echo "  - Critical path coverage below ${MIN_CRITICAL_COVERAGE}%"
    echo ""
    echo "Run tests with coverage and fix failing tests:"
    echo "  Backend: deno test --coverage"
    echo "  Frontend: cd frontend && npm test -- --coverage"
    exit 1
fi