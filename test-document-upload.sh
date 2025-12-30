#!/bin/bash

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

echo "=== Testing Document Upload with Fixed CORS ==="

# 1. Login as creator
echo -e "\n1. Logging in as creator..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }' \
  -c cookies.txt)

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Creator token: ${TOKEN:0:30}..."

# 2. Create a test PDF file
echo -e "\n2. Creating test PDF..."
echo "%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
/Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test NDA Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000293 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
381
%%EOF" > test-nda.pdf

# 3. Test upload endpoint with FormData (CORS-compliant)
echo -e "\n3. Testing upload with FormData (CORS-compliant)..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload/nda" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-nda.pdf;type=application/pdf" \
  -F "metadata_documentCategory=nda" \
  -F "metadata_isCustomNDA=true" \
  -b cookies.txt)

echo "Upload response: $UPLOAD_RESPONSE"

# 4. Test general document upload
echo -e "\n4. Testing general document upload..."
GENERAL_UPLOAD=$(curl -s -X POST "$API_URL/api/upload/document" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-nda.pdf;type=application/pdf" \
  -F "category=pitch-deck" \
  -b cookies.txt)

echo "General upload response: $GENERAL_UPLOAD"

# 5. Check if R2 presigned URL works
echo -e "\n5. Testing R2 presigned URL generation..."
PRESIGNED_RESPONSE=$(curl -s -X POST "$API_URL/api/upload/presigned" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-document.pdf",
    "contentType": "application/pdf",
    "category": "nda"
  }' \
  -b cookies.txt)

echo "Presigned URL response: $PRESIGNED_RESPONSE"

# Clean up
rm -f test-nda.pdf cookies.txt

echo -e "\n=== Document Upload Test Complete ==="
