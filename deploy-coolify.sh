#!/bin/bash

# 🚀 Coolify Deployment Script
# Deploy your entire app to your own Coolify instance

echo "================================================"
echo "🚀 COOLIFY DEPLOYMENT SETUP"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Prerequisites:${NC}"
echo "1. Coolify installed on your VPS"
echo "2. Domain pointed to your server"
echo "3. GitHub repository created"
echo ""

# Step 1: Prepare for Coolify
echo -e "${YELLOW}Step 1: Preparing for Coolify deployment${NC}"

# Create docker-compose for Coolify
cat > docker-compose.coolify.yml << 'EOF'
version: '3.8'

services:
  backend:
    image: denoland/deno:alpine
    working_dir: /app
    volumes:
      - ./:/app
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/pitchey
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
    command: run --allow-all working-server.ts
    depends_on:
      - db
      - redis
    restart: unless-stopped

  frontend:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://backend:8001
    command: sh -c "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 3000"
    depends_on:
      - backend
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pitchey
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

echo -e "${GREEN}✅ Created docker-compose.coolify.yml${NC}"

# Create Dockerfile for backend
cat > Dockerfile.backend << 'EOF'
FROM denoland/deno:alpine

WORKDIR /app

# Copy dependencies first
COPY deno.json deno.lock ./
RUN deno cache --reload deno.json

# Copy source code
COPY . .

# Pre-cache the main module
RUN deno cache working-server.ts

EXPOSE 8001

CMD ["run", "--allow-all", "working-server.ts"]
EOF

echo -e "${GREEN}✅ Created Dockerfile.backend${NC}"

# Create Dockerfile for frontend
cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

echo -e "${GREEN}✅ Created frontend/Dockerfile${NC}"

# Create nginx config for frontend
cat > frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo -e "${GREEN}✅ Created frontend/nginx.conf${NC}"

# Create .env for Coolify
cat > .env.coolify << 'EOF'
# Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-here

# Your domain
FRONTEND_URL=https://your-domain.com

# Optional: External services
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
EOF

echo -e "${GREEN}✅ Created .env.coolify${NC}"

echo ""
echo -e "${YELLOW}Step 2: Push to GitHub${NC}"
echo ""
echo "Run these commands:"
echo -e "${BLUE}"
cat << 'COMMANDS'
# Initialize git (if not already)
git init
git add .
git commit -m "Ready for Coolify deployment"

# Create GitHub repo and push
gh repo create pitchey-app --public
git remote add origin https://github.com/YOUR_USERNAME/pitchey-app.git
git push -u origin main
COMMANDS
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Step 3: Configure in Coolify${NC}"
echo ""
echo "1. Open your Coolify dashboard"
echo "2. Click 'New Resource' → 'Docker Compose'"
echo "3. Connect your GitHub repository"
echo "4. Select 'docker-compose.coolify.yml'"
echo "5. Configure environment variables:"
echo "   - JWT_SECRET (generate with: openssl rand -base64 32)"
echo "   - FRONTEND_URL (your domain)"
echo "6. Deploy!"

echo ""
echo -e "${YELLOW}Step 4: Alternative - Use Coolify's Build Packs${NC}"
echo ""
echo "For separate deployments:"
echo ""
echo -e "${BLUE}Backend (Deno):${NC}"
echo "1. New Resource → Deno"
echo "2. Point to repository"
echo "3. Set start command: deno run --allow-all working-server.ts"
echo "4. Set environment variables"
echo ""
echo -e "${BLUE}Frontend (Static):${NC}"
echo "1. New Resource → Static Site"
echo "2. Point to /frontend folder"
echo "3. Build command: npm run build"
echo "4. Output directory: dist"

echo ""
echo "================================================"
echo -e "${GREEN}✅ COOLIFY SETUP COMPLETE!${NC}"
echo "================================================"
echo ""
echo "Benefits of using Coolify:"
echo "• ✅ Everything on YOUR server"
echo "• ✅ No vendor lock-in"
echo "• ✅ Automatic SSL with Let's Encrypt"
echo "• ✅ Built-in monitoring"
echo "• ✅ One-click deployments"
echo "• ✅ Automatic backups"
echo ""
echo "Your stack on Coolify:"
echo "• Frontend + Backend + Database + Redis"
echo "• All in one place!"
echo "• Zero external dependencies!"
echo ""
echo -e "${YELLOW}Next: Push to GitHub and configure in Coolify dashboard${NC}"