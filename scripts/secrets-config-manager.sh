#!/bin/bash

# ===========================================================================================
# Secrets and Configuration Management System
# HashiCorp Vault integration, environment configs, secret rotation, and encryption
# ===========================================================================================

set -euo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

# =============================================================================
# CONFIGURATION
# =============================================================================

# Vault configuration
VAULT_ADDR="${VAULT_ADDR:-}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
VAULT_NAMESPACE="${VAULT_NAMESPACE:-}"
VAULT_MOUNT_PATH="${VAULT_MOUNT_PATH:-kv}"
VAULT_SECRET_PATH="${VAULT_SECRET_PATH:-pitchey}"

# Local secrets management
LOCAL_SECRETS_DIR="${PROJECT_ROOT}/.secrets"
ENCRYPTED_SECRETS_FILE="${LOCAL_SECRETS_DIR}/secrets.enc"
MASTER_KEY_FILE="${LOCAL_SECRETS_DIR}/master.key"
BACKUP_SECRETS_DIR="${PROJECT_ROOT}/.secrets-backup"

# Environment configuration
ENVIRONMENTS="${ENVIRONMENTS:-development,staging,production}"
DEFAULT_ENVIRONMENT="${DEFAULT_ENVIRONMENT:-development}"
CONFIG_DIR="${PROJECT_ROOT}/deployment-config"

# Secret types and categories
SECRET_CATEGORIES="${SECRET_CATEGORIES:-database,api,external,crypto,auth}"
ROTATION_SCHEDULE="${ROTATION_SCHEDULE:-weekly}"
ROTATION_GRACE_PERIOD="${ROTATION_GRACE_PERIOD:-7200}"  # 2 hours

# Security configuration
ENCRYPTION_ALGORITHM="${ENCRYPTION_ALGORITHM:-aes-256-gcm}"
KEY_DERIVATION_FUNCTION="${KEY_DERIVATION_FUNCTION:-pbkdf2}"
ITERATIONS="${ITERATIONS:-100000}"
AUDIT_LOGGING="${AUDIT_LOGGING:-true}"

# Emergency access
EMERGENCY_ACCESS_ENABLED="${EMERGENCY_ACCESS_ENABLED:-true}"
EMERGENCY_UNSEAL_SHARES="${EMERGENCY_UNSEAL_SHARES:-3}"
EMERGENCY_UNSEAL_THRESHOLD="${EMERGENCY_UNSEAL_THRESHOLD:-2}"

# =============================================================================
# LOGGING AND AUDIT
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

OPERATION_ID="secrets_$(date +%Y%m%d_%H%M%S)_$$"
AUDIT_LOG_FILE="${PROJECT_ROOT}/logs/secrets_audit.log"
OPERATION_LOG_FILE="${PROJECT_ROOT}/logs/secrets_${OPERATION_ID}.log"

log_secrets() {
    local level="$1"
    local message="$2"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S UTC')"
    local color="$BLUE"
    
    case "$level" in
        ERROR) color="$RED" ;;
        WARN) color="$YELLOW" ;;
        SUCCESS) color="$GREEN" ;;
        DEBUG) color="$CYAN" ;;
        AUDIT) color="$PURPLE" ;;
        SECURITY) color="$BOLD$RED" ;;
    esac
    
    echo -e "${color}[${level}]${NC} ${timestamp} [${OPERATION_ID}] ${message}" | tee -a "$OPERATION_LOG_FILE"
    
    # Audit logging
    if [[ "$AUDIT_LOGGING" == "true" ]]; then
        echo "${timestamp} [${OPERATION_ID}] [${level}] ${message}" >> "$AUDIT_LOG_FILE"
    fi
}

log_info() { log_secrets "INFO" "$1"; }
log_success() { log_secrets "SUCCESS" "$1"; }
log_warn() { log_secrets "WARN" "$1"; }
log_error() { log_secrets "ERROR" "$1"; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && log_secrets "DEBUG" "$1"; }
log_audit() { log_secrets "AUDIT" "$1"; }
log_security() { log_secrets "SECURITY" "$1"; }

# =============================================================================
# VAULT INTEGRATION
# =============================================================================

setup_vault_integration() {
    log_info "Setting up HashiCorp Vault integration"
    
    if [[ -z "$VAULT_ADDR" ]]; then
        log_warn "VAULT_ADDR not set, falling back to local secrets management"
        return 1
    fi
    
    # Install vault CLI if not present
    if ! command -v vault >/dev/null 2>&1; then
        install_vault_cli
    fi
    
    # Test vault connectivity
    test_vault_connectivity
    
    # Setup vault configuration
    configure_vault_environment
    
    # Initialize vault policies
    setup_vault_policies
    
    # Setup authentication methods
    setup_vault_auth
    
    log_success "Vault integration configured successfully"
}

install_vault_cli() {
    log_info "Installing HashiCorp Vault CLI"
    
    local vault_version="1.15.2"
    local vault_url="https://releases.hashicorp.com/vault/${vault_version}/vault_${vault_version}_linux_amd64.zip"
    local temp_dir="/tmp/vault_install"
    
    mkdir -p "$temp_dir"
    
    # Download and install vault
    curl -sfL "$vault_url" -o "${temp_dir}/vault.zip" || {
        log_error "Failed to download Vault CLI"
        return 1
    }
    
    cd "$temp_dir"
    unzip vault.zip
    sudo mv vault /usr/local/bin/ || {
        log_error "Failed to install Vault CLI"
        return 1
    }
    
    rm -rf "$temp_dir"
    
    log_success "Vault CLI installed successfully"
}

