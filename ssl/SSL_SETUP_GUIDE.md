# SSL/TLS Configuration Guide for Pitchey Platform

This guide provides comprehensive instructions for setting up SSL/TLS certificates for the Pitchey platform in both development and production environments.

## 🎯 Overview

The Pitchey platform now supports full HTTPS/WSS connectivity with:
- **Development**: Self-signed certificates for local HTTPS testing
- **Production**: Let's Encrypt certificates with automatic renewal
- **Security**: Modern TLS 1.2/1.3 support with strong cipher suites
- **WebSockets**: Secure WebSocket (WSS) connections for real-time features

## 📁 File Structure

```
ssl/
├── generate-dev-certs.sh      # Generate self-signed certificates for development
├── setup-letsencrypt.sh       # Production SSL setup with Let's Encrypt
├── test-ssl-configuration.sh  # Test SSL configuration
├── test-wss.js               # Test WebSocket secure connections
├── dev-cert.pem              # Development certificate (auto-generated)
├── dev-key.pem               # Development private key (auto-generated)
└── SSL_SETUP_GUIDE.md        # This documentation
```

## 🔧 Development Setup

### 1. Generate Development Certificates

```bash
# Navigate to project root
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Generate self-signed certificates
./ssl/generate-dev-certs.sh
```

### 2. Configure Environment Variables

Update your `.env` file:

```bash
# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=./ssl/dev-cert.pem
SSL_KEY_PATH=./ssl/dev-key.pem
FORCE_HTTPS=false
```

### 3. Start Backend with SSL

```bash
SSL_ENABLED=true PORT=8001 deno run --allow-all working-server.ts
```

### 4. Update Frontend Configuration

Update `frontend/.env`:

```bash
# Use HTTPS for local development
VITE_API_URL=https://localhost:8001
VITE_WS_URL=wss://localhost:8001
```

### 5. Access Application

- **Backend**: https://localhost:8001
- **Frontend**: http://localhost:5173 (connects to HTTPS backend)
- **WebSocket**: wss://localhost:8001/ws

**Browser Security Notice**: You'll see a security warning for self-signed certificates. This is normal for development.

## 🏭 Production Setup

### 1. Prerequisites

- Ubuntu/Debian server with root access
- Domain name pointing to your server
- Nginx installed
- Certbot for Let's Encrypt

### 2. Run Production SSL Setup

```bash
# Run as root (uses sudo)
sudo ./ssl/setup-letsencrypt.sh
```

This script will:
- Install Certbot and Nginx
- Configure Nginx with the provided configuration
- Obtain Let's Encrypt certificates
- Set up automatic renewal
- Configure security headers
- Set up log rotation

### 3. Production Environment Variables

```bash
# Production .env
SSL_ENABLED=true
SSL_CERT_PATH=/etc/letsencrypt/live/pitchey.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/pitchey.com/privkey.pem
FORCE_HTTPS=true
NODE_ENV=production
```

### 4. Nginx Configuration

The production setup includes:
- **HTTP to HTTPS redirect** (301 redirects)
- **Modern SSL/TLS configuration** (TLS 1.2/1.3)
- **Security headers** (HSTS, CSP, X-Frame-Options)
- **Rate limiting** (API, auth, upload endpoints)
- **WebSocket proxying** (WSS support)
- **Gzip compression**
- **Static file serving** (frontend assets)

### 5. DNS Configuration

Update your DNS records:
```
Type: A
Name: @
Value: YOUR_SERVER_IP

Type: A  
Name: www
Value: YOUR_SERVER_IP

Type: A
Name: staging
Value: YOUR_SERVER_IP
```

## 🧪 Testing SSL Configuration

### 1. Run Configuration Test

```bash
# Test current configuration
./ssl/test-ssl-configuration.sh

# Test with SSL enabled
SSL_ENABLED=true ./ssl/test-ssl-configuration.sh
```

### 2. Manual Testing

#### Test HTTPS Connection
```bash
# Health check
curl -k https://localhost:8001/api/health

# Certificate details
openssl s_client -connect localhost:8001 -servername localhost
```

#### Test WebSocket Secure
```bash
# Node.js WebSocket test
node ssl/test-wss.js
```

#### Test Security Headers
```bash
curl -I -k https://localhost:8001/api/health
```

### 3. Browser Testing

1. **Chrome**: Type `thisisunsafe` on certificate warning page
2. **Firefox**: Click "Advanced" → "Accept the Risk and Continue"
3. **Safari**: Click "Advanced" → "Visit this website"

## 🔒 Security Features

### SSL/TLS Configuration

