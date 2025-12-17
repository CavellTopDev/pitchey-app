FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache curl jq bash

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cloudflare -u 1001

# Change ownership
RUN chown -R cloudflare:nodejs /app
USER cloudflare

# Expose port
EXPOSE 9199

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9199/metrics || exit 1

# Start the application
CMD ["node", "index.js"]
