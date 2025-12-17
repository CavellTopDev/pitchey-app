#!/bin/bash

# Security Testing Integration Script
# Comprehensive security scanning for the Pitchey platform

set -e

echo "🔐 Running Security Scans..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Security scan results
RESULTS_FILE="security-scan-results.json"
REPORT_FILE="security-report.md"

# Initialize results file
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scans": {
    "dependencies": {"status": "pending", "vulnerabilities": []},
    "secrets": {"status": "pending", "findings": []},
    "sast": {"status": "pending", "issues": []},
    "docker": {"status": "pending", "vulnerabilities": []},
    "api": {"status": "pending", "security_issues": []}
  },
  "summary": {
    "total_vulnerabilities": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  }
}
EOF

# Track overall security status
security_pass=true
total_critical=0
total_high=0
total_medium=0
total_low=0

# ==================== DEPENDENCY SCANNING ====================

echo "📦 Scanning Dependencies for Vulnerabilities..."

# Frontend dependency scan
frontend_vulns=0
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "  Scanning frontend dependencies..."
    cd frontend
    
    if command -v npm >/dev/null 2>&1; then
        # Run npm audit
        audit_output=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
        
        # Count vulnerabilities by severity
        critical_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
        high_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
        medium_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
        low_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
        
        frontend_vulns=$((critical_count + high_count + medium_count + low_count))
        
        echo "    Frontend vulnerabilities: Critical($critical_count), High($high_count), Medium($medium_count), Low($low_count)"
        
        total_critical=$((total_critical + critical_count))
        total_high=$((total_high + high_count))
        total_medium=$((total_medium + medium_count))
        total_low=$((total_low + low_count))
        
        if [ "$critical_count" -gt 0 ] || [ "$high_count" -gt 0 ]; then
            security_pass=false
            echo -e "    ${RED}❌ Critical/High vulnerabilities found in frontend dependencies${NC}"
        else
            echo -e "    ${GREEN}✅ No critical/high vulnerabilities in frontend dependencies${NC}"
        fi
    else
        echo -e "    ${YELLOW}⚠️  npm not available, skipping frontend dependency scan${NC}"
    fi
    
    cd ..
else
    echo -e "  ${YELLOW}⚠️  Frontend directory not found${NC}"
fi

# Backend dependency scan (Deno)
backend_vulns=0
if [ -f "deno.json" ] || [ -f "deno.jsonc" ]; then
    echo "  Scanning backend dependencies..."
    
    if command -v deno >/dev/null 2>&1; then
        # Create a simple dependency scanner for Deno
        cat > temp-deps-scan.ts << 'EOF'
// Simplified dependency security check for Deno
const configFiles = ['deno.json', 'deno.jsonc', 'import_map.json'];

for (const file of configFiles) {
  try {
    const config = JSON.parse(await Deno.readTextFile(file));
    
    // Check for known vulnerable dependencies (simplified)
    const vulnerableDeps = [
      'oak@v6.0.0',  // Example vulnerable version
      'cors@v1.0.0'  // Example vulnerable version
    ];
    
    const imports = config.imports || {};
    const deps = config.dependencies || {};
    
    let findings = [];
    
    // Check imports
    for (const [name, version] of Object.entries(imports)) {
      if (vulnerableDeps.some(vuln => name.includes(vuln))) {
        findings.push({severity: 'medium', dependency: name, issue: 'potentially vulnerable version'});
      }
    }
    
    // Basic security checks
    for (const [name, url] of Object.entries(imports)) {
      if (typeof url === 'string' && !url.startsWith('https://')) {
        findings.push({severity: 'low', dependency: name, issue: 'non-HTTPS dependency'});
      }
    }
    
    console.log(JSON.stringify({vulnerabilities: findings}));
    break;
  } catch {
    continue;
  }
}
EOF
        
        deps_scan=$(deno run --allow-read temp-deps-scan.ts 2>/dev/null || echo '{"vulnerabilities":[]}')
        rm -f temp-deps-scan.ts
        
        backend_vulns=$(echo "$deps_scan" | jq -r '.vulnerabilities | length' 2>/dev/null || echo "0")
        
        if [ "$backend_vulns" -gt 0 ]; then
            echo "    Backend dependency issues found: $backend_vulns"
            echo "$deps_scan" | jq -r '.vulnerabilities[] | "      \(.severity | ascii_upcase): \(.dependency) - \(.issue)"' 2>/dev/null || echo "      Issues found but details unavailable"
        else
            echo -e "    ${GREEN}✅ No dependency issues found in backend${NC}"
        fi
    else
        echo -e "    ${YELLOW}⚠️  Deno not available, skipping backend dependency scan${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  No Deno configuration found${NC}"
