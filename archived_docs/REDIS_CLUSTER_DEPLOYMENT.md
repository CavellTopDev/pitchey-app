# Redis Cluster Deployment Guide

This guide explains how to configure and deploy Redis cluster support for the Pitchey platform.

## Overview

The Pitchey platform now supports multiple Redis configurations with automatic failover:

1. **Redis Cluster** - Distributed caching with multiple nodes (production)
2. **Native Redis** - Single Redis instance (development)
3. **Upstash Redis** - Serverless Redis via REST API (serverless deployments)
4. **In-Memory Cache** - Fallback for environments without Redis

## Environment Variables

### Required for Redis Cluster

```bash
# Enable Redis cluster
REDIS_CLUSTER_ENABLED=true

# Comma-separated list of cluster nodes (format: host:port)
REDIS_CLUSTER_NODES=redis1.example.com:6379,redis2.example.com:6379,redis3.example.com:6379

# Optional cluster password
REDIS_CLUSTER_PASSWORD=your-cluster-password
```

### Connection Settings

```bash
# Connection pool size per node (default: 5)
REDIS_CONNECTION_POOL_SIZE=5

# Retry configuration
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Timeout settings (milliseconds)
REDIS_CONNECT_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=3000
```

### Failover Settings

```bash
# Failover timeout (default: 10 seconds)
REDIS_FAILOVER_TIMEOUT=10000

# Max failures before marking node unhealthy (default: 3)
REDIS_MAX_FAILURES=3

# Health check interval (default: 30 seconds)
REDIS_HEALTH_CHECK_INTERVAL=30000
```

### Cache Settings

```bash
# Enable caching
CACHE_ENABLED=true

# Default TTL in seconds (default: 5 minutes)
CACHE_TTL=300

# Key prefix for namespacing
REDIS_KEY_PREFIX=pitchey

# Fallback to single Redis if cluster fails
REDIS_FALLBACK_TO_SINGLE=true
```

### Fallback Configuration

```bash
# Single Redis instance (fallback)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Deployment Scenarios

### 1. Production with Redis Cluster

```bash
# .env.production
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=redis-1.internal:6379,redis-2.internal:6379,redis-3.internal:6379
REDIS_CLUSTER_PASSWORD=secure-cluster-password
REDIS_CONNECTION_POOL_SIZE=10
CACHE_ENABLED=true
CACHE_TTL=600
```

### 2. Development with Single Redis

```bash
# .env.development
REDIS_CLUSTER_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_ENABLED=true
CACHE_TTL=300
```

### 3. Serverless with Upstash

```bash
# .env.serverless
REDIS_CLUSTER_ENABLED=false
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
CACHE_ENABLED=true
```

### 4. No Redis (In-Memory Only)

```bash
# .env.minimal
CACHE_ENABLED=false
# Will use in-memory cache as fallback
```

## Testing Redis Cluster Locally

### Using Docker Compose

1. Start the test cluster:
```bash
docker-compose -f redis-cluster-docker-compose.yml up -d
```

2. Wait for cluster initialization (check logs):
```bash
docker-compose -f redis-cluster-docker-compose.yml logs redis-cluster-setup
```

3. Configure environment:
```bash
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=localhost:7001,localhost:7002,localhost:7003
CACHE_ENABLED=true
```

4. Test cluster connectivity:
```bash
redis-cli -c -p 7001
127.0.0.1:7001> cluster nodes
```

5. Stop the cluster:
```bash
docker-compose -f redis-cluster-docker-compose.yml down
```

## Monitoring and Health Checks

### Health Check Endpoint

The platform provides health check endpoints for monitoring cache status:

```bash
# Basic health check
GET /api/health/cache

# Detailed statistics
GET /api/admin/cache/stats

