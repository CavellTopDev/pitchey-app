#!/bin/bash

# Fix console.log issues in frontend files

echo "Fixing console.log issues in frontend files..."

# Fix useSentryPortal.ts
sed -i '24,30s/    if (user) {/    if (user) {\n      Sentry.setUser({/' frontend/src/hooks/useSentryPortal.ts
sed -i '31s/    }/      });\n    }/' frontend/src/hooks/useSentryPortal.ts

# Search for other potential issues
echo "Searching for more potential console.log issues..."
grep -n "^\s*[a-zA-Z]*:" frontend/src/**/*.{ts,tsx} 2>/dev/null | grep -v "case\|default\|export\|import\|interface\|type\|enum" | head -20

echo "Done!"