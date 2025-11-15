# 🔧 **SENTRY CLI PRODUCTION SETUP GUIDE**

**Project**: Pitchey Movie Platform  
**Environment**: Production Hybrid Cloud  
**Date**: November 15, 2025

---

## 📋 **PROJECT CONTEXT**

### **Production Deployment**
- **Frontend**: https://pitchey.pages.dev (Cloudflare Pages)
- **Backend**: https://pitchey-backend-fresh.deno.dev (Deno Deploy)
- **Repository**: CavellTopDev/pitchey-app
- **Monitoring**: Complete observability stack with error tracking

### **Sentry Configuration**
```bash
# Your Sentry Details
SENTRY_ORG="cavell-top-dev"  # Update with your actual org slug
SENTRY_PROJECT="pitchey"     # Update with your actual project slug
SENTRY_DSN="https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
```

---

## 🚀 **1. SENTRY CLI INSTALLATION & SETUP**

### **Install Sentry CLI**
```bash
# Option 1: npm (recommended for Node.js projects)
npm install -g @sentry/cli

# Option 2: Direct download
curl -sL https://sentry.io/get-cli/ | bash

# Option 3: Homebrew (macOS)
brew install getsentry/tools/sentry-cli

# Verify installation
sentry-cli --version
```

### **Authentication Setup**
```bash
# Option 1: Login interactively
sentry-cli login

# Option 2: Set auth token directly
export SENTRY_AUTH_TOKEN="your_auth_token_here"

# Option 3: Create .sentryclirc file
cat > ~/.sentryclirc << 'EOF'
[auth]
token=your_auth_token_here

[defaults]
org=cavell-top-dev
project=pitchey
EOF
```

### **Project Configuration**
```bash
# Navigate to your project root
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Create .sentryclirc in project root
cat > .sentryclirc << 'EOF'
[defaults]
org=cavell-top-dev
project=pitchey
url=https://sentry.io/

[auth]
token=your_auth_token_here
EOF

# Add to .gitignore to protect auth token
echo ".sentryclirc" >> .gitignore
```

---

## 📊 **2. ERROR ANALYSIS COMMANDS**

### **View Recent Issues**
```bash
# List all recent issues
sentry-cli issues list

# List issues from last 24 hours
sentry-cli issues list --query "is:unresolved" --query "age:-1d"

# List issues by environment
sentry-cli issues list --query "environment:production"

# List issues by specific error type
sentry-cli issues list --query "error.type:TypeError"
```

### **Detailed Issue Analysis**
```bash
# Get specific issue details
sentry-cli issues show ISSUE_ID

# Get issue events (stack traces, user context)
sentry-cli api events/ISSUE_ID/

# Search for specific errors
sentry-cli issues list --query "message:'Database connection failed'"
```

### **Performance Analysis**
```bash
# List transactions (API endpoints)
sentry-cli api /projects/cavell-top-dev/pitchey/events/ --query "event.type:transaction"

# Get performance data for specific endpoint
sentry-cli api /projects/cavell-top-dev/pitchey/events/ --query "transaction:/api/auth/login"

# Performance overview
sentry-cli api /projects/cavell-top-dev/pitchey/stats/
```

---

## 🎯 **3. RELEASE MANAGEMENT**

### **Create and Manage Releases**
```bash
# Create a new release (run this on each deployment)
RELEASE_VERSION="v$(date +%Y%m%d_%H%M%S)"
sentry-cli releases new $RELEASE_VERSION

# Associate commits with release
sentry-cli releases set-commits $RELEASE_VERSION --auto

# Deploy frontend source maps
cd frontend
npm run build
sentry-cli releases files $RELEASE_VERSION upload-sourcemaps dist/ \
  --url-prefix "~/assets/" \
  --validate \
  --strip-common-prefix

# Deploy backend source maps (if applicable)
cd ..
sentry-cli releases files $RELEASE_VERSION upload-sourcemaps src/ \
  --url-prefix "~/src/" \
  --validate

# Finalize release
sentry-cli releases finalize $RELEASE_VERSION

# Set release as deployed
sentry-cli releases deploys $RELEASE_VERSION new \
  --env production \
  --url "https://pitchey.pages.dev"
```

### **Release Health Monitoring**
```bash
# Check release health
sentry-cli releases list

# Get specific release details
sentry-cli releases info $RELEASE_VERSION

# Compare releases
sentry-cli releases compare v20251115_143000 v20251115_144500
```

---

## 🔍 **4. REAL-TIME DEBUGGING**

### **Live Error Monitoring**
```bash
# Stream live errors
sentry-cli monitor

# Filter live errors by environment
sentry-cli api /projects/cavell-top-dev/pitchey/events/ --query "environment:production" -w

# Monitor specific user sessions
sentry-cli api /projects/cavell-top-dev/pitchey/events/ --query "user.email:sarah.investor@demo.com"
```

