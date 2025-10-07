#!/usr/bin/env bash

#
# Common library for Hornet Finder deployment scripts
#

# is_zfs_used will check if the filesystem is ZFS
is_zfs_used() {
    # Check for marker file first (using the script directory passed as parameter)
    local script_dir="$1"
    if [ -f "$script_dir/.zfs_used" ]; then
        return 0
    fi
    
    if [ -x /usr/sbin/zfs ]; then
        # Check if ZFS is used by looking for ZFS datasets
        zfs list | grep -q docker && return 0
    fi

    # If we reach here, ZFS is not used
    return 1
}

# create_zfs_datasets_if_needed will create ZFS datasets for Docker volumes if they don't exist
create_zfs_datasets_if_needed() {
    local environment="${1:-both}"  # Default to both for backward compatibility
    
    # Arrays of required ZFS datasets per environment
    local prod_datasets=(
        "ZROOT/docker/volumes/hornet-finder-api-db"
        "ZROOT/docker/volumes/hornet-finder-keycloak-db"
        "ZROOT/docker/volumes/hornet-finder-frontend-dist"
    )
    
    local dev_datasets=(
        "ZROOT/docker/volumes/hornet-finder-dev-api-db"
        "ZROOT/docker/volumes/hornet-finder-dev-keycloak-db"
    )
    
    # Ensure parent directory exists
    if ! zfs list ZROOT/docker/volumes >/dev/null 2>&1; then
        echo "parent ZFS dataset not present: ZROOT/docker/volumes"
	echo "please create it using zfs create"
        #sudo zfs create -p ZROOT/docker/volumes
	exit 1
    fi
    
    # Create datasets based on environment
    case "$environment" in
        "prod")
            create_datasets_array "${prod_datasets[@]}"
            ;;
        "dev")
            create_datasets_array "${dev_datasets[@]}"
            ;;
        "both"|*)
            create_datasets_array "${prod_datasets[@]}"
            create_datasets_array "${dev_datasets[@]}"
            ;;
    esac
}

# create_docker_volumes_if_needed will create Docker volumes if they don't exist
create_docker_volumes_if_needed() {
    local environment="${1:-both}"  # Default to both for backward compatibility
    
    # Arrays of required Docker volumes per environment
    local prod_volumes=(
        "hornet-finder-api-db"
        "hornet-finder-keycloak-db"
        "hornet-finder-frontend-dist"
    )
    
    local dev_volumes=(
        "hornet-finder-dev-api-db"
        "hornet-finder-dev-keycloak-db"
    )
    
    # Create volumes based on environment
    case "$environment" in
        "prod")
            create_docker_volumes_array "${prod_volumes[@]}"
            ;;
        "dev")
            create_docker_volumes_array "${dev_volumes[@]}"
            ;;
        "both"|*)
            create_docker_volumes_array "${prod_volumes[@]}"
            create_docker_volumes_array "${dev_volumes[@]}"
            ;;
    esac
}

# Helper function to create Docker volumes from array
create_docker_volumes_array() {
    set -x
    local volumes=("$@")
    for volume in "${volumes[@]}"; do
        if ! docker volume inspect "$volume" >/dev/null 2>&1; then
            echo "Creating Docker volume: $volume"
            docker volume create "$volume"
        else
            echo "Docker volume already exists: $volume"
        fi
    done
    set -x
}

# Helper function to create datasets from array
create_datasets_array() {
    set -x
    local datasets=("$@")
    for dataset in "${datasets[@]}"; do
        if ! zfs list "$dataset" >/dev/null 2>&1; then
            echo "Creating ZFS dataset: $dataset"
            sudo zfs create "$dataset"
        else
            echo "ZFS dataset already exists: $dataset"
        fi
    done
    set +x
}

# check_env_file will verify that required environment files exist
check_env_file() {
    local environment="${1:-prod}"
    local env_file=".env"
    
    if [[ "$environment" == "dev" ]]; then
        env_file=".env.dev"
    elif [[ "$environment" == "prod" ]]; then
        env_file=".env.prod"
    fi
    
    if [[ ! -f "$env_file" ]]; then
        echo "❌ Missing $env_file file"
        echo "💡 Tip: Copy ${env_file}.example to $env_file and adjust the values"
        exit 1
    fi
}

# load_env will source the environment variables
load_env() {
    local environment="${1:-prod}"
    check_env_file "$environment"
    
    if [[ "$environment" == "dev" ]]; then
        source .env.dev
    elif [[ "$environment" == "prod" ]]; then
        source .env.prod
    else
        # Fallback to .env for backward compatibility
        source .env
    fi
}

