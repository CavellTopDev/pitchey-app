---
description: devhelper
---

# Pitchey Local Development Helper

A bash script for local consistency validation, pre-deploy checks, and production comparison.

---

## Overview

| Command | Purpose |
|---------|---------|
| `./dev-helper.sh check` | Run all consistency checks |
| `./dev-helper.sh sync` | Sync lockfile and validate |
| `./dev-helper.sh build` | Build and validate |
| `./dev-helper.sh compare` | Compare local vs production |
| `./dev-helper.sh logs` | Stream production Worker logs |
| `./dev-helper.sh deploy` | Pre-deploy checklist |

---

## Installation

### 1. Create the script

Save as `dev-helper.sh` in your project root:

```bash
#!/bin/bash

# ============================================
# Pitchey Local Development Helper
# ============================================
# 
# Usage:
#   ./dev-helper.sh [command]
#
# Commands:
#   check     - Run all consistency checks
#   sync      - Sync lockfile and validate
#   build     - Build and validate
#   compare   - Compare local vs production
#   logs      - Fetch production logs
#   deploy    - Pre-deploy checklist
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - UPDATE THESE FOR YOUR PROJECT
PAGES_URL="https://pitchey-5o8.pages.dev"
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
WORKER_NAME="pitchey-api-prod"

# ============================================
# Helper Functions
# ============================================

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================
# Commands
# ============================================

cmd_check() {
    print_header "Running Consistency Checks"
    
    # Check 1: Node version
    echo "Checking Node.js version..."
    NODE_VER=$(node --version)
    if [[ "$NODE_VER" == v22* ]]; then
        print_success "Node version matches CI ($NODE_VER)"
    else
        print_warning "Node version mismatch - CI uses v22.x, you have $NODE_VER"
    fi
    
    # Check 2: Lockfile sync
    echo ""
    echo "Checking lockfile synchronization..."
    if npm ci --dry-run 2>&1 | grep -q "Missing:"; then
        print_error "Lockfile out of sync! Run: ./dev-helper.sh sync"
        exit 1
    else
        print_success "Lockfile is synchronized"
    fi
    
    # Check 3: TypeScript
    echo ""
    echo "Checking TypeScript..."
    if npm run typecheck 2>&1 | grep -q "error TS"; then
        print_error "TypeScript errors found!"
        exit 1
    else
        print_success "TypeScript check passed"
    fi
    
    # Check 4: Build
    echo ""
    echo "Checking build..."
    if npm run build > /dev/null 2>&1; then
        print_success "Build successful"
    else
        print_error "Build failed!"
        exit 1
    fi
    
    # Check 5: Environment files
    echo ""
    echo "Checking environment files..."
    if [ -f .env ] && ! grep -q ".env" .gitignore 2>/dev/null; then
        print_warning ".env exists but may not be in .gitignore"
    fi
    if [ -f .dev.vars ] && ! grep -q ".dev.vars" .gitignore 2>/dev/null; then
        print_warning ".dev.vars exists but may not be in .gitignore"
    fi
    
    echo ""
    print_success "All checks passed!"
}

cmd_sync() {
    print_header "Syncing Dependencies"
    
    echo "Removing node_modules and package-lock.json..."
    rm -rf node_modules package-lock.json
    
    echo "Running npm install..."
    npm install
    
    echo "Verifying with npm ci..."
    npm ci
    
    print_success "Dependencies synced successfully!"
    echo ""
    echo "Don't forget to commit package-lock.json:"
    echo "  git add package-lock.json"
    echo "  git commit -m 'chore: sync package-lock.json'"
}

cmd_build() {
    print_header "Building Project"
    
    echo "Installing dependencies..."
    npm ci
    
    echo ""
    echo "Running TypeScript check..."
    npm run typecheck
    
    echo ""
    echo "Building..."
    npm run build
    
    # Generate build hash
    if [ -d dist ]; then
        BUILD_HASH=$(find dist -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1)
        echo ""
        print_success "Build complete!"
        echo "Build hash: ${BUILD_HASH:0:16}..."
    fi
}

cmd_compare() {
    print_header "Comparing Local vs Production"
    
    echo "Local State:"
    echo "  Commit: $(git rev-parse HEAD)"
    echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "  Status: $(git status --porcelain | wc -l) uncommitted changes"
    
    echo ""
    echo "Production State:"
    
    # Check Pages
    echo "  Pages ($PAGES_URL):"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL")
    echo "    HTTP Status: $HTTP_STATUS"
    
    # Check Worker
    echo "  Worker ($WORKER_URL):"
    WORKER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/health" 2>/dev/null || echo "error")
    echo "    Health: $WORKER_STATUS"
    
    # Try to get version
    VERSION_RESPONSE=$(curl -s "$WORKER_URL/version" 2>/dev/null || echo "{}")
    if echo "$VERSION_RESPONSE" | grep -q "commit"; then
        PROD_COMMIT=$(echo "$VERSION_RESPONSE" | grep -o '"commit":"[^"]*"' | cut -d'"' -f4)
        echo "    Commit: $PROD_COMMIT"
        
        LOCAL_COMMIT=$(git rev-parse HEAD)
        if [ "$PROD_COMMIT" == "$LOCAL_COMMIT" ]; then
            echo ""
            print_success "Production matches local commit!"
        else
            echo ""
            print_warning "Production commit differs from local"
            echo "  Local:      ${LOCAL_COMMIT:0:12}"
            echo "  Production: ${PROD_COMMIT:0:12}"
        fi
    else
        echo "    Version endpoint not available (add /version to your Worker)"
    fi
}

cmd_logs() {
    print_header "Fetching Production Logs"
    
    echo "Starting Worker log stream (Ctrl+C to stop)..."
    echo ""
    
    if command -v wrangler &> /dev/null; then
        wrangler tail $WORKER_NAME --format pretty
    else
        print_error "Wrangler not installed. Run: npm install -g wrangler"
        exit 1
    fi
}

cmd_deploy() {
    print_header "Pre-Deploy Checklist"
    
    READY=true
    
    # 1. Check for uncommitted changes
    echo "1. Checking for uncommitted changes..."
    CHANGES=$(git status --porcelain | wc -l)
    if [ "$CHANGES" -gt 0 ]; then
        print_warning "$CHANGES uncommitted changes found"
        READY=false
    else
        print_success "Working directory clean"
    fi
    
    # 2. Check lockfile
    echo ""
    echo "2. Checking lockfile..."
    if npm ci --dry-run 2>&1 | grep -q "Missing:"; then
        print_error "Lockfile out of sync!"
        READY=false
    else
        print_success "Lockfile synchronized"
    fi
    
    # 3. TypeScript
    echo ""
    echo "3. Checking TypeScript..."
    if npm run typecheck > /dev/null 2>&1; then
        print_success "TypeScript check passed"
    else
        print_error "TypeScript errors found!"
        READY=false
    fi
    
    # 4. Build
    echo ""
    echo "4. Testing build..."
    if npm run build > /dev/null 2>&1; then
        print_success "Build successful"
    else
        print_error "Build failed!"
        READY=false
    fi
    
    # 5. Branch check
    echo ""
    echo "5. Checking branch..."
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$BRANCH" == "main" ]; then
        print_success "On main branch"
    else
        print_warning "Not on main branch ($BRANCH)"
    fi
    
    # 6. Check if ahead of remote
    echo ""
    echo "6. Checking remote sync..."
    git fetch origin main --quiet 2>/dev/null || true
    AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    
    if [ "$AHEAD" == "0" ] && [ "$BEHIND" == "0" ]; then
        print_success "Up to date with origin/main"
    else
        if [ "$AHEAD" != "0" ]; then
            echo "  📤 $AHEAD commits ahead of origin/main"
        fi
        if [ "$BEHIND" != "0" ]; then
            print_warning "$BEHIND commits behind origin/main - consider pulling"
        fi
    fi
    
    # Summary
    echo ""
    echo "============================================"
    if [ "$READY" = true ]; then
        print_success "Ready to deploy!"
        echo ""
        echo "Next steps:"
        echo "  git push origin main"
        echo ""
        echo "Or to deploy manually:"
        echo "  npm run deploy"
    else
        print_error "Not ready to deploy - fix issues above"
        exit 1
    fi
}

cmd_help() {
    echo "Pitchey Development Helper"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  check    - Run all consistency checks (default)"
    echo "  sync     - Sync lockfile and validate"
    echo "  build    - Build and validate"
    echo "  compare  - Compare local vs production"
    echo "  logs     - Stream production Worker logs"
    echo "  deploy   - Pre-deploy checklist"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check       # Verify everything is good"
    echo "  $0 sync        # Fix lockfile issues"
    echo "  $0 deploy      # Pre-push validation"
}

# ============================================
# Main
# ============================================

case "${1:-check}" in
    check)
        cmd_check
        ;;
    sync)
        cmd_sync
        ;;
    build)
        cmd_build
        ;;
    compare)
        cmd_compare
        ;;
    logs)
        cmd_logs
        ;;
    deploy)
        cmd_deploy
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        cmd_help
        exit 1
        ;;
esac
```

