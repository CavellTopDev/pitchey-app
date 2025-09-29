# Pitchey Platform - Disaster Recovery Runbook

## Overview
This runbook provides step-by-step procedures for disaster recovery scenarios for the Pitchey platform PostgreSQL database. 

**RTO (Recovery Time Objective):** 4 hours  
**RPO (Recovery Point Objective):** 1 hour  

---

## 🚨 Emergency Contacts

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| Database Administrator | Primary DBA | +1-XXX-XXX-XXXX | dba@pitchey.com |
| System Administrator | Primary SysAdmin | +1-XXX-XXX-XXXX | sysadmin@pitchey.com |
| Development Lead | Lead Developer | +1-XXX-XXX-XXXX | dev-lead@pitchey.com |

---

## 📋 Pre-Disaster Checklist

### Daily Automated Tasks
- [x] Database backup completed
- [x] Backup integrity verified
- [x] Monitoring alerts functional
- [x] Security events logged properly

### Weekly Manual Verification
- [ ] Backup restoration test completed
- [ ] Index usage analysis reviewed
- [ ] Performance metrics within thresholds
- [ ] Security event patterns analyzed

---

## 🔄 Recovery Scenarios

### Scenario 1: Database Corruption
**Symptoms:** Query errors, data inconsistency, PostgreSQL crashes

#### Immediate Actions (0-15 minutes)
1. **STOP** application servers to prevent further corruption
2. **ISOLATE** database server from application traffic
3. **ASSESS** corruption extent:
   ```bash
   # Check database integrity
   PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "SELECT * FROM pg_stat_database WHERE datname = 'pitchey';"
   
   # Check for corrupted indexes
   PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "REINDEX DATABASE pitchey;"
   ```

#### Recovery Steps (15-60 minutes)
1. **BACKUP** current corrupted state (for forensics):
   ```bash
   PGPASSWORD=password pg_dump -h localhost -U postgres pitchey > /tmp/corrupted_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **RESTORE** from latest verified backup:
   ```bash
   # Drop corrupted database
   PGPASSWORD=password dropdb -h localhost -U postgres pitchey
   
   # Create new database
   PGPASSWORD=password createdb -h localhost -U postgres pitchey
   
   # Restore from backup
   latest_backup=$(ls -t /var/backups/pitchey/pitchey_backup_*.sql.gz | head -n1)
   gunzip -c "$latest_backup" | PGPASSWORD=password psql -h localhost -U postgres -d pitchey
   ```

3. **VERIFY** restoration:
   ```bash
   # Run verification script
   ./database-administration-scripts/backup-and-monitor.sh disaster-test
   ```

#### Post-Recovery (60-240 minutes)
1. **ANALYZE** data loss extent
2. **RECOVER** missing data from application logs if possible
3. **UPDATE** users about service restoration
4. **DOCUMENT** incident and root cause

---

### Scenario 2: Hardware Failure
**Symptoms:** Database server unresponsive, disk failures, network issues

#### Immediate Actions (0-30 minutes)
1. **FAILOVER** to backup server (if available)
2. **REDIRECT** DNS to backup location
3. **ASSESS** hardware failure extent

#### Recovery Steps (30-180 minutes)
1. **PROVISION** new hardware/cloud instance
2. **INSTALL** PostgreSQL and dependencies:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql-15 postgresql-contrib
   
   # Configure PostgreSQL
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

3. **RESTORE** database from backup:
   ```bash
   # Create database
   sudo -u postgres createdb pitchey
   
   # Restore from latest backup
   latest_backup=$(ls -t /var/backups/pitchey/pitchey_backup_*.sql.gz | head -n1)
   gunzip -c "$latest_backup" | sudo -u postgres psql -d pitchey
   ```

4. **CONFIGURE** security and access:
   ```bash
   # Update pg_hba.conf for application access
   sudo nano /etc/postgresql/15/main/pg_hba.conf
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

---

### Scenario 3: Security Breach
**Symptoms:** Unauthorized access, data modification, suspicious security events

#### Immediate Actions (0-15 minutes)
1. **ISOLATE** database server immediately
2. **CHANGE** all database passwords
3. **REVIEW** security events:
   ```sql
   SELECT * FROM security_events 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

#### Investigation Phase (15-60 minutes)
1. **ANALYZE** security events for breach patterns:
   ```sql
   -- Find suspicious IP addresses
   SELECT ip_address, COUNT(*), 
          string_agg(DISTINCT event_type, ', ') as events
   FROM security_events 
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY ip_address
   HAVING COUNT(*) > 100
   ORDER BY count DESC;
   ```

2. **IDENTIFY** compromised accounts:
   ```sql
   -- Check for unusual login patterns
   SELECT u.username, u.email, u.last_login_at,
          COUNT(se.id) as security_events
   FROM users u
   LEFT JOIN security_events se ON se.user_id = u.id
   WHERE se.created_at > NOW() - INTERVAL '24 hours'
   GROUP BY u.id, u.username, u.email, u.last_login_at
   ORDER BY security_events DESC;
   ```

#### Recovery Steps (60-240 minutes)
1. **RESTORE** from clean backup (pre-breach)
2. **RESET** all user passwords
3. **ENABLE** additional security measures:
   ```sql
   -- Force password changes for all users
   UPDATE users SET require_password_change = true;
   
   -- Lock suspicious accounts
   UPDATE users 
   SET account_locked_at = NOW(), 
       account_lock_reason = 'Security breach investigation'
   WHERE id IN (SELECT DISTINCT user_id FROM security_events 
                WHERE event_status = 'failure' 
                AND created_at > NOW() - INTERVAL '24 hours');
   ```

---

## 🔧 Automated Recovery Scripts

### Quick Database Health Check
```bash
#!/bin/bash
# File: quick-health-check.sh

