#!/usr/bin/env bash

#
# Script de création de snapshots ZFS pour Hornet Finder
# Crée des snapshots horodatés des volumes Docker
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

# Affichage de l'aide
print_help() {
    echo "Usage: $0 ACTION [OPTIONS]"
    echo ""
    echo "Actions:"
    echo "  create|new          Crée de nouveaux snapshots horodatés"
    echo "  list|ls             Liste les snapshots existants"
    echo "  clean|prune         Nettoie les snapshots anciens"
    echo "  delete|rm|del SUFFIX...    Supprime les snapshots avec les suffixes spécifiés"
    echo ""
    echo "Options:"
    echo "  -f, --force         Force l'action sans confirmation"
    echo "  -k, --keep DAYS     Nombre de jours à conserver pour clean/prune (défaut: 7)"
    echo "  -h, --help          Affiche cette aide"
    echo ""
    echo "Description:"
    echo "  Gère les snapshots ZFS horodatés des volumes Docker de Hornet Finder."
    echo "  Format du nom: volume@YYMMDD-HHMMSS"
    echo ""
    echo "Exemples:"
    echo "  $0 create                    # Crée de nouveaux snapshots"
    echo "  $0 new                       # Alias pour create"
    echo "  $0 list                      # Liste tous les snapshots"
    echo "  $0 ls                        # Alias pour list"
    echo "  $0 clean -k 3                # Nettoie les snapshots de plus de 3 jours"
    echo "  $0 delete 250806-082324      # Supprime tous les snapshots avec ce suffixe"
    echo "  $0 rm 250806-082324          # Alias pour delete"
    echo "  $0 del 250806-* 250805-*     # Supprime plusieurs patterns de suffixes"
}

# Vérifier d'abord si l'aide est demandée
for arg in "$@"; do
    if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
        print_help
        exit 0
    fi
done

# Vérifier qu'une action est fournie
if [[ $# -eq 0 ]]; then
    echo "Erreur: Action manquante" >&2
    print_help
    exit 1
fi

# Récupérer l'action
ACTION="$1"
shift

# Parsing des options
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=1
            shift
            ;;
        -k|--keep)
            KEEP_DAYS="$2"
            if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
                handle_error "La valeur pour --keep doit être un nombre entier"
            fi
            shift 2
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        -*)
            echo "Option inconnue: $1" >&2
            print_help
            exit 1
            ;;
        *)
            # Pour l'action delete, les arguments restants sont les suffixes
            if [[ "$ACTION" == "delete" || "$ACTION" == "rm" || "$ACTION" == "del" ]]; then
                break
            else
                echo "Argument inattendu: $1" >&2
                print_help
                exit 1
            fi
            ;;
    esac
done

# Valider l'action
case "$ACTION" in
    create|new|list|ls|clean|prune|delete|rm|del)
        ;;
    *)
        echo "Action inconnue: $ACTION" >&2
        print_help
        exit 1
        ;;
esac

# Vérifier que ZFS est disponible
if ! command -v zfs >/dev/null 2>&1; then
    handle_error "ZFS n'est pas installé ou disponible"
fi

# Vérifier que ZFS est utilisé
if ! is_zfs_used "$SCRIPT_DIR"; then
    handle_error "ZFS n'est pas utilisé dans ce projet"
fi

# Datasets à sauvegarder
DATASETS=(
    "ZROOT/docker/volumes/hornet-finder-api-db"
    "ZROOT/docker/volumes/hornet-finder-keycloak-db"
    "ZROOT/docker/volumes/hornet-finder-frontend-dist"
)

# Générer le timestamp YYMMDD-HHMMSS
TIMESTAMP=$(date +%y%m%d-%H%M%S)

# Fonction pour lister les snapshots
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
