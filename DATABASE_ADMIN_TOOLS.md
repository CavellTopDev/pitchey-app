# Database Administration Tools

Comprehensive database monitoring, testing, and management tools for the Neon PostgreSQL database.

## Overview

This toolkit provides four main components for database operational excellence:

1. **Database Monitoring** (`monitor-neon-database.sh`) - Health checks and performance monitoring
2. **Database Integrity Testing** (`test-database-integrity.sh`) - Schema and data validation
3. **Database Seeding** (`seed-test-data.ts`) - Comprehensive test data generation
4. **Database Metrics Dashboard** (`database-metrics.ts`) - Real-time monitoring dashboard

## Quick Start

```bash
# Make all scripts executable
chmod +x monitor-neon-database.sh
chmod +x test-database-integrity.sh
chmod +x seed-test-data.ts
chmod +x database-metrics.ts

# Basic health check
./monitor-neon-database.sh --mode=check

# Quick integrity test
./test-database-integrity.sh --mode=quick

# Start metrics dashboard
deno run --allow-all database-metrics.ts --mode=dashboard
```

## Tools Documentation

### 1. Database Monitoring Script

**File**: `monitor-neon-database.sh`

**Purpose**: Monitors database health, performance, and provides automated alerting.

#### Usage

```bash
./monitor-neon-database.sh [--mode=report|check|continuous]
```

#### Modes

- **check** (default): Run health checks and alerts
- **report**: Generate comprehensive JSON report
- **continuous**: Run continuous monitoring with 60-second intervals

#### Features

- **Connectivity Testing**: Database connection and latency monitoring
- **Performance Metrics**: Query performance and slow query detection
- **Connection Pool Monitoring**: Active connections and usage tracking
- **Table Analysis**: Size monitoring and bloat detection
- **Index Usage**: Index efficiency and unused index detection
- **Cache Hit Ratios**: Buffer cache performance monitoring
- **Lock Monitoring**: Active locks and blocked queries
- **Automated Alerts**: Threshold-based alerting system

#### Alert Thresholds

```bash
MAX_CONNECTIONS=90
MAX_ACTIVE_QUERIES=50
MAX_QUERY_TIME_MS=5000
MIN_CACHE_HIT_RATIO=0.95
```

#### Output Examples

```bash
# Health check
./monitor-neon-database.sh
[2024-11-12 10:30:15] [INFO] All systems normal

# Generate JSON report
./monitor-neon-database.sh --mode=report
[2024-11-12 10:30:15] [INFO] JSON report generated: ./reports/neon_db_report_20241112_103015.json

# Continuous monitoring
./monitor-neon-database.sh --mode=continuous
```

### 2. Database Integrity Testing Script

**File**: `test-database-integrity.sh`

**Purpose**: Comprehensive database integrity verification including schema, constraints, and data validation.

#### Usage

```bash
./test-database-integrity.sh [--mode=full|quick|schema|data|performance]
```

#### Modes

- **full** (default): Run all integrity tests
- **quick**: Essential connectivity and basic integrity tests
- **schema**: Schema and structure tests only
- **data**: Data integrity tests only
- **performance**: Performance benchmark tests only

#### Test Categories

1. **Schema Tests**
   - Table existence verification
   - Foreign key constraint validation
   - Index usage analysis
   - Missing recommended indexes detection

2. **Data Integrity Tests**
   - Invalid data detection (negative IDs, malformed emails)
   - Missing required fields
   - Future timestamp detection
   - Orphaned record identification

3. **Performance Tests**
   - Query execution time benchmarks
   - JOIN query performance
   - Index usage efficiency

4. **Security Tests**
   - User permission verification
   - Transaction rollback capability
   - Database statistics freshness

#### Expected Tables Verified

The script validates the existence of all 47 expected tables including:
- Core tables: `users`, `pitches`, `messages`, `ndas`
- Analytics: `analytics_events`, `pitch_views`, `search_analytics`
- Payments: `payments`, `subscription_history`, `payment_methods`
- Content management: `content_types`, `feature_flags`, `translations`

#### Output Example

```bash
./test-database-integrity.sh
[2024-11-12 10:30:15] [PASS] ✓ Database connectivity
[2024-11-12 10:30:16] [PASS] ✓ Required tables exist
[2024-11-12 10:30:17] [PASS] ✓ Foreign key constraints
[2024-11-12 10:30:18] [WARN] ⚠ Index usage analysis

=== Test Summary ===
Total tests: 8
Passed: 7
Failed: 0
Warnings: 1
Success rate: 87.50%
```

