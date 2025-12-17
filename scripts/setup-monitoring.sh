#!/bin/bash

# Comprehensive Monitoring Setup Script for Pitchey Platform
# Sets up monitoring, alerting, and observability stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running on supported OS
    if [[ "$OSTYPE" != "linux-gnu"* ]] && [[ "$OSTYPE" != "darwin"* ]]; then
        error "This script supports Linux and macOS only"
    fi
    
    # Check if required tools are installed
    local required_tools=("curl" "jq" "wrangler")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is required but not installed. Please install it and try again."
        fi
    done
    
    success "Prerequisites check passed"
}

# Setup monitoring directories
setup_directories() {
    log "Setting up monitoring directories..."
    
    local dirs=(
        "monitoring/alerting"
        "monitoring/chaos"
        "monitoring/cost"
        "monitoring/grafana-dashboards"
        "monitoring/logging"
        "monitoring/synthetic"
        "monitoring/config"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log "Created directory: $dir"
        fi
    done
    
    success "Monitoring directories setup complete"
}

# Install monitoring dependencies
install_dependencies() {
    log "Installing monitoring dependencies..."
    
    # Install npm packages for monitoring
    if [[ -f "package.json" ]]; then
        npm install --save-dev \
            @types/node \
            typescript \
            jest \
            supertest \
            @types/supertest
        success "npm monitoring dependencies installed"
    fi
    
    # Install Python packages for synthetic monitoring (if Python is available)
    if command -v python3 &> /dev/null; then
        if command -v pip3 &> /dev/null; then
            pip3 install --user \
                requests \
                prometheus-client \
                pyyaml \
                schedule
            success "Python monitoring dependencies installed"
        fi
    fi
}

# Configure Sentry
setup_sentry() {
    log "Setting up Sentry configuration..."
    
    if [[ -z "${SENTRY_DSN:-}" ]]; then
        warn "SENTRY_DSN not set. Sentry monitoring will not be available."
        warn "Set SENTRY_DSN in your environment or wrangler.toml to enable Sentry."
        return 0
    fi
    
    # Create Sentry configuration
    cat > "monitoring/config/sentry.json" <<EOF
{
  "dsn": "${SENTRY_DSN}",
  "environment": "${ENVIRONMENT:-production}",
  "release": "${VERSION:-1.0.0}",
  "tracesSampleRate": 0.1,
  "beforeSend": {
    "filterSensitiveData": true,
    "maxBreadcrumbs": 50
  },
  "integrations": {
    "http": true,
    "console": true,
    "linkedErrors": true
  }
}
EOF
    
    success "Sentry configuration created"
}

# Setup Prometheus configuration
setup_prometheus_config() {
    log "Setting up Prometheus configuration..."
    
    cat > "monitoring/config/prometheus.yml" <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'pitchey-api'
    static_configs:
      - targets: ['${API_URL:-localhost:8001}']
    metrics_path: '/api/monitoring/metrics'
    scrape_interval: 30s
    params:
      format: ['prometheus']

  - job_name: 'synthetic-monitoring'
    static_configs:
      - targets: ['${API_URL:-localhost:8001}']
    metrics_path: '/api/monitoring/synthetic'
    scrape_interval: 60s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

remote_write:
  - url: "${PROMETHEUS_REMOTE_WRITE_URL:-}"
    headers:
      Authorization: "Bearer ${PROMETHEUS_REMOTE_WRITE_TOKEN:-}"
EOF
    
    success "Prometheus configuration created"
}

# Setup alert rules
setup_alert_rules() {
    log "Setting up Prometheus alert rules..."
    
    cat > "monitoring/alerting/alert_rules.yml" <<EOF
groups:
- name: pitchey.rules
  rules:
  - alert: HighErrorRate
    expr: rate(pitchey_http_errors_total[5m]) / rate(pitchey_http_requests_total[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
      service: pitchey-api
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ \$value | humanizePercentage }} for the last 5 minutes"
      runbook_url: "https://docs.pitchey.com/runbooks/high-error-rate"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(pitchey_http_response_time_bucket[5m])) > 3000
    for: 5m
    labels:
      severity: warning
      service: pitchey-api
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ \$value }}ms"
      runbook_url: "https://docs.pitchey.com/runbooks/high-response-time"

  - alert: DatabaseDown
    expr: pitchey_health_database_status != 1
    for: 1m
    labels:
      severity: critical
      service: database
    annotations:
      summary: "Database is unhealthy"
      description: "Database health check is failing"
      runbook_url: "https://docs.pitchey.com/runbooks/database-down"

  - alert: LowCacheHitRate
    expr: pitchey_cache_hit_rate < 0.7
    for: 10m
    labels:
      severity: warning
      service: cache
    annotations:
      summary: "Low cache hit rate"
      description: "Cache hit rate is {{ \$value | humanizePercentage }}"
      runbook_url: "https://docs.pitchey.com/runbooks/low-cache-hit-rate"

  - alert: SyntheticTestFailure
    expr: pitchey_synthetic_test_success == 0
    for: 2m
    labels:
      severity: critical
      service: synthetic-monitoring
    annotations:
      summary: "Synthetic test failure"
      description: "Synthetic test {{ \$labels.test }} is failing"
      runbook_url: "https://docs.pitchey.com/runbooks/synthetic-test-failure"

  - alert: HighMemoryUsage
    expr: pitchey_memory_usage_percent > 0.85
    for: 5m
    labels:
      severity: warning
      service: pitchey-api
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ \$value | humanizePercentage }}"
      runbook_url: "https://docs.pitchey.com/runbooks/high-memory-usage"

  - alert: WorkerUnhealthy
    expr: pitchey_health_worker_status != 1
    for: 3m
    labels:
      severity: critical
      service: pitchey-worker
    annotations:
      summary: "Worker is unhealthy"
      description: "Worker health check is failing"
      runbook_url: "https://docs.pitchey.com/runbooks/worker-unhealthy"
