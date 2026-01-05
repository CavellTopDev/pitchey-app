# Multi-stage build for Video Processing Container
FROM python:3.11-slim as builder

# Install system dependencies for FFmpeg and video processing
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in virtual environment
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install FFmpeg and runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavcodec-extra \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libavresample-dev \
    x264 \
    x265 \
    libnvidia-encode-470 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd -r pitchey && useradd -r -g pitchey -d /app -s /bin/bash pitchey

# Set up application directory
WORKDIR /app
RUN chown pitchey:pitchey /app

# Copy shared utilities
COPY ../shared /app/shared

# Copy application code
COPY --chown=pitchey:pitchey . /app/

# Create required directories
RUN mkdir -p /tmp/processing /app/uploads /app/outputs && \
    chown -R pitchey:pitchey /tmp/processing /app/uploads /app/outputs

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