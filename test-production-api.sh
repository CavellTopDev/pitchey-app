#!/bin/bash

echo "Testing production site API configuration..."
echo "==========================================="

# Test the production site
echo -e "\n1. Checking main production domain (pitchey-5o8.pages.dev):"
curl -s https://pitchey-5o8.pages.dev | grep -o 'pitchey-api[^"]*workers.dev' | head -1 || echo "Could not find API URL in HTML"

# Test the latest deployment
echo -e "\n2. Checking latest deployment (0e08f241.pitchey-5o8.pages.dev):"
curl -s https://0e08f241.pitchey-5o8.pages.dev | grep -o 'pitchey-api[^"]*workers.dev' | head -1 || echo "Could not find API URL in HTML"

# Test if the API endpoints work
echo -e "\n3. Testing API endpoints:"
echo "   OLD API (should fail):"
curl -s -o /dev/null -w "   Status: %{http_code}\n" https://pitchey-api.ndlovucavelle.workers.dev/api/pitches/public/2

echo "   NEW API (should work):"
curl -s -o /dev/null -w "   Status: %{http_code}\n" https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public/2

echo -e "\n4. Testing pitch data from NEW API:"
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/public/2 | jq -r '.data.title' 2>/dev/null || echo "Failed to fetch pitch"

echo -e "\n==========================================="
echo "If pitchey-5o8.pages.dev still shows the old API, you need to:"
echo "1. Go to Cloudflare Dashboard -> Workers & Pages -> pitchey"
echo "2. Go to Settings -> Custom domains"
echo "3. Update pitchey-5o8.pages.dev to point to the latest deployment"
echo "   OR"
echo "4. In Deployments tab, find deployment 0e08f241 and click 'Promote to Production'"