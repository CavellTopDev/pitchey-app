#!/bin/bash

# Script to seed production and investor accounts with pitches via API

API_URL="https://pitchey-backend.deno.dev"

echo "🎬 Seeding Production and Investor Accounts via API"
echo "=================================================="
echo ""

# Function to register and create pitch
register_and_create_pitch() {
  local portal=$1
  local email=$2
  local password=$3
  local data=$4
  local pitch_data=$5
  
  echo "📝 Registering $email as $portal..."
  
  # Register
  REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/${portal}/register" \
    -H "Content-Type: application/json" \
    -d "$data")
  
  if echo "$REGISTER_RESPONSE" | grep -q "success.*true\|token"; then
    echo "✅ Registered successfully"
    
    # Extract token
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ ! -z "$TOKEN" ]; then
      echo "🎯 Creating pitch..."
      
      # Create pitch
      PITCH_RESPONSE=$(curl -s -X POST "${API_URL}/api/pitches" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$pitch_data")
      
      if echo "$PITCH_RESPONSE" | grep -q "success.*true"; then
        echo "✅ Pitch created successfully"
      else
        echo "⚠️  Failed to create pitch: $PITCH_RESPONSE"
      fi
    else
      # Try to login if registration failed (account might exist)
      echo "🔑 Attempting login..."
      LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/${portal}/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
      
      TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      
      if [ ! -z "$TOKEN" ]; then
        echo "✅ Logged in successfully"
        echo "🎯 Creating pitch..."
        
        # Create pitch
        PITCH_RESPONSE=$(curl -s -X POST "${API_URL}/api/pitches" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $TOKEN" \
          -d "$pitch_data")
        
        if echo "$PITCH_RESPONSE" | grep -q "success.*true"; then
          echo "✅ Pitch created successfully"
        else
          echo "⚠️  Failed to create pitch: $PITCH_RESPONSE"
        fi
      else
        echo "❌ Failed to register or login: $REGISTER_RESPONSE / $LOGIN_RESPONSE"
      fi
    fi
  else
    echo "⚠️  Registration response: $REGISTER_RESPONSE"
  fi
  
  echo "------------------------"
  echo ""
}

# Production Company 1
register_and_create_pitch "production" \
  "warner@example.com" \
  "Warner123!" \
  '{
    "email": "warner@example.com",
    "password": "Warner123!",
    "companyName": "Warner Bros. Pictures",
    "contactName": "Sarah Johnson",
    "bio": "Leading Hollywood production company",
    "location": "Los Angeles, CA"
  }' \
  '{
    "title": "The Matrix Resurrections",
    "logline": "Return to a world of two realities",
    "genre": "sci-fi",
    "format": "feature",
    "budget": "$150M+",
    "budgetAmount": 150000000,
    "status": "published",
    "stage": "production",
    "synopsis": "To find out if his reality is a physical or mental construct.",
    "targetAudience": "18-45, sci-fi enthusiasts",
    "comparableTitles": "Inception, Blade Runner 2049",
    "visibility": "public"
  }'

echo "✨ Seeding complete!"
