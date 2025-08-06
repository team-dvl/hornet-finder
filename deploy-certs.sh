#!/usr/bin/env bash

#
# get_script_dir will work with either zsh or bash
# it can be used to retrieve the directory where the script is stored, in absolute form.
#
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

# Affichage de l'aide
print_help() {
    echo "Usage: $0 [-f] [-h]"
    echo "  -f    Force deletion"
    echo "  -h    this help"
}

# Parsing des options
while getopts ":fh" opt; do
    case "$opt" in
	f) FORCE=1 ;;
	h) print_help; exit 0 ;;
	\?) echo "Invalid option: -$OPTARG" >&2; print_help; exit 1 ;;
    esac
done

TARGET_DIR="$SCRIPT_DIR/certbot"

# Use common function for deletion confirmation
confirm_deletion "$TARGET_DIR" "$FORCE"

pushd $SCRIPT_DIR
stop_services_with_profile_and_volumes "" "gencert"
docker compose --profile gencert up --build certbot
stop_services_with_profile_and_volumes "" "gencert"






     
