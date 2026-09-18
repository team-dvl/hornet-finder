#!/usr/bin/env bash
set -euo pipefail

#
# ZFS snapshot management for Hornet Finder
# Creates, lists, prunes, deletes and restores snapshots of the datasets
# backing the external Docker volumes of this worktree (see .env: ZFS_PARENT
# and the *_VOLUME variables).
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
source "$SCRIPT_DIR/lib/zfs.sh"

# Variables
FORCE=0
KEEP_DAYS=7
ACTION=""
CUSTOM_TAG=""
RESTORE_SUFFIX=""
DELETE_SUFFIXES=()

# Help display
print_help() {
    echo "Usage: $0 ACTION [OPTIONS]"
    echo ""
    echo "Actions:"
    echo "  create|new          Create new timestamped snapshots"
    echo "  list|ls             List existing snapshots"
    echo "  clean|prune         Clean old snapshots"
    echo "  delete|rm|del SUFFIX...    Delete snapshots with specified suffixes"
    echo "  restore SUFFIX      Roll every dataset back to the snapshot with this exact suffix"
    echo "                      (WARNING: DANGEROUS, the stack must be stopped first)"
    echo ""
    echo "Options:"
    echo "  -f, --force         create/clean/delete: skip confirmation"
    echo "                      restore: also destroy snapshots newer than the target (zfs rollback -r)"
    echo "  -k, --keep DAYS     Number of days to keep for clean/prune (default: 7)"
    echo "  --tag TAG           Append a custom tag to the snapshot timestamp"
    echo "  -h, --help          Display this help"
    echo ""
    echo "Description:"
    echo "  Manages timestamped ZFS snapshots of Hornet Finder Docker volumes."
    echo "  Datasets are <ZFS_PARENT>/<volume> for each *_VOLUME declared in .env."
    echo "  Name format: dataset@YYMMDD-HHMMSS or dataset@YYMMDD-HHMMSS-TAG"
    echo ""
    echo "Examples:"
    echo "  $0 create                           # Snapshot the environment in .env"
    echo "  $0 create --tag pre-deploy          # Snapshot as dataset@YYMMDD-HHMMSS-pre-deploy"
    echo "  $0 list                             # List snapshots for this worktree"
    echo "  $0 clean -k 3                       # Clean snapshots older than 3 days"
    echo "  $0 delete 250806-082324             # Delete snapshots with this suffix"
    echo "  $0 restore 250806-082324-pre-deploy # ⚠️ Roll back to this snapshot"
}

# First check if help is requested
for arg in "$@"; do
    if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
        print_help
        exit 0
    fi
done

# Check that an action is provided
if [[ $# -eq 0 ]]; then
    echo "Error: Missing action" >&2
    print_help
    exit 1
fi

# Parse all arguments first to find action and options
TEMP_ARGS=()

# First pass: collect all arguments and identify action
while [[ $# -gt 0 ]]; do
    case $1 in
        create|new|list|ls|clean|prune|delete|rm|del|restore)
            if [[ -z "$ACTION" ]]; then
                ACTION="$1"
                shift
            else
                echo "Error: Multiple actions specified" >&2
                print_help
                exit 1
            fi
            ;;
        *)
            TEMP_ARGS+=("$1")
            shift
            ;;
    esac
done

# Check that we found an action
if [[ -z "$ACTION" ]]; then
    echo "Error: No action specified" >&2
    print_help
    exit 1
fi

# Restore arguments for option parsing
set -- "${TEMP_ARGS[@]+"${TEMP_ARGS[@]}"}"

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=1
            shift
            ;;
        -k|--keep)
            KEEP_DAYS="$2"
            if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
                handle_error "The value for --keep must be an integer"
            fi
            shift 2
            ;;
        --tag)
            CUSTOM_TAG="$2"
            if ! [[ "$CUSTOM_TAG" =~ ^[A-Za-z0-9_.-]+$ ]]; then
                handle_error "The value for --tag may only contain letters, digits, '_', '.' and '-'"
            fi
            shift 2
            ;;
        -*)
            echo "Unknown option: $1" >&2
            print_help
            exit 1
            ;;
        *)
            # Positional arguments: suffixes for delete, the target for restore
            if [[ "$ACTION" == "delete" || "$ACTION" == "rm" || "$ACTION" == "del" ]]; then
                DELETE_SUFFIXES+=("$1")
                shift
            elif [[ "$ACTION" == "restore" && -z "$RESTORE_SUFFIX" ]]; then
                RESTORE_SUFFIX="$1"
                shift
            else
                echo "Unexpected argument: $1" >&2
                print_help
                exit 1
            fi
            ;;
    esac
done

if [[ "$ACTION" == "restore" && -z "$RESTORE_SUFFIX" ]]; then
    handle_error "restore requires a snapshot suffix"
fi

cd "$SCRIPT_DIR"
load_env
ENVIRONMENT=$(get_configured_environment)

