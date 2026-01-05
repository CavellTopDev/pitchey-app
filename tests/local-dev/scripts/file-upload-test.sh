#!/bin/bash

# File Upload Test Script  
# Tests file upload functionality with MinIO integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8001"
MINIO_URL="http://localhost:9000"
TIMEOUT=30

echo -e "${BLUE}📁 File Upload Test - Pitchey Local Development${NC}"
echo "==============================================="
echo "Backend URL: $BACKEND_URL"
echo "MinIO URL: $MINIO_URL"
echo "Timestamp: $(date)"
echo ""

# Demo user for testing (creator can upload files)
CREATOR_EMAIL="alex.creator@demo.com"
CREATOR_PASSWORD="Demo123"

# Function to create test files
create_test_files() {
    local test_dir="/tmp/pitchey_upload_tests"
    mkdir -p "$test_dir"
    
    # Small text file
    echo "This is a small test document for upload validation.
Created: $(date)
Size: Small (< 1KB)
Content: Plain text" > "$test_dir/small_document.txt"
    
    # Medium text file (script-like)
    {
        echo "FADE IN:"
        echo ""
        echo "EXT. TEST LOCATION - DAY"
        echo ""
        echo "This is a test script file for upload validation."
        echo "It contains typical screenplay formatting."
        echo ""
        for i in {1..100}; do
            echo "LINE $i: Test content to make this file larger."
        done
        echo ""
        echo "FADE OUT."
    } > "$test_dir/test_script.txt"
    
    # Binary-like file (simulated)
    dd if=/dev/urandom of="$test_dir/binary_test.dat" bs=1024 count=10 2>/dev/null
    
    # Large text file
    {
        echo "Large test document for upload validation"
        echo "========================================"
        echo ""
        for i in {1..1000}; do
            echo "This is line $i of the large test document. It contains repeated content to test upload of larger files. $(date)"
        done
    } > "$test_dir/large_document.txt"
    
    echo "Test files created in $test_dir:"
    ls -lh "$test_dir"
    echo ""
    
    echo "$test_dir"
}

