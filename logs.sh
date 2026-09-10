#!/bin/bash
# Utilities to manage logs for the current worktree

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source lib/common.sh

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

# Load and detect the environment from this worktree
load_env
MODE=$(get_configured_environment)

# Adjust name suffix: "" for prod, "-dev" for dev
NAMESUFFIX=""
if [[ "$MODE" == "dev" ]]; then
    NAMESUFFIX="-$MODE"
fi

# Get compose files
COMPOSE_FILES=$(get_yaml_files "$SCRIPT_DIR" "$MODE")

# Build docker compose command parts
COMPOSE_ARGS="$COMPOSE_FILES"

# Build logs command
LOGS_CMD="logs"
if [[ "$FOLLOW" == "true" ]]; then
    LOGS_CMD="$LOGS_CMD -f"
else
    LOGS_CMD="$LOGS_CMD --tail $TAIL_COUNT"
fi

# Add service if specified
if [[ -n "$SERVICE" ]]; then
    # Map service names to container names
    case "$SERVICE" in
        api)
            SERVICE="hornet-finder$NAMESUFFIX-api"
            ;;
        api-db|db)
            SERVICE="hornet-finder$NAMESUFFIX-api-db"
            ;;
        keycloak)
            SERVICE="hornet-finder$NAMESUFFIX-keycloak"
            ;;
        keycloak-db)
            SERVICE="hornet-finder$NAMESUFFIX-keycloak-db"
            ;;
        nginx)
            SERVICE="nginx"
            ;;
        vite)
            if [[ "$MODE" != "dev" ]]; then
                echo "[ERROR] The vite service is only available in DEV mode"
                exit 1
            fi
            SERVICE="hornet-finder-dev-vite"
            ;;
        *)
            # Service name already correct
            ;;
    esac
    LOGS_CMD="$LOGS_CMD $SERVICE"
fi

echo "[LOGS] Logs $MODE${SERVICE:+ - $SERVICE}"
eval "docker compose $COMPOSE_ARGS $LOGS_CMD"
