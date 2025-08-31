#!/bin/bash

# CryptoTrader Production Deployment Script
# Implements blue-green deployment with comprehensive health checks

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-blue-green}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code $exit_code"
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            log_info "Initiating rollback..."
            rollback_deployment
        fi
    fi
    exit $exit_code
}

trap cleanup EXIT

# Utility functions
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check environment variables
    local required_vars=("DATABASE_URL" "DELTA_API_KEY" "DELTA_API_SECRET")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable '$var' is not set"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

backup_database() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        log_info "Creating database backup..."
        
        local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
        local backup_path="/tmp/$backup_file"
        
        # Create backup using pg_dump
        docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" exec -T postgres \
            pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_path"
        
        if [ $? -eq 0 ]; then
            log_success "Database backup created: $backup_path"
            echo "$backup_path" > /tmp/last_backup_path
        else
            log_error "Database backup failed"
            exit 1
        fi
    fi
}

build_application() {
    log_info "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Build Docker image
    docker build -f "$DEPLOYMENT_DIR/docker/Dockerfile.production" -t cryptotrader:latest .
    
    if [ $? -eq 0 ]; then
        log_success "Application build completed"
    else
        log_error "Application build failed"
        exit 1
    fi
}

run_tests() {
    log_info "Running test suite..."
    
    # Run unit tests
    npm test -- --coverage --watchAll=false
    
    # Run integration tests
    npm run test:integration
    
    # Run security audit
    npm audit --audit-level moderate
    
    if [ $? -eq 0 ]; then
        log_success "All tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
}

deploy_blue_green() {
    log_info "Starting blue-green deployment..."
    
    # Determine current and new environments
    local current_env=$(get_current_environment)
    local new_env=$([ "$current_env" = "blue" ] && echo "green" || echo "blue")
    
    log_info "Current environment: $current_env"
    log_info "Deploying to: $new_env"
    
    # Deploy to new environment
    deploy_to_environment "$new_env"
    
    # Health check new environment
    if health_check_environment "$new_env"; then
        log_success "Health check passed for $new_env environment"
        
        # Switch traffic to new environment
        switch_traffic "$new_env"
        
        # Final health check
        if health_check_production; then
            log_success "Blue-green deployment completed successfully"
            
            # Clean up old environment
            cleanup_old_environment "$current_env"
        else
            log_error "Final health check failed"
            switch_traffic "$current_env"
            exit 1
        fi
    else
        log_error "Health check failed for $new_env environment"
        cleanup_failed_deployment "$new_env"
        exit 1
    fi
}

deploy_to_environment() {
    local env=$1
    log_info "Deploying to $env environment..."
    
    # Update docker-compose with environment-specific configuration
    export COMPOSE_PROJECT_NAME="cryptotrader-$env"
    export APP_PORT=$((env == "blue" ? 3000 : 3001))
    
    # Deploy services
    docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" up -d
    
    # Wait for services to start
    sleep 30
    
    log_success "Deployment to $env environment completed"
}

health_check_environment() {
    local env=$1
    local port=$((env == "blue" ? 3000 : 3001))
    local max_attempts=30
    local attempt=1
    
    log_info "Performing health check for $env environment..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port/api/health/detailed" > /dev/null; then
            log_success "Health check passed for $env environment (attempt $attempt)"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Health check failed for $env environment after $max_attempts attempts"
    return 1
}

health_check_production() {
    log_info "Performing production health check..."
    
    local health_response=$(curl -s "http://localhost/api/health/detailed")
    local status=$(echo "$health_response" | jq -r '.status')
    
    if [ "$status" = "healthy" ]; then
        log_success "Production health check passed"
        return 0
    else
        log_error "Production health check failed: $status"
        return 1
    fi
}

switch_traffic() {
    local target_env=$1
    log_info "Switching traffic to $target_env environment..."
    
    # Update nginx configuration
    local nginx_config="$DEPLOYMENT_DIR/nginx/nginx.conf"
    local temp_config="/tmp/nginx.conf.tmp"
    
    # Update upstream configuration
    sed "s/server app-[12]:3000/server app-$target_env:3000/" "$nginx_config" > "$temp_config"
    
    # Reload nginx configuration
    docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" exec nginx \
        nginx -s reload
    
    log_success "Traffic switched to $target_env environment"
}

get_current_environment() {
    # Logic to determine current active environment
    # This would typically check load balancer configuration
    echo "blue"  # Default for initial deployment
}

cleanup_old_environment() {
    local old_env=$1
    log_info "Cleaning up $old_env environment..."
    
    # Stop old environment containers
    export COMPOSE_PROJECT_NAME="cryptotrader-$old_env"
    docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" down
    
    log_success "Cleanup of $old_env environment completed"
}

cleanup_failed_deployment() {
    local failed_env=$1
    log_warning "Cleaning up failed deployment in $failed_env environment..."
    
    export COMPOSE_PROJECT_NAME="cryptotrader-$failed_env"
    docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" down
    
    log_success "Failed deployment cleanup completed"
}

rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    # Restore from backup if available
    if [ -f "/tmp/last_backup_path" ]; then
        local backup_path=$(cat /tmp/last_backup_path)
        if [ -f "$backup_path" ]; then
            log_info "Restoring database from backup: $backup_path"
            docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" exec -T postgres \
                psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$backup_path"
        fi
    fi
    
    # Switch back to previous environment
    local previous_env=$(get_current_environment)
    switch_traffic "$previous_env"
    
    log_success "Rollback completed"
}

# Main deployment function
main() {
    log_info "Starting CryptoTrader deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Deployment type: $DEPLOYMENT_TYPE"
    
    # Pre-deployment checks
    check_prerequisites
    
    # Create backup
    backup_database
    
    # Build and test
    build_application
    run_tests
    
    # Deploy based on type
    case "$DEPLOYMENT_TYPE" in
        "blue-green")
            deploy_blue_green
            ;;
        "rolling")
            log_error "Rolling deployment not implemented yet"
            exit 1
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
    
    log_success "Deployment completed successfully!"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