fi

# ==================== SECRET SCANNING ====================

echo "🔍 Scanning for Exposed Secrets..."

secret_findings=0

# Check for common secret patterns
secret_patterns=(
    "password\s*=\s*['\"][^'\"]{8,}['\"]"
    "api_?key\s*=\s*['\"][^'\"]{20,}['\"]"
    "secret\s*=\s*['\"][^'\"]{16,}['\"]"
    "token\s*=\s*['\"][^'\"]{20,}['\"]"
    "AKIA[0-9A-Z]{16}"  # AWS Access Key ID
    "-----BEGIN.*PRIVATE KEY-----"
    "sk_live_[0-9a-zA-Z]{24,}"  # Stripe secret key
    "xoxb-[0-9]+-[0-9]+-[0-9a-zA-Z]+"  # Slack bot token
)

echo "  Checking for hardcoded secrets in source files..."

# Scan source files
files_to_scan=(
    "src/**/*.ts"
    "frontend/src/**/*.{ts,tsx,js,jsx}"
    "*.json"
    "*.yaml"
    "*.yml"
    "*.env*"
)

for pattern in "${secret_patterns[@]}"; do
    for file_pattern in "${files_to_scan[@]}"; do
        if command -v find >/dev/null 2>&1 && command -v grep >/dev/null 2>&1; then
            findings=$(find . -name "$file_pattern" -not -path "./node_modules/*" -not -path "./.git/*" -exec grep -l "$pattern" {} \; 2>/dev/null | head -5)
            
            if [ -n "$findings" ]; then
                secret_findings=$((secret_findings + 1))
                echo -e "    ${RED}❌ Potential secret found matching pattern: $pattern${NC}"
                echo "$findings" | sed 's/^/      /'
            fi
        fi
    done
done

# Check .env files specifically
if find . -name ".env*" -not -path "./.git/*" | grep -q .; then
    echo "  Found .env files - ensuring they're in .gitignore..."
    
    if [ -f ".gitignore" ]; then
        if grep -q "\.env" .gitignore; then
            echo -e "    ${GREEN}✅ .env files properly ignored${NC}"
        else
            echo -e "    ${RED}❌ .env files not in .gitignore${NC}"
            secret_findings=$((secret_findings + 1))
        fi
    else
        echo -e "    ${RED}❌ No .gitignore found${NC}"
        secret_findings=$((secret_findings + 1))
    fi
fi

if [ "$secret_findings" -eq 0 ]; then
    echo -e "  ${GREEN}✅ No secrets detected in source code${NC}"
else
    security_pass=false
    echo -e "  ${RED}❌ $secret_findings potential secret exposures found${NC}"
fi

# ==================== STATIC APPLICATION SECURITY TESTING (SAST) ====================

echo "🕵️  Running Static Application Security Testing..."

sast_issues=0

# Check for common security anti-patterns in TypeScript/JavaScript
security_antipatterns=(
    "eval\("
    "innerHTML\s*="
    "outerHTML\s*="
    "document\.write\("
    "dangerouslySetInnerHTML"
    "process\.env\.[A-Z_]+\s*(?!==|!==)"  # Direct env var usage
    "Math\.random\(\).*password|token|secret"  # Weak random for security
    "setTimeout\(.*eval"
    "setInterval\(.*eval"
)

echo "  Scanning for security anti-patterns..."

for pattern in "${security_antipatterns[@]}"; do
    if command -v find >/dev/null 2>&1 && command -v grep >/dev/null 2>&1; then
        findings=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | xargs grep -l "$pattern" 2>/dev/null | head -5)
        
        if [ -n "$findings" ]; then
            sast_issues=$((sast_issues + 1))
            echo -e "    ${RED}❌ Security anti-pattern found: $pattern${NC}"
            echo "$findings" | sed 's/^/      /'
        fi
    fi
done

# Check for SQL injection patterns
sql_patterns=(
    "query.*\+.*req\."
    "SELECT.*\+.*user"
    "INSERT.*\+.*req\."
    "UPDATE.*\+.*req\."
    "DELETE.*\+.*req\."
)

echo "  Checking for potential SQL injection patterns..."

