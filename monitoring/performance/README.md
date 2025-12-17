# Pitchey Performance Monitoring Suite

## 🚀 Quick Start

### 1. Automated Setup (Recommended)

Run the automated setup script to configure all monitoring components:

```bash
# Set API URL (if different from default)
export API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Optional: Configure webhook alerts
export WEBHOOK_URL="https://your-webhook-endpoint.com/alerts"

# Run setup script
./setup-monitoring.sh
```

This will:
- ✅ Install all monitoring scripts
- 📊 Run initial baseline test
- 🎨 Generate initial dashboard
- ⚙️  Create systemd services (Linux)
- ⏰ Provide cron job templates

### 2. Start Monitoring

```bash
# Start all monitoring components
./start-monitoring.sh

# Or start individual components:
deno run --allow-net --allow-read --allow-write health-check-daemon.ts          # Health checks
deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous  # Dashboard
```

## 📊 Monitoring Components

### A. Comprehensive Baseline Monitor
Advanced performance baseline testing with detailed metrics:

```bash
deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts
# Output: baseline-data/baseline-TIMESTAMP.json
```

**Features:**
- Tests 13+ critical endpoints across 3 iterations
- Measures response times, cache performance, error rates
- Automatic alerting threshold checks
- Color-coded console output with performance indicators
- JSON export for historical analysis

### B. Health Check Daemon
Continuous health monitoring running every 5 minutes:

```bash
# Run as daemon (continuous)
deno run --allow-net --allow-read --allow-write health-check-daemon.ts

# Run single check
deno run --allow-net --allow-read --allow-write health-check-daemon.ts --once
```

**Features:**
- Automated health checks every 5 minutes (configurable)
- Content validation for API responses
- Endpoint-specific thresholds and timeouts
- Real-time status reporting
- JSONL logging for historical analysis
- Webhook alerts for critical issues

### C. Real-Time Dashboard
Interactive HTML dashboard with live metrics:

```bash
# Generate once
deno run --allow-net --allow-read --allow-write real-time-dashboard.ts

# Continuous generation (recommended)
deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous
```

**Features:**
- Beautiful responsive dashboard with charts
- Real-time performance metrics display
- 24-hour trend analysis with Chart.js
- Endpoint health matrix
- Auto-refresh every 30 seconds
- Cache hit rate visualization
- Color-coded status indicators

### D. Alert Manager
Intelligent alerting with configurable thresholds:

```bash
deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts
```

**Features:**
- Configurable alert thresholds via JSON
- Multiple notification channels (webhook, email, Slack)
- Alert escalation and auto-resolution
- Cooldown periods to prevent spam
- Endpoint-specific thresholds
- Alert history tracking

## ⚠️ Alert Configuration

### Alert Thresholds

The monitoring system includes pre-configured alert thresholds in `alerting-config.json`:

```json
{
  "thresholds": {
    "response_time": {
      "warning": { "value": 1000, "unit": "ms" },
      "critical": { "value": 2000, "unit": "ms" }
    },
    "error_rate": {
      "warning": { "value": 5, "unit": "%" },
      "critical": { "value": 15, "unit": "%" }
    },
    "cache_performance": {
      "hit_rate_warning": { "value": 50, "unit": "%" },
      "hit_rate_critical": { "value": 20, "unit": "%" }
    }
  }
}
```

### Notification Channels

Configure notification channels by setting environment variables:

```bash
# Webhook notifications (recommended)
export WEBHOOK_URL="https://hooks.slack.com/your/webhook/url"

# Email notifications (optional)
export SMTP_HOST="smtp.gmail.com"
export SMTP_USER="alerts@yourcompany.com"
export SMTP_PASS="your-password"

# Slack notifications (optional) 
export SLACK_WEBHOOK_URL="https://hooks.slack.com/your/slack/webhook"
```

### Alert Rules

Current alert rules monitor:
- **Response Time**: Warning >1s, Critical >2s
- **Error Rate**: Warning >5%, Critical >15%
- **Cache Hit Rate**: Warning <50%, Critical <20%
- **Endpoint Health**: Warning >20% degraded, Critical >50% unhealthy
- **System Availability**: Warning <95%, Critical <90%

## 📈 Performance Targets

| Metric | Current | Target | Alert Threshold |
|--------|---------|--------|----------------|
| Average Response Time | ~88ms | <50ms | >1000ms |
| P95 Response Time | ~145ms | <100ms | >1500ms |
| Cache Hit Rate | 0% | >80% | <50% |
| Error Rate | <1% | 0% | >5% |
| Uptime | >99% | 99.9% | <95% |

## 🔧 Legacy Tools
Runs continuous monitoring for extended analysis:

```bash
# 24-hour monitoring with 60-second intervals
./continuous-monitor.sh

# Custom duration (48 hours, 30-second intervals)
DURATION=172800 INTERVAL=30 ./continuous-monitor.sh
```

**What it does:**
- Tests endpoints every interval
- Logs to JSONL format for analysis
- Shows real-time statistics
- Creates summary report on completion

