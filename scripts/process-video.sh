#!/bin/bash
#
# Video Processing Script for Pitchey
# Generates thumbnails and transcodes video to web-optimized MP4
#
# Usage: ./process-video.sh <input_video_path> <output_directory>
#
# Example: ./process-video.sh /tmp/upload.mp4 /tmp/processed/abc123
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate arguments
if [ $# -lt 2 ]; then
    log_error "Usage: $0 <input_video_path> <output_directory>"
    echo "  input_video_path  - Path to the input video file"
    echo "  output_directory  - Directory where processed files will be saved"
    exit 1
fi

INPUT_VIDEO="$1"
OUTPUT_DIR="$2"

# Validate input file exists
if [ ! -f "$INPUT_VIDEO" ]; then
    log_error "Input video file not found: $INPUT_VIDEO"
    exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    log_error "ffmpeg is not installed. Please install ffmpeg first."
    exit 1
fi

# Check if ffprobe is installed
if ! command -v ffprobe &> /dev/null; then
    log_error "ffprobe is not installed. Please install ffmpeg first."
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"
log_info "Output directory: $OUTPUT_DIR"

# Get video duration in seconds
log_info "Analyzing video..."
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$INPUT_VIDEO")

if [ -z "$DURATION" ] || [ "$DURATION" == "N/A" ]; then
    log_error "Could not determine video duration"
    exit 1
fi

log_info "Video duration: ${DURATION}s"

# Calculate timestamps for thumbnails (10%, 50%, 90% of duration)
# Using bc for floating point arithmetic, falling back to awk if bc not available
calculate_timestamp() {
    local percent=$1
    if command -v bc &> /dev/null; then
        echo "scale=2; $DURATION * $percent" | bc
    else
        awk "BEGIN {printf \"%.2f\", $DURATION * $percent}"
    fi
}

TIMESTAMP_10=$(calculate_timestamp 0.10)
TIMESTAMP_50=$(calculate_timestamp 0.50)
TIMESTAMP_90=$(calculate_timestamp 0.90)

log_info "Thumbnail timestamps: ${TIMESTAMP_10}s, ${TIMESTAMP_50}s, ${TIMESTAMP_90}s"

# Generate thumbnails
log_info "Generating thumbnail at 10% (${TIMESTAMP_10}s)..."
ffmpeg -y -ss "$TIMESTAMP_10" -i "$INPUT_VIDEO" \
    -vframes 1 \
    -vf "scale=640:-1" \
    -q:v 2 \
    "$OUTPUT_DIR/thumbnail_10.jpg" \
    2>/dev/null

log_info "Generating thumbnail at 50% (${TIMESTAMP_50}s)..."
ffmpeg -y -ss "$TIMESTAMP_50" -i "$INPUT_VIDEO" \
    -vframes 1 \
    -vf "scale=640:-1" \
    -q:v 2 \
    "$OUTPUT_DIR/thumbnail_50.jpg" \
    2>/dev/null

log_info "Generating thumbnail at 90% (${TIMESTAMP_90}s)..."
ffmpeg -y -ss "$TIMESTAMP_90" -i "$INPUT_VIDEO" \
    -vframes 1 \
    -vf "scale=640:-1" \
    -q:v 2 \
    "$OUTPUT_DIR/thumbnail_90.jpg" \
    2>/dev/null

log_info "Thumbnails generated successfully"

# Transcode to web-optimized MP4
# Settings:
# - H.264 video codec (libx264) for maximum compatibility
# - AAC audio codec at 128kbps
# - CRF 23 for good quality/size balance
# - preset medium for balanced encoding speed
# - movflags +faststart for web streaming (moov atom at start)
# - Scale to even dimensions (required by H.264)
log_info "Transcoding to web-optimized MP4..."
ffmpeg -y -i "$INPUT_VIDEO" \
    -c:v libx264 \
    -preset medium \
    -crf 23 \
    -c:a aac \
    -b:a 128k \
    -movflags +faststart \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -max_muxing_queue_size 1024 \
    "$OUTPUT_DIR/transcoded.mp4" \
    2>&1 | while read line; do
        # Show progress for long encodes
        if [[ "$line" == *"frame="* ]]; then
            echo -ne "\r${GREEN}[PROGRESS]${NC} $line"
        fi
    done

echo "" # New line after progress

# Verify output files exist
EXPECTED_FILES=("thumbnail_10.jpg" "thumbnail_50.jpg" "thumbnail_90.jpg" "transcoded.mp4")
ALL_FILES_EXIST=true

for file in "${EXPECTED_FILES[@]}"; do
    if [ ! -f "$OUTPUT_DIR/$file" ]; then
        log_error "Expected output file not found: $OUTPUT_DIR/$file"
        ALL_FILES_EXIST=false
    fi
done

if [ "$ALL_FILES_EXIST" = true ]; then
    log_info "Video processing completed successfully!"
    echo ""
    echo "Output files:"
    ls -lh "$OUTPUT_DIR"
    echo ""

    # Output JSON summary for programmatic use
    TRANSCODED_SIZE=$(stat -f%z "$OUTPUT_DIR/transcoded.mp4" 2>/dev/null || stat -c%s "$OUTPUT_DIR/transcoded.mp4" 2>/dev/null)

    echo "JSON Summary:"
    cat << EOF
{
  "status": "success",
  "inputFile": "$INPUT_VIDEO",
  "outputDirectory": "$OUTPUT_DIR",
  "duration": $DURATION,
  "files": {
    "thumbnails": [
      "$OUTPUT_DIR/thumbnail_10.jpg",
      "$OUTPUT_DIR/thumbnail_50.jpg",
      "$OUTPUT_DIR/thumbnail_90.jpg"
    ],
    "transcoded": "$OUTPUT_DIR/transcoded.mp4"
  },
  "timestamps": {
    "thumbnail_10": $TIMESTAMP_10,
    "thumbnail_50": $TIMESTAMP_50,
    "thumbnail_90": $TIMESTAMP_90
  }
}
EOF
    exit 0
else
    log_error "Video processing failed - some output files are missing"
    exit 1
fi
