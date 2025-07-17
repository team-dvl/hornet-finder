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
MODE="both"
BUILD_FRONTEND=0

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
if [[ "$MODE" != "dev" && "$MODE" != "prod" && "$MODE" != "both" ]]; then
    echo "Erreur: Mode invalide '$MODE'. Utilisez 'dev', 'prod', ou 'both'." >&2
    exit 1
fi

echo "🚀 Déploiement Hornet Finder - Mode: $MODE"

cd "$SCRIPT_DIR"

# Vérifier que les fichiers de configuration existent
if [[ ! -f .env ]]; then
    echo "❌ Fichier .env manquant"
    exit 1
fi

# Charger les variables d'environnement
source .env

# Builder le frontend si nécessaire (pour le mode prod)
if [[ ("$MODE" == "prod" || "$MODE" == "both") && "$BUILD_FRONTEND" == 1 ]]; then
    echo "🔨 Construction du frontend pour la production..."
    docker compose --profile build-frontend up --build hornet-finder-frontend-build
    docker compose --profile build-frontend down
fi

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker compose down

# Démarrer les services selon le mode
case "$MODE" in
    "dev")
        echo "🔧 Démarrage en mode développement..."
        docker compose --profile dev up -d --build
        ;;
    "prod")
        echo "🏭 Démarrage en mode production..."
        docker compose up -d --build
        ;;
    "both")
        echo "🌐 Démarrage en mode mixte (dev + prod)..."
        docker compose --profile dev up -d --build
        ;;
esac

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier l'état des services
echo "📊 État des services:"
docker compose ps

echo "✅ Déploiement terminé!"
echo ""
echo "🌐 URLs disponibles:"
if [[ "$MODE" == "dev" || "$MODE" == "both" ]]; then
    echo "  - Développement: https://dev.velutina.ovh"
fi
if [[ "$MODE" == "prod" || "$MODE" == "both" ]]; then
    echo "  - Production: https://velutina.ovh"
fi
echo "  - Auth: https://auth.velutina.ovh"
echo "  - API: https://api.velutina.ovh"
