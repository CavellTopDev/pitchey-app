#!/bin/bash

# =============================================================================
# Production Monitoring and Alerting Setup
# =============================================================================
# Sets up comprehensive monitoring for the Pitchey platform including:
# - Health check endpoints
# - Performance monitoring
# - Error tracking with Sentry
# - Database monitoring
# - Real-time alerts
# - Uptime monitoring

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/monitoring-setup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" >&2
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            echo "[$timestamp] [WARN] $message" >> "$LOG_FILE"
            ;;
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG]${NC} $message"
            echo "[$timestamp] [DEBUG] $message" >> "$LOG_FILE"
            ;;
    esac
}

# Setup Sentry for error tracking
setup_sentry() {
    log INFO "Setting up Sentry error tracking..."
    
    # Check if Sentry CLI is installed
    if ! command -v sentry-cli &> /dev/null; then
        log INFO "Installing Sentry CLI..."
        curl -sL https://sentry.io/get-cli/ | bash
    fi
    
    # Create Sentry configuration
    cat > "$PROJECT_ROOT/.sentryclirc" << EOF
[defaults]
url=https://sentry.io/
org=${SENTRY_ORG:-pitchey}
project=${SENTRY_PROJECT:-pitchey-platform}

[auth]
token=${SENTRY_AUTH_TOKEN}
EOF
    
    # Create Sentry release
    local release_name="pitchey@$(git rev-parse --short HEAD)"
    sentry-cli releases new "$release_name" || log WARN "Failed to create Sentry release"
    sentry-cli releases set-commits "$release_name" --auto || log WARN "Failed to set commits for Sentry release"
    
    # Set up source maps for frontend
    if [ -d "$PROJECT_ROOT/frontend/dist" ]; then
        log INFO "Uploading source maps to Sentry..."
        sentry-cli releases files "$release_name" upload-sourcemaps \
            "$PROJECT_ROOT/frontend/dist" \
            --url-prefix "~/" \
            --rewrite || log WARN "Failed to upload source maps"
    fi
    
    # Finalize release
    sentry-cli releases finalize "$release_name" || log WARN "Failed to finalize Sentry release"
    
    log INFO "Sentry setup completed"
}

# Setup health check monitoring
setup_health_checks() {
    log INFO "Setting up health check monitoring..."
    
    cat > "$PROJECT_ROOT/scripts/health-monitor.sh" << 'EOF'
#!/bin/bash

# Health Check Monitor
# Monitors all critical endpoints and services

ENDPOINTS=(
    "https://pitchey.pages.dev"
    "https://pitchey-production.cavelltheleaddev.workers.dev/api/health"
    "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/trending"
)

DB_CHECK_URL="https://pitchey-production.cavelltheleaddev.workers.dev/api/health/database"
WEBSOCKET_URL="wss://pitchey-production.cavelltheleaddev.workers.dev/ws"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_health() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> /var/log/pitchey-health.log
}

# Check HTTP endpoints
for endpoint in "${ENDPOINTS[@]}"; do
    if curl -sf "$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $endpoint - Healthy"
        log_health "HEALTHY: $endpoint"
    else
        echo -e "${RED}✗${NC} $endpoint - Failed"
        log_health "FAILED: $endpoint"
        # Send alert (implement your alerting mechanism)
        curl -X POST "${SLACK_WEBHOOK_URL:-}" -d "{\"text\":\"🚨 Health check failed for $endpoint\"}" || true
    fi
done

# Check database connectivity
if curl -sf "$DB_CHECK_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database - Connected"
    log_health "HEALTHY: Database connection"
else
    echo -e "${RED}✗${NC} Database - Failed"
    log_health "FAILED: Database connection"
fi

# Check WebSocket connectivity
if timeout 10 node -e "
const WebSocket = require('ws');
const ws = new WebSocket('$WEBSOCKET_URL');
ws.on('open', () => {
    console.log('WebSocket connected');
    ws.close();
    process.exit(0);
});
ws.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 5000);
" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} WebSocket - Connected"
    log_health "HEALTHY: WebSocket connection"