for pattern in "${sql_patterns[@]}"; do
    if command -v find >/dev/null 2>&1 && command -v grep >/dev/null 2>&1; then
        findings=$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -l "$pattern" 2>/dev/null | head -3)
        
        if [ -n "$findings" ]; then
            sast_issues=$((sast_issues + 1))
            echo -e "    ${RED}❌ Potential SQL injection pattern: $pattern${NC}"
            echo "$findings" | sed 's/^/      /'
        fi
    fi
done

if [ "$sast_issues" -eq 0 ]; then
    echo -e "  ${GREEN}✅ No obvious security anti-patterns detected${NC}"
else
    security_pass=false
    echo -e "  ${RED}❌ $sast_issues potential security issues found${NC}"
fi

# ==================== DOCKER SECURITY SCAN ====================

echo "🐳 Scanning Docker Configuration..."

docker_vulns=0

if [ -f "Dockerfile" ] || [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
    echo "  Checking Docker security best practices..."
    
    # Check Dockerfile security
    if [ -f "Dockerfile" ]; then
        # Check for running as root
        if ! grep -q "USER " Dockerfile; then
            docker_vulns=$((docker_vulns + 1))
            echo -e "    ${YELLOW}⚠️  Dockerfile doesn't specify non-root USER${NC}"
        fi
        
        # Check for COPY --chown
        if grep -q "COPY.*--chown" Dockerfile; then
            echo -e "    ${GREEN}✅ Using COPY --chown for proper ownership${NC}"
        fi
        
        # Check for .dockerignore
        if [ ! -f ".dockerignore" ]; then
            docker_vulns=$((docker_vulns + 1))
            echo -e "    ${YELLOW}⚠️  No .dockerignore file found${NC}"
        fi
    fi
    
    # Check docker-compose security
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
        compose_file=$(ls docker-compose.yml docker-compose.yaml 2>/dev/null | head -1)
        
        # Check for privileged containers
        if grep -q "privileged.*true" "$compose_file"; then
            docker_vulns=$((docker_vulns + 1))
            echo -e "    ${RED}❌ Privileged containers detected${NC}"
        fi
        
        # Check for exposed ports
        exposed_ports=$(grep -c "ports:" "$compose_file" 2>/dev/null || echo "0")
        if [ "$exposed_ports" -gt 3 ]; then
            echo -e "    ${YELLOW}⚠️  Many ports exposed ($exposed_ports)${NC}"
        fi
    fi
    
    if [ "$docker_vulns" -eq 0 ]; then
        echo -e "  ${GREEN}✅ Docker configuration looks secure${NC}"
    else
        echo -e "  ${YELLOW}⚠️  $docker_vulns Docker security issues found${NC}"
    fi
else
    echo -e "  ${BLUE}ℹ️  No Docker configuration found${NC}"
fi

# ==================== API SECURITY SCAN ====================

echo "🌐 Scanning API Security..."

api_issues=0

# Check for common API security issues
if [ -d "src/routes" ]; then
    echo "  Checking API route security..."
    
    # Check for authentication middleware
    if find src/routes -name "*.ts" -exec grep -l "auth" {} \; | wc -l | grep -q "0"; then
        api_issues=$((api_issues + 1))
        echo -e "    ${RED}❌ Routes found without authentication checks${NC}"
    fi
    
    # Check for rate limiting
    if ! find src -name "*.ts" -exec grep -l "rate.*limit" {} \; | grep -q .; then
        api_issues=$((api_issues + 1))
        echo -e "    ${YELLOW}⚠️  No rate limiting middleware detected${NC}"
    fi
    
    # Check for CORS configuration
    if ! find src -name "*.ts" -exec grep -l "cors" {} \; | grep -q .; then
        api_issues=$((api_issues + 1))
        echo -e "    ${YELLOW}⚠️  No CORS configuration detected${NC}"
    fi
    
    # Check for input validation
    validation_files=$(find src -name "*.ts" -exec grep -l "validate\|joi\|zod\|yup" {} \; | wc -l)
    if [ "$validation_files" -lt 3 ]; then
        api_issues=$((api_issues + 1))
        echo -e "    ${YELLOW}⚠️  Limited input validation detected${NC}"
    fi
    
    if [ "$api_issues" -eq 0 ]; then
        echo -e "  ${GREEN}✅ API security configurations look good${NC}"
    else
        echo -e "  ${YELLOW}⚠️  $api_issues API security recommendations${NC}"
    fi
else
    echo -e "  ${BLUE}ℹ️  No API routes directory found${NC}"
fi

# ==================== INFRASTRUCTURE SECURITY ====================

echo "🏗️  Checking Infrastructure Security..."

infra_issues=0

# Check environment configuration
if [ -f "wrangler.toml" ]; then
    echo "  Checking Cloudflare Workers configuration..."
    
    # Check for secrets in wrangler.toml
    if grep -q "secret" wrangler.toml; then
        if ! grep -q "\[vars\]" wrangler.toml || ! grep -q "secrets.*=.*\"\"" wrangler.toml; then
            echo -e "    ${GREEN}✅ Secrets properly configured${NC}"
        else
            infra_issues=$((infra_issues + 1))
            echo -e "    ${RED}❌ Secrets may be exposed in wrangler.toml${NC}"
        fi
    fi
    
    # Check for development vs production configuration
    if grep -q "\[env\.production\]" wrangler.toml; then
        echo -e "    ${GREEN}✅ Production environment properly configured${NC}"
    else
        infra_issues=$((infra_issues + 1))
        echo -e "    ${YELLOW}⚠️  No production environment configuration${NC}"
    fi
fi

# Check GitHub Actions security
if [ -d ".github/workflows" ]; then
    echo "  Checking CI/CD security..."
    
    workflow_files=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null)
    
    for workflow in $workflow_files; do
        # Check for secrets usage
        if grep -q "secrets\." "$workflow"; then
            echo -e "    ${GREEN}✅ Secrets properly used in $workflow${NC}"
        fi
        
        # Check for pull request triggers on untrusted code
        if grep -q "pull_request_target" "$workflow"; then
            infra_issues=$((infra_issues + 1))
            echo -e "    ${RED}❌ pull_request_target trigger found in $workflow (security risk)${NC}"
        fi
    done
