#!/usr/bin/env bash

#
# Docker volume helpers for Hornet Finder.
#
# The external volumes used by the stack are declared once in .env
# (API_DB_VOLUME, KEYCLOAK_DB_VOLUME, FRONTEND_DIST_VOLUME, MEDIA_VOLUME) and
# referenced by name from the docker-compose.*.external-volumes.yml overlay.
# This file is the only place scripts get that list from.
#
# Deployment scripts only ever *verify* that volumes exist. Creating them is
# provisioning, and belongs to storage-init.sh alone. Nothing here knows about
# the storage backend (ZFS or otherwise).
#
# Requires lib/common.sh (handle_error) and a loaded .env.
#

# managed_volumes prints the external volume names of this environment, one
# per line. Empty variables are skipped, which is how dev (no frontend-dist)
# and prod naturally differ.
managed_volumes() {
    local v
    for v in "${API_DB_VOLUME:-}" "${KEYCLOAK_DB_VOLUME:-}" "${FRONTEND_DIST_VOLUME:-}" \
              "${MEDIA_VOLUME:-}"; do
        [[ -n "$v" ]] && echo "$v"
    done
    return 0
}

# docker_volume_exists returns 0 when the named Docker volume exists
docker_volume_exists() {
    docker volume inspect "$1" >/dev/null 2>&1
}

# require_docker_volumes aborts when any managed volume is missing.
# It never creates anything: run storage-init.sh for that.
require_docker_volumes() {
    local missing=() v
    while read -r v; do
        docker_volume_exists "$v" || missing+=("$v")
    done < <(managed_volumes)

    if (( ${#missing[@]} )); then
        handle_error "Missing Docker volume(s): ${missing[*]}
   Run ./storage-init.sh to provision them."
    fi
}

# create_docker_volumes creates the managed volumes that do not exist yet.
# Reserved for storage-init.sh. Pass 1 as first argument for a dry run.
create_docker_volumes() {
    local dry_run="${1:-0}" v
    while read -r v; do
        if docker_volume_exists "$v"; then
            echo "Docker volume already exists: $v"
        elif [[ "$dry_run" == 1 ]]; then
            echo "Would create Docker volume: $v"
        else
            echo "Creating Docker volume: $v"
            docker volume create "$v" >/dev/null
        fi
    done < <(managed_volumes)
}
