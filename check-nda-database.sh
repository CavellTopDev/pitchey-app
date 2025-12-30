#!/bin/bash

echo "🔍 Checking NDA database directly"
echo "================================"

# Use psql to check the database
PGPASSWORD="npg_YibeIGRuv40J" psql \
  -h ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner \
  -d neondb \
  -c "SELECT id, signer_id, pitch_id, status, created_at FROM ndas WHERE signer_id IN (SELECT id FROM users WHERE email = 'sarah.investor@demo.com') ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "Checking user ID:"
PGPASSWORD="npg_YibeIGRuv40J" psql \
  -h ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner \
  -d neondb \
  -c "SELECT id, email, user_type FROM users WHERE email = 'sarah.investor@demo.com';"