# Fail-safe: the backend must be configured and every dataset must exist
# before any action runs, so nothing is ever done partially.
require_zfs_backend
require_datasets

# Build datasets array
readarray -t DATASETS < <(managed_datasets)

# Generate YYMMDD-HHMMSS timestamp, with the optional tag appended
TIMESTAMP="$(date +%y%m%d-%H%M%S)${CUSTOM_TAG:+-${CUSTOM_TAG}}"

# confirm prompts for a yes/no answer on the terminal. Without a terminal
# (cron, CI, piped input) it fails safe: no answer means no.
confirm() {
    local prompt="$1" response
    if [[ ! -t 0 ]]; then
        echo "❌ No terminal to confirm on: re-run interactively or use --force" >&2
        return 1
    fi
    read -r -p "$prompt [y/N] " response
    [[ "$response" == "y" || "$response" == "Y" ]]
}

# format_creation renders a zfs creation date as DD/MM/YY HH:MM:SS
format_creation() {
    date -d "$1" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$1"
}

# Function to list snapshots
list_snapshots() {
    echo "[LIST] Existing snapshots:"
    for dataset in "${DATASETS[@]}"; do
        echo ""
        echo "Dataset: $dataset"
        local count=0
        while IFS=$'\t' read -r name creation used; do
            [[ -n "$name" ]] || continue
            printf "  %-50s %s %s\n" "$name" "$(format_creation "$creation")" "$used"
            ((count++)) || true
        done < <(zfs list -t snapshot -H -o name,creation,used -s creation "$dataset" 2>/dev/null || true)

        if [[ "$count" -eq 0 ]]; then
            echo "  No snapshots found"
        fi
    done
}

# Function to clean old snapshots
cleanup_old_snapshots() {
    echo "[CLEAN] Cleaning snapshots older than $KEEP_DAYS days..."
    local cutoff_date
    cutoff_date=$(date -d "$KEEP_DAYS days ago" +%s)

    for dataset in "${DATASETS[@]}"; do
        echo "Checking $dataset..."

        while IFS=$'\t' read -r snapshot_name creation_date; do
            [[ -n "$snapshot_name" ]] || continue
            local snapshot_timestamp
            snapshot_timestamp=$(date -d "$creation_date" +%s 2>/dev/null) || continue
            if (( snapshot_timestamp < cutoff_date )); then
                echo "  [DELETE] Deleting old snapshot: $snapshot_name (created on $(format_creation "$creation_date"))"
                if [[ "$FORCE" == 1 ]]; then
                    sudo zfs destroy "$snapshot_name"
                else
                    if confirm "Delete $snapshot_name?" </dev/tty; then
                        sudo zfs destroy "$snapshot_name"
                    fi
                fi
            fi
        done < <(zfs list -t snapshot -H -o name,creation "$dataset" 2>/dev/null || true)
    done
}

# Function to create snapshots
create_snapshots() {
    echo "[CREATE] Creating ZFS snapshots with suffix: $TIMESTAMP"

    for dataset in "${DATASETS[@]}"; do
        local snapshot_name="${dataset}@${TIMESTAMP}"
        echo "Creating snapshot: $snapshot_name"
        if sudo zfs snapshot "$snapshot_name"; then
            echo "  [SUCCESS] Snapshot created successfully"
        else
            echo "  [ERROR] Failed to create snapshot"
        fi
    done
}

