#!/usr/bin/env bash
set -euo pipefail

#
# Test script to validate the shared libraries against the worktree .env.
# Read-only: nothing is created.
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

# The libraries expect SCRIPT_DIR to be the worktree root
SCRIPT_DIR="$(cd "$(get_script_dir)/.." && pwd)"

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/volumes.sh"
source "$SCRIPT_DIR/lib/zfs.sh"

echo "🧪 Testing libraries against $SCRIPT_DIR/.env"

load_env
MODE=$(get_configured_environment)
echo "✓ get_configured_environment: $MODE"

echo "✓ COMPOSE_FILE: ${COMPOSE_FILE:-<unset>}"

echo "✓ resolve_service_name:"
for alias in api db keycloak-db nginx unknown-service; do
    echo "  $alias -> $(resolve_service_name "$alias" "$MODE")"
done

echo "✓ managed_volumes:"
while read -r v; do
    if docker_volume_exists "$v"; then
        echo "  $v (exists)"
    else
        echo "  $v (MISSING)"
    fi
done < <(managed_volumes)

if zfs_backend_configured; then
    echo "✓ ZFS backend: $ZFS_PARENT"
    while read -r d; do
        if dataset_exists "$d"; then
            echo "  $d (exists)"
        else
            echo "  $d (MISSING)"
        fi
    done < <(managed_datasets)
else
    echo "✓ ZFS backend: not configured"
fi

show_success "All tests pass"
