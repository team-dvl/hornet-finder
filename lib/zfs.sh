#!/usr/bin/env bash

#
# ZFS backend helpers for Hornet Finder.
#
# Only storage-init.sh and zfs-snapshot.sh source this file. Deployment
# scripts must never depend on it: ZFS is an optional backend behind the
# external Docker volumes, selected by ZFS_PARENT in .env.
#
# One dataset per managed Docker volume, named <ZFS_PARENT>/<volume name>.
# That name equality is the only link between the two worlds. Docker owns the
# directory layout under the dataset mountpoint (it creates its own _data
# subdirectory), so no filesystem path is ever derived here: existence checks
# go through `zfs list` and `docker volume inspect` only.
#
# Requires lib/common.sh (handle_error), lib/volumes.sh (managed_volumes) and
# a loaded .env.
#

# zfs_backend_configured returns 0 when this worktree declares a ZFS parent
zfs_backend_configured() {
    [[ -n "${ZFS_PARENT:-}" ]]
}

# require_zfs_backend aborts unless ZFS is configured and the tools are there
require_zfs_backend() {
    if ! zfs_backend_configured; then
        handle_error "ZFS_PARENT is not set in .env: this worktree does not use a ZFS backend"
    fi
    if ! command -v zfs >/dev/null 2>&1; then
        handle_error "ZFS_PARENT is set but the zfs command is not available"
    fi
}

# dataset_for_volume prints the dataset name backing a Docker volume
dataset_for_volume() {
    echo "${ZFS_PARENT}/$1"
}

# managed_datasets prints the dataset of every managed volume, one per line
managed_datasets() {
    local v
    while read -r v; do
        dataset_for_volume "$v"
    done < <(managed_volumes)
}

# dataset_exists returns 0 when the dataset (or snapshot) exists
dataset_exists() {
    zfs list "$1" >/dev/null 2>&1
}

# require_parent_dataset aborts when ZFS_PARENT itself is missing.
# The parent is never created automatically: it is host provisioning.
require_parent_dataset() {
    if ! dataset_exists "$ZFS_PARENT"; then
        handle_error "Parent ZFS dataset not present: $ZFS_PARENT
   Create it first, e.g.: sudo zfs create -p $ZFS_PARENT"
    fi
}

# require_datasets aborts when any managed dataset is missing
require_datasets() {
    local missing=() d
    while read -r d; do
        dataset_exists "$d" || missing+=("$d")
    done < <(managed_datasets)

    if (( ${#missing[@]} )); then
        handle_error "Missing ZFS dataset(s): ${missing[*]}
   Run ./storage-init.sh to provision them."
    fi
}

# create_datasets creates the managed datasets that do not exist yet.
# Reserved for storage-init.sh. Pass 1 as first argument for a dry run.
create_datasets() {
    local dry_run="${1:-0}" d
    while read -r d; do
        if dataset_exists "$d"; then
            echo "ZFS dataset already exists: $d"
        elif [[ "$dry_run" == 1 ]]; then
            echo "Would create ZFS dataset: $d"
        else
            echo "Creating ZFS dataset: $d"
            sudo zfs create "$d"
        fi
    done < <(managed_datasets)
}
