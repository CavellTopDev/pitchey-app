#!/bin/bash

# Auto-Scaling Manager for Pitchey Cloudflare Containers
# Manages auto-scaling policies, rules, and monitoring

set -euo pipefail

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-/home/supremeisbeing/pitcheymovie/pitchey_v0.2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

# Auto-scaling configuration
DEFAULT_MIN_REPLICAS=2
DEFAULT_MAX_REPLICAS=50
DEFAULT_TARGET_CPU=70
DEFAULT_TARGET_MEMORY=80
DEFAULT_SCALE_UP_COOLDOWN=300  # 5 minutes
DEFAULT_SCALE_DOWN_COOLDOWN=900  # 15 minutes

# Logging
setup_logging() {
    local log_dir="${PROJECT_ROOT}/logs"
    mkdir -p "$log_dir"
    exec 1> >(tee -a "${log_dir}/auto-scaling.log")
    exec 2> >(tee -a "${log_dir}/auto-scaling-error.log" >&2)
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Configuration management
create_scaling_config() {
    local service_name="$1"
    local config_file="${PROJECT_ROOT}/config/auto-scaling-${service_name}.yaml"
    
    mkdir -p "$(dirname "$config_file")"
    
    cat > "$config_file" <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${service_name}-hpa
  namespace: pitchey-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${service_name}
  minReplicas: ${DEFAULT_MIN_REPLICAS}
  maxReplicas: ${DEFAULT_MAX_REPLICAS}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: ${DEFAULT_TARGET_CPU}
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: ${DEFAULT_TARGET_MEMORY}
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  - type: External
    external:
      metric:
        name: queue_depth
        selector:
          matchLabels:
            service: ${service_name}
      target:
        type: Value
        value: "10"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: ${DEFAULT_SCALE_UP_COOLDOWN}
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 4
        periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: ${DEFAULT_SCALE_DOWN_COOLDOWN}
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${service_name}-scaling-config
  namespace: pitchey-production
data:
  scaling.properties: |
    # CPU-based scaling
    cpu.scale_up_threshold=70
    cpu.scale_down_threshold=30
    cpu.evaluation_period=300
    
    # Memory-based scaling
    memory.scale_up_threshold=80
    memory.scale_down_threshold=40
    memory.evaluation_period=300
    
    # Request-based scaling
    requests.scale_up_threshold=100
    requests.scale_down_threshold=20
    requests.evaluation_period=180
    
    # Queue-based scaling
    queue.scale_up_threshold=10
    queue.scale_down_threshold=2
    queue.evaluation_period=120
    
    # Cost controls
    cost.max_hourly_spend=100.00
    cost.scaling_budget_alert_threshold=80.00
    
    # Business hours scaling
    business.hours.start=08:00
    business.hours.end=18:00
    business.hours.timezone=UTC
    business.hours.min_replicas=5
    business.hours.max_replicas=50
    
    # Off-hours scaling
    off.hours.min_replicas=2
    off.hours.max_replicas=20
EOF

    log "Created auto-scaling configuration for $service_name"
}

# Cloudflare Workers auto-scaling
setup_workers_autoscaling() {
    local worker_name="$1"
    
    # Create Worker-specific scaling configuration
    local config_file="${PROJECT_ROOT}/config/workers-scaling-${worker_name}.json"
    
    cat > "$config_file" <<EOF
{
  "worker_name": "$worker_name",
  "scaling_config": {
    "cpu_utilization": {
      "scale_up_threshold": 70,
      "scale_down_threshold": 30,
      "evaluation_period": 300
    },
    "memory_utilization": {
      "scale_up_threshold": 80,
      "scale_down_threshold": 40,
      "evaluation_period": 300
    },
    "request_rate": {
      "scale_up_threshold": 1000,
      "scale_down_threshold": 200,
      "evaluation_period": 180
    },
    "error_rate": {
      "scale_up_threshold": 5.0,
      "evaluation_period": 120
    },
    "response_time": {
      "scale_up_threshold": 1000,
      "evaluation_period": 180
    },
    "limits": {
      "min_instances": 2,
      "max_instances": 100,
      "max_hourly_cost": 50.00
    },
    "cooldown": {
      "scale_up": 300,
      "scale_down": 900
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics_interval": 60,
    "alert_channels": ["slack", "email"]
  }
}
EOF

    log "Created Workers auto-scaling configuration for $worker_name"
}

# Predictive scaling with machine learning
setup_predictive_scaling() {
    local service_name="$1"
    
    # Create ML-based predictive scaling configuration
    local ml_config="${PROJECT_ROOT}/config/ml-scaling-${service_name}.yaml"
    
    cat > "$ml_config" <<EOF
apiVersion: machinelearning.io/v1alpha1
kind: PredictiveScaler
metadata:
  name: ${service_name}-predictive-scaler
  namespace: pitchey-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${service_name}
  
  # Historical data collection
  dataCollection:
    metricsRetention: 30d
    samplingInterval: 1m
    features:
      - name: cpu_utilization
        source: prometheus
        query: 'avg(rate(container_cpu_usage_seconds_total[5m]))'
      - name: memory_utilization
        source: prometheus
        query: 'avg(container_memory_usage_bytes / container_spec_memory_limit_bytes)'
      - name: request_rate
        source: prometheus
        query: 'sum(rate(http_requests_total[5m]))'
      - name: queue_depth
        source: prometheus
        query: 'avg(queue_depth)'
      - name: business_hours
        source: time
        query: 'is_business_hours()'
      - name: day_of_week
        source: time
        query: 'day_of_week()'
  
  # Machine learning model configuration
  model:
    algorithm: lstm  # Long Short-Term Memory for time series
    trainingSchedule: "0 2 * * *"  # Daily at 2 AM
    predictionHorizon: 30m
    retraining_threshold: 0.85  # Retrain if accuracy drops below 85%
    
    parameters:
      lookback_window: 168h  # 7 days of historical data
      forecast_interval: 5m
      confidence_threshold: 0.9
      seasonal_patterns: true
      trend_detection: true
  
  # Scaling decisions
  scaling:
    lookahead: 15m  # Scale 15 minutes before predicted need
    bufferPercent: 20  # Add 20% buffer to predictions
    maxScaleUp: 50%  # Maximum scale-up per prediction
    maxScaleDown: 25%  # Maximum scale-down per prediction
    
    # Override thresholds
    emergencyOverride:
      enabled: true
      cpu_threshold: 95
      memory_threshold: 90
      response_time_threshold: 5000
  
  # Cost optimization
  costOptimization:
    enabled: true
    maxHourlyCost: 100.00
    preferredInstanceTypes:
      - "standard"
      - "burstable"
    spotInstances:
      enabled: true
      maxSpotPercent: 70
EOF

    log "Created predictive scaling configuration for $service_name"
}

# Custom metrics for scaling
configure_custom_metrics() {
    local service_name="$1"
    
    # Create custom metrics adapter configuration
    local metrics_config="${PROJECT_ROOT}/config/custom-metrics-${service_name}.yaml"
    
    cat > "$metrics_config" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${service_name}-custom-metrics
  namespace: pitchey-production
data:
  custom-metrics.yaml: |
    rules:
    # Business logic metrics
    - seriesQuery: 'pitches_created_per_minute{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        matches: "^(.*)_per_minute"
        as: "\${1}_rate"
      metricsQuery: 'avg(<<.Series>>{<<.LabelMatchers>>})'
    
    # User engagement metrics
    - seriesQuery: 'active_users_count{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        as: "active_users"
      metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>})'
    
    # WebSocket connection metrics
    - seriesQuery: 'websocket_connections_total{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        as: "websocket_connections"
      metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>})'
    
    # Database connection pool metrics
    - seriesQuery: 'db_pool_active_connections{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        as: "db_pool_utilization"
      metricsQuery: 'avg(<<.Series>>{<<.LabelMatchers>>} / db_pool_max_connections{<<.LabelMatchers>>})'
    
    # Cache hit rate metrics
    - seriesQuery: 'cache_hit_rate{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        as: "cache_efficiency"
      metricsQuery: 'avg(<<.Series>>{<<.LabelMatchers>>})'
    
    # File upload queue metrics
    - seriesQuery: 'upload_queue_depth{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace: {resource: "namespace"}
          pod: {resource: "pod"}
      name:
        as: "upload_queue_size"
      metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>})'
