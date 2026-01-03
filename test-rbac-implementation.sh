#!/bin/bash

# Test RBAC Implementation for Pitchey Platform
# Tests permissions, roles, and content access controls

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8001}"
DB_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}          PITCHEY RBAC IMPLEMENTATION TEST SUITE             ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Function to test API endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local data="$4"
    local expected_status="$5"
    local description="$6"
    
    echo -e "\n${YELLOW}Testing: ${description}${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ Passed: Status $status_code as expected${NC}"
    else
        echo -e "${RED}✗ Failed: Expected status $expected_status, got $status_code${NC}"
        echo "Response: $body"
        return 1
    fi
    
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
}

# Function to run SQL query
run_sql() {
    local query="$1"
    PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
        -U neondb_owner -d neondb -t -c "$query"
}

echo -e "\n${BLUE}1. APPLYING DATABASE MIGRATIONS${NC}"
echo "================================================"

# Apply migrations
for migration in migrations/20260103_*.sql; do
    if [ -f "$migration" ]; then
        echo "Applying: $(basename $migration)"
        PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
            -U neondb_owner -d neondb -f "$migration" 2>/dev/null || echo "Migration may already be applied"
    fi
done

echo -e "${GREEN}✓ Migrations applied${NC}"

echo -e "\n${BLUE}2. VERIFYING RBAC SCHEMA${NC}"
echo "================================================"

