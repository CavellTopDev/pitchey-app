# Using Podman Instead of Docker

## Overview
This project uses Podman as a drop-in replacement for Docker. Podman offers better security through rootless containers and doesn't require a daemon.

## Command Equivalents

### Docker → Podman
```bash
# Instead of docker, use podman
docker ps          →  podman ps
docker images      →  podman images
docker run         →  podman run
docker build       →  podman build
docker-compose     →  podman-compose
```

## Current Setup

### PostgreSQL Container
- **Container Name**: pitchey_v02-db-1
- **Image**: postgres:15-alpine
- **Port**: 5432 (host) → 5432 (container)
- **Status**: Running ✅

### Managing the Database

#### Start PostgreSQL
```bash
# Using podman-compose
podman-compose up -d db

# Or directly with podman
podman start pitchey_v02-db-1
```

#### Stop PostgreSQL
```bash
# Using podman-compose
podman-compose down

# Or just stop the container
podman stop pitchey_v02-db-1
```

#### Check Status
```bash
podman ps | grep postgres
```

#### View Logs
```bash
podman logs pitchey_v02-db-1
```

#### Connect to PostgreSQL
```bash
# Using psql
psql postgresql://postgres:password@localhost:5432/pitchey

# Or exec into container
podman exec -it pitchey_v02-db-1 psql -U postgres -d pitchey
```

## Database Connection String
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey"
```

## Troubleshooting

### If PostgreSQL isn't running:
```bash
# Start it with podman-compose
podman-compose up -d db

# Or start existing container
podman start pitchey_v02-db-1
```

### If port 5432 is already in use:
```bash
# Find what's using it
lsof -i :5432

# Stop other PostgreSQL instances
podman stop $(podman ps -q --filter ancestor=postgres)
```

### Reset database:
```bash
# Stop container
podman stop pitchey_v02-db-1

# Remove container
podman rm pitchey_v02-db-1

# Start fresh
podman-compose up -d db
```

## Podman-Compose Installation
If you don't have podman-compose:
```bash
pip install podman-compose
```

## Benefits of Podman
1. **Rootless**: Containers run without root privileges
2. **Daemonless**: No background daemon needed
3. **Docker Compatible**: Uses same commands and Dockerfile format
4. **Systemd Integration**: Better integration with systemd
5. **Pod Support**: Native Kubernetes pod support

## Current Container Status
```bash
$ podman ps
CONTAINER ID  IMAGE                           COMMAND     CREATED      STATUS              PORTS                   NAMES
b80b7791f480  postgres:15-alpine             postgres    30 hours ago Up 7 minutes (healthy)  0.0.0.0:5432->5432/tcp  pitchey_v02-db-1
```

Your database is running and healthy! ✅