else
    echo -e "${YELLOW}⚠${NC} WebSocket - Failed (non-critical)"
    log_health "WARNING: WebSocket connection failed"
fi
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/health-monitor.sh"
    log INFO "Health check monitor created"
}

# Setup performance monitoring
setup_performance_monitoring() {
    log INFO "Setting up performance monitoring..."
    
    cat > "$PROJECT_ROOT/scripts/performance-monitor.js" << 'EOF'
#!/usr/bin/env node

// Performance Monitor
// Tracks key metrics for the platform

const https = require('https');
const { performance } = require('perf_hooks');

const ENDPOINTS = [
    'https://pitchey.pages.dev',
    'https://pitchey-production.cavelltheleaddev.workers.dev/api/health',
    'https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/trending'
];

async function measureResponseTime(url) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        
        https.get(url, (res) => {
            const end = performance.now();
            const responseTime = Math.round(end - start);
            
            resolve({
                url,
                statusCode: res.statusCode,
                responseTime,
                timestamp: new Date().toISOString()
            });
        }).on('error', (err) => {
            reject({ url, error: err.message });
        });
    });
}

async function runPerformanceTests() {
    console.log('Running performance tests...');
    
    for (const endpoint of ENDPOINTS) {
        try {
            const result = await measureResponseTime(endpoint);
            
            // Log results
            console.log(`${result.url}: ${result.responseTime}ms (${result.statusCode})`);
            
            // Alert if response time is too high
            if (result.responseTime > 5000) {
                console.warn(`⚠️  Slow response detected: ${result.url} took ${result.responseTime}ms`);
                // Send alert
                if (process.env.SLACK_WEBHOOK_URL) {
                    // Implement Slack notification
                }
            }
            
            // Alert if status is not 200
            if (result.statusCode !== 200) {
                console.error(`❌ Error status: ${result.url} returned ${result.statusCode}`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to test ${error.url}: ${error.error}`);
        }
    }
}

runPerformanceTests().catch(console.error);
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/performance-monitor.js"
    log INFO "Performance monitor created"
}

# Setup database monitoring
setup_database_monitoring() {
    log INFO "Setting up database monitoring..."
    
    cat > "$PROJECT_ROOT/scripts/database-monitor.ts" << 'EOF'
#!/usr/bin/env deno run --allow-env --allow-net

// Database Monitor
// Monitors database performance and connection health

import { neon } from 'https://deno.land/x/neon@0.2.0/mod.ts';

const DATABASE_URL = Deno.env.get('DATABASE_URL');
if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    Deno.exit(1);
}

const sql = neon(DATABASE_URL);

async function checkDatabaseHealth() {
    console.log('Checking database health...');
    
    try {
        // Basic connectivity test
        const start = performance.now();
        await sql`SELECT 1 as health_check`;
        const connectionTime = Math.round(performance.now() - start);
        
        console.log(`✅ Database connection: ${connectionTime}ms`);
        
        // Check critical tables
        const tables = ['users', 'pitches', 'investments', 'notifications'];
        
        for (const table of tables) {
            try {
                const countResult = await sql`
                    SELECT COUNT(*) as count 
                    FROM information_schema.tables 
                    WHERE table_name = ${table}
                `;
                
                if (countResult[0].count > 0) {
                    console.log(`✅ Table ${table} exists`);
                } else {
                    console.error(`❌ Table ${table} missing`);
                }
            } catch (error) {
                console.error(`❌ Error checking table ${table}:`, error.message);
            }
        }
        
        // Check database size
        const sizeResult = await sql`
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as size
        `;
        console.log(`📊 Database size: ${sizeResult[0].size}`);
        
        // Check active connections
        const connectionsResult = await sql`
            SELECT count(*) as active_connections
            FROM pg_stat_activity
            WHERE state = 'active'
        `;
        console.log(`🔗 Active connections: ${connectionsResult[0].active_connections}`);
        
        // Performance metrics
        await checkSlowQueries();
        
    } catch (error) {
        console.error('❌ Database health check failed:', error.message);
        Deno.exit(1);
    }
}

async function checkSlowQueries() {
    try {
        const slowQueries = await sql`
            SELECT 
                query,
                calls,
                total_time,
                mean_time,
                rows
            FROM pg_stat_statements
            WHERE mean_time > 1000
            ORDER BY mean_time DESC
            LIMIT 5
        `;
        
        if (slowQueries.length > 0) {
            console.log('⚠️  Slow queries detected:');
            slowQueries.forEach((query, index) => {
                console.log(`${index + 1}. ${query.query.substring(0, 100)}... (${Math.round(query.mean_time)}ms avg)`);
            });
        } else {
            console.log('✅ No slow queries detected');
        }
    } catch (error) {
        console.log('ℹ️  pg_stat_statements extension not available for slow query monitoring');
    }
}

// Run the health check
await checkDatabaseHealth();
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/database-monitor.ts"
    log INFO "Database monitor created"
}

# Setup alerting system
setup_alerting() {
    log INFO "Setting up alerting system..."
    
    cat > "$PROJECT_ROOT/scripts/alert-manager.sh" << 'EOF'
#!/bin/bash

# Alert Manager
# Sends alerts to various channels (Slack, email, etc.)

send_slack_alert() {
    local message="$1"
    local severity="${2:-info}"
    local webhook_url="${SLACK_WEBHOOK_URL:-}"
    
    if [ -z "$webhook_url" ]; then
        echo "SLACK_WEBHOOK_URL not configured"
        return 1
    fi
    
    local emoji
    case $severity in
        critical) emoji="🚨" ;;
        warning) emoji="⚠️" ;;
        info) emoji="ℹ️" ;;
        success) emoji="✅" ;;
        *) emoji="📝" ;;
    esac
    
    curl -X POST "$webhook_url" \
        -H 'Content-type: application/json' \
        -d "{\"text\":\"$emoji Pitchey Platform: $message\"}" \
        --silent --fail
}

send_email_alert() {
    local subject="$1"
    local message="$2"
    local email="${ALERT_EMAIL:-}"
    
    if [ -z "$email" ]; then
        echo "ALERT_EMAIL not configured"
        return 1
    fi
    
    # Using sendmail (configure as needed)
    {
        echo "To: $email"
        echo "Subject: [Pitchey Alert] $subject"
        echo ""
        echo "$message"
    } | sendmail "$email" || echo "Failed to send email alert"
}

# Function to handle different types of alerts
handle_alert() {
    local type="$1"
    local message="$2"
    local severity="${3:-info}"
    
    echo "[$(date)] $type: $message"
    
    # Log to file
    echo "[$(date)] [$severity] $type: $message" >> /var/log/pitchey-alerts.log
    
    # Send to configured channels
    send_slack_alert "$message" "$severity"
    send_email_alert "$type" "$message"
}

# Export functions for use in other scripts
export -f handle_alert
export -f send_slack_alert
export -f send_email_alert
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/alert-manager.sh"
    log INFO "Alert manager created"
}

# Setup automated backup system
setup_backup_system() {
    log INFO "Setting up automated backup system..."
    
    cat > "$PROJECT_ROOT/scripts/backup-system.sh" << 'EOF'
#!/bin/bash

# Automated Backup System
# Backs up database and critical files

set -euo pipefail

BACKUP_DIR="/var/backups/pitchey"
LOG_FILE="/var/log/pitchey-backup.log"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

log_backup() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

# Database backup
backup_database() {
    log_backup "Starting database backup..."
    
    local backup_file="$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sql"
    
    # Using pg_dump via connection string
    if pg_dump "$DATABASE_URL" > "$backup_file"; then
        log_backup "Database backup completed: $backup_file"
        gzip "$backup_file"
        log_backup "Database backup compressed"
    else
        log_backup "Database backup failed"
        return 1
    fi
}

# File backup
backup_files() {
    log_backup "Starting file backup..."
    
    local backup_file="$BACKUP_DIR/files_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    # Backup critical configuration files
    tar -czf "$backup_file" \
        wrangler.toml \
        .sentryclirc \
        .env.production \
        scripts/ \
        frontend/dist/ \
        src/worker-platform-complete.ts \
        2>/dev/null || true
    
    log_backup "File backup completed: $backup_file"
}

# Cleanup old backups
cleanup_old_backups() {
    log_backup "Cleaning up old backups..."
    
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    log_backup "Old backups cleaned up"
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    local backup_file="$1"
    
    if [ -n "${AWS_S3_BUCKET:-}" ]; then
        aws s3 cp "$backup_file" "s3://$AWS_S3_BUCKET/pitchey-backups/" || log_backup "Failed to upload to S3"
    fi
    
    if [ -n "${CLOUDFLARE_R2_BUCKET:-}" ]; then
        # Upload to Cloudflare R2 using rclone or aws cli with R2 endpoints
        log_backup "R2 upload not implemented yet"
    fi
}

# Main backup function
main() {
    log_backup "Starting backup process..."
    
    backup_database
    backup_files
    cleanup_old_backups
    
    # Upload latest backups to cloud storage
    local latest_db_backup=$(ls -t "$BACKUP_DIR"/database_*.sql.gz | head -n1)
    local latest_file_backup=$(ls -t "$BACKUP_DIR"/files_*.tar.gz | head -n1)
    
    upload_to_cloud "$latest_db_backup"
    upload_to_cloud "$latest_file_backup"
    
    log_backup "Backup process completed"
}

main "$@"
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/backup-system.sh"
    log INFO "Backup system created"
}

# Setup cron jobs for monitoring
setup_cron_jobs() {
    log INFO "Setting up cron jobs for automated monitoring..."
    
    cat > "$PROJECT_ROOT/scripts/setup-cron.sh" << 'EOF'
#!/bin/bash

# Setup monitoring cron jobs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Add cron jobs
(crontab -l 2>/dev/null; cat << CRON
# Pitchey Platform Monitoring

# Health checks every 5 minutes
*/5 * * * * $SCRIPT_DIR/health-monitor.sh

# Performance monitoring every 15 minutes
*/15 * * * * $SCRIPT_DIR/performance-monitor.js

# Database monitoring every hour
0 * * * * $SCRIPT_DIR/database-monitor.ts

# Daily backup at 2 AM
0 2 * * * $SCRIPT_DIR/backup-system.sh

# Weekly cleanup at 3 AM on Sunday
0 3 * * 0 find /var/log/pitchey* -mtime +7 -delete

CRON
) | crontab -

echo "Cron jobs configured successfully"
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/setup-cron.sh"
    log INFO "Cron setup script created"
}

# Create monitoring dashboard
create_monitoring_dashboard() {
    log INFO "Creating monitoring dashboard..."
    
    cat > "$PROJECT_ROOT/monitoring-dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey Platform - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .status-healthy { border-left: 4px solid #10b981; }
        .status-warning { border-left: 4px solid #f59e0b; }
        .status-error { border-left: 4px solid #ef4444; }
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Pitchey Platform - Monitoring Dashboard</h1>
            <p>Real-time monitoring and health status</p>
        </div>
        
        <div class="status-grid">
            <div class="status-card status-healthy">
                <h3>🌐 Frontend Status</h3>
                <p>URL: <a href="https://pitchey.pages.dev" target="_blank">pitchey.pages.dev</a></p>
                <p>Status: <span id="frontend-status">Checking...</span></p>
                <p>Response Time: <span id="frontend-response">-</span>ms</p>
            </div>
            
            <div class="status-card status-healthy">
                <h3>⚙️ API Worker Status</h3>
                <p>URL: <a href="https://pitchey-production.cavelltheleaddev.workers.dev" target="_blank">Worker API</a></p>
                <p>Status: <span id="api-status">Checking...</span></p>
                <p>Response Time: <span id="api-response">-</span>ms</p>
            </div>
            
            <div class="status-card status-healthy">
                <h3>💾 Database Status</h3>
                <p>Type: Neon PostgreSQL</p>
                <p>Status: <span id="db-status">Checking...</span></p>
                <p>Connections: <span id="db-connections">-</span></p>
            </div>
            
            <div class="status-card status-warning">
                <h3>🔌 WebSocket Status</h3>
                <p>URL: wss://pitchey-production.cavelltheleaddev.workers.dev/ws</p>
                <p>Status: <span id="ws-status">Checking...</span></p>
                <p>Last Check: <span id="ws-last-check">-</span></p>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>📊 Response Time Trends</h3>
            <canvas id="responseTimeChart" width="400" height="200"></canvas>
        </div>
        
        <div class="chart-container">
            <h3>📈 System Metrics</h3>
            <canvas id="systemMetricsChart" width="400" height="200"></canvas>
        </div>
    </div>
    
    <script>
        // Initialize charts
        const responseTimeChart = new Chart(document.getElementById('responseTimeChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Frontend',
                    data: [],
                    borderColor: 'rgb(16, 185, 129)',
                    tension: 0.1
                }, {
                    label: 'API',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    }
                }
            }
        });
        
        // Health check functions
        async function checkEndpoint(url) {
            try {
                const start = performance.now();
                const response = await fetch(url, { mode: 'no-cors' });
                const end = performance.now();
                
                return {
                    status: 'healthy',
                    responseTime: Math.round(end - start)
                };
            } catch (error) {
                return {
                    status: 'error',
                    responseTime: null,
                    error: error.message
                };
            }
        }
        
        // Update dashboard
        async function updateDashboard() {
            // Frontend check
            const frontendResult = await checkEndpoint('https://pitchey.pages.dev');
            document.getElementById('frontend-status').textContent = frontendResult.status;
            document.getElementById('frontend-response').textContent = frontendResult.responseTime || 'N/A';
            
            // API check
            const apiResult = await checkEndpoint('https://pitchey-production.cavelltheleaddev.workers.dev/api/health');
            document.getElementById('api-status').textContent = apiResult.status;
            document.getElementById('api-response').textContent = apiResult.responseTime || 'N/A';
            
            // Update chart
            const now = new Date().toLocaleTimeString();
            responseTimeChart.data.labels.push(now);
            responseTimeChart.data.datasets[0].data.push(frontendResult.responseTime || 0);
            responseTimeChart.data.datasets[1].data.push(apiResult.responseTime || 0);
            
            // Keep only last 20 data points
            if (responseTimeChart.data.labels.length > 20) {
                responseTimeChart.data.labels.shift();
                responseTimeChart.data.datasets[0].data.shift();
                responseTimeChart.data.datasets[1].data.shift();
            }
            
            responseTimeChart.update();
        }
        
        // Initial update and set interval
        updateDashboard();
        setInterval(updateDashboard, 30000); // Update every 30 seconds
    </script>
</body>
</html>
EOF
    
    log INFO "Monitoring dashboard created"
}

# Main function
main() {
    log INFO "Starting monitoring and alerting setup..."
    
    # Create directories
    mkdir -p "$PROJECT_ROOT/scripts"
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    # Setup all monitoring components
    setup_sentry
    setup_health_checks
    setup_performance_monitoring
    setup_database_monitoring
    setup_alerting
    setup_backup_system
    setup_cron_jobs
    create_monitoring_dashboard
    
    log INFO "Monitoring and alerting setup completed!"
    
    echo
    echo "🎉 Monitoring Setup Complete!"
    echo
    echo "Next steps:"
    echo "1. Configure environment variables:"
    echo "   - SENTRY_AUTH_TOKEN"
    echo "   - SLACK_WEBHOOK_URL"
    echo "   - ALERT_EMAIL"
    echo
    echo "2. Run the cron setup: ./scripts/setup-cron.sh"
    echo "3. Test health checks: ./scripts/health-monitor.sh"
    echo "4. View monitoring dashboard: open monitoring-dashboard.html"
    echo
    echo "Files created:"
    echo "- scripts/health-monitor.sh"
    echo "- scripts/performance-monitor.js"
    echo "- scripts/database-monitor.ts"
    echo "- scripts/alert-manager.sh"
    echo "- scripts/backup-system.sh"
    echo "- scripts/setup-cron.sh"
    echo "- monitoring-dashboard.html"
}

# Run main function
main "$@"