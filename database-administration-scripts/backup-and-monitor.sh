#!/bin/bash

# Database Administration and Monitoring Scripts
# For Pitchey Platform - PostgreSQL Database

set -e

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-pitchey}
DB_USER=${DB_USER:-postgres}
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pitchey}"
LOG_DIR="${LOG_DIR:-/var/log/pitchey}"
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/db-admin.log"
}

# Create directories if they don't exist
create_directories() {
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    log "${GREEN}✅ Created backup and log directories${NC}"
}

# Database backup with retention policy
backup_database() {
    log "${YELLOW}🗄️  Starting database backup...${NC}"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/pitchey_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    # Create backup
    if PGPASSWORD=password pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$backup_file"; then
        # Compress backup
        gzip "$backup_file"
        log "${GREEN}✅ Database backup created: $compressed_file${NC}"
        
        # Verify backup integrity
        if gunzip -t "$compressed_file" 2>/dev/null; then
            log "${GREEN}✅ Backup integrity verified${NC}"
        else
            log "${RED}❌ Backup integrity check failed${NC}"
            return 1
        fi
        
        # Clean old backups
        find "$BACKUP_DIR" -name "pitchey_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
        log "${GREEN}✅ Cleaned backups older than $RETENTION_DAYS days${NC}"
        
    else
        log "${RED}❌ Database backup failed${NC}"
        return 1
    fi
}

# Test backup restoration (dry run)
test_backup_restore() {
    log "${YELLOW}🔍 Testing backup restoration (dry run)...${NC}"
    
    local latest_backup=$(ls -t "$BACKUP_DIR"/pitchey_backup_*.sql.gz | head -n1)
    
    if [ -z "$latest_backup" ]; then
        log "${RED}❌ No backup files found${NC}"
        return 1
    fi
    
    # Test restore to temporary database
    local test_db="pitchey_restore_test_$(date +%s)"
    
    # Create test database
    PGPASSWORD=password createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db"
    
    # Restore backup to test database
    if gunzip -c "$latest_backup" | PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" > /dev/null 2>&1; then
        log "${GREEN}✅ Backup restoration test successful${NC}"
        
        # Verify critical tables exist
        local tables=("users" "pitches" "security_events" "sessions")
        for table in "${tables[@]}"; do
            local count=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            if [ "$count" -ge "0" ]; then
                log "${GREEN}✅ Table $table verified ($count rows)${NC}"
            else
                log "${RED}❌ Table $table verification failed${NC}"
            fi
        done
        
    else
        log "${RED}❌ Backup restoration test failed${NC}"
    fi
    
    # Clean up test database
    PGPASSWORD=password dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db"
    log "${GREEN}✅ Test database cleanup completed${NC}"
}

# Monitor database performance and security
monitor_database() {
    log "${YELLOW}📊 Monitoring database performance and security...${NC}"
    
    # Check connection count
    local connection_count=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='$DB_NAME';" | xargs)
    log "${GREEN}📈 Active connections: $connection_count${NC}"
    
    # Check database size
    local db_size=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | xargs)
    log "${GREEN}💾 Database size: $db_size${NC}"
    
    # Check recent security events
    local security_events=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM security_events WHERE created_at > NOW() - INTERVAL '24 hours';" 2>/dev/null | xargs)
    log "${GREEN}🔒 Security events (24h): $security_events${NC}"
    
    # Check rate limit violations
    local rate_limit_events=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM security_events WHERE event_type = 'rate_limit_exceeded' AND created_at > NOW() - INTERVAL '1 hour';" 2>/dev/null | xargs)
    log "${YELLOW}⚠️  Rate limit violations (1h): $rate_limit_events${NC}"
    
    # Check for locked accounts
    local locked_accounts=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE account_locked_at IS NOT NULL;" | xargs)
    if [ "$locked_accounts" -gt "0" ]; then
        log "${RED}🔒 Locked accounts: $locked_accounts${NC}"
    else
        log "${GREEN}🔓 No locked accounts${NC}"
    fi
    
    # Check for long-running queries
    local long_queries=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '5 minutes';" | xargs)
    if [ "$long_queries" -gt "0" ]; then
        log "${YELLOW}⏰ Long-running queries: $long_queries${NC}"
    else
        log "${GREEN}⚡ No long-running queries${NC}"
    fi
}