### 2. Make executable

```bash
chmod +x dev-helper.sh
```

### 3. (Optional) Add to PATH

```bash
# Add to ~/.bashrc or ~/.zshrc
alias pitchey="./dev-helper.sh"
```

---

## Commands

### check

Runs all consistency validations:

```bash
./dev-helper.sh check
```

**Checks performed:**
- ✅ Node.js version (expects v22.x)
- ✅ Lockfile synchronization
- ✅ TypeScript compilation
- ✅ Build success
- ✅ Environment file security

---

### sync

Fixes lockfile synchronization issues:

```bash
./dev-helper.sh sync
```

**Actions:**
1. Removes `node_modules/` and `package-lock.json`
2. Runs fresh `npm install`
3. Validates with `npm ci`

**After running:**
```bash
git add package-lock.json
git commit -m "chore: sync package-lock.json"
```

---

### build

Full build with validation:

```bash
./dev-helper.sh build
```

**Actions:**
1. Clean install dependencies
2. TypeScript check
3. Production build
4. Generate build hash

---

### compare

Compare local state vs production:

```bash
./dev-helper.sh compare
```

**Output:**
```
Local State:
  Commit: abc123...
  Branch: main
  Status: 0 uncommitted changes

Production State:
  Pages (https://pitchey-5o8.pages.dev):
    HTTP Status: 200
  Worker (https://pitchey-api-prod...):
    Health: 200
    Commit: abc123...

✅ Production matches local commit!
```

---

### logs

Stream real-time Worker logs:

```bash
./dev-helper.sh logs
```

**Requires:** Wrangler CLI installed and authenticated

```bash
# If not installed
npm install -g wrangler
wrangler login
```

---

### deploy

Pre-deployment validation checklist:

```bash
./dev-helper.sh deploy
```

**Checks:**
1. ✅ No uncommitted changes
2. ✅ Lockfile synchronized
3. ✅ TypeScript passes
4. ✅ Build succeeds
5. ✅ On main branch
6. ✅ Synced with remote

---

## Typical Workflows

### Daily Development

```bash
# Start of day - verify everything is good
./dev-helper.sh check

# Make changes...

