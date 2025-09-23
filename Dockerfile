# Build stage
FROM docker.io/denoland/deno:alpine AS builder

ARG GIT_REVISION
ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock ./
RUN deno cache deno.json

# Copy source
COPY . .

# Build Fresh
RUN deno task build

# Cache all dependencies
RUN deno cache main.ts

# Production stage
FROM docker.io/denoland/deno:alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app .

# Create non-root user
RUN addgroup -g 1001 -S deno && \
    adduser -S -u 1001 -G deno deno

USER deno

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno eval "try { await fetch('http://localhost:8000/health'); } catch { Deno.exit(1); }"

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "main.ts"]