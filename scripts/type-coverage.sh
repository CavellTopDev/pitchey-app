#!/bin/bash

# TypeScript Type Coverage Report
# Analyzes TypeScript type coverage and generates comprehensive metrics

set -e

echo "🔍 TypeScript Type Coverage Report"
echo "=================================="

# Navigate to project root
cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install type-coverage if not present
if ! command_exists type-coverage; then
    echo "📦 Installing type-coverage tool..."
    npm install -g type-coverage
fi

echo "📊 Analyzing Frontend Type Coverage..."
echo "------------------------------------"

# Frontend type coverage
cd frontend
if [ -f "package.json" ]; then
    # Run TypeScript compiler to check for errors
    echo "🔧 Running TypeScript compiler..."
    if npx tsc --noEmit; then
        echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    else
        echo -e "${YELLOW}⚠️  TypeScript compilation has issues${NC}"
    fi
    
    # Generate type coverage report
    echo "📈 Generating type coverage report..."
    
    # Check if type-coverage is available locally
    if [ -f "node_modules/.bin/type-coverage" ]; then
        npx type-coverage --detail --strict
    else
        echo -e "${YELLOW}⚠️  type-coverage not found locally, installing...${NC}"
        npm install --save-dev type-coverage
        npx type-coverage --detail --strict
    fi
    
    echo ""
    echo "📋 TypeScript Configuration Analysis"
    echo "-----------------------------------"
    
    # Check strict mode settings
    if grep -q '"strict": true' tsconfig.json || grep -q '"strict": true' tsconfig.app.json; then
        echo -e "${GREEN}✅ Strict mode enabled${NC}"
    else
        echo -e "${RED}❌ Strict mode not enabled${NC}"
    fi
    
    # Check noImplicitAny
    if grep -q '"noImplicitAny": true' tsconfig.json || grep -q '"noImplicitAny": true' tsconfig.app.json; then
        echo -e "${GREEN}✅ noImplicitAny enabled${NC}"
    else
        echo -e "${YELLOW}⚠️  noImplicitAny not explicitly enabled${NC}"
    fi
    
    # Check other strict flags
    strict_flags=(
        "noImplicitReturns"
        "noImplicitThis"
        "noImplicitOverride"
        "noPropertyAccessFromIndexSignature"
        "noUncheckedIndexedAccess"
        "exactOptionalPropertyTypes"
    )
    
    for flag in "${strict_flags[@]}"; do
        if grep -q "\"$flag\": true" tsconfig.json || grep -q "\"$flag\": true" tsconfig.app.json; then
            echo -e "${GREEN}✅ $flag enabled${NC}"
        else
            echo -e "${YELLOW}⚠️  $flag not enabled${NC}"
        fi
    done
    
else
    echo -e "${RED}❌ Frontend package.json not found${NC}"
fi

cd ..

echo ""
echo "🎯 ESLint TypeScript Analysis"
echo "----------------------------"

cd frontend
if [ -f "eslint.config.js" ]; then
    echo "🔍 Running ESLint with TypeScript rules..."
    if npx eslint src --ext .ts,.tsx --max-warnings 0 2>/dev/null; then
        echo -e "${GREEN}✅ No ESLint TypeScript errors${NC}"
    else
        echo -e "${YELLOW}⚠️  ESLint found TypeScript issues${NC}"
        echo "Running ESLint to show details..."
        npx eslint src --ext .ts,.tsx || true
    fi
else
    echo -e "${YELLOW}⚠️  ESLint config not found${NC}"
fi

cd ..

echo ""
echo "🔍 Backend Type Analysis"
echo "-----------------------"

# Check backend files for any types
backend_any_count=$(find src -name "*.ts" -type f -exec grep -l "any\|any\[\]" {} \; 2>/dev/null | wc -l)
backend_files_count=$(find src -name "*.ts" -type f | wc -l)

if [ "$backend_files_count" -gt 0 ]; then
    backend_any_percentage=$((100 * backend_any_count / backend_files_count))
    echo "📁 Backend TypeScript files: $backend_files_count"
    echo "⚠️  Files with 'any' types: $backend_any_count"
    echo "📊 Files with 'any' percentage: $backend_any_percentage%"
    
    if [ "$backend_any_percentage" -lt 10 ]; then
        echo -e "${GREEN}✅ Low 'any' usage in backend${NC}"
    elif [ "$backend_any_percentage" -lt 25 ]; then
        echo -e "${YELLOW}⚠️  Moderate 'any' usage in backend${NC}"
    else
        echo -e "${RED}❌ High 'any' usage in backend${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No TypeScript files found in backend${NC}"
fi

echo ""
echo "📦 Dependency Type Coverage"
echo "--------------------------"

cd frontend
# Check for @types packages
types_packages=$(npm list --depth=0 2>/dev/null | grep -c "@types/" || echo "0")
echo "📚 @types packages installed: $types_packages"

# Check for packages without types
echo "🔍 Checking for packages that might need @types..."
packages_without_types=()

# Common packages that often need @types
common_packages=("express" "lodash" "moment" "uuid" "cors" "bcryptjs")
for pkg in "${common_packages[@]}"; do
    if npm list --depth=0 2>/dev/null | grep -q " $pkg@" && ! npm list --depth=0 2>/dev/null | grep -q " @types/$pkg@"; then
        packages_without_types+=("@types/$pkg")
    fi
done

if [ ${#packages_without_types[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Consider installing these @types packages:${NC}"
    for pkg in "${packages_without_types[@]}"; do
        echo "   - $pkg"
    done
else
    echo -e "${GREEN}✅ No obvious missing @types packages${NC}"
fi

cd ..

echo ""
echo "📈 Summary & Recommendations"
echo "============================"

# Generate summary based on findings
echo "🎯 Key Metrics:"
if [ "$backend_files_count" -gt 0 ]; then
    echo "   - Backend files analyzed: $backend_files_count"
    echo "   - Backend files with 'any': $backend_any_count ($backend_any_percentage%)"
fi

echo ""
echo "💡 Recommendations:"

if [ "$backend_any_percentage" -gt 15 ]; then
    echo -e "   ${YELLOW}📝 Reduce 'any' usage in backend files${NC}"
    echo "      - Add specific type definitions"
    echo "      - Use Zod schemas for runtime validation"
    echo "      - Create typed database query functions"
fi

echo -e "   ${BLUE}🔧 Enable additional TypeScript strict flags:${NC}"
echo "      - exactOptionalPropertyTypes"
echo "      - noUncheckedIndexedAccess"
echo "      - noPropertyAccessFromIndexSignature"

echo -e "   ${BLUE}📚 Consider additional tooling:${NC}"
echo "      - ts-unused-exports (find unused exports)"
echo "      - tsd (test type definitions)"
echo "      - typescript-json-schema (generate JSON schemas)"

echo ""
echo "🏆 Type Safety Score:"
if [ "$backend_any_percentage" -lt 5 ]; then
    echo -e "   ${GREEN}Excellent (95%+ type coverage)${NC}"
elif [ "$backend_any_percentage" -lt 15 ]; then
    echo -e "   ${YELLOW}Good (85%+ type coverage)${NC}"
else
    echo -e "   ${RED}Needs Improvement (<85% type coverage)${NC}"
fi

echo ""
echo "✨ Type coverage analysis complete!"
echo "🔗 For detailed reports, check:"
echo "   - Frontend: type-coverage output above"
echo "   - Backend: Manual review of 'any' usage"
echo "   - ESLint: TypeScript-specific rules"