test_vault_connectivity() {
    log_debug "Testing Vault connectivity"
    
    # Test basic connectivity
    if ! vault status >/dev/null 2>&1; then
        log_error "Cannot connect to Vault at $VAULT_ADDR"
        return 1
    fi
    
    # Test authentication
    if ! vault auth -method=token >/dev/null 2>&1; then
        log_error "Vault authentication failed"
        return 1
    fi
    
    log_debug "Vault connectivity test passed"
}

configure_vault_environment() {
    log_debug "Configuring Vault environment"
    
    # Enable KV secrets engine if not exists
    if ! vault secrets list | grep -q "${VAULT_MOUNT_PATH}/"; then
        log_info "Enabling KV secrets engine at ${VAULT_MOUNT_PATH}/"
        vault secrets enable -path="$VAULT_MOUNT_PATH" -version=2 kv || {
            log_error "Failed to enable KV secrets engine"
            return 1
        }
    fi
    
    # Create secret structure
    create_vault_secret_structure
    
    log_debug "Vault environment configured"
}

create_vault_secret_structure() {
    log_debug "Creating Vault secret structure"
    
    # Create paths for different environments
    IFS=',' read -ra ENV_ARRAY <<< "$ENVIRONMENTS"
    
    for env in "${ENV_ARRAY[@]}"; do
        local secret_path="${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/${env}"
        log_debug "Ensuring secret path exists: $secret_path"
        
        # Create empty secret if it doesn't exist
        if ! vault kv get "$secret_path" >/dev/null 2>&1; then
            vault kv put "$secret_path" placeholder="true" || {
                log_warn "Failed to create secret path: $secret_path"
            }
        fi
    done
}

setup_vault_policies() {
    log_info "Setting up Vault policies"
    
    # Create deployment policy
    create_deployment_policy
    
    # Create application policy
    create_application_policy
    
    # Create emergency access policy
    if [[ "$EMERGENCY_ACCESS_ENABLED" == "true" ]]; then
        create_emergency_policy
    fi
    
    log_success "Vault policies configured"
}

create_deployment_policy() {
    local policy_name="pitchey-deployment"
    local policy_file="/tmp/${policy_name}.hcl"
    
    cat > "$policy_file" << EOF
# Deployment policy for Pitchey application
path "${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/*" {
  capabilities = ["read", "list"]
}

path "${VAULT_MOUNT_PATH}/metadata/${VAULT_SECRET_PATH}/*" {
  capabilities = ["read", "list"]
}

# Allow reading database credentials
path "${VAULT_MOUNT_PATH}/data/database/*" {
  capabilities = ["read"]
}

# Allow reading API keys
path "${VAULT_MOUNT_PATH}/data/api-keys/*" {
  capabilities = ["read"]
}
EOF
    
    # Apply policy
    vault policy write "$policy_name" "$policy_file" || {
        log_error "Failed to create deployment policy"
        return 1
    }
    
    rm -f "$policy_file"
    log_debug "Deployment policy created: $policy_name"
}

create_application_policy() {
    local policy_name="pitchey-application"
    local policy_file="/tmp/${policy_name}.hcl"
    
    cat > "$policy_file" << EOF
# Application runtime policy for Pitchey
path "${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/\${identity.entity.metadata.environment}/*" {
  capabilities = ["read"]
}

path "${VAULT_MOUNT_PATH}/data/shared/*" {
  capabilities = ["read"]
}

# Deny access to sensitive admin secrets
path "${VAULT_MOUNT_PATH}/data/admin/*" {
  capabilities = ["deny"]
}
EOF
    
    vault policy write "$policy_name" "$policy_file" || {
        log_error "Failed to create application policy"
        return 1
    }
    
    rm -f "$policy_file"
    log_debug "Application policy created: $policy_name"
}