EOF

    log "Created custom metrics configuration for $service_name"
}

# Cost-aware scaling policies
setup_cost_aware_scaling() {
    local service_name="$1"
    
    # Create cost-aware scaling script
    local cost_script="${PROJECT_ROOT}/scripts/cost-aware-scaler.sh"
    
    cat > "$cost_script" <<'EOF'
#!/bin/bash

# Cost-aware scaling for Cloudflare Workers and Containers
set -euo pipefail

COST_THRESHOLD=${COST_THRESHOLD:-100.00}  # Max hourly cost in USD
COST_CHECK_INTERVAL=${COST_CHECK_INTERVAL:-300}  # Check every 5 minutes

check_current_costs() {
    local current_hour_cost
    current_hour_cost=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/billing/analytics" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" | \
        jq -r '.result.current_hour_cost // 0')
    
    echo "$current_hour_cost"
}

calculate_projected_hourly_cost() {
    local current_replicas="$1"
    local target_replicas="$2"
    local base_cost_per_replica="$3"
    
    local projected_cost
    projected_cost=$(echo "$target_replicas * $base_cost_per_replica" | bc -l)
    echo "$projected_cost"
}

enforce_cost_limits() {
    local service_name="$1"
    local target_replicas="$2"
    local base_cost_per_replica="${3:-1.50}"  # Default cost per replica per hour
    
    local current_cost projected_cost max_allowed_replicas
    current_cost=$(check_current_costs)
    projected_cost=$(calculate_projected_hourly_cost "$(get_current_replicas "$service_name")" "$target_replicas" "$base_cost_per_replica")
    
    if (( $(echo "$projected_cost > $COST_THRESHOLD" | bc -l) )); then
        max_allowed_replicas=$(echo "$COST_THRESHOLD / $base_cost_per_replica" | bc -l | cut -d. -f1)
        
        log "Cost limit enforced: reducing target replicas from $target_replicas to $max_allowed_replicas"
        log "Projected cost: \$${projected_cost}/hour, Limit: \$${COST_THRESHOLD}/hour"
        
        # Send cost alert
        send_cost_alert "$service_name" "$projected_cost" "$COST_THRESHOLD"
        
        echo "$max_allowed_replicas"
    else
        echo "$target_replicas"
    fi
}

