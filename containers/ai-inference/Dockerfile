# Multi-stage build for AI Inference Container
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

# Upgrade pip and install packages
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install runtime dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    # General utilities
    curl \
    wget \
    git \
    # For OpenCV and image processing
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    # For audio processing
    libsndfile1 \
    ffmpeg \
    # For tokenizers and text processing
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set environment variables for ML frameworks
ENV PYTHONUNBUFFERED=1
ENV TOKENIZERS_PARALLELISM=false
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/transformers

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
RUN mkdir -p /tmp/processing /app/uploads /app/outputs /app/models /app/.cache && \
    chown -R pitchey:pitchey /tmp/processing /app/uploads /app/outputs /app/models /app/.cache

# Switch to non-root user
USER pitchey

# Pre-download small models (optional, for faster startup)
# RUN python -c "from transformers import pipeline; pipeline('sentiment-analysis', model='cardiffnlp/twitter-roberta-base-sentiment-latest')"

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Graceful shutdown handler
STOPSIGNAL SIGTERM

# Start the server
CMD ["python", "server.py"]