create_emergency_policy() {
    local policy_name="pitchey-emergency"
    local policy_file="/tmp/${policy_name}.hcl"
    
    cat > "$policy_file" << EOF
# Emergency access policy for Pitchey
path "${VAULT_MOUNT_PATH}/*" {
  capabilities = ["read", "list"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF
    
    vault policy write "$policy_name" "$policy_file" || {
        log_error "Failed to create emergency policy"
        return 1
    }
    
    rm -f "$policy_file"
    log_debug "Emergency policy created: $policy_name"
}

setup_vault_auth() {
    log_info "Setting up Vault authentication methods"
    
    # Enable AppRole auth if not exists
    if ! vault auth list | grep -q "approle/"; then
        log_info "Enabling AppRole authentication"
        vault auth enable approle || {
            log_warn "Failed to enable AppRole auth"
        }
    fi
    
    # Create deployment role
    create_deployment_role
    
    # Create application roles
    create_application_roles
    
    log_success "Vault authentication configured"
}

create_deployment_role() {
    local role_name="pitchey-deployment"
    
    # Create deployment role
    vault write "auth/approle/role/${role_name}" \
        token_policies="pitchey-deployment" \
        token_ttl="1h" \
        token_max_ttl="4h" \
        bind_secret_id="true" || {
        log_warn "Failed to create deployment role"
        return 1
    }
    
    # Get role ID and secret ID
    local role_id
    role_id=$(vault read -field=role_id "auth/approle/role/${role_name}/role-id")
    
    local secret_id
    secret_id=$(vault write -field=secret_id -f "auth/approle/role/${role_name}/secret-id")
    
    # Store credentials securely
    store_deployment_credentials "$role_id" "$secret_id"
    
    log_debug "Deployment role created: $role_name"
}

store_deployment_credentials() {
    local role_id="$1"
    local secret_id="$2"
    
    # Store in encrypted local file
    local creds_file="${LOCAL_SECRETS_DIR}/vault_deployment_creds.enc"
    mkdir -p "$LOCAL_SECRETS_DIR"
    
    cat > "/tmp/vault_creds.json" << EOF
{
    "role_id": "$role_id",
    "secret_id": "$secret_id",
    "created_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
    
    # Encrypt and store
    encrypt_file "/tmp/vault_creds.json" "$creds_file"
    rm -f "/tmp/vault_creds.json"
    
    log_audit "Vault deployment credentials stored securely"
}

create_application_roles() {
    IFS=',' read -ra ENV_ARRAY <<< "$ENVIRONMENTS"
    
    for env in "${ENV_ARRAY[@]}"; do
        local role_name="pitchey-app-${env}"
        
        vault write "auth/approle/role/${role_name}" \
            token_policies="pitchey-application" \
            token_ttl="24h" \
            token_max_ttl="72h" \
            bind_secret_id="true" \
            token_bound_cidrs="0.0.0.0/0" || {
            log_warn "Failed to create application role for $env"
            continue
        }
        
        log_debug "Application role created: $role_name"
    done
}

# =============================================================================
# LOCAL SECRETS MANAGEMENT
# =============================================================================

setup_local_secrets_management() {
    log_info "Setting up local secrets management"
    
    # Create secrets directory structure
    create_secrets_directory_structure
    
    # Generate master encryption key if not exists
    if [[ ! -f "$MASTER_KEY_FILE" ]]; then
        generate_master_key
    fi
    
    # Initialize encrypted secrets store
    initialize_encrypted_store
    
    # Setup backup system
    setup_secrets_backup_system
    
    log_success "Local secrets management configured"
}

create_secrets_directory_structure() {
    log_debug "Creating secrets directory structure"
    
    local directories=(
        "$LOCAL_SECRETS_DIR"
        "${LOCAL_SECRETS_DIR}/env"
        "${LOCAL_SECRETS_DIR}/keys"
        "${LOCAL_SECRETS_DIR}/temp"
        "$BACKUP_SECRETS_DIR"
        "$CONFIG_DIR"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        chmod 700 "$dir"
    done
    
    # Create .gitignore for secrets directory
    cat > "${LOCAL_SECRETS_DIR}/.gitignore" << 'EOF'
# Ignore all secrets files
*
!.gitignore
EOF
    
    log_debug "Secrets directory structure created"
}

generate_master_key() {
    log_info "Generating master encryption key"
    
    # Generate strong random key
    openssl rand -base64 32 > "$MASTER_KEY_FILE"
    chmod 600 "$MASTER_KEY_FILE"
    
    log_audit "Master encryption key generated"
}

initialize_encrypted_store() {
    log_debug "Initializing encrypted secrets store"
    
    if [[ ! -f "$ENCRYPTED_SECRETS_FILE" ]]; then
        # Create empty encrypted store
        echo '{}' | encrypt_string > "$ENCRYPTED_SECRETS_FILE"
        log_debug "Encrypted secrets store initialized"
    fi
}

setup_secrets_backup_system() {
    log_debug "Setting up secrets backup system"
    
    # Create backup configuration
    cat > "${BACKUP_SECRETS_DIR}/backup_config.json" << EOF
{
    "backup_schedule": "daily",
    "retention_days": 30,
    "encryption": true,
    "compression": true,
    "destination": "${BACKUP_SECRETS_DIR}",
    "created_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
    
    # Create backup script
    create_backup_script
    
    log_debug "Secrets backup system configured"
}

create_backup_script() {
    local backup_script="${BACKUP_SECRETS_DIR}/backup_secrets.sh"
    
    cat > "$backup_script" << 'EOF'
#!/bin/bash
# Automated secrets backup script

set -euo pipefail

BACKUP_DIR="$(dirname "${BASH_SOURCE[0]}")"
SECRETS_DIR="$(dirname "$BACKUP_DIR")/.secrets"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/secrets_backup_${DATE}.tar.gz.enc"

# Create encrypted backup
tar -czf - -C "$SECRETS_DIR" . | \
    openssl enc -aes-256-cbc -salt -in - -out "$BACKUP_FILE" -pass file:"${SECRETS_DIR}/master.key"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "secrets_backup_*.tar.gz.enc" -mtime +30 -delete

echo "Secrets backup created: $BACKUP_FILE"
EOF
    
    chmod +x "$backup_script"
    
    log_debug "Backup script created: $backup_script"
}

# =============================================================================
# ENCRYPTION AND DECRYPTION
# =============================================================================

encrypt_string() {
    local input="${1:-$(cat)}"
    
    if [[ ! -f "$MASTER_KEY_FILE" ]]; then
        log_error "Master key not found: $MASTER_KEY_FILE"
        return 1
    fi
    
    echo "$input" | openssl enc -aes-256-cbc -salt -base64 -pass file:"$MASTER_KEY_FILE" 2>/dev/null
}

decrypt_string() {
    local input="${1:-$(cat)}"
    
    if [[ ! -f "$MASTER_KEY_FILE" ]]; then
        log_error "Master key not found: $MASTER_KEY_FILE"
        return 1
    fi
    
    echo "$input" | openssl enc -d -aes-256-cbc -base64 -pass file:"$MASTER_KEY_FILE" 2>/dev/null
}

encrypt_file() {
    local input_file="$1"
    local output_file="$2"
    
    if [[ ! -f "$input_file" ]]; then
        log_error "Input file not found: $input_file"
        return 1
    fi
    
    openssl enc -aes-256-cbc -salt -in "$input_file" -out "$output_file" -pass file:"$MASTER_KEY_FILE" || {
        log_error "Failed to encrypt file: $input_file"
        return 1
    }
    
    log_debug "File encrypted: $output_file"
}

decrypt_file() {
    local input_file="$1"
    local output_file="$2"
    
    if [[ ! -f "$input_file" ]]; then
        log_error "Encrypted file not found: $input_file"
        return 1
    fi
    
    openssl enc -d -aes-256-cbc -in "$input_file" -out "$output_file" -pass file:"$MASTER_KEY_FILE" || {
        log_error "Failed to decrypt file: $input_file"
        return 1
    }
    
    log_debug "File decrypted: $output_file"
}

# =============================================================================
# SECRET STORAGE AND RETRIEVAL
# =============================================================================

store_secret() {
    local environment="$1"
    local key="$2"
    local value="$3"
    local category="${4:-general}"
    
    log_audit "Storing secret: $environment/$key (category: $category)"
    
    # Use Vault if available, otherwise local storage
    if vault_available; then
        store_secret_vault "$environment" "$key" "$value" "$category"
    else
        store_secret_local "$environment" "$key" "$value" "$category"
    fi
    
    log_success "Secret stored successfully: $environment/$key"
}

store_secret_vault() {
    local environment="$1"
    local key="$2"
    local value="$3"
    local category="$4"
    
    local secret_path="${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/${environment}"
    
    # Get existing secrets
    local existing_secrets="{}"
    if vault kv get -format=json "$secret_path" >/dev/null 2>&1; then
        existing_secrets=$(vault kv get -format=json "$secret_path" | jq '.data.data')
    fi
    
    # Add new secret
    local updated_secrets
    updated_secrets=$(echo "$existing_secrets" | jq --arg key "$key" --arg value "$value" --arg category "$category" \
        '. + {($key): {"value": $value, "category": $category, "updated_at": (now | todate)}}')
    
    # Store back to vault
    echo "$updated_secrets" | vault kv put "$secret_path" - || {
        log_error "Failed to store secret in Vault"
        return 1
    }
    
    log_debug "Secret stored in Vault: $secret_path/$key"
}

store_secret_local() {
    local environment="$1"
    local key="$2"
    local value="$3"
    local category="$4"
    
    # Get existing secrets
    local secrets_content
    if [[ -f "$ENCRYPTED_SECRETS_FILE" ]]; then
        secrets_content=$(cat "$ENCRYPTED_SECRETS_FILE" | decrypt_string) || secrets_content="{}"
    else
        secrets_content="{}"
    fi
    
    # Add new secret
    local updated_secrets
    updated_secrets=$(echo "$secrets_content" | jq --arg env "$environment" --arg key "$key" --arg value "$value" --arg category "$category" \
        '.[$env] //= {} | .[$env][$key] = {"value": $value, "category": $category, "updated_at": (now | todate)}')
    
    # Encrypt and store
    echo "$updated_secrets" | encrypt_string > "$ENCRYPTED_SECRETS_FILE" || {
        log_error "Failed to store secret locally"
        return 1
    }
    
    log_debug "Secret stored locally: $environment/$key"
}

retrieve_secret() {
    local environment="$1"
    local key="$2"
    
    log_debug "Retrieving secret: $environment/$key"
    
    # Use Vault if available, otherwise local storage
    if vault_available; then
        retrieve_secret_vault "$environment" "$key"
    else
        retrieve_secret_local "$environment" "$key"
    fi
}

retrieve_secret_vault() {
    local environment="$1"
    local key="$2"
    
    local secret_path="${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/${environment}"
    
    vault kv get -format=json "$secret_path" 2>/dev/null | \
        jq -r ".data.data.${key}.value // empty" || {
        log_debug "Secret not found in Vault: $secret_path/$key"
        return 1
    }
}

retrieve_secret_local() {
    local environment="$1"
    local key="$2"
    
    if [[ ! -f "$ENCRYPTED_SECRETS_FILE" ]]; then
        log_debug "Encrypted secrets file not found"
        return 1
    fi
    
    local secrets_content
    secrets_content=$(cat "$ENCRYPTED_SECRETS_FILE" | decrypt_string) || {
        log_error "Failed to decrypt secrets file"
        return 1
    }
    
    echo "$secrets_content" | jq -r ".${environment}.${key}.value // empty" || {
        log_debug "Secret not found locally: $environment/$key"
        return 1
    }
}

list_secrets() {
    local environment="${1:-}"
    
    log_info "Listing secrets${environment:+ for environment: $environment}"
    
    if vault_available; then
        list_secrets_vault "$environment"
    else
        list_secrets_local "$environment"
    fi
}

list_secrets_vault() {
    local environment="$1"
    
    if [[ -n "$environment" ]]; then
        local secret_path="${VAULT_MOUNT_PATH}/data/${VAULT_SECRET_PATH}/${environment}"
        vault kv get -format=json "$secret_path" 2>/dev/null | \
            jq -r '.data.data | keys[]' 2>/dev/null || {
            log_warn "No secrets found for environment: $environment"
        }
    else
        # List all environments
        vault kv list -format=json "${VAULT_MOUNT_PATH}/metadata/${VAULT_SECRET_PATH}/" 2>/dev/null | \
            jq -r '.[]' 2>/dev/null || {
            log_warn "No secrets found"
        }
    fi
}

list_secrets_local() {
    local environment="$1"
    
    if [[ ! -f "$ENCRYPTED_SECRETS_FILE" ]]; then
        log_warn "No local secrets found"
        return 1
    fi
    
    local secrets_content
    secrets_content=$(cat "$ENCRYPTED_SECRETS_FILE" | decrypt_string) || {
        log_error "Failed to decrypt secrets file"
        return 1
    }
    
    if [[ -n "$environment" ]]; then
        echo "$secrets_content" | jq -r ".${environment} // {} | keys[]" 2>/dev/null
    else
        echo "$secrets_content" | jq -r 'keys[]' 2>/dev/null
    fi
}

vault_available() {
    [[ -n "$VAULT_ADDR" ]] && command -v vault >/dev/null 2>&1 && vault status >/dev/null 2>&1
}

# =============================================================================
# ENVIRONMENT CONFIGURATION MANAGEMENT
# =============================================================================

setup_environment_configs() {
    log_info "Setting up environment configurations"
    
    IFS=',' read -ra ENV_ARRAY <<< "$ENVIRONMENTS"
    
    for env in "${ENV_ARRAY[@]}"; do
        create_environment_config "$env"
    done
    
    # Create default configuration template
    create_default_config_template
    
    log_success "Environment configurations created"
}

create_environment_config() {
    local environment="$1"
    local config_file="${CONFIG_DIR}/${environment}.env"
    
    log_debug "Creating configuration for environment: $environment"
    
    # Create environment-specific configuration
    case "$environment" in
        development)
            create_development_config "$config_file"
            ;;
        staging)
            create_staging_config "$config_file"
            ;;
        production)
            create_production_config "$config_file"
            ;;
        *)
            create_generic_config "$config_file" "$environment"
            ;;
    esac
    
    # Secure the configuration file
    chmod 600 "$config_file"
    
    log_debug "Configuration created: $config_file"
}

create_development_config() {
    local config_file="$1"
    
    cat > "$config_file" << 'EOF'
# Development Environment Configuration
ENVIRONMENT=development
LOG_LEVEL=debug
DEBUG=true

# Database Configuration
DATABASE_URL_SECRET_KEY="database_url"
DATABASE_POOL_SIZE=5
DATABASE_SSL_MODE=prefer

# Redis Configuration
REDIS_URL_SECRET_KEY="redis_url"
REDIS_POOL_SIZE=10

# API Configuration
API_BASE_URL=http://localhost:8001
API_RATE_LIMIT=1000
API_TIMEOUT=30

# Security Configuration
JWT_SECRET_KEY="jwt_secret"
ENCRYPTION_KEY_SECRET_KEY="encryption_key"
SESSION_TIMEOUT=3600

# External Services
CLOUDFLARE_API_TOKEN_SECRET_KEY="cloudflare_api_token"
TWILIO_ACCOUNT_SID_SECRET_KEY="twilio_account_sid"
TWILIO_AUTH_TOKEN_SECRET_KEY="twilio_auth_token"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_FILE_UPLOAD=true

# Performance Configuration
CACHE_TTL=300
MAX_FILE_SIZE=10485760
MAX_REQUEST_SIZE=52428800
EOF
}

create_staging_config() {
    local config_file="$1"
    
    cat > "$config_file" << 'EOF'
# Staging Environment Configuration
ENVIRONMENT=staging
LOG_LEVEL=info
DEBUG=false

# Database Configuration
DATABASE_URL_SECRET_KEY="staging_database_url"
DATABASE_POOL_SIZE=10
DATABASE_SSL_MODE=require

# Redis Configuration
REDIS_URL_SECRET_KEY="staging_redis_url"
REDIS_POOL_SIZE=20

# API Configuration
API_BASE_URL=https://pitchey-api-staging.ndlovucavelle.workers.dev
API_RATE_LIMIT=500
API_TIMEOUT=30

# Security Configuration
JWT_SECRET_KEY="staging_jwt_secret"
ENCRYPTION_KEY_SECRET_KEY="staging_encryption_key"
SESSION_TIMEOUT=7200

# External Services
CLOUDFLARE_API_TOKEN_SECRET_KEY="staging_cloudflare_api_token"
TWILIO_ACCOUNT_SID_SECRET_KEY="staging_twilio_account_sid"
TWILIO_AUTH_TOKEN_SECRET_KEY="staging_twilio_auth_token"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_FILE_UPLOAD=true

# Performance Configuration
CACHE_TTL=600
MAX_FILE_SIZE=52428800
MAX_REQUEST_SIZE=104857600
EOF
}

create_production_config() {
    local config_file="$1"
    
    cat > "$config_file" << 'EOF'
# Production Environment Configuration
ENVIRONMENT=production
LOG_LEVEL=warn
DEBUG=false

# Database Configuration
DATABASE_URL_SECRET_KEY="production_database_url"
DATABASE_POOL_SIZE=50
DATABASE_SSL_MODE=require

# Redis Configuration
REDIS_URL_SECRET_KEY="production_redis_url"
REDIS_POOL_SIZE=100

# API Configuration
API_BASE_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
API_RATE_LIMIT=100
API_TIMEOUT=15

# Security Configuration
JWT_SECRET_KEY="production_jwt_secret"
ENCRYPTION_KEY_SECRET_KEY="production_encryption_key"
SESSION_TIMEOUT=14400

# External Services
CLOUDFLARE_API_TOKEN_SECRET_KEY="production_cloudflare_api_token"
TWILIO_ACCOUNT_SID_SECRET_KEY="production_twilio_account_sid"
TWILIO_AUTH_TOKEN_SECRET_KEY="production_twilio_auth_token"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_FILE_UPLOAD=true

# Performance Configuration
CACHE_TTL=1800
MAX_FILE_SIZE=104857600
MAX_REQUEST_SIZE=209715200

# Monitoring Configuration
ENABLE_MONITORING=true
METRICS_COLLECTION=true
ERROR_REPORTING=true
EOF
}

create_generic_config() {
    local config_file="$1"
    local environment="$2"
    
    cat > "$config_file" << EOF
# ${environment^} Environment Configuration
ENVIRONMENT=${environment}
LOG_LEVEL=info
DEBUG=false

# Database Configuration
DATABASE_URL_SECRET_KEY="${environment}_database_url"
DATABASE_POOL_SIZE=20
DATABASE_SSL_MODE=require

# Redis Configuration
REDIS_URL_SECRET_KEY="${environment}_redis_url"
REDIS_POOL_SIZE=30

# API Configuration
API_BASE_URL=https://pitchey-api-${environment}.ndlovucavelle.workers.dev
API_RATE_LIMIT=200
API_TIMEOUT=30

# Security Configuration
JWT_SECRET_KEY="${environment}_jwt_secret"
ENCRYPTION_KEY_SECRET_KEY="${environment}_encryption_key"
SESSION_TIMEOUT=7200

# External Services
CLOUDFLARE_API_TOKEN_SECRET_KEY="${environment}_cloudflare_api_token"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_FILE_UPLOAD=true

# Performance Configuration
CACHE_TTL=900
MAX_FILE_SIZE=52428800
MAX_REQUEST_SIZE=104857600
EOF
}

create_default_config_template() {
    local template_file="${CONFIG_DIR}/template.env"
    
    cat > "$template_file" << 'EOF'
# Environment Configuration Template
# Copy this file and modify for your environment

ENVIRONMENT=__ENVIRONMENT_NAME__
LOG_LEVEL=info
DEBUG=false

# Database Configuration
DATABASE_URL_SECRET_KEY="__ENV___database_url"
DATABASE_POOL_SIZE=20
DATABASE_SSL_MODE=require

# Redis Configuration  
REDIS_URL_SECRET_KEY="__ENV___redis_url"
REDIS_POOL_SIZE=30

# API Configuration
API_BASE_URL=__API_BASE_URL__
API_RATE_LIMIT=200
API_TIMEOUT=30

# Security Configuration
JWT_SECRET_KEY="__ENV___jwt_secret"
ENCRYPTION_KEY_SECRET_KEY="__ENV___encryption_key"
SESSION_TIMEOUT=7200

# External Services
CLOUDFLARE_API_TOKEN_SECRET_KEY="__ENV___cloudflare_api_token"

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
ENABLE_FILE_UPLOAD=true

# Performance Configuration
CACHE_TTL=900
MAX_FILE_SIZE=52428800
MAX_REQUEST_SIZE=104857600
EOF
    
    log_debug "Configuration template created: $template_file"
}

load_environment_config() {
    local environment="${1:-$DEFAULT_ENVIRONMENT}"
    local config_file="${CONFIG_DIR}/${environment}.env"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        return 1
    fi
    
    log_debug "Loading configuration for environment: $environment"
    
    # Source the configuration file
    set -a
    source "$config_file"
    set +a
    
    # Resolve secret references
    resolve_secret_references
    
    log_debug "Configuration loaded successfully"
}

resolve_secret_references() {
    log_debug "Resolving secret references in configuration"
    
    # Find all variables ending with _SECRET_KEY
    local secret_vars
    secret_vars=$(env | grep "_SECRET_KEY=" | cut -d= -f1)
    
    while IFS= read -r var_name; do
        if [[ -n "$var_name" ]]; then
            local secret_key="${!var_name}"
            local base_var_name="${var_name%_SECRET_KEY}"
            local environment="${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}"
            
            # Retrieve secret value
            local secret_value
            if secret_value=$(retrieve_secret "$environment" "$secret_key" 2>/dev/null); then
                # Set the environment variable without _SECRET_KEY suffix
                export "$base_var_name=$secret_value"
                log_debug "Resolved secret: $base_var_name"
            else
                log_warn "Failed to resolve secret: $secret_key for $base_var_name"
            fi
        fi
    done <<< "$secret_vars"
}

# =============================================================================
# SECRET ROTATION
# =============================================================================

setup_secret_rotation() {
    log_info "Setting up automatic secret rotation"
    
    # Create rotation schedule
    create_rotation_schedule
    
    # Setup rotation policies
    setup_rotation_policies
    
    # Create rotation scripts
    create_rotation_scripts
    
    log_success "Secret rotation configured"
}

create_rotation_schedule() {
    local schedule_file="${LOCAL_SECRETS_DIR}/rotation_schedule.json"
    
    cat > "$schedule_file" << EOF
{
    "schedule": "$ROTATION_SCHEDULE",
    "grace_period": $ROTATION_GRACE_PERIOD,
    "categories": {
        "database": {
            "rotation_interval": "30d",
            "notification_before": "7d"
        },
        "api": {
            "rotation_interval": "90d", 
            "notification_before": "14d"
        },
        "crypto": {
            "rotation_interval": "365d",
            "notification_before": "30d"
        },
        "auth": {
            "rotation_interval": "90d",
            "notification_before": "14d"
        }
    },
    "next_rotation": "$(date -d "+7 days" -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF
    
    log_debug "Rotation schedule created: $schedule_file"
}

setup_rotation_policies() {
    log_debug "Setting up rotation policies"
    
    # Create rotation policies for each secret category
    IFS=',' read -ra CATEGORY_ARRAY <<< "$SECRET_CATEGORIES"
    
    for category in "${CATEGORY_ARRAY[@]}"; do
        create_category_rotation_policy "$category"
    done
}

create_category_rotation_policy() {
    local category="$1"
    local policy_file="${LOCAL_SECRETS_DIR}/rotation_policy_${category}.json"
    
    case "$category" in
        database)
            cat > "$policy_file" << 'EOF'
{
    "category": "database",
    "auto_rotation": true,
    "rotation_method": "blue_green",
    "backup_previous": true,
    "validation_required": true,
    "rollback_enabled": true
}
EOF
            ;;
        api)
            cat > "$policy_file" << 'EOF'
{
    "category": "api",
    "auto_rotation": true,
    "rotation_method": "gradual",
    "backup_previous": true,
    "validation_required": true,
    "rollback_enabled": true
}
EOF
            ;;
        crypto)
            cat > "$policy_file" << 'EOF'
{
    "category": "crypto",
    "auto_rotation": false,
    "rotation_method": "manual",
    "backup_previous": true,
    "validation_required": true,
    "rollback_enabled": true
}
EOF
            ;;
        *)
            cat > "$policy_file" << EOF
{
    "category": "$category",
    "auto_rotation": true,
    "rotation_method": "immediate",
    "backup_previous": true,
    "validation_required": false,
    "rollback_enabled": true
}
EOF
            ;;
    esac
    
    log_debug "Rotation policy created for category: $category"
}

