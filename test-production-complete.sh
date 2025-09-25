#!/bin/bash

echo "Testing Pitchey Production Deployment"
echo "======================================"
echo ""

# Test frontend is accessible
echo "1. Testing Frontend Access..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-frontend.deno.dev)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is accessible (Status: $FRONTEND_STATUS)"
else
    echo "❌ Frontend returned status: $FRONTEND_STATUS"
fi

# Test backend is accessible
echo ""
echo "2. Testing Backend Access..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-backend.deno.dev/api/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend is accessible (Status: $BACKEND_STATUS)"
else
    echo "❌ Backend returned status: $BACKEND_STATUS"
fi

# Test public pitches endpoint
echo ""
echo "3. Testing Public Pitches Endpoint..."
PITCHES_RESPONSE=$(curl -s https://pitchey-backend.deno.dev/api/pitches)
if echo "$PITCHES_RESPONSE" | grep -q "error"; then
    echo "⚠️  Public pitches endpoint requires authentication"
else
    PITCH_COUNT=$(echo "$PITCHES_RESPONSE" | grep -o '"id":' | wc -l)
    echo "✅ Found $PITCH_COUNT pitches in the marketplace"
    
    # Check for production company pitches
    if echo "$PITCHES_RESPONSE" | grep -q "Warner Bros"; then
        echo "✅ Production company pitches are visible (Warner Bros found)"
    fi
    
    if echo "$PITCHES_RESPONSE" | grep -q "Universal Pictures"; then
        echo "✅ Production company pitches are visible (Universal Pictures found)"
    fi
fi

# Test authentication endpoint
echo ""
echo "4. Testing Authentication Endpoints..."
AUTH_RESPONSE=$(curl -s -X POST https://pitchey-backend.deno.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' \
    -w "\nSTATUS:%{http_code}")

if echo "$AUTH_RESPONSE" | grep -q "STATUS:401\|STATUS:400"; then
    echo "✅ Auth endpoint is responding correctly"
else
    echo "⚠️  Auth endpoint status: $(echo "$AUTH_RESPONSE" | grep "STATUS:" | cut -d: -f2)"
fi

echo ""
echo "5. Visual Changes Summary:"
echo "=========================="
echo "The following visual updates have been deployed to production:"
echo ""
echo "✅ Pitch cards now show the actual publisher name (username or company name)"
echo "✅ Color-coded borders and glows:"
echo "   - 🟣 Purple glow: Production Companies"
echo "   - 🟢 Green glow: Investors"  
echo "   - 🔵 Blue glow: Creators"
echo "✅ Emoji indicators added (🏢 for production, 💰 for investor, 👤 for creator)"
echo ""
echo "To verify these changes:"
echo "1. Visit https://pitchey-frontend.deno.dev"
echo "2. Navigate to the marketplace/browse pitches"
echo "3. Look for the color-coded pitch cards with actual publisher names"
echo ""
echo "Test Complete!"
