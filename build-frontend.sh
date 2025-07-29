#!/usr/bin/env bash
set -e

#
# Script pour builder le frontend en production
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

echo "🔨 Construction du frontend pour la production..."

cd "$SCRIPT_DIR"

# Builder le frontend
docker compose --profile build-frontend up --build hornet-finder-frontend-build

# Nettoyer
docker compose --profile build-frontend down

echo "✅ Build terminé! Les fichiers sont dans le volume 'frontend-dist'"

# Afficher la taille du build
echo "📦 Taille du build:"
docker run --rm -v hornet-finder_frontend-dist:/data alpine sh -c "du -sh /data/* 2>/dev/null || echo 'Aucun fichier trouvé'"
