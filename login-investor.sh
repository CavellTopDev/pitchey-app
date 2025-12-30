#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Logging into Investor Portal...${NC}"

# Get login token
LOGIN_RESPONSE=$(curl -s -X POST "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
USER_DATA=$(echo "$LOGIN_RESPONSE" | jq -c '.user')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    
    # Create a temporary HTML file that sets localStorage and redirects
    cat > /tmp/pitchey-login.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Logging into Pitchey...</title>
</head>
<body>
    <h2>Setting up authentication...</h2>
    <script>
        // Set authentication data
        localStorage.setItem('authToken', '$TOKEN');
        localStorage.setItem('user', '$USER_DATA');
        localStorage.setItem('userType', 'investor');
        
        // Also set auth-storage format
        const authStorage = {
            state: {
                user: $USER_DATA,
                isAuthenticated: true,
                loading: false,
                error: null
            },
            version: 0
        };
        localStorage.setItem('auth-storage', JSON.stringify(authStorage));
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'https://pitchey-5o8.pages.dev/investor/dashboard';
        }, 1000);
    </script>
    <p>Redirecting to investor dashboard...</p>
</body>
</html>
EOF

    echo -e "${BLUE}Opening browser with authentication...${NC}"
    
    # Open the browser with the login page
    if command -v xdg-open > /dev/null; then
        xdg-open "file:///tmp/pitchey-login.html"
    elif command -v open > /dev/null; then
        open "file:///tmp/pitchey-login.html"
    else
        echo "Please open this file in your browser: file:///tmp/pitchey-login.html"
    fi
    
    echo -e "${GREEN}✅ Browser opened. You will be redirected to the investor dashboard.${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "$LOGIN_RESPONSE"
fi