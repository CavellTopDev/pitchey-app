#!/bin/bash

echo "🚀 Deploying frontend with correct ndlovucavelle API URL..."

cd frontend

echo "📦 Installing dependencies..."
npm ci

echo "🔧 Building frontend with correct API URL..."
VITE_API_URL=https://pitchey-api.ndlovucavelle.workers.dev \
VITE_WS_URL=wss://pitchey-api.ndlovucavelle.workers.dev \
npm run build

echo "☁️ Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist \
  --project-name=pitchey \
  --branch=main \
  --commit-hash=$(git rev-parse HEAD)

echo "✅ Deployment complete! Frontend should now use the correct API URL."
echo "🔗 Check https://pitchey.pages.dev in a few moments"