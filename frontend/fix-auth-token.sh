#!/bin/bash

echo "Fixing authentication token references across all services..."

# Fix all instances of auth_token to authToken
find src/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i "s/auth_token/authToken/g" {} \;

echo "✅ Fixed auth_token -> authToken"

# Show results
echo "Verifying changes..."
echo "Files still containing 'auth_token':"
grep -r "auth_token" src/ --include="*.ts" --include="*.tsx" --include="*.js" | wc -l

echo "Files containing 'authToken':"
grep -r "authToken" src/ --include="*.ts" --include="*.tsx" --include="*.js" | wc -l

echo "Fix complete!"