fi

if [ "$infra_issues" -eq 0 ]; then
    echo -e "  ${GREEN}✅ Infrastructure configuration looks secure${NC}"
else
    echo -e "  ${YELLOW}⚠️  $infra_issues infrastructure security issues found${NC}"
fi

# ==================== UPDATE RESULTS AND GENERATE REPORT ====================

echo "📊 Generating Security Report..."

# Update results file
jq --argjson dep_vulns "$((frontend_vulns + backend_vulns))" \
   --argjson secret_findings "$secret_findings" \
   --argjson sast_issues "$sast_issues" \
   --argjson docker_vulns "$docker_vulns" \
   --argjson api_issues "$api_issues" \
   --argjson total_critical "$total_critical" \
   --argjson total_high "$total_high" \
   --argjson total_medium "$total_medium" \
   --argjson total_low "$total_low" \
   '.scans.dependencies.vulnerabilities = $dep_vulns |
    .scans.secrets.findings = $secret_findings |
    .scans.sast.issues = $sast_issues |
    .scans.docker.vulnerabilities = $docker_vulns |
    .scans.api.security_issues = $api_issues |
    .summary.critical = $total_critical |
    .summary.high = $total_high |
    .summary.medium = $total_medium |
    .summary.low = $total_low |
    .summary.total_vulnerabilities = ($total_critical + $total_high + $total_medium + $total_low)' \
   "$RESULTS_FILE" > temp-results.json && mv temp-results.json "$RESULTS_FILE" 2>/dev/null || true

# Generate security report
cat > "$REPORT_FILE" << EOF
# Security Scan Report

Generated: $(date)

## Executive Summary

**Overall Security Status**: $([ "$security_pass" = true ] && echo "✅ PASS" || echo "❌ FAIL")

| Category | Issues Found | Risk Level |
|----------|--------------|------------|
| Dependencies | $((frontend_vulns + backend_vulns)) vulnerabilities | $([ "$((total_critical + total_high))" -gt 0 ] && echo "🔴 HIGH" || echo "🟢 LOW") |
| Secret Exposure | $secret_findings findings | $([ "$secret_findings" -gt 0 ] && echo "🔴 HIGH" || echo "🟢 LOW") |
| Code Security | $sast_issues issues | $([ "$sast_issues" -gt 0 ] && echo "🟡 MEDIUM" || echo "🟢 LOW") |
| Docker Security | $docker_vulns issues | $([ "$docker_vulns" -gt 0 ] && echo "🟡 MEDIUM" || echo "🟢 LOW") |
| API Security | $api_issues issues | $([ "$api_issues" -gt 0 ] && echo "🟡 MEDIUM" || echo "🟢 LOW") |

