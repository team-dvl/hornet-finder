#!/usr/bin/env bash

#
# ZFS snapshot creation script for Hornet Finder
# Creates timestamped snapshots of Docker volumes
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

# Variables
FORCE=0
KEEP_DAYS=7
ACTION=""
ENVIRONMENT=""

# Help display
print_help() {
    echo "Usage: $0 ACTION [OPTIONS]"
    echo ""
    echo "Actions:"
    echo "  create|new          Create new timestamped snapshots"
    echo "  list|ls             List existing snapshots"
    echo "  clean|prune         Clean old snapshots"
    echo "  delete|rm|del SUFFIX...    Delete snapshots with specified suffixes"
    echo "  restore SUFFIX      Restore from a snapshot (⚠️ DANGEROUS)"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV       Environment: 'prod', 'dev', or 'both' (required)"
    echo "  -f, --force         Force action without confirmation"
    echo "  -k, --keep DAYS     Number of days to keep for clean/prune (default: 7)"
    echo "  --tag TAG           Custom tag for snapshot (instead of timestamp)"
    echo "  -h, --help          Display this help"
    echo ""
    echo "Description:"
    echo "  Manages timestamped ZFS snapshots of Hornet Finder Docker volumes."
    echo "  Supports separate PROD and DEV environments."
    echo "  Name format: volume@YYMMDD-HHMMSS or volume@TAG"
    echo ""
    echo "Examples:"
    echo "  $0 create                           # PROD + DEV snapshots"
    echo "  $0 create -e prod                   # PROD snapshots only"
    echo "  $0 create -e dev                    # DEV snapshots only"
    echo "  $0 create --tag pre-deploy          # Snapshot with custom tag"
    echo "  $0 list -e prod                     # List PROD snapshots"
    echo "  $0 clean -e dev -k 3                # Clean DEV (3 days)"
    echo "  $0 delete 250806-082324             # Delete snapshots with this suffix"
    echo "  $0 restore pre-deploy-20250807      # ⚠️ Restore from snapshot"
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
ACTION=""
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
set -- "${TEMP_ARGS[@]}"

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
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
            shift 2
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            print_help
            exit 1
            ;;
        *)
            # For delete action, remaining arguments are suffixes
            if [[ "$ACTION" == "delete" || "$ACTION" == "rm" || "$ACTION" == "del" ]]; then
                break
            elif [[ "$ACTION" == "restore" ]]; then
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

# Validate action
case "$ACTION" in
    create|new|list|ls|clean|prune|delete|rm|del)
        ;;
    *)
        echo "Unknown action: $ACTION" >&2
        print_help
        exit 1
        ;;
esac

# Check that environment is specified
if [[ -z "$ENVIRONMENT" ]]; then
    echo "❌ Environment required (-e prod|dev|both)" >&2
    print_help
    exit 1
fi

# Environment validation
if [[ "$ENVIRONMENT" != "prod" && "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "both" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT (must be 'prod', 'dev', or 'both')" >&2
    print_help
    exit 1
fi

# Check that ZFS is available
if ! command -v zfs >/dev/null 2>&1; then
    handle_error "ZFS is not installed or available"
fi

# Check that ZFS is used
if ! is_zfs_used "$SCRIPT_DIR"; then
    handle_error "ZFS is not used in this project"
fi

# Get datasets to backup based on environment
get_datasets_for_environment() {
    local env="$1"
    case "$env" in
        "prod")
            echo "ZROOT/docker/volumes/hornet-finder-api-db"
            echo "ZROOT/docker/volumes/hornet-finder-keycloak-db"
            echo "ZROOT/docker/volumes/hornet-finder-frontend-dist"
            ;;
        "dev")
            echo "ZROOT/docker/volumes/hornet-finder-dev-api-db"
            echo "ZROOT/docker/volumes/hornet-finder-dev-keycloak-db"
            ;;
        "both")
            echo "ZROOT/docker/volumes/hornet-finder-api-db"
            echo "ZROOT/docker/volumes/hornet-finder-keycloak-db"
            echo "ZROOT/docker/volumes/hornet-finder-frontend-dist"
            echo "ZROOT/docker/volumes/hornet-finder-dev-api-db"
            echo "ZROOT/docker/volumes/hornet-finder-dev-keycloak-db"
            ;;
    esac
}

# Build datasets array
readarray -t DATASETS < <(get_datasets_for_environment "$ENVIRONMENT")

# Generate YYMMDD-HHMMSS timestamp
TIMESTAMP=$(date +%y%m%d-%H%M%S)

# Function to list snapshots
list_snapshots() {
    echo "📋 Existing snapshots:"
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo ""
            echo "Dataset: $dataset"
            # Format dates as DD/MM/YY HH:MM:SS
            zfs list -t snapshot -H -o name,creation,used -s creation "$dataset" 2>/dev/null | while IFS=$'\t' read -r name creation used; do
                if [[ -n "$name" && "$name" == *"@"* ]]; then
                    # Convert date to desired format
                    formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
                    printf "  %-50s %s %s\n" "$name" "$formatted_date" "$used"
                fi
            done
            
            # Check if snapshots were found
            snapshot_count=$(zfs list -t snapshot -H -o name "$dataset" 2>/dev/null | grep "@" | wc -l)
            if [[ "$snapshot_count" -eq 0 ]]; then
                echo "  No snapshots found"
            fi
        else
            echo "  ⚠️  Dataset $dataset not found"
        fi
    done
}

