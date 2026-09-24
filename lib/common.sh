#!/usr/bin/env bash

#
# Common library for Hornet Finder scripts: environment loading, service name
# resolution and shared UI helpers.
#
# The compose stack itself is selected by COMPOSE_FILE in .env, which docker
# compose reads natively: no script needs to pass -f arguments. Storage is
# handled by lib/volumes.sh (Docker volumes) and lib/zfs.sh (ZFS backend);
# nothing here knows about either.
#
# Callers must define SCRIPT_DIR (the worktree root) before sourcing this file.
#

# Common error handling
handle_error() {
    echo "❌ Error: $1" >&2
    exit 1
}

# Common success message
show_success() {
    echo "✅ $1"
}

# check_env_file will verify that the worktree environment file exists
check_env_file() {
    local env_file="$SCRIPT_DIR/.env"

    if [[ ! -f "$env_file" ]]; then
        echo "❌ Missing $env_file file" >&2
        echo "💡 Tip: Copy .env.example to .env and adjust the values" >&2
        exit 1
    fi
}

# load_env will source and export the worktree environment variables.
# Exporting them makes the values visible to docker compose and to any helper
# run from the scripts, exactly as compose would read them from .env itself.
load_env() {
    check_env_file
    set -a
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env"
    set +a
}

# get_configured_environment validates the environment declared by the worktree
get_configured_environment() {
    case "${APP_ENV:-}" in
        dev|prod)
            echo "$APP_ENV"
            ;;
        *)
            echo "❌ APP_ENV must be set to 'dev' or 'prod' in .env" >&2
            exit 1
            ;;
    esac
}

# resolve_service_name maps a short alias to the compose service name of the
# given environment (dev services carry a -dev infix, prod ones do not).
# Unknown aliases are returned unchanged so full service names still work.
resolve_service_name() {
    local service="$1"
    local env="$2"

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
        "api-db"|"db"|"database")
            echo "hornet-finder${suffix}-api-db"
            ;;
        "keycloak-db")
            echo "hornet-finder${suffix}-keycloak-db"
            ;;
        "mail"|"mailpit")
            echo "hornet-finder-dev-mailpit"
            ;;
        "mail-proxy")
            echo "hornet-finder-dev-mail-proxy"
            ;;
        *)
            echo "$service"
            ;;
    esac
}

# wait_for_services will wait for Docker services to be ready
wait_for_services() {
    local wait_time=${1:-10}
    echo "⏳ Waiting for services to start..."
    sleep "$wait_time"
}

# build_frontend_production builds the production bundle into the
# frontend-dist volume. Pass 1 as first argument to bypass the Docker cache.
build_frontend_production() {
    local no_cache="${1:-0}"
    echo "🔨 Building frontend for production..."
    if [[ "$no_cache" == 1 ]]; then
        echo "[NO-CACHE] Using --no-cache for frontend build"
        docker compose --profile build-frontend build --no-cache hornet-finder-frontend-build
        docker compose --profile build-frontend up hornet-finder-frontend-build
    else
        docker compose --profile build-frontend up --build hornet-finder-frontend-build
    fi
    docker compose --profile build-frontend down
}

# show_build_size will display the size of the frontend build
show_build_size() {
    echo "📦 Build size:"
    docker run --rm -v "${FRONTEND_DIST_VOLUME}:/data:ro" alpine sh -c "du -sh /data/* 2>/dev/null || echo 'No files found'"
}

# print_deployment_urls will display the URLs of the configured environment
print_deployment_urls() {
    local mode="$1"
    echo ""
    echo "[URLS] Available URLs for $mode:"
    echo "  - Application: https://${HOST}"
    echo "  - Auth: https://${KC_HOSTNAME}"
    echo "  - API: https://${HOST}/api/"
}