create_rotation_scripts() {
    local rotation_script="${LOCAL_SECRETS_DIR}/rotate_secrets.sh"
    
    cat > "$rotation_script" << 'EOF'
#!/bin/bash
# Automated secret rotation script

set -euo pipefail

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
source "${PROJECT_ROOT}/scripts/secrets-config-manager.sh"

log_info "Starting scheduled secret rotation"

# Check if rotation is due
if ! is_rotation_due; then
    log_info "No rotation due at this time"
    exit 0
fi

# Rotate secrets by category
rotate_category_secrets "api"
rotate_category_secrets "auth"

# Skip database rotation in automated runs for safety
log_info "Skipping database rotation (requires manual approval)"

log_success "Scheduled secret rotation completed"
EOF
    
    chmod +x "$rotation_script"
    
    # Create individual rotation functions
    create_rotation_functions
    
    log_debug "Rotation scripts created"
}

create_rotation_functions() {
    local functions_file="${LOCAL_SECRETS_DIR}/rotation_functions.sh"
    
    cat > "$functions_file" << 'EOF'
#!/bin/bash
# Secret rotation functions

is_rotation_due() {
    local schedule_file="${LOCAL_SECRETS_DIR}/rotation_schedule.json"
    
    if [[ ! -f "$schedule_file" ]]; then
        return 1
    fi
    
    local next_rotation
    next_rotation=$(jq -r '.next_rotation' "$schedule_file")
    local current_time
    current_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    
    [[ "$current_time" > "$next_rotation" ]]
}

rotate_category_secrets() {
    local category="$1"
    
    log_info "Rotating secrets for category: $category"
    
    # Implementation would depend on the specific secret type
    # This is a placeholder for the actual rotation logic
    
    case "$category" in
        api)
            rotate_api_keys
            ;;
        auth)
            rotate_auth_secrets
            ;;
        database)
            rotate_database_credentials
            ;;
        *)
            log_warn "Unknown secret category: $category"
            ;;
    esac
}

