#!/usr/bin/env bash

#
# Script d'arrêt pour Hornet Finder
# Arrête tous les services Docker de manière propre
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
REMOVE_VOLUMES=0

# Affichage de l'aide
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --force         Force l'arrêt sans confirmation"
    echo "  -y                  Équivalent à --force"
    echo "  -v, --volumes       Supprime également les volumes Docker"
    echo "  -h, --help          Affiche cette aide"
    echo ""
    echo "Description:"
    echo "  Arrête tous les services Docker de Hornet Finder de manière propre."
    echo "  Par défaut, demande une confirmation avant l'arrêt."
}

# Parsing des options
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force|-y)
            FORCE=1
            shift
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
            echo "Option inconnue: $1" >&2
            print_help
            exit 1
            ;;
    esac
done

cd "$SCRIPT_DIR"

# Get the appropriate YAML files
YAML_FILE=$(get_yaml_files "$SCRIPT_DIR")

# Confirmation avant arrêt
if [[ "$FORCE" != 1 ]]; then
    echo "🛑 Arrêt de tous les services Hornet Finder"
    if [[ "$REMOVE_VOLUMES" == 1 ]]; then
        echo "⚠️  ATTENTION: Les volumes Docker seront également supprimés (perte de données possible)"
    fi
    echo ""
    read -p "Êtes-vous sûr de vouloir continuer ? [y/N] " response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        echo "Arrêt annulé"
        exit 0
    fi
fi

echo "🛑 Arrêt en cours des services Hornet Finder..."

# Arrêter tous les services
shutdown_all_services "$YAML_FILE" "$REMOVE_VOLUMES"

# Vérifier qu'il ne reste plus de containers
check_remaining_containers "$YAML_FILE"

# Afficher l'état final
echo ""
echo "📊 État final des services:"
docker compose ${YAML_FILE} ps

# Optionnel: nettoyer les images orphelines
if [[ "$FORCE" == 1 && "$REMOVE_VOLUMES" == 1 ]]; then
    echo ""
    echo "🧹 Nettoyage des images orphelines..."
    docker image prune -f
fi

echo ""
show_success "Arrêt terminé!"
