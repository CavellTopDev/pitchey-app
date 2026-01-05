# Multi-stage build for Code Executor Container
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in virtual environment
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install runtime environments for multiple languages
RUN apt-get update && apt-get install -y \
    # Python is already available
    # Node.js and npm
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    # Deno
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/ \
    # PostgreSQL client
    && apt-get install -y postgresql-client \
    # Utilities for sandboxing and security
    && apt-get install -y \
    firejail \
    bubblewrap \
    cgroup-tools \
    # System utilities
    timeout \
    strace \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd -r pitchey && useradd -r -g pitchey -d /app -s /bin/bash pitchey
RUN groupadd -r executor && useradd -r -g executor -d /tmp/sandbox -s /bin/bash executor

# Set up application directory
WORKDIR /app
RUN chown pitchey:pitchey /app

# Copy shared utilities
COPY ../shared /app/shared

# Copy application code
COPY --chown=pitchey:pitchey . /app/

# Set up sandbox environment
RUN mkdir -p /tmp/sandbox /app/uploads /app/outputs /tmp/execution && \
    chown -R executor:executor /tmp/sandbox /tmp/execution && \
    chown -R pitchey:pitchey /app/uploads /app/outputs && \
    chmod 755 /tmp/sandbox /tmp/execution

# Configure firejail for additional security
COPY --chown=root:root firejail.profile /etc/firejail/pitchey-executor.profile

# Set resource limits
RUN echo "executor soft nproc 10" >> /etc/security/limits.conf && \
    echo "executor hard nproc 20" >> /etc/security/limits.conf && \
    echo "executor soft nofile 100" >> /etc/security/limits.conf && \
    echo "executor hard nofile 200" >> /etc/security/limits.conf

# Switch to non-root user
USER pitchey

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Graceful shutdown handler
STOPSIGNAL SIGTERM

# Start the server
CMD ["python", "server.py"]