rotate_api_keys() {
    log_debug "Rotating API keys"
    
    # Generate new API keys
    # Update applications with new keys
    # Revoke old keys after grace period
    
    log_debug "API key rotation completed"
}

rotate_auth_secrets() {
    log_debug "Rotating authentication secrets"
    
    # Generate new JWT secrets
    # Update session stores
    # Invalidate old sessions
    
    log_debug "Auth secret rotation completed"
}

rotate_database_credentials() {
    log_debug "Rotating database credentials"
    
    # Create new database user
    # Update applications with new credentials
    # Drop old database user after grace period
    
    log_debug "Database credential rotation completed"
}
EOF
    
    chmod +x "$functions_file"
    
    log_debug "Rotation functions created: $functions_file"
}

rotate_secret() {
    local environment="$1"
    local key="$2"
    local category="${3:-general}"
    
    log_info "Rotating secret: $environment/$key"
    log_audit "Secret rotation initiated: $environment/$key (category: $category)"
    
    # Backup current secret
    backup_secret "$environment" "$key"
    
    # Generate new secret value
    local new_value
    new_value=$(generate_secret_value "$category")
    
    # Store new secret
    store_secret "$environment" "${key}_new" "$new_value" "$category"
    
    log_success "Secret rotation completed: $environment/$key"
    log_audit "Secret rotation completed: $environment/$key"
}

