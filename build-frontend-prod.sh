#!/usr/bin/env bash
set -e

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

cd "$SCRIPT_DIR"

# Use production configuration
YAML_FILE=$(get_yaml_files "$SCRIPT_DIR" "prod")

# Build the frontend for production
echo "🔨 Building frontend for production deployment..."
build_frontend_production "$YAML_FILE"

show_success "Production build completed! Files are in the 'frontend-dist' volume"

# Show build size
show_build_size