EOF
    
    success "Alert rules created"
}

# Setup Alertmanager configuration
setup_alertmanager() {
    log "Setting up Alertmanager configuration..."
    
    cat > "monitoring/alerting/alertmanager.yml" <<EOF
global:
  smtp_smarthost: '${SMTP_HOST:-localhost:587}'
  smtp_from: '${ALERT_EMAIL_FROM:-alerts@pitchey.com}'
  smtp_auth_username: '${SMTP_USERNAME:-}'
  smtp_auth_password: '${SMTP_PASSWORD:-}'

route:
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
  - match:
      severity: warning
    receiver: 'warning-alerts'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: '${WEBHOOK_URL:-http://localhost:8001/api/monitoring/alerts/webhook}'
    send_resolved: true

- name: 'critical-alerts'
  email_configs:
  - to: '${CRITICAL_ALERT_EMAIL:-ops@pitchey.com}'
    subject: '[CRITICAL] {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Service: {{ .Labels.service }}
      Severity: {{ .Labels.severity }}
      Time: {{ .StartsAt }}
      Runbook: {{ .Annotations.runbook_url }}
      {{ end }}
  slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL:-}'
    channel: '#alerts-critical'
    title: 'Critical Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

- name: 'warning-alerts'
  slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL:-}'
    channel: '#alerts-warning'
    title: 'Warning Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
- source_match:
    severity: 'critical'
  target_match:
    severity: 'warning'
  equal: ['alertname', 'service']
EOF
    
    success "Alertmanager configuration created"
}

