#!/usr/bin/env bash

#
# Script de déploiement pour Hornet Finder
# Supporte les modes dev et prod avec SNI
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

MODE="both"
BUILD_FRONTEND=0
YAML_FILE=$(get_yaml_files "$SCRIPT_DIR")



# Affichage de l'aide
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --mode MODE     Mode de déploiement: 'dev', 'prod', ou 'both' (défaut: both)"
    echo "  -b, --build         Force le rebuild du frontend pour la production"
    echo "  -h, --help          Affiche cette aide"
    echo ""
    echo "Modes:"
    echo "  dev    - Déploie uniquement l'environnement de développement (dev.velutina.ovh)"
    echo "  prod   - Déploie uniquement l'environnement de production (velutina.ovh)"
    echo "  both   - Déploie les deux environnements (défaut)"
}

# Parsing des options
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_FRONTEND=1
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

# Validation du mode
validate_mode "$MODE"

echo "🚀 Déploiement Hornet Finder - Mode: $MODE"

cd "$SCRIPT_DIR"

# Create ZFS datasets if ZFS is used
if is_zfs_used "$SCRIPT_DIR"; then
    echo "🗄️ Vérification et création des datasets ZFS..."
    create_zfs_datasets_if_needed
fi

# Load environment variables
load_env

# Builder le frontend si nécessaire (pour le mode prod)
if [[ ("$MODE" == "prod" || "$MODE" == "both") && "$BUILD_FRONTEND" == 1 ]]; then
    build_frontend_production "$YAML_FILE"
fi

# Arrêter les services existants
stop_services "$YAML_FILE"

# Démarrer les services selon le mode
case "$MODE" in
    "dev")
        echo "🔧 Démarrage en mode développement..."
        docker compose ${YAML_FILE} --profile dev up -d --build
        ;;
    "prod")
        echo "🏭 Démarrage en mode production..."
        docker compose ${YAML_FILE} up -d --build
        ;;
    "both")
        echo "🌐 Démarrage en mode mixte (dev + prod)..."
        docker compose ${YAML_FILE} --profile dev up -d --build
        ;;
esac

# Attendre que les services soient prêts
wait_for_services

# Vérifier l'état des services
show_service_status "$YAML_FILE"

show_success "Déploiement terminé!"
print_deployment_urls "$MODE"
