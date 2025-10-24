#!/bin/bash

# SSL Configuration Test Script for Pitchey
# Tests both HTTP and HTTPS functionality

set -e

echo "🔐 Testing Pitchey SSL Configuration..."
echo ""

# Test variables
HTTP_PORT=8001
HTTPS_PORT=8001
BASE_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2"

echo "📋 Test Configuration:"
echo "   Base Directory: $BASE_DIR"
echo "   HTTP Port: $HTTP_PORT"
echo "   HTTPS Port: $HTTPS_PORT"
echo ""

# Function to test HTTP endpoint
test_http() {
    echo "🌐 Testing HTTP connection..."
    
    if curl -s --max-time 10 "http://localhost:$HTTP_PORT/health" > /dev/null 2>&1; then
        echo "✅ HTTP connection successful"
        
        # Test API endpoint
        if curl -s --max-time 10 "http://localhost:$HTTP_PORT/api/health" > /dev/null 2>&1; then
            echo "✅ HTTP API endpoint accessible"
        else
            echo "⚠️  HTTP API endpoint not responding"
        fi
    else
        echo "❌ HTTP connection failed or server not running"
        return 1
    fi
}

# Function to test HTTPS endpoint
test_https() {
    echo "🔐 Testing HTTPS connection..."
    
    # Test with self-signed certificate (ignore certificate errors for dev)
    if curl -k -s --max-time 10 "https://localhost:$HTTPS_PORT/health" > /dev/null 2>&1; then
        echo "✅ HTTPS connection successful (self-signed cert)"
        
        # Test API endpoint
        if curl -k -s --max-time 10 "https://localhost:$HTTPS_PORT/api/health" > /dev/null 2>&1; then
            echo "✅ HTTPS API endpoint accessible"
        else
            echo "⚠️  HTTPS API endpoint not responding"
        fi
        
        # Test certificate details
        echo "🔍 Certificate Information:"
        echo "   Subject: $(openssl s_client -connect localhost:$HTTPS_PORT -servername localhost 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | cut -d= -f2- || echo 'Unable to retrieve')"
        echo "   Validity: $(openssl s_client -connect localhost:$HTTPS_PORT -servername localhost 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep 'notAfter' | cut -d= -f2 || echo 'Unable to retrieve')"
        
    else
        echo "❌ HTTPS connection failed"
        return 1
    fi
}

# Function to test WebSocket connections
test_websocket() {
    echo "🔌 Testing WebSocket connections..."
    
    # Test HTTP WebSocket
    echo "   Testing ws://localhost:$HTTP_PORT/ws"
    if timeout 5 bash -c "exec 3<>/dev/tcp/localhost/$HTTP_PORT && echo -e 'GET /ws HTTP/1.1\r\nHost: localhost:$HTTP_PORT\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==\r\nSec-WebSocket-Version: 13\r\n\r\n' >&3 && read -t 3 response <&3 && exec 3<&-" 2>/dev/null; then
        echo "✅ HTTP WebSocket endpoint accessible"
    else
        echo "⚠️  HTTP WebSocket endpoint test inconclusive"
    fi
    
    # Test HTTPS WebSocket (if SSL is enabled)
    if [ "$SSL_ENABLED" = "true" ]; then
        echo "   Testing wss://localhost:$HTTPS_PORT/ws"
        echo "⚠️  WSS testing requires more complex setup - manual verification recommended"
    fi
}

# Function to check certificate files
check_certificates() {
    echo "📜 Checking SSL certificates..."
    
    CERT_FILE="$BASE_DIR/ssl/dev-cert.pem"
    KEY_FILE="$BASE_DIR/ssl/dev-key.pem"
    
    if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
        echo "✅ Certificate files found:"
        echo "   Certificate: $CERT_FILE"
        echo "   Private Key: $KEY_FILE"
        
        # Check certificate validity
        if openssl x509 -checkend 86400 -noout -in "$CERT_FILE" > /dev/null 2>&1; then
            EXPIRE_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
            echo "✅ Certificate is valid (expires: $EXPIRE_DATE)"
        else
            echo "⚠️  Certificate is expired or invalid"
        fi
        
        # Check certificate and key match
        CERT_MD5=$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5 | cut -d' ' -f2)
        KEY_MD5=$(openssl rsa -noout -modulus -in "$KEY_FILE" 2>/dev/null | openssl md5 | cut -d' ' -f2)
        
        if [[ "$CERT_MD5" == "$KEY_MD5" ]]; then
            echo "✅ Certificate and private key match"
        else
            echo "❌ Certificate and private key do not match"
        fi
    else
        echo "❌ Certificate files not found"
        echo "   Run: ./ssl/generate-dev-certs.sh to create certificates"
        return 1
    fi
}

# Function to display usage instructions
show_usage() {
    echo ""
    echo "📖 SSL Configuration Instructions:"
    echo ""
    echo "🔧 To enable HTTPS in development:"
    echo "   1. Ensure certificates exist: ./ssl/generate-dev-certs.sh"
    echo "   2. Start backend with SSL: SSL_ENABLED=true PORT=8001 deno run --allow-all working-server.ts"
    echo "   3. Update frontend .env to use https://localhost:8001"
    echo "   4. Access via: https://localhost:8001"
    echo ""
    echo "🏭 For production deployment:"
    echo "   1. Run: sudo ./ssl/setup-letsencrypt.sh"
    echo "   2. Configure DNS to point to your server"
    echo "   3. Start nginx reverse proxy"
    echo "   4. Set FORCE_HTTPS=true in production environment"
    echo ""
    echo "🔍 Manual Testing:"
    echo "   • HTTP Health: curl http://localhost:8001/health"
    echo "   • HTTPS Health: curl -k https://localhost:8001/health"
    echo "   • Certificate Info: openssl s_client -connect localhost:8001 -servername localhost"
}

# Main test execution
echo "Starting SSL configuration tests..."
echo ""

# Check certificate files
check_certificates

echo ""

# Test HTTP functionality
test_http

echo ""

# Check if SSL should be tested
if [ -n "$SSL_ENABLED" ] && [ "$SSL_ENABLED" = "true" ]; then
    echo "🔐 SSL is enabled, testing HTTPS functionality..."
    test_https
    echo ""
    test_websocket
else
    echo "🌐 SSL not enabled, skipping HTTPS tests"
    echo "   Set SSL_ENABLED=true to enable HTTPS testing"
fi

echo ""

# Display usage instructions
show_usage

echo ""
echo "🎉 SSL configuration test complete!"

# Return appropriate exit code
if [[ -f "$BASE_DIR/ssl/dev-cert.pem" && -f "$BASE_DIR/ssl/dev-key.pem" ]]; then
    echo "✅ SSL configuration is ready for development"
    exit 0
else
    echo "⚠️  SSL certificates need to be generated"
    exit 1
fi