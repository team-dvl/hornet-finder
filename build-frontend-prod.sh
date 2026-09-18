#!/usr/bin/env bash
set -euo pipefail

#
# Script to build the frontend for production deployment
# This script generates the static bundle and places it in the frontend-dist volume
# for nginx to serve in production environment
#

# get_script_dir will work with either zsh or bash
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
source "$SCRIPT_DIR/lib/volumes.sh"

NO_CACHE=0

print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --no-cache          Force rebuild without using Docker cache"
    echo "  -h, --help          Display this help"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cache)
            NO_CACHE=1
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            print_help
            exit 1
            ;;
    esac
done

cd "$SCRIPT_DIR"
load_env
MODE=$(get_configured_environment)

# The build only makes sense where a frontend-dist volume receives the bundle
if [[ -z "${FRONTEND_DIST_VOLUME:-}" ]]; then
    handle_error "FRONTEND_DIST_VOLUME is not set in .env: the $MODE environment has no static frontend to build"
fi
require_docker_volumes

# Build the frontend for production
echo "[BUILD] Building frontend for production deployment..."
build_frontend_production "$NO_CACHE"

show_success "Production build completed! Files are in the '$FRONTEND_DIST_VOLUME' volume"

# Show build size
show_build_size
