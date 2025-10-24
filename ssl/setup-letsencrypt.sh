#!/bin/bash

# Let's Encrypt SSL Certificate Setup for Pitchey Production
# This script sets up SSL certificates using Certbot and configures auto-renewal

set -e

# Configuration
DOMAIN="pitchey.com"
STAGING_DOMAIN="staging.pitchey.com"
EMAIL="admin@pitchey.com"
WEBROOT="/var/www/certbot"
NGINX_CONFIG="/etc/nginx/sites-available/pitchey"
BACKUP_DIR="/etc/ssl/backups/$(date +%Y%m%d_%H%M%S)"

echo "🔐 Setting up Let's Encrypt SSL certificates for Pitchey..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Update package list
echo "📦 Updating package list..."
apt-get update

# Install required packages
echo "📦 Installing Certbot and Nginx..."
apt-get install -y certbot python3-certbot-nginx nginx

# Create webroot directory for Let's Encrypt challenges
echo "📁 Creating webroot directory..."
mkdir -p "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"

# Backup existing nginx configuration if it exists
if [[ -f "$NGINX_CONFIG" ]]; then
    echo "💾 Backing up existing Nginx configuration..."
    mkdir -p "$BACKUP_DIR"
    cp "$NGINX_CONFIG" "$BACKUP_DIR/nginx.conf.backup"
fi

# Copy our nginx configuration
echo "📋 Installing Nginx configuration..."
cp "/home/supremeisbeing/pitcheymovie/pitchey_v0.2/nginx.conf" "$NGINX_CONFIG"

# Create symlink to sites-enabled if it doesn't exist
if [[ ! -L "/etc/nginx/sites-enabled/pitchey" ]]; then
    ln -s "$NGINX_CONFIG" /etc/nginx/sites-enabled/pitchey
fi

# Remove default nginx site if it exists
if [[ -f "/etc/nginx/sites-enabled/default" ]]; then
    rm -f /etc/nginx/sites-enabled/default
fi

# Test nginx configuration
echo "🔧 Testing Nginx configuration..."
nginx -t

# Start and enable nginx
echo "🚀 Starting Nginx..."
systemctl enable nginx
systemctl restart nginx

# Wait for nginx to start
sleep 2

# Check if certificates already exist
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    echo "✅ SSL certificates already exist for $DOMAIN"
    echo "🔄 Checking certificate validity..."
    
    # Check certificate expiration
    EXPIRE_DATE=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
    EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s)
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_UNTIL_EXPIRE=$(( ($EXPIRE_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))
    
    if [[ $DAYS_UNTIL_EXPIRE -gt 30 ]]; then
        echo "✅ Certificate is valid for $DAYS_UNTIL_EXPIRE more days"
    else
        echo "⚠️  Certificate expires in $DAYS_UNTIL_EXPIRE days, renewing..."
        certbot renew --nginx
    fi
else
    echo "🆕 Obtaining new SSL certificates..."
    
    # Obtain SSL certificate for main domain
    certbot certonly \
        --webroot \
        --webroot-path="$WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
    
    # Obtain SSL certificate for staging domain (optional)
    read -p "🤔 Do you want to set up staging domain SSL ($STAGING_DOMAIN)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        certbot certonly \
            --webroot \
            --webroot-path="$WEBROOT" \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            -d "$STAGING_DOMAIN"
    fi
fi

# Update nginx configuration to use SSL certificates
echo "🔧 Updating Nginx configuration for SSL..."

# Test nginx configuration with SSL
nginx -t

# Reload nginx to apply SSL configuration
systemctl reload nginx

# Set up automatic renewal
echo "⏰ Setting up automatic certificate renewal..."

# Create renewal cron job
cat > /etc/cron.d/certbot-renew << EOF
# Automatic renewal of Let's Encrypt certificates
# Runs twice daily at random times
0 */12 * * * root test -x /usr/bin/certbot && perl -e 'sleep int(rand(3600))' && /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx
EOF

# Test automatic renewal
echo "🧪 Testing automatic renewal..."
certbot renew --dry-run

# Set up log rotation for nginx logs
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/pitchey-nginx << EOF
/var/log/nginx/pitchey_*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF

# Create SSL security check script
cat > /usr/local/bin/pitchey-ssl-check.sh << 'EOF'
#!/bin/bash
# SSL Security Check for Pitchey

DOMAIN="pitchey.com"
MIN_DAYS=30

# Check certificate expiration
EXPIRE_DATE=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s)
CURRENT_TIMESTAMP=$(date +%s)
DAYS_UNTIL_EXPIRE=$(( ($EXPIRE_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))

echo "🔐 SSL Certificate Status for $DOMAIN"
echo "📅 Expires: $EXPIRE_DATE"
echo "⏱️  Days until expiration: $DAYS_UNTIL_EXPIRE"

if [[ $DAYS_UNTIL_EXPIRE -lt $MIN_DAYS ]]; then
    echo "⚠️  WARNING: Certificate expires in less than $MIN_DAYS days!"
    exit 1
else
    echo "✅ Certificate is valid"
fi

# Test SSL configuration
echo "🔧 Testing SSL configuration..."
if curl -sSf https://$DOMAIN/health > /dev/null; then
    echo "✅ HTTPS connection successful"
else
    echo "❌ HTTPS connection failed"
    exit 1
fi
EOF

chmod +x /usr/local/bin/pitchey-ssl-check.sh

# Display final status
echo ""
echo "🎉 SSL setup complete!"
echo ""
echo "✅ Configuration Summary:"
echo "   📜 Certificates: /etc/letsencrypt/live/$DOMAIN/"
echo "   🔧 Nginx config: $NGINX_CONFIG"
echo "   📁 Webroot: $WEBROOT"
echo "   ⏰ Auto-renewal: Configured (runs twice daily)"
echo ""
echo "🔗 Your site should now be accessible at:"
echo "   🌐 https://$DOMAIN"
echo "   🌐 https://www.$DOMAIN"
echo ""
echo "📊 SSL Health Check:"
echo "   Run: /usr/local/bin/pitchey-ssl-check.sh"
echo ""
echo "🔄 Manual Certificate Renewal:"
echo "   sudo certbot renew --nginx"
echo ""
echo "⚠️  Next Steps:"
echo "   1. Update your DNS A records to point to this server"
echo "   2. Update frontend environment variables to use HTTPS URLs"
echo "   3. Test all functionality with HTTPS enabled"
echo "   4. Monitor certificate expiration dates"

# Run initial SSL check
echo "🧪 Running initial SSL health check..."
sleep 5
/usr/local/bin/pitchey-ssl-check.sh