#!/bin/bash

echo "🔍 Verifying Deno Deploy Connection"
echo "===================================="
echo ""
echo "Frontend: https://pitchey-frontend.deno.dev"
echo "Backend: https://pitchey-backend-fresh.deno.dev"
echo ""

# Test backend health
echo "1️⃣ Testing Backend Health..."
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-backend-fresh.deno.dev/api/health)
if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo "✅ Backend is responding (HTTP $BACKEND_RESPONSE)"
else
    echo "❌ Backend not responding properly (HTTP $BACKEND_RESPONSE)"
fi

# Test CORS from frontend domain
echo ""
echo "2️⃣ Testing CORS Configuration..."
CORS_TEST=$(curl -s -I -X OPTIONS \
    -H "Origin: https://pitchey-frontend.deno.dev" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    https://pitchey-backend-fresh.deno.dev/api/auth/login 2>/dev/null | grep -i "access-control-allow-origin")

if [ ! -z "$CORS_TEST" ]; then
    echo "✅ CORS headers present: $CORS_TEST"
else
    echo "⚠️  CORS headers might not be configured"
fi

# Test login with demo account
echo ""
echo "3️⃣ Testing Authentication with Demo Account..."
LOGIN_RESPONSE=$(curl -s -X POST https://pitchey-backend-fresh.deno.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Origin: https://pitchey-frontend.deno.dev" \
    -d '{
        "email": "alex.creator@demo.com",
        "password": "Demo123",
        "userType": "creator"
    }')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "✅ Login successful - API connection working!"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "   Token received: ${TOKEN:0:20}..."
else
    echo "❌ Login failed or connection issue"
    echo "   Response: $LOGIN_RESPONSE"
fi

# Test fetching pitches (public endpoint)
echo ""
echo "4️⃣ Testing Public API Endpoints..."
PITCHES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-backend-fresh.deno.dev/api/pitches)
if [ "$PITCHES_RESPONSE" = "200" ]; then
    echo "✅ Public pitches endpoint working (HTTP $PITCHES_RESPONSE)"
else
    echo "❌ Public pitches endpoint issue (HTTP $PITCHES_RESPONSE)"
fi

# Check if frontend is loading the correct API URL
echo ""
echo "5️⃣ Checking Frontend Configuration..."
FRONTEND_HTML=$(curl -s https://pitchey-frontend.deno.dev/)
if echo "$FRONTEND_HTML" | grep -q "pitchey-backend-fresh.deno.dev"; then
    echo "✅ Frontend bundle contains correct backend URL"
else
    echo "⚠️  Frontend might not have the correct backend URL in bundle"
    echo "   Checking for any backend references..."
    if echo "$FRONTEND_HTML" | grep -q "localhost:8001"; then
        echo "❌ Frontend still references localhost backend!"
    fi
fi

echo ""
echo "📊 Summary:"
echo "==========="
echo "• Backend Status: $([[ "$BACKEND_RESPONSE" == "200" ]] && echo "✅ Online" || echo "❌ Issues")"
echo "• CORS Config: $([[ ! -z "$CORS_TEST" ]] && echo "✅ Configured" || echo "⚠️ Check needed")"
echo "• Authentication: $(echo "$LOGIN_RESPONSE" | grep -q "token" && echo "✅ Working" || echo "❌ Not working")"
echo "• Public APIs: $([[ "$PITCHES_RESPONSE" == "200" ]] && echo "✅ Working" || echo "❌ Issues")"
echo ""
echo "🔗 Live URLs:"
echo "• Frontend: https://pitchey-frontend.deno.dev"
echo "• Backend: https://pitchey-backend-fresh.deno.dev"
echo ""
echo "📝 Demo Accounts:"
echo "• Creator: alex.creator@demo.com / Demo123"
echo "• Investor: sarah.investor@demo.com / Demo123"
echo "• Production: stellar.production@demo.com / Demo123"