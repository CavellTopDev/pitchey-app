# Scaling Runbooks and Operational Procedures

## Table of Contents
1. [Traffic Surge Response](#traffic-surge-response)
2. [Database Scaling Procedures](#database-scaling-procedures)
3. [Emergency Scaling Playbook](#emergency-scaling-playbook)
4. [Cost Optimization Procedures](#cost-optimization-procedures)
5. [Performance Degradation Response](#performance-degradation-response)
6. [Capacity Planning Reviews](#capacity-planning-reviews)

---

## Traffic Surge Response

### Detection Triggers
- Request rate > 5000 req/s sustained for 5 minutes
- P95 latency > 2000ms for 10 minutes
- Error rate > 5% for 5 minutes
- CPU utilization > 80% across workers

### Immediate Actions (0-5 minutes)

#### 1. Verify the Surge
```bash
# Check current metrics
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/analytics/dashboard"

# Check worker status
wrangler tail --format json | jq '.outcome'
```

#### 2. Enable Emergency Caching
```typescript
// Apply aggressive caching rules immediately
await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/cache_level`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ value: 'aggressive' })
});
```

#### 3. Scale Workers
```bash
# Increase worker limits
wrangler publish --compatibility-flags "increased_limits"

# Deploy to additional regions
for region in us-east us-west eu-west asia-pacific; do
  wrangler publish --name "pitchey-$region" --routes "pitchey.com/*"
done
```

### Secondary Actions (5-15 minutes)

#### 1. Database Connection Pooling
```sql
-- Increase connection pool size
ALTER SYSTEM SET max_connections = 500;
SELECT pg_reload_conf();

-- Enable statement timeout
ALTER DATABASE pitchey SET statement_timeout = '5s';
```

#### 2. Enable Read Replicas
```bash
# Activate standby replicas
neon branches create --name read-replica-1 --compute-size 2
neon branches create --name read-replica-2 --compute-size 2

# Update connection string in worker
wrangler secret put DATABASE_READ_URL
```

#### 3. Implement Rate Limiting
```typescript
// Deploy rate limiting rules
const rateLimit = {
  threshold: 100,
  period: 60,
  action: 'challenge'
};

await deployRateLimit(rateLimit);
```

### Recovery Actions (15+ minutes)

1. **Analyze traffic patterns**
   - Identify traffic source (legitimate vs DDoS)
   - Check for specific endpoint hotspots
   - Review cache hit rates

2. **Optimize hot paths**
   - Cache frequently accessed data
   - Optimize database queries
   - Implement request coalescing

3. **Document incident**
   - Record timeline
   - Capture metrics
   - Update runbook with learnings

---

## Database Scaling Procedures

### Vertical Scaling (Compute Units)

#### When to Scale Up
- Connection pool > 80% utilized
- Average query time > 500ms
- CPU usage > 70% sustained

#### Scaling Steps
```bash
# 1. Check current compute size
neon projects get $PROJECT_ID

# 2. Scale to next tier
neon projects update $PROJECT_ID --compute-size 2

# 3. Verify new capacity
neon connection-string $PROJECT_ID

# 4. Update connection pooler
pgbouncer -d /etc/pgbouncer/pgbouncer.ini -R
```

### Horizontal Scaling (Sharding)

#### Shard Addition Process
```sql
-- 1. Create new shard
CREATE DATABASE pitchey_shard_004;

-- 2. Copy schema
pg_dump -s pitchey_main | psql pitchey_shard_004

-- 3. Set up partition rules
CREATE RULE shard_004_insert AS
ON INSERT TO users
WHERE mod(hashtext(user_id::text), 4) = 3
DO INSTEAD
INSERT INTO pitchey_shard_004.users VALUES (NEW.*);

-- 4. Migrate existing data
INSERT INTO pitchey_shard_004.users
SELECT * FROM users
WHERE mod(hashtext(user_id::text), 4) = 3;

-- 5. Verify data distribution
SELECT 'shard_004', count(*) FROM pitchey_shard_004.users;
```

#### Read Replica Setup
```bash
# 1. Create read replica
neon branches create --name replica-$(date +%s) --parent main

# 2. Configure replication lag monitoring
CREATE EXTENSION pg_stat_statements;
SELECT client_addr, state, sent_lsn, write_lsn, replay_lsn, sync_state
FROM pg_stat_replication;

# 3. Update application routing
export READ_DATABASE_URLS="postgres://replica1.neon.tech/db,postgres://replica2.neon.tech/db"
```

---

## Emergency Scaling Playbook

### Severity Levels

#### SEV-1: Complete Outage
**Indicators:** Site completely down, error rate > 50%, all regions affected

**Actions:**
1. Page on-call engineer immediately
2. Execute emergency scaling script
3. Fail over to backup region
4. Engage vendor support (Cloudflare, Neon)

#### SEV-2: Partial Outage
**Indicators:** Some features unavailable, error rate 10-50%, degraded performance

**Actions:**
1. Alert engineering team
2. Scale affected services
3. Enable circuit breakers
4. Monitor for escalation

#### SEV-3: Performance Degradation
**Indicators:** Slow response times, error rate 5-10%, intermittent issues

**Actions:**
1. Notify team via Slack
2. Increase cache TTLs
3. Review recent deployments
4. Plan remediation

### Emergency Scaling Script
```bash
#!/bin/bash
# emergency-scale.sh

set -e

echo "🚨 EMERGENCY SCALING INITIATED"

# 1. Scale Workers
echo "Scaling Workers..."
wrangler publish --env emergency --workers 100

# 2. Scale Database
echo "Scaling Database..."
neon projects update $NEON_PROJECT_ID --compute-size 8

# 3. Increase Cache
echo "Increasing Cache Capacity..."
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/cache_level" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "aggressive"}'

# 4. Enable CDN Failover
echo "Enabling CDN Failover..."
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_online" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "on"}'

# 5. Alert Team
echo "Alerting Team..."
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  -d '{"text":"🚨 Emergency scaling completed. All systems scaled to maximum capacity."}'

echo "✅ EMERGENCY SCALING COMPLETE"
```

---

## Cost Optimization Procedures

### Daily Cost Review

#### Morning Checklist (9 AM)
```typescript
// cost-review.ts
async function morningCostReview() {
  // 1. Get yesterday's costs
  const costs = await CostAnalyzer.calculateCurrentCosts(yesterdayUsage);
  
  // 2. Check against budget
  const budget = 100; // Daily budget
  if (costs.total > budget * 1.1) {
    await sendAlert('Cost overrun detected', costs);
  }
  
  // 3. Identify optimization opportunities
  const optimizations = CostAnalyzer.generateCostOptimizations(costs, metrics);
  
  // 4. Apply automatic optimizations
  for (const opt of optimizations) {
    if (opt.potentialSavings > 50 && opt.risk === 'low') {
      await applyOptimization(opt);
    }
  }
}
```

### Weekly Optimization Review

1. **Analyze usage patterns**
   ```sql
   -- Find unused indexes
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
   ORDER BY schemaname, tablename;
   
   -- Find expensive queries
   SELECT query, calls, mean_exec_time, total_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 20;
   ```

2. **Review cache effectiveness**
   ```javascript
   // Check cache hit rates by endpoint
   const cacheStats = await getCacheStatistics();
   const lowHitRateEndpoints = cacheStats.filter(s => s.hitRate < 0.5);
   
   // Adjust TTLs for better performance
   for (const endpoint of lowHitRateEndpoints) {
     await adjustCacheTTL(endpoint, endpoint.suggestedTTL);
   }
   ```

3. **Right-size resources**
   - Review CPU/memory utilization
   - Downgrade underutilized services
   - Consolidate redundant resources

### Monthly Capacity Planning

#### Forecasting Process
```typescript
// Generate monthly forecast
const forecast = CapacityCalculator.predictGrowth(
  currentDAU,
  monthlyGrowthRate,
  3 // Next 3 months
);

// Review scaling milestones
const milestones = CapacityCalculator.generateScalingMilestones();

// Plan capacity upgrades
for (const milestone of milestones) {
  if (forecast.some(f => f.predictedDau > milestone.dau)) {
    planCapacityUpgrade(milestone);
  }
}
```

---

## Performance Degradation Response

### Diagnosis Steps

#### 1. Identify Bottleneck
```bash
# Check Worker metrics
wrangler tail --format json | \
  jq '.outcome, .logs[].message' | \
  grep -E "cpu|memory|timeout"

# Check Database
psql -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"

# Check Cache
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/analytics" | \
  jq '.result.totals.requests.cached / .result.totals.requests.all'
```

#### 2. Collect Evidence
```typescript
// Automated evidence collection
async function collectPerformanceEvidence() {
  const evidence = {
    timestamp: new Date(),
    metrics: await PerformanceMonitor.collectCloudflareMetrics(zoneId, token),
    slowQueries: await getSlowQueries(),
    errorLogs: await getRecentErrors(),
    deployments: await getRecentDeployments()
  };
  
  await saveEvidence(evidence);
  return analyzeEvidence(evidence);
}
```

### Mitigation Strategies

#### Quick Wins (< 5 minutes)
1. **Increase cache TTLs**
   ```javascript
   await updateCacheRules({
     '/api/public/*': { ttl: 600 }, // 10 minutes
     '/static/*': { ttl: 86400 }    // 24 hours
   });
   ```

2. **Enable request coalescing**
   ```typescript
   // Prevent duplicate requests
   const requestCache = new Map();
   
   async function coalescedFetch(url: string) {
     if (requestCache.has(url)) {
       return requestCache.get(url);
     }
     
     const promise = fetch(url);
     requestCache.set(url, promise);
     
     try {
       return await promise;
     } finally {
       setTimeout(() => requestCache.delete(url), 1000);
     }
   }
   ```

3. **Circuit breaker activation**
   ```typescript
   // Prevent cascading failures
   class CircuitBreaker {
     private failures = 0;
     private lastFailTime = 0;
     private state: 'closed' | 'open' | 'half-open' = 'closed';
     
     async call(fn: Function) {
       if (this.state === 'open') {
         if (Date.now() - this.lastFailTime > 60000) {
           this.state = 'half-open';
         } else {
           throw new Error('Circuit breaker is open');
         }
       }
       
       try {
         const result = await fn();
         if (this.state === 'half-open') {
           this.state = 'closed';
           this.failures = 0;
         }
         return result;
       } catch (error) {
         this.failures++;
         this.lastFailTime = Date.now();
         
         if (this.failures >= 5) {
           this.state = 'open';
         }
         throw error;
       }
     }
   }
   ```

#### Medium-term Fixes (5-30 minutes)
1. Database query optimization
2. Index creation/optimization
3. Connection pool tuning
4. Cache warming

#### Long-term Solutions (30+ minutes)
1. Code optimization
2. Architecture changes
3. Service decomposition
4. Infrastructure upgrades

---

## Capacity Planning Reviews

### Quarterly Planning Meeting

#### Agenda Template
1. **Current State Analysis** (30 min)
   - Review current capacity metrics
   - Cost analysis
   - Performance trends

2. **Growth Projections** (30 min)
   - User growth forecasts
   - Feature roadmap impact
   - Seasonal considerations

3. **Capacity Requirements** (45 min)
   - Calculate future needs
   - Identify scaling triggers
   - Budget implications

4. **Action Items** (15 min)
   - Infrastructure upgrades
   - Optimization projects
   - Monitoring improvements

### Capacity Planning Checklist

#### Infrastructure
- [ ] Review compute utilization (target: 50-70%)
- [ ] Check storage growth rate
- [ ] Evaluate network bandwidth usage
- [ ] Assess backup capacity

#### Database
- [ ] Analyze query performance
- [ ] Review index effectiveness
- [ ] Check replication lag
- [ ] Plan partition maintenance

#### Caching
- [ ] Measure cache hit rates
- [ ] Review TTL strategies
- [ ] Evaluate cache size
- [ ] Plan cache warming

#### Monitoring
- [ ] Update alerting thresholds
- [ ] Review dashboard effectiveness
- [ ] Test runbook procedures
- [ ] Validate escalation paths

### Success Metrics

#### Performance KPIs
- P95 latency < 500ms
- P99 latency < 1000ms
- Error rate < 1%
- Availability > 99.9%

#### Efficiency KPIs
- Cache hit rate > 85%
- Database connection utilization < 70%
- Cost per DAU < $0.10
- Autoscaling response time < 60s

#### Business KPIs
- User satisfaction score > 4.5/5
- Page load time < 2s
- API response time < 200ms
- Zero SEV-1 incidents per quarter

---

## Appendix: Emergency Contacts

### Vendor Support
- **Cloudflare Enterprise Support**: +1-888-99-FLARE
- **Neon Support**: support@neon.tech
- **Upstash Support**: support@upstash.com

### Internal Escalation
1. On-call Engineer (PagerDuty)
2. Infrastructure Lead
3. CTO
4. CEO (SEV-1 only)

### Communication Channels
- **Incident Channel**: #incidents (Slack)
- **Status Page**: status.pitchey.com
- **Customer Communication**: support@pitchey.com