# Function to clean old snapshots
cleanup_old_snapshots() {
    echo "🧹 Cleaning snapshots older than $KEEP_DAYS days..."
    cutoff_date=$(date -d "$KEEP_DAYS days ago" +%s)
    
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo "Checking $dataset..."
            
            # Get list of snapshots with their creation date
            zfs list -t snapshot -H -o name,creation "$dataset" 2>/dev/null | while IFS=$'\t' read -r snapshot_name creation_date; do
                if [[ "$snapshot_name" == *"@"* ]]; then
                    # Convert creation date to timestamp
                    snapshot_timestamp=$(date -d "$creation_date" +%s 2>/dev/null)
                    
                    if [[ $? -eq 0 && $snapshot_timestamp -lt $cutoff_date ]]; then
                        # Display formatted date for user
                        formatted_date=$(date -d "$creation_date" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation_date")
                        echo "  🗑️  Deleting old snapshot: $snapshot_name (created on $formatted_date)"
                        if [[ "$FORCE" == 1 ]]; then
                            sudo zfs destroy "$snapshot_name"
                        else
                            read -p "Delete $snapshot_name? [y/N] " response
                            if [[ "$response" == "y" || "$response" == "Y" ]]; then
                                sudo zfs destroy "$snapshot_name"
                            fi
                        fi
                    fi
                fi
            done
        fi
    done
}

# Function to create snapshots
create_snapshots() {
    echo "📸 Creating ZFS snapshots with timestamp: $TIMESTAMP"
    
    for dataset in "${DATASETS[@]}"; do
        snapshot_name="${dataset}@${TIMESTAMP}"
        
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo "Creating snapshot: $snapshot_name"
            if sudo zfs snapshot "$snapshot_name"; then
                echo "  ✅ Snapshot created successfully"
            else
                echo "  ❌ Failed to create snapshot"
            fi
        else
            echo "  ⚠️  Dataset $dataset not found, skipping"
        fi
    done
}

# Function to delete snapshots by suffix
delete_snapshots() {
    local suffixes=("$@")
    
    if [[ ${#suffixes[@]} -eq 0 ]]; then
        handle_error "No suffix specified for deletion"
    fi
    
    echo "🗑️  Deleting snapshots with suffixes: ${suffixes[*]}"
    
    local found_snapshots=()
    
    # Search for all matching snapshots
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            for suffix in "${suffixes[@]}"; do
                # Search for snapshots matching the pattern
                while IFS= read -r snapshot_name; do
                    if [[ -n "$snapshot_name" ]]; then
                        found_snapshots+=("$snapshot_name")
                    fi
                done < <(zfs list -t snapshot -H -o name "$dataset" 2>/dev/null | grep "@.*${suffix}")
            done
        fi
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
        # Get snapshot information
        snapshot_info=$(zfs list -H -o name,creation,used "$snapshot" 2>/dev/null)
        if [[ -n "$snapshot_info" ]]; then
            IFS=$'\t' read -r name creation used <<< "$snapshot_info"
            formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
            printf "  🗑️  %-50s %s %s\n" "$name" "$formatted_date" "$used"
        fi
    done
    
    # Ask for confirmation
    if [[ "$FORCE" != 1 ]]; then
        echo ""
        read -p "Confirm deletion of ${#found_snapshots[@]} snapshot(s)? [y/N] " response
        if [[ "$response" != "y" && "$response" != "Y" ]]; then
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
            echo "  ✅ Successfully deleted"
            ((success_count++))
        else
            echo "  ❌ Failed to delete"
        fi
    done
    
    echo ""
    show_success "$success_count snapshot(s) deleted out of ${#found_snapshots[@]}"
}

cd "$SCRIPT_DIR"

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
        # Remaining arguments are suffixes to delete
        delete_snapshots "$@"
        ;;
    "create"|"new")
        # Confirmation before creation
        if [[ "$FORCE" != 1 ]]; then
            echo "📸 Creating ZFS snapshots for Hornet Finder"
            echo "Timestamp: $TIMESTAMP"
            echo ""
            echo "Datasets to backup:"
            for dataset in "${DATASETS[@]}"; do
                echo "  - $dataset"
            done
            echo ""
            read -p "Continue with snapshot creation? [y/N] " response
            if [[ "$response" != "y" && "$response" != "Y" ]]; then
                echo "Creation cancelled"
                exit 0
            fi
        fi

        # Create snapshots
        create_snapshots

        echo ""
        show_success "Snapshots created with timestamp: $TIMESTAMP"

        # Display created snapshots
        echo ""
        echo "📋 Created snapshots:"
        for dataset in "${DATASETS[@]}"; do
            snapshot_name="${dataset}@${TIMESTAMP}"
            if zfs list "$snapshot_name" >/dev/null 2>&1; then
                echo "  ✅ $snapshot_name"
                # Display with custom date format
                zfs list -H -o name,used,creation "$snapshot_name" | while IFS=$'\t' read -r name used creation; do
                    formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
                    printf "     Size: %s, Created on: %s\n" "$used" "$formatted_date"
                done
            fi
        done
        ;;
esac
