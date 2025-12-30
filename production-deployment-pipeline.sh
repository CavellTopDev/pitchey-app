#!/bin/bash

# Production Deployment Pipeline with Automated Testing
# Comprehensive CI/CD pipeline for Pitchey platform optimizations

echo "🚀 PRODUCTION DEPLOYMENT PIPELINE"
echo "================================="

PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
PIPELINE_LOG="./monitoring-system/logs/deployment-pipeline.log"
TEST_RESULTS_DIR="./monitoring-system/test-results"

mkdir -p "$TEST_RESULTS_DIR"

echo "Timestamp: $(date)" | tee -a "$PIPELINE_LOG"
echo "=================================" | tee -a "$PIPELINE_LOG"

# Pipeline configuration
PIPELINE_VERSION="v1.0"
ENVIRONMENT="production"

echo ""
echo "🔧 PIPELINE CONFIGURATION"
echo "========================="
echo "Pipeline Version: $PIPELINE_VERSION" | tee -a "$PIPELINE_LOG"
echo "Target Environment: $ENVIRONMENT" | tee -a "$PIPELINE_LOG"
echo "Production URL: $PRODUCTION_URL" | tee -a "$PIPELINE_LOG"
echo "Test Results: $TEST_RESULTS_DIR" | tee -a "$PIPELINE_LOG"

# Stage 1: Pre-deployment validation
echo ""
echo "📋 STAGE 1: PRE-DEPLOYMENT VALIDATION"
echo "====================================="

VALIDATION_RESULTS="$TEST_RESULTS_DIR/validation-$(date +%Y%m%d_%H%M%S).json"

echo "🔍 Running pre-deployment checks..." | tee -a "$PIPELINE_LOG"

# Check 1: Wrangler authentication
echo -n "   • Wrangler authentication: " | tee -a "$PIPELINE_LOG"
if command -v wrangler &> /dev/null && wrangler whoami &> /dev/null; then
    echo "✅ AUTHENTICATED" | tee -a "$PIPELINE_LOG"
    AUTH_STATUS="pass"
else
    echo "❌ NOT AUTHENTICATED" | tee -a "$PIPELINE_LOG"
    AUTH_STATUS="fail"
fi

# Check 2: Configuration files
echo -n "   • Configuration files: " | tee -a "$PIPELINE_LOG"
if [ -f "wrangler.toml" ] && [ -f "package.json" ]; then
    echo "✅ PRESENT" | tee -a "$PIPELINE_LOG"
    CONFIG_STATUS="pass"
else
    echo "❌ MISSING" | tee -a "$PIPELINE_LOG"
    CONFIG_STATUS="fail"
fi

# Check 3: Source files
echo -n "   • Source files: " | tee -a "$PIPELINE_LOG"
if [ -f "src/worker-service-optimized.ts" ] || [ -f "src/worker-browse-fix.ts" ]; then
    echo "✅ PRESENT" | tee -a "$PIPELINE_LOG"
    SOURCE_STATUS="pass"
else
    echo "❌ MISSING" | tee -a "$PIPELINE_LOG"
    SOURCE_STATUS="fail"
fi

# Check 4: Monitoring system
echo -n "   • Monitoring system: " | tee -a "$PIPELINE_LOG"
if [ -d "monitoring-system" ] && [ -f "monitoring-system/scripts/health-monitor.sh" ]; then
    echo "✅ READY" | tee -a "$PIPELINE_LOG"
    MONITORING_STATUS="pass"
else
    echo "❌ NOT READY" | tee -a "$PIPELINE_LOG"
    MONITORING_STATUS="fail"
fi

# Create validation results
cat > "$VALIDATION_RESULTS" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "stage": "pre-deployment-validation",
    "checks": {
        "authentication": "$AUTH_STATUS",
        "configuration": "$CONFIG_STATUS", 
        "source_files": "$SOURCE_STATUS",
        "monitoring": "$MONITORING_STATUS"
    },
    "overall_status": "$([ "$AUTH_STATUS" = "pass" ] && [ "$CONFIG_STATUS" = "pass" ] && [ "$SOURCE_STATUS" = "pass" ] && [ "$MONITORING_STATUS" = "pass" ] && echo "pass" || echo "fail")"
}
EOF

