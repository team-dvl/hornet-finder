#!/usr/bin/env bash

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

MODE=""  # No default - environment must be specified
REMOVE_VOLUMES=0

# Help display
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       Environment to stop: 'dev', 'prod', or 'all' (required)"
    echo "  -v, --volumes       Also remove volumes (WARNING: data loss!)"
    echo "  -h, --help          Display this help"
    echo ""
    echo "Environments:"
    echo "  dev    - Stop only the development environment"
    echo "  prod   - Stop only the production environment"
    echo "  all    - Stop both environments"
}

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            MODE="$2"
            shift 2
            ;;
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

# Check that environment is specified
if [[ -z "$MODE" ]]; then
    echo "❌ Environment required (-e dev|prod|all)" >&2
    print_help
    exit 1
fi

# Environment validation
if [[ "$MODE" != "dev" && "$MODE" != "prod" && "$MODE" != "all" ]]; then
    handle_error "Invalid environment '$MODE'. Use 'dev', 'prod', or 'all'."
fi

echo "🛑 Hornet Finder Shutdown - Environment: $MODE"

cd "$SCRIPT_DIR"

# Function to shutdown a specific environment
shutdown_environment() {
    local env="$1"
    local yaml_file=$(get_yaml_files "$SCRIPT_DIR" "$env")
    
    # Determine the env file to use
    local ENV_FILE=".env"
    if [[ "$env" == "dev" ]]; then
        ENV_FILE=".env.dev"
    elif [[ "$env" == "prod" ]]; then
        ENV_FILE=".env.prod"  
    fi
    
    echo "🛑 Stopping $env environment..."
    
    if [[ "$REMOVE_VOLUMES" == 1 ]]; then
        echo "⚠️  WARNING: Removing volumes for $env (data loss!)"
        eval "docker compose ${yaml_file} --env-file \"$ENV_FILE\" down -v"
    else
        eval "docker compose ${yaml_file} --env-file \"$ENV_FILE\" down"
    fi
    
    echo "✅ Environment $env stopped"
}

# Execute shutdown based on mode
case "$MODE" in
    "dev")
        shutdown_environment "dev"
        ;;
    "prod")
        shutdown_environment "prod"
        ;;
    "all")
        shutdown_environment "dev"
        shutdown_environment "prod"
        ;;
esac

show_success "Shutdown completed!"