### **Issue Investigation**
```bash
# Get full context for an issue
function investigate_issue() {
  local issue_id=$1
  echo "🔍 Investigating issue: $issue_id"
  
  # Basic issue info
  sentry-cli issues show $issue_id
  
  # Recent events
  echo "📋 Recent Events:"
  sentry-cli api /issues/$issue_id/events/
  
  # User impact
  echo "👥 Affected Users:"
  sentry-cli api /issues/$issue_id/users/
  
  # Environment distribution
  echo "🌍 Environment Distribution:"
  sentry-cli api /issues/$issue_id/tags/environment/
}

# Usage: investigate_issue SENTRY_ISSUE_ID
```

---

## ⚙️ **5. AUTOMATION SCRIPTS**

### **Daily Health Check Script**
```bash
#!/bin/bash
# File: scripts/sentry-health-check.sh

echo "📊 DAILY SENTRY HEALTH REPORT - $(date)"
echo "======================================="

# New issues in last 24h
echo "🆕 NEW ISSUES (Last 24h):"
sentry-cli issues list --query "age:-1d" --query "is:unresolved" | head -10

# Error rate
echo "📈 ERROR STATISTICS:"
sentry-cli api /projects/cavell-top-dev/pitchey/stats/ --since="24h"

# Top errors
echo "🔥 TOP ERRORS:"
sentry-cli issues list --query "is:unresolved" --sort="freq" | head -5

# Performance issues
echo "⚡ SLOW TRANSACTIONS:"
sentry-cli api /projects/cavell-top-dev/pitchey/events/ \
  --query "event.type:transaction" \
  --query "transaction.duration:>2000"

echo "✅ Health check complete!"
```

### **Deployment Release Script**
```bash
#!/bin/bash
# File: scripts/sentry-deploy.sh

RELEASE_VERSION="v$(date +%Y%m%d_%H%M%S)"
echo "🚀 Creating Sentry release: $RELEASE_VERSION"

# Create release
sentry-cli releases new $RELEASE_VERSION
sentry-cli releases set-commits $RELEASE_VERSION --auto

# Upload frontend source maps
echo "📦 Uploading frontend source maps..."
cd frontend
npm run build
sentry-cli releases files $RELEASE_VERSION upload-sourcemaps dist/ \
  --url-prefix "~/assets/" \
  --validate \
  --strip-common-prefix

# Finalize and deploy
cd ..
sentry-cli releases finalize $RELEASE_VERSION
sentry-cli releases deploys $RELEASE_VERSION new \
  --env production \
  --url "https://pitchey.pages.dev"

echo "✅ Release $RELEASE_VERSION deployed successfully!"
```

### **Error Alert Script**
```bash
#!/bin/bash
# File: scripts/sentry-alerts.sh

# Check for critical errors in last hour
CRITICAL_ERRORS=$(sentry-cli issues list --query "level:error" --query "age:-1h" --query "is:unresolved" | wc -l)

if [ $CRITICAL_ERRORS -gt 5 ]; then
  echo "🚨 ALERT: $CRITICAL_ERRORS critical errors in the last hour!"
  sentry-cli issues list --query "level:error" --query "age:-1h" --query "is:unresolved"
  
  # Send notification (customize as needed)
  # curl -X POST "your-slack-webhook" -d "{'text': 'Critical errors detected!'}"
fi
```

---

## 🔧 **6. GITHUB ACTIONS INTEGRATION**

### **Automated Release Creation**
```yaml
# File: .github/workflows/sentry-release.yml
name: Sentry Release
on:
  push:
    branches: [main]
  
jobs:
  sentry_release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Create Sentry Release
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: cavell-top-dev
          SENTRY_PROJECT: pitchey
        run: |
          npm install -g @sentry/cli
          RELEASE_VERSION="v${{ github.run_number }}"
          
          sentry-cli releases new $RELEASE_VERSION
          sentry-cli releases set-commits $RELEASE_VERSION --auto
          
          # Upload source maps after build
          cd frontend && npm ci && npm run build
          sentry-cli releases files $RELEASE_VERSION upload-sourcemaps dist/ \
            --url-prefix "~/assets/"
          
          sentry-cli releases finalize $RELEASE_VERSION
          sentry-cli releases deploys $RELEASE_VERSION new \
            --env production
```

---

## 📈 **7. ADVANCED DEBUGGING WORKFLOWS**

### **Performance Investigation**
```bash
# Find slow API endpoints
function find_slow_endpoints() {
  echo "🐌 Slowest API endpoints (>2s):"
  sentry-cli api /projects/cavell-top-dev/pitchey/events/ \
    --query "event.type:transaction" \
    --query "transaction.duration:>2000" \
    --query "environment:production"
}

# Database query analysis
function analyze_db_performance() {
  echo "🗄️ Database performance issues:"
  sentry-cli issues list --query "message:*database*" --query "is:unresolved"
}

# User experience analysis
function analyze_user_experience() {
  echo "👤 User experience issues:"
  sentry-cli issues list --query "level:error" --query "user.email:*" --sort="lastSeen"
}
```