# get_yaml_files will return the appropriate docker-compose files for the environment
get_yaml_files() {
    local script_dir="$1"
    local environment="${2:-prod}"
    
    case "$environment" in
        "dev")
            if [[ -f "$script_dir/docker-compose.dev.zfs.yml" ]]; then
                echo "-f docker-compose.dev.yml -f docker-compose.dev.zfs.yml"
            else
                echo "-f docker-compose.dev.yml"
            fi
            ;;
        "prod")
            if [[ -f "$script_dir/docker-compose.prod.zfs.yml" ]]; then
                echo "-f docker-compose.prod.yml -f docker-compose.prod.zfs.yml"
            else
                echo "-f docker-compose.prod.yml"
            fi
            ;;
        *)
            echo "❌ Invalid environment '$environment'. Use 'dev' or 'prod'." >&2
            exit 1
            ;;
    esac
}

# wait_for_services will wait for Docker services to be ready
wait_for_services() {
    local wait_time=${1:-10}
    echo "⏳ Waiting for services to start..."
    sleep "$wait_time"
}

# show_service_status will display the status of Docker services
show_service_status() {
    local yaml_file="$1"
    echo "📊 Service status:"
    docker compose ${yaml_file} ps
}

# stop_services will stop all running Docker services
stop_services() {
    local yaml_file="$1"
    echo "🛑 Stopping existing services..."
    docker compose ${yaml_file} down
}

# stop_services_with_profile will stop services with a specific profile
stop_services_with_profile() {
    local yaml_file="$1"
    local profile="$2"
    echo "🛑 Stopping services with profile $profile..."
    docker compose ${yaml_file} --profile "$profile" down
}

# stop_services_with_profile_and_volumes will stop services with a specific profile and remove volumes
stop_services_with_profile_and_volumes() {
    local yaml_file="$1"
    local profile="$2"
    echo "🛑 Stopping services with profile $profile and removing volumes..."
    docker compose ${yaml_file} --profile "$profile" down -v
}

# build_frontend_production will build the frontend for production
build_frontend_production() {
    local yaml_file="$1"
    echo "🔨 Building frontend for production..."
    docker compose ${yaml_file} --profile build-frontend up --build hornet-finder-frontend-build
    docker compose ${yaml_file} --profile build-frontend down
}

# show_build_size will display the size of the frontend build
show_build_size() {
    echo "📦 Build size:"
    docker run --rm -v hornet-finder-frontend-dist:/data alpine sh -c "du -sh /data/* 2>/dev/null || echo 'No files found'"
}

# Common error handling
handle_error() {
    echo "❌ Error: $1" >&2
    exit 1
}

# Common success message
show_success() {
    echo "✅ $1"
}

# validate_mode will check if the deployment mode is valid
validate_mode() {
    local mode="$1"
    if [[ "$mode" != "dev" && "$mode" != "prod" && "$mode" != "both" ]]; then
        handle_error "Invalid mode '$mode'. Use 'dev', 'prod', or 'both'."
    fi
}

# print_deployment_urls will display available URLs based on mode
print_deployment_urls() {
    local mode="$1"
    echo ""
    echo "🌐 Available URLs:"
    if [[ "$mode" == "dev" || "$mode" == "both" ]]; then
        echo "  - Development: https://dev.velutina.ovh"
    fi
    if [[ "$mode" == "prod" || "$mode" == "both" ]]; then
        echo "  - Production: https://velutina.ovh"
    fi
    echo "  - Auth: https://auth.velutina.ovh"
    echo "  - API: https://api.velutina.ovh"
}

# confirm_deletion will ask for user confirmation before deleting a directory
confirm_deletion() {
    local target_dir="$1"
    local force="$2"
    
    if [ -d "$target_dir" ]; then
        if [ "$force" -eq 1 ]; then
            echo "Forcibly deleting $target_dir"
            sudo rm -rf "$target_dir"
        else
            read -p "Existing '$target_dir' directory. would you like to delete it? [y/N] " response
            if [[ "$response" == "y" || "$response" == "Y" ]]; then
                echo "Deleting $target_dir"
                sudo rm -rf "$target_dir"
            else
                echo "Cancelled"
                exit 1
            fi
        fi
    else
        echo "The directory '$target_dir' cannot be found."
    fi
}

# shutdown_all_services will stop all services across all profiles
shutdown_all_services() {
    local yaml_file="$1"
    local remove_volumes="$2"
    
    local volume_flag=""
    if [[ "$remove_volumes" == 1 ]]; then
        volume_flag="-v"
        echo "🗑️  Stopping with volume removal..."
    else
        echo "🛑 Stopping services..."
    fi
    
    # Stop all profiles
    docker compose ${yaml_file} --profile dev down ${volume_flag}
    docker compose ${yaml_file} --profile gencert down ${volume_flag}
    docker compose ${yaml_file} --profile build-frontend down ${volume_flag}
    docker compose ${yaml_file} down ${volume_flag}
}

# check_remaining_containers will verify if any containers are still running
check_remaining_containers() {
    local yaml_file="$1"
    
    echo "🔍 Checking remaining containers..."
    local remaining=$(docker compose ${yaml_file} ps -q)
    if [[ -n "$remaining" ]]; then
        echo "⚠️  Some containers are still running:"
        docker compose ${yaml_file} ps
        return 1
    else
        show_success "All services stopped successfully"
        return 0
    fi
}
