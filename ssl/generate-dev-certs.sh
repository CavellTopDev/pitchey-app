#!/bin/bash

# SSL Certificate Generation Script for Pitchey Development Environment
# This script generates self-signed certificates for local HTTPS development

set -e

SSL_DIR="/home/supremeisbeing/pitcheymovie/pitchey_v0.2/ssl"
CERT_FILE="$SSL_DIR/dev-cert.pem"
KEY_FILE="$SSL_DIR/dev-key.pem"
DAYS=365

echo "🔐 Generating SSL certificates for Pitchey development environment..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if certificates already exist
if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    echo "⚠️  Existing certificates found. Checking validity..."
    
    # Check if certificate is still valid (not expired)
    if openssl x509 -checkend 86400 -noout -in "$CERT_FILE" > /dev/null 2>&1; then
        echo "✅ Existing certificates are still valid (expires in more than 24 hours)"
        echo "   Certificate: $CERT_FILE"
        echo "   Private Key: $KEY_FILE"
        echo "🔍 Certificate details:"
        openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|DNS:|IP Address:|Not After)"
        exit 0
    else
        echo "⚠️  Existing certificates are expired or invalid. Regenerating..."
        rm -f "$CERT_FILE" "$KEY_FILE"
    fi
fi

# Generate private key
echo "🔑 Generating private key..."
openssl genrsa -out "$KEY_FILE" 2048

# Create certificate signing request configuration
cat > "$SSL_DIR/dev-cert.conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=California
L=San Francisco
O=Pitchey Development
OU=Development Team
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
DNS.4 = pitchey.local
DNS.5 = *.pitchey.local
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = 0.0.0.0
EOF

# Generate certificate
echo "📜 Generating self-signed certificate..."
openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days $DAYS -config "$SSL_DIR/dev-cert.conf" -extensions v3_req

# Set appropriate permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "✅ SSL certificates generated successfully!"
echo "   Certificate: $CERT_FILE"
echo "   Private Key: $KEY_FILE"
echo "   Valid for: $DAYS days"

echo ""
echo "🔍 Certificate details:"
openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|DNS:|IP Address:|Not After)"

echo ""
echo "📝 Usage Instructions:"
echo "   1. Start the backend with SSL enabled: SSL_ENABLED=true PORT=8001 deno run --allow-all working-server.ts"
echo "   2. Access your application at: https://localhost:8001"
echo "   3. For frontend development, update VITE_API_URL to https://localhost:8001"
echo ""
echo "⚠️  Browser Security Notice:"
echo "   - Your browser will show a security warning for self-signed certificates"
echo "   - Click 'Advanced' and 'Proceed to localhost (unsafe)' to continue"
echo "   - For Chrome: Type 'thisisunsafe' when on the warning page"
echo "   - For Firefox: Click 'Advanced' → 'Accept the Risk and Continue'"
echo ""
echo "🔧 For production, replace these certificates with proper CA-signed certificates"

# Clean up temporary config file
rm -f "$SSL_DIR/dev-cert.conf"

echo "🎉 SSL setup complete!"