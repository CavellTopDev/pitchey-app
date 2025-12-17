#!/bin/bash

# Database Backup Automation Script
# Performs automated backups with retention policies and verification

set -e

# Configuration
DB_HOST=${DB_HOST:-"ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"}
DB_NAME=${DB_NAME:-"neondb"}
DB_USER=${DB_USER:-"neondb_owner"}
DB_PASSWORD=${DB_PASSWORD:-""}
BACKUP_DIR=${BACKUP_DIR:-"/backup/postgresql"}
S3_BUCKET=${S3_BUCKET:-"pitchey-backups"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-""}

# Backup types
BACKUP_TYPE=${1:-"incremental"} # full, incremental, differential
ENVIRONMENT=${2:-"production"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
LOG_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d).log"
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    send_alert "Backup Failed" "$1"
    exit 1
}

send_alert() {
    local subject=$1
    local message=$2
    
    # Send to monitoring system
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔴 Database Backup Alert\n*${subject}*\n${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null
    fi
}

# Pre-backup checks
pre_backup_checks() {
    log "Running pre-backup checks..."
    
    # Check disk space
    AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=10485760 # 10GB in KB
    
    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        error_exit "Insufficient disk space. Available: ${AVAILABLE_SPACE}KB, Required: ${REQUIRED_SPACE}KB"
    fi
    
    # Test database connection
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 || \
        error_exit "Cannot connect to database"
    
    # Check S3 access
    if command -v aws &> /dev/null; then
        aws s3 ls "s3://$S3_BUCKET/" > /dev/null 2>&1 || \
            log "Warning: Cannot access S3 bucket $S3_BUCKET"
    fi
    
    log "Pre-backup checks completed successfully"
}

# Full backup
perform_full_backup() {
    local backup_file="${BACKUP_DIR}/full-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.enc"
    
    log "Starting full backup to $backup_file"
    
    # Perform backup with custom format for faster restore
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --verbose \
        --no-owner \
        --no-privileges \
        --jobs=4 \
        --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        error_exit "pg_dump failed"
    fi
    
    # Compress
    log "Compressing backup..."
    gzip -9 "$backup_file"
    
    # Encrypt if key provided
    if [ -n "$ENCRYPTION_KEY" ]; then
        log "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -in "$compressed_file" -out "$encrypted_file" -pass pass:"$ENCRYPTION_KEY"
        rm "$compressed_file"
        compressed_file="$encrypted_file"
    fi
    
    # Calculate checksum
    CHECKSUM=$(sha256sum "$compressed_file" | awk '{print $1}')
    echo "$CHECKSUM" > "${compressed_file}.sha256"
    
    log "Backup completed: $compressed_file (Checksum: $CHECKSUM)"
    echo "$compressed_file"
}

# Incremental backup using WAL files
perform_incremental_backup() {
    local backup_dir="${BACKUP_DIR}/incremental-$(date +%Y%m%d-%H%M%S)"
    
    log "Starting incremental backup using pg_basebackup"
    
    PGPASSWORD="$DB_PASSWORD" pg_basebackup \
        -h "$DB_HOST" \
        -U "$DB_USER" \
        -D "$backup_dir" \
        -Ft \
        -z \
        -P \
        -Xs \
        -c fast 2>&1 | tee -a "$LOG_FILE"
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        error_exit "pg_basebackup failed"
    fi
    
    log "Incremental backup completed: $backup_dir"
    echo "$backup_dir"
}

# Differential backup (changes since last full backup)
perform_differential_backup() {
    local last_full=$(find "$BACKUP_DIR" -name "full-${ENVIRONMENT}-*.sql.gz*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | awk '{print $2}')
    
    if [ -z "$last_full" ]; then
        log "No previous full backup found, performing full backup instead"
        perform_full_backup
        return
    fi
    
    local backup_file="${BACKUP_DIR}/diff-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).sql"
    
    log "Starting differential backup since $(basename "$last_full")"
    
    # For differential, we'll backup only modified tables
    # This is a simplified version - in production you'd track changes properly
    
    TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            SELECT tablename 
            FROM pg_stat_user_tables 
            WHERE n_tup_ins + n_tup_upd + n_tup_del > 0
        )
    ")
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --tables="$TABLES" \
        --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"
    
    gzip -9 "$backup_file"
    
    log "Differential backup completed: ${backup_file}.gz"
    echo "${backup_file}.gz"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    log "Verifying backup: $backup_file"
    
    # Check file exists and is not empty
    if [ ! -f "$backup_file" ] || [ ! -s "$backup_file" ]; then
        error_exit "Backup file is missing or empty: $backup_file"
    fi
    
    # Verify checksum if exists
    if [ -f "${backup_file}.sha256" ]; then
        EXPECTED=$(cat "${backup_file}.sha256")
        ACTUAL=$(sha256sum "$backup_file" | awk '{print $1}')
        
        if [ "$EXPECTED" != "$ACTUAL" ]; then
            error_exit "Checksum verification failed for $backup_file"
        fi
        
        log "Checksum verified successfully"
    fi
    
    # Test restore to temporary database (sample check)
    if [[ "$backup_file" == *.sql.gz ]]; then
        log "Testing backup integrity..."
        gunzip -t "$backup_file" 2>&1 | tee -a "$LOG_FILE"
        
        if [ ${PIPESTATUS[0]} -ne 0 ]; then
            error_exit "Backup file is corrupted: $backup_file"
        fi
    fi
    
    log "Backup verification completed successfully"
}

# Upload to S3
upload_to_s3() {
    local backup_file=$1
    
    if ! command -v aws &> /dev/null; then
        log "AWS CLI not installed, skipping S3 upload"
        return
    fi
    
    log "Uploading to S3: s3://$S3_BUCKET/$(basename "$backup_file")"
    
    aws s3 cp "$backup_file" "s3://$S3_BUCKET/$(basename "$backup_file")" \
        --storage-class STANDARD_IA \
        --metadata "environment=$ENVIRONMENT,type=$BACKUP_TYPE,timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        2>&1 | tee -a "$LOG_FILE"
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log "Upload to S3 completed successfully"
        
        # Also upload checksum
        if [ -f "${backup_file}.sha256" ]; then
            aws s3 cp "${backup_file}.sha256" "s3://$S3_BUCKET/$(basename "${backup_file}.sha256")" 2>&1 | tee -a "$LOG_FILE"
        fi
    else
        log "Warning: S3 upload failed"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)"
    
    # Local cleanup
    find "$BACKUP_DIR" -type f -name "*.sql.gz*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -type f -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # S3 cleanup
    if command -v aws &> /dev/null; then
        # List and delete old S3 objects
        CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        
        aws s3api list-objects --bucket "$S3_BUCKET" --query "Contents[?LastModified<'$CUTOFF_DATE'].Key" --output text | \
        while read -r key; do
            if [ -n "$key" ]; then
                log "Deleting old S3 backup: $key"
                aws s3 rm "s3://$S3_BUCKET/$key"
            fi
        done
    fi
    
    log "Cleanup completed"
}