get_current_replicas() {
    local service_name="$1"
    kubectl get deployment "$service_name" -n pitchey-production -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0"
}

send_cost_alert() {
    local service_name="$1"
    local projected_cost="$2"
    local cost_limit="$3"
    
    local alert_payload
    alert_payload=$(cat <<EOF
{
    "text": "🚨 Cost Alert - Auto-scaling Limited",
    "attachments": [
        {
            "color": "warning",
            "fields": [
                {
                    "title": "Service",
                    "value": "$service_name",
                    "short": true
                },
                {
                    "title": "Projected Cost",
                    "value": "\$${projected_cost}/hour",
                    "short": true
                },
                {
                    "title": "Cost Limit",
                    "value": "\$${cost_limit}/hour",
                    "short": true
                },
                {
                    "title": "Action",
                    "value": "Scaling capped to enforce cost limits",
                    "short": false
                }
            ]
        }
    ]
}
EOF
    )
    
    if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$alert_payload" || true
    fi
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    service_name="${1:-}"
    target_replicas="${2:-}"
    
    if [[ -z "$service_name" || -z "$target_replicas" ]]; then
        echo "Usage: $0 <service_name> <target_replicas>"
        exit 1
    fi
    
    final_replicas=$(enforce_cost_limits "$service_name" "$target_replicas")
    echo "$final_replicas"
fi
EOF

    chmod +x "$cost_script"
    log "Created cost-aware scaling script"
}