# Setup synthetic monitoring
setup_synthetic_monitoring() {
    log "Setting up synthetic monitoring..."
    
    # Create synthetic monitoring script
    cat > "monitoring/synthetic/run_tests.py" <<'EOF'
#!/usr/bin/env python3
"""
Synthetic monitoring script for Pitchey Platform
Runs automated tests and reports results to the monitoring system
"""

import json
import time
import requests
import schedule
from datetime import datetime
import os

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8001')
MONITORING_WEBHOOK = os.getenv('MONITORING_WEBHOOK', f'{API_BASE_URL}/api/monitoring/synthetic')

def run_health_check():
    """Run basic health check test"""
    try:
        start_time = time.time()
        response = requests.get(f'{API_BASE_URL}/api/health/all', timeout=10)
        duration = (time.time() - start_time) * 1000
        
        result = {
            'test': 'health_check',
            'success': response.status_code == 200,
            'response_time': duration,
            'status_code': response.status_code,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        if response.status_code == 200:
            data = response.json()
            result['health_status'] = data.get('overall', 'unknown')
        
        # Report result
        requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
        print(f"Health check: {'PASS' if result['success'] else 'FAIL'} ({duration:.0f}ms)")
        
    except Exception as e:
        result = {
            'test': 'health_check',
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
        requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
        print(f"Health check: FAIL - {e}")

def run_api_tests():
    """Run API endpoint tests"""
    endpoints = [
        ('/api/health/live', 200),
        ('/api/health/ready', 200),
        ('/api/monitoring/metrics', 200),
    ]
    
    for endpoint, expected_status in endpoints:
        try:
            start_time = time.time()
            response = requests.get(f'{API_BASE_URL}{endpoint}', timeout=10)
            duration = (time.time() - start_time) * 1000
            
            result = {
                'test': f'api_test_{endpoint.replace("/", "_").replace("-", "_")}',
                'success': response.status_code == expected_status,
                'response_time': duration,
                'status_code': response.status_code,
                'endpoint': endpoint,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
            print(f"API test {endpoint}: {'PASS' if result['success'] else 'FAIL'} ({duration:.0f}ms)")
            
        except Exception as e:
            result = {
                'test': f'api_test_{endpoint.replace("/", "_").replace("-", "_")}',
                'success': False,
                'error': str(e),
                'endpoint': endpoint,
                'timestamp': datetime.utcnow().isoformat()
            }
            requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
            print(f"API test {endpoint}: FAIL - {e}")

def run_user_journey():
    """Run critical user journey test"""
    try:
        # Test creator login flow
        login_data = {
            'email': 'alex.creator@demo.com',
            'password': 'Demo123'
        }
        
        start_time = time.time()
        response = requests.post(
            f'{API_BASE_URL}/api/auth/creator/login', 
            json=login_data,
            timeout=10
        )
        duration = (time.time() - start_time) * 1000
        
        result = {
            'test': 'user_journey_creator_login',
            'success': response.status_code == 200,
            'response_time': duration,
            'status_code': response.status_code,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
        print(f"User journey (creator login): {'PASS' if result['success'] else 'FAIL'} ({duration:.0f}ms)")
        
    except Exception as e:
        result = {
            'test': 'user_journey_creator_login',
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }
        requests.post(MONITORING_WEBHOOK, json=result, timeout=5)
        print(f"User journey (creator login): FAIL - {e}")

def main():
    print(f"Starting synthetic monitoring for {API_BASE_URL}")
    
    # Schedule tests
    schedule.every(1).minutes.do(run_health_check)
    schedule.every(5).minutes.do(run_api_tests)
    schedule.every(15).minutes.do(run_user_journey)
    
    # Run initial tests
    run_health_check()
    run_api_tests()
    run_user_journey()
    
    # Keep running
    while True:
        schedule.run_pending()
        time.sleep(30)

if __name__ == "__main__":
    main()
EOF

    chmod +x "monitoring/synthetic/run_tests.py"
    success "Synthetic monitoring script created"
}

# Create monitoring service file
create_monitoring_service() {
    log "Creating monitoring service configuration..."
    
    cat > "monitoring/config/monitoring-service.yaml" <<EOF
# Monitoring service configuration for Pitchey Platform
service:
  name: pitchey-monitoring
  version: 1.0.0
  environment: ${ENVIRONMENT:-production}

health_checks:
  interval: 30s
  timeout: 10s
  endpoints:
    - name: overall
      path: /api/health/all
      critical: true
    - name: database
      path: /api/health/db
      critical: true
    - name: cache
      path: /api/health/cache
      critical: false
    - name: worker
      path: /api/health/worker
      critical: true

metrics:
  collection_interval: 15s
  retention: 7d
  exporters:
    - prometheus
    - cloudflare_analytics

alerting:
  enabled: true
  channels:
    slack:
      webhook_url: ${SLACK_WEBHOOK_URL:-}
      default_channel: "#alerts"
    email:
      smtp_host: ${SMTP_HOST:-}
      from: ${ALERT_EMAIL_FROM:-alerts@pitchey.com}
    pagerduty:
      integration_key: ${PAGERDUTY_INTEGRATION_KEY:-}

synthetic_monitoring:
  enabled: true
  interval: 60s
  tests:
    - name: health_check
      type: http
      url: /api/health/all
      expected_status: 200
    - name: auth_flow
      type: journey
      steps:
        - login: /api/auth/creator/login
        - dashboard: /api/creator/dashboard

dashboards:
  grafana:
    enabled: true
    datasource: prometheus
    refresh_interval: 5s
  custom:
    enabled: true
    real_time: true
EOF
    
    success "Monitoring service configuration created"
}

# Setup monitoring workers
setup_monitoring_workers() {
    log "Setting up monitoring workers..."
    
    # Create cron job for health checks
    cat > "monitoring/config/monitoring-cron" <<EOF
# Pitchey Platform Monitoring Cron Jobs

# Health checks every minute
* * * * * cd $(pwd) && curl -f ${API_URL:-http://localhost:8001}/api/health/all > /dev/null 2>&1 || echo "Health check failed at \$(date)" >> monitoring/logs/health-check.log

# Synthetic monitoring every 5 minutes
*/5 * * * * cd $(pwd) && python3 monitoring/synthetic/run_tests.py >> monitoring/logs/synthetic.log 2>&1

# Log cleanup daily at 2 AM
0 2 * * * find $(pwd)/monitoring/logs -name "*.log" -mtime +7 -delete

# Metrics collection every minute
* * * * * cd $(pwd) && curl -f ${API_URL:-http://localhost:8001}/api/monitoring/metrics > /dev/null 2>&1
EOF
    
    success "Monitoring workers setup complete"
}

# Create log directories and files
setup_logging() {
    log "Setting up logging infrastructure..."
    
    mkdir -p "monitoring/logs"
    
    # Create log rotation configuration
    cat > "monitoring/config/logrotate.conf" <<EOF
$(pwd)/monitoring/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 nobody nobody
}
EOF
    
    # Create rsyslog configuration for structured logging
    cat > "monitoring/logging/rsyslog.conf" <<EOF
# Pitchey Platform Log Configuration
\$ModLoad imfile

# Monitor application logs
\$InputFileName $(pwd)/monitoring/logs/pitchey.log
\$InputFileTag pitchey:
\$InputFileStateFile stat-pitchey
\$InputFileSeverity info
\$InputFileFacility local0
\$InputRunFileMonitor

# Log forwarding template
\$template PitcheyLogFormat,"%timestamp% %hostname% %syslogtag% %msg%\\n"

# Forward to central logging if configured
*.* @@${LOG_FORWARDING_HOST:-localhost:514};PitcheyLogFormat

# Local storage
local0.*    $(pwd)/monitoring/logs/pitchey.log
EOF
    
    success "Logging infrastructure setup complete"
}

# Generate monitoring documentation
generate_documentation() {
    log "Generating monitoring documentation..."
    
    cat > "MONITORING_SETUP.md" <<'EOF'
# Pitchey Platform Monitoring Setup

## Overview

This monitoring setup provides comprehensive observability for the Pitchey platform including:

- Health monitoring and alerting
- Performance metrics collection
- Synthetic monitoring and testing
- Real-time dashboards and visualization
- Log aggregation and analysis

## Components

### Health Monitoring
- **Endpoint**: `/api/health/*`
- **Frequency**: Every 30 seconds
- **Checks**: Database, Cache, Worker, External services

### Metrics Collection
- **Endpoint**: `/api/monitoring/metrics`
- **Format**: Prometheus compatible
- **Frequency**: Every 15 seconds
- **Retention**: 7 days local, configurable remote

### Alerting
- **Channels**: Slack, Email, PagerDuty
- **Rules**: Response time, error rate, resource usage
- **Escalation**: Based on severity and business hours

### Synthetic Monitoring
- **Tests**: Health checks, API endpoints, user journeys
- **Frequency**: 1-15 minutes depending on test
- **Reporting**: Real-time results to monitoring dashboard

## Configuration

### Environment Variables

```bash
# API Configuration
API_URL=https://your-api-domain.com
ENVIRONMENT=production
VERSION=1.0.0

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL_FROM=alerts@pitchey.com
PAGERDUTY_INTEGRATION_KEY=your-key

# SMTP for email alerts
SMTP_HOST=smtp.sendgrid.net:587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key

# Monitoring Services
SENTRY_DSN=https://your-sentry-dsn@sentry.io
PROMETHEUS_REMOTE_WRITE_URL=https://prometheus.example.com/api/v1/write
```

### Cloudflare Workers Configuration

Add to your `wrangler.toml`:

```toml
[vars]
SENTRY_DSN = "your-sentry-dsn"
ENVIRONMENT = "production"
VERSION = "1.0.0"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "pitchey_metrics"
```

## Usage

### Starting Monitoring

```bash
# Setup monitoring stack
./scripts/setup-monitoring.sh

# Start synthetic monitoring
python3 monitoring/synthetic/run_tests.py

# Install cron jobs
sudo crontab monitoring/config/monitoring-cron
```

### Accessing Dashboards

- **Health Status**: `/api/health/all`
- **Metrics**: `/api/monitoring/metrics`
- **Synthetic Results**: `/api/monitoring/synthetic`
- **Grafana** (if configured): `http://localhost:3000`

### Alerting

Alerts are automatically sent to configured channels when:
- Error rate exceeds 5%
- Response time P95 > 3 seconds
- Database or worker becomes unhealthy
- Synthetic tests fail
- Memory usage > 85%

## Troubleshooting

### Common Issues

1. **Health checks failing**
   - Check API endpoints are accessible
   - Verify database connectivity
   - Review worker logs

2. **No metrics data**
   - Ensure metrics endpoint is working
   - Check Prometheus scraping configuration
   - Verify Analytics Engine binding

3. **Alerts not firing**
   - Check alerting service configuration
   - Verify webhook/email settings
   - Review alert rule conditions

### Logs

Monitor these log files:
- `monitoring/logs/health-check.log`
- `monitoring/logs/synthetic.log`
- `monitoring/logs/pitchey.log`

### Support

For monitoring-related issues:
1. Check this documentation
2. Review log files in `monitoring/logs/`
3. Test individual components manually
4. Contact the platform team

## Maintenance

- Logs are rotated daily and kept for 7 days
- Metrics are retained for 7 days locally
- Synthetic tests run continuously
- Alert rules should be reviewed quarterly
EOF
    
    success "Monitoring documentation generated"
}

# Validate setup
validate_setup() {
    log "Validating monitoring setup..."
    
    local validation_errors=0
    
    # Check if API is accessible
    if command -v curl &> /dev/null; then
        if ! curl -f "${API_URL:-http://localhost:8001}/api/health/live" &> /dev/null; then
            warn "API health endpoint not accessible - make sure the API is running"
            ((validation_errors++))
        else
            success "API health endpoint accessible"
        fi
    fi
    
    # Check monitoring files
    local required_files=(
        "monitoring/config/prometheus.yml"
        "monitoring/alerting/alert_rules.yml"
        "monitoring/alerting/alertmanager.yml"
        "monitoring/synthetic/run_tests.py"
        "monitoring/config/monitoring-service.yaml"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required monitoring file missing: $file"
            ((validation_errors++))
        fi
    done
    
    if [[ $validation_errors -eq 0 ]]; then
        success "Monitoring setup validation passed"
    else
        warn "$validation_errors validation errors found - please review the setup"
    fi
}

# Create systemd service files (Linux only)
create_systemd_services() {
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        return 0
    fi
    
    log "Creating systemd service files..."
    
    # Create synthetic monitoring service
    cat > "monitoring/config/pitchey-synthetic.service" <<EOF
[Unit]
Description=Pitchey Synthetic Monitoring
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/python3 $(pwd)/monitoring/synthetic/run_tests.py
Restart=always
RestartSec=30
Environment=API_BASE_URL=${API_URL:-http://localhost:8001}

[Install]
WantedBy=multi-user.target
EOF
    
    warn "Systemd service files created. To install:"
    warn "  sudo cp monitoring/config/pitchey-synthetic.service /etc/systemd/system/"
    warn "  sudo systemctl enable pitchey-synthetic"
    warn "  sudo systemctl start pitchey-synthetic"
}

# Main setup function
main() {
    log "Starting Pitchey Platform Monitoring Setup"
    log "=========================================="
    
    check_prerequisites
    setup_directories
    install_dependencies
    setup_sentry
    setup_prometheus_config
    setup_alert_rules
    setup_alertmanager
    setup_synthetic_monitoring
    create_monitoring_service
    setup_monitoring_workers
    setup_logging
    create_systemd_services
    generate_documentation
    validate_setup
    
    success "Monitoring setup completed successfully!"
    log ""
    log "Next steps:"
    log "1. Review configuration files in monitoring/config/"
    log "2. Set required environment variables (see MONITORING_SETUP.md)"
    log "3. Start synthetic monitoring: python3 monitoring/synthetic/run_tests.py"
    log "4. Install monitoring cron jobs: crontab monitoring/config/monitoring-cron"
    log "5. Configure Grafana dashboards (optional)"
    log ""
    log "Documentation: MONITORING_SETUP.md"
    log "Health check: ${API_URL:-http://localhost:8001}/api/health/all"
    log "Metrics: ${API_URL:-http://localhost:8001}/api/monitoring/metrics"
}

# Run main function
main "$@"