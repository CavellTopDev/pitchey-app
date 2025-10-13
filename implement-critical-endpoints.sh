#!/bin/bash

echo "🔧 Implementing Critical Missing Endpoints"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Apply database schema changes
echo -e "\n${YELLOW}Step 1: Applying database schema changes...${NC}"
source .env
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U postgres -d pitchey -f add-missing-tables.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Database schema updated${NC}"
else
  echo "❌ Failed to update database schema"
  exit 1
fi

# 2. Add Drizzle schema definitions
echo -e "\n${YELLOW}Step 2: Adding Drizzle schema definitions...${NC}"

# Check if schema additions are needed
if ! grep -q "export const reviews" src/db/schema.ts; then
  cat >> src/db/schema.ts << 'EOF'

// Reviews table for production pitch reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").$type<"approved" | "rejected" | "pending" | "needs_revision">(),
  feedback: text("feedback"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Calendar Events table
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  type: text("type").$type<"meeting" | "deadline" | "screening" | "production" | "review" | "other">(),
  relatedPitchId: integer("related_pitch_id").references(() => pitches.id, { onDelete: "set null" }),
  location: varchar("location", { length: 255 }),
  attendees: jsonb("attendees").$type<string[]>().default([]),
  reminderMinutes: integer("reminder_minutes").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved Pitches table
export const savedPitches = pgTable("saved_pitches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  pitchId: integer("pitch_id").references(() => pitches.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
EOF
  echo -e "${GREEN}✅ Drizzle schema definitions added${NC}"
else
  echo -e "${GREEN}✅ Drizzle schema already contains required tables${NC}"
fi

# 3. Test the implementation
echo -e "\n${YELLOW}Step 3: Creating test script...${NC}"

cat > test-critical-endpoints.sh << 'EOF'
#!/bin/bash

echo "🧪 Testing Critical Endpoints"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Start server if needed
if ! curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
  echo "Starting server..."
  source .env
  PORT=8001 deno run --allow-all working-server.ts &
  SERVER_PID=$!
  sleep 3
fi

# Login as creator
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi

echo "Testing endpoints..."

# Test 1: Creator followers
echo -n "1. GET /api/creator/followers: "
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/creator/followers \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Working${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Test 2: Creator saved pitches
echo -n "2. GET /api/creator/saved-pitches: "
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/creator/saved-pitches \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Working${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Test 3: Creator recommendations
echo -n "3. GET /api/creator/recommendations: "
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/creator/recommendations \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Working${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Login as production
PROD_TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}' | jq -r '.token')

# Test 4: Production analytics
echo -n "4. GET /api/production/analytics: "
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/production/analytics \
  -H "Authorization: Bearer $PROD_TOKEN")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Working${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Test 5: Production calendar
echo -n "5. GET /api/production/calendar: "
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8001/api/production/calendar \
  -H "Authorization: Bearer $PROD_TOKEN")
STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Working${NC}"
else
  echo -e "${RED}❌ Failed (Status: $STATUS)${NC}"
fi

# Cleanup
if [ ! -z "$SERVER_PID" ]; then
  kill $SERVER_PID 2>/dev/null
fi

echo -e "\n${GREEN}✅ Critical endpoint testing complete!${NC}"
EOF

chmod +x test-critical-endpoints.sh

echo -e "${GREEN}✅ Implementation script created${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Review the implementations in fix-critical-endpoints.ts"
echo "2. Add the endpoint code to working-server.ts at the specified line numbers"
echo "3. Run: ./test-critical-endpoints.sh to verify"
echo ""
echo "Example to add creator followers endpoint:"
echo "  - Open working-server.ts"
echo "  - Go to line ~2400 (after other creator endpoints)"
echo "  - Add the implementation from fix-critical-endpoints.ts"