- **Protocols**: TLS 1.2, TLS 1.3
- **Cipher Suites**: Modern, secure ciphers only
- **ECDH Curves**: secp384r1
- **Session Management**: Secure session cache
- **OCSP Stapling**: Enabled for production

### Security Headers

- **HSTS**: Strict Transport Security with preload
- **CSP**: Content Security Policy
- **X-Frame-Options**: Clickjacking protection
- **X-Content-Type-Options**: MIME sniffing protection
- **X-XSS-Protection**: XSS filtering
- **Referrer-Policy**: Privacy protection

### Rate Limiting

- **API**: 10 requests/second, burst 20
- **Auth**: 5 requests/second, burst 10  
- **Upload**: 2 requests/second, burst 5

## 🔄 Certificate Management

### Development Certificates

```bash
# Check certificate validity
openssl x509 -in ssl/dev-cert.pem -text -noout

# Regenerate certificates
rm ssl/dev-cert.pem ssl/dev-key.pem
./ssl/generate-dev-certs.sh
```

### Production Certificates

```bash
# Check certificate status
sudo /usr/local/bin/pitchey-ssl-check.sh

# Manual renewal
sudo certbot renew --nginx

# Test renewal
sudo certbot renew --dry-run
```

### Automatic Renewal

Production certificates auto-renew via cron job:
```bash
# Check cron job
sudo cat /etc/cron.d/certbot-renew

# View renewal logs
sudo journalctl -u certbot
```

## 🚨 Troubleshooting

### Common Issues

#### Certificate Not Valid
```bash
# Check certificate expiration
openssl x509 -enddate -noout -in ssl/dev-cert.pem

# Regenerate if expired
./ssl/generate-dev-certs.sh
```

#### Server Not Starting with SSL
```bash
# Check certificate files exist
ls -la ssl/

# Check server logs
tail -f server.log

# Verify certificate/key match
./ssl/test-ssl-configuration.sh
```

#### WebSocket Connection Failed
```bash
# Test WSS connection
node ssl/test-wss.js

# Check WebSocket endpoint
curl -k -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" https://localhost:8001/ws
```

#### Browser Certificate Warning
- **Development**: Normal for self-signed certificates
- **Production**: Check Let's Encrypt certificate installation

### Debugging Commands

```bash
# Test SSL configuration
nmap --script ssl-enum-ciphers -p 8001 localhost

# Check certificate chain
openssl s_client -connect localhost:8001 -showcerts

# Verify Nginx configuration
sudo nginx -t

# Check SSL server
sslyze localhost:8001
```

## 🔄 Environment Switching

### Development → Production

1. Update DNS records
2. Run `sudo ./ssl/setup-letsencrypt.sh`
3. Update environment variables
4. Restart services

### HTTP → HTTPS

1. Generate/obtain certificates
2. Set `SSL_ENABLED=true`
3. Update frontend URLs
4. Restart backend

### Frontend Environment Updates

Remember to restart the frontend dev server after changing environment variables:

```bash
cd frontend
npm run dev
```

## 📊 Monitoring

### SSL Health Checks

```bash
# Check certificate expiration
sudo /usr/local/bin/pitchey-ssl-check.sh

# Monitor SSL logs
sudo tail -f /var/log/nginx/pitchey_access.log
sudo tail -f /var/log/nginx/pitchey_error.log
```

### Performance Monitoring

- **SSL handshake time**: Monitor connection establishment
- **Certificate validation**: Check OCSP response times
- **Cipher negotiation**: Verify modern ciphers are used

## 🎯 Best Practices

### Development

1. **Use self-signed certificates** for local HTTPS testing
2. **Test both HTTP and HTTPS** configurations
3. **Verify WebSocket secure connections**
4. **Test certificate expiration handling**

### Production

1. **Use Let's Encrypt** for free, trusted certificates
2. **Enable HSTS preload** for enhanced security
3. **Configure rate limiting** to prevent abuse
4. **Monitor certificate expiration**
5. **Set up log rotation** for maintenance
6. **Test automatic renewal** regularly

### Security

1. **Disable weak protocols** (SSLv3, TLS 1.0/1.1)
2. **Use strong cipher suites** only
3. **Enable security headers** (HSTS, CSP, etc.)
4. **Regular security audits** with tools like sslyze
5. **Monitor for vulnerabilities** in SSL/TLS implementations

## 📚 Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Server Test](https://www.ssllabs.com/ssltest/)
- [OWASP Transport Layer Protection](https://owasp.org/www-project-cheat-sheets/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

For support or questions about SSL configuration, refer to this guide or check the troubleshooting section.