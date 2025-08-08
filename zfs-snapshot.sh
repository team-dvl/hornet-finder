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

# Datasets to backup
DATASETS=(
    "ZROOT/docker/volumes/hornet-finder-api-db"
    "ZROOT/docker/volumes/hornet-finder-keycloak-db"
    "ZROOT/docker/volumes/hornet-finder-frontend-dist"
)

# Generate YYMMDD-HHMMSS timestamp
TIMESTAMP=$(date +%y%m%d-%H%M%S)

# Function to list snapshots
list_snapshots() {
    echo "📋 Snapshots existants:"
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo ""
            echo "Dataset: $dataset"
            # Format des dates en DD/MM/YY HH:MM:SS
            zfs list -t snapshot -H -o name,creation,used -s creation "$dataset" 2>/dev/null | while IFS=$'\t' read -r name creation used; do
                if [[ -n "$name" && "$name" == *"@"* ]]; then
                    # Convertir la date au format souhaité
                    formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
                    printf "  %-50s %s %s\n" "$name" "$formatted_date" "$used"
                fi
            done
            
            # Vérifier si des snapshots ont été trouvés
            snapshot_count=$(zfs list -t snapshot -H -o name "$dataset" 2>/dev/null | grep "@" | wc -l)
            if [[ "$snapshot_count" -eq 0 ]]; then
                echo "  Aucun snapshot trouvé"
            fi
        else
            echo "  ⚠️  Dataset $dataset non trouvé"
        fi
    done
}

