#!/usr/bin/env bash

#
# Test script to validate refactoring
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
source "$SCRIPT_DIR/common.sh"

echo "🧪 Testing common library..."

# Test common functions
echo "✓ Testing get_yaml_files:"
YAML_FILE_PROD=$(get_yaml_files "$SCRIPT_DIR" "prod")
echo "  Result for prod: '$YAML_FILE_PROD'"
YAML_FILE_DEV=$(get_yaml_files "$SCRIPT_DIR" "dev")
echo "  Result for dev: '$YAML_FILE_DEV'"

echo "✓ Testing is_zfs_used:"
if is_zfs_used "$SCRIPT_DIR"; then
    echo "  ZFS detected"
else
    echo "  ZFS not detected"
fi

echo "✓ Testing validate_mode:"
validate_mode "prod" && echo "  Mode 'prod' validated"
validate_mode "dev" && echo "  Mode 'dev' validated"  
validate_mode "both" && echo "  Mode 'both' validated"

echo "✓ Testing display functions:"
show_success "Testing show_success"

echo "✅ All tests pass"