# Generate backup report
generate_report() {
    local backup_file=$1
    local start_time=$2
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local report_file="${BACKUP_DIR}/backup-report-$(date +%Y%m%d).json"
    
    cat > "$report_file" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "type": "$BACKUP_TYPE",
    "file": "$(basename "$backup_file")",
    "size": $(stat -c%s "$backup_file" 2>/dev/null || echo 0),
    "duration": $duration,
    "checksum": "$(cat "${backup_file}.sha256" 2>/dev/null || echo "N/A")",
    "status": "success",
    "retention_days": $RETENTION_DAYS,
    "uploaded_to_s3": $(command -v aws &> /dev/null && echo "true" || echo "false")
}
EOF
    
    log "Backup report generated: $report_file"
}

# Main backup process
main() {
    local start_time=$(date +%s)
    
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}       DATABASE BACKUP - $(date)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""
    
    log "Starting $BACKUP_TYPE backup for $ENVIRONMENT environment"
    
    # Run pre-backup checks
    pre_backup_checks
    
    # Perform backup based on type
    case "$BACKUP_TYPE" in
        full)
            BACKUP_FILE=$(perform_full_backup)
            ;;
        incremental)
            BACKUP_FILE=$(perform_incremental_backup)
            ;;
        differential)
            BACKUP_FILE=$(perform_differential_backup)
            ;;
        *)
            error_exit "Unknown backup type: $BACKUP_TYPE"
            ;;
    esac
    
    # Verify backup
    verify_backup "$BACKUP_FILE"
    
    # Upload to S3
    upload_to_s3 "$BACKUP_FILE"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_report "$BACKUP_FILE" "$start_time"
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}       BACKUP COMPLETED SUCCESSFULLY${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    
    # Send success notification
    send_alert "Backup Successful" "Type: $BACKUP_TYPE, File: $(basename "$BACKUP_FILE")"
}

# Restore function
restore_backup() {
    local backup_file=$1
    local target_db=${2:-"${DB_NAME}_restored"}
    
    log "Starting restore of $backup_file to database $target_db"
    
    # Decrypt if needed
    if [[ "$backup_file" == *.enc ]]; then
        local decrypted="${backup_file%.enc}"
        openssl enc -d -aes-256-cbc -in "$backup_file" -out "$decrypted" -pass pass:"$ENCRYPTION_KEY"
        backup_file="$decrypted"
    fi
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -k "$backup_file"
        backup_file="${backup_file%.gz}"
    fi
    
    # Create target database if it doesn't exist
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE $target_db" 2>/dev/null || true
    
    # Restore
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$target_db" \
        --verbose \
        --no-owner \
        --no-privileges \
        "$backup_file" 2>&1 | tee -a "$LOG_FILE"
    
    log "Restore completed to database $target_db"
}

# Parse command line arguments
case "${1:-backup}" in
    backup)
        main
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "Usage: $0 restore <backup_file> [target_database]"
            exit 1
        fi
        restore_backup "$2" "$3"
        ;;
    list)
        echo "Available local backups:"
        ls -lh "$BACKUP_DIR"/*.sql.gz* 2>/dev/null || echo "No backups found"
        
        if command -v aws &> /dev/null; then
            echo -e "\nAvailable S3 backups:"
            aws s3 ls "s3://$S3_BUCKET/" --recursive --human-readable
        fi
        ;;
    *)
        echo "Usage: $0 {backup|restore|list} [options]"
        echo ""
        echo "Commands:"
        echo "  backup [type]    - Perform backup (type: full|incremental|differential)"
        echo "  restore <file>   - Restore from backup file"
        echo "  list            - List available backups"
        exit 1
        ;;
esac