# Fonction pour nettoyer les anciens snapshots
cleanup_old_snapshots() {
    echo "🧹 Nettoyage des snapshots de plus de $KEEP_DAYS jours..."
    cutoff_date=$(date -d "$KEEP_DAYS days ago" +%s)
    
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo "Vérification de $dataset..."
            
            # Obtenir la liste des snapshots avec leur date de création
            zfs list -t snapshot -H -o name,creation "$dataset" 2>/dev/null | while IFS=$'\t' read -r snapshot_name creation_date; do
                if [[ "$snapshot_name" == *"@"* ]]; then
                    # Convertir la date de création en timestamp
                    snapshot_timestamp=$(date -d "$creation_date" +%s 2>/dev/null)
                    
                    if [[ $? -eq 0 && $snapshot_timestamp -lt $cutoff_date ]]; then
                        # Afficher la date formatée pour l'utilisateur
                        formatted_date=$(date -d "$creation_date" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation_date")
                        echo "  🗑️  Suppression du snapshot ancien: $snapshot_name (créé le $formatted_date)"
                        if [[ "$FORCE" == 1 ]]; then
                            sudo zfs destroy "$snapshot_name"
                        else
                            read -p "Supprimer $snapshot_name ? [y/N] " response
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

# Fonction pour créer les snapshots
create_snapshots() {
    echo "📸 Création des snapshots ZFS avec timestamp: $TIMESTAMP"
    
    for dataset in "${DATASETS[@]}"; do
        snapshot_name="${dataset}@${TIMESTAMP}"
        
        if zfs list "$dataset" >/dev/null 2>&1; then
            echo "Création du snapshot: $snapshot_name"
            if sudo zfs snapshot "$snapshot_name"; then
                echo "  ✅ Snapshot créé avec succès"
            else
                echo "  ❌ Échec de la création du snapshot"
            fi
        else
            echo "  ⚠️  Dataset $dataset non trouvé, ignoré"
        fi
    done
}

# Fonction pour supprimer des snapshots par suffixe
delete_snapshots() {
    local suffixes=("$@")
    
    if [[ ${#suffixes[@]} -eq 0 ]]; then
        handle_error "Aucun suffixe spécifié pour la suppression"
    fi
    
    echo "🗑️  Suppression des snapshots avec les suffixes: ${suffixes[*]}"
    
    local found_snapshots=()
    
    # Rechercher tous les snapshots correspondants
    for dataset in "${DATASETS[@]}"; do
        if zfs list "$dataset" >/dev/null 2>&1; then
            for suffix in "${suffixes[@]}"; do
                # Rechercher les snapshots qui correspondent au pattern
                while IFS= read -r snapshot_name; do
                    if [[ -n "$snapshot_name" ]]; then
                        found_snapshots+=("$snapshot_name")
                    fi
                done < <(zfs list -t snapshot -H -o name "$dataset" 2>/dev/null | grep "@.*${suffix}")
            done
        fi
    done
    
    # Vérifier qu'on a trouvé des snapshots
    if [[ ${#found_snapshots[@]} -eq 0 ]]; then
        echo "Aucun snapshot trouvé avec les suffixes spécifiés"
        return 0
    fi
    
    # Afficher les snapshots trouvés
    echo ""
    echo "Snapshots trouvés à supprimer:"
    for snapshot in "${found_snapshots[@]}"; do
        # Obtenir les informations du snapshot
        snapshot_info=$(zfs list -H -o name,creation,used "$snapshot" 2>/dev/null)
        if [[ -n "$snapshot_info" ]]; then
            IFS=$'\t' read -r name creation used <<< "$snapshot_info"
            formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
            printf "  🗑️  %-50s %s %s\n" "$name" "$formatted_date" "$used"
        fi
    done
    
    # Demander confirmation
    if [[ "$FORCE" != 1 ]]; then
        echo ""
        read -p "Confirmer la suppression de ${#found_snapshots[@]} snapshot(s) ? [y/N] " response
        if [[ "$response" != "y" && "$response" != "Y" ]]; then
            echo "Suppression annulée"
            return 0
        fi
    fi
    
    # Supprimer les snapshots
    echo ""
    local success_count=0
    for snapshot in "${found_snapshots[@]}"; do
        echo "Suppression de $snapshot..."
        if sudo zfs destroy "$snapshot"; then
            echo "  ✅ Supprimé avec succès"
            ((success_count++))
        else
            echo "  ❌ Échec de la suppression"
        fi
    done
    
    echo ""
    show_success "$success_count snapshot(s) supprimé(s) sur ${#found_snapshots[@]}"
}

cd "$SCRIPT_DIR"

# Exécuter l'action demandée
case "$ACTION" in
    "list"|"ls")
        list_snapshots
        ;;
    "clean"|"prune")
        cleanup_old_snapshots
        show_success "Nettoyage terminé"
        ;;
    "delete"|"rm"|"del")
        # Les arguments restants sont les suffixes à supprimer
        delete_snapshots "$@"
        ;;
    "create"|"new")
        # Confirmation avant création
        if [[ "$FORCE" != 1 ]]; then
            echo "📸 Création de snapshots ZFS pour Hornet Finder"
            echo "Timestamp: $TIMESTAMP"
            echo ""
            echo "Datasets à sauvegarder:"
            for dataset in "${DATASETS[@]}"; do
                echo "  - $dataset"
            done
            echo ""
            read -p "Continuer avec la création des snapshots ? [y/N] " response
            if [[ "$response" != "y" && "$response" != "Y" ]]; then
                echo "Création annulée"
                exit 0
            fi
        fi

        # Créer les snapshots
        create_snapshots

        echo ""
        show_success "Snapshots créés avec le timestamp: $TIMESTAMP"

        # Afficher les snapshots créés
        echo ""
        echo "📋 Snapshots créés:"
        for dataset in "${DATASETS[@]}"; do
            snapshot_name="${dataset}@${TIMESTAMP}"
            if zfs list "$snapshot_name" >/dev/null 2>&1; then
                echo "  ✅ $snapshot_name"
                # Afficher avec format de date personnalisé
                zfs list -H -o name,used,creation "$snapshot_name" | while IFS=$'\t' read -r name used creation; do
                    formatted_date=$(date -d "$creation" "+%d/%m/%y %H:%M:%S" 2>/dev/null || echo "$creation")
                    printf "     Taille: %s, Créé le: %s\n" "$used" "$formatted_date"
                done
            fi
        done
        ;;
esac
