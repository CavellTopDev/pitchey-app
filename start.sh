#!/bin/sh

# Fly.io startup script for Pitchey

# Set environment defaults
export PORT=${PORT:-8001}
export NODE_ENV=${NODE_ENV:-production}

# Ensure data directories exist
mkdir -p /app/data /app/static/uploads

# Start the server
echo "🚀 Starting Pitchey server on port $PORT..."
exec deno run \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --unstable \
  multi-portal-server.ts