### 3. Database Seeding Script

**File**: `seed-test-data.ts`

**Purpose**: Generate comprehensive, realistic test data for all portal types and scenarios.

#### Usage

```bash
deno run --allow-all seed-test-data.ts [--mode=full|demo|minimal|cleanup]
```

#### Modes

- **full** (default): Create comprehensive test data
- **demo**: Create demo data for showcasing
- **minimal**: Create minimal test data
- **cleanup**: Remove all test data

#### Test Data Generated

1. **Users** (50 default)
   - Demo accounts (alex.creator@demo.com, sarah.investor@demo.com, stellar.production@demo.com)
   - Creators, investors, production companies, and viewers
   - Realistic profiles with company information
   - Various subscription tiers

2. **Pitches** (30 default)
   - Sample high-quality pitches ("The Last Signal", "Midnight Diner Chronicles", "The Memory Thief")
   - Various genres, formats, and production stages
   - Realistic loglines, synopses, and budget information
   - Mixed visibility settings and NDA requirements

3. **Relationships & Engagement**
   - Follow relationships between users and pitches
   - Pitch likes and saves
   - View tracking with realistic user agents and referrers
   - Message exchanges between users

4. **Business Data**
   - Investment records with realistic amounts and terms
   - NDA requests and signed NDAs
   - Subscription history and payment methods
   - Review and calendar data

5. **Analytics Data**
   - Pitch view analytics with geographic and behavioral data
   - User session tracking
   - Notification history
   - Engagement metrics

#### Demo Accounts

All demo accounts use password: `Demo123`

```bash
# Creator Portal
Email: alex.creator@demo.com
Username: alex_creator
Type: Creator
Subscription: Pro

# Investor Portal  
Email: sarah.investor@demo.com
Username: sarah_investor
Type: Investor
Subscription: Premium

# Production Portal
Email: stellar.production@demo.com  
Username: stellar_production
Type: Production
Subscription: Premium
```

#### Data Quality Features

- **Referential Integrity**: All foreign keys properly linked
- **Realistic Distributions**: Natural data patterns and relationships
- **Time-based Data**: Realistic timestamps and date ranges
- **Variety**: Diverse content across all categories
- **Scalability**: Configurable data volumes

### 4. Database Metrics Dashboard

**File**: `database-metrics.ts`

**Purpose**: Real-time database monitoring with web dashboard, API endpoints, and alerting.

#### Usage

```bash
deno run --allow-all database-metrics.ts [--mode=dashboard|api|export|console] [port]
```

#### Modes

- **dashboard** (default): Start web dashboard on port 8080
- **api**: Start API server (same as dashboard)
- **export**: Export metrics to JSON file
- **console**: Display metrics in console

#### Web Dashboard Features

- **Real-time Metrics**: Auto-refreshes every 30 seconds
- **Visual Alerts**: Color-coded status indicators
- **Performance Tracking**: Query performance and slow query detection
- **Connection Monitoring**: Active connection tracking
- **Table Analytics**: Size, growth, and maintenance status
- **Cache Performance**: Hit ratio monitoring
- **Lock Detection**: Blocked and long-running queries

#### API Endpoints

```bash
# Web Dashboard
http://localhost:8080/dashboard

# JSON API
http://localhost:8080/api/metrics

# Health Check
http://localhost:8080/api/health
```

#### Metrics Collected

1. **Database Overview**
   - Connection information and database size
   - PostgreSQL version and current time
   - Total connections and active sessions

2. **Performance Metrics**
   - Query execution statistics (requires pg_stat_statements)
   - Cache hit ratios for tables and indexes
   - Lock information and blocked queries
   - Slow query identification

3. **Storage Analytics**
   - Table sizes and row counts
   - Index usage statistics
   - Dead tuple tracking
   - Vacuum and analyze freshness

4. **Real-time Status**
   - Active connections breakdown
   - Long-running query detection
   - Replication status (if configured)
   - System alerts and warnings

#### Alert Categories

- **Critical**: Blocked queries, connection failures
- **Warning**: High connection usage, low cache hit ratios
- **Info**: Large tables, slow queries, maintenance recommendations

## Environment Configuration

All tools use the following environment variable for database connection:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
```

### Setting Environment Variables

```bash
# Create .env file
echo 'DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"' > .env