# Function to delete snapshots by suffix
delete_snapshots() {
    local suffixes=("$@")

    if [[ ${#suffixes[@]} -eq 0 ]]; then
        handle_error "No suffix specified for deletion"
    fi

    echo "[DELETE] Deleting snapshots with suffixes: ${suffixes[*]}"

    local found_snapshots=()

    # Search for all matching snapshots
    for dataset in "${DATASETS[@]}"; do
        for suffix in "${suffixes[@]}"; do
            while IFS= read -r snapshot_name; do
                [[ -n "$snapshot_name" ]] && found_snapshots+=("$snapshot_name")
            done < <(zfs list -t snapshot -H -o name "$dataset" 2>/dev/null | grep "@.*${suffix}" || true)
        done
    done

    # Check if we found snapshots
    if [[ ${#found_snapshots[@]} -eq 0 ]]; then
        echo "No snapshots found with the specified suffixes"
        return 0
    fi

    # Display found snapshots
    echo ""
    echo "Snapshots found to delete:"
    for snapshot in "${found_snapshots[@]}"; do
        local snapshot_info
        snapshot_info=$(zfs list -H -o name,creation,used "$snapshot" 2>/dev/null || true)
        if [[ -n "$snapshot_info" ]]; then
            IFS=$'\t' read -r name creation used <<< "$snapshot_info"
            printf "  [DELETE] %-50s %s %s\n" "$name" "$(format_creation "$creation")" "$used"
        fi
    done

    # Ask for confirmation
    if [[ "$FORCE" != 1 ]]; then
        echo ""
        if ! confirm "Confirm deletion of ${#found_snapshots[@]} snapshot(s)?"; then
            echo "Deletion cancelled"
            return 0
        fi
    fi

    # Delete snapshots
    echo ""
    local success_count=0
    for snapshot in "${found_snapshots[@]}"; do
        echo "Deleting $snapshot..."
        if sudo zfs destroy "$snapshot"; then
            echo "  [SUCCESS] Successfully deleted"
            ((success_count++)) || true
        else
            echo "  [ERROR] Failed to delete"
        fi
    done

    echo ""
    show_success "$success_count snapshot(s) deleted out of ${#found_snapshots[@]}"
}

# Function to roll every dataset back to the snapshot with the given suffix.
# Fail-safe: all targets are verified and the stack must be stopped before
# anything is touched. Without --force, zfs rollback refuses to discard
# snapshots newer than the target, which is the safe default.
restore_snapshots() {
    local suffix="$1"
    local targets=() missing=() dataset

    echo "[RESTORE] Restoring snapshots with suffix: $suffix"

    for dataset in "${DATASETS[@]}"; do
        local snapshot_name="${dataset}@${suffix}"
        if dataset_exists "$snapshot_name"; then
            targets+=("$snapshot_name")
        else
            missing+=("$snapshot_name")
        fi
    done

    if (( ${#missing[@]} )); then
        handle_error "Snapshot(s) not found, nothing restored: ${missing[*]}
   The suffix must match exactly; use '$0 list' to find it."
    fi

    local running
    running=$(docker compose ps -q 2>/dev/null || true)
    if [[ -n "$running" ]]; then
        handle_error "The $ENVIRONMENT stack is still running, nothing restored.
   Stop it first with ./shutdown.sh"
    fi

    local rollback_flags=()
    echo ""
    echo "Datasets will be rolled back to:"
    for snapshot in "${targets[@]}"; do
        echo "  - $snapshot"
    done
    echo ""
    if [[ "$FORCE" == 1 ]]; then
        rollback_flags+=(-r)
        echo "⚠️  --force: snapshots newer than the target will be DESTROYED (zfs rollback -r)"
    else
        echo "Rollback will refuse datasets that have snapshots newer than the target."
        echo "Use --force to destroy them, or delete them first."
    fi
    echo "⚠️  All data written to these volumes after the snapshot will be LOST."
    echo ""
    if [[ ! -t 0 ]]; then
        handle_error "restore needs an interactive terminal to confirm, nothing restored"
    fi
    read -r -p "Type the suffix '$suffix' to confirm: " response
    if [[ "$response" != "$suffix" ]]; then
        echo "Restore cancelled"
        exit 0
    fi

    echo ""
    for snapshot in "${targets[@]}"; do
        echo "Rolling back $snapshot..."
        sudo zfs rollback "${rollback_flags[@]+"${rollback_flags[@]}"}" "$snapshot"
        echo "  [SUCCESS] Rolled back"
    done

    echo ""
    show_success "Restored ${#targets[@]} dataset(s) to suffix $suffix"
}

# Execute requested action
case "$ACTION" in
    "list"|"ls")
        list_snapshots
        ;;
    "clean"|"prune")
        cleanup_old_snapshots
        show_success "Cleanup completed"
        ;;
    "delete"|"rm"|"del")
        delete_snapshots "${DELETE_SUFFIXES[@]+"${DELETE_SUFFIXES[@]}"}"
        ;;
    "restore")
        restore_snapshots "$RESTORE_SUFFIX"
        ;;
    "create"|"new")
        # Confirmation before creation
        if [[ "$FORCE" != 1 ]]; then
            echo "[CREATE] Creating ZFS snapshots for Hornet Finder ($ENVIRONMENT)"
            echo "Suffix: $TIMESTAMP"
            echo ""
            echo "Datasets to backup:"
            for dataset in "${DATASETS[@]}"; do
                echo "  - $dataset"
            done
            echo ""
            if ! confirm "Continue with snapshot creation?"; then
                echo "Creation cancelled"
                exit 0
            fi
        fi

        # Create snapshots
        create_snapshots

        echo ""
        show_success "Snapshots created with suffix: $TIMESTAMP"

        # Display created snapshots
        echo ""
        echo "[LIST] Created snapshots:"
        for dataset in "${DATASETS[@]}"; do
            snapshot_name="${dataset}@${TIMESTAMP}"
            if dataset_exists "$snapshot_name"; then
                echo "  [SUCCESS] $snapshot_name"
                zfs list -H -o name,used,creation "$snapshot_name" | while IFS=$'\t' read -r name used creation; do
                    printf "     Size: %s, Created on: %s\n" "$used" "$(format_creation "$creation")"
                done
            fi
        done
        ;;
esac
