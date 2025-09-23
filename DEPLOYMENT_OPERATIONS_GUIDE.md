# Pitchey Platform Deployment & Operations Guide

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Production Environment Setup](#production-environment-setup)
4. [Deployment Process](#deployment-process)
5. [Monitoring & Logging](#monitoring--logging)
6. [Backup & Recovery](#backup--recovery)
7. [Scaling Strategy](#scaling-strategy)
8. [Security Operations](#security-operations)
9. [Maintenance Procedures](#maintenance-procedures)
10. [Disaster Recovery](#disaster-recovery)
11. [Performance Optimization](#performance-optimization)
12. [Troubleshooting Production Issues](#troubleshooting-production-issues)

## Deployment Overview

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         CloudFlare CDN                       │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer (AWS ALB)                │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │   Backend    │ │   Backend    │ │   Backend    │
        │   Server 1   │ │   Server 2   │ │   Server 3   │
        └──────────────┘ └──────────────┘ └──────────────┘
                │               │               │
                └───────────────┼───────────────┘
                                ▼
                ┌─────────────────────────────────┐
                │     PostgreSQL (Primary)        │
                └─────────────────────────────────┘
                                │
                                ▼
                ┌─────────────────────────────────┐
                │    PostgreSQL (Read Replica)    │
                └─────────────────────────────────┘
```

### Deployment Environments

| Environment | Purpose | URL |
|------------|---------|-----|
| **Development** | Local development | http://localhost:8000 |
| **Staging** | Pre-production testing | https://staging.pitchey.com |
| **Production** | Live environment | https://api.pitchey.com |
| **DR** | Disaster recovery | https://dr.pitchey.com |

## Infrastructure Requirements

### Minimum Production Requirements

#### Application Servers (3x)
- **CPU**: 4 vCPUs (AWS c5.xlarge or equivalent)
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: 10 Gbps
- **OS**: Ubuntu 22.04 LTS

#### Database Server
- **CPU**: 8 vCPUs (AWS db.r5.2xlarge)
- **RAM**: 32 GB
- **Storage**: 500 GB SSD (with IOPS provisioning)
- **Backup Storage**: 1 TB
- **PostgreSQL**: 14.x

#### Redis Cache
- **Type**: AWS ElastiCache or Redis Cloud
- **Size**: cache.m5.large
- **Memory**: 6.38 GB
- **Replication**: Multi-AZ

#### Load Balancer
- **Type**: Application Load Balancer (ALB)
- **SSL**: AWS Certificate Manager
- **Health Checks**: Every 30 seconds
- **Sticky Sessions**: Enabled for WebSocket

### Recommended Production Setup

#### AWS Infrastructure
```yaml
# terraform/production.tf
resource "aws_instance" "backend" {
  count         = 3
  instance_type = "c5.xlarge"
  ami           = "ami-ubuntu-22.04"
  
  tags = {
    Name = "pitchey-backend-${count.index}"
    Environment = "production"
  }
}

resource "aws_db_instance" "postgres" {
  engine               = "postgres"
  engine_version       = "14.7"
  instance_class       = "db.r5.2xlarge"
  allocated_storage    = 500
  storage_encrypted    = true
  multi_az            = true
  backup_retention_period = 30
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "pitchey-cache"
  engine              = "redis"
  node_type           = "cache.m5.large"
  num_cache_nodes     = 2
  parameter_group_name = "default.redis7"
}

resource "aws_s3_bucket" "uploads" {
  bucket = "pitchey-uploads"
  
  versioning {
    enabled = true
  }
  
  encryption {
    rule {
      sse_algorithm = "AES256"
    }
  }
}
```

## Production Environment Setup

### 1. Environment Variables

Create `.env.production`:

```bash
# Production Database
DATABASE_URL=postgresql://prod_user:${DB_PASSWORD}@prod-db.region.rds.amazonaws.com:5432/pitchey_prod
DATABASE_POOL_SIZE=50
DATABASE_SSL=required

# Security (use secure secrets management)
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Environment
DENO_ENV=production
NODE_ENV=production
LOG_LEVEL=info

# API Configuration
API_PORT=8000
BASE_URL=https://api.pitchey.com
FRONTEND_URL=https://app.pitchey.com

# CORS
ALLOWED_ORIGINS=https://app.pitchey.com,https://www.pitchey.com

# Email Service
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=${SENDGRID_API_KEY}
EMAIL_FROM=noreply@pitchey.com
EMAIL_FROM_NAME=Pitchey

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_S3_BUCKET=pitchey-uploads

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

# Redis
REDIS_URL=redis://prod-cache.region.cache.amazonaws.com:6379

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
DATADOG_API_KEY=${DATADOG_API_KEY}
NEW_RELIC_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}

# Security Headers
HSTS_MAX_AGE=31536000
CSP_POLICY="default-src 'self'; script-src 'self' 'unsafe-inline';"

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Secrets Management

#### Using AWS Secrets Manager
```bash
# Store secrets
aws secretsmanager create-secret \
  --name pitchey/production/jwt-secret \
  --secret-string $(openssl rand -base64 64)

# Retrieve in application
import { SecretsManager } from "aws-sdk";
const client = new SecretsManager({ region: "us-east-1" });
const secret = await client.getSecretValue({ SecretId: "pitchey/production/jwt-secret" }).promise();
```

#### Using HashiCorp Vault
```bash
# Store secrets
vault kv put secret/pitchey/production \
  jwt_secret="..." \
  database_password="..." \
  stripe_key="..."

# Retrieve in application
vault kv get -format=json secret/pitchey/production
```

## Deployment Process

### 1. CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      
      - name: Run Tests
        run: deno test --allow-all
      
      - name: Security Scan
        run: |
          npm audit
          deno lint
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Build Docker Image
        run: |
          docker build -t pitchey-backend:${{ github.sha }} .
          docker tag pitchey-backend:${{ github.sha }} pitchey-backend:latest
      
      - name: Push to Registry
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker push $ECR_REGISTRY/pitchey-backend:${{ github.sha }}
          docker push $ECR_REGISTRY/pitchey-backend:latest
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws ecs update-service \
            --cluster pitchey-production \
            --service pitchey-backend \
            --force-new-deployment
      
      - name: Wait for Deployment
        run: |
          aws ecs wait services-stable \
            --cluster pitchey-production \
            --services pitchey-backend
      
      - name: Health Check
        run: |
          curl -f https://api.pitchey.com/health || exit 1
```

### 2. Docker Deployment

#### Production Dockerfile
```dockerfile
# Dockerfile
FROM denoland/deno:1.37.0

WORKDIR /app

# Copy dependency files
COPY deno.json .
COPY import_map.json .

# Cache dependencies
RUN deno cache multi-portal-server.ts

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' deno && \
    chown -R deno:deno /app

USER deno

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno run --allow-net health-check.ts || exit 1

EXPOSE 8000

CMD ["deno", "run", "--allow-all", "multi-portal-server.ts"]
```

### 3. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pitchey-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pitchey-backend
  template:
    metadata:
      labels:
        app: pitchey-backend
    spec:
      containers:
      - name: backend
        image: pitchey-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pitchey-secrets
              key: database-url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: pitchey-backend
  namespace: production
spec:
  selector:
    app: pitchey-backend
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

## Monitoring & Logging

### 1. Application Monitoring

#### Prometheus Metrics
```typescript
// src/monitoring/metrics.ts
import { Registry, Counter, Histogram } from "prom-client";

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  registers: [register]
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register]
});
```

#### DataDog Integration
```typescript
// src/monitoring/datadog.ts
import { StatsD } from "node-dogstatsd";

const client = new StatsD({
  host: process.env.DATADOG_AGENT_HOST,
  port: 8125,
  prefix: "pitchey."
});

export function trackMetric(name: string, value: number, tags?: string[]) {
  client.gauge(name, value, tags);
}

export function trackEvent(name: string, tags?: string[]) {
  client.increment(name, tags);
}
```

### 2. Logging Strategy

#### Structured Logging
```typescript
// src/utils/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: "error.log", 
      level: "error" 
    }),
    new winston.transports.File({ 
      filename: "combined.log" 
    })
  ]
});

// Production logging to CloudWatch
if (process.env.DENO_ENV === "production") {
  const CloudWatchTransport = require("winston-cloudwatch");
  logger.add(new CloudWatchTransport({
    logGroupName: "pitchey-production",
    logStreamName: `backend-${process.env.INSTANCE_ID}`,
    awsRegion: process.env.AWS_REGION
  }));
}
```

### 3. Alert Configuration

#### PagerDuty Alerts
```yaml
# alerts/production.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 0.05
    duration: 5m
    severity: critical
    notify:
      - pagerduty
      - slack
  
  - name: HighResponseTime
    condition: p95_response_time > 500ms
    duration: 10m
    severity: warning
    notify:
      - slack
  
  - name: DatabaseConnectionFailure
    condition: db_connections == 0
    duration: 1m
    severity: critical
    notify:
      - pagerduty
      - email
```

## Backup & Recovery

### 1. Database Backups

#### Automated Backups
```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="pitchey_backup_${TIMESTAMP}.sql"
S3_BUCKET="pitchey-backups"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp ${BACKUP_FILE}.gz s3://${S3_BUCKET}/database/

# Clean up old backups (keep 30 days)
aws s3 ls s3://${S3_BUCKET}/database/ | \
  while read -r line; do
    createDate=$(echo $line | awk '{print $1" "$2}')
    createDate=$(date -d"$createDate" +%s)
    olderThan=$(date -d"30 days ago" +%s)
    if [[ $createDate -lt $olderThan ]]; then
      fileName=$(echo $line | awk '{print $4}')
      aws s3 rm s3://${S3_BUCKET}/database/$fileName
    fi
  done
```

#### Point-in-Time Recovery
```bash
# Enable WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://pitchey-backups/wal/%f'
wal_level = replica
max_wal_senders = 3

# Restore to specific time
pg_basebackup -D /var/lib/postgresql/restore
recovery_target_time = '2025-01-21 14:30:00'
```

### 2. Application Backups

```bash
#!/bin/bash
# scripts/backup-application.sh

# Backup uploaded files
aws s3 sync /app/static/uploads s3://pitchey-backups/uploads/

# Backup configuration
aws s3 cp /app/.env.production s3://pitchey-backups/config/

# Backup Docker images
docker save pitchey-backend:latest | gzip > pitchey-backend.tar.gz
aws s3 cp pitchey-backend.tar.gz s3://pitchey-backups/images/
```

## Scaling Strategy

### 1. Horizontal Scaling

#### Auto-Scaling Configuration
```yaml
# AWS Auto Scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pitchey-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pitchey-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 2. Database Scaling

#### Read Replicas
```sql
-- Create read replica
CREATE DATABASE LINK pitchey_read_replica
  CONNECT TO replica_user IDENTIFIED BY 'password'
  USING 'read-replica.region.rds.amazonaws.com:5432/pitchey_prod';

-- Route read queries to replica
-- In application code:
const readPool = new Pool({
  connectionString: process.env.READ_DATABASE_URL
});

const writePool = new Pool({
  connectionString: process.env.WRITE_DATABASE_URL
});
```

#### Connection Pooling
```typescript
// src/db/pool.ts
import { Pool } from "pg";
import PgBouncer from "pgbouncer";

const poolConfig = {
  max: 100,                     // Maximum connections
  min: 10,                      // Minimum connections
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout after 5s
  maxUses: 7500,               // Close connection after 7500 uses
  allowExitOnIdle: true
};

export const dbPool = new Pool({
  ...poolConfig,
  connectionString: process.env.DATABASE_URL
});
```

## Security Operations

### 1. SSL/TLS Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.pitchey.com;
    
    ssl_certificate /etc/ssl/certs/pitchey.crt;
    ssl_certificate_key /etc/ssl/private/pitchey.key;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;
}
```

### 2. WAF Configuration

```json
// AWS WAF Rules
{
  "Rules": [
    {
      "Name": "SQLInjectionRule",
      "Priority": 1,
      "Statement": {
        "SqliMatchStatement": {
          "FieldToMatch": {
            "AllQueryArguments": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            },
            {
              "Priority": 1,
              "Type": "HTML_ENTITY_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "RateLimitRule",
      "Priority": 2,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

### 3. Security Scanning

```bash
#!/bin/bash
# scripts/security-scan.sh

# Dependency scanning
npm audit --production
deno lint --rules-exclude=no-explicit-any

# Container scanning
trivy image pitchey-backend:latest

# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.pitchey.com -r security-report.html

# SSL/TLS scan
nmap --script ssl-enum-ciphers -p 443 api.pitchey.com
```

## Maintenance Procedures

### 1. Zero-Downtime Deployments

```bash
#!/bin/bash
# scripts/rolling-update.sh

INSTANCES=(server1 server2 server3)
NEW_VERSION=$1

for instance in "${INSTANCES[@]}"; do
  echo "Updating $instance to version $NEW_VERSION"
  
  # Remove from load balancer
  aws elb deregister-instances-from-load-balancer \
    --load-balancer-name pitchey-lb \
    --instances $instance
  
  # Wait for connections to drain
  sleep 30
  
  # Deploy new version
  ssh $instance "docker pull pitchey-backend:$NEW_VERSION"
  ssh $instance "docker stop pitchey-backend"
  ssh $instance "docker run -d --name pitchey-backend pitchey-backend:$NEW_VERSION"
  
  # Health check
  until curl -f http://$instance:8000/health; do
    sleep 5
  done
  
  # Add back to load balancer
  aws elb register-instances-with-load-balancer \
    --load-balancer-name pitchey-lb \
    --instances $instance
  
  # Wait before next instance
  sleep 60
done
```

### 2. Database Maintenance

```sql
-- Weekly maintenance tasks
-- Run during low-traffic hours

-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex
REINDEX DATABASE pitchey_prod;

-- Update statistics
ANALYZE;

-- Check for bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_dead_tup,
  n_live_tup,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_percentage
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## Disaster Recovery

### 1. DR Plan

#### RTO and RPO Targets
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

#### DR Procedures
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

# 1. Assess damage
echo "Checking primary site status..."
if ! curl -f https://api.pitchey.com/health; then
  echo "Primary site is down. Initiating DR procedures."
  
  # 2. Activate DR site
  echo "Activating DR environment..."
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789 \
    --change-batch file://dr-dns-change.json
  
  # 3. Restore database
  echo "Restoring database from latest backup..."
  aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier pitchey-dr \
    --db-snapshot-identifier pitchey-snapshot-latest
  
  # 4. Start DR applications
  echo "Starting DR application servers..."
  aws ecs update-service \
    --cluster pitchey-dr \
    --service pitchey-backend \
    --desired-count 3
  
  # 5. Verify DR site
  echo "Verifying DR site..."
  until curl -f https://dr.pitchey.com/health; do
    sleep 10
  done
  
  echo "DR site is active. Sending notifications..."
  # Send notifications to stakeholders
fi
```

### 2. Backup Sites

#### Multi-Region Setup
```terraform
# terraform/multi-region.tf
module "us-east-1" {
  source = "./modules/pitchey-infrastructure"
  region = "us-east-1"
  environment = "production"
}

module "us-west-2" {
  source = "./modules/pitchey-infrastructure"
  region = "us-west-2"
  environment = "dr"
}

# Cross-region replication
resource "aws_s3_bucket_replication_configuration" "replication" {
  bucket = module.us-east-1.s3_bucket_id
  
  rule {
    id     = "replicate-to-dr"
    status = "Enabled"
    
    destination {
      bucket        = module.us-west-2.s3_bucket_arn
      storage_class = "STANDARD_IA"
    }
  }
}
```

## Performance Optimization

### 1. Caching Strategy

```typescript
// src/cache/redis-cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttl = 3600
): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

// Cache decorators
export function Cacheable(ttl = 3600) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const key = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      let result = await cacheGet(key);
      if (result) return result;
      
      result = await method.apply(this, args);
      await cacheSet(key, result, ttl);
      
      return result;
    };
  };
}
```

### 2. CDN Configuration

```javascript
// CloudFlare Workers
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Cache static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg)$/)) {
    const cache = caches.default;
    let response = await cache.match(request);
    
    if (!response) {
      response = await fetch(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=31536000");
      
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      
      event.waitUntil(cache.put(request, response.clone()));
    }
    
    return response;
  }
  
  // Pass through dynamic requests
  return fetch(request);
}
```

## Troubleshooting Production Issues

### Common Issues and Solutions

#### 1. High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Find memory leaks
node --inspect=0.0.0.0:9229 multi-portal-server.ts
# Use Chrome DevTools to profile

# Restart with memory limit
node --max-old-space-size=4096 multi-portal-server.ts
```

#### 2. Database Connection Issues
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;
```

#### 3. Slow API Response
```bash
# Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

# Analyze slow queries
EXPLAIN ANALYZE SELECT ...;

# Add missing indexes
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

### Production Debugging

```typescript
// src/debug/production-debug.ts
import { performance } from "perf_hooks";

export function debugEndpoint(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const start = performance.now();
    const requestId = crypto.randomUUID();
    
    logger.info({
      requestId,
      endpoint: propertyName,
      args: args.length,
      timestamp: new Date().toISOString()
    });
    
    try {
      const result = await method.apply(this, args);
      
      const duration = performance.now() - start;
      logger.info({
        requestId,
        endpoint: propertyName,
        duration,
        success: true
      });
      
      // Alert if slow
      if (duration > 1000) {
        logger.warn({
          requestId,
          endpoint: propertyName,
          duration,
          message: "Slow endpoint detected"
        });
      }
      
      return result;
    } catch (error) {
      logger.error({
        requestId,
        endpoint: propertyName,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };
}
```

## Operational Runbook

### Daily Tasks
- [ ] Check system health dashboards
- [ ] Review error logs
- [ ] Monitor disk space
- [ ] Check backup completion
- [ ] Review security alerts

### Weekly Tasks
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review performance metrics
- [ ] Update dependencies
- [ ] Security scanning
- [ ] Backup restoration test

### Monthly Tasks
- [ ] Full system audit
- [ ] Capacity planning review
- [ ] Disaster recovery drill
- [ ] Security patches
- [ ] Cost optimization review

### Incident Response

```markdown
## Incident Response Procedure

1. **Detection**
   - Alert received from monitoring
   - User report
   - Manual discovery

2. **Triage**
   - Severity assessment (P1-P4)
   - Impact analysis
   - Initial diagnosis

3. **Response**
   - Activate incident team
   - Begin mitigation
   - Communicate status

4. **Resolution**
   - Apply fix
   - Verify resolution
   - Monitor for recurrence

5. **Post-Mortem**
   - Root cause analysis
   - Document lessons learned
   - Implement preventive measures
```

## Contact Information

### Escalation Matrix

| Level | Role | Contact | Escalation Time |
|-------|------|---------|-----------------|
| L1 | On-Call Engineer | PagerDuty | Immediate |
| L2 | Team Lead | +1-xxx-xxx-xxxx | 15 minutes |
| L3 | Engineering Manager | +1-xxx-xxx-xxxx | 30 minutes |
| L4 | CTO | +1-xxx-xxx-xxxx | 1 hour |

### External Contacts

- **AWS Support**: Premium support case
- **Database Admin**: dba@pitchey.com
- **Security Team**: security@pitchey.com
- **Legal**: legal@pitchey.com

---

*Last Updated: January 2025*
*Version: 2.0*

For operational support, contact ops@pitchey.com or use PagerDuty for urgent issues.