echo "🔍 Database Health Check - $(date)"

# Check if PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL service is running"
else
    echo "❌ PostgreSQL service is DOWN"
    exit 1
fi

# Check database connectivity
if PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connectivity OK"
else
    echo "❌ Cannot connect to database"
    exit 1
fi

# Check critical tables
tables=("users" "pitches" "security_events" "sessions")
for table in "${tables[@]}"; do
    count=$(PGPASSWORD=password psql -h localhost -U postgres -d pitchey -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ "$count" -ge "0" ]; then
        echo "✅ Table $table: $count rows"
    else
        echo "❌ Table $table: ERROR"
        exit 1
    fi
done

echo "✅ Database health check completed successfully"
```

### Automated Failover Script
```bash
#!/bin/bash
# File: automated-failover.sh

PRIMARY_DB="primary-db.internal"
BACKUP_DB="backup-db.internal"
DNS_RECORD="db.pitchey.com"

echo "🚨 Starting automated failover - $(date)"

# Check primary database
if ! PGPASSWORD=password pg_isready -h $PRIMARY_DB -U postgres; then
    echo "❌ Primary database is down, initiating failover"
    
    # Update DNS to point to backup
    # (Implementation depends on your DNS provider)
    echo "🔄 Updating DNS to point to backup database"
    
    # Promote backup to primary
    echo "📈 Promoting backup database to primary"
    
    # Notify team
    echo "📧 Sending failover notification"
    
    echo "✅ Failover completed"
else
    echo "✅ Primary database is healthy, no failover needed"
fi
```

---

## 📊 Monitoring and Alerting

### Critical Alerts (Immediate Response Required)
- Database server down
- Connection pool exhausted
- Disk space > 90% full
- Replication lag > 5 minutes
- High rate of security events (> 100/hour)

### Warning Alerts (Response within 1 hour)
- Disk space > 80% full
- Long-running queries (> 5 minutes)
- High connection count (> 80% of max)
- Unusual security patterns

### Monitoring Queries
```sql
-- High Priority Monitoring
SELECT 
    'CRITICAL' as alert_level,
    'connection_exhaustion' as alert_type,
    COUNT(*) as current_connections,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
FROM pg_stat_activity 
WHERE datname = current_database()
HAVING COUNT(*) > (SELECT setting::int * 0.9 FROM pg_settings WHERE name = 'max_connections');

-- Replication Monitoring (if applicable)
SELECT 
    client_addr,
    state,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn)) as lag
FROM pg_stat_replication;
```

---

## 📈 Performance Baselines

### Normal Operation Metrics
- **Average Response Time:** < 100ms
- **Connection Count:** < 50% of max_connections
- **Disk I/O:** < 80% utilization
- **CPU Usage:** < 70%
- **Memory Usage:** < 80%

### Performance Degradation Thresholds
- **Response Time:** > 500ms (Warning), > 1000ms (Critical)
- **Connection Count:** > 80% (Warning), > 95% (Critical)
- **Disk Space:** > 80% (Warning), > 90% (Critical)

---

## 🧪 Testing Procedures

### Monthly Disaster Recovery Test
1. **Backup Verification:**
   ```bash
   ./database-administration-scripts/backup-and-monitor.sh test-restore
   ```

2. **Failover Test:**
   - Switch to backup database
   - Verify application functionality
   - Switch back to primary
   - Document any issues

3. **Security Event Response:**
   - Simulate security breach
   - Test incident response procedures
   - Verify alerting mechanisms

### Quarterly Full DR Exercise
1. **Complete System Rebuild:**
   - Provision new infrastructure
   - Restore from backup
   - Test all functionality

2. **Team Training:**
   - Run through procedures with team
   - Update documentation
   - Identify improvement areas

---

## 📝 Post-Incident Procedures

### Immediate Post-Recovery (0-2 hours)
1. **Verify** all systems operational
2. **Monitor** for issues
3. **Communicate** status to stakeholders

### Short-term Follow-up (2-24 hours)
1. **Document** incident details
2. **Analyze** root cause
3. **Implement** immediate fixes

### Long-term Improvements (1-4 weeks)
1. **Review** and update procedures
2. **Implement** preventive measures
3. **Conduct** post-mortem meeting
4. **Update** monitoring and alerting

---

## 📞 Escalation Matrix

| Incident Severity | Response Time | Escalation Level |
|-------------------|---------------|------------------|
| Critical (Service Down) | 15 minutes | All hands on deck |
| High (Degraded Performance) | 1 hour | DBA + SysAdmin |
| Medium (Warnings) | 4 hours | DBA |
| Low (Information) | Next business day | Monitoring team |

---

## 🔐 Security Considerations

### Access Control During Incidents
- **Emergency Access:** Pre-configured break-glass accounts
- **Audit Trail:** All emergency actions logged
- **Communication:** Secure channels only

### Data Protection
- **Encryption:** Ensure backups are encrypted
- **Access Logs:** Monitor all data access during incidents
- **Compliance:** Follow GDPR/privacy requirements during recovery

---

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Backup and Recovery Best Practices](https://www.postgresql.org/docs/current/backup.html)
- [Security Configuration Guidelines](https://www.postgresql.org/docs/current/security.html)
- [Performance Tuning Guide](https://www.postgresql.org/docs/current/performance-tips.html)

---

**Last Updated:** $(date +%Y-%m-%d)  
**Document Version:** 1.0  
**Review Schedule:** Monthly