# Monitoring and alerting setup
setup_scaling_monitoring() {
    local service_name="$1"
    
    # Create monitoring configuration
    local monitoring_config="${PROJECT_ROOT}/config/scaling-monitoring.yaml"
    
    cat > "$monitoring_config" <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ${service_name}-autoscaling-alerts
  namespace: pitchey-production
spec:
  groups:
  - name: autoscaling.rules
    interval: 30s
    rules:
    
    # High CPU utilization
    - alert: HighCPUUtilization
      expr: avg(rate(container_cpu_usage_seconds_total[5m])) by (pod) > 0.8
      for: 5m
      labels:
        severity: warning
        service: ${service_name}
      annotations:
        summary: "High CPU utilization detected"
        description: "CPU utilization is above 80% for more than 5 minutes"
    
    # High memory utilization
    - alert: HighMemoryUtilization
      expr: avg(container_memory_usage_bytes / container_spec_memory_limit_bytes) by (pod) > 0.85
      for: 5m
      labels:
        severity: warning
        service: ${service_name}
      annotations:
        summary: "High memory utilization detected"
        description: "Memory utilization is above 85% for more than 5 minutes"
    
    # Scaling event frequency
    - alert: FrequentScalingEvents
      expr: increase(kube_hpa_status_last_scale_time[1h]) > 10
      for: 0m
      labels:
        severity: warning
        service: ${service_name}
      annotations:
        summary: "Frequent scaling events detected"
        description: "More than 10 scaling events in the last hour"
    
    # Maximum replicas reached
    - alert: MaxReplicasReached
      expr: kube_hpa_status_current_replicas >= kube_hpa_spec_max_replicas
      for: 10m
      labels:
        severity: critical
        service: ${service_name}
      annotations:
        summary: "Maximum replicas reached"
        description: "Service has reached maximum replica count and may need manual intervention"
    
    # Cost threshold breach
    - alert: CostThresholdBreach
      expr: cloudflare_hourly_cost > 80
      for: 5m
      labels:
        severity: warning
        service: ${service_name}
      annotations:
        summary: "Cost threshold breach"
        description: "Hourly costs are approaching the configured limit"
    
    # Prediction accuracy degradation
    - alert: PredictionAccuracyDegraded
      expr: ml_model_accuracy < 0.8
      for: 15m
      labels:
        severity: warning
        service: ${service_name}
      annotations:
        summary: "ML model accuracy degraded"
        description: "Predictive scaling model accuracy has dropped below 80%"
EOF

    log "Created scaling monitoring configuration for $service_name"
}

