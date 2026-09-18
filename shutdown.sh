#!/usr/bin/env bash
set -euo pipefail

#
# Shutdown script for Hornet Finder with separate environments
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

REMOVE_VOLUMES=0

# Help display
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -v, --volumes       Also remove volumes (WARNING: data loss!)"
    echo "  -h, --help          Display this help"
    echo ""
    echo "The environment is read from APP_ENV in .env."
}

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=1
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
echo "[SHUTDOWN] Hornet Finder Shutdown - Environment: $MODE"

# Function to shutdown a specific environment
shutdown_environment() {
    local env="$1"

    echo "[SHUTDOWN] Stopping $env environment..."

    if [[ "$REMOVE_VOLUMES" == 1 ]]; then
        # External volumes are never removed by compose; this only affects
        # volumes the stack owns (e.g. when the overlay is not in COMPOSE_FILE).
        echo "[WARNING] Removing volumes for $env (data loss!)"
        docker compose down -v
    else
        docker compose down
    fi

    echo "[SUCCESS] Environment $env stopped"
}

shutdown_environment "$MODE"

show_success "Shutdown completed!"
