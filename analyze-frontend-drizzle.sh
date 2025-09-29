#!/bin/bash

echo "🔍 COMPREHENSIVE FRONTEND-TO-BACKEND DRIZZLE MAPPING ANALYSIS"
echo "============================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Find all services being used
echo -e "\n${BLUE}📦 1. SERVICE LAYER USAGE${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Services imported in components:${NC}"
grep -h "import.*Service" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/**/*.tsx 2>/dev/null | \
  grep "from.*service" | \
  sed 's/.*import.*{\?\s*\([^}]*\)\s*}\?.*from.*/\1/' | \
  sort -u | while read service; do
  count=$(grep -r "$service" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l)
  echo "  • $service: Used in $count files"
done

# Check API client usage
echo -e "\n${BLUE}📡 2. API CLIENT USAGE${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Direct apiClient usage:${NC}"
apiUsage=$(grep -r "apiClient\." /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l)
echo "  Total apiClient calls: $apiUsage"

echo -e "\n${YELLOW}API methods used:${NC}"
grep -r "apiClient\.\(get\|post\|put\|delete\|patch\)" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" -o | \
  cut -d: -f2 | cut -d\( -f1 | sort | uniq -c | sort -rn

# Check data flow patterns
echo -e "\n${BLUE}🔄 3. DATA FLOW PATTERNS${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Components using pitchService:${NC}"
grep -l "pitchService" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/**/*.tsx 2>/dev/null | while read file; do
  basename=$(basename "$file")
  methods=$(grep -o "pitchService\.[a-zA-Z]*" "$file" | cut -d. -f2 | sort -u | tr '\n' ', ')
  echo "  • $basename: ${methods%, }"
done

echo -e "\n${YELLOW}Components using authService:${NC}"
grep -l "authService" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/**/*.tsx 2>/dev/null | while read file; do
  basename=$(basename "$file")
  methods=$(grep -o "authService\.[a-zA-Z]*" "$file" | cut -d. -f2 | sort -u | tr '\n' ', ')
  echo "  • $basename: ${methods%, }"
done

# Check for hardcoded API calls
echo -e "\n${BLUE}⚠️  4. HARDCODED API CALLS${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Fetch calls without services:${NC}"
grep -r "fetch(" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | \
  grep -v "apiClient" | grep -v "// " | head -5

if [ $? -ne 0 ]; then
  echo -e "${GREEN}  ✓ No hardcoded fetch calls found${NC}"
fi

# Check type safety
echo -e "\n${BLUE}🛡️  5. TYPE SAFETY ANALYSIS${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Components using TypeScript interfaces:${NC}"
grep -r "interface.*{" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l
echo "  Total interfaces defined: $(grep -r "interface.*{" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l)"

echo -e "\n${YELLOW}Type imports from services:${NC}"
grep -r "import.*type.*from.*service" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | head -5

# Check state management
echo -e "\n${BLUE}📊 6. STATE MANAGEMENT${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Components using useState with service data:${NC}"
grep -r "useState<.*\[\]>" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l
echo "  Total: $(grep -r "useState<.*\[\]>" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src --include="*.tsx" | wc -l)"

# Check error handling
echo -e "\n${BLUE}❌ 7. ERROR HANDLING${NC}"
echo "------------------------"

echo -e "\n${YELLOW}Try-catch blocks with service calls:${NC}"
grep -B2 -A2 "catch" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/**/*.tsx 2>/dev/null | \
  grep -E "Service\.|apiClient\." | wc -l
echo "  Total error handlers: $(grep -B2 -A2 "catch" /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/**/*.tsx 2>/dev/null | grep -E "Service\.|apiClient\." | wc -l)"

echo -e "\n${GREEN}✅ Analysis Complete!${NC}"
echo "============================================================="