### C. Cache Diagnostic
Identifies why cache isn't working:

```bash
./cache-diagnostic.sh
# Output: cache-diagnostics/cache_diagnostic_TIMESTAMP.md
```

**What it finds:**
- ✅/❌ KV namespace configuration
- Cache key consistency issues
- Parameter order sensitivity
- Cloudflare cache status
- Specific fixes with code examples

### D. Anomaly Detection
Real-time performance anomaly detection:

```bash
./anomaly-detector.sh
# Monitors continuously, alerts on issues
```

**Detects:**
- Response time spikes (2x baseline)
- Sustained slow performance
- High error rates (>5%)
- Cache performance drops
- Statistical outliers (Z-score > 3)

### E. Dashboard Visualization
Generate interactive HTML dashboard:

```bash
# After running continuous monitoring
python3 dashboard-visualizer.py continuous-logs/metrics_*.jsonl

# Open in browser
open performance-dashboard.html
```

**Features:**
- Interactive charts (Chart.js)
- Endpoint performance cards
- Response time trends
- Cache hit rate visualization
- Automatic recommendations

## 🔍 Key Findings & Issues

### 1. **CRITICAL: Cache Not Working (All MISS)**

**Root Cause:** Multiple issues preventing cache hits:

1. **KV Namespace Not Configured:** The KV binding might not be properly set up in production
2. **Cache Key Mismatch:** Keys generated differently in different code paths
3. **Path Normalization:** `/api/pitches` vs `pitches` causing different keys
4. **Parameter Ordering:** `?limit=5&sort=new` vs `?sort=new&limit=5` create different keys

### 2. **Response Time Improvements Achieved**

Despite cache issues, optimizations have improved response times:
- **Before:** 270ms average
- **After:** 88ms average (67% improvement)
- **Target:** <50ms with working cache

### 3. **Hyperdrive Connection Issues**

Database pooling showing intermittent connection failures. Need to verify:
```bash
wrangler hyperdrive list
```

## 📈 Performance Metrics Baseline

Current production metrics (without working cache):

| Endpoint | Avg Response | P95 | Cache Rate | Target |
|----------|-------------|-----|------------|--------|
| /api/health | 45ms | 78ms | 0% | <20ms |
| /api/pitches/browse | 88ms | 145ms | 0% | <50ms |
| /api/pitches | 92ms | 152ms | 0% | <50ms |
| /api/auth/check | 65ms | 95ms | 0% | <30ms |

## 🛠️ Implementation Priority

### Priority 1: Fix KV Cache (Immediate)
```bash
# 1. Verify KV namespace
wrangler kv:namespace list

# 2. Create if missing
wrangler kv:namespace create KV

# 3. Update wrangler.toml
# 4. Deploy fixed cache code
```

### Priority 2: Add Cache Warming (Today)
```bash
# Warm cache after deployment
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/admin/warm-cache
```

### Priority 3: Configure Cloudflare Rules (Today)
1. Go to Cloudflare Dashboard
2. Add Cache Rules for `/api/pitches*`
3. Set Edge Cache TTL to 5 minutes
4. Exclude `/api/auth*` from caching

### Priority 4: Monitor Improvements (Ongoing)
```bash
# Run before and after fixes
./performance-baseline.sh

# Compare results
diff baseline-data/before.json baseline-data/after.json
```

## 📊 Expected Results After Fixes

With properly working cache:

| Metric | Current | Expected | Improvement |
|--------|---------|----------|-------------|
| Cache Hit Rate | 0% | 80%+ | ∞ |
| Avg Response Time | 88ms | <40ms | 54% |
| P95 Response Time | 145ms | <60ms | 58% |
| Database Queries | 100% | 20% | 80% reduction |
| Worker CPU Time | 100% | 40% | 60% reduction |

## 🚨 Alerting Thresholds

Configure these in your monitoring:

- **Response Time:** Alert if P95 > 200ms
- **Cache Hit Rate:** Alert if < 60%
- **Error Rate:** Alert if > 1%
- **Spike Detection:** Alert if 3x baseline

## 📝 Troubleshooting

### Cache Still Showing MISS

1. **Check KV binding:**
```bash
wrangler kv:namespace list
# Ensure ID matches wrangler.toml
```

2. **Verify deployment:**
```bash
wrangler tail
# Look for cache-related logs
```

3. **Test cache directly:**
```bash
# Write to cache
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/admin/cache-test

# Read from cache (should be HIT on 2nd request)
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/admin/cache-test
```

### High Response Times

1. Check database connection:
```bash
./cache-diagnostic.sh | grep "database"
```

2. Verify Hyperdrive:
```bash
wrangler hyperdrive list
```

3. Check for errors:
```bash
wrangler tail --format pretty
```

## 📞 Support

For additional help:
1. Check logs: `wrangler tail`
2. Review diagnostics: `./cache-diagnostic.sh`
3. Generate dashboard: `python3 dashboard-visualizer.py`
4. Check Cloudflare Analytics Dashboard