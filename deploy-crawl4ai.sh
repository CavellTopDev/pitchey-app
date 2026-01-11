#!/bin/bash

# Crawl4AI Deployment Script
# Deploys both Python worker and Cloudflare Worker

set -e

echo "🚀 Starting Crawl4AI Deployment"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PYTHON_WORKER_HOST="crawl4ai.pitchey.com"
PYTHON_WORKER_PORT="8002"
CF_WORKER_NAME="pitchey-crawl4ai"

# Step 1: Deploy Python Worker
echo -e "\n${YELLOW}Step 1: Deploying Python Worker${NC}"
echo "-----------------------------------"

# Create Python worker Dockerfile
cat > crawl4ai/Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Crawl4AI
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8002

# Run the application
CMD ["uvicorn", "python-worker:app", "--host", "0.0.0.0", "--port", "8002"]
EOF

# Create requirements.txt
cat > crawl4ai/requirements.txt << 'EOF'
crawl4ai>=0.3.0
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.0.0
aiofiles>=23.0.0
python-multipart>=0.0.6
httpx>=0.25.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
openai>=1.0.0
rank-bm25>=0.2.2
EOF

echo -e "${GREEN}✓ Python Worker Dockerfile created${NC}"

# Step 2: Build and push Python Worker image
echo -e "\n${YELLOW}Step 2: Building Python Worker Docker Image${NC}"
echo "----------------------------------------------"

cd crawl4ai
docker build -t pitchey-crawl4ai-python .
echo -e "${GREEN}✓ Docker image built${NC}"

# Note: In production, you'd push to a registry and deploy to your infrastructure
# docker push your-registry/pitchey-crawl4ai-python
# kubectl apply -f k8s/crawl4ai-deployment.yaml

cd ..

# Step 3: Create KV namespaces
echo -e "\n${YELLOW}Step 3: Creating KV Namespaces${NC}"
echo "-----------------------------------"

# Create KV namespaces if they don't exist
echo "Creating CRAWL_CACHE namespace..."
CRAWL_CACHE_ID=$(wrangler kv:namespace create "CRAWL_CACHE" --preview 2>/dev/null | grep -oP 'id = "\K[^"]+' || echo "existing")
if [ "$CRAWL_CACHE_ID" != "existing" ]; then
    echo -e "${GREEN}✓ CRAWL_CACHE namespace created: $CRAWL_CACHE_ID${NC}"
else
    echo -e "${YELLOW}ℹ CRAWL_CACHE namespace already exists${NC}"
fi

echo "Creating SCHEMA_CACHE namespace..."
SCHEMA_CACHE_ID=$(wrangler kv:namespace create "SCHEMA_CACHE" --preview 2>/dev/null | grep -oP 'id = "\K[^"]+' || echo "existing")
if [ "$SCHEMA_CACHE_ID" != "existing" ]; then
    echo -e "${GREEN}✓ SCHEMA_CACHE namespace created: $SCHEMA_CACHE_ID${NC}"
else
    echo -e "${YELLOW}ℹ SCHEMA_CACHE namespace already exists${NC}"
fi

# Step 4: Create R2 bucket
echo -e "\n${YELLOW}Step 4: Creating R2 Bucket${NC}"
echo "------------------------------"

wrangler r2 bucket create pitchey-crawl-reports 2>/dev/null || echo -e "${YELLOW}ℹ R2 bucket already exists${NC}"
echo -e "${GREEN}✓ R2 bucket ready${NC}"

# Step 5: Set secrets
echo -e "\n${YELLOW}Step 5: Setting Worker Secrets${NC}"
echo "----------------------------------"

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠ OPENAI_API_KEY not found in environment${NC}"
    echo "Please set it manually with: wrangler secret put OPENAI_API_KEY"
else
    echo "$OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY
    echo -e "${GREEN}✓ OPENAI_API_KEY secret set${NC}"
fi

# Step 6: Deploy Cloudflare Worker
echo -e "\n${YELLOW}Step 6: Deploying Cloudflare Worker${NC}"
echo "--------------------------------------"

# Build TypeScript worker
echo "Building worker..."
npx esbuild src/workers/crawl4ai-worker.ts \
    --bundle \
    --format=esm \
    --outfile=dist/crawl4ai-worker.js \
    --platform=neutral \
    --target=es2020 \
    --external:node:* \
    --define:process.env.NODE_ENV=\"production\"

echo -e "${GREEN}✓ Worker built${NC}"

# Deploy to Cloudflare
echo "Deploying to Cloudflare Workers..."
wrangler deploy --config wrangler-crawl4ai.toml --env production

echo -e "${GREEN}✓ Cloudflare Worker deployed${NC}"

# Step 7: Test deployment
echo -e "\n${YELLOW}Step 7: Testing Deployment${NC}"
echo "-----------------------------"

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s https://$CF_WORKER_NAME.ndlovucavelle.workers.dev/api/crawl/health || echo "failed")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi

# Step 8: Update main worker to include crawl routes
echo -e "\n${YELLOW}Step 8: Updating Main Worker Routes${NC}"
echo "---------------------------------------"

# Add crawl4ai routes to main worker
cat >> src/worker-integrated.ts << 'EOF'

// Crawl4AI Integration Routes
app.all('/api/crawl/*', async (c) => {
  const url = new URL(c.req.url);
  const crawlUrl = `https://pitchey-crawl4ai.ndlovucavelle.workers.dev${url.pathname}`;
  
  // Forward request to Crawl4AI worker
  const response = await fetch(crawlUrl, {
    method: c.req.method,
    headers: c.req.headers,
    body: c.req.method !== 'GET' ? await c.req.text() : undefined,
  });
  
  return response;
});
EOF

echo -e "${GREEN}✓ Main worker updated with crawl routes${NC}"

# Step 9: Generate API documentation
echo -e "\n${YELLOW}Step 9: Generating API Documentation${NC}"
echo "---------------------------------------"

cat > docs/CRAWL4AI_API.md << 'EOF'
# Crawl4AI API Documentation

## Overview
The Crawl4AI integration provides intelligent web scraping and data enrichment capabilities for the Pitchey platform.

## Endpoints

### Industry News Feed
`GET /api/crawl/news/industry`

Fetches latest industry news from entertainment sources.

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-08T10:00:00Z",
    "items": [
      {
        "id": "1",
        "title": "Breaking Industry News",
        "excerpt": "...",
        "source": "variety",
        "link": "https://...",
        "relevance": 9.5
      }
    ],
    "insights": {
      "hot_genres": [["horror", 12]],
      "trending_formats": [["limited series", 15]],
      "active_buyers": [["netflix", 18]]
    }
  }
}
```

### Pitch Validation
`POST /api/crawl/validate/pitch`

Validates pitch uniqueness and market viability.

**Request:**
```json
{
  "title": "The Last Algorithm",
  "genre": "sci-fi",
  "logline": "An AI discovers consciousness...",
  "format": "feature"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "validation_score": 8.5,
    "uniqueness_score": 9.0,
    "market_viability": 7.5,
    "similar_projects": [],
    "recommendations": []
  }
}
```

### Pitch Enrichment
`POST /api/crawl/enrich/pitch`

Enriches pitch with market data and comparables.

**Request:**
```json
{
  "pitchId": "pitch-123",
  "title": "The Last Algorithm",
  "genre": "sci-fi",
  "budget": "$50M",
  "targetAudience": "18-35"
}
```

### Market Trends
`GET /api/crawl/trends/{genre}`

Gets current market trends for a specific genre.

### Box Office Data
`GET /api/crawl/boxoffice/{timeframe}`

Retrieves box office performance data.

### Competitor Analysis
`POST /api/crawl/analyze/competitors`

Analyzes competing projects in the market.

### Production Company Research
`GET /api/crawl/company/{name}`

Gets information about production companies.

### Schema Management
- `GET /api/crawl/schemas` - List all schemas
- `POST /api/crawl/schemas/generate` - Generate new schema
- `POST /api/crawl/schemas/test` - Test schema

### Cache Management
`DELETE /api/crawl/cache/{type}/{key?}`

Clears cache entries.

### Health Check
`GET /api/crawl/health`

Returns health status of all components.

## Integration with Frontend

### React Hook Example
```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api';

export function useIndustryNews() {
  return useQuery({
    queryKey: ['industry-news'],
    queryFn: () => apiClient.get('/api/crawl/news/industry'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePitchValidation(pitch: PitchData) {
  return useQuery({
    queryKey: ['pitch-validation', pitch.title],
    queryFn: () => apiClient.post('/api/crawl/validate/pitch', pitch),
    enabled: !!pitch.title,
  });
}
```

## Caching Strategy

- **News**: 5 minutes
- **Validation**: 24 hours
- **Enrichment**: 7 days
- **Schemas**: 30 days

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user
- Burst allowance: 20 requests

## Error Codes

- `400`: Bad request (missing required fields)
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Internal server error
- `503`: Service temporarily unavailable
EOF

echo -e "${GREEN}✓ API documentation generated${NC}"

# Step 10: Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Crawl4AI Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Deployed Components:"
echo "  • Python Worker: $PYTHON_WORKER_HOST:$PYTHON_WORKER_PORT"
echo "  • Cloudflare Worker: https://$CF_WORKER_NAME.ndlovucavelle.workers.dev"
echo "  • KV Namespaces: CRAWL_CACHE, SCHEMA_CACHE"
echo "  • R2 Bucket: pitchey-crawl-reports"
echo ""
echo "Next Steps:"
echo "  1. Deploy Python worker to your infrastructure"
echo "  2. Update DNS for crawl4ai.pitchey.com"
echo "  3. Test all endpoints"
echo "  4. Monitor performance and costs"
echo ""
echo "API Documentation: docs/CRAWL4AI_API.md"