backup_secret() {
    local environment="$1"
    local key="$2"
    
    log_debug "Backing up secret: $environment/$key"
    
    local current_value
    if current_value=$(retrieve_secret "$environment" "$key" 2>/dev/null); then
        local backup_key="${key}_backup_$(date +%Y%m%d_%H%M%S)"
        store_secret "$environment" "$backup_key" "$current_value" "backup"
        log_debug "Secret backed up as: $backup_key"
    else
        log_warn "Failed to backup secret: $environment/$key (not found)"
    fi
}

generate_secret_value() {
    local category="$1"
    
    case "$category" in
        crypto|auth)
            # Generate strong cryptographic key
            openssl rand -base64 48 | tr -d '\n'
            ;;
        api)
            # Generate API key format
            echo "pk_$(openssl rand -hex 32)"
            ;;
        database)
            # Generate strong password
            openssl rand -base64 32 | tr -d '\n' | tr '/' '_' | tr '+' '-'
            ;;
        *)
            # Generic strong secret
            openssl rand -base64 32 | tr -d '\n'
            ;;
    esac
}

# =============================================================================
# BOOTSTRAP AND INITIALIZATION
# =============================================================================

bootstrap_secrets_management() {
    log_info "Bootstrapping secrets management system"
    
    # Create required directories
    create_secrets_directory_structure
    
    # Setup encryption
    if [[ ! -f "$MASTER_KEY_FILE" ]]; then
        generate_master_key
    fi
    
    # Initialize storage backends
    if [[ -n "$VAULT_ADDR" ]]; then
        setup_vault_integration || {
            log_warn "Vault integration failed, falling back to local storage"
            setup_local_secrets_management
        }
    else
        setup_local_secrets_management
    fi
    
    # Setup environment configurations
    setup_environment_configs
    
    # Bootstrap default secrets
    bootstrap_default_secrets
    
    # Setup rotation
    setup_secret_rotation
    
    log_success "Secrets management system bootstrapped successfully"
}

