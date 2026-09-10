#!/usr/bin/env bash

#
# Deployment script for Hornet Finder with separate environments
# Supports dev and prod modes completely separated
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

# Function to resolve service aliases to actual Docker Compose service names
resolve_service_name() {
    local service="$1"
    local env="$2"
    
    # Set suffix based on environment (dev has -dev suffix, prod has no suffix)
    local suffix=""
    if [[ "$env" == "dev" ]]; then
        suffix="-dev"
    fi
    
    case "$service" in
        "api"|"backend")
            echo "hornet-finder${suffix}-api"
            ;;
        "frontend"|"vite")
            if [[ "$env" == "dev" ]]; then
                echo "hornet-finder-dev-vite"
            else
                handle_error "Frontend service only available in dev environment"
            fi
            ;;
        "keycloak"|"auth")
            echo "hornet-finder${suffix}-keycloak"
            ;;
        "nginx"|"proxy")
            echo "nginx"
            ;;
        "api-db"|"database")
            echo "hornet-finder${suffix}-api-db"
            ;;
        "keycloak-db")
            echo "hornet-finder${suffix}-keycloak-db"
            ;;
        *)
            # Try the service name as-is (could be full docker-compose service name)
            echo "$service"
            ;;
    esac
}

# Validate service name if specified
if [[ -n "$SERVICE" ]]; then
    RESOLVED_SERVICE=$(resolve_service_name "$SERVICE" "$MODE")
    echo "[TARGET] Targeting specific service: $SERVICE -> $RESOLVED_SERVICE"
fi

echo "[DEPLOY] Hornet Finder Deployment - Environment: $MODE (separate environments)"

# Get YAML files for the specific environment
YAML_FILE=$(get_yaml_files "$SCRIPT_DIR" "$MODE")

# Create ZFS datasets if ZFS is used
if is_zfs_used "$SCRIPT_DIR"; then
    echo "[ZFS] Checking and creating ZFS datasets for $MODE..."
    create_zfs_datasets_if_needed "$MODE"
    echo "[DOCKER] Checking and creating Docker volumes for $MODE..."
    create_docker_volumes_if_needed "$MODE"
fi

# Build frontend if needed (for prod mode)
if [[ "$MODE" == "prod" && "$BUILD_FRONTEND" == 1 ]]; then
    echo "[BUILD] Building frontend for production..."
    if [[ "$NO_CACHE" == 1 ]]; then
        echo "[NO-CACHE] Using --no-cache for frontend build"
        eval "docker compose ${YAML_FILE} --profile build-frontend build --no-cache hornet-finder-frontend-build"
        eval "docker compose ${YAML_FILE} --profile build-frontend up hornet-finder-frontend-build"
    else
        eval "docker compose ${YAML_FILE} --profile build-frontend up --build hornet-finder-frontend-build"
    fi
    eval "docker compose ${YAML_FILE} --profile build-frontend down"
fi

# Handle service-specific deployment
if [[ -n "$SERVICE" ]]; then
    echo "[RESTART] Restarting specific service: $RESOLVED_SERVICE"
    
    # For specific services, we don't do a full down
    echo "[BUILD] Rebuilding and restarting service..."
    if [[ "$NO_CACHE" == 1 ]]; then
        echo "[NO-CACHE] Using --no-cache for service build"
        eval "docker compose ${YAML_FILE} build --no-cache \"$RESOLVED_SERVICE\""
        eval "docker compose ${YAML_FILE} up -d --force-recreate \"$RESOLVED_SERVICE\""
    else
        eval "docker compose ${YAML_FILE} up -d --build --force-recreate \"$RESOLVED_SERVICE\""
    fi
    
    # Check if the service is running
    if eval "docker compose ${YAML_FILE} ps \"$RESOLVED_SERVICE\"" | grep -q "Up\|running"; then
        show_success "Service $RESOLVED_SERVICE restarted successfully"
    else
        handle_error "Failed to restart service $RESOLVED_SERVICE"
    fi
    
    # Show service logs
    echo ""
    echo "[LOGS] Recent logs for $RESOLVED_SERVICE:"
    eval "docker compose ${YAML_FILE} logs --tail=10 \"$RESOLVED_SERVICE\"" || echo "No logs available"
    
    exit 0
fi

# Full environment deployment
# Stop existing services for this environment
echo "[STOP] Stopping existing services for $MODE..."
eval "docker compose ${YAML_FILE} down"

# Start services according to mode
if [[ "$NO_CACHE" == 1 ]]; then
    echo "[NO-CACHE] Using --no-cache for full environment build"
fi

case "$MODE" in
    "dev")
        echo "[DEV] Starting in development mode (separate environment)..."
        if [[ "$NO_CACHE" == 1 ]]; then
            eval "docker compose ${YAML_FILE} build --no-cache"
            eval "docker compose ${YAML_FILE} up -d"
        else
            eval "docker compose ${YAML_FILE} up -d --build"
        fi
        ;;
    "prod")
        echo "[PROD] Starting in production mode (separate environment)..."
        if [[ "$NO_CACHE" == 1 ]]; then
            eval "docker compose ${YAML_FILE} build --no-cache"
            eval "docker compose ${YAML_FILE} up -d"
        else
            eval "docker compose ${YAML_FILE} up -d --build"
        fi
        ;;
esac

# Wait for services to be ready
wait_for_services

# Check service status
echo "[STATUS] Service status:"
eval "docker compose ${YAML_FILE} ps"

show_success "Deployment completed!"

# Display appropriate URLs
echo ""
echo "[URLS] Available URLs for $MODE:"
if [[ "$MODE" == "dev" ]]; then
    echo "  - DEV Application: https://dev.velutina.ovh"
    echo "  - DEV Auth: https://auth.dev.velutina.ovh"
    echo "  - DEV API: https://dev.velutina.ovh/api/"
elif [[ "$MODE" == "prod" ]]; then
    echo "  - PROD Application: https://velutina.ovh"
    echo "  - PROD Auth: https://auth.velutina.ovh"
    echo "  - PROD API: https://velutina.ovh/api/"
fi
