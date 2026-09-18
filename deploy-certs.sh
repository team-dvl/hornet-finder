#!/usr/bin/env bash
set -euo pipefail

#
# SSL certificate generation (Let's Encrypt) for the environment of this worktree
# Usage: ./deploy-certs.sh [-h]
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
    echo "Usage: $0 [-h]"
    echo ""
    echo "Options:"
    echo "  -h        Display this help"
    echo ""
    echo "Examples:"
    echo "  $0               # Generate certificates for APP_ENV from .env"
    echo ""
}

# generate_certs runs the ACME challenge through the temporary nginx of the
# gencert profile. The compose services carry a -dev suffix in development.
generate_certs() {
    local env="$1"
    local suffix=""
    if [[ "$env" == "dev" ]]; then
        suffix="-dev"
    fi

    log "Generating SSL certificates for ${env^^} environment"
    log "Domains: ${HOST}, ${KC_HOSTNAME}"

    log "Stopping existing services..."
    docker compose down

    log "Starting nginx server for ACME challenges..."
    docker compose --profile gencert up -d "nginx-certbot${suffix}"

    log "Waiting for nginx server to start..."
    sleep 5

    log "Generating SSL certificates..."
    docker compose --profile gencert up "certbot${suffix}"

    log "Stopping temporary nginx server..."
    docker compose --profile gencert down

    success "${env^^} certificates generated successfully!"
    echo ""
    log "You can now deploy the complete ${env^^} environment with:"
    log " ./deploy.sh"
}

# Option parsing
if [[ "${1:-}" == "--help" ]]; then
    print_help
    exit 0
fi

while getopts ":h" opt; do
    case "$opt" in
        h) print_help; exit 0 ;;
        \?) error "Invalid option: -$OPTARG"; print_help; exit 1 ;;
        :) error "Option -$OPTARG requires an argument"; print_help; exit 1 ;;
    esac
done

cd "$SCRIPT_DIR"
load_env
ENVIRONMENT=$(get_configured_environment)

generate_certs "$ENVIRONMENT"

success "Certificate generation completed for $ENVIRONMENT environment"