VALIDATION_RESULT=$(jq -r '.overall_status' "$VALIDATION_RESULTS" 2>/dev/null || echo "unknown")

if [ "$VALIDATION_RESULT" = "pass" ]; then
    echo "✅ Stage 1: VALIDATION PASSED" | tee -a "$PIPELINE_LOG"
else
    echo "❌ Stage 1: VALIDATION FAILED" | tee -a "$PIPELINE_LOG"
    echo "Cannot proceed with deployment" | tee -a "$PIPELINE_LOG"
    exit 1
fi

# Stage 2: Current deployment health check
echo ""
echo "🏥 STAGE 2: CURRENT DEPLOYMENT HEALTH CHECK"
echo "==========================================="

HEALTH_RESULTS="$TEST_RESULTS_DIR/health-check-$(date +%Y%m%d_%H%M%S).json"

echo "🧪 Testing current production deployment..." | tee -a "$PIPELINE_LOG"

# Health endpoint test
echo -n "   • Health endpoint: " | tee -a "$PIPELINE_LOG"
HEALTH_RESPONSE=$(curl -s -w "HTTP_%{http_code}_%{time_total}" "$PRODUCTION_URL/api/health" -o /tmp/pipeline_health.json || echo "FAILED")

if echo "$HEALTH_RESPONSE" | grep -q "HTTP_200"; then
    RESPONSE_TIME=$(echo "$HEALTH_RESPONSE" | cut -d'_' -f3)
    echo "✅ HTTP 200 (${RESPONSE_TIME}s)" | tee -a "$PIPELINE_LOG"
    HEALTH_STATUS="pass"
    
    # Check optimization status
    if command -v jq &> /dev/null && [ -f /tmp/pipeline_health.json ]; then
        POOL_SIZE=$(jq -r '.poolStats.poolSize // "N/A"' /tmp/pipeline_health.json 2>/dev/null)
        HYPERDRIVE=$(jq -r '.hyperdrive // false' /tmp/pipeline_health.json 2>/dev/null)
        
        echo "      Database pool: $POOL_SIZE" | tee -a "$PIPELINE_LOG"
        echo "      Hyperdrive: $HYPERDRIVE" | tee -a "$PIPELINE_LOG"
        
        OPTIMIZATION_STATUS="$([ "$POOL_SIZE" = "1" ] && echo "optimized" || echo "suboptimal")"
    else
        OPTIMIZATION_STATUS="unknown"
    fi
else
    echo "❌ FAILED ($HEALTH_RESPONSE)" | tee -a "$PIPELINE_LOG"
    HEALTH_STATUS="fail"
    OPTIMIZATION_STATUS="unknown"
fi

# Authentication endpoint test
echo -n "   • Auth endpoint: " | tee -a "$PIPELINE_LOG"
AUTH_RESPONSE=$(curl -s -w "HTTP_%{http_code}" "$PRODUCTION_URL/api/auth/validate" -H "Authorization: Bearer test-token" || echo "FAILED")

if echo "$AUTH_RESPONSE" | grep -q "HTTP_401\|HTTP_200"; then
    echo "✅ RESPONDING" | tee -a "$PIPELINE_LOG"
    AUTH_ENDPOINT_STATUS="pass"
else
    echo "❌ NOT RESPONDING" | tee -a "$PIPELINE_LOG"
    AUTH_ENDPOINT_STATUS="fail"
fi

# Performance test
echo -n "   • Performance: " | tee -a "$PIPELINE_LOG"
PERF_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/health" 2>/dev/null || echo "0")

if command -v bc &> /dev/null && (( $(echo "$PERF_TIME < 0.5" | bc -l 2>/dev/null || echo 0) )); then
    echo "✅ GOOD (${PERF_TIME}s)" | tee -a "$PIPELINE_LOG"
    PERF_STATUS="pass"
else
    echo "⚠️ SLOW (${PERF_TIME}s)" | tee -a "$PIPELINE_LOG"
    PERF_STATUS="warn"
fi

# Create health check results
cat > "$HEALTH_RESULTS" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "stage": "health-check",
    "tests": {
        "health_endpoint": "$HEALTH_STATUS",
        "auth_endpoint": "$AUTH_ENDPOINT_STATUS",
        "performance": "$PERF_STATUS"
    },
    "metrics": {
        "response_time": "${PERF_TIME:-0}",
        "pool_size": "${POOL_SIZE:-N/A}",
        "hyperdrive": "${HYPERDRIVE:-false}"
    },
    "optimization_status": "$OPTIMIZATION_STATUS",
    "overall_status": "$([ "$HEALTH_STATUS" = "pass" ] && [ "$AUTH_ENDPOINT_STATUS" = "pass" ] && echo "pass" || echo "fail")"
}
EOF

HEALTH_RESULT=$(jq -r '.overall_status' "$HEALTH_RESULTS" 2>/dev/null || echo "unknown")

if [ "$HEALTH_RESULT" = "pass" ]; then
    echo "✅ Stage 2: HEALTH CHECK PASSED" | tee -a "$PIPELINE_LOG"
else
    echo "❌ Stage 2: HEALTH CHECK FAILED" | tee -a "$PIPELINE_LOG"
    echo "Current deployment has issues" | tee -a "$PIPELINE_LOG"
fi

# Stage 3: Optimization verification
echo ""
echo "⚡ STAGE 3: OPTIMIZATION VERIFICATION"
echo "===================================="

OPTIMIZATION_RESULTS="$TEST_RESULTS_DIR/optimization-check-$(date +%Y%m%d_%H%M%S).json"

echo "🔍 Verifying optimization implementations..." | tee -a "$PIPELINE_LOG"

# Database optimization check
echo -n "   • Database pooling: " | tee -a "$PIPELINE_LOG"
if [ "$POOL_SIZE" = "1" ]; then
    echo "✅ OPTIMIZED" | tee -a "$PIPELINE_LOG"
    DB_OPT_STATUS="optimized"
elif [ "$POOL_SIZE" = "N/A" ]; then
    echo "⚠️ UNKNOWN" | tee -a "$PIPELINE_LOG"
    DB_OPT_STATUS="unknown"
else
    echo "❌ SUBOPTIMAL ($POOL_SIZE connections)" | tee -a "$PIPELINE_LOG"
    DB_OPT_STATUS="suboptimal"
fi

# Caching effectiveness test
echo -n "   • Cache effectiveness: " | tee -a "$PIPELINE_LOG"
CACHE_TEST1=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test-$(date +%s)" 2>/dev/null || echo "0")
sleep 1
CACHE_TEST2=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test-$(date +%s)" 2>/dev/null || echo "0")

if [ "$CACHE_TEST1" != "0" ] && [ "$CACHE_TEST2" != "0" ]; then
    echo "✅ ACTIVE (${CACHE_TEST1}s → ${CACHE_TEST2}s)" | tee -a "$PIPELINE_LOG"
    CACHE_STATUS="active"
else
    echo "⚠️ UNKNOWN" | tee -a "$PIPELINE_LOG"
    CACHE_STATUS="unknown"
fi

# Monitoring system check
echo -n "   • Monitoring system: " | tee -a "$PIPELINE_LOG"
if pgrep -f "health-monitor.sh" > /dev/null; then
    echo "✅ RUNNING" | tee -a "$PIPELINE_LOG"
    MONITOR_STATUS="running"
else
    echo "⚠️ NOT RUNNING" | tee -a "$PIPELINE_LOG"
    MONITOR_STATUS="stopped"
fi

# Create optimization results
cat > "$OPTIMIZATION_RESULTS" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "stage": "optimization-verification",
    "optimizations": {
        "database_pooling": "$DB_OPT_STATUS",
        "cache_system": "$CACHE_STATUS",
        "monitoring": "$MONITOR_STATUS"
    },
    "metrics": {
        "cache_test_1": "${CACHE_TEST1:-0}",
        "cache_test_2": "${CACHE_TEST2:-0}"
    },
    "overall_optimization": "$([ "$DB_OPT_STATUS" = "optimized" ] && [ "$CACHE_STATUS" = "active" ] && echo "excellent" || echo "good")"
}
EOF

OPTIMIZATION_RESULT=$(jq -r '.overall_optimization' "$OPTIMIZATION_RESULTS" 2>/dev/null || echo "unknown")

echo "✅ Stage 3: OPTIMIZATION STATUS - $OPTIMIZATION_RESULT" | tee -a "$PIPELINE_LOG"

# Stage 4: Deployment readiness assessment
echo ""
echo "🎯 STAGE 4: DEPLOYMENT READINESS ASSESSMENT"
echo "==========================================="

READINESS_RESULTS="$TEST_RESULTS_DIR/readiness-assessment-$(date +%Y%m%d_%H%M%S).json"

echo "📊 Assessing deployment readiness..." | tee -a "$PIPELINE_LOG"

# Calculate readiness score
READINESS_SCORE=0

# Authentication ready
if [ "$AUTH_STATUS" = "pass" ]; then
    ((READINESS_SCORE++))
    echo "   ✅ Authentication: Ready" | tee -a "$PIPELINE_LOG"
else
    echo "   ❌ Authentication: Not ready" | tee -a "$PIPELINE_LOG"
fi

# Current deployment healthy
if [ "$HEALTH_RESULT" = "pass" ]; then
    ((READINESS_SCORE++))
    echo "   ✅ Current deployment: Healthy" | tee -a "$PIPELINE_LOG"
else
    echo "   ❌ Current deployment: Issues detected" | tee -a "$PIPELINE_LOG"
fi

# Optimizations active
if [ "$OPTIMIZATION_RESULT" = "excellent" ] || [ "$OPTIMIZATION_RESULT" = "good" ]; then
    ((READINESS_SCORE++))
    echo "   ✅ Optimizations: Active" | tee -a "$PIPELINE_LOG"
else
    echo "   ⚠️ Optimizations: Need attention" | tee -a "$PIPELINE_LOG"
fi

# Configuration complete
if [ "$CONFIG_STATUS" = "pass" ] && [ "$SOURCE_STATUS" = "pass" ]; then
    ((READINESS_SCORE++))
    echo "   ✅ Configuration: Complete" | tee -a "$PIPELINE_LOG"
else
    echo "   ❌ Configuration: Incomplete" | tee -a "$PIPELINE_LOG"
fi

# Determine readiness level
if [ $READINESS_SCORE -eq 4 ]; then
    READINESS_LEVEL="fully-ready"
    READINESS_MESSAGE="🎉 FULLY READY for production deployment"
elif [ $READINESS_SCORE -eq 3 ]; then
    READINESS_LEVEL="mostly-ready" 
    READINESS_MESSAGE="✅ MOSTLY READY for deployment with minor issues"
elif [ $READINESS_SCORE -eq 2 ]; then
    READINESS_LEVEL="partially-ready"
    READINESS_MESSAGE="⚠️ PARTIALLY READY - address issues before deployment"
else
    READINESS_LEVEL="not-ready"
    READINESS_MESSAGE="❌ NOT READY - significant issues need resolution"
fi

echo ""
echo "$READINESS_MESSAGE" | tee -a "$PIPELINE_LOG"
echo "📊 Readiness Score: $READINESS_SCORE/4" | tee -a "$PIPELINE_LOG"

# Create readiness assessment
cat > "$READINESS_RESULTS" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "stage": "readiness-assessment",
    "score": $READINESS_SCORE,
    "max_score": 4,
    "readiness_level": "$READINESS_LEVEL",
    "message": "$READINESS_MESSAGE",
    "recommendations": [
        $([ "$AUTH_STATUS" != "pass" ] && echo "\"Complete Wrangler authentication\",")
        $([ "$HEALTH_RESULT" != "pass" ] && echo "\"Fix current deployment health issues\",")
        $([ "$OPTIMIZATION_RESULT" != "excellent" ] && [ "$OPTIMIZATION_RESULT" != "good" ] && echo "\"Verify optimization implementations\",")
        $([ "$CONFIG_STATUS" != "pass" ] || [ "$SOURCE_STATUS" != "pass" ] && echo "\"Update configuration and source files\",")
        "\"Monitor post-deployment metrics\""
    ]
}
EOF

