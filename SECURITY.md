# Security Implementation Guide

## Overview
This document outlines the security measures implemented in the Pitchey platform.

## Security Features

### 1. Authentication & Authorization
- JWT-based authentication with secure secret management
- Separate access and refresh tokens
- Role-based access control (RBAC)
- Session tracking and management
- Automatic token rotation

### 2. Input Validation & Sanitization
- Comprehensive input validation schemas for all endpoints
- XSS prevention through HTML escaping
- SQL injection protection
- File upload validation (type, size, extension)
- Request body size limits

### 3. Rate Limiting
- Endpoint-specific rate limits:
  - Authentication: 5 attempts per 15 minutes
  - Password reset: 3 attempts per hour
  - API: 100 requests per minute
  - File uploads: 10 per 10 minutes
- IP-based blocking for repeat offenders
- Token bucket algorithm with sliding window

### 4. Security Headers
- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer Policy
- Permissions Policy

### 5. CORS Configuration
- Whitelist of allowed origins
- Proper preflight handling
- Credentials support with specific origins only

### 6. Password Security
- Minimum 12 characters
- Complexity requirements (uppercase, lowercase, numbers, special chars)
- No common passwords
- No user information in passwords
- bcrypt with 12 salt rounds

### 7. CSRF Protection
- CSRF tokens for state-changing operations
- Double-submit cookie pattern
- SameSite cookie attributes

## Environment Variables

### Required for Production
```
JWT_SECRET          - Strong random secret (min 64 characters)
JWT_REFRESH_SECRET  - Different from JWT_SECRET
SESSION_SECRET      - Session encryption key
DATABASE_URL        - PostgreSQL connection string
```

### Security Settings
```
ALLOWED_ORIGINS     - Comma-separated list of allowed origins
RATE_LIMIT_ENABLED  - Enable/disable rate limiting (always true in production)
SECURE_COOKIES      - Use secure flag on cookies (true in production)
CSRF_PROTECTION     - Enable CSRF protection (true in production)
```

## Running the Secure Server

### Development
```bash
deno run --allow-net --allow-read --allow-env --allow-write secure-server.ts
```

### Production
```bash
DENO_ENV=production deno run --allow-net --allow-read --allow-env secure-server.ts
```

## Security Checklist for Deployment

- [ ] All environment variables configured with strong values
- [ ] Database using SSL/TLS connection
- [ ] HTTPS enabled with valid certificate
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Regular security updates scheduled
- [ ] Backup strategy in place
- [ ] Incident response plan documented
- [ ] Security headers verified
- [ ] CORS properly configured for production domains

## Testing Security

Run the security test suite:
```bash
deno test --allow-all tests/security.test.ts
```

## Reporting Security Issues

If you discover a security vulnerability, please email security@pitchey.com.
Do not create public GitHub issues for security vulnerabilities.

## Compliance

This implementation follows:
- OWASP Top 10 security practices
- OWASP Authentication Cheat Sheet
- OWASP Session Management Cheat Sheet
- OWASP Input Validation Cheat Sheet
- OWASP Password Storage Cheat Sheet