### **Error Pattern Analysis**
```bash
# Group errors by type
function error_patterns() {
  echo "📊 Error patterns in last 7 days:"
  
  echo "🔸 Frontend JavaScript Errors:"
  sentry-cli issues list --query "platform:javascript" --query "age:-7d"
  
  echo "🔸 Backend API Errors:"
  sentry-cli issues list --query "platform:other" --query "age:-7d"
  
  echo "🔸 Authentication Errors:"
  sentry-cli issues list --query "message:*auth*" --query "age:-7d"
  
  echo "🔸 Database Errors:"
  sentry-cli issues list --query "message:*database*" --query "age:-7d"
}
```

---

## 🎛️ **8. PRODUCTION MONITORING COMMANDS**

### **Quick Health Status**
```bash
# One-liner health check
alias sentry-status='sentry-cli issues list --query "is:unresolved" --query "age:-1h" | wc -l | xargs -I {} echo "Active issues in last hour: {}"'

# Dashboard overview
alias sentry-overview='sentry-cli api /projects/cavell-top-dev/pitchey/stats/ --since="24h"'

# User impact
alias sentry-users='sentry-cli api /projects/cavell-top-dev/pitchey/users/ --query="age:-24h"'
```

### **Deployment Verification**
```bash
function verify_deployment() {
  local release=$1
  echo "🔍 Verifying deployment: $release"
  
  # Check release exists
  sentry-cli releases info $release
  
  # Check for new errors since release
  echo "🚨 New errors since deployment:"
  sentry-cli issues list --query "age:-1h" --query "is:unresolved" --query "release:$release"
  
  # Performance impact
  echo "⚡ Performance impact:"
  sentry-cli api /projects/cavell-top-dev/pitchey/events/ \
    --query "event.type:transaction" \
    --query "release:$release"
}
```

---

## 📚 **9. USEFUL SENTRY CLI ALIASES**

Add these to your `.bashrc` or `.zshrc`:

```bash
# Sentry aliases for quick access
alias s-issues='sentry-cli issues list --query "is:unresolved" | head -20'
alias s-errors='sentry-cli issues list --query "level:error" --query "age:-24h"'
alias s-stats='sentry-cli api /projects/cavell-top-dev/pitchey/stats/ --since="24h"'
alias s-releases='sentry-cli releases list | head -10'
alias s-monitor='sentry-cli monitor'

# Quick investigation
alias s-investigate='function _inv() { sentry-cli issues show $1; }; _inv'
alias s-deploy-check='function _dc() { verify_deployment $1; }; _dc'
```

---

## 🔐 **10. SECURITY BEST PRACTICES**

### **Protect Auth Tokens**
```bash
# Store auth token securely
export SENTRY_AUTH_TOKEN=$(security find-generic-password -w -s sentry-auth)

# Or use encrypted storage
echo "your_token" | gpg -e -r your@email.com > ~/.sentry_token.gpg
export SENTRY_AUTH_TOKEN=$(gpg -d ~/.sentry_token.gpg)
```

### **Project Access Control**
```bash
# List team permissions
sentry-cli api /organizations/cavell-top-dev/members/

# Check your access level
sentry-cli api /projects/cavell-top-dev/pitchey/
```

---

## 🚀 **11. GETTING STARTED CHECKLIST**

### **Immediate Setup (5 minutes)**
```bash
# 1. Install CLI
npm install -g @sentry/cli

# 2. Authenticate
sentry-cli login

# 3. Test connection
sentry-cli issues list | head -5

# 4. Create project config
cat > .sentryclirc << 'EOF'
[defaults]
org=cavell-top-dev
project=pitchey
EOF

# 5. Run first health check
sentry-cli api /projects/cavell-top-dev/pitchey/stats/ --since="24h"
```

### **Daily Workflow**
```bash
# Morning routine
sentry-status                    # Check overnight issues
s-errors                        # Review new errors
s-stats                         # Performance overview

# During development
s-monitor                       # Live error monitoring

# After deployment
sentry-deploy.sh               # Create release
verify_deployment $RELEASE    # Check deployment health
```

---

## 📞 **12. TROUBLESHOOTING**

### **Common Issues**
```bash
# Auth issues
sentry-cli info  # Check current configuration

# Network issues
sentry-cli api /projects/ --verbose  # Debug API calls

# Permission issues
sentry-cli api /organizations/cavell-top-dev/  # Check org access
```

### **Debug Mode**
```bash
# Enable debug logging
export SENTRY_LOG_LEVEL=debug
sentry-cli --log-level=debug issues list
```

---

## ✅ **SUCCESS VALIDATION**

After setup, verify everything works:

```bash
# Test authentication
sentry-cli info

# Test project access
sentry-cli issues list | head -5

# Test API access
sentry-cli api /projects/cavell-top-dev/pitchey/

# Create test release
sentry-cli releases new "test-$(date +%s)"
```

**Expected Output**: You should see your project data, recent issues, and be able to create releases successfully.

---

🎯 **Your Sentry CLI is now fully configured for production monitoring and debugging!**

Use the commands and scripts above to maintain complete visibility into your production deployment across both frontend and backend platforms.