# Database maintenance tasks
maintain_database() {
    log "${YELLOW}🔧 Running database maintenance...${NC}"
    
    # Update table statistics
    PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "ANALYZE;" > /dev/null
    log "${GREEN}✅ Table statistics updated${NC}"
    
    # Vacuum analyze critical tables
    local critical_tables=("users" "pitches" "security_events" "sessions" "messages")
    for table in "${critical_tables[@]}"; do
        PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "VACUUM ANALYZE $table;" > /dev/null 2>&1
        log "${GREEN}✅ Vacuumed and analyzed table: $table${NC}"
    done
    
    # Clean up old sessions
    local cleaned_sessions=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "DELETE FROM sessions WHERE expires_at < NOW(); SELECT ROW_COUNT();" 2>/dev/null | tail -n1 | xargs)
    log "${GREEN}🧹 Cleaned expired sessions: ${cleaned_sessions:-0}${NC}"
    
    # Clean up old security events (older than 1 year)
    local cleaned_events=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '1 year'; SELECT ROW_COUNT();" 2>/dev/null | tail -n1 | xargs)
    log "${GREEN}🧹 Cleaned old security events: ${cleaned_events:-0}${NC}"
}

# Check index usage and recommend optimizations
check_index_usage() {
    log "${YELLOW}📊 Checking index usage...${NC}"
    
    # Find unused indexes
    local unused_indexes=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT schemaname||'.'||tablename||'.'||indexname as unused_index
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0 
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';" | wc -l)
    
    if [ "$unused_indexes" -gt "0" ]; then
        log "${YELLOW}⚠️  Found $unused_indexes unused indexes${NC}"
    else
        log "${GREEN}✅ All indexes are being used${NC}"
    fi
    
    # Check table sizes
    PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10;" > "$LOG_DIR/table_sizes.log"
    
    log "${GREEN}✅ Table sizes logged to $LOG_DIR/table_sizes.log${NC}"
}

# Disaster recovery test
disaster_recovery_test() {
    log "${YELLOW}🚨 Running disaster recovery test...${NC}"
    
    # Create a test scenario backup
    backup_database
    
    # Test restoration procedures
    test_backup_restore
    
    # Verify critical data integrity
    local user_count=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | xargs)
    local pitch_count=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pitches;" | xargs)
    
    log "${GREEN}✅ Data integrity check: $user_count users, $pitch_count pitches${NC}"
    
    # Test security events functionality
    PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO security_events (event_type, event_status, ip_address, metadata) 
        VALUES ('disaster_recovery_test', 'success', '127.0.0.1', '{\"test\": true}');" > /dev/null
    
    log "${GREEN}✅ Security events functionality verified${NC}"
}

# Alert system for critical issues
check_alerts() {
    log "${YELLOW}🚨 Checking for critical alerts...${NC}"
    
    # High connection count alert
    local max_connections=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW max_connections;" | xargs)
    local current_connections=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity;" | xargs)
    local connection_percentage=$((current_connections * 100 / max_connections))
    
    if [ "$connection_percentage" -gt "80" ]; then
        log "${RED}🚨 ALERT: High connection usage: $connection_percentage%${NC}"
    fi
    
    # Database size alert (> 10GB)
    local db_size_bytes=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_database_size('$DB_NAME');" | xargs)
    local db_size_gb=$((db_size_bytes / 1024 / 1024 / 1024))
    
    if [ "$db_size_gb" -gt "10" ]; then
        log "${YELLOW}⚠️  WARNING: Database size > 10GB: ${db_size_gb}GB${NC}"
    fi
    
    # Rate limit violations alert
    local recent_rate_limits=$(PGPASSWORD=password psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM security_events WHERE event_type = 'rate_limit_exceeded' AND created_at > NOW() - INTERVAL '10 minutes';" 2>/dev/null | xargs)
    
    if [ "$recent_rate_limits" -gt "10" ]; then
        log "${RED}🚨 ALERT: High rate limit violations: $recent_rate_limits in last 10 minutes${NC}"
    fi
}

# Main execution
main() {
    log "${GREEN}🚀 Starting Pitchey Database Administration Tasks${NC}"
    
    create_directories
    
    case "${1:-all}" in
        "backup")
            backup_database
            ;;
        "test-restore")
            test_backup_restore
            ;;
        "monitor")
            monitor_database
            ;;
        "maintain")
            maintain_database
            ;;
        "index-check")
            check_index_usage
            ;;
        "disaster-test")
            disaster_recovery_test
            ;;
        "alerts")
            check_alerts
            ;;
        "all")
            backup_database
            monitor_database
            maintain_database
            check_index_usage
            check_alerts
            ;;
        *)
            echo "Usage: $0 {backup|test-restore|monitor|maintain|index-check|disaster-test|alerts|all}"
            exit 1
            ;;
    esac
    
    log "${GREEN}✅ Database administration tasks completed${NC}"
}

# Run main function
main "$@"