# Dashboard creation
create_scaling_dashboard() {
    local service_name="$1"
    
    # Create Grafana dashboard for auto-scaling metrics
    local dashboard_config="${PROJECT_ROOT}/config/grafana-scaling-dashboard.json"
    
    cat > "$dashboard_config" <<EOF
{
  "dashboard": {
    "id": null,
    "title": "${service_name} Auto-Scaling Dashboard",
    "tags": ["autoscaling", "${service_name}", "pitchey"],
    "timezone": "UTC",
    "panels": [
      {
        "id": 1,
        "title": "Current Replicas",
        "type": "stat",
        "targets": [
          {
            "expr": "kube_deployment_status_replicas{deployment=\"${service_name}\"}",
            "legendFormat": "Current Replicas"
          }
        ],
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "CPU Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(rate(container_cpu_usage_seconds_total{pod=~\"${service_name}.*\"}[5m])) * 100",
            "legendFormat": "CPU %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 6, "y": 0},
        "yAxes": [
          {"min": 0, "max": 100, "unit": "percent"}
        ]
      },
      {
        "id": 3,
        "title": "Memory Utilization",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(container_memory_usage_bytes{pod=~\"${service_name}.*\"} / container_spec_memory_limit_bytes{pod=~\"${service_name}.*\"}) * 100",
            "legendFormat": "Memory %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 18, "y": 0},
        "yAxes": [
          {"min": 0, "max": 100, "unit": "percent"}
        ]
      },
      {
        "id": 4,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{service=\"${service_name}\"}[5m]))",
            "legendFormat": "Requests/sec"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 5,
        "title": "Scaling Events",
        "type": "graph",
        "targets": [
          {
            "expr": "increase(kube_hpa_status_last_scale_time{hpa=\"${service_name}-hpa\"}[1h])",
            "legendFormat": "Scaling Events/hour"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      },
      {
        "id": 6,
        "title": "Cost Tracking",
        "type": "graph",
        "targets": [
          {
            "expr": "cloudflare_hourly_cost{service=\"${service_name}\"}",
            "legendFormat": "Hourly Cost (USD)"
          }
        ],
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16}
      },
      {
        "id": 7,
        "title": "Prediction Accuracy",
        "type": "graph",
        "targets": [
          {
            "expr": "ml_model_accuracy{service=\"${service_name}\"}",
            "legendFormat": "Model Accuracy %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 24}
      },
      {
        "id": 8,
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(queue_depth{service=\"${service_name}\"})",
            "legendFormat": "Queue Size"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 24}
      }
    ],
    "refresh": "30s",
    "time": {"from": "now-1h", "to": "now"}
  }
}
EOF

    log "Created Grafana dashboard configuration for $service_name"
}

# Main auto-scaling setup function
setup_autoscaling() {
    local service_name="${1:-pitchey-api}"
    local scaling_type="${2:-standard}"  # standard, predictive, cost-aware
    
    log "Setting up auto-scaling for $service_name (type: $scaling_type)"
    
    # Create base configuration
    create_scaling_config "$service_name"
    
    # Setup Workers-specific scaling if applicable
    if [[ "$service_name" == *"worker"* ]]; then
        setup_workers_autoscaling "$service_name"
    fi
    
    # Configure custom metrics
    configure_custom_metrics "$service_name"
    
    # Setup predictive scaling if requested
    if [[ "$scaling_type" == "predictive" || "$scaling_type" == "all" ]]; then
        setup_predictive_scaling "$service_name"
    fi
    
    # Setup cost-aware scaling
    if [[ "$scaling_type" == "cost-aware" || "$scaling_type" == "all" ]]; then
        setup_cost_aware_scaling "$service_name"
    fi
    
    # Setup monitoring and alerting
    setup_scaling_monitoring "$service_name"
    
    # Create dashboard
    create_scaling_dashboard "$service_name"
    
    log "Auto-scaling setup completed for $service_name"
}

# Apply configurations to cluster
apply_scaling_configs() {
    local service_name="$1"
    
    log "Applying auto-scaling configurations for $service_name"
    
    # Apply Kubernetes configurations
    if command -v kubectl >/dev/null 2>&1; then
        find "${PROJECT_ROOT}/config" -name "*${service_name}*.yaml" -exec kubectl apply -f {} \;
    else
        log "kubectl not found, skipping Kubernetes configuration application"
    fi
    
    # Apply Grafana dashboard
    if [[ -n "${GRAFANA_URL:-}" ]]; then
        local dashboard_file="${PROJECT_ROOT}/config/grafana-scaling-dashboard.json"
        if [[ -f "$dashboard_file" ]]; then
            curl -X POST "${GRAFANA_URL}/api/dashboards/db" \
                -H "Content-Type: application/json" \
                -d "@${dashboard_file}" || log "Failed to create Grafana dashboard"
        fi
    fi
    
    log "Configuration application completed"
}

# Test scaling policies
test_scaling_policies() {
    local service_name="$1"
    
    log "Testing auto-scaling policies for $service_name"
    
    # Simulate load increase
    log "Simulating load increase..."
    "${SCRIPT_DIR}/performance-testing-suite.sh" load \
        --duration=600 \
        --users=50 \
        --ramp-up=120 || log "Load test failed"
    
    # Monitor scaling response
    local start_time end_time
    start_time=$(date +%s)
    end_time=$((start_time + 900))  # Monitor for 15 minutes
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local current_replicas
        current_replicas=$(kubectl get deployment "$service_name" -n pitchey-production -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
        log "Current replicas: $current_replicas"
        sleep 60
    done
    
    log "Scaling policy test completed"
}

# Generate scaling report
generate_scaling_report() {
    local service_name="$1"
    local output_file="${PROJECT_ROOT}/reports/scaling-report-${service_name}-$(date +%Y%m%d-%H%M%S).md"
    
    mkdir -p "$(dirname "$output_file")"
    
    cat > "$output_file" <<EOF
# Auto-Scaling Report: $service_name

**Generated**: $(date)
**Service**: $service_name

## Configuration Summary

$(find "${PROJECT_ROOT}/config" -name "*${service_name}*" -type f | while read -r file; do
    echo "### $(basename "$file")"
    echo "\`\`\`"
    head -20 "$file"
    echo "\`\`\`"
    echo
done)

## Current Status

$(if command -v kubectl >/dev/null 2>&1; then
    echo "### Deployment Status"
    kubectl get deployment "$service_name" -n pitchey-production -o wide 2>/dev/null || echo "Deployment not found"
    echo
    echo "### HPA Status"
    kubectl get hpa "${service_name}-hpa" -n pitchey-production -o wide 2>/dev/null || echo "HPA not found"
fi)

## Recommendations

1. **Monitor scaling frequency** - Ensure scaling events are not too frequent
2. **Adjust thresholds** - Fine-tune CPU/memory thresholds based on application behavior
3. **Cost optimization** - Review cost limits and scaling policies regularly
4. **Predictive scaling** - Consider enabling ML-based predictive scaling for better efficiency

## Next Steps

1. Monitor the scaling behavior for 24-48 hours
2. Adjust thresholds based on observed patterns
3. Enable additional metrics if needed
4. Consider implementing custom business metrics for scaling

EOF

    log "Scaling report generated: $output_file"
}

# Main execution
main() {
    setup_logging
    
    case "${1:-setup}" in
        "setup")
            local service_name="${2:-pitchey-api}"
            local scaling_type="${3:-standard}"
            setup_autoscaling "$service_name" "$scaling_type"
            apply_scaling_configs "$service_name"
            ;;
        "test")
            local service_name="${2:-pitchey-api}"
            test_scaling_policies "$service_name"
            ;;
        "report")
            local service_name="${2:-pitchey-api}"
            generate_scaling_report "$service_name"
            ;;
        "monitor")
            local service_name="${2:-pitchey-api}"
            # Start monitoring daemon (implementation depends on your monitoring setup)
            log "Monitoring auto-scaling for $service_name..."
            ;;
        *)
            echo "Usage: $0 {setup|test|report|monitor} [service_name] [scaling_type]"
            echo "  setup: Configure auto-scaling policies"
            echo "  test: Test scaling policies with load simulation"
            echo "  report: Generate scaling configuration report"
            echo "  monitor: Start scaling monitoring daemon"
            echo ""
            echo "Scaling types: standard, predictive, cost-aware, all"
            exit 1
            ;;
    esac
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi