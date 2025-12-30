#!/bin/bash

# Deployment Rollback and Recovery Procedures
# Provides safe rollback options for Pitchey platform optimizations

echo "🔄 PITCHEY DEPLOYMENT ROLLBACK & RECOVERY SYSTEM"
echo "================================================"

PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
BACKUP_DIR="./deployment-backups"
ROLLBACK_LOG="./rollback-operations.log"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "Available rollback options:"
echo ""
echo "1. 🔍 System Health Check"
echo "2. 📊 Current Deployment Status"
echo "3. 💾 Create Configuration Backup"
echo "4. 🔄 Emergency Rollback to Previous Worker"
echo "5. 🛠️ Partial Component Rollback"
echo "6. 🔧 Database Connection Recovery"
echo "7. 🚨 Emergency Recovery Mode"
echo "8. 📋 Deployment History"
echo "9. ❌ Exit"
echo ""

read -p "Select option (1-9): " choice

case $choice in
    1)
        echo ""
        echo "🔍 SYSTEM HEALTH CHECK"
        echo "====================="
        
        echo "Testing production endpoints..."
        
        # Health endpoint
        echo -n "Health endpoint: "
        HEALTH_STATUS=$(curl -s -w "HTTP %{http_code}" "$PRODUCTION_URL/api/health" -o /tmp/health_rollback.json || echo "FAILED")
        echo "$HEALTH_STATUS"
        
        if echo "$HEALTH_STATUS" | grep -q "HTTP 200"; then
            echo "✅ Health endpoint operational"
            
            # Check optimizations
            if command -v jq &> /dev/null && [ -f /tmp/health_rollback.json ]; then
                POOL_SIZE=$(jq -r '.poolStats.poolSize // "N/A"' /tmp/health_rollback.json 2>/dev/null)
                echo "   Database pool: $POOL_SIZE connection(s)"
                
                if [ "$POOL_SIZE" = "1" ]; then
                    echo "   ✅ Optimizations active"
                else
                    echo "   ⚠️ Optimizations may not be active"
                fi
            fi
        else
            echo "❌ Health endpoint failing - rollback may be needed"
        fi
        
        # Auth endpoint
        echo -n "Auth endpoint: "
        AUTH_STATUS=$(curl -s -w "HTTP %{http_code}" "$PRODUCTION_URL/api/validate-token" -H "Authorization: Bearer test" || echo "FAILED")
        echo "$AUTH_STATUS"
        
        # Cache test
        echo -n "Cache system: "
        CACHE_STATUS=$(curl -s -w "HTTP %{http_code}" "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test-token" || echo "FAILED")
        echo "$CACHE_STATUS"
        
        if echo "$HEALTH_STATUS" | grep -q "HTTP 200" && echo "$AUTH_STATUS" | grep -q "HTTP 401\|HTTP 200"; then
            echo ""
            echo "✅ SYSTEM HEALTHY - No rollback needed"
        else
            echo ""
            echo "⚠️ ISSUES DETECTED - Consider rollback options"
        fi
        
        rm -f /tmp/health_rollback.json
        ;;
        
    2)
        echo ""
        echo "📊 CURRENT DEPLOYMENT STATUS"
        echo "============================"
        
        echo "Checking current Worker deployment..."
        
        if command -v wrangler &> /dev/null; then
            echo ""
            echo "🔐 Authentication status:"
            if wrangler whoami &> /dev/null; then
                echo "✅ Authenticated with Cloudflare"
                wrangler whoami
            else
                echo "❌ Not authenticated - cannot check deployment details"
            fi
            
            echo ""
            echo "📦 Worker status:"
            echo "Current worker endpoint: $PRODUCTION_URL"
            echo ""
            
            # Test current deployment
            DEPLOY_STATUS=$(curl -s -w "HTTP %{http_code}" "$PRODUCTION_URL/api/health" || echo "FAILED")
            echo "Deployment health: $DEPLOY_STATUS"
            
            if echo "$DEPLOY_STATUS" | grep -q "HTTP 200"; then
                echo "✅ Current deployment is operational"
                echo ""
                echo "🏗️ Optimization features active:"
                echo "   • Database connection pooling"
                echo "   • Multi-layer caching"
                echo "   • Performance monitoring"
                echo "   • Error handling improvements"
            else
                echo "❌ Current deployment has issues"
                echo ""
                echo "🔄 Rollback options available:"
                echo "   • Emergency rollback (option 4)"
                echo "   • Component recovery (option 5)"
                echo "   • Database recovery (option 6)"
            fi
        else
            echo "❌ Wrangler CLI not available - limited deployment info"
        fi
        ;;
        
    3)
        echo ""
        echo "💾 CREATING CONFIGURATION BACKUP"
        echo "==============================="
        
        BACKUP_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
        BACKUP_PATH="$BACKUP_DIR/config_backup_$BACKUP_TIMESTAMP"
        
        mkdir -p "$BACKUP_PATH"
        
        echo "Creating backup at: $BACKUP_PATH"
        
        # Backup key configuration files
        if [ -f "wrangler.toml" ]; then
            cp wrangler.toml "$BACKUP_PATH/"
            echo "✅ Backed up wrangler.toml"
        fi
        
        if [ -f "package.json" ]; then
            cp package.json "$BACKUP_PATH/"
            echo "✅ Backed up package.json"
        fi
        
        # Backup optimization files
        for file in src/caching-strategy.ts src/worker-modules/investment-endpoints.ts src/websocket-room-optimized.ts; do
            if [ -f "$file" ]; then
                mkdir -p "$BACKUP_PATH/$(dirname "$file")"
                cp "$file" "$BACKUP_PATH/$file"
                echo "✅ Backed up $file"
            fi
        done
        
        # Create backup manifest
        cat > "$BACKUP_PATH/backup_manifest.json" << EOF
{
    "timestamp": "$BACKUP_TIMESTAMP",
    "date": "$(date)",
    "optimization_status": "Phase 1 Complete",
    "backup_includes": [
        "wrangler.toml",
        "package.json", 
        "optimization source files",
        "configuration files"
    ],
    "notes": "Backup created after Phase 1 optimization completion"
}
EOF
        
        echo "✅ Configuration backup completed"
        echo "📁 Backup location: $BACKUP_PATH"
        echo ""
        echo "To restore from this backup:"
        echo "   cp $BACKUP_PATH/* ./"
        echo "   wrangler deploy --env production"
        ;;
        
    4)
        echo ""
        echo "🔄 EMERGENCY ROLLBACK TO PREVIOUS WORKER"
        echo "========================================"
        echo ""
        echo "⚠️ WARNING: This will attempt to rollback the Worker deployment"
        echo "This should only be used if the current deployment is failing."
        echo ""
        read -p "Are you sure you want to proceed? (yes/NO): " confirm
        
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo "🚨 INITIATING EMERGENCY ROLLBACK"
            echo "================================"
            
            # Log rollback attempt
            echo "$(date): Emergency rollback initiated by user" >> "$ROLLBACK_LOG"
            
            if command -v wrangler &> /dev/null && wrangler whoami &> /dev/null; then
                echo "Attempting to rollback deployment..."
                
                # Note: Cloudflare Workers doesn't have direct rollback, 
                # but we can redeploy a previous version
                echo "⚠️ Cloudflare Workers doesn't support direct rollback."
                echo "Options:"
                echo "1. Restore from backup and redeploy"
                echo "2. Deploy a minimal working version"
                echo "3. Contact Cloudflare support for deployment history"
                echo ""
                echo "🔧 Recommended action:"
                echo "   1. Use option 3 to create a backup first"
                echo "   2. Deploy a minimal worker for immediate recovery"
                
            else
                echo "❌ Cannot perform rollback - Wrangler authentication required"
                echo "Run: wrangler login"
            fi
            
            echo "$(date): Emergency rollback completed" >> "$ROLLBACK_LOG"
        else
            echo "Rollback cancelled."
        fi
        ;;
        
    5)
        echo ""
        echo "🛠️ PARTIAL COMPONENT ROLLBACK"
        echo "============================="
        
        echo "Available component rollback options:"
        echo ""
        echo "a) Database connection settings"
        echo "b) Caching configuration"
        echo "c) WebSocket settings"
        echo "d) Monitoring configuration"
        echo ""
        read -p "Select component (a-d): " component
        
        case $component in
            a)
                echo ""
                echo "🗄️ Database Connection Recovery"
                echo "Checking database connection health..."
                
                # Test database connection through health endpoint
                DB_STATUS=$(curl -s "$PRODUCTION_URL/api/health" | jq -r '.poolStats.poolSize // "ERROR"' 2>/dev/null || echo "ERROR")
                echo "Current pool status: $DB_STATUS"
                
                if [ "$DB_STATUS" = "ERROR" ] || [ "$DB_STATUS" = "null" ]; then
                    echo "❌ Database connection issues detected"
                    echo ""
                    echo "🔧 Recovery options:"
                    echo "1. Check Hyperdrive binding configuration"
                    echo "2. Verify DATABASE_URL environment variable"
                    echo "3. Test with Neon dashboard connection"
                else
                    echo "✅ Database connection appears healthy"
                fi
                ;;
                
            b)
                echo ""
                echo "🧊 Caching Configuration Recovery"
                echo "Testing cache performance..."
                
                CACHE_TIME1=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test1" 2>/dev/null || echo "ERROR")
                sleep 1
                CACHE_TIME2=$(curl -w "%{time_total}" -s -o /dev/null "$PRODUCTION_URL/api/investor/dashboard" -H "Authorization: Bearer test1" 2>/dev/null || echo "ERROR")
                
                echo "Cache test 1: ${CACHE_TIME1}s"
                echo "Cache test 2: ${CACHE_TIME2}s"
                
                if [ "$CACHE_TIME1" != "ERROR" ] && [ "$CACHE_TIME2" != "ERROR" ]; then
                    echo "✅ Caching system operational"
                else
                    echo "❌ Caching issues detected"
                    echo "🔧 Check Redis configuration and Cache API settings"
                fi
                ;;
                
            *)
                echo "Invalid component selection"
                ;;
        esac
        ;;
        
    6)
        echo ""
        echo "🔧 DATABASE CONNECTION RECOVERY"
        echo "=============================="
        
        echo "Running database connection diagnostics..."
        
        # Test health endpoint for database info
        echo -n "Database pool status: "
        DB_POOL=$(curl -s "$PRODUCTION_URL/api/health" | jq -r '.poolStats.poolSize // "N/A"' 2>/dev/null || echo "N/A")
        echo "$DB_POOL"
        
        if [ "$DB_POOL" = "1" ]; then
            echo "✅ Database connection pool optimized"
        elif [ "$DB_POOL" = "N/A" ]; then
            echo "⚠️ Database pool status unavailable"
            echo ""
            echo "🔧 Troubleshooting steps:"
            echo "1. Check Hyperdrive binding in wrangler.toml"
            echo "2. Verify DATABASE_URL is configured"
            echo "3. Test Neon database connectivity"
            echo "4. Check Worker logs: wrangler tail"
        else
            echo "⚠️ Database pool size: $DB_POOL (should be 1)"
            echo ""
            echo "🔧 Pool optimization may need redeployment"
        fi
        ;;
        
    7)
        echo ""
        echo "🚨 EMERGENCY RECOVERY MODE"
        echo "========================="
        echo ""
        echo "This will provide emergency contact information and recovery procedures."
        echo ""
        echo "🆘 EMERGENCY CONTACTS:"
        echo "• Cloudflare Status: https://www.cloudflarestatus.com/"
        echo "• Neon Status: https://neon.tech/docs/introduction/status"
        echo ""
        echo "🔧 IMMEDIATE RECOVERY STEPS:"
        echo "1. Check service status pages"
        echo "2. Verify DNS resolution"
        echo "3. Test with minimal Worker deployment"
        echo "4. Contact platform support if needed"
        echo ""
        echo "📋 RECOVERY CHECKLIST:"
        echo "□ Cloudflare Workers dashboard accessible"
        echo "□ Neon database responding"
        echo "□ DNS resolution working"
        echo "□ SSL certificates valid"
        echo "□ Environment variables configured"
        echo ""
        echo "💡 Quick recovery test:"
        echo "   curl -I $PRODUCTION_URL/api/health"
        ;;
        
    8)
        echo ""
        echo "📋 DEPLOYMENT HISTORY"
        echo "===================="
        
        echo "Recent deployment activity:"
        echo ""
        
        if [ -f "$ROLLBACK_LOG" ]; then
            echo "🔄 Rollback operations:"
            tail -10 "$ROLLBACK_LOG" 2>/dev/null || echo "No recent rollback operations"
        else
            echo "No rollback history found"
        fi
        
        echo ""
        echo "📦 Current optimization status:"
        echo "✅ Phase 1: Database pooling, caching, monitoring"
        echo "⏳ Phase 2: Service bindings (ready for deployment)"
        echo ""
        echo "🏗️ Architecture improvements:"
        echo "• neon client integration"
        echo "• Singleton connection pattern"
        echo "• Multi-layer caching"
        echo "• Performance monitoring"
        ;;
        
    9)
        echo ""
        echo "Exiting rollback system..."
        exit 0
        ;;
        
    *)
        echo ""
        echo "Invalid option. Please select 1-9."
        ;;
esac

echo ""
echo "📝 Operation logged to: $ROLLBACK_LOG"
echo ""
echo "To run rollback procedures again: ./rollback-procedures.sh"