# Or export directly
export DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
```

## Operational Workflows

### Daily Monitoring Routine

```bash
# 1. Quick health check
./monitor-neon-database.sh --mode=check

# 2. Run integrity tests
./test-database-integrity.sh --mode=quick

# 3. Start dashboard for the day
deno run --allow-all database-metrics.ts --mode=dashboard &
```

### Weekly Maintenance

```bash
# 1. Generate comprehensive report
./monitor-neon-database.sh --mode=report

# 2. Full integrity test
./test-database-integrity.sh --mode=full

# 3. Export metrics for analysis
deno run --allow-all database-metrics.ts --mode=export
```

### Development Workflow

```bash
# 1. Clean existing test data
deno run --allow-all seed-test-data.ts --mode=cleanup

# 2. Seed fresh test data
deno run --allow-all seed-test-data.ts --mode=demo

# 3. Verify data integrity
./test-database-integrity.sh --mode=quick
```

### Production Deployment

```bash
# 1. Pre-deployment health check
./monitor-neon-database.sh --mode=check || exit 1

# 2. Run full integrity tests
./test-database-integrity.sh --mode=full || exit 1

# 3. Generate baseline report
./monitor-neon-database.sh --mode=report

# 4. Start continuous monitoring
./monitor-neon-database.sh --mode=continuous &
```

## File Outputs

### Log Files

All scripts create log files in the `logs/` directory:

```bash
logs/monitor_YYYYMMDD_HHMMSS.log          # Monitoring logs
logs/integrity_test_YYYYMMDD_HHMMSS.log   # Integrity test logs
```

### Report Files

JSON reports are generated in the `reports/` directory:

```bash
reports/neon_db_report_YYYYMMDD_HHMMSS.json           # Monitoring reports
reports/integrity_test_report_YYYYMMDD_HHMMSS.json    # Integrity test reports
database_metrics_YYYY-MM-DDTHH-MM-SS.json            # Exported metrics
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Database Health Check
  run: |
    ./monitor-neon-database.sh --mode=check
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "Database health check failed"
      exit 1
    fi

- name: Database Integrity Test
  run: |
    ./test-database-integrity.sh --mode=quick
    exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "Database integrity test failed"
      exit 1
    fi
```

### Docker Integration

```dockerfile
# Add tools to container
COPY monitor-neon-database.sh /usr/local/bin/
COPY test-database-integrity.sh /usr/local/bin/
COPY database-metrics.ts /usr/local/bin/
COPY seed-test-data.ts /usr/local/bin/

# Install dependencies
RUN chmod +x /usr/local/bin/*.sh /usr/local/bin/*.ts

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /usr/local/bin/monitor-neon-database.sh --mode=check
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   ```bash
   # Check network connectivity
   ping ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech
   
   # Test direct psql connection
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

2. **Permission Errors**
   ```bash
   # Ensure scripts are executable
   chmod +x *.sh *.ts
   
   # Check file permissions
   ls -la monitor-neon-database.sh
   ```

3. **Missing Dependencies**
   ```bash
   # Install required tools
   sudo apt-get install postgresql-client bc
   
   # For Deno scripts
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

4. **pg_stat_statements Unavailable**
   ```bash
   # Some query performance metrics require this extension
   # This is expected on managed databases like Neon
   ```

### Performance Optimization

1. **Index Recommendations**
   - Use the integrity test to identify missing indexes
   - Monitor index usage to identify unused indexes

2. **Query Performance**
   - Use the metrics dashboard to identify slow queries
   - Analyze query execution plans

3. **Vacuum and Analyze**
   - Monitor table bloat with the monitoring script
   - Schedule regular maintenance windows

## Security Considerations

1. **Database Credentials**
   - Store in environment variables or secure credential stores
   - Never commit credentials to version control
   - Use read-only credentials where possible

2. **Network Security**
   - Ensure SSL connections (sslmode=require)
   - Restrict database access to authorized IPs
   - Use connection pooling for production

3. **Monitoring Data**
   - Be careful with query logs that may contain sensitive data
   - Rotate and secure log files
   - Limit dashboard access to authorized personnel

## Support and Maintenance

- **Log Rotation**: Implement log rotation for long-running monitoring
- **Alert Integration**: Connect alerts to your incident management system
- **Backup Validation**: Use integrity tests to validate backup restores
- **Performance Baselines**: Establish baseline metrics for comparison
- **Regular Reviews**: Weekly review of reports and metrics trends

For additional support or customization of these tools, refer to the individual script documentation or create issues in the project repository.