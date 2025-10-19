# Pitchey Database Disaster Recovery Runbook

## Overview
This runbook provides step-by-step procedures for recovering the Pitchey database in various disaster scenarios.

**RTO (Recovery Time Objective): 15 minutes**
**RPO (Recovery Point Objective): 1 hour**

## Emergency Contacts
- Database Administrator: [Your contact info]
- System Administrator: [Your contact info]
- Application Team Lead: [Your contact info]

## Pre-Disaster Checklist
- [ ] Backups are running automatically every hour
- [ ] Backup integrity is verified daily
- [ ] Connection pooling is configured and monitored
- [ ] Monitoring alerts are active

## Disaster Scenarios

### Scenario 1: Database Corruption
**Symptoms:** Database won't start, corruption errors in logs

**Recovery Steps:**
1. **Stop all application connections**
   ```bash
   # Stop pgbouncer
   sudo systemctl stop pgbouncer
   
   # Kill any remaining connections
   psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'pitchey';"
   ```

2. **Assess corruption level**
   ```bash
   # Check database integrity
   postgres -D /var/lib/postgresql/data --single -P disable_system_indexes pitchey
   ```

3. **Restore from latest backup**
   ```bash
   # Find latest backup
   ls -la /home/supremeisbeing/pitcheymovie/pitchey_v0.2/backups/ | grep full_backup | tail -1
   
   # Drop corrupted database
   dropdb pitchey
   
   # Create new database
   createdb pitchey
   
   # Restore from backup
   pg_restore -d pitchey /path/to/latest/backup.dump
   ```

4. **Verify restoration**
   ```bash
   psql pitchey -f /home/supremeisbeing/pitcheymovie/pitchey_v0.2/analytics_monitoring.sql
   ```

5. **Restart services**
   ```bash
   sudo systemctl start pgbouncer
   # Restart application services
   ```

### Scenario 2: Analytics Columns Data Loss
**Symptoms:** Analytics columns show zero values or NULL

**Recovery Steps:**
1. **Check scope of issue**
   ```sql
   SELECT 
       COUNT(*) as total_records,
       COUNT(CASE WHEN view_count = 0 AND like_count = 0 AND comment_count = 0 AND nda_count = 0 THEN 1 END) as zero_records
   FROM pitches;
   ```

2. **Restore analytics data from backup**
   ```bash
   # Extract analytics data from latest backup
   pg_restore -t pitches /path/to/latest/backup.dump --data-only --file=pitches_data.sql
   
   # Apply analytics columns only
   psql pitchey -c "
   UPDATE pitches SET 
       view_count = backup.view_count,
       like_count = backup.like_count,
       comment_count = backup.comment_count,
       nda_count = backup.nda_count
   FROM backup_pitches backup
   WHERE pitches.id = backup.id;
   "
   ```

3. **Rebuild analytics from source data**
   ```sql
   -- Update view counts from pitch_views table
   UPDATE pitches SET view_count = (
       SELECT COUNT(*) FROM pitch_views WHERE pitch_id = pitches.id
   );
   
   -- Update NDA counts from ndas table
   UPDATE pitches SET nda_count = (
       SELECT COUNT(*) FROM ndas WHERE pitch_id = pitches.id
   );
   ```

### Scenario 3: Complete Server Failure
**Symptoms:** Server unreachable, hardware failure

**Recovery Steps:**
1. **Provision new server**
   - Install PostgreSQL 14+
   - Configure same settings as original
   - Install pgbouncer

2. **Restore database**
   ```bash
   # Transfer backups to new server
   scp backup_server:/path/to/backups/* /tmp/
   
   # Create database
   createdb pitchey
   
   # Restore full backup
   pg_restore -d pitchey /tmp/pitchey_full_backup_latest.dump
   ```

3. **Update connection strings**
   - Update application configuration
   - Update pgbouncer configuration
   - Update monitoring systems

4. **Verify functionality**
   ```bash
   # Run health checks
   psql pitchey -f /home/supremeisbeing/pitcheymovie/pitchey_v0.2/database_monitoring.sql
   ```

### Scenario 4: Accidental Data Deletion
**Symptoms:** Missing records in pitches table

**Recovery Steps:**
1. **Immediately stop writes**
   ```sql
   REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM application_user;
   ```

2. **Determine deletion scope**
   ```sql
   -- Check recent deletions in logs
   SELECT * FROM pg_stat_activity WHERE query LIKE '%DELETE%';
   ```

3. **Point-in-time recovery**
   ```bash
   # Restore to point before deletion
   pg_basebackup -D /tmp/recovery_data -Ft -z -P
   
   # Start recovery instance
   postgres -D /tmp/recovery_data -p 5433
   
   # Extract missing data
   pg_dump -p 5433 -t pitches --data-only > missing_data.sql
   
   # Apply to production
   psql pitchey -f missing_data.sql
   ```

## Automated Recovery Scripts

### Quick Health Check
```bash
#!/bin/bash
# quick_health_check.sh

echo "=== Database Health Check ==="
psql pitchey -c "SELECT version();"
psql pitchey -c "SELECT COUNT(*) as total_pitches FROM pitches;"
psql pitchey -c "SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE datname = 'pitchey';"

echo "=== Analytics Integrity ==="
psql pitchey -f /home/supremeisbeing/pitcheymovie/pitchey_v0.2/analytics_monitoring.sql
```

### Emergency Backup
```bash
#!/bin/bash
# emergency_backup.sh

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/emergency_backup"
mkdir -p "$BACKUP_DIR"

echo "Creating emergency backup..."
pg_dump pitchey --format=custom --compress=9 --file="$BACKUP_DIR/emergency_backup_$TIMESTAMP.dump"

echo "Backup created: $BACKUP_DIR/emergency_backup_$TIMESTAMP.dump"
```

## Monitoring and Alerting

### Key Metrics to Monitor
- Connection count (alert if > 80% of max)
- Database size (alert if growth > 20% per day)
- Analytics data integrity (alert on NULL/negative values)
- Backup success/failure
- Replication lag (if applicable)

### Alert Thresholds
```sql
-- Connection alerts
SELECT 'HIGH_CONNECTIONS' as alert_type, COUNT(*) as value
FROM pg_stat_activity 
WHERE datname = 'pitchey' AND COUNT(*) > 80;

-- Size alerts
SELECT 'LARGE_DATABASE' as alert_type, pg_size_pretty(pg_database_size('pitchey')) as value
WHERE pg_database_size('pitchey') > 5368709120; -- 5GB

-- Data integrity alerts
SELECT 'DATA_INTEGRITY' as alert_type, COUNT(*) as bad_records
FROM pitches 
WHERE view_count IS NULL OR view_count < 0 
   OR like_count IS NULL OR like_count < 0
   OR comment_count IS NULL OR comment_count < 0
   OR nda_count IS NULL OR nda_count < 0
HAVING COUNT(*) > 0;
```

## Testing Recovery Procedures

### Monthly Recovery Test
1. Create test database from backup
2. Verify data integrity
3. Run application tests
4. Document any issues
5. Update procedures if needed

### Quarterly Disaster Drill
1. Simulate complete server failure
2. Execute full recovery procedure
3. Measure recovery time
4. Update RTO/RPO if needed

## Post-Recovery Checklist
- [ ] All services are running
- [ ] Data integrity verified
- [ ] Application functionality tested
- [ ] Monitoring alerts cleared
- [ ] Performance metrics normal
- [ ] Document incident and lessons learned
- [ ] Update recovery procedures if needed

## Contact Information
- PostgreSQL Support: [support contact]
- Cloud Provider Support: [support contact]
- Backup Service: [support contact]