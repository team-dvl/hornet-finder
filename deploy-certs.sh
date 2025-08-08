#!/usr/bin/env bash
set -e  # Exit on error

#
# Script unifié de génération des certificats SSL
# Usage: ./deploy-certs.sh [-e env] [-f] [-h]
#

#
# get_script_dir will work with either zsh or bash
# it can be used to retrieve the directory where the script is stored, in absolute form.
#
get_script_dir() {
    local SOURCE="${BASH_SOURCE[0]:-${(%):-%x}}"
    while [ -h "$SOURCE" ]; do
	local DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
	SOURCE="$(readlink "$SOURCE")"
	[[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
    done
    cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd
}

SCRIPT_DIR="$(get_script_dir)"

# Load common functions
source "$SCRIPT_DIR/lib/common.sh"

# Default variables
FORCE=0
ENVIRONMENT=""

# Colors for messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Display functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Help display
print_help() {
    echo "Usage: $0 [-e environment] [-f] [-h]"
    echo ""
    echo "Options:"
    echo "  -e ENV    Environment to deploy (prod or dev)"
    echo "  -f        Force deletion of existing certificates"
    echo "  -h        Display this help"
    echo ""
    echo "Examples:"
    echo "  $0 -e prod        # Generate certificates for PROD"
    echo "  $0 -e dev         # Generate certificates for DEV" 
    echo "  $0 -e prod -f     # Force regeneration of PROD certificates"
    echo ""
    echo "Supported environments:"
    echo "  prod: velutina.ovh, auth.velutina.ovh (IP 51.83.11.24)"
    echo "  dev:  dev.velutina.ovh, auth.dev.velutina.ovh (IP 37.187.220.209)"
    echo ""
    echo "Note: Both environments are deployed from the same server"
    echo "      but exposed on different IP addresses."
}

# Environment validation
validate_environment() {
    local env="$1"
    
    if [[ "$env" != "prod" && "$env" != "dev" ]]; then
        error "Invalid environment: $env"
        echo "Supported environments are: prod, dev"
        exit 1
    fi
}

# Certificate generation for PROD (original method)
generate_prod_certs() {
    log "🔐 Generating SSL certificates for PROD environment"
    log "Domains: velutina.ovh, auth.velutina.ovh"
    
    TARGET_DIR="$SCRIPT_DIR/certbot"
    
    # Use common function for deletion confirmation
    confirm_deletion "$TARGET_DIR" "$FORCE"
    
    pushd "$SCRIPT_DIR" > /dev/null
    
    # Using original method for PROD
    stop_services_with_profile_and_volumes "" "gencert"
    docker compose --profile gencert up --build certbot
    stop_services_with_profile_and_volumes "" "gencert"
    
    popd > /dev/null
    
    success "✅ PROD certificates generated successfully!"
}

# Certificate generation for DEV
generate_dev_certs() {
    log "🔐 Generating SSL certificates for DEV environment"
    log "Domains: dev.velutina.ovh, auth.dev.velutina.ovh"
    log "ℹ️  Deploying from same server on different IP"
    
    cd "$SCRIPT_DIR"
    
    # Load environment variables for DEV
    log "📁 Loading environment variables for DEV..."
    load_env "dev"
    
    # Create ZFS datasets if needed
    if is_zfs_used "$SCRIPT_DIR"; then
        log "🗄️ Checking and creating ZFS datasets for DEV..."
        create_zfs_datasets_if_needed "dev"
    fi
    
    # Get YAML files for DEV
    YAML_FILE=$(get_yaml_files "$SCRIPT_DIR" "dev")
    
    # Handle forced deletion for DEV
    if [[ "$FORCE" == "1" ]]; then
        TARGET_DIR="$SCRIPT_DIR/certbot"
        confirm_deletion "$TARGET_DIR" "$FORCE"
    fi
    
    log "🛑 Stopping existing services..."
    eval "docker compose ${YAML_FILE} --env-file .env.dev down"
    
    log "🌐 Starting nginx server for ACME challenges..."
    eval "docker compose ${YAML_FILE} --env-file .env.dev --profile gencert up -d nginx-certbot-dev"
    
    log "⏳ Waiting for nginx server to start..."
    sleep 5
    
    log "🔐 Generating SSL certificates..."
    eval "docker compose ${YAML_FILE} --env-file .env.dev --profile gencert up certbot-dev"
    
    log "🛑 Stopping temporary nginx server..."
    eval "docker compose ${YAML_FILE} --env-file .env.dev --profile gencert down"
    
    success "✅ DEV certificates generated successfully!"
    echo ""
    log "🚀 You can now deploy the complete DEV environment with:"
    log "   ./deploy-separated.sh -m dev"
}

# Option parsing
while getopts ":e:fh" opt; do
    case "$opt" in
        e) ENVIRONMENT="$OPTARG" ;;
        f) FORCE=1 ;;
        h) print_help; exit 0 ;;
        \?) error "Invalid option: -$OPTARG"; print_help; exit 1 ;;
        :) error "Option -$OPTARG requires an argument"; print_help; exit 1 ;;
    esac
done

# Check that an environment was specified
if [[ -z "$ENVIRONMENT" ]]; then
    error "No environment specified"
    print_help
    exit 1
fi

# Validate environment
validate_environment "$ENVIRONMENT"

# Generate certificates according to environment
case "$ENVIRONMENT" in
    "prod")
        generate_prod_certs
        ;;
    "dev")
        generate_dev_certs
        ;;
esac

success "🎉 Certificate generation completed for $ENVIRONMENT environment"






     
