#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "=== Testing R2 Integration on All Portals ==="

# Test 1: Creator Portal Upload
echo -e "\n1. Testing Creator Portal - Document Upload to R2..."
CREATOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }' \
  -c creator_cookies.txt)

CREATOR_TOKEN=$(echo "$CREATOR_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Creator token: ${CREATOR_TOKEN:0:30}..."

# Create test file
echo "Test document content" > test-doc.txt

# Upload to R2
echo "Uploading document to R2..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload/document" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@test-doc.txt;type=text/plain" \
  -F "category=pitch-deck" \
  -b creator_cookies.txt)

echo "Upload response: $UPLOAD_RESPONSE" | head -200

# Test 2: Investor Portal Access
echo -e "\n2. Testing Investor Portal - Access to R2 Documents..."
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }' \
  -c investor_cookies.txt)

INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Investor token: ${INVESTOR_TOKEN:0:30}..."

# Test accessing documents (would need pitch ID)
echo "Testing document access..."

# Test 3: Production Portal
echo -e "\n3. Testing Production Portal - Access to R2 Submissions..."
PRODUCTION_LOGIN=$(curl -s -X POST "$API_URL/api/auth/production/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }' \
  -c production_cookies.txt)

PRODUCTION_TOKEN=$(echo "$PRODUCTION_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Production token: ${PRODUCTION_TOKEN:0:30}..."

# Test 4: Check R2 storage endpoints
echo -e "\n4. Checking R2 Storage Configuration..."
echo "Testing R2 presigned URL generation..."
PRESIGNED_TEST=$(curl -s -X POST "$API_URL/api/upload/r2/presigned" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-r2.pdf",
    "contentType": "application/pdf",
    "operation": "putObject"
  }' \
  -b creator_cookies.txt)

echo "R2 Presigned URL response: $PRESIGNED_TEST"

# Cleanup
rm -f test-doc.txt creator_cookies.txt investor_cookies.txt production_cookies.txt

echo -e "\n=== R2 Integration Test Complete ==="