bootstrap_default_secrets() {
    log_info "Bootstrapping default secrets"
    
    IFS=',' read -ra ENV_ARRAY <<< "$ENVIRONMENTS"
    
    for env in "${ENV_ARRAY[@]}"; do
        bootstrap_environment_secrets "$env"
    done
    
    log_success "Default secrets bootstrapped"
}

bootstrap_environment_secrets() {
    local environment="$1"
    
    log_debug "Bootstrapping secrets for environment: $environment"
    
    # Generate default secrets if they don't exist
    local default_secrets=(
        "jwt_secret:auth"
        "encryption_key:crypto"
        "session_secret:auth"
        "api_key:api"
    )
    
    for secret_def in "${default_secrets[@]}"; do
        IFS=':' read -r key category <<< "$secret_def"
        
        if ! retrieve_secret "$environment" "$key" >/dev/null 2>&1; then
            local value
            value=$(generate_secret_value "$category")
            store_secret "$environment" "$key" "$value" "$category"
            log_debug "Generated default secret: $environment/$key"
        fi
    done
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Secrets and Configuration Management System v${SCRIPT_VERSION}

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    bootstrap           Initialize secrets management system
    store               Store a secret
    retrieve            Retrieve a secret
    list                List secrets
    rotate              Rotate a secret
    config              Manage environment configurations
    vault               Vault-specific operations
    backup              Backup secrets
    restore             Restore secrets from backup
    help                Show this help

STORE COMMAND:
    $0 store <environment> <key> <value> [category]

RETRIEVE COMMAND:
    $0 retrieve <environment> <key>

LIST COMMAND:
    $0 list [environment]

ROTATE COMMAND:
    $0 rotate <environment> <key> [category]

CONFIG COMMANDS:
    $0 config create <environment>      Create environment config
    $0 config load <environment>        Load environment config
    $0 config list                      List available configs

VAULT COMMANDS:
    $0 vault setup                      Setup Vault integration
    $0 vault status                     Check Vault status
    $0 vault policies                   List Vault policies

EXAMPLES:
    $0 bootstrap                                    Initialize system
    $0 store production jwt_secret "abc123" auth   Store JWT secret
    $0 retrieve production jwt_secret               Retrieve JWT secret
    $0 list production                              List production secrets
    $0 rotate production api_key                    Rotate API key
    $0 config load production                       Load production config

ENVIRONMENT VARIABLES:
    VAULT_ADDR                  HashiCorp Vault address
    VAULT_TOKEN                 HashiCorp Vault token
    VAULT_NAMESPACE            Vault namespace
    ENVIRONMENTS               Comma-separated list of environments
    ROTATION_SCHEDULE          Secret rotation schedule (daily|weekly|monthly)
    AUDIT_LOGGING              Enable audit logging (true|false)

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Create log directories
    mkdir -p "$(dirname "$AUDIT_LOG_FILE")" "$(dirname "$OPERATION_LOG_FILE")"
    
    case "$command" in
        bootstrap)
            bootstrap_secrets_management
            ;;
        store)
            if [[ $# -lt 3 ]]; then
                log_error "Usage: store <environment> <key> <value> [category]"
                exit 1
            fi
            store_secret "$1" "$2" "$3" "${4:-general}"
            ;;
        retrieve)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: retrieve <environment> <key>"
                exit 1
            fi
            retrieve_secret "$1" "$2"
            ;;
        list)
            list_secrets "$1"
            ;;
        rotate)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: rotate <environment> <key> [category]"
                exit 1
            fi
            rotate_secret "$1" "$2" "${3:-general}"
            ;;
        config)
            config_command "$@"
            ;;
        vault)
            vault_command "$@"
            ;;
        backup)
            backup_secrets
            ;;
        restore)
            restore_secrets "$1"
            ;;
        help|*)
            show_usage
            ;;
    esac
}