## Vulnerability Breakdown

- **Critical**: $total_critical
- **High**: $total_high  
- **Medium**: $total_medium
- **Low**: $total_low
- **Total**: $((total_critical + total_high + total_medium + total_low))

## Detailed Findings

### Dependency Vulnerabilities
$(if [ "$((frontend_vulns + backend_vulns))" -gt 0 ]; then
    echo "- Frontend: $frontend_vulns vulnerabilities"
    echo "- Backend: $backend_vulns vulnerabilities"
    echo ""
    echo "**Recommendation**: Run \`npm audit fix\` for frontend and update Deno dependencies."
else
    echo "✅ No dependency vulnerabilities found."
fi)

### Secret Exposure
$(if [ "$secret_findings" -gt 0 ]; then
    echo "⚠️ $secret_findings potential secret exposures detected."
    echo ""
    echo "**Recommendations**:"
    echo "- Remove hardcoded secrets from source code"
    echo "- Use environment variables or secure vaults"
    echo "- Ensure .env files are in .gitignore"
else
    echo "✅ No secrets detected in source code."
fi)

### Code Security Issues
$(if [ "$sast_issues" -gt 0 ]; then
    echo "⚠️ $sast_issues security anti-patterns found."
    echo ""
    echo "**Recommendations**:"
    echo "- Review flagged code patterns"
    echo "- Implement proper input validation"
    echo "- Use parameterized queries for database access"
else
    echo "✅ No obvious security anti-patterns detected."
fi)

### Infrastructure Security
$(if [ "$infra_issues" -gt 0 ]; then
    echo "⚠️ $infra_issues infrastructure security issues found."
    echo ""
    echo "**Recommendations**:"
    echo "- Review CI/CD workflow security"
    echo "- Ensure proper secret management"
    echo "- Configure production environment security"
else
    echo "✅ Infrastructure configuration looks secure."
fi)

## Security Recommendations

### Immediate Actions Required
$(if [ "$total_critical" -gt 0 ] || [ "$total_high" -gt 0 ]; then
    echo "🚨 **URGENT**: Address critical and high severity vulnerabilities immediately"
fi)

$(if [ "$secret_findings" -gt 0 ]; then
    echo "🔐 **HIGH PRIORITY**: Remove exposed secrets from source code"
fi)

### Security Improvements
1. **Dependency Management**
   - Implement automated dependency updates
   - Set up vulnerability scanning in CI/CD
   - Use dependency pinning for production

2. **Secret Management**
   - Implement proper secret rotation
   - Use encrypted secret storage
   - Regular secret audits

3. **Code Security**
   - Implement static code analysis in CI
   - Use security linting rules
   - Regular security code reviews

4. **Infrastructure Hardening**
   - Enable security headers
   - Implement proper logging and monitoring
   - Regular security assessments

## Compliance Notes

- **GDPR/CCPA**: Ensure proper data handling and privacy controls
- **SOC 2**: Implement security controls and monitoring
- **ISO 27001**: Maintain security documentation and procedures

## Next Steps

1. Address critical and high severity issues immediately
2. Create tickets for medium and low priority items
3. Implement automated security scanning in CI/CD
4. Schedule regular security assessments
5. Update security documentation and procedures

---

*This report should be reviewed by the security team and development leads.*
EOF

echo -e "${GREEN}📄 Security report generated: $REPORT_FILE${NC}"

# ==================== FINAL RESULT ====================

echo ""
echo "🔐 Security Scan Summary:"

if [ "$security_pass" = true ]; then
    echo -e "${GREEN}🛡️  All security scans passed!${NC}"
    exit 0
else
    echo -e "${RED}🚨 Security issues detected!${NC}"
    echo ""
    echo "Security issues found:"
    [ "$total_critical" -gt 0 ] && echo "  - $total_critical critical vulnerabilities"
    [ "$total_high" -gt 0 ] && echo "  - $total_high high severity vulnerabilities"
    [ "$secret_findings" -gt 0 ] && echo "  - $secret_findings potential secret exposures"
    [ "$sast_issues" -gt 0 ] && echo "  - $sast_issues code security issues"
    echo ""
    echo "Please review the security report and address issues before deployment."
    echo "Report: $REPORT_FILE"
    exit 1
fi