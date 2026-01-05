# Pitchey Platform: Comprehensive Podman Development Guide

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Why Podman Over Docker](#why-podman-over-docker)
4. [Complete Setup Instructions](#complete-setup-instructions)
5. [Service Configuration Reference](#service-configuration-reference)
6. [Database Management](#database-management)
7. [Development Workflows](#development-workflows)
8. [Portal Separation & Authentication](#portal-separation--authentication)
9. [Production Integration](#production-integration)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Best Practices](#best-practices)
12. [Advanced Configuration](#advanced-configuration)
13. [Performance Optimization](#performance-optimization)
14. [Security Considerations](#security-considerations)
15. [Appendices](#appendices)

---

## Executive Summary

The Pitchey platform local development environment leverages Podman's rootless container technology to provide a secure, production-like development stack. This architecture enables developers to work with full database isolation, local caching, and S3-compatible storage while maintaining complete separation from production systems.

### Key Benefits
- **Zero Production Risk**: Complete isolation from production databases
- **Enhanced Security**: Rootless containers eliminate root privilege escalation risks
- **Rapid Development**: Sub-millisecond local database latency
- **Cost Efficiency**: No cloud resource consumption during development
- **Team Scalability**: Each developer maintains independent environment

### Technology Stack
- **Container Runtime**: Podman 4.x (rootless mode)
- **Database**: PostgreSQL 16 Alpine (local instance)
- **Cache**: Redis 7 Alpine (local instance)
- **Object Storage**: MinIO (R2 simulation)
- **Proxy Server**: Deno Oak (port 8001)
- **Frontend**: Vite + React (port 5173)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Browser    │────▶│   Frontend   │────▶│  Proxy Server│       │
│  │  localhost   │     │   Port 5173  │     │   Port 8001  │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                    │                │
│                                                    ▼                │
│  ┌────────────────────────────────────────────────────────┐       │
│  │              PODMAN CONTAINER NETWORK                   │       │
│  ├────────────────────────────────────────────────────────┤       │
│  │                                                         │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│       │
│  │  │PostgreSQL│  │  Redis   │  │  MinIO   │  │Adminer ││       │
│  │  │  5432    │  │  6379    │  │9000/9001 │  │  8080  ││       │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘│       │
│  └────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ Cloudflare   │────▶│  CF Worker   │────▶│    Neon DB   │       │
│  │   Pages      │     │     API      │     │  PostgreSQL  │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                            │
│                    │ Upstash Redis    │                            │
│                    │ Cloudflare R2    │                            │
│                    └──────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

#### Local Development Flow
1. **Frontend Request** → Vite dev server (5173)
2. **API Call** → Proxy server (8001)
3. **Database Query** → Local PostgreSQL (5432)
4. **Cache Operation** → Local Redis (6379)
5. **File Storage** → MinIO S3 (9000)

#### Production Flow
1. **User Request** → Cloudflare Pages CDN
2. **API Request** → Cloudflare Worker
3. **Database Query** → Neon PostgreSQL (pooled)
4. **Cache Operation** → Upstash Redis (global)
5. **File Storage** → Cloudflare R2

### Key Architecture Decisions

#### Edge-First Design
- **Rationale**: Minimize latency by running compute at edge locations
- **Implementation**: Cloudflare Workers handle all API logic
- **Benefits**: <50ms response times globally

#### Containerized Local Development
- **Rationale**: Ensure consistency across development environments
- **Implementation**: Podman rootless containers
- **Benefits**: Security, isolation, reproducibility

#### Database Strategy
- **Local**: PostgreSQL 16 with full feature parity
- **Production**: Neon serverless PostgreSQL
- **Migration Path**: SQL scripts maintain schema consistency

---

## Why Podman Over Docker

### Security Architecture Comparison

#### Podman Rootless Architecture
```
User Space
├── Podman CLI
├── conmon (container monitor)
└── containers (user namespace)
    ├── PostgreSQL (UID 999)
    ├── Redis (UID 999)
    └── MinIO (UID 1000)

Kernel Space
└── User Namespaces (no root access)
```

#### Docker Daemon Architecture
```
User Space
├── Docker CLI ──────┐
└── Applications     │
                     ▼
System Space    Docker Daemon (root)
├── containerd
└── containers (root namespace)
    └── Potential escalation path
```

### Security Benefits Matrix

| Feature | Podman | Docker | Impact |
|---------|--------|--------|---------|
| **Rootless Containers** | ✅ Default | ❌ Requires configuration | Eliminates root privilege escalation |
| **Daemonless** | ✅ Direct execution | ❌ Daemon required | No single point of failure |
| **User Namespaces** | ✅ Per-container | ⚠️ Shared daemon | Better isolation |
| **SELinux Integration** | ✅ Native support | ⚠️ Manual configuration | Enhanced MAC protection |
| **systemd Integration** | ✅ Direct cgroup management | ❌ Custom cgroup driver | Better resource control |
| **Attack Surface** | Minimal | Larger (daemon) | Reduced vulnerability exposure |

### Performance Characteristics

```
Startup Time Comparison:
├── Podman: ~100ms (direct fork/exec)
├── Docker: ~200ms (daemon communication)
└── Impact: 50% faster container startup

Memory Overhead:
├── Podman: ~10MB per container
├── Docker: ~50MB (daemon) + 10MB per container
└── Impact: Lower memory footprint

CPU Overhead:
├── Podman: <1% (no daemon)
├── Docker: 1-2% (daemon overhead)
└── Impact: More CPU for applications
```

### Operational Advantages

#### 1. No Daemon Management
```bash
# Docker requires daemon management
sudo systemctl start docker
sudo systemctl enable docker
docker ps  # Fails if daemon is down

# Podman works directly
podman ps  # Always works if Podman is installed
```

#### 2. Docker Compatibility
```bash
# Podman provides Docker-compatible CLI
alias docker=podman
docker run nginx  # Works with Podman

# Docker Compose compatibility
podman-compose up  # Direct replacement
```

#### 3. Superior Security Defaults
```yaml
# Podman defaults (secure)
user: "999:999"  # Non-root by default
userns_mode: auto  # User namespace isolation

# Docker defaults (less secure)
user: "root"  # Root by default
privileged: false  # But still runs as root in container
```

---

## Complete Setup Instructions

### Prerequisites Installation

#### Arch Linux (Native)
```bash
# Core Podman installation
sudo pacman -S podman podman-compose

# Optional: Podman Desktop GUI
yay -S podman-desktop-bin

# Additional tools
sudo pacman -S postgresql-client redis
```

#### Ubuntu/Debian
```bash
# Add Podman repository
sudo apt-get update
sudo apt-get -y install podman podman-compose

# PostgreSQL client tools
sudo apt-get -y install postgresql-client redis-tools
```

#### macOS (via Homebrew)
```bash
# Install Podman
brew install podman podman-compose

# Initialize Podman machine
podman machine init --cpus 4 --memory 8192
podman machine start

# Install client tools
brew install postgresql redis
```

#### Windows (via WSL2)
```powershell
# In PowerShell (Admin)
wsl --install -d Ubuntu

# In WSL2 Ubuntu
sudo apt-get update
sudo apt-get install podman podman-compose
```

### System Verification

```bash
#!/bin/bash
# Save as verify-setup.sh

echo "🔍 Verifying Podman Installation..."

# Check Podman version
if command -v podman &> /dev/null; then
    echo "✅ Podman $(podman --version)"
else
    echo "❌ Podman not found"
    exit 1
fi

# Check Podman Compose
if command -v podman-compose &> /dev/null; then
    echo "✅ Podman Compose $(podman-compose --version)"
else
    echo "❌ Podman Compose not found"
    exit 1
fi

# Check rootless mode
if [[ $(id -u) -ne 0 ]]; then
    echo "✅ Running in rootless mode (UID: $(id -u))"
else
    echo "⚠️  Running as root - consider rootless mode"
fi

# Check subuid/subgid configuration
if [[ -f /etc/subuid ]] && grep -q "$(whoami)" /etc/subuid; then
    echo "✅ User namespaces configured"
else
    echo "⚠️  User namespaces may not be configured"
fi

# Check cgroup version
CGROUP_VERSION=$(stat -fc %T /sys/fs/cgroup/)
if [[ "$CGROUP_VERSION" == "cgroup2fs" ]]; then
    echo "✅ Using cgroup v2 (recommended)"
else
    echo "⚠️  Using cgroup v1 (consider upgrading)"
fi

echo ""
echo "🎉 System ready for Podman development!"
```

### Initial Project Setup

```bash
#!/bin/bash
# Complete setup script

# 1. Clone repository
git clone https://github.com/your-org/pitchey.git
cd pitchey/pitchey_v0.2

# 2. Create local environment file
cp .env.local.example .env.local

# 3. Make scripts executable
chmod +x podman-local.sh setup-local-dev.sh

# 4. Start Podman services
./podman-local.sh start

# 5. Wait for services
echo "Waiting for services to initialize..."
sleep 10

# 6. Verify services
./podman-local.sh status

# 7. Initialize database
./podman-local.sh seed

# 8. Create MinIO buckets
podman exec -it $(podman ps -q -f name=minio) \
    mc alias set local http://localhost:9000 minioadmin minioadmin

podman exec -it $(podman ps -q -f name=minio) \
    mc mb local/pitchey-uploads --ignore-existing

# 9. Install frontend dependencies
cd frontend
npm install
cd ..

# 10. Start development servers
echo ""
echo "✅ Setup complete! Start development with:"
echo "   Terminal 1: PORT=8001 deno run --allow-all working-server.ts"
echo "   Terminal 2: cd frontend && npm run dev"
```

---

## Service Configuration Reference

### PostgreSQL Configuration

#### Container Specification
```yaml
postgres:
  image: docker.io/postgres:16-alpine
  environment:
    POSTGRES_USER: pitchey_dev
    POSTGRES_PASSWORD: localdev123
    POSTGRES_DB: pitchey_local
    POSTGRES_MAX_CONNECTIONS: 100
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
    POSTGRES_MAINTENANCE_WORK_MEM: 64MB
    POSTGRES_CHECKPOINT_COMPLETION_TARGET: 0.9
    POSTGRES_WAL_BUFFERS: 16MB
    POSTGRES_DEFAULT_STATISTICS_TARGET: 100
    POSTGRES_RANDOM_PAGE_COST: 1.1
    POSTGRES_EFFECTIVE_IO_CONCURRENCY: 200
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./src/db/migrations:/docker-entrypoint-initdb.d:Z
  user: "999:999"  # PostgreSQL user
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U pitchey_dev"]
    interval: 10s
    timeout: 5s
    retries: 5
```

#### Performance Tuning
```sql
-- Local development optimizations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '2GB';

-- Apply changes
SELECT pg_reload_conf();
```

### Redis Configuration

#### Container Specification
```yaml
redis:
  image: docker.io/redis:7-alpine
  ports:
    - "6379:6379"
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --tcp-keepalive 60
    --timeout 300
    --databases 16
  volumes:
    - redis_data:/data
  user: "999:999"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

#### Redis Configuration File
```conf
# /data/redis.conf
bind 0.0.0.0
protected-mode no
port 6379
tcp-backlog 511
timeout 300
tcp-keepalive 60

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile ""
databases 16

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### MinIO Configuration

#### Container Specification
```yaml
minio:
  image: docker.io/minio/minio:latest
  ports:
    - "9000:9000"  # API
    - "9001:9001"  # Console
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
    MINIO_BROWSER_REDIRECT_URL: http://localhost:9001
    MINIO_DOMAIN: localhost
    MINIO_SERVER_URL: http://localhost:9000
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  user: "1000:1000"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

#### Bucket Initialization
```bash
#!/bin/bash
# Initialize MinIO buckets

# Wait for MinIO
until curl -f http://localhost:9000/minio/health/live; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Configure MinIO client
podman run --rm --network host \
  minio/mc alias set local http://localhost:9000 minioadmin minioadmin

# Create buckets
podman run --rm --network host minio/mc mb local/pitchey-uploads
podman run --rm --network host minio/mc mb local/pitchey-documents
podman run --rm --network host minio/mc mb local/pitchey-media

# Set bucket policies
podman run --rm --network host minio/mc policy set public local/pitchey-media

echo "✅ MinIO buckets initialized"
```

### Adminer Configuration

#### Container Specification
```yaml
adminer:
  image: docker.io/adminer:latest
  ports:
    - "8080:8080"
  environment:
    ADMINER_DEFAULT_SERVER: postgres
    ADMINER_DESIGN: pepa-linha
    ADMINER_PLUGINS: tables-filter tinymce
  depends_on:
    - postgres
  user: "1000:1000"
```

---

## Database Management

### Schema Migration Strategy

#### Migration Workflow
```
1. Development Migration
   └── Create in src/db/migrations/
       └── Test locally with Podman PostgreSQL
           └── Apply to staging
               └── Apply to production

2. Rollback Strategy
   └── Each migration has corresponding rollback
       └── Version control tracks all changes
           └── Point-in-time recovery available
```

#### Migration File Structure
```
src/db/migrations/
├── 001_initial_schema.sql
├── 001_initial_schema.rollback.sql
├── 002_add_users_table.sql
├── 002_add_users_table.rollback.sql
├── 003_add_performance_indexes.sql
├── 003_add_performance_indexes.rollback.sql
└── seed_demo_data.sql
```

### Database Seeding

#### Demo Data Script
```sql
-- seed_demo_data.sql
BEGIN;

-- Create demo users for each portal
INSERT INTO users (
    email, username, user_type, company_name, 
    bio, is_active, email_verified, created_at
) VALUES
    -- Creator accounts
    ('alex.creator@demo.com', 'alexcreator', 'creator', 
     'Creative Studios', 'Award-winning filmmaker with 10+ years experience', 
     true, true, NOW() - INTERVAL '6 months'),
    
    ('emma.writer@demo.com', 'emmawriter', 'creator',
     'StoryForge Productions', 'Screenwriter specializing in sci-fi and thriller',
     true, true, NOW() - INTERVAL '4 months'),
    
    -- Investor accounts
    ('sarah.investor@demo.com', 'sarahinvestor', 'investor',
     'Venture Capital LLC', 'Angel investor focused on media and entertainment',
     true, true, NOW() - INTERVAL '1 year'),
    
    ('michael.fund@demo.com', 'michaelfund', 'investor',
     'MediaVentures Fund', 'Managing partner at media-focused VC firm',
     true, true, NOW() - INTERVAL '8 months'),
    
    -- Production company accounts
    ('stellar.production@demo.com', 'stellarprod', 'production',
     'Stellar Productions', 'Full-service production company',
     true, true, NOW() - INTERVAL '2 years'),
    
    ('global.films@demo.com', 'globalfilms', 'production',
     'Global Films International', 'International distribution and production',
     true, true, NOW() - INTERVAL '18 months')
ON CONFLICT (email) DO NOTHING;

-- Create sample pitches
INSERT INTO pitches (
    title, tagline, genre, budget_range, target_audience,
    logline, status, visibility, creator_id, created_at
)
SELECT 
    'The Last Algorithm' AS title,
    'When AI becomes conscious' AS tagline,
    'Sci-Fi' AS genre,
    '5M-10M' AS budget_range,
    '18-35' AS target_audience,
    'A programmer discovers their AI has achieved consciousness...' AS logline,
    'published' AS status,
    'public' AS visibility,
    id AS creator_id,
    NOW() - INTERVAL '2 months' AS created_at
FROM users WHERE email = 'alex.creator@demo.com'

UNION ALL

SELECT 
    'Green Valley' AS title,
    'A sustainable future documentary' AS tagline,
    'Documentary' AS genre,
    '500K-1M' AS budget_range,
    'All ages' AS target_audience,
    'Exploring innovative solutions to climate change...' AS logline,
    'published' AS status,
    'public' AS visibility,
    id AS creator_id,
    NOW() - INTERVAL '1 month' AS created_at
FROM users WHERE email = 'emma.writer@demo.com';

-- Create NDAs
INSERT INTO ndas (user_id, pitch_id, status, signed_at)
SELECT 
    u.id AS user_id,
    p.id AS pitch_id,
    'signed' AS status,
    NOW() - INTERVAL '1 week' AS signed_at
FROM users u
CROSS JOIN pitches p
WHERE u.user_type = 'investor'
AND p.title = 'The Last Algorithm'
LIMIT 2;

-- Create sample investments
INSERT INTO investments (
    investor_id, pitch_id, amount, status, created_at
)
SELECT 
    u.id AS investor_id,
    p.id AS pitch_id,
    250000 AS amount,
    'committed' AS status,
    NOW() - INTERVAL '3 days' AS created_at
FROM users u
CROSS JOIN pitches p
WHERE u.email = 'sarah.investor@demo.com'
AND p.title = 'The Last Algorithm';

-- Create notifications
INSERT INTO notifications (
    user_id, type, title, message, read, created_at
)
SELECT 
    id AS user_id,
    'welcome' AS type,
    'Welcome to Pitchey!' AS title,
    'Start exploring amazing movie pitches' AS message,
    false AS read,
    created_at
FROM users;

COMMIT;

-- Verify seeding
SELECT 'Users:' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'Pitches:', COUNT(*) FROM pitches
UNION ALL
SELECT 'NDAs:', COUNT(*) FROM ndas
UNION ALL
SELECT 'Investments:', COUNT(*) FROM investments
UNION ALL
SELECT 'Notifications:', COUNT(*) FROM notifications;
```

### Database Backup & Restore

#### Local Backup Strategy
```bash
#!/bin/bash
# backup-local-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Full database backup
PGPASSWORD=localdev123 pg_dump \
  -h localhost \
  -U pitchey_dev \
  -d pitchey_local \
  -f "$BACKUP_DIR/pitchey_local_$TIMESTAMP.sql"

# Compress backup
gzip "$BACKUP_DIR/pitchey_local_$TIMESTAMP.sql"

echo "✅ Backup created: $BACKUP_DIR/pitchey_local_$TIMESTAMP.sql.gz"

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

#### Restore Procedure
```bash
#!/bin/bash
# restore-local-db.sh

if [ -z "$1" ]; then
  echo "Usage: ./restore-local-db.sh backup_file.sql.gz"
  exit 1
fi

BACKUP_FILE=$1

# Stop application
echo "⚠️  Stopping application servers..."

# Drop and recreate database
PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -c "DROP DATABASE IF EXISTS pitchey_local;"
PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -c "CREATE DATABASE pitchey_local;"

# Restore from backup
gunzip -c $BACKUP_FILE | PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local

echo "✅ Database restored from $BACKUP_FILE"
```

---

## Development Workflows

### Daily Development Workflow

#### Morning Startup Routine
```bash
#!/bin/bash
# start-dev-day.sh

echo "🌅 Starting development environment..."

# 1. Pull latest changes
git pull origin main

# 2. Start Podman services
./podman-local.sh start

# 3. Check service health
./podman-local.sh status

# 4. Run any pending migrations
for migration in src/db/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Applying migration: $migration"
    PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local < "$migration" 2>/dev/null || true
  fi
done

# 5. Start backend proxy
PORT=8001 deno run --allow-all working-server.ts &
BACKEND_PID=$!

# 6. Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ Development environment ready!"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo "   Frontend: http://localhost:5173"
echo "   Backend: http://localhost:8001"
echo "   Database: localhost:5432"
```

### Feature Development Workflow

#### 1. Create Feature Branch
```bash
# Create feature branch
git checkout -b feature/new-pitch-workflow

# Start clean environment
./podman-local.sh reset
./podman-local.sh start
./podman-local.sh seed
```

#### 2. Database Schema Changes
```bash
# Create migration file
cat > src/db/migrations/004_add_pitch_reviews.sql << 'EOF'
CREATE TABLE pitch_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pitch_reviews_pitch ON pitch_reviews(pitch_id);
CREATE INDEX idx_pitch_reviews_reviewer ON pitch_reviews(reviewer_id);
EOF

# Apply migration locally
PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local < src/db/migrations/004_add_pitch_reviews.sql
```

#### 3. API Development
```typescript
// src/handlers/pitch-reviews.ts
import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { query } from "../db/client.ts";

export async function createPitchReview(ctx: Context) {
  const { pitchId, rating, comment } = await ctx.request.body().value;
  const userId = ctx.state.user.id;

  const result = await query(`
    INSERT INTO pitch_reviews (pitch_id, reviewer_id, rating, comment)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [pitchId, userId, rating, comment]);

  ctx.response.body = { success: true, review: result.rows[0] };
}

export async function getPitchReviews(ctx: Context) {
  const pitchId = ctx.params.pitchId;
  
  const result = await query(`
    SELECT pr.*, u.username, u.avatar_url
    FROM pitch_reviews pr
    JOIN users u ON pr.reviewer_id = u.id
    WHERE pr.pitch_id = $1
    ORDER BY pr.created_at DESC
  `, [pitchId]);

  ctx.response.body = { reviews: result.rows };
}
```

#### 4. Frontend Development
```tsx
// frontend/src/components/PitchReviews.tsx
import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface Review {
  id: string;
  rating: number;
  comment: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
}

export const PitchReviews: React.FC<{ pitchId: string }> = ({ pitchId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    loadReviews();
  }, [pitchId]);

  const loadReviews = async () => {
    const response = await api.get(`/api/pitches/${pitchId}/reviews`);
    setReviews(response.data.reviews);
  };

  const submitReview = async () => {
    await api.post(`/api/pitches/${pitchId}/reviews`, newReview);
    await loadReviews();
    setNewReview({ rating: 5, comment: '' });
  };

  return (
    <div className="pitch-reviews">
      {/* Review form */}
      <div className="review-form">
        <select 
          value={newReview.rating} 
          onChange={(e) => setNewReview({
            ...newReview, 
            rating: parseInt(e.target.value)
          })}
        >
          {[1,2,3,4,5].map(r => (
            <option key={r} value={r}>{r} Stars</option>
          ))}
        </select>
        <textarea
          placeholder="Write your review..."
          value={newReview.comment}
          onChange={(e) => setNewReview({
            ...newReview,
            comment: e.target.value
          })}
        />
        <button onClick={submitReview}>Submit Review</button>
      </div>

      {/* Reviews list */}
      <div className="reviews-list">
        {reviews.map(review => (
          <div key={review.id} className="review">
            <div className="review-header">
              <img src={review.avatarUrl} alt={review.username} />
              <span>{review.username}</span>
              <span>{'⭐'.repeat(review.rating)}</span>
            </div>
            <p>{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Testing Workflow

#### Unit Testing
```bash
#!/bin/bash
# run-tests.sh

echo "🧪 Running test suite..."

# Backend tests
echo "Backend Tests:"
deno test --allow-all src/

# Frontend tests
echo "Frontend Tests:"
cd frontend
npm test
cd ..

# Database tests
echo "Database Tests:"
PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local << 'EOF'
-- Test constraints
DO $$
BEGIN
  -- Test unique email constraint
  BEGIN
    INSERT INTO users (email) VALUES ('test@test.com');
    INSERT INTO users (email) VALUES ('test@test.com');
    RAISE EXCEPTION 'Unique constraint test failed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint test passed';
  END;

  -- Test foreign key constraint
  BEGIN
    INSERT INTO pitches (creator_id) VALUES ('invalid-uuid');
    RAISE EXCEPTION 'Foreign key constraint test failed';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key constraint test passed';
  END;
END $$;
EOF
```

#### Integration Testing
```typescript
// tests/integration/pitch-workflow.test.ts
import { assertEquals } from "https://deno.land/std@0.210.0/testing/asserts.ts";

Deno.test("Complete pitch workflow", async () => {
  // 1. Create user
  const userResponse = await fetch("http://localhost:8001/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      password: "Test123!",
      userType: "creator"
    })
  });
  const { user } = await userResponse.json();

  // 2. Create pitch
  const pitchResponse = await fetch("http://localhost:8001/api/pitches", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": userResponse.headers.get("set-cookie")
    },
    body: JSON.stringify({
      title: "Test Pitch",
      tagline: "A test movie",
      genre: "Drama",
      logline: "Test logline"
    })
  });
  const { pitch } = await pitchResponse.json();

  // 3. Verify pitch
  assertEquals(pitch.title, "Test Pitch");
  assertEquals(pitch.creator_id, user.id);
});
```

---

## Portal Separation & Authentication

### Portal Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   UNIFIED AUTHENTICATION                  │
│                     (Better Auth)                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Session-Based Authentication (HTTP-only cookies)        │
│  ├── No JWT tokens in headers                           │
│  ├── CSRF protection built-in                           │
│  └── Automatic session refresh                          │
│                                                          │
└─────────────┬──────────────┬──────────────┬────────────┘
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   Creator   │  │  Investor   │  │ Production  │
    │   Portal    │  │   Portal    │  │   Portal    │
    ├─────────────┤  ├─────────────┤  ├─────────────┤
    │ /creator/*  │  │ /investor/* │  │/production/*│
    │             │  │             │  │             │
    │ Features:   │  │ Features:   │  │ Features:   │
    │ • Pitches   │  │ • Browse    │  │ • Scout     │
    │ • Analytics │  │ • Invest    │  │ • Partner   │
    │ • Messages  │  │ • Portfolio │  │ • Produce   │
    └─────────────┘  └─────────────┘  └─────────────┘
```

### Authentication Flow

#### 1. Sign Up Flow
```typescript
// Frontend: Sign up new user
const signUp = async (userData: SignUpData) => {
  const response = await fetch('/api/auth/sign-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Important for cookies
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      userType: userData.portal,  // 'creator' | 'investor' | 'production'
      companyName: userData.companyName,
      username: userData.username
    })
  });
  
  if (response.ok) {
    // Session cookie automatically set
    // Redirect to appropriate portal
    window.location.href = `/${userData.portal}/dashboard`;
  }
};
```

#### 2. Sign In Flow
```typescript
// Frontend: Sign in existing user
const signIn = async (credentials: SignInData) => {
  const response = await fetch('/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Include cookies
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password
    })
  });
  
  if (response.ok) {
    const { user } = await response.json();
    // Redirect based on user type
    window.location.href = `/${user.userType}/dashboard`;
  }
};
```

#### 3. Session Management
```typescript
// Frontend: Check session status
const checkSession = async () => {
  const response = await fetch('/api/auth/session', {
    credentials: 'include'
  });
  
  if (response.ok) {
    const session = await response.json();
    return session;
  }
  return null;
};

// Frontend: Refresh session
const refreshSession = async () => {
  const response = await fetch('/api/auth/session/refresh', {
    method: 'POST',
    credentials: 'include'
  });
  return response.ok;
};

// Frontend: Sign out
const signOut = async () => {
  await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include'
  });
  window.location.href = '/';
};
```

### Portal Routing

#### Frontend Route Protection
```tsx
// frontend/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedPortals: ('creator' | 'investor' | 'production')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedPortals 
}) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedPortals.includes(user.userType)) {
    return <Navigate to={`/${user.userType}/dashboard`} />;
  }

  return <>{children}</>;
};

// Usage in App.tsx
<Routes>
  {/* Creator Portal */}
  <Route path="/creator/*" element={
    <ProtectedRoute allowedPortals={['creator']}>
      <CreatorPortal />
    </ProtectedRoute>
  } />

  {/* Investor Portal */}
  <Route path="/investor/*" element={
    <ProtectedRoute allowedPortals={['investor']}>
      <InvestorPortal />
    </ProtectedRoute>
  } />

  {/* Production Portal */}
  <Route path="/production/*" element={
    <ProtectedRoute allowedPortals={['production']}>
      <ProductionPortal />
    </ProtectedRoute>
  } />
</Routes>
```

### Demo User Configuration

#### Local Demo Users
```bash
# Demo credentials (all passwords: Demo123)
CREATORS:
- alex.creator@demo.com (Main creator account)
- emma.writer@demo.com (Secondary creator)

INVESTORS:
- sarah.investor@demo.com (Main investor account)
- michael.fund@demo.com (Secondary investor)

PRODUCTION:
- stellar.production@demo.com (Main production account)
- global.films@demo.com (Secondary production)
```

#### Quick Login Script
```typescript
// frontend/src/utils/demo-login.ts
export const demoUsers = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    portal: 'creator'
  },
  investor: {
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    portal: 'investor'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    portal: 'production'
  }
};

// Quick login function for development
export const quickLogin = async (userType: keyof typeof demoUsers) => {
  const user = demoUsers[userType];
  await signIn(user);
};
```

---

## Production Integration

### Hybrid Development Model

```
┌─────────────────────────────────────────────────────────┐
│                  DEVELOPMENT MODES                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. FULL LOCAL MODE                                     │
│     └── All services in Podman                         │
│         └── Complete isolation                         │
│                                                          │
│  2. HYBRID MODE (Recommended)                           │
│     └── Local database + production API                 │
│         └── Real API testing with safe data            │
│                                                          │
│  3. PRODUCTION PROXY MODE                               │
│     └── All production services                         │
│         └── Read-only testing                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Environment Configuration

#### Full Local Mode (.env.local)
```bash
# Complete local isolation
DATABASE_URL="postgresql://pitchey_dev:localdev123@localhost:5432/pitchey_local"
REDIS_HOST="localhost"
REDIS_PORT="6379"
R2_ENDPOINT="http://localhost:9000"
R2_ACCESS_KEY="minioadmin"
R2_SECRET_KEY="minioadmin"
VITE_API_URL="http://localhost:8001"
VITE_WS_URL="ws://localhost:8001"
ENVIRONMENT="local"
```

#### Hybrid Mode (.env.hybrid)
```bash
# Local database, production API
DATABASE_URL="postgresql://pitchey_dev:localdev123@localhost:5432/pitchey_local"
REDIS_HOST="localhost"
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
VITE_API_URL="http://localhost:8001"  # Proxy to production
ENVIRONMENT="hybrid"
```

#### Production Proxy Mode (.env.proxy)
```bash
# All production services (read-only)
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
VITE_API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
ENVIRONMENT="proxy"
READ_ONLY="true"
```

### Deployment Pipeline

#### Local to Production Flow
```bash
#!/bin/bash
# deploy-to-production.sh

# 1. Run tests locally
./run-tests.sh || exit 1

# 2. Build frontend
cd frontend
npm run build
cd ..

# 3. Deploy to staging
wrangler deploy --env staging

# 4. Run staging tests
npm run test:staging

# 5. Deploy frontend to Cloudflare Pages
wrangler pages deploy frontend/dist --project-name=pitchey

# 6. Deploy worker to production
wrangler deploy --env production

echo "✅ Deployed to production"
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Permission Denied Errors

**Problem**: Container fails to write to volumes
```
Error: EACCES: permission denied, open '/data/file'
```

**Solution**:
```bash
# Fix volume permissions
podman unshare chown -R 999:999 ./postgres_data
podman unshare chown -R 999:999 ./redis_data
podman unshare chown -R 1000:1000 ./minio_data

# Or use proper user mapping
podman run --userns=keep-id:uid=999,gid=999 postgres:16
```

#### 2. Port Already in Use

**Problem**: Cannot bind to port
```
Error: bind: address already in use
```

**Solution**:
```bash
# Find process using port
sudo ss -tulpn | grep :5432
sudo lsof -i :5432

# Stop conflicting service
sudo systemctl stop postgresql
# Or kill specific process
kill -9 <PID>

# Use different port
podman run -p 5433:5432 postgres:16
```

#### 3. Container Network Issues

**Problem**: Containers cannot communicate
```
Error: could not connect to server: Connection refused
```

**Solution**:
```bash
# Use container names as hostnames
DATABASE_HOST=postgres  # Not localhost
REDIS_HOST=redis       # Not localhost

# Or use host network mode
podman-compose --podman-run-args="--network=host" up

# Check network
podman network ls
podman network inspect podman
```

#### 4. Database Connection Failures

**Problem**: Cannot connect to PostgreSQL
```
Error: FATAL: password authentication failed
```

**Solution**:
```bash
# Verify credentials
podman exec -it postgres psql -U pitchey_dev -d pitchey_local

# Check PostgreSQL logs
podman logs postgres

# Reset password
podman exec -it postgres psql -U postgres -c "ALTER USER pitchey_dev PASSWORD 'localdev123';"
```

#### 5. SELinux Context Issues (Fedora/RHEL)

**Problem**: SELinux blocking container access
```
Error: SELinux is preventing container from read access
```

**Solution**:
```bash
# Add :Z flag to volumes
volumes:
  - ./data:/data:Z  # Private unshared label
  - ./data:/data:z  # Shared label

# Or temporarily disable SELinux (not recommended)
sudo setenforce 0
```

#### 6. Podman Machine Issues (macOS/Windows)

**Problem**: Podman machine not starting
```
Error: machine podman-machine-default: VM already exists
```

**Solution**:
```bash
# Reset Podman machine
podman machine stop
podman machine rm
podman machine init --cpus 4 --memory 8192
podman machine start

# Check status
podman machine ls
podman machine ssh
```

#### 7. Memory/Resource Limits

**Problem**: Container killed due to OOM
```
Error: Container killed due to OOMKilled
```

**Solution**:
```bash
# Increase memory limits
podman run --memory=2g --memory-swap=4g postgres:16

# Check current limits
podman stats

# System-wide limits
cat /proc/sys/vm/overcommit_memory
echo 1 > /proc/sys/vm/overcommit_memory
```

### Debugging Commands

```bash
# Container inspection
podman inspect <container>
podman logs -f <container>
podman exec -it <container> sh

# Network debugging
podman network inspect podman
podman port <container>

# Volume debugging
podman volume ls
podman volume inspect <volume>

# Process debugging
podman top <container>
podman stats

# System information
podman info
podman system df
podman system prune -a
```

---

## Best Practices

### Container Management

#### 1. Resource Limits
```yaml
# Always set resource limits
services:
  postgres:
    mem_limit: 1g
    memswap_limit: 2g
    cpus: 2.0
    cpu_shares: 1024
```

#### 2. Health Checks
```yaml
# Implement comprehensive health checks
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U pitchey_dev"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

#### 3. Volume Management
```bash
# Regular cleanup
podman volume prune -f

# Backup before cleanup
podman run --rm -v postgres_data:/data \
  -v ./backups:/backup \
  alpine tar czf /backup/postgres_data.tar.gz /data
```

### Security Best Practices

#### 1. Secrets Management
```bash
# Never commit secrets
echo ".env.local" >> .gitignore
echo "*.secret" >> .gitignore

# Use environment files
podman run --env-file=.env.local postgres:16

# Or use Podman secrets
echo "localdev123" | podman secret create postgres_password -
podman run --secret postgres_password postgres:16
```

#### 2. Network Isolation
```yaml
# Create custom networks
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access
```

#### 3. User Namespace Mapping
```bash
# Configure user namespaces
echo "$(whoami):100000:65536" | sudo tee /etc/subuid
echo "$(whoami):100000:65536" | sudo tee /etc/subgid

# Run with user namespaces
podman run --userns=auto postgres:16
```

### Development Best Practices

#### 1. Consistent Environments
```bash
# Lock versions
podman pull postgres:16.1-alpine
podman pull redis:7.2-alpine
podman pull minio/minio:RELEASE.2024-01-01T00-00-00Z

# Save image digests
podman images --digests > images.lock
```

#### 2. Automated Setup
```bash
# Makefile for common tasks
.PHONY: setup start stop clean test

setup:
	./setup-local-dev.sh

start:
	./podman-local.sh start

stop:
	./podman-local.sh stop

clean:
	./podman-local.sh reset

test:
	./run-tests.sh
```

#### 3. Documentation
```markdown
# Document custom configuration
## Custom PostgreSQL Settings
- max_connections: 100 (for development load)
- shared_buffers: 256MB (1/4 of container memory)
- work_mem: 4MB (for complex queries)

## Redis Configuration
- maxmemory: 256mb (sufficient for dev cache)
- maxmemory-policy: allkeys-lru
```

---

## Advanced Configuration

### Performance Optimization

#### PostgreSQL Tuning
```sql
-- Development performance settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD optimization
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;

-- Connection pooling
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET superuser_reserved_connections = 3;

-- Logging for development
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log slow queries

SELECT pg_reload_conf();
```

#### Redis Optimization
```conf
# redis.conf optimizations
maxmemory 256mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence settings
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# Performance tuning
tcp-keepalive 60
timeout 0
databases 16
slowlog-log-slower-than 10000
slowlog-max-len 128

# Threading
io-threads 4
io-threads-do-reads yes
```

### Monitoring Setup

#### Prometheus Integration
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: "postgresql://pitchey_dev:localdev123@postgres:5432/pitchey_local?sslmode=disable"
    ports:
      - "9187:9187"

  redis-exporter:
    image: oliver006/redis_exporter
    environment:
      REDIS_ADDR: "redis://redis:6379"
    ports:
      - "9121:9121"
```

#### Logging Configuration
```yaml
# Centralized logging
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail.yml:/etc/promtail/promtail.yml
```

---

## Security Considerations

### Container Security Checklist

#### Build-Time Security
```dockerfile
# Secure Dockerfile practices
FROM postgres:16-alpine AS base

# Don't run as root
USER postgres

# Minimize attack surface
RUN apk add --no-cache \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy only necessary files
COPY --chown=postgres:postgres init.sql /docker-entrypoint-initdb.d/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD pg_isready -U postgres || exit 1
```

#### Runtime Security
```bash
# Security scanning
podman run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image postgres:16-alpine

# Read-only containers
podman run --read-only \
    --tmpfs /tmp \
    --tmpfs /var/run/postgresql \
    postgres:16

# Drop capabilities
podman run --cap-drop=ALL \
    --cap-add=CHOWN \
    --cap-add=DAC_OVERRIDE \
    --cap-add=FOWNER \
    --cap-add=SETGID \
    --cap-add=SETUID \
    postgres:16

# Security options
podman run --security-opt no-new-privileges:true \
    --security-opt seccomp=./seccomp.json \
    postgres:16
```

### Network Security

#### Firewall Configuration
```bash
# UFW configuration (Ubuntu)
sudo ufw allow from 172.16.0.0/12 to any port 5432  # PostgreSQL
sudo ufw allow from 172.16.0.0/12 to any port 6379  # Redis
sudo ufw allow from 172.16.0.0/12 to any port 9000  # MinIO

# iptables (manual)
iptables -A INPUT -p tcp --dport 5432 -s 172.16.0.0/12 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

#### TLS Configuration
```yaml
# TLS for PostgreSQL
services:
  postgres:
    environment:
      POSTGRES_SSL_MODE: require
    volumes:
      - ./certs/server.crt:/var/lib/postgresql/server.crt:ro
      - ./certs/server.key:/var/lib/postgresql/server.key:ro
    command: >
      postgres
      -c ssl=on
      -c ssl_cert_file=/var/lib/postgresql/server.crt
      -c ssl_key_file=/var/lib/postgresql/server.key
```

---

## Appendices

### Appendix A: Environment Variables Reference

```bash
# Database Configuration
DATABASE_URL              # PostgreSQL connection string
DATABASE_HOST             # Database host (default: localhost)
DATABASE_PORT             # Database port (default: 5432)
DATABASE_USER             # Database user
DATABASE_PASSWORD         # Database password
DATABASE_NAME             # Database name
DATABASE_SSL_MODE         # SSL mode (disable|require|verify-full)

# Redis Configuration
REDIS_HOST               # Redis host (default: localhost)
REDIS_PORT               # Redis port (default: 6379)
REDIS_PASSWORD           # Redis password (optional)
REDIS_DB                 # Redis database number (default: 0)
CACHE_ENABLED            # Enable caching (true|false)
CACHE_TTL                # Cache TTL in seconds

# MinIO/S3 Configuration
R2_ENDPOINT              # S3-compatible endpoint
R2_ACCESS_KEY            # Access key
R2_SECRET_KEY            # Secret key
R2_BUCKET                # Default bucket name
R2_REGION                # AWS region (for S3)
R2_USE_SSL               # Use HTTPS (true|false)

# Application Configuration
VITE_API_URL             # Backend API URL
VITE_WS_URL              # WebSocket URL
NODE_ENV                 # Node environment (development|production)
ENVIRONMENT              # Environment name (local|staging|production)
PORT                     # Server port
FRONTEND_URL             # Frontend URL for CORS

# Authentication
JWT_SECRET               # JWT signing secret
BETTER_AUTH_SECRET       # Better Auth secret
BETTER_AUTH_URL          # Better Auth URL
SESSION_DURATION         # Session duration in seconds

# Feature Flags
ENABLE_WEBSOCKETS        # Enable WebSocket support
ENABLE_ANALYTICS         # Enable analytics
ENABLE_DEBUG_LOGGING     # Enable debug logs
READ_ONLY_MODE          # Enable read-only mode
```

### Appendix B: Database Schema

```sql
-- Core Tables Structure
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    user_type VARCHAR(50) NOT NULL,
    company_name VARCHAR(255),
    bio TEXT,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    tagline VARCHAR(500),
    genre VARCHAR(100),
    budget_range VARCHAR(50),
    target_audience VARCHAR(255),
    logline TEXT,
    synopsis TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    visibility VARCHAR(50) DEFAULT 'private',
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

CREATE TABLE ndas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    signed_at TIMESTAMP,
    document_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, pitch_id)
);

CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'pending',
    terms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add more tables as needed...
```

### Appendix C: Quick Reference Commands

```bash
# Service Management
./podman-local.sh start         # Start all services
./podman-local.sh stop          # Stop all services
./podman-local.sh reset         # Reset all data
./podman-local.sh status        # Check status
./podman-local.sh logs [service] # View logs
./podman-local.sh seed          # Seed database
./podman-local.sh shell [service] # Enter shell

# Database Operations
psql -h localhost -U pitchey_dev -d pitchey_local  # Connect to DB
pg_dump -h localhost -U pitchey_dev pitchey_local > backup.sql  # Backup
psql -h localhost -U pitchey_dev pitchey_local < backup.sql  # Restore

# Redis Operations
redis-cli -h localhost  # Connect to Redis
redis-cli FLUSHALL     # Clear all data
redis-cli INFO         # Get info

# MinIO Operations
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local/           # List buckets
mc mb local/bucket    # Create bucket
mc cp file.txt local/bucket/  # Upload file

# Container Operations
podman ps              # List running containers
podman logs -f <name>  # Follow logs
podman exec -it <name> sh  # Enter container
podman stats          # Resource usage
podman system prune -a # Clean everything

# Development Workflow
git checkout -b feature/new-feature
./podman-local.sh reset && ./podman-local.sh start
PORT=8001 deno run --allow-all working-server.ts &
cd frontend && npm run dev
```

### Appendix D: Migration from Docker

```bash
#!/bin/bash
# migrate-from-docker.sh

echo "Migrating from Docker to Podman..."

# 1. Export Docker images
docker save postgres:16-alpine > postgres.tar
docker save redis:7-alpine > redis.tar
docker save minio/minio > minio.tar

# 2. Import to Podman
podman load < postgres.tar
podman load < redis.tar
podman load < minio.tar

# 3. Export Docker volumes
docker run --rm -v postgres_data:/data \
    -v $(pwd)/backup:/backup \
    alpine tar czf /backup/postgres_data.tar.gz /data

# 4. Import to Podman volumes
podman volume create postgres_data
podman run --rm -v postgres_data:/data \
    -v $(pwd)/backup:/backup \
    alpine tar xzf /backup/postgres_data.tar.gz -C /

# 5. Update compose files
sed -i 's/docker-compose/podman-compose/g' *.sh
sed -i 's/docker /podman /g' *.sh

echo "✅ Migration complete!"
```

---

## Conclusion

This comprehensive Podman development environment provides a secure, efficient, and production-like platform for developing the Pitchey application. By leveraging rootless containers, developers gain enhanced security without sacrificing functionality or performance.

### Key Achievements
- **Security**: Rootless containers eliminate privilege escalation risks
- **Isolation**: Complete separation from production systems
- **Performance**: Local services provide sub-millisecond latency
- **Flexibility**: Support for local, hybrid, and proxy development modes
- **Reproducibility**: Consistent environments across all team members

### Next Steps
1. Set up your local environment using the provided scripts
2. Familiarize yourself with the portal-specific workflows
3. Review the security best practices
4. Contribute improvements to this documentation

### Support Resources
- **Documentation**: `/docs` folder in the repository
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Wiki**: Project wiki for additional guides

---

*Document Version: 1.0.0*  
*Last Updated: January 2025*  
*Platform: Pitchey Movie Pitch Platform*  
*Environment: Podman Rootless Containers*