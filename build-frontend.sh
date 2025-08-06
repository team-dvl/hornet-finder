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

# Load common functions
source "$SCRIPT_DIR/lib/common.sh"

cd "$SCRIPT_DIR"

YAML_FILE=$(get_yaml_files "$SCRIPT_DIR")

# Build the frontend
build_frontend_production "$YAML_FILE"

show_success "Build terminé! Les fichiers sont dans le volume 'frontend-dist'"

# Show build size
show_build_size
