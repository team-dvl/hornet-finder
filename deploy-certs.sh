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

SCRIPT_DIR="$(get_script_dir)"
TARGET_DIR="$SCRIPT_DIR/certbot"

if [ -d "$TARGET_DIR" ]; then
  if [ "$FORCE" -eq 1 ]; then
    echo "Forcibly deleting $TARGET_DIR"
    sudo rm -rf "$TARGET_DIR"
  else
    read -p "Existing '$TARGET_DIR' directory. would you like to delete it? [y/N] " response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
      echo "Deleting $TARGET_DIR"
      sudo rm -rf "$TARGET_DIR"
    else
	echo "Cancelled"
	exit 1
    fi
  fi
else
  echo "The directory '$TARGET_DIR' cannot be found."
fi

pushd $SCRIPT_DIR
docker compose --profile gencert down -v
docker compose --profile gencert up --build certbot
docker compose --profile gencert down -v






     
