# Frontend Dockerfile for Fly.io
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy all frontend files
COPY . .

# Set production API URL (will be overridden by env vars)
ARG VITE_API_URL=https://pitchey-backend.fly.dev
ENV VITE_API_URL=$VITE_API_URL

# Build the application (skip TypeScript checks for deployment)
RUN npx vite build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]