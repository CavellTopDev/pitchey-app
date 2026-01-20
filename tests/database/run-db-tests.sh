#!/bin/bash

###########################################
# Database Consistency Test Runner
#
# Runs comprehensive database consistency tests
# against Neon PostgreSQL database
###########################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Pitchey Database Consistency Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}WARNING: DATABASE_URL not set, using default from .env${NC}"
    if [ -f "$PROJECT_ROOT/.env" ]; then
        export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
        echo -e "${GREEN}Loaded environment from .env${NC}"
    else
        echo -e "${RED}ERROR: No .env file found${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}Database: ${DATABASE_URL%%@*}@...${NC}"
echo ""

# Function to run test suite
run_test_suite() {
    local test_file=$1
    local test_name=$2

    echo -e "${BLUE}Running: ${test_name}${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"

    if bun test "$test_file"; then
        echo -e "${GREEN}✓ ${test_name} PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name} FAILED${NC}"
        return 1
    fi
    echo ""
}

# Track test results
FAILED_TESTS=()

# Run test suites
echo -e "${BLUE}1. Comprehensive Consistency Tests${NC}"
if ! run_test_suite "$TEST_DIR/db-consistency.test.ts" "DB Consistency"; then
    FAILED_TESTS+=("DB Consistency")
fi

echo ""
echo -e "${BLUE}2. Referential Integrity Tests${NC}"
if ! run_test_suite "$TEST_DIR/referential-integrity.test.ts" "Referential Integrity"; then
    FAILED_TESTS+=("Referential Integrity")
fi

echo ""
echo -e "${BLUE}3. Data Quality Tests${NC}"
if ! run_test_suite "$TEST_DIR/data-quality.test.ts" "Data Quality"; then
    FAILED_TESTS+=("Data Quality")
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"

# Print summary
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All test suites PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ ${#FAILED_TESTS[@]} test suite(s) FAILED:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  - $test${NC}"
    done
    echo ""
    exit 1
fi
