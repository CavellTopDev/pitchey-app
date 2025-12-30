#!/bin/bash

FILE="src/lib/better-auth-client.tsx"

# Fix signInProduction
sed -i '106s|api/endpoint|api/auth/production/login|' "$FILE"

# Fix registerCreator  
sed -i '122s|api/endpoint|api/auth/creator/register|' "$FILE"

# Fix registerInvestor
sed -i '138s|api/endpoint|api/auth/investor/register|' "$FILE"

# Fix registerProduction
sed -i '154s|api/endpoint|api/auth/production/register|' "$FILE"

# Fix getSession
sed -i '170s|api/endpoint|api/auth/session|' "$FILE"

# Fix signOut
sed -i '184s|api/endpoint|api/auth/sign-out|' "$FILE"

# Now fix all the broken body and credentials lines
# Find lines with just "credentials:" and fix them
sed -i '/^\s*credentials:$/d' "$FILE"

# Fix lines with empty JSON.stringify
sed -i 's/body: JSON.stringify({}),$/body: JSON.stringify({ email, password }),/' "$FILE"
sed -i 's/body: JSON.stringify({})$/body: JSON.stringify({ email, username, password })/' "$FILE"

echo "Fixed all method endpoints"