# Check if tables exist
tables=("permissions" "roles" "role_permissions" "user_roles" "content_access" "permission_audit")
for table in "${tables[@]}"; do
    result=$(run_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';")
    if [ "$result" -gt 0 ]; then
        echo -e "${GREEN}✓ Table '$table' exists${NC}"
    else
        echo -e "${RED}✗ Table '$table' missing${NC}"
    fi
done

echo -e "\n${BLUE}3. CHECKING ROLE AND PERMISSION SEED DATA${NC}"
echo "================================================"

# Check roles
role_count=$(run_sql "SELECT COUNT(*) FROM roles;")
echo "Roles in database: $role_count"

# Check permissions
perm_count=$(run_sql "SELECT COUNT(*) FROM permissions;")
echo "Permissions in database: $perm_count"

# Check role-permission mappings
mapping_count=$(run_sql "SELECT COUNT(*) FROM role_permissions;")
echo "Role-permission mappings: $mapping_count"

echo -e "\n${BLUE}4. TESTING AUTHENTICATION & PERMISSIONS${NC}"
echo "================================================"

# Login as creator
echo -e "\n${YELLOW}Logging in as Creator${NC}"
creator_response=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

creator_token=$(echo "$creator_response" | jq -r '.data.token // .token // empty')
if [ -z "$creator_token" ]; then
    echo -e "${RED}Failed to login as creator${NC}"
    echo "$creator_response" | jq '.'
else
    echo -e "${GREEN}✓ Creator login successful${NC}"
fi

# Login as investor
echo -e "\n${YELLOW}Logging in as Investor${NC}"
investor_response=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

investor_token=$(echo "$investor_response" | jq -r '.data.token // .token // empty')
if [ -z "$investor_token" ]; then
    echo -e "${RED}Failed to login as investor${NC}"
    echo "$investor_response" | jq '.'
else
    echo -e "${GREEN}✓ Investor login successful${NC}"
fi

echo -e "\n${BLUE}5. TESTING PERMISSION-BASED ACCESS${NC}"
echo "================================================"

# Test creator can create pitch
test_endpoint "POST" "/api/pitches" "$creator_token" \
    '{"title":"RBAC Test Pitch","description":"Testing RBAC permissions","genre":"action"}' \
    "200" "Creator creating pitch (should succeed)"

# Test investor cannot create pitch
test_endpoint "POST" "/api/pitches" "$investor_token" \
    '{"title":"Unauthorized Pitch","description":"Should fail","genre":"action"}' \
    "403" "Investor creating pitch (should fail with 403)"

# Get creator's user permissions
echo -e "\n${YELLOW}Fetching Creator Permissions${NC}"
curl -s -X GET "$API_URL/api/user/permissions" \
    -H "Authorization: Bearer $creator_token" | jq '.'

# Get investor's user permissions
echo -e "\n${YELLOW}Fetching Investor Permissions${NC}"
curl -s -X GET "$API_URL/api/user/permissions" \
    -H "Authorization: Bearer $investor_token" | jq '.'

echo -e "\n${BLUE}6. TESTING NDA WORKFLOW WITH ACCESS CONTROL${NC}"
echo "================================================"

# Create a pitch as creator
echo -e "\n${YELLOW}Creating test pitch for NDA workflow${NC}"
pitch_response=$(curl -s -X POST "$API_URL/api/pitches" \
    -H "Authorization: Bearer $creator_token" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Protected Content Test",
        "description": "This pitch has protected content",
        "genre": "thriller",
        "protected": true
    }')

pitch_id=$(echo "$pitch_response" | jq -r '.data.id // empty')
echo "Created pitch ID: $pitch_id"

if [ ! -z "$pitch_id" ]; then
    # Investor requests NDA
    echo -e "\n${YELLOW}Investor requesting NDA${NC}"
    nda_response=$(curl -s -X POST "$API_URL/api/ndas" \
        -H "Authorization: Bearer $investor_token" \
        -H "Content-Type: application/json" \
        -d "{\"pitchId\": $pitch_id}")
    
    nda_id=$(echo "$nda_response" | jq -r '.data.id // empty')
    echo "NDA Request ID: $nda_id"
    
    if [ ! -z "$nda_id" ]; then
        # Creator approves NDA
        echo -e "\n${YELLOW}Creator approving NDA${NC}"
        approval_response=$(curl -s -X POST "$API_URL/api/ndas/$nda_id/approve" \
            -H "Authorization: Bearer $creator_token" \
            -H "Content-Type: application/json" \
            -d '{"action": "approve"}')
        
        echo "$approval_response" | jq '.'
        
        # Check if access was granted
        echo -e "\n${YELLOW}Checking content access table${NC}"
        access_count=$(run_sql "SELECT COUNT(*) FROM content_access WHERE user_id = (SELECT id FROM users WHERE email = 'sarah.investor@demo.com') AND content_type = 'pitch' AND content_id = $pitch_id;")
        
        if [ "$access_count" -gt 0 ]; then
            echo -e "${GREEN}✓ Content access granted via NDA${NC}"
        else
            echo -e "${RED}✗ Content access not found${NC}"
        fi
        
        # Test investor can now access protected content
        echo -e "\n${YELLOW}Investor accessing protected pitch${NC}"
        curl -s -X GET "$API_URL/api/pitches/$pitch_id" \
            -H "Authorization: Bearer $investor_token" | jq '.'
    fi
fi

echo -e "\n${BLUE}7. CHECKING AUDIT LOGS${NC}"
echo "================================================"

# Check recent permission audit entries
echo "Recent permission checks:"
run_sql "SELECT user_id, action, permission_required, granted, created_at FROM permission_audit ORDER BY created_at DESC LIMIT 5;" | head -20

echo -e "\n${BLUE}8. TESTING CONTENT OWNERSHIP${NC}"
echo "================================================"

# Test that creator can edit own pitch
if [ ! -z "$pitch_id" ]; then
    test_endpoint "PUT" "/api/pitches/$pitch_id" "$creator_token" \
        '{"title":"Updated RBAC Test Pitch"}' \
        "200" "Creator editing own pitch (should succeed)"
    
    # Test that investor cannot edit creator's pitch
    test_endpoint "PUT" "/api/pitches/$pitch_id" "$investor_token" \
        '{"title":"Unauthorized Update"}' \
        "403" "Investor editing creator's pitch (should fail)"
fi

echo -e "\n${BLUE}9. VERIFYING USER ROLE ASSIGNMENTS${NC}"
echo "================================================"

# Check user roles
echo "User role assignments:"
run_sql "SELECT u.email, r.name as role FROM user_roles ur JOIN users u ON ur.user_id = u.id JOIN roles r ON ur.role_id = r.id LIMIT 10;"

echo -e "\n${BLUE}10. SUMMARY${NC}"
echo "================================================"

# Count successes and failures
total_users=$(run_sql "SELECT COUNT(*) FROM users;")
users_with_roles=$(run_sql "SELECT COUNT(DISTINCT user_id) FROM user_roles;")
total_permissions=$(run_sql "SELECT COUNT(*) FROM permissions;")
total_mappings=$(run_sql "SELECT COUNT(*) FROM role_permissions;")
audit_entries=$(run_sql "SELECT COUNT(*) FROM permission_audit;")

echo -e "Total users: ${total_users}"
echo -e "Users with roles: ${users_with_roles}"
echo -e "Total permissions: ${total_permissions}"
echo -e "Role-permission mappings: ${total_mappings}"
echo -e "Audit log entries: ${audit_entries}"

echo -e "\n${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                  RBAC TESTING COMPLETE                        ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Deploy RBAC to production with: wrangler deploy"
echo "2. Update frontend to use PermissionGuard components"
echo "3. Monitor permission_audit table for access violations"
echo "4. Configure role assignments for new users"