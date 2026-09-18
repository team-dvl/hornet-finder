#!/usr/bin/env bash
set -euo pipefail

# Utilities to manage logs for the current worktree

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

usage() {
    cat << EOF
[LOGS] Log utilities for separate environments

Usage: $0 [OPTIONS] [SERVICE]

OPTIONS:
    -f, --follow       Follow logs in real time
    -n, --tail N       Number of lines to display (default: 50)
    -h, --help         Display this help

SERVICES:
    api               Django API
    db, api-db        PostGIS database
    keycloak          Keycloak
    keycloak-db       Keycloak database
    nginx             Nginx (reverse proxy)
    vite              Vite server (DEV only)

Examples:
    $0 api                     # API logs (last 50 lines)
    $0 -f nginx                # Follow Nginx logs in real time
    $0 -n 100 keycloak         # Last 100 lines of Keycloak
    $0                         # Logs of all services

EOF
}

FOLLOW=false
TAIL_COUNT=50
SERVICE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--tail)
            TAIL_COUNT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            SERVICE="$1"
            shift
            ;;
    esac
done

cd "$SCRIPT_DIR"
load_env
MODE=$(get_configured_environment)

# Build logs command
LOGS_ARGS=(logs)
if [[ "$FOLLOW" == "true" ]]; then
    LOGS_ARGS+=(-f)
else
    LOGS_ARGS+=(--tail "$TAIL_COUNT")
fi

# Add service if specified
if [[ -n "$SERVICE" ]]; then
    SERVICE=$(resolve_service_name "$SERVICE" "$MODE")
    LOGS_ARGS+=("$SERVICE")
fi

echo "[LOGS] Logs $MODE${SERVICE:+ - $SERVICE}"
docker compose "${LOGS_ARGS[@]}"