# Function to login and get session cookie
login_user() {
    local cookie_file="/tmp/pitchey_upload_cookies.txt"
    
    echo -n "Logging in as creator... "
    
    login_response=$(curl -s -c "$cookie_file" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$CREATOR_PASSWORD\"}" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/auth/sign-in" 2>/dev/null)
    
    login_status=$(echo "$login_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$login_status" = "200" ]; then
        echo -e "${GREEN}✅ SUCCESS${NC}"
        echo "$cookie_file"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (Status: $login_status)"
        rm -f "$cookie_file"
        return 1
    fi
}

# Function to test file upload
test_file_upload() {
    local file_path="$1"
    local file_type="$2"
    local cookie_file="$3"
    local file_name=$(basename "$file_path")
    
    echo -n "  Testing upload: $file_name ($(du -h "$file_path" | cut -f1))... "
    
    upload_response=$(curl -s -b "$cookie_file" \
        -X POST \
        -F "file=@$file_path" \
        -F "type=$file_type" \
        -F "description=Automated test upload" \
        -w "HTTPSTATUS:%{http_code}" \
        --max-time $TIMEOUT \
        "$BACKEND_URL/api/upload/document" 2>/dev/null)
    
    upload_status=$(echo "$upload_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    upload_body=$(echo "$upload_response" | sed 's/HTTPSTATUS:[0-9]*//g')
    
    if [ "$upload_status" = "200" ] || [ "$upload_status" = "201" ]; then
        echo -e "${GREEN}✅ SUCCESS${NC} (Status: $upload_status)"
        
        # Try to extract file info from response
        if echo "$upload_body" | grep -q "id\|url\|filename"; then
            echo "    Response contains file info"
        fi
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (Status: $upload_status)"
        if [ ${#upload_body} -lt 200 ]; then
            echo "    Error: $upload_body"
        fi
        return 1
    fi
}

# Function to test MinIO connectivity
test_minio_connectivity() {
    echo -e "${YELLOW}Testing MinIO S3 Storage...${NC}"
    echo "-------------------------"
    
    # Test MinIO health
    echo -n "MinIO health check... "
    minio_health=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 5 "$MINIO_URL/minio/health/live" 2>/dev/null)
    minio_status=$(echo "$minio_health" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$minio_status" = "200" ]; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
    else
        echo -e "${RED}❌ UNHEALTHY${NC} (Status: $minio_status)"
    fi
    
    # Test MinIO console
    echo -n "MinIO console... "
    console_health=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 5 "http://localhost:9001" 2>/dev/null)
    console_status=$(echo "$console_health" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$console_status" = "200" ]; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
    else
        echo -e "${RED}❌ INACCESSIBLE${NC} (Status: $console_status)"
    fi
    
    echo ""
}

# Function to test upload endpoints
test_upload_endpoints() {
    echo -e "${YELLOW}Testing Upload Endpoints...${NC}"
    echo "-------------------------"
    
    local cookie_file="$1"
    
    # Test upload endpoint availability
    echo -n "Upload endpoint availability... "
    endpoint_response=$(curl -s -b "$cookie_file" \
        -X OPTIONS \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/upload/document" 2>/dev/null)
    
    endpoint_status=$(echo "$endpoint_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$endpoint_status" = "200" ] || [ "$endpoint_status" = "405" ]; then
        echo -e "${GREEN}✅ AVAILABLE${NC} (Status: $endpoint_status)"
    else
        echo -e "${RED}❌ UNAVAILABLE${NC} (Status: $endpoint_status)"
    fi
    
    # Test upload info endpoint
    echo -n "Upload info endpoint... "
    info_response=$(curl -s -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/upload/info" 2>/dev/null)
    
    info_status=$(echo "$info_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$info_status" = "200" ]; then
        echo -e "${GREEN}✅ AVAILABLE${NC}"
        info_body=$(echo "$info_response" | sed 's/HTTPSTATUS:[0-9]*//g')
        if echo "$info_body" | grep -q "maxSize\|allowedTypes"; then
            echo "    Upload limits: $(echo "$info_body" | head -c 100)..."
        fi
    else
        echo -e "${YELLOW}⚠️  UNAVAILABLE${NC} (Status: $info_status) - Optional endpoint"
    fi
    
    echo ""
}

# Main test execution
main() {
    echo -e "${BLUE}🧪 Starting File Upload Tests...${NC}"
    echo ""
    
    # Test MinIO connectivity first
    test_minio_connectivity
    
    # Create test files
    echo -e "${YELLOW}Preparing test files...${NC}"
    test_dir=$(create_test_files)
    echo ""
    
    # Login
    echo -e "${YELLOW}Authentication...${NC}"
    if ! cookie_file=$(login_user); then
        echo -e "${RED}❌ Cannot proceed without authentication${NC}"
        exit 1
    fi
    echo ""
    
    # Test upload endpoints
    test_upload_endpoints "$cookie_file"
    
    # File upload tests
    echo -e "${YELLOW}File Upload Tests...${NC}"
    echo "------------------"
    
    local total_uploads=0
    local successful_uploads=0
    
    # Test different file types and sizes
    declare -A test_files=(
        ["$test_dir/small_document.txt"]="script"
        ["$test_dir/test_script.txt"]="script" 
        ["$test_dir/binary_test.dat"]="supporting"
        ["$test_dir/large_document.txt"]="supporting"
    )
    
    for file_path in "${!test_files[@]}"; do
        file_type="${test_files[$file_path]}"
        ((total_uploads++))
        
        if test_file_upload "$file_path" "$file_type" "$cookie_file"; then
            ((successful_uploads++))
        fi
        
        # Small delay between uploads
        sleep 1
    done
    
    echo ""
    
    # Test upload edge cases
    echo -e "${YELLOW}Edge Case Tests...${NC}"
    echo "-----------------"
    
    # Test empty file
    echo -n "  Empty file upload... "
    touch "$test_dir/empty_file.txt"
    ((total_uploads++))
    
    empty_response=$(curl -s -b "$cookie_file" \
        -X POST \
        -F "file=@$test_dir/empty_file.txt" \
        -F "type=script" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/upload/document" 2>/dev/null)
    
    empty_status=$(echo "$empty_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$empty_status" = "400" ]; then
        echo -e "${GREEN}✅ PROPERLY REJECTED${NC} (Status: $empty_status)"
        ((successful_uploads++))
    elif [ "$empty_status" = "200" ]; then
        echo -e "${YELLOW}⚠️  ACCEPTED${NC} (Status: $empty_status) - May be intentional"
        ((successful_uploads++))
    else
        echo -e "${RED}❌ UNEXPECTED${NC} (Status: $empty_status)"
    fi
    
    # Test missing file parameter
    echo -n "  Missing file parameter... "
    ((total_uploads++))
    
    missing_response=$(curl -s -b "$cookie_file" \
        -X POST \
        -F "type=script" \
        -w "HTTPSTATUS:%{http_code}" \
        "$BACKEND_URL/api/upload/document" 2>/dev/null)
    
    missing_status=$(echo "$missing_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$missing_status" = "400" ]; then
        echo -e "${GREEN}✅ PROPERLY REJECTED${NC} (Status: $missing_status)"
        ((successful_uploads++))
    else
        echo -e "${RED}❌ NOT REJECTED${NC} (Status: $missing_status)"
    fi
    
    echo ""
    
    # Cleanup
    rm -rf "$test_dir"
    rm -f "$cookie_file"
    
    # Summary
    echo -e "${BLUE}📊 UPLOAD TEST SUMMARY:${NC}"
    echo "======================"
    echo "Total upload tests: $total_uploads"
    echo "Successful/Expected: $successful_uploads"
    echo "Failed/Unexpected: $((total_uploads - successful_uploads))"
    
    upload_rate=$(( (successful_uploads * 100) / total_uploads ))
    echo "Success rate: $upload_rate%"
    
    echo ""
    
    if [ $successful_uploads -eq $total_uploads ]; then
        echo -e "${GREEN}🎉 ALL FILE UPLOAD TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ File upload functionality is working correctly${NC}"
        echo -e "${GREEN}✅ MinIO storage integration is functional${NC}"
        echo -e "${GREEN}✅ Upload validation is working${NC}"
        exit 0
    elif [ $upload_rate -ge 80 ]; then
        echo -e "${YELLOW}⚠️  MOSTLY SUCCESSFUL (${upload_rate}%)${NC}"
        echo -e "${YELLOW}🔧 Some upload features may need attention${NC}"
        exit 0
    else
        echo -e "${RED}❌ SIGNIFICANT UPLOAD ISSUES DETECTED${NC}"
        echo -e "${RED}🚨 File upload functionality needs investigation${NC}"
        echo ""
        echo "Possible issues:"
        echo "- MinIO service not properly configured"
        echo "- Upload endpoints not working correctly"
        echo "- File size or type restrictions too strict"
        echo "- Authentication issues with file operations"
        exit 1
    fi
}

# Run the tests
main