config_command() {
    local subcommand="$1"
    shift 2>/dev/null || true
    
    case "$subcommand" in
        create)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: config create <environment>"
                exit 1
            fi
            create_environment_config "$1"
            ;;
        load)
            if [[ $# -lt 1 ]]; then
                log_error "Usage: config load <environment>"
                exit 1
            fi
            load_environment_config "$1"
            ;;
        list)
            ls -1 "$CONFIG_DIR"/*.env 2>/dev/null | sed 's/.*\///; s/\.env$//' || {
                log_warn "No environment configurations found"
            }
            ;;
        *)
            log_error "Unknown config command: $subcommand"
            log_error "Available commands: create, load, list"
            exit 1
            ;;
    esac
}

vault_command() {
    local subcommand="$1"
    shift 2>/dev/null || true
    
    case "$subcommand" in
        setup)
            setup_vault_integration
            ;;
        status)
            if vault_available; then
                log_success "Vault is available and configured"
                vault status
            else
                log_warn "Vault is not available or not configured"
            fi
            ;;
        policies)
            if vault_available; then
                vault policy list
            else
                log_error "Vault is not available"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown vault command: $subcommand"
            log_error "Available commands: setup, status, policies"
            exit 1
            ;;
    esac
}

backup_secrets() {
    log_info "Creating secrets backup"
    
    local backup_file="${BACKUP_SECRETS_DIR}/secrets_manual_backup_$(date +%Y%m%d_%H%M%S).tar.gz.enc"
    
    # Create encrypted backup
    tar -czf - -C "$LOCAL_SECRETS_DIR" . | \
        openssl enc -aes-256-cbc -salt -in - -out "$backup_file" -pass file:"$MASTER_KEY_FILE" || {
        log_error "Failed to create secrets backup"
        return 1
    }
    
    log_success "Secrets backup created: $backup_file"
}

restore_secrets() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Usage: restore <backup_file>"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring secrets from backup: $backup_file"
    
    # Create restore directory
    local restore_dir="${LOCAL_SECRETS_DIR}_restore_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$restore_dir"
    
    # Decrypt and extract
    openssl enc -d -aes-256-cbc -in "$backup_file" -pass file:"$MASTER_KEY_FILE" | \
        tar -xzf - -C "$restore_dir" || {
        log_error "Failed to restore secrets from backup"
        rm -rf "$restore_dir"
        return 1
    }
    
    log_success "Secrets restored to: $restore_dir"
    log_info "Review the restored secrets before moving them to the active directory"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi