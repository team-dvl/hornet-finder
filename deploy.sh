#!/usr/bin/env bash
set -euo pipefail

#
# Deployment script for Hornet Finder with separate environments
# Supports dev and prod modes completely separated
#
# The compose stack is selected by COMPOSE_FILE in .env; storage must have
# been provisioned beforehand with ./storage-init.sh.
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

BUILD_FRONTEND=0
SERVICE=""  # Specific service to deploy (optional)
NO_CACHE=0  # Force rebuild without cache

# Help display
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --service SVC   Specific service to restart (optional)"
    echo "  -b, --build         Force rebuild of frontend for production"
    echo "  --no-cache          Force rebuild without using Docker cache"
    echo "  -h, --help          Display this help"
    echo ""
    echo "Environments:"
    echo "  dev    - Deploy only the development environment (dev.velutina.ovh + auth.dev.velutina.ovh)"
    echo "  prod   - Deploy only the production environment (velutina.ovh + auth.velutina.ovh)"
    echo ""
    echo "Services (dev):"
    echo "  api, backend        - Django API server"
    echo "  frontend, vite      - Frontend development server"
    echo "  keycloak, auth      - Keycloak authentication server"
    echo "  nginx, proxy        - Nginx reverse proxy"
    echo "  api-db, database    - PostgreSQL + PostGIS database"
    echo "  keycloak-db         - Keycloak PostgreSQL database"
    echo ""
    echo "Services (prod):"
    echo "  api, backend        - Django API server"
    echo "  keycloak, auth      - Keycloak authentication server"
    echo "  nginx, proxy        - Nginx reverse proxy"
    echo "  api-db, database    - PostgreSQL + PostGIS database"
    echo "  keycloak-db         - Keycloak PostgreSQL database"
    echo ""
    echo "Examples:"
    echo "  $0                         # Deploy the environment declared in .env"
    echo "  $0 -s api                  # Restart the API service"
    echo "  $0 -s keycloak --no-cache  # Restart Keycloak without cache"
    echo ""
    echo "WARNING: DEV and PROD environments are now completely separated."
    echo "Each environment has its own services, databases and configurations."
    echo "External volumes must exist before deploying: see ./storage-init.sh."
}

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_FRONTEND=1
            shift
            ;;
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

# Validate service name if specified
RESOLVED_SERVICE=""
if [[ -n "$SERVICE" ]]; then
    RESOLVED_SERVICE=$(resolve_service_name "$SERVICE" "$MODE")
    echo "[TARGET] Targeting specific service: $SERVICE -> $RESOLVED_SERVICE"
fi

echo "[DEPLOY] Hornet Finder Deployment - Environment: $MODE (separate environments)"

# Storage is provisioned, never created, by deployment
echo "[STORAGE] Checking external volumes for $MODE..."
require_docker_volumes

# Build frontend if needed (for prod mode)
if [[ "$MODE" == "prod" && "$BUILD_FRONTEND" == 1 ]]; then
    echo "[BUILD] Building frontend for production..."
    build_frontend_production "$NO_CACHE"
fi

# Handle service-specific deployment
if [[ -n "$SERVICE" ]]; then
    echo "[RESTART] Restarting specific service: $RESOLVED_SERVICE"

    # For specific services, we don't do a full down
    echo "[BUILD] Rebuilding and restarting service..."
    if [[ "$NO_CACHE" == 1 ]]; then
        echo "[NO-CACHE] Using --no-cache for service build"
        docker compose build --no-cache "$RESOLVED_SERVICE"
        docker compose up -d --force-recreate "$RESOLVED_SERVICE"
    else
        docker compose up -d --build --force-recreate "$RESOLVED_SERVICE"
    fi

    # Check if the service is running
    if docker compose ps "$RESOLVED_SERVICE" | grep -q "Up\|running"; then
        show_success "Service $RESOLVED_SERVICE restarted successfully"
    else
        handle_error "Failed to restart service $RESOLVED_SERVICE"
    fi

    # Show service logs
    echo ""
    echo "[LOGS] Recent logs for $RESOLVED_SERVICE:"
    docker compose logs --tail=10 "$RESOLVED_SERVICE" || echo "No logs available"

    exit 0
fi

# Full environment deployment
# Stop existing services for this environment
echo "[STOP] Stopping existing services for $MODE..."
docker compose down

echo "[START] Starting $MODE environment (separate environment)..."
if [[ "$NO_CACHE" == 1 ]]; then
    echo "[NO-CACHE] Using --no-cache for full environment build"
    docker compose build --no-cache
    docker compose up -d
else
    docker compose up -d --build
fi

# Wait for services to be ready
wait_for_services

# Check service status
echo "[STATUS] Service status:"
docker compose ps

show_success "Deployment completed!"

print_deployment_urls "$MODE"
