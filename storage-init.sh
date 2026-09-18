#!/usr/bin/env bash
set -euo pipefail

#
# Storage provisioning for Hornet Finder.
#
# This is the only script allowed to create storage resources. It provisions
# the external Docker volumes declared in .env (API_DB_VOLUME, ...), and when
# ZFS_PARENT is set, the ZFS dataset backing each of them first.
#
# Order matters on a ZFS host: the dataset must exist and be mounted before
# Docker creates the volume, otherwise Docker writes into a plain directory on
# the parent dataset. Run this once per worktree before the first deploy.
#
# Existing resources are left untouched. The ZFS parent dataset is never
# created here: that is host provisioning, done by hand.
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

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/volumes.sh"
source "$SCRIPT_DIR/lib/zfs.sh"

DRY_RUN=0

print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Provision the external Docker volumes of the environment declared in .env,"
    echo "and their ZFS datasets first when ZFS_PARENT is set."
    echo ""
    echo "Options:"
    echo "  -n, --dry-run       Show what would be created, create nothing"
    echo "  -h, --help          Display this help"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--dry-run)
            DRY_RUN=1
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

echo "[STORAGE] Provisioning storage for environment: $MODE"

if [[ -z "$(managed_volumes)" ]]; then
    handle_error "No volume declared in .env (API_DB_VOLUME, KEYCLOAK_DB_VOLUME, FRONTEND_DIST_VOLUME are all empty)"
fi

if zfs_backend_configured; then
    require_zfs_backend
    require_parent_dataset
    echo "[ZFS] Datasets under $ZFS_PARENT:"
    create_datasets "$DRY_RUN"
else
    echo "[ZFS] ZFS_PARENT not set: using plain local Docker volumes"
fi

echo "[DOCKER] Volumes:"
create_docker_volumes "$DRY_RUN"

if [[ "$DRY_RUN" == 1 ]]; then
    show_success "Dry run completed, nothing was created"
else
    show_success "Storage provisioned for $MODE"
fi
