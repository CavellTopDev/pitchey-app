# 🐳 Podman Setup for Pitchey Local Development

## Why Podman?
- **Rootless containers** - Better security than Docker
- **No daemon required** - Direct container execution
- **Docker-compatible** - Works with docker-compose files
- **Open source** - No licensing issues

## Prerequisites

### Install Podman Desktop
```bash
# Arch Linux (your system)
sudo pacman -S podman podman-compose

# Or via Podman Desktop GUI
# Download from: https://podman-desktop.io
```

### Verify Installation
```bash
podman --version  # Should show 4.x or higher
podman-compose --version  # Should show 1.x or higher
```

## Quick Start

### 1. Start Local Development Stack
```bash
# Easy way with helper script
./podman-local.sh start

# Or manually
podman-compose -f podman-compose.yml up -d
```

### 2. Seed Database
```bash
./podman-local.sh seed
```

### 3. Start Development Servers
```bash
# Terminal 1: Backend (with local database)
source .env.local
PORT=8001 DATABASE_URL=$DATABASE_URL deno run --allow-all working-server.ts

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Service URLs

| Service | URL | Credentials |
|---------|-----|------------|
| PostgreSQL | `localhost:5432` | `pitchey_dev` / `localdev123` |
| Redis | `localhost:6379` | No auth |
| MinIO (S3) | `http://localhost:9000` | `minioadmin` / `minioadmin` |
| MinIO Console | `http://localhost:9001` | `minioadmin` / `minioadmin` |
| Adminer | `http://localhost:8080` | Use PostgreSQL creds |

## Common Commands

```bash
# View service status
./podman-local.sh status

# View logs
./podman-local.sh logs           # All services
./podman-local.sh logs postgres  # Specific service

# Access service shells
./podman-local.sh shell postgres  # PostgreSQL CLI
./podman-local.sh shell redis     # Redis CLI

# Stop services
./podman-local.sh stop

# Reset everything (delete data)
./podman-local.sh reset
```

## Podman vs Docker Differences

### 1. Registry Prefixes
Podman requires full registry URLs:
```yaml
# Docker
image: postgres:16

# Podman (explicit)
image: docker.io/postgres:16
```

### 2. SELinux Labels (if enabled)
Volume mounts need `:Z` suffix:
```yaml
volumes:
  - ./data:/data:Z  # SELinux relabeling
```

### 3. User Permissions
Podman runs rootless by default:
```yaml
# Specify user to avoid permission issues
user: "999:999"
```

### 4. Network Mode
Podman uses slirp4netns by default:
```bash
# If you have network issues, try:
podman-compose --podman-run-args="--network=host" up
```

## Troubleshooting

### Permission Denied Errors
```bash
# Fix volume permissions
podman unshare chown -R 999:999 ./postgres_data

# Or run with specific user
podman run --user 999:999 postgres:16
```

### Port Already in Use
```bash
# Check what's using the port
ss -tulpn | grep 5432

# Stop conflicting service
sudo systemctl stop postgresql  # If system PostgreSQL is running
```

### Container Can't Connect to Each Other
```bash
# Use service names as hostnames
# In your app config:
DATABASE_HOST=postgres  # Not localhost
REDIS_HOST=redis       # Not localhost
```

### Podman Machine (Mac/Windows)
```bash
# Initialize if not done
podman machine init
podman machine start

# SSH into machine
podman machine ssh
```

## Environment Variables

The `.env.local` file is configured for local Podman development:
```bash
# Database (Podman PostgreSQL)
DATABASE_URL="postgresql://pitchey_dev:localdev123@localhost:5432/pitchey_local"

# Redis (Podman Redis)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# MinIO (Podman S3)
R2_ENDPOINT="http://localhost:9000"
R2_ACCESS_KEY="minioadmin"
R2_SECRET_KEY="minioadmin"
```

## Benefits Over Production Database

1. **No risk to production data** ✅
2. **Faster development** (no network latency) ✅
3. **Test destructive operations safely** ✅
4. **Multiple developers can work independently** ✅
5. **Reproducible environment** ✅

## Integration with GitHub

While using local Podman stack, you can still use:
- **GitHub Actions** - For CI/CD (runs in cloud)
- **Dependabot** - For dependency updates
- **GitHub Copilot** - For AI assistance
- **CodeQL** - For security scanning

These work regardless of local container runtime!

## Next Steps

1. Start services: `./podman-local.sh start`
2. Seed database: `./podman-local.sh seed`
3. Start coding with local data!

---

**Note**: This setup keeps your local development completely separate from production while maintaining the same structure and schema.