# Cluster information (when using cluster)
GET /api/admin/cache/cluster
```

### Health Check Response (Cluster)

```json
{
  "type": "redis-cluster",
  "distributed": true,
  "status": "healthy",
  "cluster": {
    "enabled": true,
    "totalNodes": 3,
    "healthyNodes": 3,
    "failedNodes": 0,
    "operations": {
      "total": 1500,
      "successful": 1485,
      "failed": 15,
      "successRate": "99.00%"
    },
    "performance": {
      "averageResponseTime": 12.5,
      "uptime": 3600000
    },
    "connectionPool": {
      "totalConnections": 15,
      "activeConnections": 15,
      "idleConnections": 0
    },
    "nodes": [
      {
        "address": "redis1.example.com:6379",
        "healthy": true,
        "failureCount": 0,
        "lastHealthCheck": "2024-10-24T12:00:00.000Z",
        "poolConnections": 5
      }
    ]
  }
}
```

## Production Deployment

### AWS ElastiCache

1. Create ElastiCache Redis cluster with cluster mode enabled
2. Configure security groups for access
3. Set environment variables:

```bash
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=your-cluster.cache.amazonaws.com:6379
REDIS_CLUSTER_PASSWORD=your-auth-token
```

### Google Cloud Memorystore

1. Create Memorystore Redis cluster
2. Configure VPC and firewall rules
3. Set environment variables with cluster endpoints

### Azure Cache for Redis

1. Create Azure Cache for Redis with clustering enabled
2. Configure virtual network access
3. Set connection details in environment

## Troubleshooting

### Common Issues

1. **Cluster initialization failed**
   - Check if REDIS_CLUSTER_NODES is correctly formatted
   - Verify network connectivity to all nodes
   - Ensure cluster is properly initialized

2. **High failure rate**
   - Increase REDIS_MAX_FAILURES threshold
   - Reduce REDIS_COMMAND_TIMEOUT
   - Check network latency to Redis nodes

3. **Connection pool exhaustion**
   - Increase REDIS_CONNECTION_POOL_SIZE
   - Monitor connection usage patterns
   - Implement connection recycling

4. **Failover not working**
   - Verify REDIS_HEALTH_CHECK_INTERVAL is appropriate
   - Check REDIS_FAILOVER_TIMEOUT setting
   - Review cluster health check logs

### Debugging Commands

```bash
# Check cluster status
redis-cli -c -h redis1.example.com -p 6379 cluster info

# View cluster nodes
redis-cli -c -h redis1.example.com -p 6379 cluster nodes

# Monitor Redis operations
redis-cli -h redis1.example.com -p 6379 monitor

# Check memory usage
redis-cli -h redis1.example.com -p 6379 info memory
```

## Performance Optimization

### Connection Pooling

- Set appropriate `REDIS_CONNECTION_POOL_SIZE` based on expected load
- Monitor connection usage with health check endpoints
- Balance pool size vs memory usage

### Timeouts

- Tune `REDIS_COMMAND_TIMEOUT` for your network conditions
- Set `REDIS_CONNECT_TIMEOUT` based on infrastructure
- Adjust `REDIS_RETRY_DELAY` for optimal performance

### Health Checking

- Set `REDIS_HEALTH_CHECK_INTERVAL` based on failure detection requirements
- Balance between quick failure detection and resource usage
- Monitor health check overhead

## Security Considerations

1. **Network Security**
   - Use VPCs/private networks for cluster communication
   - Configure firewalls to restrict Redis access
   - Use TLS encryption for data in transit

2. **Authentication**
   - Set strong `REDIS_CLUSTER_PASSWORD`
   - Rotate passwords regularly
   - Use Redis AUTH command

3. **Access Control**
   - Implement Redis ACL rules if supported
   - Limit command access for application users
   - Monitor access patterns

## Backup and Recovery

1. **Cluster Backup**
   - Configure Redis persistence (AOF + RDB)
   - Implement regular backup schedules
   - Test backup restoration procedures

2. **Disaster Recovery**
   - Plan for multi-region deployment
   - Implement cross-region replication
   - Test failover procedures

3. **Data Migration**
   - Plan for cluster scaling operations
   - Implement zero-downtime migration strategies
   - Test data consistency during migrations