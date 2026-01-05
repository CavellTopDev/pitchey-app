# Multi-stage build for Media Transcoder Container
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
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

# Install FFmpeg with advanced codecs and streaming support
RUN apt-get update && apt-get install -y \
    # FFmpeg with all codecs
    ffmpeg \
    # Advanced video codecs
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libfdk-aac-dev \
    libmp3lame-dev \
    libopus-dev \
    # Hardware acceleration (Intel Quick Sync)
    intel-media-va-driver-non-free \
    vainfo \
    # NVIDIA hardware acceleration
    # nvidia-driver-libs \
    # Streaming protocols
    librtmp-dev \
    # HTTP/2 support for streaming
    libnghttp2-dev \
    # Utilities
    curl \
    wget \
    mediainfo \
    # Subtitles and captions
    libass-dev \
    && rm -rf /var/lib/apt/lists/*

# Install specialized streaming tools
RUN wget -O /usr/local/bin/Bento4 https://github.com/axiomatic-systems/Bento4/releases/download/v1-6-0-641/Bento4-SDK-1-6-0-641.x86_64-unknown-linux.zip && \
    unzip -j /usr/local/bin/Bento4 "*/bin/*" -d /usr/local/bin/ && \
    rm /usr/local/bin/Bento4 && \
    chmod +x /usr/local/bin/*

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

# Create required directories for streaming output
RUN mkdir -p /tmp/processing /app/uploads /app/outputs /app/streams /app/manifests && \
    chown -R pitchey:pitchey /tmp/processing /app/uploads /app/outputs /app/streams /app/manifests

# Switch to non-root user
USER pitchey

# Expose ports for streaming
EXPOSE 8080 1935

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Graceful shutdown handler
STOPSIGNAL SIGTERM

# Start the server
CMD ["python", "server.py"]