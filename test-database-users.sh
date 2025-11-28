#!/bin/bash

# Test script to verify database users exist and have correct types
# This validates that our Better Auth implementation can find real users

echo "🗄️ Testing Database User Validation"
echo "=================================="

DATABASE_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${YELLOW}Checking for demo users in database:${NC}"

# Check if demo users exist in database
echo "Querying users table..."

PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech -U neondb_owner -d neondb << 'EOF'
\echo '=== DEMO USERS CHECK ==='
SELECT 
    id, 
    email, 
    user_type, 
    first_name, 
    last_name,
    created_at
FROM users 
WHERE email IN (
    'alex.creator@demo.com',
    'sarah.investor@demo.com', 
    'stellar.production@demo.com'
)
ORDER BY email;

\echo ''
\echo '=== TOTAL USER COUNT BY TYPE ==='
SELECT 
    user_type,
    COUNT(*) as count
FROM users 
GROUP BY user_type
ORDER BY user_type;

\echo ''
\echo '=== PASSWORD HASHES CHECK ==='
SELECT 
    email,
    CASE 
        WHEN password_hash IS NOT NULL AND LENGTH(password_hash) > 10 
        THEN '✅ Hashed'
        ELSE '❌ Missing/Invalid'
    END as password_status
FROM users 
WHERE email IN (
    'alex.creator@demo.com',
    'sarah.investor@demo.com', 
    'stellar.production@demo.com'
);

\echo ''
\echo '=== BETTER AUTH TABLES CHECK ==='
\dt sessions
\dt accounts
\dt verification_tokens

EOF

echo -e "\n${YELLOW}Database validation complete.${NC}"
echo "If demo users are missing, run the seed script first:"
echo "  ./seed-via-api.sh"