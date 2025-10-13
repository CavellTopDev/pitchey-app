#!/bin/bash

echo "🔧 Fixing Critical Platform Inconsistencies"
echo "==========================================="
echo ""

# 1. Fix User ID Mapping
echo "1. Fixing User ID mappings in working-server.ts..."
sed -i 's/id: 1,  \/\/ Fixed to match actual database/id: 1001,  \/\/ Fixed to match actual database/g' working-server.ts
sed -i 's/id: 2,  \/\/ Fixed to match actual database/id: 1002,  \/\/ Fixed to match actual database/g' working-server.ts
sed -i 's/id: 3,  \/\/ Fixed to match actual database/id: 1003,  \/\/ Fixed to match actual database/g' working-server.ts
echo "✅ User IDs fixed"

# 2. Fix Column Name References
echo ""
echo "2. Fixing column name references..."
sed -i 's/pitches\.creatorId/pitches.userId/g' working-server.ts
sed -i 's/follows\.followingId/follows.creatorId/g' working-server.ts
sed -i 's/users\.name/users.firstName/g' working-server.ts
sed -i 's/pitches\.thumbnailUrl/pitches.posterUrl/g' working-server.ts
echo "✅ Column names fixed"

# 3. Update Test Scripts
echo ""
echo "3. Updating test script user IDs..."
for file in test*.sh; do
  if [ -f "$file" ]; then
    sed -i 's/"userId": 1,/"userId": 1001,/g' "$file"
    sed -i 's/"userId": 2,/"userId": 1002,/g' "$file"
    sed -i 's/"userId": 3,/"userId": 1003,/g' "$file"
    sed -i 's/user_id=1/user_id=1001/g' "$file"
    sed -i 's/user_id=2/user_id=1002/g' "$file"
    sed -i 's/user_id=3/user_id=1003/g' "$file"
  fi
done
echo "✅ Test scripts updated"

# 4. Create missing API endpoint stubs
echo ""
echo "4. Creating endpoint implementation file for missing APIs..."
cat > missing-endpoints-implementation.ts << 'EOF'
// Missing API Endpoints Implementation
// Add these to working-server.ts

// GET /api/portfolio/{userId}
if (url.pathname.startsWith("/api/portfolio/") && method === "GET") {
  const userId = parseInt(url.pathname.split('/').pop() || '0');
  try {
    const portfolio = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        status: pitches.status,
        viewCount: pitches.viewCount
      })
      .from(pitches)
      .where(eq(pitches.userId, userId))
      .orderBy(desc(pitches.createdAt));
    
    return successResponse({ pitches: portfolio });
  } catch (error) {
    return errorResponse("Failed to fetch portfolio");
  }
}

// GET /api/activity/feed
if (url.pathname === "/api/activity/feed" && method === "GET") {
  try {
    // Implementation for activity feed
    const activities = await db
      .select()
      .from(analyticsEvents)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(50);
    
    return successResponse({ activities });
  } catch (error) {
    return errorResponse("Failed to fetch activity feed");
  }
}

// GET /api/conversations
if (url.pathname === "/api/conversations" && method === "GET") {
  try {
    const authResult = await authenticate(request);
    if (!authResult.user) return authErrorResponse();
    
    const userConversations = await db
      .select()
      .from(conversations)
      .innerJoin(conversationParticipants, 
        eq(conversations.id, conversationParticipants.conversationId))
      .where(eq(conversationParticipants.userId, authResult.user.id));
    
    return successResponse({ conversations: userConversations });
  } catch (error) {
    return errorResponse("Failed to fetch conversations");
  }
}
EOF
echo "✅ Missing endpoints template created"

# 5. Fix WebSocket message handlers
echo ""
echo "5. Adding missing WebSocket handlers..."
cat > websocket-handlers-fix.ts << 'EOF'
// Add these cases to the WebSocket message handler in working-server.ts

case 'join_conversation':
  const { conversationId } = data;
  // Add user to conversation room
  break;

case 'leave_conversation':
  // Remove user from conversation room
  break;

case 'pitch_comment':
  // Handle pitch comment
  const comment = await createPitchComment(data);
  broadcast({ type: 'new_comment', comment });
  break;

case 'pitch_like':
  // Handle pitch like
  const like = await togglePitchLike(data);
  broadcast({ type: 'like_update', like });
  break;
EOF
echo "✅ WebSocket handlers template created"

# 6. Standardize error responses
echo ""
echo "6. Creating standardized error response utility..."
cat > standardized-responses.ts << 'EOF'
// Standardized Response Utilities
// Replace all error responses with these

export const apiResponse = (success: boolean, data?: any, error?: string) => {
  const response: any = {
    success,
    metadata: {
      timestamp: new Date().toISOString()
    }
  };
  
  if (success && data) {
    response.data = data;
  } else if (!success && error) {
    response.error = error;
  }
  
  return new Response(JSON.stringify(response), {
    status: success ? 200 : 400,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
};

export const successResponse = (data: any) => apiResponse(true, data);
export const errorResponse = (error: string) => apiResponse(false, null, error);
EOF
echo "✅ Standardized response utilities created"

# 7. Fix environment variables
echo ""
echo "7. Creating proper .env.template..."
cat > .env.template << 'EOF'
# Backend Configuration
PORT=8001
DATABASE_URL=postgresql://user:pass@localhost:5432/pitchey
JWT_SECRET=your-secret-key-here
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=false

# Frontend URLs
FRONTEND_URL=http://localhost:5173

# Optional Services
SENTRY_DSN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Upstash Redis (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
EOF
echo "✅ Environment template created"

echo ""
echo "8. Creating frontend .env template..."
cat > frontend/.env.template << 'EOF'
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001/ws
VITE_ENV=development
EOF
echo "✅ Frontend environment template created"

echo ""
echo "========================================="
echo "✅ Critical fixes completed!"
echo ""
echo "Next steps:"
echo "1. Review and apply missing-endpoints-implementation.ts"
echo "2. Add websocket-handlers-fix.ts to working-server.ts"
echo "3. Replace error responses with standardized-responses.ts"
echo "4. Update your .env files based on templates"
echo "5. Restart the server to apply changes"
echo ""
echo "Run validation:"
echo "  ./quick-endpoint-test.sh"