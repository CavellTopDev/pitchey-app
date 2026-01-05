# Multi-stage build for Document Processing Container
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

# Install document processing dependencies
RUN apt-get update && apt-get install -y \
    # PDF processing
    poppler-utils \
    # OCR capabilities
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    # Image processing
    imagemagick \
    # LibreOffice for document conversion
    libreoffice \
    # Fonts for PDF generation
    fonts-liberation \
    fonts-dejavu-core \
    # Security tools
    clamav \
    clamav-daemon \
    # Utilities
    curl \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick security policy for PDF processing
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

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

# Copy document templates
COPY --chown=pitchey:pitchey templates/ /app/templates/

# Create required directories
RUN mkdir -p /tmp/processing /app/uploads /app/outputs /app/templates && \
    chown -R pitchey:pitchey /tmp/processing /app/uploads /app/outputs /app/templates

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