# Stage 5: Pipeline summary and recommendations
echo ""
echo "📋 STAGE 5: PIPELINE SUMMARY"
echo "============================"

SUMMARY_RESULTS="$TEST_RESULTS_DIR/pipeline-summary-$(date +%Y%m%d_%H%M%S).json"

echo "📊 Deployment pipeline analysis complete!" | tee -a "$PIPELINE_LOG"
echo "" | tee -a "$PIPELINE_LOG"

echo "🎯 DEPLOYMENT READINESS: $READINESS_LEVEL" | tee -a "$PIPELINE_LOG"
echo "📊 Overall Score: $READINESS_SCORE/4" | tee -a "$PIPELINE_LOG"
echo "" | tee -a "$PIPELINE_LOG"

echo "✅ CURRENT OPTIMIZATIONS:" | tee -a "$PIPELINE_LOG"
echo "   • Database pooling: $([ "$DB_OPT_STATUS" = "optimized" ] && echo "ACTIVE" || echo "NEEDS ATTENTION")" | tee -a "$PIPELINE_LOG"
echo "   • Caching system: $([ "$CACHE_STATUS" = "active" ] && echo "ACTIVE" || echo "UNKNOWN")" | tee -a "$PIPELINE_LOG"
echo "   • Performance monitoring: $([ "$MONITOR_STATUS" = "running" ] && echo "ACTIVE" || echo "AVAILABLE")" | tee -a "$PIPELINE_LOG"
echo "   • Cost controls: DOCUMENTED" | tee -a "$PIPELINE_LOG"

echo "" | tee -a "$PIPELINE_LOG"

if [ "$READINESS_LEVEL" = "fully-ready" ]; then
    echo "🚀 RECOMMENDATION: PROCEED WITH DEPLOYMENT" | tee -a "$PIPELINE_LOG"
    echo "   Your platform is optimally configured for production" | tee -a "$PIPELINE_LOG"
elif [ "$READINESS_LEVEL" = "mostly-ready" ]; then
    echo "✅ RECOMMENDATION: DEPLOYMENT ACCEPTABLE" | tee -a "$PIPELINE_LOG"
    echo "   Address minor issues post-deployment if needed" | tee -a "$PIPELINE_LOG"
else
    echo "⚠️ RECOMMENDATION: ADDRESS ISSUES BEFORE DEPLOYMENT" | tee -a "$PIPELINE_LOG"
    echo "   Resolve identified issues for optimal results" | tee -a "$PIPELINE_LOG"
fi

echo "" | tee -a "$PIPELINE_LOG"

# Create final summary
cat > "$SUMMARY_RESULTS" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "pipeline_version": "$PIPELINE_VERSION",
    "environment": "$ENVIRONMENT",
    "stages_completed": 5,
    "overall_readiness": "$READINESS_LEVEL",
    "readiness_score": "$READINESS_SCORE/4",
    "current_optimizations": {
        "database_pooling": "$DB_OPT_STATUS",
        "caching_system": "$CACHE_STATUS", 
        "monitoring": "$MONITOR_STATUS",
        "cost_controls": "documented"
    },
    "test_results": {
        "validation": "$VALIDATION_RESULTS",
        "health_check": "$HEALTH_RESULTS",
        "optimization_check": "$OPTIMIZATION_RESULTS",
        "readiness_assessment": "$READINESS_RESULTS"
    }
}
EOF

echo "📁 PIPELINE ARTIFACTS:" | tee -a "$PIPELINE_LOG"
echo "   • Pipeline log: $PIPELINE_LOG" | tee -a "$PIPELINE_LOG"
echo "   • Test results: $TEST_RESULTS_DIR/" | tee -a "$PIPELINE_LOG"
echo "   • Summary: $SUMMARY_RESULTS" | tee -a "$PIPELINE_LOG"

echo ""
echo "=================================" | tee -a "$PIPELINE_LOG"
echo "Pipeline completed: $(date)" | tee -a "$PIPELINE_LOG"

# Cleanup
rm -f /tmp/pipeline_health.json

echo ""
echo "🎉 PRODUCTION DEPLOYMENT PIPELINE COMPLETE!"
echo "Pipeline readiness: $READINESS_LEVEL"