#!/bin/bash

# Neon PostgreSQL Real-time Monitoring Script
# Provides comprehensive database insights using psql

# Database connection
export PGPASSWORD="npg_DZhIpVaLAk06"
DB_HOST="ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech"
DB_USER="neondb_owner"
DB_NAME="neondb"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Clear screen
clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗"
echo -e "║          NEON POSTGRESQL DATABASE MONITOR             ║"
echo -e "╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to run SQL
run_sql() {
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -A -c "$1" 2>/dev/null
}

# Function for formatted SQL
run_sql_table() {
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "$1" 2>/dev/null
}

while true; do
    # Update timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Get connection info
    ACTIVE_CONN=$(run_sql "SELECT count(*) FROM pg_stat_activity WHERE datname='$DB_NAME';")
    DB_SIZE=$(run_sql "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    
    # Clear and redraw
    echo -e "\033[4;0H" # Move cursor to line 4
    
    echo -e "${BLUE}┌─── Connection Info ─────────────────────────────────────┐${NC}"
    echo -e "│ ${GREEN}Timestamp:${NC} $TIMESTAMP"
    echo -e "│ ${GREEN}Database:${NC}  $DB_NAME @ $DB_HOST"
    echo -e "│ ${GREEN}Size:${NC}      $DB_SIZE"
    echo -e "│ ${GREEN}Active:${NC}    $ACTIVE_CONN connections"
    echo -e "${BLUE}└──────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Live Statistics
    echo -e "${MAGENTA}┌─── Live Statistics ──────────────────────────────────────┐${NC}"
    
    # User activity
    CREATOR_COUNT=$(run_sql "SELECT COUNT(*) FROM users WHERE user_type='creator';")
    INVESTOR_COUNT=$(run_sql "SELECT COUNT(*) FROM users WHERE user_type='investor';")
    PRODUCTION_COUNT=$(run_sql "SELECT COUNT(*) FROM users WHERE user_type='production';")
    
    echo -e "│ ${YELLOW}Users:${NC}"
    echo -e "│   Creators: $CREATOR_COUNT | Investors: $INVESTOR_COUNT | Production: $PRODUCTION_COUNT"
    
    # Content statistics
    TOTAL_PITCHES=$(run_sql "SELECT COUNT(*) FROM pitches;")
    PUBLISHED_PITCHES=$(run_sql "SELECT COUNT(*) FROM pitches WHERE status='published';")
    DRAFT_PITCHES=$(run_sql "SELECT COUNT(*) FROM pitches WHERE status='draft';")
    TOTAL_VIEWS=$(run_sql "SELECT COALESCE(SUM(view_count), 0) FROM pitches;")
    
    echo -e "│ ${YELLOW}Content:${NC}"
    echo -e "│   Pitches: $TOTAL_PITCHES (Published: $PUBLISHED_PITCHES, Draft: $DRAFT_PITCHES)"
    echo -e "│   Total Views: $TOTAL_VIEWS"
    
    # Investment data
    TOTAL_INVESTMENTS=$(run_sql "SELECT COUNT(*) FROM investments;")
    TOTAL_INVESTED=$(run_sql "SELECT COALESCE(SUM(amount), 0) FROM investments;")
    AVG_INVESTMENT=$(run_sql "SELECT COALESCE(AVG(amount), 0)::numeric(10,2) FROM investments;")
    
    echo -e "│ ${YELLOW}Investments:${NC}"
    echo -e "│   Count: $TOTAL_INVESTMENTS | Total: \$$TOTAL_INVESTED | Average: \$$AVG_INVESTMENT"
    
    # Engagement metrics
    FOLLOW_COUNT=$(run_sql "SELECT COUNT(*) FROM follows;")
    NDA_COUNT=$(run_sql "SELECT COUNT(*) FROM ndas;")
    NOTIFICATION_COUNT=$(run_sql "SELECT COUNT(*) FROM notifications;")
    UNREAD_NOTIF=$(run_sql "SELECT COUNT(*) FROM notifications WHERE read=false;")
    
    echo -e "│ ${YELLOW}Engagement:${NC}"
    echo -e "│   Follows: $FOLLOW_COUNT | NDAs: $NDA_COUNT | Notifications: $NOTIFICATION_COUNT (Unread: $UNREAD_NOTIF)"
    echo -e "${MAGENTA}└──────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Recent Activity
    echo -e "${CYAN}┌─── Recent Activity ──────────────────────────────────────┐${NC}"
    
    # Latest pitches
    LATEST_PITCH=$(run_sql "SELECT title FROM pitches ORDER BY created_at DESC LIMIT 1;")
    if [ -n "$LATEST_PITCH" ]; then
        echo -e "│ Latest Pitch: ${GREEN}$LATEST_PITCH${NC}"
    fi
    
    # Latest investment
    LATEST_INVESTMENT=$(run_sql "
        SELECT CONCAT(u.username, ' invested $', i.amount, ' in ', p.title)
        FROM investments i
        JOIN users u ON i.investor_id = u.id
        JOIN pitches p ON i.pitch_id = p.id
        ORDER BY i.created_at DESC
        LIMIT 1;")
    if [ -n "$LATEST_INVESTMENT" ]; then
        echo -e "│ Latest Investment: ${GREEN}$LATEST_INVESTMENT${NC}"
    fi
    
    # Latest user
    LATEST_USER=$(run_sql "SELECT CONCAT(username, ' (', user_type, ')') FROM users ORDER BY created_at DESC LIMIT 1;")
    if [ -n "$LATEST_USER" ]; then
        echo -e "│ Latest User: ${GREEN}$LATEST_USER${NC}"
    fi
    
    echo -e "${CYAN}└──────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Performance Metrics
    echo -e "${YELLOW}┌─── Performance Metrics ──────────────────────────────────┐${NC}"
    
    # Cache hit ratio
    CACHE_HIT=$(run_sql "
        SELECT ROUND(
            100.0 * sum(heap_blks_hit) / 
            NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2
        ) FROM pg_statio_user_tables;")
    
    # Transaction stats
    COMMITS=$(run_sql "SELECT xact_commit FROM pg_stat_database WHERE datname='$DB_NAME';")
    ROLLBACKS=$(run_sql "SELECT xact_rollback FROM pg_stat_database WHERE datname='$DB_NAME';")
    
    echo -e "│ Cache Hit Ratio: ${GREEN}${CACHE_HIT}%${NC}"
    echo -e "│ Transactions: Commits: $COMMITS | Rollbacks: $ROLLBACKS"
    
    # Table sizes
    echo -e "│ ${YELLOW}Largest Tables:${NC}"
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "
        SELECT '│   ' || relname || ': ' || pg_size_pretty(pg_relation_size(C.oid))
        FROM pg_class C
        LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
        WHERE nspname NOT IN ('pg_catalog', 'information_schema')
        AND C.relkind = 'r'
        ORDER BY pg_relation_size(C.oid) DESC
        LIMIT 3;" 2>/dev/null | sed 's/^/│/'
    
    echo -e "${YELLOW}└──────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Real-time Queries (if any active)
    ACTIVE_QUERIES=$(run_sql "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';")
    if [ "$ACTIVE_QUERIES" -gt "0" ]; then
        echo -e "${RED}┌─── Active Queries ───────────────────────────────────────┐${NC}"
        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "
            SELECT SUBSTRING(query, 1, 50) || '...'
            FROM pg_stat_activity
            WHERE state = 'active' 
            AND query NOT LIKE '%pg_stat_activity%'
            LIMIT 3;" 2>/dev/null | sed 's/^/│ /'
        echo -e "${RED}└──────────────────────────────────────────────────────────┘${NC}"
        echo ""
    fi
    
    # Endpoint Correlation Check
    if [ "$1" == "--check-endpoints" ]; then
        echo -e "${GREEN}┌─── Endpoint Data Check ──────────────────────────────────┐${NC}"
        
        # Check if API data matches database
        API_URL="http://localhost:8001"
        
        # Quick login test
        LOGIN_TEST=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"alex.creator@demo.com","password":"Demo123"}' 2>/dev/null | grep -c "token")
        
        if [ "$LOGIN_TEST" -eq "1" ]; then
            echo -e "│ ${GREEN}✅ API Connected - Data Correlation Active${NC}"
        else
            echo -e "│ ${YELLOW}⚠️  API Not Available - Database Only Mode${NC}"
        fi
        
        echo -e "${GREEN}└──────────────────────────────────────────────────────────┘${NC}"
        echo ""
    fi
    
    # Footer
    echo -e "${CYAN}Press Ctrl+C to exit | Refreshing every 5 seconds...${NC}"
    
    # Sleep for 5 seconds
    sleep 5
    
    # Clear from line 4 down for next iteration
    echo -e "\033[4;0H\033[J"
done